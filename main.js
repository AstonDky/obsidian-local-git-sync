const { Notice, Plugin, PluginSettingTab, Setting } = require("obsidian");
const childProcess = require("child_process");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const DEFAULT_SETTINGS = {
  remote: "origin",
  branch: "",
  gitPath: "",
  debounceSeconds: 10,
  intervalSeconds: 60,
  placeholderName: ".empty-folder.md",
  createEmptyFolderPlaceholders: true,
  syncOnStartup: true,
  showSuccessNotices: false
};

module.exports = class LocalGitSyncPlugin extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.vaultPath = this.app.vault?.adapter?.basePath ?? "";
    this.repoRoot = "";
    this.syncTimer = null;
    this.syncQueued = false;
    this.syncInFlight = false;
    this.statusBar = this.addStatusBarItem();

    this.setStatus("Starting");

    if (!this.vaultPath) {
      this.setStatus("Desktop only");
      new Notice("Local Git Sync requires the Obsidian desktop app.");
      return;
    }

    this.gitPath = this.resolveGitPath();
    await this.resolveRepoRoot();

    this.addSettingTab(new LocalGitSyncSettingTab(this.app, this));
    this.registerCommands();
    this.registerVaultEvents();

    this.registerInterval(window.setInterval(() => {
      this.queueSync("interval");
    }, Math.max(15, this.settings.intervalSeconds) * 1000));

    if (this.settings.syncOnStartup) {
      this.queueSync("startup", 2);
    } else {
      this.setStatus("Ready");
    }
  }

  onunload() {
    if (this.syncTimer) {
      window.clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
  }

  registerCommands() {
    this.addCommand({
      id: "sync-now",
      name: "Sync now",
      callback: () => this.syncNow("manual")
    });

    this.addCommand({
      id: "commit-now",
      name: "Commit local changes",
      callback: () => this.commitOnly("manual")
    });

    this.addCommand({
      id: "pull-now",
      name: "Pull from remote",
      callback: () => this.pullOnly("manual")
    });

    this.addCommand({
      id: "push-now",
      name: "Push to remote",
      callback: () => this.pushOnly("manual")
    });
  }

  registerVaultEvents() {
    this.registerEvent(this.app.vault.on("create", () => this.queueSync("create")));
    this.registerEvent(this.app.vault.on("modify", () => this.queueSync("modify")));
    this.registerEvent(this.app.vault.on("delete", () => this.queueSync("delete")));
    this.registerEvent(this.app.vault.on("rename", () => this.queueSync("rename")));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  resolveGitPath() {
    const configured = (this.settings.gitPath || "").trim();
    if (configured) {
      return configured;
    }

    const candidates = [
      "git",
      "C:\\Program Files\\Git\\cmd\\git.exe",
      "C:\\Program Files\\Git\\bin\\git.exe",
      "C:\\Program Files (x86)\\Git\\cmd\\git.exe",
      "C:\\Program Files (x86)\\Git\\bin\\git.exe"
    ];

    for (const candidate of candidates) {
      if (candidate === "git" || fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return "git";
  }

  async resolveRepoRoot() {
    const result = await this.runGit(["-C", this.vaultPath, "rev-parse", "--show-toplevel"], { allowFailure: true });
    if (result.code === 0 && result.stdout.trim()) {
      this.repoRoot = result.stdout.trim();
      return;
    }

    const parent = path.resolve(this.vaultPath, "..");
    if (fs.existsSync(path.join(parent, ".git"))) {
      this.repoRoot = parent;
      return;
    }

    this.setStatus("No repository");
    throw new Error("Cannot find a Git repository for this vault.");
  }

  queueSync(reason, delaySeconds) {
    if (!this.repoRoot) {
      return;
    }

    const delay = delaySeconds ?? this.settings.debounceSeconds;
    if (this.syncTimer) {
      window.clearTimeout(this.syncTimer);
    }

    this.setStatus(`Waiting (${reason})`);
    this.syncTimer = window.setTimeout(() => {
      this.syncTimer = null;
      void this.syncNow(reason);
    }, Math.max(0, delay) * 1000);
  }

  async syncNow(reason) {
    return this.runSerializedTask(async () => {
      this.setStatus("Syncing");

      await this.ensureEmptyFolderPlaceholders();
      const branch = await this.getBranchName();
      const hasRemote = await this.remoteExists();

      if (hasRemote) {
        await this.pullRemote(branch, reason === "manual");
      }

      const committed = await this.commitPendingChanges();

      if (hasRemote) {
        await this.pushRemote(branch);
      } else if (committed) {
        this.showNotice("Committed local changes. No Git remote is configured, so pull and push were skipped.");
      }

      this.setStatus("Up to date");
      if (this.settings.showSuccessNotices) {
        this.showNotice("Local Git Sync completed successfully.");
      }
    });
  }

  async commitOnly() {
    return this.runSerializedTask(async () => {
      this.setStatus("Committing");
      await this.ensureEmptyFolderPlaceholders();
      const committed = await this.commitPendingChanges();
      this.setStatus(committed ? "Committed" : "No local changes");
      if (committed && this.settings.showSuccessNotices) {
        this.showNotice("Committed local changes.");
      }
    });
  }

  async pullOnly() {
    return this.runSerializedTask(async () => {
      this.setStatus("Pulling");
      const branch = await this.getBranchName();
      if (!(await this.remoteExists())) {
        throw new Error(`Git remote "${this.settings.remote}" is not configured.`);
      }
      await this.pullRemote(branch, true);
      this.setStatus("Pulled");
      if (this.settings.showSuccessNotices) {
        this.showNotice("Pulled the latest changes from the remote.");
      }
    });
  }

  async pushOnly() {
    return this.runSerializedTask(async () => {
      this.setStatus("Pushing");
      const branch = await this.getBranchName();
      if (!(await this.remoteExists())) {
        throw new Error(`Git remote "${this.settings.remote}" is not configured.`);
      }
      await this.ensureEmptyFolderPlaceholders();
      await this.commitPendingChanges();
      await this.pushRemote(branch);
      this.setStatus("Pushed");
      if (this.settings.showSuccessNotices) {
        this.showNotice("Pushed local commits to the remote.");
      }
    });
  }

  async runSerializedTask(task) {
    if (this.syncInFlight) {
      this.syncQueued = true;
      return;
    }

    this.syncInFlight = true;

    try {
      await task();
    } catch (error) {
      const message = error?.message || String(error);
      this.setStatus("Error");
      console.error("[Local Git Sync]", error);
      this.showNotice(message);
    } finally {
      this.syncInFlight = false;
      if (this.syncQueued) {
        this.syncQueued = false;
        this.queueSync("queued", 3);
      }
    }
  }

  async commitPendingChanges() {
    const status = await this.git(["status", "--porcelain"]);
    if (!status.stdout.trim()) {
      return false;
    }

    await this.git(["add", "-A", "--", "."]);

    const staged = await this.git(["diff", "--cached", "--name-only"]);
    const changedFiles = staged.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (changedFiles.length === 0) {
      return false;
    }

    const latestDate = await this.getLatestFileDate(changedFiles);
    const message = `Auto sync ${this.formatMessageDate(latestDate)}`;
    const gitDate = this.formatGitDate(latestDate);

    await this.git(["commit", "-m", message], {
      env: {
        GIT_AUTHOR_DATE: gitDate,
        GIT_COMMITTER_DATE: gitDate
      }
    });

    return true;
  }

  async pullRemote(branch, showWarning) {
    const result = await this.runGit([
      "-C",
      this.repoRoot,
      "pull",
      "--rebase",
      "--autostash",
      this.settings.remote,
      branch
    ], { allowFailure: true });

    if (result.code === 0) {
      return;
    }

    const combined = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
    if (/conflict/i.test(combined)) {
      const warning = "Git pull reported a conflict. Resolve the conflict in your repository, then run sync again.";
      if (showWarning) {
        this.showNotice(warning);
      }
      throw new Error(warning);
    }

    throw new Error(combined || `Failed to pull from ${this.settings.remote}/${branch}.`);
  }

  async pushRemote(branch) {
    await this.git(["push", this.settings.remote, branch]);
  }

  async remoteExists() {
    const result = await this.runGit([
      "-C",
      this.repoRoot,
      "remote",
      "get-url",
      this.settings.remote
    ], { allowFailure: true });

    return result.code === 0;
  }

  async getBranchName() {
    if ((this.settings.branch || "").trim()) {
      return this.settings.branch.trim();
    }

    const result = await this.git(["rev-parse", "--abbrev-ref", "HEAD"]);
    const branch = result.stdout.trim();
    if (!branch) {
      throw new Error("Cannot determine the current Git branch.");
    }
    return branch;
  }

  async getLatestFileDate(files) {
    let latest = null;

    for (const file of files) {
      const fullPath = path.join(this.repoRoot, file);
      try {
        const stat = await fsp.stat(fullPath);
        if (!latest || stat.mtime > latest) {
          latest = stat.mtime;
        }
      } catch (error) {
        // Deleted files do not have a current mtime.
      }
    }

    return latest || new Date();
  }

  formatMessageDate(date) {
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  formatGitDate(date) {
    const offsetMinutes = -date.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const absolute = Math.abs(offsetMinutes);
    const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
    const minutes = String(absolute % 60).padStart(2, "0");
    const iso = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-") + "T" + [
      String(date.getHours()).padStart(2, "0"),
      String(date.getMinutes()).padStart(2, "0"),
      String(date.getSeconds()).padStart(2, "0")
    ].join(":");

    return `${iso} ${sign}${hours}${minutes}`;
  }

  async ensureEmptyFolderPlaceholders() {
    if (!this.settings.createEmptyFolderPlaceholders) {
      return;
    }

    const placeholderName = (this.settings.placeholderName || ".empty-folder.md").trim() || ".empty-folder.md";
    const walk = async (dir) => {
      const entries = await fsp.readdir(dir, { withFileTypes: true });
      const childDirs = [];
      const realFiles = [];

      for (const entry of entries) {
        if (entry.name === ".git") {
          continue;
        }

        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          childDirs.push(fullPath);
          await walk(fullPath);
        } else if (entry.isFile() && entry.name !== placeholderName) {
          realFiles.push(fullPath);
        }
      }

      const placeholderPath = path.join(dir, placeholderName);
      if (childDirs.length === 0 && realFiles.length === 0) {
        if (!fs.existsSync(placeholderPath)) {
          await fsp.writeFile(placeholderPath, "This file keeps the empty folder in Git.\n", "utf8");
        }
      } else if (fs.existsSync(placeholderPath)) {
        await fsp.unlink(placeholderPath);
      }
    };

    await walk(this.vaultPath);
  }

  git(args, options = {}) {
    return this.runGit(["-C", this.repoRoot, ...args], options).then((result) => {
      if (result.code !== 0) {
        throw new Error((result.stderr || result.stdout || `git ${args.join(" ")} failed`).trim());
      }
      return result;
    });
  }

  runGit(args, options = {}) {
    return new Promise((resolve, reject) => {
      const env = Object.assign({}, process.env, options.env || {});

      childProcess.execFile(this.gitPath, args, {
        cwd: this.repoRoot || this.vaultPath,
        env,
        windowsHide: true,
        timeout: 120000
      }, (error, stdout, stderr) => {
        const code = error ? (typeof error.code === "number" ? error.code : 1) : 0;
        if (error && error.killed) {
          reject(new Error("Git command timed out."));
          return;
        }

        resolve({
          code,
          stdout: stdout || "",
          stderr: stderr || error?.message || ""
        });
      });
    });
  }

  showNotice(message) {
    new Notice(message, 8000);
  }

  setStatus(text) {
    if (this.statusBar) {
      this.statusBar.setText(`Local Git Sync: ${text}`);
    }
  }
};

class LocalGitSyncSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("local-git-sync-setting");
    containerEl.createEl("h2", { text: "Local Git Sync" });
    containerEl.createEl("p", {
      text: "This plugin operates on the Git repository that contains the current vault. If your vault lives inside a larger repository, sync actions apply to that repository."
    });

    new Setting(containerEl)
      .setName("Git remote")
      .setDesc("Remote used for pull and push operations.")
      .addText((text) => text
        .setPlaceholder("origin")
        .setValue(this.plugin.settings.remote)
        .onChange(async (value) => {
          this.plugin.settings.remote = value.trim() || "origin";
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Branch")
      .setDesc("Leave empty to use the current checked-out branch.")
      .addText((text) => text
        .setPlaceholder("main")
        .setValue(this.plugin.settings.branch)
        .onChange(async (value) => {
          this.plugin.settings.branch = value.trim();
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Git executable path")
      .setDesc("Optional custom path to git. Leave empty to use the system git command.")
      .addText((text) => text
        .setPlaceholder("git")
        .setValue(this.plugin.settings.gitPath)
        .onChange(async (value) => {
          this.plugin.settings.gitPath = value.trim();
          this.plugin.gitPath = this.plugin.resolveGitPath();
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Auto sync delay")
      .setDesc("Seconds to wait after changes stop before syncing.")
      .addText((text) => text
        .setValue(String(this.plugin.settings.debounceSeconds))
        .onChange(async (value) => {
          this.plugin.settings.debounceSeconds = Math.max(3, Number(value) || 10);
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Background sync interval")
      .setDesc("Fallback periodic sync interval in seconds.")
      .addText((text) => text
        .setValue(String(this.plugin.settings.intervalSeconds))
        .onChange(async (value) => {
          this.plugin.settings.intervalSeconds = Math.max(15, Number(value) || 60);
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Sync on startup")
      .setDesc("Run a sync shortly after the vault opens.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.syncOnStartup)
        .onChange(async (value) => {
          this.plugin.settings.syncOnStartup = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Create placeholders for empty folders")
      .setDesc("Automatically create a small Markdown file in empty folders so Git can track them.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.createEmptyFolderPlaceholders)
        .onChange(async (value) => {
          this.plugin.settings.createEmptyFolderPlaceholders = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Placeholder file name")
      .setDesc("Used only when empty-folder placeholders are enabled.")
      .addText((text) => text
        .setPlaceholder(".empty-folder.md")
        .setValue(this.plugin.settings.placeholderName)
        .onChange(async (value) => {
          this.plugin.settings.placeholderName = value.trim() || ".empty-folder.md";
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Show success notices")
      .setDesc("Errors always show a notice. This controls success popups.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.showSuccessNotices)
        .onChange(async (value) => {
          this.plugin.settings.showSuccessNotices = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Sync now")
      .setDesc("Run pull, commit, and push immediately.")
      .addButton((button) => button
        .setButtonText("Run")
        .onClick(() => this.plugin.syncNow("settings")));
  }
}

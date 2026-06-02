<div align="center">

# Local Git Sync

**Sync and back up Obsidian vault changes using Git**

[![Version](https://img.shields.io/badge/version-1.0.0-2ea44f)](./manifest.json)
[![Obsidian](https://img.shields.io/badge/Obsidian-desktop%20only-7c3aed)](./manifest.json)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![Release assets](https://img.shields.io/badge/release-main.js%20%7C%20manifest.json%20%7C%20styles.css-orange)](#release-assets)

[English](#english) | [中文](#中文)

</div>

---

## Preview

> Screenshot placeholder  
> Replace this section with plugin screenshots later.

```text
docs/images/preview-1.png
docs/images/preview-2.png
```

> Demo video placeholder  
> Replace this section with your demo video link later.

```text
https://github.com/<your-name>/obsidian-local-git-sync/assets/<video-id>
```

---

## English

### Overview

Local Git Sync is an unofficial Obsidian desktop plugin for users who manage their vaults with Git. It helps you commit, pull, push, and auto-sync vault changes without leaving Obsidian.

This plugin uses the local Git executable on your machine and works with GitHub, GitLab, Gitee, or self-hosted Git remotes that you configure yourself.

### Highlights

- Auto commit local vault changes
- Pull from a configured Git remote
- Push local commits to a configured Git remote
- Auto sync while the vault is open
- Conflict warning when pull with rebase reports conflicts
- Remote support for GitHub, GitLab, Gitee, and self-hosted Git services
- Optional empty-folder placeholder files for Git tracking

### Installation

#### Community Plugins

After the plugin passes review, it can be installed from the Obsidian Community Plugins directory.

#### Manual installation

1. Open your vault folder.
2. Create the plugin directory:
   `VaultFolder/.obsidian/plugins/local-git-sync/`
3. Copy these files into that directory:
   - `main.js`
   - `manifest.json`
   - `styles.css`
4. Restart Obsidian or reload community plugins.
5. Enable `Local Git Sync` in `Settings -> Community plugins`.

### Requirements

- Git must be installed on the local machine.
- The vault should already be inside a Git repository.
- If you want pull and push support, configure a Git remote first.
- If you use SSH or HTTPS tokens, configure them in Git yourself.
- This plugin does not collect, store, upload, or manage credentials.

### Configuration Guide

#### 1. Check Git

Run this in a terminal:

```bash
git --version
```

If Git is not available on your `PATH`, install it first. On Windows, the plugin can also detect common default Git installation paths. If needed, you can set a custom path in the plugin settings.

#### 2. Check or initialize your vault repository

Open a terminal in your vault root:

```bash
git status
```

If the vault is not a Git repository yet:

```bash
git init
git add .
git commit -m "Initial vault commit"
```

If your vault is stored inside a larger Git repository, the plugin will operate on that repository, not only on the vault subfolder.

#### 3. Add a remote

Example using HTTPS:

```bash
git remote add origin https://github.com/your-name/your-vault.git
```

Example using SSH:

```bash
git remote add origin git@github.com:your-name/your-vault.git
```

#### 4. Verify authentication outside Obsidian

Before using the plugin, test standard Git commands:

```bash
git pull origin main
git push origin main
```

If these commands fail in the terminal, the plugin will fail too. Fix authentication first through your Git credential manager, token, or SSH key setup.

#### 5. Enable the plugin

After enabling `Local Git Sync`, review these settings:

- `Git remote`: defaults to `origin`
- `Branch`: leave empty to use the current checked-out branch
- `Git executable path`: optional custom path to `git`
- `Auto sync delay`: wait time after changes stop
- `Background sync interval`: periodic fallback sync
- `Sync on startup`: sync shortly after opening the vault
- `Create placeholders for empty folders`: keep empty folders trackable by Git
- `Placeholder file name`: default is `.empty-folder.md`
- `Show success notices`: controls success popups

#### 6. First sync

Open the command palette and run:

```text
Local Git Sync: Sync now
```

Typical flow:

1. The plugin checks the current repository and remote.
2. If a remote exists, it pulls with rebase and autostash.
3. It stages local changes and creates a commit if needed.
4. If a remote exists, it pushes local commits.
5. The status bar shows the current sync state.

#### 7. Daily usage

The plugin listens for create, modify, delete, and rename events in the vault. After edits settle for a short time, it starts an automatic sync. A background interval also runs as a fallback.

### Conflict Handling

- If `git pull --rebase` reports a conflict, the plugin shows a warning.
- Resolve the conflict in your repository with normal Git tools.
- Complete the rebase if required.
- Run sync again after the repository is clean.

### Privacy and Security

- The plugin only operates on your local vault repository and the Git remote you configured.
- The plugin does not use telemetry.
- The plugin does not collect note content.
- The plugin does not include any private Obsidian Sync service.
- The plugin is unofficial and not affiliated with Obsidian.

### FAQ

#### What if Git is not installed?

Install Git first and verify `git --version`. If Git is installed but not on `PATH`, set a custom Git executable path in the plugin settings.

#### What if GitHub authentication fails?

Test these commands first:

```bash
git fetch origin
git pull origin main
git push origin main
```

If they fail, fix your credential helper, token, or SSH configuration outside Obsidian.

#### What is the recommended multi-device workflow?

Use the same remote and branch on every device. Make sure each device can pull and push independently before relying on automatic sync.

#### Can this plugin initialize a Git repository for me?

Not in the current release. Initialize the repository manually before enabling automatic sync.



### Disclaimer

This plugin is unofficial and is not affiliated with, endorsed by, or sponsored by Obsidian.

---

## 中文

### 项目简介

Local Git Sync 是一个非官方的 Obsidian 桌面插件，适合已经使用 Git 管理笔记库的用户。它可以帮助你直接在 Obsidian 中完成提交、拉取、推送和自动同步。

这个插件依赖你本机安装的 Git，可配合 GitHub、GitLab、Gitee 或自建 Git 远程仓库使用。所有远程连接和认证都通过你自己的 Git 配置完成。

### 功能特性

- 自动提交本地 vault 改动
- 从已配置的 Git remote 拉取更新
- 将本地提交推送到 Git remote
- 在 Obsidian 打开期间自动同步
- 在 `pull --rebase` 发生冲突时给出提示
- 支持 GitHub、GitLab、Gitee 和自建 Git 服务
- 可选为空文件夹自动生成占位文件，方便 Git 跟踪

### 安装方式

#### 社区插件安装

插件通过审核后，可在 Obsidian Community Plugins 中直接安装。

#### 手动安装

1. 打开你的 vault 文件夹。
2. 创建插件目录：
   `VaultFolder/.obsidian/plugins/local-git-sync/`
3. 将以下文件复制进去：
   - `main.js`
   - `manifest.json`
   - `styles.css`
4. 重启 Obsidian，或重新加载社区插件。
5. 在 `设置 -> 社区插件` 中启用 `Local Git Sync`。

### 使用前要求

- 本机必须已安装 Git
- vault 需要已经处于 Git 仓库中
- 如果要使用 pull / push，需要先配置好 Git remote
- 如果使用 SSH 或 HTTPS token，请由用户自行通过 Git 配置
- 插件不会收集、保存、上传或管理你的凭据

### 配置流程

#### 1. 检查 Git 是否可用

在终端运行：

```bash
git --version
```

如果系统无法识别 Git，请先安装 Git。Windows 下插件会尝试识别常见的默认安装路径；如果仍然找不到，可以在插件设置中手动填写 `git.exe` 路径。

#### 2. 检查或初始化 vault 仓库

进入 vault 根目录，运行：

```bash
git status
```

如果当前 vault 还不是 Git 仓库，可以先执行：

```bash
git init
git add .
git commit -m "Initial vault commit"
```

如果你的 vault 是放在一个更大的 Git 仓库里面，插件会对那个仓库执行同步，而不只是针对 vault 子目录。这一点需要你提前确认。

#### 3. 配置远程仓库

HTTPS 示例：

```bash
git remote add origin https://github.com/your-name/your-vault.git
```

SSH 示例：

```bash
git remote add origin git@github.com:your-name/your-vault.git
```

#### 4. 先在 Obsidian 外验证认证

建议先在终端测试：

```bash
git pull origin main
git push origin main
```

如果这些命令在终端里都不能正常工作，插件里也同样无法正常同步。需要先把 Git 的认证问题解决，比如 credential manager、token 或 SSH key。

#### 5. 启用插件并检查设置

启用 `Local Git Sync` 后，建议重点检查这些配置项：

- `Git remote`：默认是 `origin`
- `Branch`：留空时使用当前已检出的分支
- `Git executable path`：可选，自定义 `git` 路径
- `Auto sync delay`：文件改动停止后等待多久再同步
- `Background sync interval`：后台定时补偿同步间隔
- `Sync on startup`：打开 vault 后是否自动同步一次
- `Create placeholders for empty folders`：是否为空文件夹创建占位文件
- `Placeholder file name`：占位文件名，默认 `.empty-folder.md`
- `Show success notices`：是否显示成功提示

#### 6. 第一次同步

打开命令面板，执行：

```text
Local Git Sync: Sync now
```

通常流程如下：

1. 插件先检查当前仓库和远程配置
2. 如果存在 remote，会先执行带 rebase 的 pull
3. 再暂存本地改动并自动创建提交
4. 如果存在 remote，会继续 push
5. 当前状态会显示在底部状态栏中

#### 7. 日常使用方式

插件会监听 vault 内的创建、修改、删除、重命名事件。你停止编辑一小段时间后，它会自动触发同步。同时还会有一个定时检查作为补偿，避免漏掉某些没有触发事件的仓库变更。

### 冲突处理

- 如果 `git pull --rebase` 出现冲突，插件会给出警告
- 请使用你平时的 Git 工具手动解决冲突
- 如有需要，先完成 rebase
- 仓库恢复干净后，再重新执行同步

### 隐私与安全

- 插件只操作你的本地 vault 仓库，以及你自己配置的 Git remote
- 插件不使用遥测
- 插件不收集笔记内容
- 插件不内置 Obsidian 官方 Sync 私有服务
- 插件不是 Obsidian 官方项目

### 常见问题

#### 没安装 Git 怎么办？

先安装 Git，并确认 `git --version` 可以正常运行。如果 Git 已安装但不在 PATH 中，可以在插件设置里手动填写 Git 可执行文件路径。

#### GitHub / GitLab / Gitee 认证失败怎么办？

先在终端测试：

```bash
git fetch origin
git pull origin main
git push origin main
```

如果这些命令失败，请先修复 Git 本身的认证配置，再回到 Obsidian 使用插件。

#### 多设备同步有什么建议？

建议所有设备都使用同一个 remote 和同一套分支策略，并分别确认每台设备都能独立完成 pull 和 push，再依赖自动同步。

#### 插件能不能自动帮我初始化仓库？

当前版本不包含这个功能。建议你先手动完成 Git 初始化，再启用插件。

### Release 资产



### 免责声明

This plugin is unofficial and is not affiliated with, endorsed by, or sponsored by Obsidian.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const srcPath = path.join(projectRoot, "src", "main.ts");
const outPath = path.join(projectRoot, "main.js");
const manifestPath = path.join(projectRoot, "manifest.json");
const versionsPath = path.join(projectRoot, "versions.json");
const stylesPath = path.join(projectRoot, "styles.css");

const [source, manifestText, versionsText] = await Promise.all([
  readFile(srcPath, "utf8"),
  readFile(manifestPath, "utf8"),
  readFile(versionsPath, "utf8")
]);

const manifest = JSON.parse(manifestText);
const versions = JSON.parse(versionsText);

if (!manifest.version || typeof manifest.version !== "string") {
  throw new Error("manifest.json must contain a semantic version string.");
}

if (!versions[manifest.version]) {
  throw new Error(`versions.json must include a compatibility entry for ${manifest.version}.`);
}

await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, `${source.trim()}\n`, "utf8");
await writeFile(stylesPath, (await readFile(stylesPath, "utf8")).trimEnd() + "\n", "utf8");

console.log(`Built ${path.basename(outPath)} for ${manifest.id}@${manifest.version}`);

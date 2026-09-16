import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const paths = {
  packageJson: path.join(root, "package.json"),
  packageLock: path.join(root, "package-lock.json"),
  tauriConfig: path.join(root, "src-tauri", "tauri.conf.json"),
  cargoToml: path.join(root, "src-tauri", "Cargo.toml"),
  cargoLock: path.join(root, "src-tauri", "Cargo.lock"),
};

function nextPatch(version) {
  const parts = String(version || "1.0.0").split(".").map((part) => Number(part));
  const major = Number.isFinite(parts[0]) ? parts[0] : 1;
  const minor = Number.isFinite(parts[1]) ? parts[1] : 0;
  const patch = Number.isFinite(parts[2]) ? parts[2] : 0;
  return `${major}.${minor}.${patch + 1}`;
}

function replaceFirstVersionToml(text, version) {
  return text.replace(/^version\s*=\s*"[^"]+"/m, `version = "${version}"`);
}

function replacePackageInCargoLock(text, packageName, version) {
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index] === "[[package]]" && lines[index + 1] === `name = "${packageName}"`) {
      for (let versionIndex = index + 2; versionIndex < lines.length; versionIndex += 1) {
        if (lines[versionIndex] === "[[package]]") break;
        if (lines[versionIndex].startsWith("version = ")) {
          lines[versionIndex] = `version = "${version}"`;
          break;
        }
      }
      break;
    }
  }
  return lines.join("\n");
}

const packageJson = JSON.parse(await fs.readFile(paths.packageJson, "utf8"));
const version = nextPatch(packageJson.version);
packageJson.version = version;
await fs.writeFile(paths.packageJson, `${JSON.stringify(packageJson, null, 2)}\n`);

const packageLock = JSON.parse(await fs.readFile(paths.packageLock, "utf8"));
packageLock.version = version;
if (packageLock.packages?.[""]) packageLock.packages[""].version = version;
await fs.writeFile(paths.packageLock, `${JSON.stringify(packageLock, null, 2)}\n`);

const tauriConfig = JSON.parse(await fs.readFile(paths.tauriConfig, "utf8"));
tauriConfig.version = version;
await fs.writeFile(paths.tauriConfig, `${JSON.stringify(tauriConfig, null, 2)}\n`);

const cargoToml = await fs.readFile(paths.cargoToml, "utf8");
await fs.writeFile(paths.cargoToml, replaceFirstVersionToml(cargoToml, version));

try {
  const cargoLock = await fs.readFile(paths.cargoLock, "utf8");
  await fs.writeFile(paths.cargoLock, replacePackageInCargoLock(cargoLock, "flowdetect_agent", version));
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

console.log(`FlowDetect Agent version bumped to ${version}`);

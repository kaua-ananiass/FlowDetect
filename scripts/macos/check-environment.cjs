// Read-only preflight for the M1 Pro / macOS controller port. Does not install or build.
const { spawnSync } = require("node:child_process");

function inspectEnvironment({ platform = process.platform, arch = process.arch, run = spawnSync } = {}) {
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok, detail });
  add("macOS", platform === "darwin", platform);
  add("Apple Silicon nativo", arch === "arm64", arch);
  if (platform !== "darwin") return checks;
  const probe = (name, program, args, accept = () => true) => {
    const result = run(program, args, { encoding: "utf8", timeout: 15000, shell: false });
    const output = String(result.stdout || "").trim();
    add(name, !result.error && result.status === 0 && accept(output),
      result.error ? result.error.message : output || String(result.stderr || "").trim());
  };
  probe("Versao do macOS", "/usr/bin/sw_vers", ["-productVersion"]);
  probe("SDK macOS", "/usr/bin/xcrun", ["--sdk", "macosx", "--show-sdk-path"]);
  probe("Cargo", "cargo", ["--version"]);
  probe("Alvo Rust ARM64", "rustup", ["target", "list", "--installed"],
    output => output.split(/\s+/).includes("aarch64-apple-darwin"));
  return checks;
}

if (require.main === module) {
  const checks = inspectEnvironment();
  for (const check of checks) console.log(`${check.ok ? "OK" : "PENDENTE"} | ${check.name}: ${check.detail}`);
  console.log("Esta verificacao nao gera DMG e nao certifica compatibilidade funcional.");
  console.log("Port em andamento: runtime do editor, empacotamento, assinatura e testes Mac -> Agent Windows ainda pendentes.");
  process.exitCode = checks.every(check => check.ok) ? 0 : 1;
}
module.exports = { inspectEnvironment };

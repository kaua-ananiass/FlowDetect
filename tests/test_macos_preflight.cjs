const { test } = require("node:test");
const assert = require("node:assert/strict");
const { inspectEnvironment } = require("../scripts/macos/check-environment.cjs");

test("Windows preflight never starts Apple tools or installs dependencies", () => {
  const checks = inspectEnvironment({ platform: "win32", arch: "x64", run() { throw Error("Must not execute"); } });
  assert.equal(checks.every(check => check.ok), false);
});

test("native arm64 Mac requires a working SDK and Rust target", () => {
  const checks = inspectEnvironment({ platform: "darwin", arch: "arm64", run(program, args, options) {
    assert.equal(options.shell, false);
    return { status: 0, stdout: program === "rustup" ? "aarch64-apple-darwin\n" : "available" };
  } });
  assert.equal(checks.length, 6);
  assert.ok(checks.every(check => check.ok));
});

test("Rosetta and a missing ARM64 target are reported as pending", () => {
  const checks = inspectEnvironment({ platform: "darwin", arch: "x64", run() { return { status: 0, stdout: "x86_64-apple-darwin" }; } });
  assert.equal(checks.find(check => check.name === "Apple Silicon nativo").ok, false);
  assert.equal(checks.find(check => check.name === "Alvo Rust ARM64").ok, false);
});

test("missing build tools are reported without crashing", () => {
  const checks = inspectEnvironment({ platform: "darwin", arch: "arm64", run() { return { status: null, error: Error("ENOENT") }; } });
  assert.equal(checks.filter(check => !check.ok).length, 4);
});

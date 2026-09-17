const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "../tauri_gerador/web/main.js"), "utf8");
const found = source.match(/^function normalizeCommandMapZoom\(.*?^}/ms);
assert.ok(found, "Production zoom normalizer");
const context = vm.createContext({ Number });
vm.runInContext(found[0], context);

test("command map accepts zoom values outside the previous fixed range", () => {
  assert.equal(context.normalizeCommandMapZoom(0.08, 1), 0.08);
  assert.equal(context.normalizeCommandMapZoom(3.75, 1), 3.75);
  assert.equal(context.normalizeCommandMapZoom(18, 1), 18);
});

test("invalid zoom never replaces the current valid scale", () => {
  assert.equal(context.normalizeCommandMapZoom(0, 0.72), 0.72);
  assert.equal(context.normalizeCommandMapZoom("invalid", 2.4), 2.4);
});

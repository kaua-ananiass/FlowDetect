const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.join(__dirname, "../flowdetect_chrome");
const html = fs.readFileSync(path.join(root, "sidepanel.html"), "utf8");
const source = fs.readFileSync(path.join(root, "sidepanel.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

test("Chrome popup keeps execution details inside the active automation card", () => {
  assert.equal(manifest.action.default_popup, "sidepanel.html");
  assert.equal(manifest.permissions.includes("sidePanel"), false);
  assert.equal(manifest.side_panel, undefined);
  assert.match(html, /class="import-automation"/);
  assert.match(html, /id="newButton"/);
  assert.match(source, /newButton.addEventListener/);
  assert.doesNotMatch(html, /class="hero"/);
  assert.doesNotMatch(html, /class="overview"/);
  assert.doesNotMatch(html, /class="run-panel"/);
  assert.match(html, /class="execution" hidden/);
  assert.match(html, /class="progress-bar"/);
  assert.match(html, /class="run-log"/);
  assert.match(source, /const ordered = \[\.\.\.automationsCache\]\.sort/);
  assert.match(source, /execution-percent/);
});

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "../tauri_gerador/web/main.js"), "utf8");
const styleSource = fs.readFileSync(path.join(__dirname, "../tauri_gerador/web/style.css"), "utf8");
const names = [
  "normalizeCommandMapZoom", "commandMapWheelZoomFactor", "commandMapTreePanCoordinate",
  "commandMapTreeEnergyAnimationDelay",
];
const functions = names.map((name) => {
  const found = source.match(new RegExp(`^function ${name}\\(.*?^}`, "ms"));
  assert.ok(found, `Production function ${name}`);
  return found[0];
}).join("\n");
const context = vm.createContext({ Number, Math, Date: { now: () => 3250 } });
vm.runInContext(functions, context);

test("command map accepts zoom values outside the previous fixed range", () => {
  assert.equal(context.normalizeCommandMapZoom(0.08, 1), 0.08);
  assert.equal(context.normalizeCommandMapZoom(3.75, 1), 3.75);
  assert.equal(context.normalizeCommandMapZoom(18, 1), 18);
});

test("invalid zoom never replaces the current valid scale", () => {
  assert.equal(context.normalizeCommandMapZoom(0, 0.72), 0.72);
  assert.equal(context.normalizeCommandMapZoom("invalid", 2.4), 2.4);
});

test("wheel zoom changes gradually and limits a large scroll event", () => {
  const factor = context.commandMapWheelZoomFactor(120);
  assert.ok(factor > 0.95 && factor < 1, `expected a gentle reduction, got ${factor}`);
  assert.ok(context.commandMapWheelZoomFactor(-120) > 1);
  assert.equal(
    context.commandMapWheelZoomFactor(5000),
    context.commandMapWheelZoomFactor(240),
  );
});

test("tree pan has no map-size boundary", () => {
  assert.equal(context.commandMapTreePanCoordinate(0, -50000), -50000);
  assert.equal(context.commandMapTreePanCoordinate(-50000, 100000), 50000);
  assert.equal(context.commandMapTreePanCoordinate("invalid", 24), 24);
});

test("recreated route dots resume at the current animation phase", () => {
  assert.equal(context.commandMapTreeEnergyAnimationDelay(1.55), "-0.150s");
  assert.equal(context.commandMapTreeEnergyAnimationDelay(1.8), "-1.450s");
  assert.match(styleSource, /animation-delay:\s*var\(--tree-energy-delay, 0s\)/);
});

test("zoom scales the existing map without rebuilding its connector layer", () => {
  const zoomFunction = source.match(/^function setCommandMapZoom\(.*?^}/ms);
  assert.ok(zoomFunction, "Production function setCommandMapZoom");
  assert.doesNotMatch(zoomFunction[0], /scheduleCommandConnectorLayout/);
});

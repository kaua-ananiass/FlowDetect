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
  assert.match(styleSource, /\.command-map-tree\s*\{[^}]*\) scale\(var\(--command-map-zoom\)\)/s);
  assert.doesNotMatch(styleSource.match(/\.command-map-tree\s*\{[^}]*\}/s)?.[0] || "", /\bzoom\s*:/);
});

test("map cards start sharp while free wheel zoom remains available", () => {
  assert.match(source, /commandMapZoom:\s*1,\s*commandMapRequestedZoom:\s*1/);
  assert.match(styleSource, /\.command-map-list\s*\{\s*--command-map-zoom:\s*1;/);
  assert.doesNotMatch(styleSource.match(/\.command-map-tree\s*\{[\s\S]*?\n\}/)?.[0] || "", /translate3d/);
  assert.doesNotMatch(styleSource.match(/\.command-tree-card\.is-inline-expanded\s*\{[\s\S]*?\n\}/)?.[0] || "", /preserve-3d|will-change/);
  const wheelHandler = source.match(/^function handleCommandMapTreeWheelZoom\(.*?^}/ms)?.[0] || "";
  assert.doesNotMatch(wheelHandler, /event\.ctrlKey/);
  assert.match(wheelHandler, /setCommandMapZoom\(nextZoom/);
});

test("tree zoom holds the point under the cursor without scrolling the whole map", () => {
  const zoomFunction = source.match(/^function setCommandMapZoom\(.*?^}/ms);
  const state = { commandMapZoom: 1, commandMapTreePanOffset: { x: 20, y: 30 }, activeTab: "commands" };
  const list = {
    scrollLeft: 0, scrollTop: 0,
    classList: { contains: () => true },
    querySelector: () => ({ getBoundingClientRect: () => ({ left: 100, top: 50 }) }),
    getBoundingClientRect: () => ({ left: 0, top: 0 })
  };
  const zoomContext = vm.createContext({
    state, commandMapList: list, Number, Math,
    normalizeCommandMapZoom: context.normalizeCommandMapZoom,
    commandMapTreePanCoordinate: context.commandMapTreePanCoordinate,
    applyCommandMapZoom() {}
  });
  vm.runInContext(zoomFunction[0], zoomContext);
  zoomContext.setCommandMapZoom(2, { preservePoint: { x: 200, y: 150 }, suppressFocusCenter: true });
  assert.equal(state.commandMapZoom, 2);
  assert.equal(state.commandMapTreePanOffset.x, -80);
  assert.equal(state.commandMapTreePanOffset.y, -70);
  assert.equal(list.scrollLeft, 0);
  assert.equal(list.scrollTop, 0);
});

test("ordinary connector updates keep the tree layer, while layout changes refresh it", () => {
  const names = ["scheduleCommandConnectorLayoutBurst", "scheduleCommandConnectorLayout"];
  const functions = names.map((name) => {
    const found = source.match(new RegExp(`^function ${name}\\(.*?^}`, "ms"));
    assert.ok(found, `Production function ${name}`);
    return found[0];
  }).join("\n");
  const frames = [];
  let treeRefreshes = 0;
  const context = vm.createContext({
    state: {},
    Math,
    commandMapList: {},
    requestAnimationFrame: (callback) => {
      frames.push(callback);
      return frames.length;
    },
    cancelAnimationFrame: () => {},
    updateCommandConnectorPositions: () => {},
    renderCommandJumpPaths: () => {},
    renderCommandMapTreeReferenceLinks: () => { treeRefreshes += 1; },
    window: { setTimeout: () => {} },
  });
  vm.runInContext(functions, context);

  context.scheduleCommandConnectorLayout();
  frames.shift()();
  assert.equal(treeRefreshes, 0);

  context.scheduleCommandConnectorLayout({ refreshTreeLinks: true });
  frames.shift()();
  assert.equal(treeRefreshes, 1);
});

test("moving between blocks updates only nearby cards on a large map", () => {
  const focusFunction = source.match(/^function applyCommandMapFocus\(.*?^}/ms);
  assert.ok(focusFunction);
  let classUpdates = 0;
  const segments = Array.from({ length: 200 }, (_, index) => ({
    dataset: { order: String(index + 1) },
    classList: { toggle: () => { classUpdates += 1; } }
  }));
  const row = { classList: { toggle() {} } };
  const state = {
    commandMapFocusOrder: 1,
    commandMapOrderCache: segments.map((_, index) => index + 1),
    activeTab: "commands"
  };
  const context = vm.createContext({
    state, commandMapList: {
      querySelector: () => row,
      querySelectorAll: (selector) => selector.includes("command-flow-segment") ? segments : []
    },
    getCommandMapEvents: () => { throw new Error("Focus navigation must use the cached order list"); },
    resolveNearestCommandMapFocus: () => { throw new Error("Current focus is already valid"); },
    updateCommandMapNavButtons() {},
    Number, Set, Map
  });
  vm.runInContext(focusFunction[0], context);
  context.applyCommandMapFocus("auto", { skipConnectorLayout: true, suppressScroll: true });
  classUpdates = 0;
  state.commandMapFocusOrder = 2;
  context.applyCommandMapFocus("auto", { skipConnectorLayout: true, suppressScroll: true });
  assert.ok(classUpdates <= 8, `Expected nearby updates, got ${classUpdates}`);
});

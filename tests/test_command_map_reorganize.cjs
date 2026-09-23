const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "../tauri_gerador/web/main.js"), "utf8");
const names = ["commandMapTreeLayoutPageKey", "clearCommandMapTreeManualPositions", "reorganizeCommandMapTree"];
const functions = names.map((name) => {
  const found = source.match(new RegExp(`^function ${name}\\(.*?^}`, "ms"));
  assert.ok(found, `Missing production function ${name}`);
  return found[0];
}).join("\n");

function runner(layouts) {
  const calls = { persist: 0, render: null, pan: 0, message: null };
  const state = {
    commandMapPageSequence: "pagina_2",
    commandMapTreeLayouts: layouts,
    commandMapTreePanOffset: { x: 410, y: -80 },
    commandMapTreePanUserMoved: true,
    commandMapFocusOrder: 9,
  };
  const context = vm.createContext({
    state,
    Object,
    String,
    persistCommandMapTreeLayouts: () => { calls.persist += 1; },
    applyCommandMapTreePanOffset: () => { calls.pan += 1; },
    renderCommandMap: (options) => { calls.render = options; },
    getCommandMapPageDefinition: (sequence) => ({ label: sequence === "pagina_2" ? "Pagina 2" : "Principal" }),
    setMessage: (text, variant) => { calls.message = { text, variant }; },
  });
  vm.runInContext(functions, context);
  return { context, state, calls };
}

test("reorganize removes only the current page manual positions and resets the map view", () => {
  const { context, state, calls } = runner({
    principal: { 1: { x: 200, y: 170 } },
    pagina_2: {
      4: { x: 1900, y: 640 },
      "edge:4:block:5:success:-1": { x: 1210, y: 330 },
    },
  });

  context.reorganizeCommandMapTree();

  assert.deepEqual(JSON.parse(JSON.stringify(state.commandMapTreeLayouts)), {
    principal: { 1: { x: 200, y: 170 } },
  });
  assert.deepEqual(JSON.parse(JSON.stringify(state.commandMapTreePanOffset)), { x: 0, y: 0 });
  assert.equal(state.commandMapTreePanUserMoved, false);
  assert.equal(state.commandMapFocusOrder, null);
  assert.equal(calls.persist, 1);
  assert.equal(calls.pan, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(calls.render)), {
    preserveScroll: false,
    suppressFocusScroll: true,
    quietUpdate: true,
  });
  assert.deepEqual(calls.message, { text: "Pagina 2 reorganizada automaticamente.", variant: "success" });
});

test("reorganize keeps a page without manual positions in automatic layout", () => {
  const { context, calls } = runner({ principal: { 1: { x: 200, y: 170 } } });

  context.reorganizeCommandMapTree();

  assert.equal(calls.persist, 0);
  assert.deepEqual(calls.message, { text: "Pagina 2 ja estava no layout automatico.", variant: "success" });
});

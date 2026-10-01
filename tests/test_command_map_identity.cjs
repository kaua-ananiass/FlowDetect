const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "../tauri_gerador/web/main.js"), "utf8");
const names = ["buildCommandEventFingerprint", "decorateRoadmapForClient"];
const functions = names.map((name) => {
  const match = source.match(new RegExp(`^function ${name}\\(.*?^}`, "ms"));
  assert.ok(match, `Missing production function ${name}`);
  return match[0];
}).join("\n");
let nextKey = 0;
const context = vm.createContext({ nextCommandMapClientKey: () => `new-${++nextKey}` });
vm.runInContext(functions, context);
const event = (id, order, title, clientKey) => ({
  id, order, type: "resultado_relatorio", sequence: "pagina_2",
  title, subtitle: "Concluida", command: "resultado()", delay: 0,
  ...(clientKey ? { clientKey } : {}),
});

test("PDF blocks keep their own draft identity when identical content changes", () => {
  const previous = { events: [event("pdf-a", 7, "Resultado", "card-a"), event("pdf-b", 8, "Resultado", "card-b")] };
  const response = { events: [event("pdf-a", 7, "Validacao 01"), event("pdf-b", 8, "Resultado")] };
  const decorated = context.decorateRoadmapForClient(response, previous);
  assert.deepEqual(Array.from(decorated.events, (item) => item.clientKey), ["card-a", "card-b"]);
});

test("insertion and renumbering do not transfer a later block's identity to the new PDF block", () => {
  const previous = { events: [event("pdf-a", 7, "Resultado", "card-a"), event("pdf-b", 8, "Resultado", "card-b")] };
  const response = { events: [event("pdf-a", 7, "Resultado"), event("new-pdf", 8, "Resultado"), event("pdf-b", 9, "Resultado")] };
  const decorated = context.decorateRoadmapForClient(response, previous);
  assert.equal(decorated.events[0].clientKey, "card-a");
  assert.equal(decorated.events[2].clientKey, "card-b");
  assert.notEqual(decorated.events[1].clientKey, "card-b");
});

test("legacy roadmap preserves keys by position on the first ID migration", () => {
  const previous = { events: [event("old-a", 7, "Resultado", "card-a"), event("old-b", 8, "Resultado", "card-b")] };
  const response = { events: [event("new-a", 7, "Validacao 01"), event("new-b", 8, "Resultado")] };
  const decorated = context.decorateRoadmapForClient(response, previous);
  assert.deepEqual(Array.from(decorated.events, (item) => item.clientKey), ["card-a", "card-b"]);
});

test("a second insertion cannot start while the first save is still pending", async () => {
  const match = source.match(/^async function runMutation\(.*?^}/ms);
  assert.ok(match);
  let release;
  let writes = 0;
  const notices = [];
  const state = { commandMapPageSequence: "principal", commandMapSave: { running: false } };
  const mutationContext = vm.createContext({
    state,
    normalizeSequenceName: (value) => value,
    setMessage: (message) => notices.push(message),
    setBusy: () => {},
    lockCommandMapPageSequence: () => {},
    getCommandMapPageDefinitions: () => [{ sequence: "principal" }],
    syncSequenceContextInput: () => {},
    applyRoadmap: () => {},
    refreshAutomationLibrary: async () => {},
  });
  vm.runInContext(`let commandMapMutationActive = false;\n${match[0]}`, mutationContext);
  const first = mutationContext.runMutation("primeiro", () => {
    writes += 1;
    return new Promise((resolve) => { release = resolve; });
  });
  const second = await mutationContext.runMutation("segundo", () => {
    writes += 1;
    return Promise.resolve({ events: [] });
  });
  assert.equal(second, false);
  assert.equal(writes, 1);
  assert.match(notices.at(-1), /Aguarde a edicao anterior/);
  release({ events: [] });
  assert.equal(await first, true);
});

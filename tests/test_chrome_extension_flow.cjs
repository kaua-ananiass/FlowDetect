const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "../flowdetect_chrome/service_worker.js"), "utf8");
const names = ["normalizedSequence", "buildFlowIndexes", "actionToIndex", "flowContinues"];
const functions = names.map((name) => {
  const found = source.match(new RegExp(`^function ${name}\\(.*?^}`, "ms"));
  assert.ok(found, `Production function ${name}`);
  return found[0];
}).join("\n");

function runner() {
  const context = vm.createContext({ Map, Number, String, Error });
  vm.runInContext(functions, context);
  return context;
}

test("Chrome runner keeps pages separate and resolves a block route on another page", () => {
  const context = runner();
  const indexes = context.buildFlowIndexes([
    { source_order: 1, sequence: "principal" },
    { source_order: 2, sequence: "principal" },
    { source_order: 3, sequence: "pagina_2" },
    { source_order: 4, sequence: "pagina_2" },
  ]);

  assert.equal(indexes.sequenceStart.get("principal"), 0);
  assert.equal(indexes.sequenceStart.get("pagina_2"), 2);
  assert.equal(indexes.nextByIndex.get(0), 1);
  assert.equal(indexes.nextByIndex.get(1), null);
  assert.equal(indexes.nextByIndex.get(2), 3);
  assert.equal(context.actionToIndex({ action: "ir_para_bloco", block: "3" }, indexes, null), 2);
  assert.equal(context.actionToIndex({ action: "ir_para_sequencia", sequence: "pagina_2" }, indexes, null), 2);
  assert.equal(context.flowContinues({ action: "ir_para_bloco" }), true);
  assert.equal(context.flowContinues({ action: "ir_para_sequencia" }), true);
  assert.throws(
    () => context.actionToIndex({ action: "ir_para_bloco", block: "99" }, indexes, null),
    /nao foi exportado/,
  );
});

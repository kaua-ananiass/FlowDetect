const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "../flowdetect_chrome/report-generator.js"), "utf8");
const names = ["reportTone", "statusLabel", "reportRows", "reportCounters"];
const functions = names.map((name) => {
  const found = source.match(new RegExp(`^  function ${name}\\(.*?^  }`, "ms"));
  assert.ok(found, `Missing production function ${name}`);
  return found[0];
}).join("\n");

function runner() {
  const context = vm.createContext({ Array, Object, String, Boolean });
  vm.runInContext(functions, context);
  return context;
}

test("a stopped execution receives a warning row in the generated PDF", () => {
  const context = runner();
  const rows = context.reportRows({
    status: "stopped",
    lastMessage: "Execucao interrompida pelo usuario.",
    report: { summary: {} },
  });

  assert.equal(rows[0].status, "INTERROMPIDA");
  assert.equal(rows[0].tone, "warning");
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.reportCounters(rows))),
    { total: 1, success: 0, info: 0, review: 1, failed: 0 },
  );
});

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "../flowdetect_chrome/sidepanel.js"), "utf8");
const found = source.match(/^(?:async )?function runAutomation\(.*?^}/ms);
assert.ok(found, "Production function runAutomation");

test("the panel keeps the complete stopped run returned by the extension", async () => {
  const stoppedRun = {
    status: "stopped",
    currentStep: 19,
    totalSteps: 51,
    report: { rows: [{ index: 2, status: "Concluida" }] },
    logs: [{ message: "Execucao interrompida pelo usuario." }]
  };
  let shownRun = null;
  const context = vm.createContext({
    selectedPageId: "page-1",
    startingPages: new Set(),
    getExecutionTargetTab: async () => ({ id: 42 }),
    renderExecutionPages: () => {},
    ensureCurrentRuntime: async () => true,
    spreadsheetLoopInfo: () => null,
    companyPreviewRows: new Map(),
    clampSpreadsheetStartRow: (value) => value,
    renderAutomations: () => {},
    updateRun: (run) => { shownRun = run; },
    chrome: {
      tabs: { query: async () => [{ id: 42 }] },
      runtime: { sendMessage: async () => ({ ok: false, run: stoppedRun }) }
    }
  });
  vm.runInContext(found[0], context);

  const result = await context.runAutomation({ automation: { nome: "FGTS" }, steps: [{ type: "ocr_text" }] });

  assert.equal(result, stoppedRun);
  assert.equal(shownRun, stoppedRun);
  assert.equal(shownRun.currentStep, 19);
  assert.equal(shownRun.report.rows[0].status, "Concluida");
});

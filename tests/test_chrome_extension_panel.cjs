const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const root = path.join(__dirname, "../flowdetect_chrome");
const html = fs.readFileSync(path.join(root, "sidepanel.html"), "utf8");
const source = fs.readFileSync(path.join(root, "sidepanel.js"), "utf8");
const css = fs.readFileSync(path.join(root, "sidepanel.css"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

test("a completed branched automation displays full progress", () => {
  const declaration = source.match(/^function runProgress\(.*?^}/ms);
  assert.ok(declaration);
  const context = vm.createContext({ Math, Number });
  vm.runInContext(declaration[0], context);

  const run = { currentStep: 77, totalSteps: 100 };
  assert.equal(context.runProgress({ ...run, status: "running" }).percent, 77);
  assert.equal(context.runProgress({ ...run, status: "stopped" }).percent, 77);
  assert.equal(context.runProgress({ ...run, status: "completed" }).percent, 100);
  assert.equal(context.runProgress({ currentStep: 110, totalSteps: 100, status: "running" }).percent, 99);
  assert.equal(context.runProgress({ currentStep: 73, totalSteps: 100, progressPercent: 99, status: "running" }).percent, 99);
});

test("live execution explains OCR checks and the destination of a failure route", () => {
  const declaration = source.match(/^function liveStepLines\(.*?^}/ms);
  assert.ok(declaration);
  const context = vm.createContext({ Array, String });
  vm.runInContext(declaration[0], context);
  const lines = context.liveStepLines({
    state: "routed",
    ocrChecks: [
      { text: "Competência de Apuração", state: "found" },
      { text: "09/2026", state: "not_found" },
    ],
    route: "Indo para B10",
    message: "OCR 2 nao encontrou o texto: 09/2026.",
  });
  assert.deepEqual(lines.map((line) => line.text), [
    "OCR 1/2 · Encontrado: Competência de Apuração",
    "OCR 2/2 · Não encontrado: 09/2026",
    "Indo para B10",
  ]);
});

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
  assert.match(html, /class="delete-automation"/);
  assert.match(html, /class="loop-start" hidden/);
  assert.match(html, /class="loop-start-choice"/);
  assert.match(html, /class="loop-edit-settings" hidden/);
  assert.match(html, /class="loop-edit-search"/);
  assert.match(html, /class="loop-include-filtered"/);
  assert.match(html, /class="loop-exclude-filtered"/);
  assert.match(html, /class="download-run-with-folder"/);
  assert.match(fs.readFileSync(path.join(root, "download-launch.html"), "utf8"), /id="chooseFolder"/);
  assert.ok(manifest.permissions.includes("downloads"));
  assert.match(source, /download-launch\.html\?id=/);
  assert.match(source, /downloadRouteId\s*\}/);
  assert.match(html, /class="loop-save-exclusions"/);
  assert.match(css, /\.loop-edit-row\.is-excluded/);
  assert.doesNotMatch(html, /class="loop-start-copy"/);
  assert.match(html, /class="execution-column-choice"/);
  assert.match(source, /const ordered = \[\.\.\.automationsCache\]\.sort/);
  assert.match(source, /execution-percent/);
  assert.match(source, /async function deleteAutomation/);
  assert.match(source, /window\.confirm/);
  assert.match(source, /filter\(\(item\) => String\(item\.id\) !== String\(automation\.id\)\)/);
  assert.match(source, /chrome\.storage\.local\.remove\(RUN_STORAGE_KEY\)/);
  assert.match(source, /function spreadsheetLoopColumns/);
  assert.match(source, /function loopDisplayColumn/);
  assert.match(source, /async function saveLoopDisplayColumn/);
  assert.match(source, /loopStartChoice\.replaceChildren/);
  assert.match(source, /option\.textContent = `#\$\{index \+ 1\} · \$\{company\}`/);
  assert.match(source, /startRow: selectedStartRow/);
});

test("the compact progress shows a selectable company without changing the run", () => {
  assert.match(html, /class="execution-overview"/);
  assert.match(html, /class="execution-company-choice" aria-label="Visualizar empresa sem alterar/);
  assert.match(css, /\.execution-overview\s*\{[^}]*grid-template-columns:/);
  assert.match(source, /companyPreviewRows\.set\(String\(automation\.id\), Number\(companyChoice\.value\)\)/);
  assert.match(source, /companyPreviewRows\.delete\(String\(automation\.id\)\)/);
  assert.match(source, /companyPosition\.textContent = hasLiveRow/);
});

test("company choices prefer the company column and fall back to the loop value", () => {
  const declarations = ["normalizedSpreadsheetColumn", "spreadsheetLoopCellValue", "spreadsheetCompanyColumn", "spreadsheetCompanyLabel"]
    .map((name) => {
      const match = source.match(new RegExp(`^function ${name}\\(.*?^}`, "ms"));
      assert.ok(match, name);
      return match[0];
    });
  const context = vm.createContext({});
  vm.runInContext(declarations.join("\n"), context);
  const loop = {
    columns: ["CNPJ", "Empresa"],
    values: ["00.000.101/0000-00", "00.000.102/0000-00"],
    rows: [{ Empresa: "Aurora Papelaria" }, { Empresa: "" }]
  };
  assert.equal(context.spreadsheetCompanyLabel(loop, 0), "Aurora Papelaria");
  assert.equal(context.spreadsheetCompanyLabel(loop, 1), "00.000.102/0000-00");
});

test("spreadsheet and PDF cards show contextual previews without pretending a stopped run is writing", () => {
  const declarations = ["blockActivityPreview", "renderBlockActivityPreview"]
    .map((name) => {
      const match = source.match(new RegExp(`^function ${name}\\(.*?^}`, "ms"));
      assert.ok(match, name);
      return match[0];
    });
  const context = vm.createContext({});
  vm.runInContext(declarations.join("\n"), context);
  const sheet = { type: "data_source", name: "CNPJ", values: ["00.000.101/0000-00", "00.000.102/0000-00"] };
  const running = { status: "running", currentIndex: 1, spreadsheetLoop: { row: 1, sourceIndex: 1 } };
  const sheetPreview = context.blockActivityPreview(sheet, running, true);
  assert.equal(sheetPreview.value, "00.000.102/0000-00");
  assert.equal(sheetPreview.message, "Digitando na página");
  assert.equal(sheetPreview.animating, true);
  assert.equal(context.blockActivityPreview(sheet, { ...running, status: "stopped" }, true).animating, false);
  assert.equal(context.blockActivityPreview(sheet, {}, false).message, "Prévia do primeiro valor");

  const report = { type: "report_result", status: "Não encontrado", tone: "danger", result: "Resultado de {{empresa}}" };
  const reportPreview = context.blockActivityPreview(report, running, true);
  assert.equal(reportPreview.message, "Salvando no relatório");
  assert.equal(reportPreview.tone, "danger");
  assert.equal(context.blockActivityPreview(report, { ...running, status: "stopped" }, true).message, "Resultado de empresa atual");

  const fields = new Map();
  const activity = {
    hidden: true, dataset: {},
    classList: { toggle() {} },
    querySelector(selector) {
      if (!fields.has(selector)) fields.set(selector, { textContent: "" });
      return fields.get(selector);
    }
  };
  context.renderBlockActivityPreview({ querySelector: () => activity }, sheetPreview);
  assert.equal(activity.hidden, false);
  assert.equal(fields.get(".block-carousel-activity-value").textContent, "00.000.102/0000-00");
  assert.match(html, /class="block-carousel-activity" hidden/);
  assert.match(css, /\.block-carousel-preview > \[hidden\]/);
});

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "../flowdetect_chrome/sidepanel.js"), "utf8");
const entries = source.match(/^function editableOcrEntries\(.*?^}/ms);
const override = source.match(/^function automationWithEditableOcr\(.*?^}/ms);
assert.ok(entries && override, "Funcoes de OCR editavel da extensao");
const context = vm.createContext({});
vm.runInContext(`${entries[0]}\n${override[0]}`, context);

test("altera somente o OCR marcado e preserva clique, rotas e automacao importada", () => {
  const automation = { steps: [
    { type: "ocr_text", source_order: 17, text: "Competencia\n09/2026", click_anchor: { from_text_left: 32 },
      ocr_targets: [
        { index: 1, text: "Competencia", editable: false, click: false },
        { index: 2, text: "09/2026", editable: true, click: true, offset_x: 15, on_success: { action: "ir_para_bloco", block: "19" } }
      ] },
    { type: "ocr_text", source_order: 18, text: "Confirmar", click: true, editable_ocr: false }
  ] };
  const entries = context.editableOcrEntries(automation);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].key, "0:1");
  const changed = context.automationWithEditableOcr(automation, new Map([["0:1", "10/2026"]]));
  assert.equal(changed.steps[0].ocr_targets[1].text, "10/2026");
  assert.equal(changed.steps[0].ocr_targets[0].text, "Competencia");
  assert.equal(changed.steps[0].ocr_targets[1].offset_x, 15);
  assert.equal(changed.steps[0].ocr_targets[1].on_success.block, "19");
  assert.equal(changed.steps[0].click_anchor.from_text_left, 32);
  assert.equal(changed.steps[1].text, "Confirmar");
  assert.equal(automation.steps[0].ocr_targets[1].text, "09/2026");
});

test("OCR unico marcado aceita novo texto sem perder o clique e rejeita vazio", () => {
  const automation = { steps: [{ type: "ocr_text", source_order: 17, text: "09/2026", editable_ocr: true,
    click: true, click_anchor: { from_text_top: 8 } }] };
  const changed = context.automationWithEditableOcr(automation, new Map([["0:-1", "10/2026"]]));
  assert.equal(changed.steps[0].text, "10/2026");
  assert.equal(changed.steps[0].click, true);
  assert.equal(changed.steps[0].click_anchor.from_text_top, 8);
  assert.equal(automation.steps[0].text, "09/2026");
  assert.throws(() => context.automationWithEditableOcr(automation, new Map([["0:-1", "   "]])), /bloco 17/);
});

test("Studio salva a marcacao editavel do alvo OCR escolhido", () => {
  const studio = fs.readFileSync(path.join(__dirname, "../tauri_gerador/web/main.js"), "utf8");
  const found = studio.match(/^function ocrTargetLayoutsFromContainer\(.*?^}/ms);
  assert.ok(found);
  const studioContext = vm.createContext({
    parseNumber: (value, fallback) => Number(value) || fallback,
    normalizeOcrTargetAction: (value) => value || "continuar",
    normalizeOcrTargetFailureAction: (value) => value || "continuar",
    normalizeTransitionDelay: (value) => Number(value) || 0
  });
  vm.runInContext(found[0], studioContext);
  const row = (text, editable) => ({ querySelector: (selector) => ({
    "[data-ocr-target-field]": { value: text },
    "[data-ocr-target-editable]": { checked: editable }
  })[selector] || null });
  const layouts = studioContext.ocrTargetLayoutsFromContainer({
    querySelectorAll: () => [row("Competencia", false), row("09/2026", true)]
  });
  assert.equal(layouts[0].editableChrome, false);
  assert.equal(layouts[1].editableChrome, true);
});

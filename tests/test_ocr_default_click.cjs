const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "../tauri_gerador/web/main.js"), "utf8");
const addTarget = source.match(/^function addOcrTargetRow\(.*?^}/ms);
assert.ok(addTarget, "Production function addOcrTargetRow");

test("new OCR + Visual blocks select one click by default", () => {
  assert.match(source, /state\.insertPanel\.ocrTargetLayouts = \[\{ action: "clicar", clicks: 1 \}\]/);
  assert.match(source, /state\.insertPanel\.recognitionMode === "texto_ocr" && !state\.insertPanel\.ocrTargetLayouts\?\.length/);
});

test("new OCR + Visual targets click once without changing other target defaults", () => {
  for (const [mode, expected] of [["texto_ocr", "clicar"], ["imagem", "continuar"]]) {
    let appended;
    const list = { querySelectorAll: () => [{}], appendChild: (row) => { appended = row; } };
    const container = {
      querySelector: (selector) => selector === "[data-ocr-target-list]" ? list : { value: mode }
    };
    const context = vm.createContext({
      document: { createElement: () => ({ dataset: {}, querySelector: () => ({ focus() {} }) }) },
      OCR_TARGET_COLORS: ["azul", "roxo"],
      escapeHtml: (value) => String(value),
      refreshOcrTargetRows() {},
      updateRelativeOcrPreviewOverlay() {},
      refreshOcrTargetActionRows() {}
    });
    vm.runInContext(addTarget[0], context);
    context.addOcrTargetRow(container, "data-insert-field", "data-insert-action");
    assert.match(appended.innerHTML, new RegExp(`data-ocr-target-action type="hidden" value="${expected}"`));
    assert.match(appended.innerHTML, /data-ocr-target-clicks type="hidden" value="1"/);
  }
});

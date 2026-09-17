const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "../tauri_gerador/web/main.js"), "utf8");
const names = [
  "runImageRecognitionTest", "hybridOcrTextForRecognition", "parseNumber",
  "parseOcrValidationResult", "recognitionValidationMessage", "renderRecognitionValidationDetails",
  "renderRecognitionOcrRuleTestResult",
  "recognitionOcrTargetRuleSummary", "splitOcrTargetText", "normalizeOcrTargetAction", "normalizeOcrTargetFailureAction",
  "recognitionTestStatusForEvent", "renderRecognitionValidationPanel", "setRecognitionTestStatusForOrder",
  "findRecognitionRoadmapEventByOrder", "isRecognitionTestedForEvent", "updateRecognitionStatusUIForOrder",
];
const functions = names.map((name) => {
  const found = source.match(new RegExp(`^(?:async )?function ${name}\\(.*?^}`, "ms"));
  assert.ok(found, `Production function ${name}`);
  return found[0];
}).join("\n");
const constants = ["escapeHtml", "OCR_TARGET_COLORS"].map((name) => {
  const found = source.match(new RegExp(`^const ${name} =.*?;\\s*$`, "ms"));
  assert.ok(found, `Production constant ${name}`);
  return found[0];
}).join("\n");

function fixture() {
  const panel = { innerHTML: "", hidden: true };
  const card = {
    querySelector: (selector) => selector.includes("data-recognition-validation") ? panel : null,
    querySelectorAll: () => [],
  };
  const messages = [];
  const event = { order: 12, type: "clicar_imagem", clientKey: "ocr-card", details: { imagem: "imagens/menu" } };
  const context = vm.createContext({
    state: { roadmap: { events: [event] }, recognitionTestStatus: {} },
    document: { querySelectorAll: () => [card] },
    normalizeRecognitionImagePath: (value) => String(value || "").trim(),
    normalizeRecognitionProfile: () => "balanced",
    relativeOcrInvokeArgs: () => ({}),
    scheduleCommandConnectorLayout: () => {},
    setBusy: () => {},
    setMessage: (message, kind) => messages.push({ message, kind }),
  });
  vm.runInContext(`${constants}\n${functions}`, context);
  return { context, panel, messages, event };
}

function report(failedIndex = -1, visualConfirmed = true) {
  return {
    targets: Array.from({ length: 5 }, (_, index) => ({
      index, text: `Texto ${index + 1}`, status: index === failedIndex ? "not_found" : "confirmed",
    })),
    visual_confirmed: visualConfirmed,
    success: failedIndex < 0 && visualConfirmed,
  };
}

test("Procurar keeps all five ordered OCR diagnostics when the command throws", async () => {
  const { context, panel, messages } = fixture();
  const payload = report(2, false);
  // Reports may arrive out of order; the display follows the configured OCR index.
  payload.targets.reverse();
  context.invoke = async () => {
    assert.equal(panel.hidden, false);
    assert.match(panel.innerHTML, /Testando OCRs/);
    throw `Reconhecimento nao encontrado\nOCR_VALIDATION_JSON|${JSON.stringify(payload)}`;
  };
  const success = await context.runImageRecognitionTest({
    imagePath: "imagens/menu", recognitionMode: "texto_ocr", ocrText: "Menu",
  }, { recognitionOrder: 12 });
  assert.equal(success, false);
  assert.equal(panel.hidden, false);
  assert.equal((panel.innerHTML.match(/<b>OCR /g) || []).length, 5);
  assert.match(panel.innerHTML, /OCR 3<\/b><span>Falha: texto nao encontrado/);
  assert.match(panel.innerHTML, /data-ocr-target-color="verde"/);
  assert.match(panel.innerHTML, /data-ocr-target-color="laranja"/);
  assert.ok(panel.innerHTML.indexOf("OCR 1") < panel.innerHTML.indexOf("OCR 5"));
  assert.match(messages.at(-1).message, /Falha em OCR 3/);
  assert.doesNotMatch(messages.at(-1).message, /OCR_VALIDATION_JSON/);
  assert.equal(messages.at(-1).kind, "error");
});

test("a new successful test replaces stale failures and survives card rendering", async () => {
  const { context, panel, event } = fixture();
  context.invoke = async () => `OCR_VALIDATION_JSON|${JSON.stringify(report())}\nReconhecimento confirmado`;
  const success = await context.runImageRecognitionTest({ imagePath: "imagens/menu", ocrText: "Menu" }, { recognitionOrder: 12 });
  assert.equal(success, true);
  assert.equal((panel.innerHTML.match(/<span>Confirmado<\/span>/g) || []).length, 5);
  assert.match(panel.innerHTML, /Imagem: confirmada/);
  assert.doesNotMatch(panel.innerHTML, /Falha:/);
  assert.match(context.renderRecognitionValidationPanel(event), /OCR 5/);
  event.details.imagem = "imagens/outro-menu";
  assert.match(context.renderRecognitionValidationPanel(event), /hidden/);
});

test("malformed diagnostics preserve the ordinary error and never render raw HTML", () => {
  const { context } = fixture();
  const result = context.parseOcrValidationResult("Erro de captura\nOCR_VALIDATION_JSON|{incompleto");
  assert.equal(result.report, null);
  assert.equal(result.message, "Erro de captura");
  const payload = report(0);
  payload.targets[0].text = '<img src=x onerror="alert(1)">';
  const parsed = context.parseOcrValidationResult(`OCR_VALIDATION_JSON|${JSON.stringify(payload)}`);
  const html = context.renderRecognitionValidationDetails({ validation: parsed.report });
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
});

test("each OCR rule shows only its own test result", () => {
  const { context } = fixture();
  const validation = context.parseOcrValidationResult(`OCR_VALIDATION_JSON|${JSON.stringify(report(2))}`).report;
  const ocr1 = context.renderRecognitionOcrRuleTestResult({ validation }, 0);
  const ocr3 = context.renderRecognitionOcrRuleTestResult({ validation }, 2);
  const ocr5 = context.renderRecognitionOcrRuleTestResult({ validation }, 4);

  assert.match(ocr1, /Teste/);
  assert.match(ocr1, /Confirmado/);
  assert.match(ocr3, /Texto nao encontrado/);
  assert.match(ocr3, /is-failed/);
  assert.match(ocr5, /Confirmado/);
  assert.doesNotMatch(ocr1, /Texto 3/);
});

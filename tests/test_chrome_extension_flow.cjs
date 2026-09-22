const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "../flowdetect_chrome/service_worker.js"), "utf8");
const names = ["loopPairs", "normalizedSequence", "buildFlowIndexes", "actionToIndex", "flowContinues", "flowLabel", "normalizedOcrTargetAction", "executeOcrTargets", "findSpreadsheetLoopSource", "spreadsheetStartRow", "executeSpreadsheetLoop", "mustAdvanceSpreadsheetRow", "executeRange", "templateSamples", "scoreAt", "findTemplateInImage"];
const functions = names.map((name) => {
  const found = source.match(new RegExp("^(?:async )?function " + name + "\\(.*?^}", "ms"));
  assert.ok(found, `Production function ${name}`);
  return found[0];
}).join("\n");

function runner(extra = {}) {
  const context = vm.createContext({ Map, Number, String, Error, ...extra });
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



test("Chrome runner repeats the complete flow once for each spreadsheet value", async () => {
  const logs = [];
  const context = runner({
    addLog: async (_run, message) => logs.push(message),
    sleep: async () => {},
  });
  const source = context.findSpreadsheetLoopSource([
    { source_order: 1, sequence: "principal", type: "ocr_text" },
    { source_order: 2, sequence: "pagina_2", type: "data_source", name: "CNPJ", values: ["01", "02"], interval_ms: 500 },
    { source_order: 3, sequence: "pagina_2", type: "ocr_text" },
  ]);

  assert.equal(source.index, 1);
  assert.equal(source.name, "CNPJ");
  assert.deepEqual([...source.values], ["01", "02"]);
  assert.equal(source.interval, 500);

  const run = { variables: {}, stepsPerIteration: 3 };
  const valuesExecuted = [];
  await context.executeSpreadsheetLoop(run, source, async () => {
    valuesExecuted.push(run.variables.CNPJ);
  });

  assert.deepEqual(valuesExecuted, ["01", "02"]);
  assert.equal(run.totalSteps, 6);
  assert.equal(run.spreadsheetLoop, undefined);
  assert.match(logs[0], /1\/2/);
  assert.equal(context.findSpreadsheetLoopSource([
    { type: "data_source", name: "CNPJ", values: ["01"] },
    { type: "loop_start" },
    { type: "loop_end" },
  ]), null);
});

test("Chrome runner starts the spreadsheet loop from the requested line", async () => {
  const logs = [];
  const context = runner({ addLog: async (_run, message) => logs.push(message), sleep: async () => {} });
  const run = { variables: {}, stepsPerIteration: 3, requestedStartRow: 3 };
  const executed = [];
  const source = { name: "CNPJ", values: ["01", "02", "03", "04"], interval: 0 };

  await context.executeSpreadsheetLoop(run, source, async () => executed.push(run.variables.CNPJ));

  assert.deepEqual(executed, ["03", "04"]);
  assert.equal(run.totalSteps, 6);
  assert.equal(run.spreadsheetStartRow, 3);
  assert.match(logs[0], /linha 3 de 4/);
  assert.equal(context.spreadsheetStartRow(99, 4), 4);
  assert.equal(context.spreadsheetStartRow(0, 4), 1);
});

test("Chrome runner applies the selected row to loops with start and end markers", async () => {
  const executed = [];
  const context = runner({
    addLog: async () => {},
    persistRun: async () => {},
    executeStep: async (run, step) => {
      if (step.type === "ocr_text") executed.push(run.variables.CNPJ);
      return "Etapa concluida.";
    },
    sleep: async () => {},
  });
  const steps = [
    { source_order: 1, sequence: "principal", type: "data_source" },
    { source_order: 2, sequence: "principal", type: "loop_start" },
    { source_order: 3, sequence: "principal", type: "ocr_text", on_success: { action: "continuar" } },
    { source_order: 4, sequence: "principal", type: "loop_end" },
  ];
  const run = {
    variables: {},
    requestedStartRow: 3,
    currentStep: 0,
    dataSource: { name: "CNPJ", index: 0, values: ["01", "02", "03", "04"], interval: 0 },
  };

  await context.executeRange(run, steps, 1, steps.length, context.loopPairs(steps), context.buildFlowIndexes(steps));

  assert.deepEqual(executed, ["03", "04"]);
  assert.equal(run.spreadsheetStartRow, 3);
});

test("Chrome runner follows the failure route of each OCR target", async () => {
  const logs = [];
  const queried = [];
  const context = runner({
    addLog: async (_run, message, level) => logs.push({ message, level }),
    executePageStep: async (_run, step) => {
      queried.push(step.text);
      if (step.text === "Competencia") throw new Error("Nao encontrado");
      return `OCR encontrou ${step.text}.`;
    },
  });

  const result = await context.executeOcrTargets({}, {
    on_success: { action: "continuar" },
    on_failure: { action: "parar" },
    ocr_targets: [
      {
        text: "Competencia",
        action: "continuar",
        on_success: { action: "continuar" },
        on_failure: { action: "continuar" },
      },
      {
        text: "09/2026",
        action: "confirmar_ir_para_bloco",
        on_success: { action: "ir_para_bloco", block: "15" },
        on_failure: { action: "ir_para_bloco", block: "12" },
      },
    ],
  });

  assert.deepEqual(queried, ["Competencia", "09/2026"]);
  assert.equal(result.flow.action, "ir_para_bloco");
  assert.equal(result.flow.block, "15");
  assert.match(logs[0].message, /Procurando OCR 2/);
});

test("Chrome runner routes the final failed OCR instead of using the card failure", async () => {
  const logs = [];
  const context = runner({
    addLog: async (_run, message, level) => logs.push({ message, level }),
    executePageStep: async (_run, step) => {
      if (step.text === "OCR 1") return "OCR 1 confirmado.";
      throw new Error("Nao encontrado");
    },
  });

  const result = await context.executeOcrTargets({}, {
    on_success: { action: "continuar" },
    on_failure: { action: "parar" },
    ocr_targets: [
      {
        text: "OCR 1",
        action: "continuar",
        on_success: { action: "continuar" },
        on_failure: { action: "continuar" },
      },
      {
        text: "OCR 2",
        action: "confirmar_ir_para_bloco",
        on_success: { action: "ir_para_bloco", block: "15" },
        on_failure: { action: "ir_para_bloco", block: "12" },
      },
    ],
  });

  assert.equal(result.flow.action, "ir_para_bloco");
  assert.equal(result.flow.block, "12");
  assert.match(logs.at(-1).message, /bloco 12/i);
});

test("Chrome runner advances the spreadsheet row when a flow returns to its first block", async () => {
  const insertedValues = [];
  const logs = [];
  const context = runner({
    addLog: async (_run, message) => logs.push(message),
    persistRun: async () => {},
    executeStep: async (run, step) => {
      if (step.type === "data_source") insertedValues.push(run.variables.CNPJ);
      return "Etapa concluida.";
    },
  });
  const steps = [
    { source_order: 1, sequence: "principal", type: "data_source", name: "CNPJ", values: ["01", "02"], on_success: { action: "continuar" } },
    { source_order: 2, sequence: "principal", type: "ocr_text", on_success: { action: "ir_para_bloco", block: "1" } },
  ];
  const indexes = context.buildFlowIndexes(steps);
  const source = { ...context.findSpreadsheetLoopSource(steps), iterationStart: 0 };
  const run = { variables: {}, currentStep: 0, stepsPerIteration: 2 };

  await context.executeSpreadsheetLoop(run, source, () => (
    context.executeRange(run, steps, 0, steps.length, new Map(), indexes)
  ));

  assert.deepEqual(insertedValues, ["01", "02"]);
  assert.equal(logs.filter((message) => message.includes("concluida; avancando")).length, 2);
  assert.equal(run.spreadsheetLoop, undefined);
});


const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "../flowdetect_chrome/manifest.json"), "utf8"));

test("Chrome sends key blocks to the page without attaching the debugger", () => {
  assert.doesNotMatch(source, /chrome\.debugger/);
  assert.match(source, /if \(step\.type === "key_sequence"\) return executePageStep\(run, step\);/);
  assert.equal(manifest.permissions.includes("debugger"), false);
});

test("visual recognition locates an image even when it has no text", () => {
  const context = runner();
  const blank = (width, height) => new Uint8ClampedArray(width * height * 4).fill(255);
  const setPixel = (image, width, x, y, rgb) => {
    const index = (y * width + x) * 4;
    image[index] = rgb[0]; image[index + 1] = rgb[1]; image[index + 2] = rgb[2]; image[index + 3] = 255;
  };
  const templatePixels = blank(3, 3);
  const sourcePixels = blank(12, 12);
  const colors = [[30, 210, 100], [30, 120, 240], [240, 170, 30], [190, 60, 200], [40, 40, 40], [230, 70, 80], [100, 210, 230], [80, 130, 60], [220, 220, 40]];
  colors.forEach((color, index) => {
    const x = index % 3; const y = Math.floor(index / 3);
    setPixel(templatePixels, 3, x, y, color);
    setPixel(sourcePixels, 12, x + 4, y + 4, color);
  });

  const match = context.findTemplateInImage(
    { image: { data: sourcePixels, width: 12, height: 12 }, width: 12, height: 12, scale: 1 },
    { image: { data: templatePixels, width: 3, height: 3 }, width: 3, height: 3, scale: 1 },
  );

  assert.equal(match.x, 4);
  assert.equal(match.y, 4);
  assert.ok(match.score > .99);
});

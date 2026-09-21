const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "../flowdetect_chrome/service_worker.js"), "utf8");
const names = ["normalizedSequence", "buildFlowIndexes", "actionToIndex", "flowContinues", "findSpreadsheetLoopSource", "executeSpreadsheetLoop", "templateSamples", "scoreAt", "findTemplateInImage"];
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

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "../flowdetect_chrome/report-generator.js"), "utf8");
const names = ["reportTone", "statusLabel", "reportRows", "reportCounters", "approximateWidth", "truncate", "wrap", "latin1Bytes", "joinBytes", "buildPdf"];
const functions = names.map((name) => {
  const found = source.match(new RegExp(`^  function ${name}\\(.*?^  }`, "ms"));
  assert.ok(found, `Missing production function ${name}`);
  return found[0];
}).join("\n");

function runner() {
  const context = vm.createContext({ Array, Object, String, Boolean, Number, Uint8Array, PAGE_WIDTH: 595.28, PAGE_HEIGHT: 841.89 });
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

test("the generated PDF declares WinAnsi so Portuguese accents render in Helvetica", () => {
  const context = runner();
  const noDebts = "N" + String.fromCharCode(195) + "O H" + String.fromCharCode(193) + " D" + String.fromCharCode(201) + "BITOS";
  const bytes = context.buildPdf([{ commands: [`BT /F1 10 Tf (${noDebts}) Tj ET`] }]);
  const raw = Buffer.from(bytes).toString("latin1");

  assert.match(raw, /\/Encoding \/WinAnsiEncoding/);
  assert.ok(raw.includes(noDebts));
});

test("report rows wrap long values inside their column width", () => {
  const context = runner();
  const companyLines = context.wrap("BUG CONTROLE DE PRAGAS E VETORES", 153, 8.2, true, 2);
  const statusLines = context.wrap("NAO ENCONTRADO - 09/2026", 92, 6.7, true, 2);

  assert.equal(companyLines.length, 2);
  assert.ok(companyLines.every((line) => context.approximateWidth(line, 8.2, true) <= 153));
  assert.ok(statusLines.every((line) => context.approximateWidth(line, 6.7, true) <= 92));
});

test("the Chrome PDF keeps only the table header on following pages", () => {
  const context = vm.createContext({ Uint8Array });
  vm.runInContext(source, context);
  const rows = Array.from({ length: 37 }, (_unused, index) => ({
    index: index + 1,
    value: `EMPRESA TESTE ${index + 1}`,
    result: "Guia emitida.",
    status: "Concluida",
    tone: "success",
    success: true,
  }));
  const bytes = context.FlowDetectExecutionReport.buildExecutionReportPdf({
    automationName: "FGTS_GUIAS",
    status: "completed",
    report: { sourceName: "EMPRESAS", rows },
  });
  const pdf = Buffer.from(bytes).toString("latin1");

  assert.match(pdf, /\/Count [2-9]/);
  assert.match(pdf, /EMPRESA TESTE 37/);
  assert.ok((pdf.match(/\(LINHA\) Tj/g) || []).length > 1);
  assert.doesNotMatch(pdf, /RESUMO DA EXECUCAO|RESULTADOS POR LINHA|Resultados da execucao|Pagina [2-9]/);
});

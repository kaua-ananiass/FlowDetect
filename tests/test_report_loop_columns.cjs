const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "../tauri_gerador/web/main.js"), "utf8");
const match = source.match(/^function reportColumnChoices\(.*?^}/ms);
assert.ok(match, "Missing production function reportColumnChoices");

function reportChoices(events, currentOrder) {
  const context = vm.createContext({
    state: { roadmap: { events }, composerWorkbookId: "" },
    Array,
    Number,
    String,
    Set,
    resolveWorkbookId: (value) => value,
    workbookSheetsFor: () => [{ name: "Empresas" }],
    columnsForSheetInWorkbook: () => ["CNPJ", "Empresa", "Nome Arquivo"],
    escapeHtml: (value) => String(value),
  });
  vm.runInContext(match[0], context);
  return context.reportColumnChoices({}, currentOrder);
}

test("report fields use the spreadsheet loop details from the same flow", () => {
  const choices = reportChoices([
    {
      type: "sequencia_planilha",
      order: 4,
      details: { arquivo: "empresas.xlsx", aba: "Empresas", coluna: "CNPJ" },
    },
    {
      type: "sequencia_planilha",
      order: 18,
      details: { arquivo: "outro.xlsx", aba: "Dados", coluna: "Codigo" },
    },
  ], 9);

  assert.equal(choices.sourceName, "CNPJ");
  assert.match(choices.loopLabel, /Loop da planilha: CNPJ \(Empresas\)/);
  assert.match(choices.companyOptions(""), /Coluna do loop da planilha: CNPJ/);
  assert.match(choices.companyOptions(""), /Coluna da planilha: Empresa/);
});

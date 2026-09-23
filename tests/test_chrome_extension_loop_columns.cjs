const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "../flowdetect_chrome/sidepanel.js"), "utf8");
const helpersStart = source.indexOf("function normalizedSpreadsheetColumn");
const helpersEnd = source.indexOf("async function saveLoopDisplayColumn");

if (helpersStart < 0 || helpersEnd < helpersStart) {
  throw new Error("Funcoes de coluna do loop nao foram encontradas no painel.");
}

const context = vm.createContext({});
vm.runInContext(source.slice(helpersStart, helpersEnd), context);

test("lista as colunas da planilha e prioriza Empresa no painel da execucao", () => {
  const automation = {
    steps: [{
      type: "data_source",
      name: "CNPJ",
      values: ["51708970000187", "03943209000187"],
      rows: [
        { CNPJ: "51708970000187", Empresa: "Abraco Comercio", Cidade: "Goiania" },
        { cnpj: "03943209000187", EMPRESA: "Nova Era", Cidade: "Anapolis" }
      ]
    }]
  };

  const loop = context.spreadsheetLoopInfo(automation);
  assert.deepEqual(Array.from(loop.columns), ["CNPJ", "Empresa", "Cidade"]);
  assert.equal(context.loopDisplayColumn(automation, loop), "Empresa");
});

test("mostra o valor da coluna escolhida para a linha atual do loop", () => {
  const automation = {
    ui: { loopDisplayColumn: "Cidade" },
    steps: [{
      type: "data_source",
      name: "CNPJ",
      values: ["51708970000187", "03943209000187"],
      rows: [
        { CNPJ: "51708970000187", Empresa: "Abraco Comercio", Cidade: "Goiania" },
        { CNPJ: "03943209000187", Empresa: "Nova Era", Cidade: "Anapolis" }
      ]
    }]
  };

  const loop = context.spreadsheetLoopInfo(automation);
  const selectedColumn = context.loopDisplayColumn(automation, loop);
  const value = context.currentLoopDisplayValue({
    spreadsheetLoop: { row: 1, rowData: loop.rows[1] }
  }, loop, selectedColumn);

  assert.equal(selectedColumn, "Cidade");
  assert.equal(value, "Anapolis");
});

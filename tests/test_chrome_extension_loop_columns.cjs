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

test("retira CNPJs escolhidos sem desalinha-los das demais colunas nem mudar o mapa", () => {
  const automation = { steps: [{ type: "data_source", name: "CNPJ",
    values: ["11.111.111/0001-11", "22.222.222/0001-22", "33.333.333/0001-33"],
    rows: [
      { CNPJ: "11.111.111/0001-11", Empresa: "Primeira" },
      { CNPJ: "22.222.222/0001-22", Empresa: "Ignorar" },
      { CNPJ: "33.333.333/0001-33", Empresa: "Terceira" }
    ] }] };
  const loop = context.spreadsheetLoopInfo(automation);
  const excluded = new Set([context.loopRowKey(loop, 1)]);
  const selection = context.selectedLoopRows(loop, excluded);
  assert.deepEqual(Array.from(selection.includedIndices), [0, 2]);
  assert.equal(selection.excludedRows[0].company, "Ignorar");
  const configured = context.automationWithSelectedLoopRows(automation, selection.includedIndices);
  assert.deepEqual(Array.from(configured.steps[0].values), ["11.111.111/0001-11", "33.333.333/0001-33"]);
  assert.deepEqual(Array.from(configured.steps[0].rows.map((row) => row.Empresa)), ["Primeira", "Terceira"]);
  assert.equal(automation.steps[0].values.length, 3);
  const live = context.loopInfoForRun(automation, { loopIncludedIndices: selection.includedIndices });
  assert.equal(context.spreadsheetCompanyLabel(live, 1), "Terceira");
  assert.throws(() => context.automationWithSelectedLoopRows(automation, []), /ao menos uma empresa/);
});

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "../tauri_gerador/web/main.js"), "utf8");
const names = [
  "commandEventClientKey",
  "applySuccessFlowDraft",
  "applyCommandMapDraftToEvent",
  "getCommandMapSuccessRoute",
];
const functions = names.map((name) => {
  const match = source.match(new RegExp(`^function ${name}\\(.*?^}`, "ms"));
  assert.ok(match, `Missing production function ${name}`);
  return match[0];
}).join("\n");
const plain = (value) => JSON.parse(JSON.stringify(value));

function runner(values) {
  const state = {
    roadmap: { events: [] },
    commandMapDrafts: {
      report: { values },
    },
  };
  const context = vm.createContext({
    state,
    Number,
    String,
    Math,
    parseNumber: (value, fallback = 0) => {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    },
    optionalPositiveInt: (value) => {
      const number = Math.trunc(Number(value));
      return Number.isFinite(number) && number > 0 ? number : null;
    },
    optionalSequenceValue: (value) => String(value || "").trim() || null,
    transitionSequenceDelayArg: (action, delay) => (
      String(action || "").trim() === "ir_para_sequencia" ? Math.max(0, Number(delay) || 0) : 0
    ),
  });
  vm.runInContext(functions, context);
  return context;
}

test("report-result draft immediately exposes its selected block route in the map", () => {
  const context = runner({
    reportStatus: "Sem debitos",
    reportTone: "info",
    reportResult: "Nenhum debito encontrado.",
    reportConfirmation: "Alerta confirmado.",
    reportColumn: "Empresa",
    reportResultColumn: "Cidade",
    reportConfirmationColumn: "Empresa",
    successAction: "ir_para_bloco",
    successBlock: "18",
    successSequence: "",
    successSequenceDelay: 0,
  });
  const updated = context.applyCommandMapDraftToEvent({
    clientKey: "report",
    type: "resultado_relatorio",
    details: {},
  });

  assert.equal(updated.details.status, "Sem debitos");
  assert.equal(updated.details.tom, "info");
  assert.equal(updated.details.coluna_relatorio, "Empresa");
  assert.equal(updated.details.coluna_resultado, "Cidade");
  assert.equal(updated.details.coluna_confirmacao, "Empresa");
  assert.equal(updated.details.ao_sucesso, "ir_para_bloco");
  assert.equal(updated.details.bloco_sucesso, 18);
  assert.deepEqual(
    plain(context.getCommandMapSuccessRoute(updated)),
    { action: "ir_para_bloco", sequence: "", block: 18, delay: 0 },
  );
});

test("report-result draft keeps the selected page and its wait time", () => {
  const context = runner({
    reportStatus: "Concluida",
    reportTone: "success",
    reportResult: "Guia emitida.",
    reportConfirmation: "",
    successAction: "ir_para_sequencia",
    successBlock: "",
    successSequence: "pagina_2",
    successSequenceDelay: "0.8",
  });
  const updated = context.applyCommandMapDraftToEvent({
    clientKey: "report",
    type: "resultado_relatorio",
    details: {},
  });

  assert.deepEqual(
    plain(context.getCommandMapSuccessRoute(updated)),
    { action: "ir_para_sequencia", sequence: "pagina_2", block: null, delay: 0.8 },
  );
});

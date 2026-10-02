import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateRoadmap } from "../web/map-validator.js";

const block = (order, details = {}, sequence = "principal", type = "clicar_imagem") => ({
  id: `id-${order}`,
  order, sequence, type,
  details: { imagem: "imagens/alvo", ...details },
});

test("mapa linear válido passa sem avisos", () => {
  const result = validateRoadmap({ events: [block(1), block(2)] });
  assert.equal(result.errors.length, 0);
  assert.equal(result.warnings.length, 0);
});

test("destino inexistente e ordem duplicada impedem execução", () => {
  const result = validateRoadmap({ events: [
    block(1, { ao_sucesso: "ir_para_bloco", bloco_sucesso: 99 }),
    block(1),
  ] });
  assert(result.errors.some((issue) => issue.code === "broken-block-route"));
  assert(result.errors.some((issue) => issue.code === "duplicate-order"));
});

test("salto incondicional destaca bloco sem caminho", () => {
  const result = validateRoadmap({ events: [
    block(1, { ao_sucesso: "ir_para_bloco", bloco_sucesso: 3 }),
    block(2),
    block(3),
  ] });
  assert(result.warnings.some((issue) => issue.code === "unreachable" && issue.order === 2));
});

test("ramo de falha alcança página de destino", () => {
  const result = validateRoadmap({ events: [
    block(1, { ao_nao_encontrar: "ir_para_sequencia", sequencia_nao_encontrar: "pagina_2" }),
    block(2, {}, "pagina_2"),
  ] });
  assert.equal(result.errors.length, 0);
  assert.equal(result.warnings.length, 0);
});

test("rotas individuais de OCR alcançam blocos de outras páginas", () => {
  const result = validateRoadmap({ events: [
    block(1, {
      modo_reconhecimento: "texto_ocr",
      ocr_target_layouts: [{
        action: "confirmar_ir_para_bloco", block: "3",
        failureAction: "ir_para_bloco", failureBlock: "2",
      }],
    }),
    block(2, {}, "pagina_2"),
    block(3, {}, "pagina_3"),
  ] });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
});

test("loop sem fim é bloqueado", () => {
  const result = validateRoadmap({ events: [
    block(1, {}, "principal", "inicio_loop"),
    block(2, { arquivo: "dados.xlsx", coluna: "CNPJ" }, "principal", "sequencia_planilha"),
  ] });
  assert(result.errors.some((issue) => issue.code === "invalid-loop-markers"));
});

test("mapa existente não recebe erro bloqueante", () => {
  const raw = JSON.parse(readFileSync(new URL("../../mapeamento_teclado.json", import.meta.url), "utf8"));
  const result = validateRoadmap({
    events: raw.eventos.map((event) => ({
      id: event.id, order: event.ordem, sequence: event.sequencia,
      type: event.tipo, details: event.detalhes,
    })),
    initial_sequence: raw.sequencia_inicial,
    sequence_settings: raw.configuracoes_sequencia,
  });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
});

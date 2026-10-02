// Pure map checks: no UI or filesystem access, so the same rules can run on save and launch.
export function validateRoadmap(roadmap) {
  const events = Array.isArray(roadmap?.events) ? roadmap.events : [];
  const issues = [];
  const byOrder = new Map();
  const bySequence = new Map();
  const ids = new Map();
  const normalizedSequence = (value) => {
    const text = String(value || "principal").trim();
    const match = /^pagina[ _]?([1-4])$/i.exec(text) || /^p([1-4])$/i.exec(text);
    if (/^principal$/i.test(text) || match?.[1] === "1") return "principal";
    return match ? `pagina_${match[1]}` : text;
  };
  const eventSequence = (event) => normalizedSequence(event.sequence ?? event.sequencia);
  const detailsOf = (event) => event.details ?? event.detalhes ?? {};
  const orderOf = (event) => Number(event.order ?? event.ordem);
  const typeOf = (event) => String(event.type ?? event.tipo ?? "");
  const add = (severity, code, message, event = null) => issues.push({
    severity, code, message,
    order: event ? orderOf(event) : null,
    sequence: event ? eventSequence(event) : null,
  });

  if (!events.length) add("error", "empty", "O mapa não possui blocos.");
  for (const event of events) {
    const order = orderOf(event);
    const sequence = eventSequence(event);
    if (!Number.isInteger(order) || order < 1) {
      add("error", "invalid-order", "Bloco com número de ordem inválido.", event);
    } else if (byOrder.has(order)) {
      add("error", "duplicate-order", `A ordem ${order} está duplicada; blocos podem se sobrepor.`, event);
    } else {
      byOrder.set(order, event);
    }
    const id = String(event.id || "").trim();
    if (id && ids.has(id)) add("error", "duplicate-id", `O identificador do bloco ${order} está duplicado.`, event);
    if (id) ids.set(id, event);
    if (!bySequence.has(sequence)) bySequence.set(sequence, []);
    bySequence.get(sequence).push(event);
  }
  for (const pageEvents of bySequence.values()) pageEvents.sort((a, b) => orderOf(a) - orderOf(b));

  const edgeMap = new Map([...byOrder.keys()].map((order) => [order, new Set()]));
  const link = (from, to) => {
    if (from && to && edgeMap.has(orderOf(from))) edgeMap.get(orderOf(from)).add(orderOf(to));
  };
  const route = (event, actionValue, blockValue, sequenceValue, label, fallbackNext) => {
    const action = String(actionValue || "continuar").toLowerCase();
    if (action === "ir_para_bloco") {
      const target = byOrder.get(Number(blockValue));
      if (target) link(event, target);
      else add("error", "broken-block-route", `${label}: bloco de destino ${blockValue || "não definido"} não existe.`, event);
    } else if (action === "ir_para_sequencia") {
      const targetSequence = normalizedSequence(sequenceValue || "");
      const target = sequenceValue ? bySequence.get(targetSequence)?.[0] : null;
      if (target) link(event, target);
      else add("error", "broken-page-route", `${label}: página de destino ${sequenceValue || "não definida"} está vazia ou não existe.`, event);
    } else if (["continuar", "pular", "tentar_novamente"].includes(action)) {
      if (action === "tentar_novamente") link(event, event);
      else if (fallbackNext) link(event, fallbackNext);
    }
  };

  for (const [sequence, pageEvents] of bySequence) {
    const starts = pageEvents.filter((event) => typeOf(event) === "inicio_loop");
    const ends = pageEvents.filter((event) => typeOf(event) === "fim_loop");
    if (starts.length !== ends.length || starts.length > 1 ||
        (starts.length && orderOf(starts[0]) >= orderOf(ends[0]))) {
      add("error", "invalid-loop-markers", "Início e fim do loop devem aparecer uma vez, nessa ordem e na mesma página.", starts[0] || ends[0]);
    }
    if (starts.length === 1 && ends.length === 1 && orderOf(starts[0]) < orderOf(ends[0]) &&
        !pageEvents.some((event) => orderOf(event) > orderOf(starts[0]) &&
          orderOf(event) < orderOf(ends[0]) && typeOf(event) === "sequencia_planilha")) {
      add("error", "loop-without-spreadsheet", "O loop precisa de um bloco de planilha entre início e fim.", starts[0]);
    }
    for (let index = 0; index < pageEvents.length; index += 1) {
      const event = pageEvents[index];
      const details = detailsOf(event);
      const next = pageEvents[index + 1];
      const type = typeOf(event);
      route(event, details.ao_sucesso, details.bloco_sucesso, details.sequencia_sucesso, "Após sucesso", next);
      if (["clicar_imagem", "procurar_texto_ocr"].includes(type)) {
        route(event, details.ao_nao_encontrar || "parar", details.bloco_nao_encontrar,
          details.sequencia_nao_encontrar, "Se OCR não encontrar", next);
        // Cada alvo OCR pode desviar por conta própria; o fluxo do card não descreve essas rotas.
        if (String(details.modo_reconhecimento || "").toLowerCase() === "texto_ocr" &&
            String(details.fonte_ocr || "legado").toLowerCase() !== "visual") {
          const layouts = Array.isArray(details.ocr_target_layouts) ? details.ocr_target_layouts : [];
          layouts.forEach((layout, targetIndex) => {
            if (!layout || typeof layout !== "object") return;
            const successAction = String(layout.action ?? layout.acao ?? "").toLowerCase();
            if (["clicar_ir_para_bloco", "clicar_e_ir_para_bloco", "click_and_jump", "click_goto",
              "confirmar_ir_para_bloco", "confirmar_e_ir_para_bloco", "confirm_and_jump", "confirm_goto",
              "ir_para_bloco", "bloco", "navegar"].includes(successAction)) {
              route(event, "ir_para_bloco", layout.block ?? layout.bloco, "", `OCR ${targetIndex + 1} encontrou`, next);
            }
            const failureAction = String(layout.failureAction ?? layout.failure_action ?? "").toLowerCase();
            if (["ir_para_bloco", "bloco", "navegar", "goto", "jump"].includes(failureAction)) {
              route(event, "ir_para_bloco", layout.failureBlock ?? layout.failure_block ?? layout.bloco_falha,
                "", `OCR ${targetIndex + 1} não encontrou`, next);
            }
          });
        }
        const hasImage = String(details.imagem || "").trim();
        const hasText = String(details.texto_ocr_busca || details.texto_ocr_esperado || "").trim();
        const source = String(details.fonte_ocr || "").toLowerCase();
        if (!hasImage && !hasText && source !== "elemento") {
          add("warning", "missing-recognition-target", "Reconhecimento sem imagem nem texto OCR configurado.", event);
        }
      } else if (["chrome_elemento_html", "uia_elemento"].includes(type)) {
        route(event, details.ao_falhar || "parar", details.bloco_falha,
          details.sequencia_falha, "Se elemento falhar", next);
      }
      if (type === "sequencia_planilha") {
        if (!String(details.arquivo || "").trim() || !String(details.coluna || "").trim()) {
          add("warning", "incomplete-spreadsheet", "Dados da planilha sem arquivo ou coluna definidos.", event);
        }
      }
      if (type === "verificar_estado_botao") {
        for (const [label, value] of [["Se ativo", details.se_ativo], ["Se desativado", details.se_desativado], ["Se não encontrar", details.se_nao_encontrar]]) {
          if (value) route(event, value.acao, value.bloco, value.sequencia, label, next);
        }
      }
    }
    const settings = roadmap?.sequence_settings?.[sequence] || roadmap?.configuracoes_sequencia?.[sequence] || {};
    const afterLoop = settings.after_loop_sequence ?? settings.sequencia_apos_loop;
    if (afterLoop && pageEvents.length) {
      const target = bySequence.get(normalizedSequence(afterLoop))?.[0];
      if (target) link(pageEvents.at(-1), target);
      else add("error", "broken-loop-exit", `Após o loop: página ${afterLoop} está vazia ou não existe.`, pageEvents.at(-1));
    }
  }

  const initialSequence = normalizedSequence(roadmap?.initial_sequence ?? roadmap?.sequencia_inicial);
  const first = bySequence.get(initialSequence)?.[0];
  if (events.length && !first) add("error", "missing-start", `A página inicial ${initialSequence} não possui blocos.`);
  const visited = new Set();
  const queue = first ? [orderOf(first)] : [];
  while (queue.length) {
    const order = queue.shift();
    if (visited.has(order)) continue;
    visited.add(order);
    for (const next of edgeMap.get(order) || []) if (!visited.has(next)) queue.push(next);
  }
  for (const event of events) {
    const order = orderOf(event);
    if (Number.isInteger(order) && !visited.has(order)) {
      add("warning", "unreachable", "Bloco sem caminho a partir da página inicial.", event);
    }
  }

  return {
    issues,
    errors: issues.filter((issue) => issue.severity === "error"),
    warnings: issues.filter((issue) => issue.severity === "warning"),
    blockCount: events.length,
  };
}

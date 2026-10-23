// Read-only view: no automation commands, and all imported text uses textContent.
(async () => {
  const pageId = new URLSearchParams(location.search).get("page");
  if (!pageId) throw new Error("Página de execução não informada.");
  const key = `flowdetectChromePageRun:${pageId}`;
  const run = (await chrome.storage.local.get(key))[key];
  if (!run) throw new Error("Nenhuma execução salva nesta página.");
  document.querySelector("#title").textContent = run.automationName || run.automationSnapshot?.automation?.nome || "Histórico da execução";
  const states = { running: "Em execução", waiting_screen: "Aguardando tela", failed: "Falhou", completed: "Concluída", stopped: "Interrompida" };
  document.querySelector("#status").textContent = `${run.pageName || "Página de execução"} · ${states[run.status] || run.status}. Cópia dos registros disponíveis ao abrir esta aba; recarregue para atualizar.`;
  for (const step of [...(run.recentSteps || [])].reverse()) {
    const item = document.createElement("article"); item.className = "step";
    const heading = document.createElement("h3");
    const source = run.automationSnapshot?.steps?.[step.index];
    const stepStates = { running: "Executando", done: "Concluído", routed: "Redirecionado", failed: "Falhou", stopped: "Parado" };
    heading.textContent = `B${String(source?.source_order || Number(step.index ?? 0) + 1).padStart(2, "0")} · ${stepStates[step.state] || step.state || ""}`;
    item.append(heading);
    const checkStates = { pending: "Pendente", checking: "Procurando", found: "Encontrado", not_found: "Não encontrado" };
    const lines = [source?.text, step.message, step.route,
      ...(step.ocrChecks || []).map((check, index) => `OCR ${index + 1}: ${check.text || ""} — ${checkStates[check.state] || check.state || ""}`)];
    for (const text of lines.filter(Boolean)) { const line = document.createElement("p"); line.textContent = String(text); item.append(line); }
    document.querySelector("#steps").append(item);
  }
  if (!run.recentSteps?.length) document.querySelector("#steps").textContent = "Nenhuma etapa registrada.";
  for (const entry of [...(run.logs || [])].reverse()) {
    const line = document.createElement("li");
    if (["error", "warning", "success"].includes(entry.level)) line.className = entry.level;
    line.textContent = String(entry.message || "");
    document.querySelector("#logs").append(line);
  }
  if (!run.logs?.length) document.querySelector("#logs").textContent = "Nenhum registro disponível.";
})().catch(error => { document.querySelector("#status").textContent = error.message; });

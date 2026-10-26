const AUTOMATIONS_KEY = "flowdetectChromeAutomations";
const RUN_STORAGE_KEY = "flowdetectChromeLastRun";
const REQUIRED_RUNTIME_VERSION = "0.2.65";
const PAGES_KEY = "flowdetectChromeExecutionPages";
const PAGE_RUN_PREFIX = "flowdetectChromePageRun:";
let executionPages = [];
let selectedPageId = null;
const pageRuns = new Map();
const startingPages = new Set();
const pageViews = new Map();
const automationList = document.querySelector("#automationList");
const automationTemplate = document.querySelector("#automationTemplate");
const importInput = document.querySelector("#importInput");
const newButton = document.querySelector("#newButton");
const mapElementButton = document.querySelector("#mapElementButton");
const mapElementStatus = document.querySelector("#mapElementStatus");
const downloadActivity = document.querySelector("#downloadActivity");
const studioConnection = document.querySelector("#studioConnection");
const studioConnectionCompact = document.querySelector("#studioConnectionCompact");
const studioPairCode = document.querySelector("#studioPairCode");
const studioNewPairCode = document.querySelector("#studioNewPairCode");
let automationsCache = [];
let currentRun = {};
let lastDownloadStatus = null;
const carouselStates = new Map();
const companyPreviewRows = new Map();
const editableOcrDrafts = new Map();
const loopExclusionDrafts = new Map();
const expandedRunLogs = new Set();
let managerViewRequested = false;
let workspaceView = "automations";
let workspaceAnimations = [];

function pageFeedback(error) {
  const node = document.querySelector("#executionPageFeedback");
  node.textContent = String(error?.message || error || "");
  node.hidden = !node.textContent;
}

const PAGE_COLORS = ["#12b5cb", "#8b5cf6", "#4ade80", "#f59e0b"];
const pageAccent = (page, index) => PAGE_COLORS.includes(page.color)
  ? page.color : PAGE_COLORS[(Number(page.slot || index + 1) - 1) % PAGE_COLORS.length];

async function deleteExecutionPage(id) {
  const page = executionPages.find((item) => item.id === id);
  if (!page) return;
  const run = pageRuns.get(id);
  if (startingPages.has(id) || ["running", "waiting_screen"].includes(run?.status)) {
    pageFeedback("Pare a execução desta página antes de excluí-la.");
    return;
  }
  if (!window.confirm(`Excluir ${page.name}? A aba será desvinculada e o histórico será apagado. As automações desta página serão transferidas para a próxima página disponível, sem serem excluídas.`)) return;
  try {
    const result = await chrome.runtime.sendMessage({ type: "flowdetect-page-delete", pageId: id });
    if (!result?.ok) throw new Error(result?.error || "Não foi possível excluir a página.");
    pageRuns.delete(id);
    pageViews.delete(id);
    startingPages.delete(id);
    executionPages = executionPages.filter((item) => item.id !== id);
    selectExecutionPage(executionPages.some((item) => item.id === selectedPageId)
      ? selectedPageId : (executionPages[0]?.id || null));
  } catch (error) { pageFeedback(error); }
}

function renderExecutionPages() {
  const nav = document.querySelector("#executionPageTabs");
  // Keep each tab mounted: live progress must not restart animations or lose focus.
  const existingCards = new Map([...nav.children].map((card) => [card.dataset.pageId, card]));
  const cards = executionPages.map((page, index) => {
    const color = pageAccent(page, index);
    const run = pageRuns.get(page.id);
    const busy = startingPages.has(page.id) || ["running", "waiting_screen"].includes(run?.status);
    const isNew = !existingCards.has(page.id);
    const card = existingCards.get(page.id) || document.createElement("div");
    if (isNew) card.className = "execution-page-card";
    card.dataset.pageId = page.id;
    card.classList.toggle("is-selected", page.id === selectedPageId);
    card.classList.toggle("is-linked", Number.isInteger(page.tabId));
    card.classList.toggle("is-running", busy);
    card.style.setProperty("--page-accent", color);

    const select = card.querySelector(".execution-page-select") || document.createElement("button");
    select.type = "button";
    select.className = "execution-page-select";
    select.setAttribute("role", "tab");
    select.setAttribute("aria-current", page.id === selectedPageId ? "page" : "false");
    select.setAttribute("aria-selected", page.id === selectedPageId ? "true" : "false");
    select.title = page.tabTitle || `${page.name} — sem aba vinculada`;

    const number = card.querySelector(".execution-page-number") || document.createElement("span");
    number.className = "execution-page-number";
    number.textContent = String(page.slot || index + 1);
    const name = card.querySelector(".execution-page-name") || document.createElement("strong");
    name.className = "execution-page-name";
    name.textContent = String(page.name || "Página").replace(/^Página\s+(\d+)$/i, "Pág. $1");
    const state = card.querySelector(".execution-page-state") || document.createElement("small");
    state.className = "execution-page-state";
    state.textContent = ({ running: "Executando", waiting_screen: "Aguardando tela",
      completed: "Concluída", failed: "Falhou", stopped: "Interrompida" }[run?.status]
      || (startingPages.has(page.id) ? "Iniciando…" : "Pronta"));
    card.dataset.state = run?.status || "ready";
    select.setAttribute("aria-label", `${page.name}, ${state.textContent}`);
    select.title = `${page.name} · ${state.textContent}\n${page.tabTitle || "Sem aba vinculada"}`;

    const linked = card.querySelector(".execution-page-tabtitle") || document.createElement("span");
    linked.className = "execution-page-tabtitle";
    linked.textContent = Number.isInteger(page.tabId)
      ? (page.tabTitle || "Aba vinculada")
      : "Sem aba vinculada";
    if (isNew) {
      select.append(number, name, state, linked);
      select.addEventListener("click", () => selectExecutionPage(page.id));
    }

    const remove = card.querySelector(".execution-page-delete") || document.createElement("button");
    remove.type = "button";
    remove.className = "execution-page-delete";
    remove.textContent = "×";
    remove.title = `Excluir ${page.name}`;
    remove.setAttribute("aria-label", `Excluir ${page.name}`);
    remove.disabled = busy;
    if (isNew) {
      remove.addEventListener("click", () => deleteExecutionPage(page.id));
      card.append(select, remove);
    }
    return card;
  });
  for (const card of existingCards.values()) if (!cards.includes(card)) card.remove();
  cards.forEach((card, index) => {
    if (nav.children[index] !== card) nav.insertBefore(card, nav.children[index] || null);
  });
  nav.setAttribute("role", "tablist");

  const page = executionPages.find((item) => item.id === selectedPageId);
  document.querySelector(".execution-pages").style.setProperty("--selected-page-color", page ? pageAccent(page, executionPages.indexOf(page)) : "#12b5cb");
  const busy = startingPages.has(selectedPageId) || ["running", "waiting_screen"].includes(currentRun?.status);
  const target = document.querySelector("#executionPageTarget");
  target.textContent = !page ? "Crie uma página para vincular uma aba do navegador."
    : Number.isInteger(page.tabId) ? (page.tabTitle || "Aba vinculada")
    : "Sem aba vinculada. Abra o site, depois clique em Vincular aba.";
  target.title = target.textContent;
  const bindButton = document.querySelector("#bindExecutionPage");
  bindButton.disabled = !page || busy;
  bindButton.textContent = Number.isInteger(page?.tabId) ? "Trocar" : "Vincular";
  bindButton.title = Number.isInteger(page?.tabId) ? "Trocar a aba vinculada a esta página" : "Vincular a aba ativa a esta página";
  document.querySelector("#openExecutionPage").disabled = !Number.isInteger(page?.tabId);
  document.querySelector("#addExecutionPage").disabled = executionPages.length >= 12;
  updateAssistedLiveCount();
}

function selectExecutionPage(id) {
  if (!executionPages.some((page) => page.id === id) && !(id === null && !executionPages.length)) return;
  if (selectedPageId !== id) {
    pageViews.set(selectedPageId, { managerViewRequested, maps: [carouselStates, companyPreviewRows, editableOcrDrafts, loopExclusionDrafts]
      .map((map) => new Map(map)), logs: new Set(expandedRunLogs) });
    const view = pageViews.get(id);
    [carouselStates, companyPreviewRows, editableOcrDrafts, loopExclusionDrafts].forEach((map, index) => {
      map.clear();
      for (const [key, value] of view?.maps[index] || []) map.set(key, value);
    });
    expandedRunLogs.clear();
    for (const key of view?.logs || []) expandedRunLogs.add(key);
    managerViewRequested = view?.managerViewRequested || false;
  }
  selectedPageId = id;
  currentRun = pageRuns.get(id) || {};
  pageFeedback("");
  chrome.storage.session.set({ flowdetectSelectedPage: id }).catch(() => {});
  const routeId = currentRun.downloadRouteId;
  lastDownloadStatus = null;
  if (routeId) chrome.storage.local.get(`flowdetectDownloadStatus:${routeId}`).then((storage) => {
    if (currentRun.downloadRouteId !== routeId) return;
    lastDownloadStatus = storage[`flowdetectDownloadStatus:${routeId}`];
    refreshDownloadActivity();
  });
  renderExecutionPages();
  refreshDownloadActivity();
  renderAutomations();
}

async function getExecutionTargetTab(pageId = selectedPageId) {
  const page = executionPages.find((item) => item.id === pageId);
  if (!Number.isInteger(page?.tabId)) throw new Error("Clique em ‘Usar aba atual’ para vincular esta página ao site.");
  const tab = await chrome.tabs.get(page.tabId).catch(() => null);
  if (!tab || !/^https?:\/\//i.test(tab.url || "")) throw new Error("A aba vinculada foi fechada ou não é um site. Use ‘Usar aba atual’.");
  return tab;
}

document.querySelector("#addExecutionPage").addEventListener("click", async () => {
  try {
    const result = await chrome.runtime.sendMessage({ type: "flowdetect-page-create" });
    if (!result?.ok) throw new Error(result?.error || "Não foi possível criar a página.");
    const index = executionPages.findIndex((page) => page.id === result.page.id);
    if (index < 0) executionPages.push(result.page); else executionPages[index] = result.page;
    selectExecutionPage(result.page.id);
  } catch (error) { pageFeedback(error); }
});

document.querySelector("#bindExecutionPage").addEventListener("click", async () => {
  try {
    if (!selectedPageId) throw new Error("Crie uma página antes de vincular a aba.");
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!Number.isInteger(tab?.id) || !/^https?:\/\//i.test(tab.url || "")) {
      throw new Error("Abra o site HTTP/HTTPS em uma aba antes de vincular.");
    }
    const result = await chrome.runtime.sendMessage({
      type: "flowdetect-page-bind", pageId: selectedPageId, tabId: tab.id
    });
    if (!result?.ok) throw new Error(result?.error || "Não foi possível vincular a aba.");
    const index = executionPages.findIndex((page) => page.id === result.page.id);
    if (index < 0) throw new Error("Página não encontrada após vincular a aba.");
    executionPages[index] = result.page;
    selectExecutionPage(result.page.id);
  } catch (error) { pageFeedback(error); }
});
document.querySelector("#openExecutionPage").addEventListener("click", async () => {
  try {
    const tab = await getExecutionTargetTab();
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  } catch (error) { pageFeedback(error); }
});


const getAutomations = async () => (await chrome.storage.local.get(AUTOMATIONS_KEY))[AUTOMATIONS_KEY] || [];
const setAutomations = async (automations) => chrome.storage.local.set({ [AUTOMATIONS_KEY]: automations });

async function refreshStudioConnection() {
  if (!studioConnection) return;
  const state = await chrome.runtime.sendMessage({ type: "flowdetect-studio-connection" }).catch(() => null);
  if (studioPairCode) studioPairCode.textContent = state?.pairCode || "······";
  const connected = Boolean(state?.connected);
  const busy = connected && ["testing", "importing"].includes(state.phase);
  const error = connected && state.phase === "error";
  const label = !connected && /versao do studio/i.test(state?.error || "") ? "Studio desatualizado"
    : !connected && !state?.studioFound ? "Studio não encontrado"
    : !connected ? "Studio encontrado · digite o código"
    : state.phase === "testing" ? "Testando com Studio..."
    : state.phase === "importing" ? "Recebendo automacao..."
    : error ? "Falha no ultimo pedido"
    : "Conectado ao Studio";
  for (const badge of [studioConnection, studioConnectionCompact]) {
    if (!badge) continue;
    badge.classList.toggle("is-connected", connected && !busy && !error);
    badge.classList.toggle("is-busy", busy);
    badge.classList.toggle("is-error", error);
    badge.textContent = label;
    badge.title = state?.error || label;
  }
}

refreshStudioConnection();
setInterval(refreshStudioConnection, 2000);
studioNewPairCode?.addEventListener("click", async () => {
  studioNewPairCode.disabled = true;
  try {
    const result = await chrome.runtime.sendMessage({ type: "flowdetect-studio-new-pair-code" });
    if (!result?.ok) throw new Error(result?.error || "Nao foi possivel gerar codigo.");
    await refreshStudioConnection();
  } catch (error) {
    window.alert(String(error?.message || error));
  } finally {
    studioNewPairCode.disabled = false;
  }
});

function normalizeImportedAutomation(raw, targetPageId = selectedPageId) {
  if (!targetPageId) throw new Error("Selecione uma página antes de importar uma automação.");
  const version = Number(raw?.version);
  if (!raw || raw.schema !== "flowdetect_chrome_automation" || ![1, 2, 3].includes(version) || !Array.isArray(raw.steps)) {
    throw new Error("Escolha um arquivo JSON exportado pelo FlowDetect Studio para Chrome.");
  }
  return {
    ...raw,
    id: crypto.randomUUID(),
    pageId: targetPageId,
    version,
    automation: {
      ...raw.automation,
      nome: String(raw.automation?.nome || "Automacao Chrome"),
      descricao: String(raw.automation?.descricao || "")
    },
    warnings: Array.isArray(raw.warnings) ? raw.warnings : []
  };
}

async function ensureCurrentRuntime() {
  const runtime = await chrome.runtime.sendMessage({ type: "flowdetect-runtime-info" }).catch(() => null);
  if (runtime?.ok && runtime.version === REQUIRED_RUNTIME_VERSION) return true;
  chrome.runtime.reload();
  return false;
}

function runProgress(run) {
  const total = Math.max(0, Number(run?.totalSteps || 0));
  const completed = Math.max(0, Number(run?.currentStep || 0));
  const measured = run?.progressPercent;
  const estimatedPercent = typeof measured === "number" && Number.isFinite(measured)
    ? measured
    : total ? Math.round((completed / total) * 100) : 0;
  return {
    total,
    completed,
    percent: run?.status === "completed" ? 100 : Math.min(99, estimatedPercent)
  };
}

function appendLogs(container, logs) {
  container.replaceChildren(...(logs || []).slice(-24).reverse().map((entry) => {
    const item = document.createElement("li");
    item.className = entry.level || "info";
    item.textContent = entry.message;
    return item;
  }));
}

function blockPreviewImage(step) {
  for (const asset of [step?.preview_image, step?.image, step?.visual_fallback, step?.active_image, step?.inactive_image]) {
    const url = typeof asset === "string" ? asset : asset?.data_url;
    if (/^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(url || "")) return url;
  }
  return "";
}

function blockCardDetails(step) {
  const type = String(step?.type || "");
  const titles = {
    navigate: "Abrir página", element_action: "Elemento da página", ocr_text: "Reconhecimento OCR",
    visual_match: "Reconhecimento visual", visual_state: "Verificar estado", focused_text: "Digitar texto",
    key_sequence: "Atalho de teclado", data_source: "Dados da planilha", loop_start: "Início do loop",
    loop_end: "Fim do loop", report_result: "Resultado do relatório"
  };
  const text = String(step?.text || step?.selector?.value || step?.url || step?.name || "").trim();
  const description = type === "report_result" ? `Status: ${String(step?.status || "Concluída")}`
    : text || (type === "key_sequence" ? (step.keys || []).join(" + ") : "");
  const initials = { ocr_text: "OCR", visual_match: "IMG", visual_state: "ON", navigate: "URL", data_source: "XLS", focused_text: "TXT" };
  return { title: titles[type] || String(step?.source_type || type || "Bloco do fluxo").replaceAll("_", " "),
    description: description || "Executando a ação configurada neste bloco.", icon: initials[type] || "FD" };
}

function blockActivityPreview(step, run, active) {
  if (step?.type === "data_source") {
    const values = Array.isArray(step.values) ? step.values : [];
    const row = Number(run?.spreadsheetLoop?.row);
    const currentRow = run?.spreadsheetLoop && Number.isInteger(row) && row >= 0 && row < values.length;
    const value = currentRow ? String(values[row] ?? "") : String(values[0] ?? "");
    const typing = active && run?.status === "running" && currentRow
      && Number(run.spreadsheetLoop.sourceIndex) === Number(run.currentIndex);
    return {
      kind: "PLANILHA", symbol: "▤", count: `${values.length} ${values.length === 1 ? "linha" : "linhas"}`,
      label: String(step.name || "Coluna da planilha"), value: value || "Aguardando valor",
      message: typing ? "Digitando na página" : currentRow ? `Linha ${row + 1} de ${values.length}` : "Prévia do primeiro valor",
      mode: "spreadsheet", animating: typing,
    };
  }
  if (step?.type === "report_result") {
    const saving = active && run?.status === "running";
    const status = String(step.status || "Concluída").trim();
    const reportColumn = String(step.report_column || "").trim();
    const rawResult = String(step.result || "").trim();
    const result = rawResult.replace(/\{\{\s*empresa\s*\}\}/gi,
      String(run?.spreadsheetLoop?.rowData?.Empresa || run?.variables?.empresa || "empresa atual"));
    return {
      kind: "RELATÓRIO PDF", symbol: "▦", count: reportColumn || "Resultado",
      label: "Status do registro", value: status,
      message: saving ? "Salvando no relatório" : result || "Resultado configurado para o PDF",
      mode: "report", tone: ["success", "info", "warning", "danger"].includes(step.tone) ? step.tone : "success", animating: saving,
    };
  }
  return null;
}

function renderBlockActivityPreview(container, preview) {
  const activity = container.querySelector(".block-carousel-activity");
  activity.hidden = !preview;
  if (!preview) return;
  activity.dataset.mode = preview.mode;
  activity.dataset.tone = preview.tone || "";
  activity.classList.toggle("is-animating", Boolean(preview.animating));
  activity.querySelector(".block-carousel-activity-symbol").textContent = preview.symbol;
  activity.querySelector(".block-carousel-activity-kind").textContent = preview.kind;
  activity.querySelector(".block-carousel-activity-count").textContent = preview.count;
  activity.querySelector(".block-carousel-activity-label").textContent = preview.label;
  activity.querySelector(".block-carousel-activity-value").textContent = preview.value;
  activity.querySelector(".block-carousel-activity-message").textContent = preview.message;
}

function liveStepLines(entry) {
  const checks = Array.isArray(entry.ocrChecks) ? entry.ocrChecks : [];
  const total = checks.length;
  const lines = checks.flatMap((check, index) => {
    if (!check || check.state === "pending") return [];
    const state = check.state === "found" ? "Encontrado" : check.state === "not_found"
      ? "Não encontrado" : "Procurando";
    return [{ text: `OCR ${index + 1}/${total} · ${state}: ${check.text}`, tone: check.state }];
  });
  if (entry.route) lines.push({ text: entry.route,
    tone: entry.route.startsWith("Regra: parar") ? "error" : "route" });
  if (entry.message && (!checks.length || entry.state === "failed" && !lines.some((line) => line.text.includes(entry.message)))) {
    lines.push({ text: entry.message, tone: entry.state === "failed" ? "error" : "info" });
  }
  return lines;
}

function renderLiveSteps(container, automation, run) {
  const list = container.querySelector(".live-steps-list");
  const saved = Array.isArray(run.recentSteps) ? run.recentSteps.slice(-3).reverse() : [];
  const fallbackIndex = Number(run.currentIndex ?? run.lastBlockIndex);
  const entries = saved.length ? saved : Number(run.currentStep || 0) > 0 && Number.isInteger(fallbackIndex)
    ? [{ index: fallbackIndex, state: run.status === "running" ? "running"
      : run.status === "failed" ? "failed" : run.status === "stopped" ? "stopped" : "done" }] : [];
  const states = { running: "Executando", done: "Concluído", routed: "Redirecionado", failed: "Falhou", stopped: "Parado" };
  const activeCheck = entries[0]?.ocrChecks?.findIndex((check) => check.state === "checking") ?? -1;
  container.querySelector(".live-steps-count").textContent = activeCheck >= 0
    ? `OCR ${activeCheck + 1}/${entries[0].ocrChecks.length}`
    : ["running", "waiting_screen"].includes(run.status) ? "Acompanhando" : "Últimas etapas";
  if (!entries.length) {
    const empty = document.createElement("li");
    empty.className = "live-step-empty";
    empty.textContent = "Aguardando a primeira etapa";
    list.replaceChildren(empty);
    return;
  }
  list.replaceChildren(...entries.map((entry) => {
    const item = document.createElement("li");
    item.className = `live-step ${states[entry.state] ? entry.state : "running"}`;
    const top = document.createElement("div");
    top.className = "live-step-top";
    const number = document.createElement("span");
    number.className = "live-step-number";
    const order = automation.steps?.[entry.index]?.source_order || Number(entry.index || 0) + 1;
    number.textContent = `B${String(order).padStart(2, "0")}`;
    const title = document.createElement("span");
    title.className = "live-step-title";
    title.textContent = blockCardDetails(automation.steps?.[entry.index]).title;
    const status = document.createElement("span");
    status.className = "live-step-state";
    status.textContent = states[entry.state] || states.running;
    top.append(number, title, status);
    item.append(top);
    const details = liveStepLines(entry);
    if (details.length) {
      const detailList = document.createElement("div");
      detailList.className = "live-step-details";
      for (const detail of details) {
        const line = document.createElement("span");
        line.className = `live-step-detail ${detail.tone}`;
        line.textContent = detail.text;
        line.title = detail.text;
        detailList.append(line);
      }
      item.append(detailList);
    }
    return item;
  }));
}

function renderBlockCarousel(container, automation, run) {
  const steps = automation.steps || [];
  if (!steps.length) { container.hidden = true; return; }
  const runId = String(run.id || "pending");
  let state = carouselStates.get(String(automation.id));
  if (!state || state.runId !== runId) {
    const recentFailure = Date.now() - Number(run.blockFailure?.at || 0) < 1600;
    const recentSuccess = Date.now() - Number(run.blockSuccess?.at || 0) < 1600;
    state = { runId, index: 0, following: true, lastRenderedIndex: null,
      lastFailureSerial: recentFailure && !["completed", "stopped"].includes(run.status)
        ? 0 : Number(run.blockFailure?.serial || 0),
      lastSuccessSerial: recentSuccess && !["stopped", "failed"].includes(run.status)
        ? 0 : Number(run.blockSuccess?.serial || 0) };
    carouselStates.set(String(automation.id), state);
  }
  const position = Number(run.currentIndex ?? run.lastBlockIndex);
  const activeIndex = Math.min(steps.length - 1, Math.max(0,
    Number.isInteger(position) && (run.currentIndex != null || run.lastBlockIndex != null)
      ? position : Number(run.currentStep || 0) - 1));
  const flipMs = 280;
  const feedbackMs = 440;
  const failure = run.blockFailure;
  const failureSerial = Number(failure?.serial || 0);
  const success = run.blockSuccess;
  const successSerial = Number(success?.serial || 0);
  const incoming = [];
  if (state.following && failureSerial > state.lastFailureSerial) {
    state.lastFailureSerial = failureSerial;
    incoming.push({ type: "failure", index: failure.index, nextIndex: failure.nextIndex, at: Number(failure.at || 0) });
  }
  if (state.following && successSerial > state.lastSuccessSerial) {
    state.lastSuccessSerial = successSerial;
    incoming.push({ type: "success", index: success.index, at: Number(success.at || 0) });
  }
  if (incoming.length) {
    incoming.sort((a, b) => a.at - b.at);
    const event = incoming.at(-1);
    state.feedback = { type: event.type,
      index: Math.min(steps.length - 1, Math.max(0, Number(event.index || 0))),
      startedAt: performance.now() };
    const feedback = state.feedback;
    setTimeout(() => {
      if (carouselStates.get(String(automation.id)) === state && state.feedback === feedback) renderAutomations();
    }, feedbackMs + 20);
  }
  if (state.following) state.index = activeIndex;
  state.index = Math.min(steps.length - 1, Math.max(0, state.index));
  const slide = container.querySelector(".block-carousel-slide");
  const previous = container.querySelector(".block-carousel-prev");
  const next = container.querySelector(".block-carousel-next");
  const follow = container.querySelector(".block-carousel-follow");
  const renderSlide = () => {
    const step = steps[state.index];
    const details = blockCardDetails(step);
    const image = blockPreviewImage(step);
    const changed = state.lastRenderedIndex !== null && state.lastRenderedIndex !== state.index;
    if (changed) state.flipStartedAt = performance.now();
    slide.classList.remove("flip-in", "failure-shake", "route-shake", "terminal-failure", "success-shake");
    slide.style.animationDelay = "";
    state.lastRenderedIndex = state.index;
    const automationName = container.querySelector(".block-carousel-automation");
    automationName.textContent = automation.automation?.nome || "Bloco do fluxo";
    automationName.title = automationName.textContent;
    container.querySelector(".block-carousel-count").textContent = `${state.index + 1} / ${steps.length}`;
    container.querySelector(".block-carousel-number").textContent = `B${String(step.source_order || state.index + 1).padStart(2, "0")}`;
    const feedbackElapsed = performance.now() - Number(state.feedback?.startedAt || 0);
    const feedback = state.following && feedbackElapsed < feedbackMs ? state.feedback : null;
    const showingFailure = feedback?.type === "failure" && feedback.index === state.index;
    const showingRoute = showingFailure && Number.isInteger(failure?.nextIndex);
    const showingSuccess = feedback?.type === "success" && feedback.index === state.index;
    const feedbackElement = container.querySelector(".block-carousel-feedback");
    feedbackElement.hidden = !feedback;
    if (feedback) {
      const feedbackStep = steps[feedback.index];
      const blockNumber = String(feedbackStep?.source_order || feedback.index + 1).padStart(2, "0");
      const routed = feedback.type === "failure" && Number.isInteger(failure?.nextIndex);
      const destination = routed ? steps[failure.nextIndex] : null;
      const result = feedback.type === "success" ? "Encontrado"
        : feedbackStep?.type === "ocr_text" ? "OCR não encontrado" : "Falhou";
      feedbackElement.textContent = `B${blockNumber} · ${result}${routed ? ` → B${String(destination?.source_order || failure.nextIndex + 1).padStart(2, "0")}` : ""}`;
      feedbackElement.dataset.tone = feedback.type === "success" ? "success" : routed ? "routed" : "failed";
    }
    const status = showingFailure ? (showingRoute ? "Redirecionando" : "Falhou")
      : showingSuccess ? "Encontrado" : state.index !== activeIndex ? "No fluxo" :
      run.status === "running" ? "Executando" : run.status === "completed" ? "Concluído" :
      run.status === "failed" ? "Falhou" : run.status === "stopped" ? "Parado" : "Aguardando";
    const statusElement = container.querySelector(".block-carousel-state");
    statusElement.textContent = status;
    statusElement.dataset.status = showingFailure ? showingRoute ? "routed" : "failed" : showingSuccess ? "completed"
      : state.index === activeIndex ? run.status || "ready" : "history";
    container.querySelector(".block-carousel-title").textContent = details.title;
    container.querySelector(".block-carousel-description").textContent = details.description;
    const previewImage = container.querySelector(".block-carousel-image");
    const placeholder = container.querySelector(".block-carousel-placeholder");
    const activity = !image ? blockActivityPreview(step, run, state.index === activeIndex) : null;
    renderBlockActivityPreview(container, activity);
    previewImage.hidden = !image;
    placeholder.hidden = Boolean(image || activity);
    if (image) {
      previewImage.alt = `Imagem de referência do bloco ${step.source_order || state.index + 1}`;
      previewImage.onerror = () => { previewImage.hidden = true; placeholder.hidden = false; };
      previewImage.src = image;
    } else {
      previewImage.removeAttribute("src");
    }
    container.querySelector(".block-carousel-placeholder-icon").textContent = details.icon;
    container.querySelector(".block-carousel-placeholder-text").textContent = "Sem imagem de referência neste bloco";
    const ocrProgress = container.querySelector(".block-carousel-ocr-progress");
    const latestStep = run.recentSteps?.at(-1);
    const currentOcrStep = latestStep?.index === state.index && latestStep?.serial === run.currentStep
      ? latestStep : null;
    const ocrRunning = step.type === "ocr_text" && state.index === activeIndex && run.status === "running";
    ocrProgress.hidden = step.type !== "ocr_text" || !(ocrRunning || showingFailure || showingSuccess);
    if (!ocrProgress.hidden) {
      const progressState = showingFailure ? showingRoute ? "routed" : "failed" : showingSuccess ? "success"
        : currentOcrStep?.state === "failed" ? "failed"
          : currentOcrStep?.state === "done" ? "success" : "searching";
      ocrProgress.dataset.state = progressState;
      const currentCheck = currentOcrStep?.ocrChecks?.findIndex((check) => check.state === "checking") ?? -1;
      ocrProgress.querySelector(".block-carousel-ocr-label").textContent = progressState === "routed"
        ? "OCR não encontrado · seguindo a rota" : progressState === "failed" ? "OCR não encontrado"
        : progressState === "success" ? "Texto encontrado"
          : currentCheck >= 0 ? `Procurando OCR ${currentCheck + 1}/${currentOcrStep.ocrChecks.length}…`
            : "Procurando e analisando OCR…";
    }
    container.querySelector(".block-carousel-page").textContent = `Página: ${step.sequence || "principal"}`;
    previous.disabled = state.index === 0;
    next.disabled = state.index === steps.length - 1;
    follow.disabled = state.following;
    follow.textContent = state.following ? "● Acompanhando" : "Seguir execução";
    const flipElapsed = performance.now() - Number(state.flipStartedAt || 0);
    if (changed || (state.flipStartedAt != null && flipElapsed < flipMs)) {
      slide.classList.add("flip-in");
      slide.style.animationDelay = `-${Math.round(flipElapsed)}ms`;
    }
    if (showingFailure && !slide.classList.contains("flip-in")) {
      slide.classList.add(showingRoute ? "route-shake" : "failure-shake");
      slide.style.animationDelay = `-${Math.round(feedbackElapsed)}ms`;
    } else if (showingSuccess && !slide.classList.contains("flip-in")) {
      slide.classList.add("success-shake");
      slide.style.animationDelay = `-${Math.round(feedbackElapsed)}ms`;
    } else if (run.status === "failed" && state.index === activeIndex) {
      slide.classList.add("terminal-failure");
    }
  };
  previous.addEventListener("click", () => { state.following = false; state.index -= 1; renderSlide(); });
  next.addEventListener("click", () => { state.following = false; state.index += 1; renderSlide(); });
  follow.addEventListener("click", () => { state.following = true; state.index = activeIndex; renderSlide(); });
  renderSlide();
}

function normalizedSpreadsheetColumn(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function spreadsheetLoopColumns(rows = [], sourceName = "valor") {
  const columns = [];
  const seen = new Set();
  const add = (value) => {
    const name = String(value || "").trim();
    const normalized = normalizedSpreadsheetColumn(name);
    if (!name || seen.has(normalized)) return;
    seen.add(normalized);
    columns.push(name);
  };
  add(sourceName);
  rows.forEach((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return;
    Object.keys(row).forEach(add);
  });
  return columns;
}

function spreadsheetLoopCellValue(row, column) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return "";
  const requested = normalizedSpreadsheetColumn(column);
  if (!requested) return "";
  const exact = Object.keys(row).find((name) => normalizedSpreadsheetColumn(name) === requested);
  return exact ? String(row[exact] ?? "").trim() : "";
}

function spreadsheetLoopInfo(automation) {
  const sourceIndex = (automation?.steps || []).findIndex((step) => (
    step?.type === "data_source" && Array.isArray(step.values) && step.values.length
  ));
  if (sourceIndex < 0) return null;
  const source = automation.steps[sourceIndex];
  const name = String(source.name || "valor").trim() || "valor";
  const rows = Array.isArray(source.rows) ? source.rows : [];
  return {
    sourceIndex,
    name,
    total: source.values.length,
    values: source.values.map((value) => String(value ?? "")),
    rows,
    columns: spreadsheetLoopColumns(rows, name)
  };
}

function loopRowKey(loop, index) {
  const row = loop?.rows?.[index];
  const cnpjColumn = loop?.columns?.find((column) => normalizedSpreadsheetColumn(column) === "cnpj");
  const candidate = spreadsheetLoopCellValue(row, cnpjColumn) || String(loop?.values?.[index] ?? "");
  const digits = candidate.replace(/\D/g, "");
  if (digits.length === 14) return `cnpj:${digits}`;
  const value = String(loop?.values?.[index] ?? "").trim().toLocaleLowerCase();
  return `linha:${index}:${value}`;
}

function selectedLoopRows(loop, excludedKeys) {
  const excluded = excludedKeys instanceof Set ? excludedKeys : new Set(excludedKeys || []);
  const includedIndices = [];
  const excludedRows = [];
  for (let index = 0; index < loop.total; index += 1) {
    if (excluded.has(loopRowKey(loop, index))) {
      excludedRows.push({ index: index + 1, value: loop.values[index], company: spreadsheetCompanyLabel(loop, index) });
    } else includedIndices.push(index);
  }
  return { includedIndices, excludedRows };
}

function automationWithSelectedLoopRows(automation, includedIndices) {
  const loop = spreadsheetLoopInfo(automation);
  if (!loop || !includedIndices?.length) throw new Error("Selecione ao menos uma empresa para executar.");
  const source = automation.steps[loop.sourceIndex];
  const steps = automation.steps.slice();
  steps[loop.sourceIndex] = { ...source,
    values: includedIndices.map((index) => loop.values[index]),
    ...(Array.isArray(source.rows) ? { rows: includedIndices.map((index) => source.rows[index] || {}) } : {}) };
  return { ...automation, steps };
}

function loopInfoForRun(automation, run) {
  const loop = spreadsheetLoopInfo(automation);
  if (!loop || !Array.isArray(run?.loopIncludedIndices)) return loop;
  const indices = run.loopIncludedIndices.filter((index) => Number.isInteger(index) && index >= 0 && index < loop.total);
  if (!indices.length) return loop;
  return { ...loop, total: indices.length,
    values: indices.map((index) => loop.values[index]), rows: indices.map((index) => loop.rows[index] || {}) };
}

function spreadsheetCompanyColumn(loop) {
  const columns = Array.isArray(loop?.columns) ? loop.columns : [];
  const names = ["empresa", "razao social", "nome empresarial", "nome da empresa", "nome fantasia", "fantasia", "cliente"];
  return names.map((name) => columns.find((column) => normalizedSpreadsheetColumn(column) === name))
    .find(Boolean) || columns.find((column) => {
      const name = normalizedSpreadsheetColumn(column);
      return /^(empresa|razao social|nome empresarial|nome da empresa|nome fantasia|fantasia|cliente)\b/.test(name)
        && !/\b(cnpj|codigo|id)\b/.test(name);
    }) || "";
}

function spreadsheetCompanyLabel(loop, index) {
  const row = loop?.rows?.[index];
  return spreadsheetLoopCellValue(row, spreadsheetCompanyColumn(loop))
    || String(loop?.values?.[index] ?? "").trim()
    || "(sem nome)";
}

function loopDisplayColumn(automation, loop) {
  const columns = Array.isArray(loop?.columns) ? loop.columns : [];
  const requested = String(automation?.ui?.loopDisplayColumn || "").trim();
  const find = (value) => columns.find((column) => normalizedSpreadsheetColumn(column) === normalizedSpreadsheetColumn(value));
  return find(requested) || spreadsheetCompanyColumn(loop) || find(loop?.name) || columns[0] || "";
}

function currentLoopDisplayValue(run, loop, column) {
  const rowIndex = Number(run?.spreadsheetLoop?.row);
  if (!Number.isInteger(rowIndex) || rowIndex < 0) return "";
  const row = run?.spreadsheetLoop?.rowData || loop?.rows?.[rowIndex] || {};
  const value = spreadsheetLoopCellValue(row, column);
  if (value) return value;
  return normalizedSpreadsheetColumn(column) === normalizedSpreadsheetColumn(loop?.name)
    ? String(loop?.values?.[rowIndex] ?? "").trim()
    : "";
}

async function saveLoopDisplayColumn(automationId, column) {
  const selected = String(column || "").trim();
  const automations = await getAutomations();
  const updated = automations.map((automation) => (
    String(automation.id) === String(automationId)
      ? { ...automation, ui: { ...(automation.ui || {}), loopDisplayColumn: selected } }
      : automation
  ));
  automationsCache = updated;
  await setAutomations(updated);
}

async function saveLoopExclusions(automationId, excludedKeys) {
  const stored = await getAutomations();
  const updated = stored.map((automation) => String(automation.id) === String(automationId)
    ? { ...automation, ui: { ...(automation.ui || {}), loopExcludedKeys: [...excludedKeys] } }
    : automation);
  automationsCache = updated;
  await setAutomations(updated);
}


function clampSpreadsheetStartRow(value, total) {
  const parsed = Math.trunc(Number(value));
  return Math.min(Math.max(1, Number.isFinite(parsed) ? parsed : 1), Math.max(1, Number(total) || 1));
}

function editableOcrEntries(automation) {
  return (automation.steps || []).flatMap((step, stepIndex) => {
    if (step.type !== "ocr_text") return [];
    const targets = Array.isArray(step.ocr_targets) && step.ocr_targets.length
      ? step.ocr_targets.map((target, targetIndex) => ({ target, targetIndex })).filter(({ target }) => target.editable === true)
      : step.editable_ocr === true ? [{ target: step, targetIndex: -1 }] : [];
    return targets.map(({ target, targetIndex }) => ({
      stepIndex,
      targetIndex,
      key: `${stepIndex}:${targetIndex}`,
      block: Number(step.source_order) || stepIndex + 1,
      label: targetIndex < 0 ? "OCR 1" : `OCR ${Number(target.index) || targetIndex + 1}`,
      text: String(target.text || "")
    }));
  });
}

function automationWithEditableOcr(automation, values) {
  const steps = automation.steps.map((step) => ({ ...step }));
  for (const entry of editableOcrEntries(automation)) {
    const text = String(values.get(entry.key) ?? entry.text).trim();
    if (!text) throw new Error(`Informe o texto do bloco ${entry.block}, ${entry.label}.`);
    const step = steps[entry.stepIndex];
    if (entry.targetIndex < 0) step.text = text;
    else {
      if (step.ocr_targets === automation.steps[entry.stepIndex].ocr_targets) {
        step.ocr_targets = step.ocr_targets.map((target) => ({ ...target }));
      }
      step.ocr_targets[entry.targetIndex].text = text;
    }
  }
  return { ...automation, steps };
}

async function runAutomation(automation, startRow = 1, loopIncludedIndices = null, loopExcludedRows = [], downloadRouteId = null, pageId = selectedPageId) {
  if (!await ensureCurrentRuntime()) return;
  const tab = await getExecutionTargetTab(pageId);
  const loop = spreadsheetLoopInfo(automation);
  const selectedStartRow = loop ? clampSpreadsheetStartRow(startRow, loop.total) : 1;
  if (startingPages.has(pageId)) throw new Error("Esta página já está iniciando uma execução.");
  startingPages.add(pageId);
  if (pageId === selectedPageId) {
    managerViewRequested = false;
    companyPreviewRows.delete(String(automation.id));
  }
  renderExecutionPages();
  renderAutomations();
  try {
    const response = await chrome.runtime.sendMessage({ type: "flowdetect-start", automation, tabId: tab.id, pageId,
      startRow: selectedStartRow, loopIncludedIndices, loopExcludedRows, downloadRouteId });
    if (response?.run) { updateRun(response.run); return response.run; }
    if (!response?.ok) throw new Error(response?.error || "A automacao falhou.");
    return response;
  } finally {
    startingPages.delete(pageId);
    renderExecutionPages();
    renderAutomations();
  }
}

function updateRun(run = {}) {
  if (run.pageId) pageRuns.set(run.pageId, run);
  renderExecutionPages();
  if (run.pageId !== selectedPageId) return;
  if (["running", "waiting_screen"].includes(run?.status)
      && String(run?.id || "") !== String(currentRun?.id || "")
      && !galleryRunPages.has(run.pageId)) managerViewRequested = false;
  if (hasFinishedRun(run?.status) && !hasFinishedRun(currentRun?.status)) {
    const state = carouselStates.get(String(run?.automationId || ""));
    if (state) state.following = true;
    loopExclusionDrafts.delete(String(run?.automationId || ""));
  }
  currentRun = run || {};
  renderExecutionPages();
  refreshDownloadActivity();
  renderAutomations();
}

function refreshDownloadActivity() {
  if (!downloadActivity) return;
  const status = lastDownloadStatus;
  if (!status?.routeId || status.routeId !== currentRun?.downloadRouteId) {
    downloadActivity.hidden = true;
    return;
  }
  downloadActivity.hidden = false;
  downloadActivity.classList.toggle("is-error", status.status === "error");
  downloadActivity.textContent = status.status === "saved"
    ? `Guia ${status.filename} salva em ${status.detail}.`
    : status.status === "saved_with_temp" ? `Guia ${status.filename}: ${status.detail}`
    : status.status === "waiting" ? `Destino desta execucao: ${status.detail}. Aguardando downloads.`
    : status.status === "downloading" ? `${status.filename}: ${status.detail}`
    : `Falha ao salvar ${status.filename || "guia"}: ${status.detail}`;
}

function hasFinishedRun(status) {
  return ["completed", "failed", "stopped"].includes(String(status || "").toLowerCase());
}

async function downloadExecutionReport(run) {
  if (!globalThis.FlowDetectExecutionReport?.download) {
    throw new Error("O gerador de relatorio ainda nao foi carregado.");
  }
  const filename = globalThis.FlowDetectExecutionReport.download(run);
  const updated = { ...run, reportGeneratedAt: new Date().toISOString(), reportFilename: filename };
  await chrome.storage.local.set({ [`${PAGE_RUN_PREFIX}${run.pageId}`]: updated });
  updateRun(updated);
}

async function deleteAutomation(automation) {
  if ([...pageRuns.values()].some((run) => String(run.automationId) === String(automation.id)
      && ["running", "waiting_screen"].includes(run.status))) throw new Error("Pare as execuções desta automação antes de excluí-la.");
  if (startingPages.has(selectedPageId)) throw new Error("Aguarde o início da execução antes de excluir.");

  const remaining = (await getAutomations()).filter((item) => String(item.id) !== String(automation.id));
  await setAutomations(remaining);
  for (const [pageId, id] of expandedAutomationByPage) {
    if (id === String(automation.id)) expandedAutomationByPage.delete(pageId);
  }

  // Completed page snapshots stay available even when the library item is deleted.
  renderAutomations(remaining);
}

function renderAutomation(automation, compact = false) {
  const fragment = automationTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".automation-card");
  const ownerPage = executionPages.find((page) => page.id === selectedPageId);
  const cardAccent = ownerPage ? pageAccent(ownerPage, executionPages.indexOf(ownerPage)) : "#12b5cb";
  card.classList.add("automation-imported-card");
  card.style.setProperty("--automation-card-accent", cardAccent);
  card.dataset.pageId = selectedPageId || "";
  const descriptor = document.createElement("p");
  descriptor.className = "automation-card-description";
  descriptor.textContent = String(automation.automation?.descricao || "Automação pronta para configurar e executar nesta página.");
  fragment.querySelector(".automation-card-top").after(descriptor);
  fragment.querySelector(".automation-source").textContent = automation.automation?.source || "FLOWDETECT";
  fragment.querySelector(".automation-name").textContent = automation.automation?.nome || "Automacao Chrome";
  fragment.querySelector(".step-count").textContent = `${automation.steps.length} blocos`;
  const pageIdForCard = selectedPageId;
  const runForCard = currentRun;
  const busy = startingPages.has(pageIdForCard) || ["running", "waiting_screen"].includes(currentRun?.status);
  const runButton = fragment.querySelector(".run-automation");
  const runHint = fragment.querySelector(".run-availability-hint");
  const editableEntries = editableOcrEntries(automation);
  const editSettings = fragment.querySelector(".ocr-edit-settings");
  const editError = fragment.querySelector(".ocr-edit-error");
  const draftKey = JSON.stringify([automation.id, editableEntries.map(({ key, text }) => [key, text])]);
  const drafts = editableOcrDrafts.get(draftKey) || new Map();
  if (editableEntries.length) {
    editableOcrDrafts.set(draftKey, drafts);
    editSettings.hidden = false;
    fragment.querySelector(".ocr-edit-count").textContent = `${editableEntries.length}`;
    const editFields = fragment.querySelector(".ocr-edit-fields");
    for (const entry of editableEntries) {
      const label = document.createElement("label");
      const caption = document.createElement("span");
      caption.textContent = `Bloco ${entry.block} · ${entry.label}`;
      const input = document.createElement("input");
      input.type = "text";
      input.value = drafts.get(entry.key) ?? entry.text;
      input.autocomplete = "off";
      input.setAttribute("aria-label", `${caption.textContent}: texto para validar`);
      input.addEventListener("input", () => {
        drafts.set(entry.key, input.value);
        editError.hidden = true;
      });
      label.append(caption, input);
      editFields.append(label);
    }
    if (compact && editableEntries.length > 2) {
      let fieldPage = 0;
      const fields = [...editFields.children];
      const pager = makeCardPager(() => { fieldPage--; updateFields(); }, () => { fieldPage++; updateFields(); });
      const updateFields = () => {
        fields.forEach((field, index) => { field.hidden = Math.floor(index / 2) !== fieldPage; });
        pager.update(fieldPage, Math.ceil(fields.length / 2));
      };
      editFields.after(pager.node);
      card.addEventListener("card-settings-open", (event) => {
        if (event.detail !== "ocr-edit-settings") return;
        const invalid = fields.findIndex(field => !field.querySelector("input").value.trim());
        if (invalid >= 0) { fieldPage = Math.floor(invalid / 2); updateFields(); }
      });
      updateFields();
    }
  }
  const refreshRunAvailability = () => {
    if (busy) { runButton.disabled = true; runHint.hidden = true; return; }
    if (loopSelection && !loopSelection.includedIndices.length) {
      runButton.disabled = true;
      runHint.hidden = false;
      runHint.textContent = "Inclua ao menos uma empresa antes de executar.";
      return;
    }
    runButton.disabled = false;
    runHint.hidden = true;
  };
  runButton.disabled = busy;
  const loop = spreadsheetLoopInfo(automation);
  const loopStart = fragment.querySelector(".loop-start");
  const loopStartChoice = fragment.querySelector(".loop-start-choice");
  const loopEdit = fragment.querySelector(".loop-edit-settings");
  const loopFingerprint = loop ? JSON.stringify(loop.values.map((_, index) => loopRowKey(loop, index))) : "";
  const loopDraftKey = String(automation.id);
  const loopDraft = loopExclusionDrafts.get(loopDraftKey);
  const storedExcludedKeys = Array.isArray(automation.ui?.loopExcludedKeys) ? automation.ui.loopExcludedKeys : [];
  const loopExcludedKeys = new Set(loopDraft?.fingerprint === loopFingerprint ? loopDraft.excludedKeys : storedExcludedKeys);
  let loopSelection = loop ? selectedLoopRows(loop, loopExcludedKeys) : null;
  if (loop) {
    loopStart.hidden = false;
    loopEdit.hidden = false;
    const search = loopEdit.querySelector(".loop-edit-search");
    const list = loopEdit.querySelector(".loop-edit-list");
    const includeFiltered = loopEdit.querySelector(".loop-include-filtered");
    const excludeFiltered = loopEdit.querySelector(".loop-exclude-filtered");
    const saveExclusions = loopEdit.querySelector(".loop-save-exclusions");
    saveExclusions.checked = loopDraft?.fingerprint === loopFingerprint
      ? loopDraft.save : Boolean(storedExcludedKeys.length);
    const rememberLoopDraft = () => loopExclusionDrafts.set(loopDraftKey, {
      fingerprint: loopFingerprint, excludedKeys: [...loopExcludedKeys], save: saveExclusions.checked });
    saveExclusions.addEventListener("change", rememberLoopDraft);
    for (const control of loopEdit.querySelectorAll("input,button")) control.disabled = busy;
    loopStartChoice.disabled = busy;
    const refreshLoopSelection = () => {
      const previousIndex = loopSelection?.includedIndices?.[Number(loopStartChoice.value) - 1];
      loopSelection = selectedLoopRows(loop, loopExcludedKeys);
      const active = loopSelection.includedIndices;
      loopStartChoice.replaceChildren(...active.map((originalIndex, index) => {
        const value = loop.values[originalIndex];
        const company = spreadsheetCompanyLabel(loop, originalIndex);
        const option = document.createElement("option");
        option.value = String(index + 1);
        option.textContent = `#${index + 1} · ${company}`;
        option.title = `${company} · ${loop.name}: ${value || "(vazio)"}`;
        return option;
      }));
      const next = active.indexOf(previousIndex);
      loopStartChoice.value = String(next >= 0 ? next + 1 : 1);
      loopStartChoice.title = loopStartChoice.selectedOptions[0]?.title || "Selecione uma empresa para iniciar.";
      const skipped = loopSelection.excludedRows.length;
      loopEdit.querySelector(".loop-edit-count").textContent = `${active.length}/${loop.total} ativas`;
      loopEdit.querySelector(".loop-edit-results").textContent = skipped
        ? `${skipped} ${skipped === 1 ? "linha ignorada" : "linhas ignoradas"} nesta execução.`
        : "Todas as linhas serão executadas.";
      refreshRunAvailability();
    };
    loopStartChoice.addEventListener("change", () => {
      loopStartChoice.title = loopStartChoice.selectedOptions[0]?.title || "Selecione uma empresa para iniciar.";
    });
    const matchingLoopRows = () => {
      const query = normalizedSpreadsheetColumn(search.value);
      const cnpjColumn = loop.columns.find((column) => normalizedSpreadsheetColumn(column) === "cnpj");
      return loop.values.map((value, index) => ({ value, index,
        company: spreadsheetCompanyLabel(loop, index),
        cnpj: spreadsheetLoopCellValue(loop.rows[index], cnpjColumn)
          || (value.replace(/\D/g, "").length === 14 ? value : ""), key: loopRowKey(loop, index) }))
        .filter(({ value, company, cnpj }) => !query || normalizedSpreadsheetColumn(`${value} ${company} ${cnpj}`).includes(query));
    };
    let loopListPage = 0;
    const loopPager = compact ? makeCardPager(() => { loopListPage--; renderLoopList(); }, () => { loopListPage++; renderLoopList(); }) : null;
    let selectionActions;
    if (loopPager) {
      list.after(loopPager.node);
      selectionActions = document.createElement("select");
      selectionActions.className = "loop-selection-actions";
      selectionActions.setAttribute("aria-label", "Ações de seleção das empresas");
      for (const [value, text] of [["", "Selecionar…"], ["include", "Marcar resultados"], ["exclude", "Desmarcar resultados"], ["all", "Incluir todas"]]) {
        const option = document.createElement("option"); option.value = value; option.textContent = text; selectionActions.append(option);
      }
      selectionActions.disabled = busy;
      selectionActions.addEventListener("change", () => {
        const action = selectionActions.value; selectionActions.value = "";
        if (action === "include") includeFiltered.click();
        if (action === "exclude") excludeFiltered.click();
        if (action === "all") loopEdit.querySelector(".loop-include-all").click();
      });
      loopPager.node.prepend(selectionActions);
      const saveLabel = saveExclusions.parentElement;
      saveLabel.title = "Manter as empresas excluídas nas próximas execuções desta automação";
      for (const child of [...saveLabel.childNodes]) if (child.nodeType === Node.TEXT_NODE) child.textContent = " Lembrar seleção";
    }
    const renderLoopList = () => {
      const matches = matchingLoopRows();
      const filtered = Boolean(search.value.trim());
      includeFiltered.textContent = filtered ? `Marcar encontradas (${matches.length})` : `Marcar todas (${loop.total})`;
      excludeFiltered.textContent = filtered ? `Desmarcar encontradas (${matches.length})` : `Desmarcar todas (${loop.total})`;
      includeFiltered.disabled = busy || !matches.length;
      excludeFiltered.disabled = busy || !matches.length;
      if (selectionActions) {
        selectionActions.options[1].textContent = includeFiltered.textContent;
        selectionActions.options[2].textContent = excludeFiltered.textContent;
        selectionActions.options[1].disabled = selectionActions.options[2].disabled = !matches.length;
      }
      const oldTop = list.scrollTop;
      const pageSize = compact ? 2 : 100;
      loopListPage = Math.max(0, Math.min(loopListPage, Math.ceil(matches.length / pageSize) - 1));
      loopPager?.update(loopListPage, Math.max(1, Math.ceil(matches.length / pageSize)));
      list.replaceChildren(...matches.slice(loopListPage * pageSize, (loopListPage + 1) * pageSize).map(({ value, index, company, cnpj, key }) => {
        const label = document.createElement("label");
        label.className = `loop-edit-row${loopExcludedKeys.has(key) ? " is-excluded" : ""}`;
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = !loopExcludedKeys.has(key);
        checkbox.disabled = busy;
        checkbox.setAttribute("aria-label", `Executar empresa ${company}, linha ${index + 1}, ${loop.name}: ${value}`);
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) loopExcludedKeys.delete(key);
          else loopExcludedKeys.add(key);
          rememberLoopDraft();
          refreshLoopSelection();
          renderLoopList();
        });
        const copy = document.createElement("span");
        const title = document.createElement("strong");
        title.textContent = company;
        title.title = company;
        const subtitle = document.createElement("small");
        subtitle.textContent = `#${index + 1} · ${cnpj ? `CNPJ ${cnpj}` : `${loop.name}: ${value || "(vazio)"}`}`
          + (cnpj && cnpj !== value ? ` · ${loop.name}: ${value || "(vazio)"}` : "");
        if (compact && company.replace(/\D/g, "") === cnpj && cnpj) {
          title.textContent = cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
          subtitle.hidden = true;
          label.title = `Linha ${index + 1} · CNPJ ${cnpj}`;
        }
        copy.append(title, subtitle);
        label.append(checkbox, copy);
        return label;
      }));
      list.scrollTop = oldTop;
      if (!matches.length) list.textContent = "Nenhuma empresa encontrada.";
      else if (!compact && matches.length > 100) {
        const hint = document.createElement("p");
        hint.className = "loop-edit-results";
        hint.textContent = `Mostrando 100 de ${matches.length}. Refine a busca para ver as demais.`;
        list.append(hint);
      }
    };
    search.addEventListener("input", () => { loopListPage = 0; renderLoopList(); });
    const setFilteredInclusion = (include) => {
      for (const { key } of matchingLoopRows()) {
        if (include) loopExcludedKeys.delete(key);
        else loopExcludedKeys.add(key);
      }
      rememberLoopDraft();
      refreshLoopSelection();
      renderLoopList();
    };
    includeFiltered.addEventListener("click", () => setFilteredInclusion(true));
    excludeFiltered.addEventListener("click", () => setFilteredInclusion(false));
    loopEdit.querySelector(".loop-include-all").addEventListener("click", () => {
      loopExcludedKeys.clear();
      rememberLoopDraft();
      refreshLoopSelection();
      renderLoopList();
    });
    refreshLoopSelection();
    renderLoopList();
  }

  const isCurrent = String(currentRun?.automationId || "") === String(automation.id);
  const executionLoop = isCurrent ? loopInfoForRun(automation, currentRun) : loop;
  const executionAutomation = isCurrent && currentRun.automationSnapshot || (isCurrent && Array.isArray(currentRun?.loopIncludedIndices)
    && currentRun.loopIncludedIndices.length
    ? automationWithSelectedLoopRows(automation, currentRun.loopIncludedIndices) : automation);
  const resumeButton = fragment.querySelector(".resume-run-button");
  if (isCurrent && managerViewRequested && ["running", "waiting_screen", "completed", "failed", "stopped"].includes(currentRun?.status)) {
    resumeButton.hidden = false;
    resumeButton.textContent = `Ver última execução · ${runProgress(currentRun).percent}%`;
    resumeButton.addEventListener("click", () => { managerViewRequested = false; renderAutomations(); });
  }
  if (isCurrent && !managerViewRequested) {
    const status = currentRun.status || "ready";
    const labels = { ready: "Pronto", running: "Executando", waiting_screen: "Aguardando tela", completed: "Concluida", failed: "Falhou", stopped: "Parada" };
    const progress = runProgress(currentRun);
    card.classList.add("is-active");
    const execution = fragment.querySelector(".execution");
    execution.hidden = false;
    const statusElement = fragment.querySelector(".execution-status");
    statusElement.textContent = labels[status] || status;
    statusElement.className = `execution-status ${status}`;
    fragment.querySelector(".execution-percent").textContent = `${progress.percent}%`;
    fragment.querySelector(".execution-progress").setAttribute("aria-valuenow", String(progress.percent));
    if (executionLoop?.total) {
      const companyField = fragment.querySelector(".execution-company");
      const companyChoice = fragment.querySelector(".execution-company-choice");
      const companyPosition = fragment.querySelector(".execution-company-position");
      const liveRow = Number(currentRun.spreadsheetLoop?.row);
      const hasLiveRow = currentRun.spreadsheetLoop && Number.isInteger(liveRow) && liveRow >= 0 && liveRow < executionLoop.total;
      const liveName = hasLiveRow ? spreadsheetCompanyLabel(executionLoop, liveRow) : "Aguardando empresa";
      const followOption = document.createElement("option");
      followOption.value = "";
      followOption.textContent = hasLiveRow ? `Atual · ${liveName}` : "Acompanhar empresa atual";
      companyChoice.replaceChildren(followOption, ...executionLoop.values.map((_, index) => {
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = `#${index + 1} · ${spreadsheetCompanyLabel(executionLoop, index)}`;
        return option;
      }));
      const previewRow = companyPreviewRows.get(String(automation.id));
      companyChoice.value = Number.isInteger(previewRow) && previewRow >= 0 && previewRow < executionLoop.total ? String(previewRow) : "";
      companyChoice.title = "A escolha altera somente a visualização; a automação continua na ordem normal.";
      companyPosition.textContent = hasLiveRow ? `${liveRow + 1}/${executionLoop.total}` : `${executionLoop.total} no total`;
      companyChoice.addEventListener("change", () => {
        if (companyChoice.value === "") companyPreviewRows.delete(String(automation.id));
        else companyPreviewRows.set(String(automation.id), Number(companyChoice.value));
      });
      companyField.hidden = false;
    }
    renderBlockCarousel(fragment.querySelector(".block-carousel"), executionAutomation, currentRun);
    renderLiveSteps(fragment.querySelector(".live-steps"), executionAutomation, currentRun);
    const executionSummary = fragment.querySelector(".execution-summary");
    const executionColumnLabel = fragment.querySelector(".execution-column-label");
    const executionColumnChoice = fragment.querySelector(".execution-column-choice");
    const refreshExecutionLoopSummary = () => {
      if (status === "waiting_screen") {
        executionSummary.textContent = "Aguardando tela da automacao";
        executionSummary.title = currentRun.waitingReason || "URL e texto esperado ainda nao foram confirmados.";
        return;
      }
      if (!executionLoop?.columns?.length) {
        executionSummary.textContent = "Preparando execucao";
        return;
      }
      const selectedColumn = loopDisplayColumn(automation, executionLoop);
      executionColumnChoice.value = selectedColumn;
      if (status === "completed") {
        executionSummary.textContent = "Todas as linhas processadas";
        executionSummary.title = "Automação concluída";
        return;
      }
      const value = currentLoopDisplayValue(currentRun, executionLoop, selectedColumn);
      executionSummary.textContent = value || "Aguardando a próxima linha";
      executionSummary.title = `${selectedColumn}: ${value || "Aguardando a próxima linha"}`;
    };
    if (executionLoop?.columns?.length) {
      executionColumnLabel.hidden = false;
      const selectedColumn = loopDisplayColumn(automation, executionLoop);
      executionColumnChoice.replaceChildren(...executionLoop.columns.map((column) => {
        const option = document.createElement("option");
        option.value = column;
        option.textContent = column;
        option.selected = column === selectedColumn;
        return option;
      }));
      executionColumnChoice.addEventListener("change", () => {
        automation.ui = { ...(automation.ui || {}), loopDisplayColumn: executionColumnChoice.value };
        refreshExecutionLoopSummary();
        saveLoopDisplayColumn(automation.id, executionColumnChoice.value).catch((error) => {
          window.alert(`Nao foi possivel salvar a coluna exibida: ${String(error.message || error)}`);
        });
      });
    }
    refreshExecutionLoopSummary();
    fragment.querySelector(".progress-bar").style.width = `${progress.percent}%`;
    const stop = fragment.querySelector(".stop-button");
    stop.hidden = !["running", "waiting_screen"].includes(status);
    stop.addEventListener("click", () => chrome.runtime.sendMessage({ type: "flowdetect-stop", runId: runForCard.id, pageId: pageIdForCard }));
    const managerButton = fragment.querySelector(".block-carousel-manager");
    managerButton.hidden = !hasFinishedRun(status);
    managerButton.addEventListener("click", () => setWorkspaceView("automations"));
    const reportButton = fragment.querySelector(".report-button");
    const canGenerateReport = hasFinishedRun(status);
    reportButton.hidden = !canGenerateReport;
    if (canGenerateReport) {
      reportButton.textContent = currentRun.reportGeneratedAt ? "Gerar novo relatório PDF" : "Gerar relatório PDF";
      reportButton.addEventListener("click", () => downloadExecutionReport(runForCard).catch((error) => {
        window.alert(`Nao foi possivel gerar o relatorio: ${String(error.message || error)}`);
      }));
    }
    const logDetails = fragment.querySelector(".run-log-details");
    logDetails.open = expandedRunLogs.has(String(automation.id));
    logDetails.addEventListener("toggle", () => {
      if (logDetails.open) expandedRunLogs.add(String(automation.id));
      else expandedRunLogs.delete(String(automation.id));
    });
    appendLogs(fragment.querySelector(".run-log"), currentRun.logs);
  }

  const startConfiguredAutomation = async () => {
    const startRow = loop ? clampSpreadsheetStartRow(loopStartChoice.value, loopSelection.includedIndices.length) : 1;
    let configuredOcr;
    let execution;
    try {
      configuredOcr = automationWithEditableOcr(automation, drafts);
      execution = loop ? automationWithSelectedLoopRows(configuredOcr, loopSelection.includedIndices) : configuredOcr;
    } catch (error) {
      if (loop && !loopSelection.includedIndices.length) {
        loopEdit.open = true;
        card.dispatchEvent(new CustomEvent("card-settings-open", { detail: "loop-edit-settings" }));
      }
      else {
        editSettings.open = true;
        editError.textContent = String(error.message || error);
        editError.hidden = false;
        card.dispatchEvent(new CustomEvent("card-settings-open", { detail: "ocr-edit-settings" }));
      }
      return;
    }
    if (loopSelection?.excludedRows.length && !window.confirm(
      `Executar ${loopSelection.includedIndices.length} de ${loop.total} linhas?\n${loopSelection.excludedRows.length} serão ignoradas.`)) return;
    try {
      if (loop) await saveLoopExclusions(automation.id,
        loopEdit.querySelector(".loop-save-exclusions").checked ? loopExcludedKeys : []);
      return await runAutomation(execution, startRow,
        loopSelection?.includedIndices || null, loopSelection?.excludedRows || [], null, pageIdForCard);
    } catch (error) {
      const page = executionPages.find((item) => item.id === pageIdForCard);
      pageFeedback(`${page?.name || "Página"}: ${String(error.message || error)}`);
    }
  };
  runButton.addEventListener("click", startConfiguredAutomation);
  fragment.querySelector(".download-open-settings").addEventListener("click", () => {
    chrome.tabs.create({ url: "chrome://settings/downloads" }).catch(pageFeedback);
  });
  // Native confirm dialogs are unreliable in Chrome action popups. Confirm in-place.
  const deleteButton = fragment.querySelector(".delete-automation");
  const confirmation = document.createElement("div");
  confirmation.className = "automation-delete-confirm";
  confirmation.hidden = true;
  const warning = document.createElement("span");
  warning.textContent = "Excluir da biblioteca? O histórico será mantido.";
  const cancelDelete = document.createElement("button");
  cancelDelete.type = "button"; cancelDelete.textContent = "Cancelar";
  const confirmDelete = document.createElement("button");
  confirmDelete.type = "button"; confirmDelete.textContent = "Excluir";
  confirmDelete.className = "confirm-delete-automation";
  confirmation.append(warning, cancelDelete, confirmDelete);
  fragment.querySelector(".automation-card-top").after(confirmation);
  deleteButton.addEventListener("click", () => { confirmation.hidden = false; cancelDelete.focus(); });
  cancelDelete.addEventListener("click", () => { confirmation.hidden = true; deleteButton.focus(); });
  confirmDelete.addEventListener("click", async () => {
    confirmDelete.disabled = true;
    try { await deleteAutomation(automation); }
    catch (error) { warning.textContent = String(error.message || error); }
    finally { confirmDelete.disabled = false; }
  });
  return fragment;
}



const expandedAutomationByPage = new Map();
const cardEditorViews = new Map();
const galleryRunPages = new Set();

function makeCardPager(previous, next) {
  const node = document.createElement("div"); node.className = "card-settings-pager";
  const back = document.createElement("button"), forward = document.createElement("button"), label = document.createElement("span");
  back.type = forward.type = "button";
  back.textContent = "←"; forward.textContent = "→";
  back.setAttribute("aria-label", "Itens anteriores"); forward.setAttribute("aria-label", "Próximos itens");
  back.addEventListener("click", previous); forward.addEventListener("click", next);
  node.append(back, label, forward);
  return { node, update(index, total) { label.textContent = `${index + 1} / ${total}`; back.disabled = index === 0; forward.disabled = index + 1 >= total; } };
}

function installCardSettings(card, key) {
  const actions = document.createElement("div"); actions.className = "card-primary-actions";
  actions.append(card.querySelector(".run-automation"));
  card.append(actions);
  const panel = document.createElement("section"); panel.className = "card-settings-panel";
  const choice = document.createElement("select"); choice.className = "card-settings-choice";
  choice.setAttribute("aria-label", "Seção de configurações");
  const sections = [["loop-edit-settings", "Empresas"], ["ocr-edit-settings", "Textos OCR"], ["download-settings", "Downloads"]]
    .map(([className, title]) => ({ node: card.querySelector(`.${className}`), className, title }))
    .filter(section => section.node && !section.node.hidden);
  panel.append(choice);
  for (const section of sections) {
    const option = document.createElement("option"); option.value = section.className; option.textContent = section.title;
    choice.append(option); section.node.open = true; panel.append(section.node);
  }
  const configure = document.createElement("button"); configure.type = "button"; configure.className = "automation-configure";
  const refresh = () => {
    const state = cardEditorViews.get(key);
    card.dataset.editing = String(Boolean(state));
    panel.hidden = !state;
    configure.textContent = state ? "←" : "Configurações";
    configure.title = state ? "Voltar à execução" : "Configurar esta automação";
    configure.setAttribute("aria-label", configure.title);
    if (state) card.querySelector(".automation-card-top").prepend(configure);
    else actions.prepend(configure);
    configure.setAttribute("aria-expanded", String(Boolean(state)));
    choice.value = sections.some(section => section.className === state) ? state : sections[0].className;
    sections.forEach(section => { section.node.hidden = section.className !== choice.value; });
  };
  configure.addEventListener("click", () => {
    if (cardEditorViews.has(key)) cardEditorViews.delete(key);
    else cardEditorViews.set(key, choice.value || sections[0].className);
    refresh();
  });
  choice.addEventListener("change", () => { cardEditorViews.set(key, choice.value); refresh(); });
  card.addEventListener("card-settings-open", event => {
    if (sections.some(section => section.className === event.detail)) {
      cardEditorViews.set(key, event.detail); refresh();
    }
  });
  card.append(configure, panel); refresh();
}

function stretchAutomationCard(opened, oldRect) {
  if (!opened || !oldRect || !opened.animate
      || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
  const current = opened.getBoundingClientRect();
  if (!current.width || !oldRect.width) return;
  const dx = oldRect.left - current.left;
  const dy = oldRect.top - current.top;
  const hiddenRight = Math.max(0, current.width - oldRect.width);
  const hiddenBottom = Math.max(0, current.height - oldRect.height);
  opened.animate([
    {
      clipPath: `inset(0px ${hiddenRight}px ${hiddenBottom}px 0px round 11px)`,
      transform: `translate(${dx}px, ${dy}px)`, opacity: .94
    },
    { clipPath: "inset(0px 0px 0px 0px round 12px)", transform: "translate(0px, 0px)", opacity: 1 }
  ], { duration: 375, easing: "cubic-bezier(.18,.8,.23,1)" });
}

function unfoldAutomationCard(automationId, oldRect) {
  const pageId = selectedPageId;
  expandedAutomationByPage.set(pageId, String(automationId));
  const scroll = automationList.scrollTop;
  renderAutomations();
  automationList.scrollTop = scroll;
  const expanded = [...automationList.querySelectorAll(".automation-flip-item.is-expanded")]
    .find((item) => item.dataset.automationId === String(automationId));
  stretchAutomationCard(expanded, oldRect);
}

function closeExpandedAutomation() {
  const pageId = selectedPageId;
  const expandedId = expandedAutomationByPage.get(pageId);
  if (!expandedId) return;
  const item = [...automationList.querySelectorAll(".automation-flip-item.is-expanded")]
    .find((entry) => entry.dataset.automationId === expandedId);
  const finish = () => {
    if (expandedAutomationByPage.get(pageId) !== expandedId) return;
    expandedAutomationByPage.delete(pageId);
    if (selectedPageId === pageId) {
      const scroll = automationList.scrollTop;
      renderAutomations();
      automationList.scrollTop = scroll;
      [...automationList.querySelectorAll(".automation-tile-open")]
        .find((button) => button.closest(".automation-flip-item")?.dataset.automationId === expandedId)?.focus();
    }
  };
  if (!item?.animate || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
    finish();
    return;
  }
  const width = item.getBoundingClientRect().width;
  const right = Math.max(0, width - 120);
  const bottom = Math.max(0, item.getBoundingClientRect().height - 145);
  item.animate([
    { clipPath: "inset(0px 0px 0px 0px round 12px)", opacity: 1 },
    { clipPath: `inset(0px ${right}px ${bottom}px 0px round 11px)`, opacity: .85 }
  ], { duration: 220, easing: "cubic-bezier(.55,0,.9,.48)", fill: "forwards" })
    .finished.then(finish, finish);
}

async function runFromCompactCard(automation, pageId) {
  const page = executionPages.find((item) => item.id === pageId);
  if (!page) throw new Error("Página da automação não encontrada.");
  if (startingPages.has(pageId) || ["running", "waiting_screen"].includes(pageRuns.get(pageId)?.status)) {
    throw new Error("Já existe uma automação em execução nesta página.");
  }
  // Validate the selected tab before changing the visual run presentation.
  await getExecutionTargetTab(pageId);

  let prepared = automation;
  const entries = editableOcrEntries(automation);
  const ocrKey = JSON.stringify([automation.id, entries.map(({ key, text }) => [key, text])]);
  prepared = automationWithEditableOcr(prepared, editableOcrDrafts.get(ocrKey) || new Map());
  const loop = spreadsheetLoopInfo(automation);
  let selection = null;
  if (loop) {
    const fingerprint = JSON.stringify(loop.values.map((_, index) => loopRowKey(loop, index)));
    const draft = loopExclusionDrafts.get(String(automation.id));
    const excluded = draft?.fingerprint === fingerprint
      ? draft.excludedKeys
      : (Array.isArray(automation.ui?.loopExcludedKeys) ? automation.ui.loopExcludedKeys : []);
    selection = selectedLoopRows(loop, new Set(excluded));
    if (!selection.includedIndices.length) {
      throw new Error("Nenhuma empresa ativa para executar. Abra os detalhes e ajuste as empresas do loop.");
    }
    if (selection.excludedRows.length && !window.confirm(
      `Executar ${selection.includedIndices.length} de ${loop.total} empresas? As outras serão ignoradas.`)) return;
    if (draft?.save && draft.fingerprint === fingerprint) {
      await saveLoopExclusions(automation.id, new Set(excluded));
    }
    prepared = automationWithSelectedLoopRows(prepared, selection.includedIndices);
  }

  galleryRunPages.add(pageId);
  if (pageId === selectedPageId) managerViewRequested = false;
  return runAutomation(prepared, 1, selection?.includedIndices || null,
    selection?.excludedRows || [], null, pageId);
}

function makeAutomationTile(automation) {
  const id = String(automation.id);
  const pageId = selectedPageId;
  const isExpanded = expandedAutomationByPage.get(pageId) === id;
  const page = executionPages.find((item) => item.id === pageId);
  const accent = page ? pageAccent(page, executionPages.indexOf(page)) : "#12b5cb";
  const pageRun = pageRuns.get(pageId);
  const active = String(pageRun?.automationId || "") === id;
  const starting = startingPages.has(pageId);
  const running = active && ["running", "waiting_screen"].includes(pageRun?.status);
  const busy = starting || ["running", "waiting_screen"].includes(pageRun?.status);
  const percent = active ? runProgress(pageRun).percent : 0;
  const statusLabel = running ? (pageRun.status === "waiting_screen" ? "Aguardando" : "Executando")
    : starting && !active ? "Iniciando" : active
      ? ({ completed: "Concluída", failed: "Falhou", stopped: "Parada" }[pageRun.status] || "Pronta")
      : "Pronta";

  const item = document.createElement("article");
  item.className = "automation-flip-item";
  item.classList.toggle("is-expanded", isExpanded);
  item.classList.toggle("is-running", running);
  item.dataset.automationId = id;
  item.dataset.pageId = pageId || "";
  item.style.setProperty("--automation-card-accent", accent);

  const tile = document.createElement("div");
  tile.className = "automation-flip-tile";
  tile.dataset.automationId = id;
  tile.dataset.pageId = pageId || "";
  tile.style.setProperty("--automation-card-accent", accent);

  const open = document.createElement("button");
  open.type = "button";
  open.className = "automation-tile-open";
  open.setAttribute("aria-expanded", String(isExpanded));
  open.setAttribute("aria-label", `Ver detalhes de ${automation.automation?.nome || "Automação Chrome"}`);
  const top = document.createElement("span");
  top.className = "automation-tile-top";
  const symbol = document.createElement("span");
  symbol.className = "automation-tile-symbol";
  symbol.textContent = "FD";
  const expandIcon = document.createElement("span");
  expandIcon.className = "automation-tile-flip";
  expandIcon.textContent = "⤢";
  expandIcon.title = "Esticar para mostrar os detalhes";
  top.append(symbol, expandIcon);
  const name = document.createElement("strong");
  name.className = "automation-tile-name";
  name.textContent = automation.automation?.nome || "Automação Chrome";
  name.title = name.textContent;
  open.append(top, name);
  open.addEventListener("click", () => {
    if (expandedAutomationByPage.get(selectedPageId) === id) closeExpandedAutomation();
    else unfoldAutomationCard(id, item.getBoundingClientRect());
  });

  const meta = document.createElement("div");
  meta.className = "automation-tile-meta";
  const count = document.createElement("span");
  count.textContent = (automation.steps?.length || 0) + " blocos";
  const status = document.createElement("span");
  status.className = "automation-tile-status";
  status.textContent = statusLabel;
  meta.append(count, status);

  const progress = document.createElement("div");
  progress.className = "automation-tile-progress";
  progress.setAttribute("role", "progressbar");
  progress.setAttribute("aria-label", `Progresso de ${name.textContent}`);
  progress.setAttribute("aria-valuemin", "0");
  progress.setAttribute("aria-valuemax", "100");
  progress.setAttribute("aria-valuenow", String(percent));
  const progressValue = document.createElement("span");
  progressValue.className = "automation-tile-percent";
  progressValue.textContent = percent + "%";
  const track = document.createElement("span");
  track.className = "automation-tile-track";
  const fill = document.createElement("span");
  fill.className = "automation-tile-fill";
  fill.style.width = percent + "%";
  track.append(fill);
  progress.append(progressValue, track);

  const action = document.createElement("button");
  action.type = "button";
  action.className = "automation-tile-action";
  action.classList.toggle("is-stop", running);
  action.textContent = running ? "■ Parar" : starting ? "Iniciando…" : "▶ Executar";
  action.setAttribute("aria-label", `${running ? "Parar" : "Executar"} ${name.textContent}`);
  action.disabled = busy && !running;
  action.title = running ? "Parar somente esta execução"
    : busy ? "Aguarde o término da execução atual desta página" : "Executar nesta página sem abrir os detalhes";
  action.addEventListener("click", () => {
    if (running) {
      chrome.runtime.sendMessage({ type: "flowdetect-stop", runId: pageRun.id, pageId })
        .then((result) => { if (result?.ok === false) throw Error(result.error || "Falha ao parar."); })
        .catch((error) => pageFeedback(`${page?.name || "Página"}: ${error.message || error}`));
      return;
    }
    runFromCompactCard(automation, pageId)
      .catch((error) => pageFeedback(`${page?.name || "Página"}: ${error.message || error}`));
  });
  tile.append(open, meta, progress, action);
  tile.addEventListener("click", (event) => {
    if (event.target.closest("button")) return;
    if (expandedAutomationByPage.get(selectedPageId) === id) closeExpandedAutomation();
    else unfoldAutomationCard(id, item.getBoundingClientRect());
  });
  item.append(tile);

  if (isExpanded) {
    const fragment = renderAutomation(automation, true);
    const card = fragment.querySelector(".automation-card");
    card.classList.add("automation-flip-detail");
    card.dataset.automationId = id;
    // Assisted execution lives in its own workspace, never below settings.
    card.querySelector(".execution")?.remove();
    card.querySelector(".resume-run-button")?.remove();
    installCardSettings(card, `${pageId}:${id}`);
    const lastRun = pageRuns.get(pageId);
    if (String(lastRun?.automationId || "") === id) {
      const watch = document.createElement("button");
      watch.type = "button";
      watch.className = "automation-open-assist";
      watch.textContent = "◉ Assistir execução · " + runProgress(lastRun).percent + "%";
      watch.addEventListener("click", () => setWorkspaceView("assisted"));
      card.append(watch);
    }
    const close = document.createElement("button");
    close.type = "button";
    close.className = "automation-flip-close";
    close.textContent = "←";
    close.title = "Recolher automação";
    close.setAttribute("aria-label", "Recolher detalhes da automação");
    close.addEventListener("click", closeExpandedAutomation);
    card.querySelector(".automation-card-top").prepend(close);
    item.append(fragment);
  }
  return item;
}

function renderAutomations(automations = automationsCache) {
  automationsCache = Array.isArray(automations) ? automations : [];
  // Execution graphics and live images never displace the automation cards.
  const isRunFocused = false;
  document.body.classList.remove("run-focused");
  automationList.replaceChildren();
  if (workspaceView === "assisted") {
    renderAssistedView();
    return;
  }
  // Legacy global automations belong to Page 1, not every page.
  const defaultPageId = executionPages[0]?.id;
  const displayAutomations = automationsCache.filter((item) => (
    item.pageId === selectedPageId || (!item.pageId && selectedPageId === defaultPageId)
  ));
  if (["running", "waiting_screen"].includes(currentRun.status) && currentRun.automationSnapshot && !displayAutomations.some((item) => String(item.id) === String(currentRun.automationId))) {
    displayAutomations.push(currentRun.automationSnapshot);
  }

  if (!isRunFocused) {
    const header = document.createElement("div");
    header.className = "automation-library-heading";
    const headingTitle = document.createElement("strong");
    headingTitle.textContent = "Automações desta página";
    const headingCount = document.createElement("span");
    headingCount.textContent = displayAutomations.length + " card" + (displayAutomations.length === 1 ? "" : "s");
    header.append(headingTitle, headingCount);
    automationList.append(header);
  }
  if (!displayAutomations.length) {
    const empty = document.createElement("button");
    empty.type = "button";
    empty.className = "empty-state automation-import-card";
    empty.title = "Importar arquivo JSON do FlowDetect para esta página";
    const icon = document.createElement("span");
    icon.className = "automation-import-icon";
    icon.textContent = "+";
    const title = document.createElement("strong");
    title.textContent = "Importar automação";
    const hint = document.createElement("span");
    const page = executionPages.find((page) => page.id === selectedPageId);
    hint.textContent = "Escolha um JSON para " + (page?.name || "esta página") + ".";
    empty.append(icon, title, hint);
    empty.addEventListener("click", () => importInput.click());
    automationList.append(empty);
    return;
  }
  const activeId = String(currentRun?.automationId || "");
  const ordered = displayAutomations.sort((first, second) => (
    Number(String(second.id) === activeId) - Number(String(first.id) === activeId)
  ));
  if (isRunFocused) {
    const automation = ordered.find((item) => String(item.id) === activeId);
    if (automation) automationList.append(renderAutomation(automation));
    return;
  }

  // One automation = one DOM grid item. Expanding transforms that item
  // in-place; the other tiles reflow beneath it.
  for (const automation of ordered) automationList.append(makeAutomationTile(automation));
}


function updateAssistedLiveCount() {
  const count = [...pageRuns.values()].filter((run) => ["running", "waiting_screen"].includes(run?.status)).length;
  const badge = document.querySelector("#assistedLiveCount");
  badge.textContent = String(count);
  badge.hidden = count === 0;
  // Refresh page statuses without resetting the currently visible carousel.
  const selection = document.querySelector("#assistedPageSelect");
  for (const option of selection.options) {
    const page = executionPages.find((item) => item.id === option.value);
    if (!page) continue;
    const live = ["running", "waiting_screen"].includes(pageRuns.get(page.id)?.status);
    option.textContent = page.name + (live ? " · ao vivo" : "");
  }
}

function renderAssistedView() {
  const choice = document.querySelector("#assistedPageSelect");
  const content = document.querySelector("#assistedContent");
  choice.replaceChildren(...executionPages.map((page) => {
    const option = document.createElement("option");
    option.value = page.id;
    const run = pageRuns.get(page.id);
    const live = ["running", "waiting_screen"].includes(run?.status) ? " · ao vivo" : "";
    option.textContent = page.name + live;
    return option;
  }));
  choice.disabled = !executionPages.length;
  choice.value = selectedPageId || "";
  content.replaceChildren();

  const page = executionPages.find((item) => item.id === selectedPageId);
  const run = pageRuns.get(selectedPageId);
  const title = document.createElement("div");
  title.className = "assisted-run-title";
  const copy = document.createElement("strong");
  const note = document.createElement("small");
  const active = ["running", "waiting_screen"].includes(run?.status);
  const statusLabels = {
    running: "Executando agora", waiting_screen: "Aguardando tela",
    completed: "Execução concluída", failed: "Execução com falha", stopped: "Execução interrompida"
  };
  copy.textContent = run?.automationSnapshot?.automation?.nome
    || automationsCache.find((item) => String(item.id) === String(run?.automationId))?.automation?.nome
    || page?.name || "Nenhuma página selecionada";
  note.textContent = run?.id
    ? (statusLabels[run.status] || "Última execução")
    : "Nenhuma execução registrada nesta página";
  copy.title = copy.textContent;
  note.dataset.status = run?.status || "ready";
  note.classList.toggle("is-live", active);
  title.append(copy, note);
  content.append(title);

  if (!run?.id) {
    const empty = document.createElement("div");
    empty.className = "assisted-empty";
    const symbol = document.createElement("span");
    symbol.textContent = "◉";
    const message = document.createElement("strong");
    message.textContent = "Sem execução para acompanhar";
    const hint = document.createElement("p");
    hint.textContent = "Vá até Automações, execute um card e escolha esta página para acompanhar imagens e etapas.";
    const open = document.createElement("button");
    open.type = "button";
    open.textContent = "Ver automações";
    open.addEventListener("click", () => setWorkspaceView("automations"));
    empty.append(symbol, message, hint, open);
    content.append(empty);
    return;
  }

  const automation = run.automationSnapshot
    || automationsCache.find((item) => String(item.id) === String(run.automationId));
  if (!automation || !Array.isArray(automation.steps)) {
    const warning = document.createElement("p");
    warning.className = "assisted-unavailable";
    warning.textContent = "Progresso salvo: " + runProgress(run).percent
      + "%. Não há um fluxo completo disponível para apresentar imagens desta execução.";
    content.append(warning);
    return;
  }

  // Reuse the FlowDetect carousel, visual previews, live steps and report
  // rendering. Only the .execution subtree enters the assisted view.
  const previousManagerState = managerViewRequested;
  managerViewRequested = false;
  let fragment;
  try {
    fragment = renderAutomation(automation);
  } finally {
    managerViewRequested = previousManagerState;
  }
  const monitor = fragment.querySelector(".execution");
  if (!monitor || monitor.hidden) {
    const notice = document.createElement("p");
    notice.className = "assisted-unavailable";
    notice.textContent = "Não foi possível montar as imagens desta execução.";
    content.append(notice);
    return;
  }
  monitor.hidden = false;
  monitor.classList.add("assisted-execution");
  // One title/status row and one action row leave room for recent events.
  const count = monitor.querySelector(".block-carousel-count");
  monitor.querySelector(".block-carousel-top").append(count);
  const report = monitor.querySelector(".report-button");
  report.title = report.textContent;
  report.setAttribute("aria-label", report.textContent);
  report.textContent = "PDF";
  monitor.querySelector(".block-carousel-controls").append(report);
  const history = monitor.querySelector(".run-log-details");
  history.insertBefore(monitor.querySelector(".execution-loop-summary"), history.querySelector(".run-log"));
  history.open = false;
  const historyLink = history.querySelector("summary");
  historyLink.textContent = "Histórico e detalhes ↗";
  historyLink.title = "Abrir o histórico completo em outra aba";
  historyLink.addEventListener("click", (event) => {
    event.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL(`run-details.html?page=${encodeURIComponent(run.pageId)}`) })
      .catch((error) => window.alert(`Não foi possível abrir o histórico: ${error.message}`));
  });
  const legacyManager = monitor.querySelector(".block-carousel-manager");
  if (legacyManager) legacyManager.hidden = true;
  content.append(monitor);
}

function setWorkspaceView(nextView, persist = true) {
  const view = nextView === "assisted" ? "assisted" : "automations";
  const changed = view !== workspaceView;
  if (changed) {
    for (const animation of workspaceAnimations) animation.cancel();
    workspaceAnimations = [];
  }
  workspaceView = view;
  const assisted = view === "assisted";
  document.querySelector(".app-shell").dataset.workspace = view;
  document.querySelector("#automationList").hidden = assisted;
  document.querySelector("#assistedView").hidden = !assisted;
  for (const [name, id] of [["automations", "workspaceAutomations"], ["assisted", "workspaceAssisted"]]) {
    const control = document.querySelector("#" + id);
    const selected = view === name;
    control.classList.toggle("is-active", selected);
    control.setAttribute("aria-selected", String(selected));
  }
  if (persist) chrome.storage.session.set({ flowdetectWorkspaceView: view }).catch(() => {});
  renderAutomations();
  // Animate only a deliberate workspace switch, never a live progress update.
  if (changed && persist && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const selectors = assisted ? ["#assistedView"] : [".execution-pages", "#automationList"];
    workspaceAnimations = selectors.map((selector) => document.querySelector(selector).animate([
      { opacity: 0, transform: "translateY(4px)" },
      { opacity: 1, transform: "translateY(0)" }
    ], { duration: 180, easing: "cubic-bezier(.22, 1, .36, 1)" }));
  }
}

document.querySelector("#workspaceAutomations").addEventListener("click", () => setWorkspaceView("automations"));
document.querySelector("#workspaceAssisted").addEventListener("click", () => setWorkspaceView("assisted"));
document.querySelector("#assistedPageSelect").addEventListener("change", (event) => selectExecutionPage(event.target.value));


importInput.addEventListener("change", async () => {
  const files = Array.from(importInput.files || []);
  importInput.value = "";
  if (!files.length) return;
  const targetPageId = selectedPageId;
  try {
    if (!executionPages.some((page) => page.id === targetPageId)) {
      throw new Error("Selecione uma página antes de importar automações.");
    }
    const imports = await Promise.all(files.map(async (file) =>
      normalizeImportedAutomation(JSON.parse(await file.text()), targetPageId)
    ));
    await setAutomations([...(await getAutomations()), ...imports]);
    if (targetPageId === selectedPageId) renderAutomations(await getAutomations());
  } catch (error) {
    window.alert(String(error.message || error));
  }
});

newButton.addEventListener("click", async () => {
  const nome = window.prompt("Nome da automacao:", "Nova automacao Chrome");
  if (!nome) return;
  const automation = normalizeImportedAutomation({
    schema: "flowdetect_chrome_automation",
    version: 3,
    automation: { nome, descricao: "Rascunho criado no FlowDetect Chrome.", source: "FlowDetect Chrome" },
    steps: [],
    warnings: []
  });
  await setAutomations([...(await getAutomations()), automation]);
});

mapElementButton.addEventListener("click", async () => {
  mapElementButton.disabled = true;
  mapElementStatus.hidden = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id || !/^https?:\/\//i.test(tab.url || "")) {
      throw new Error("Abra uma pagina HTTP/HTTPS no Chrome para mapear um elemento.");
    }
    const result = await chrome.tabs.sendMessage(tab.id, { type: "flowdetect-map-element-v1" });
    if (!result?.ok) throw new Error(result?.error || "A pagina nao iniciou o mapeamento.");
    window.close();
  } catch (error) {
    mapElementStatus.textContent = /Receiving end does not exist|Could not establish connection|message port closed/i.test(String(error))
      ? "Recarregue a pagina e tente novamente."
      : String(error?.message || error);
    mapElementStatus.hidden = false;
  } finally {
    mapElementButton.disabled = false;
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes[PAGES_KEY]) {
    executionPages = changes[PAGES_KEY].newValue || [];
    if (!executionPages.some((page) => page.id === selectedPageId)) {
      selectExecutionPage(executionPages[0]?.id || null);
    } else {
      renderExecutionPages();
    }
  }
  for (const [key, change] of Object.entries(changes)) {
    if (key.startsWith(PAGE_RUN_PREFIX) && change.newValue) updateRun(change.newValue);
  }
  if (changes[AUTOMATIONS_KEY]) renderAutomations(changes[AUTOMATIONS_KEY].newValue || []);
  const downloadChange = changes[`flowdetectDownloadStatus:${currentRun.downloadRouteId}`];
  if (downloadChange) {
    lastDownloadStatus = downloadChange.newValue || null;
    refreshDownloadActivity();
  }
});

function reconcileStoredRun(run, runtime) {
  if (!["running", "waiting_screen"].includes(run?.status) ||
      !Array.isArray(runtime?.activeRunIds) || runtime.activeRunIds.includes(run.id)) return run;
  return { ...run, status: "stopped", finishedAt: new Date().toISOString(), waitingReason: "" };
}

Promise.all([getAutomations(), chrome.storage.session.get("flowdetectSelectedPage"),
  chrome.runtime.sendMessage({ type: "flowdetect-pages" }),
  chrome.storage.session.get("flowdetectWorkspaceView")])
  .then(async ([automations, storage, state, storedWorkspace]) => {
    automationsCache = automations;
    if (!state?.ok || !Array.isArray(state.pages)) throw new Error("Recarregue a extensão em chrome://extensions para usar as páginas de execução.");
    executionPages = state.pages;
    for (const [id, run] of Object.entries(state.runs || {})) {
      pageRuns.set(id, run);
      // The history remains visible as a percentage on its compact card after
      // the popup is reopened; do not force a full-screen execution view.
      if (run?.automationId) galleryRunPages.add(id);
    }
    const selected = executionPages.find((page) => page.id === storage.flowdetectSelectedPage) || executionPages[0];
    setWorkspaceView(storedWorkspace?.flowdetectWorkspaceView || "automations", false);
    selectExecutionPage(selected?.id || null);
  }).catch(pageFeedback);

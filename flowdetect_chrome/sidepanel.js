const AUTOMATIONS_KEY = "flowdetectChromeAutomations";
const RUN_STORAGE_KEY = "flowdetectChromeLastRun";
const REQUIRED_RUNTIME_VERSION = "0.2.53";
const automationList = document.querySelector("#automationList");
const automationTemplate = document.querySelector("#automationTemplate");
const importInput = document.querySelector("#importInput");
const newButton = document.querySelector("#newButton");
const mapElementButton = document.querySelector("#mapElementButton");
const mapElementStatus = document.querySelector("#mapElementStatus");
let automationsCache = [];
let currentRun = {};
const screenGuardRefreshers = new Set();
const carouselStates = new Map();
const companyPreviewRows = new Map();
const expandedRunLogs = new Set();
let managerViewRequested = false;

function refreshScreenGuards() {
  for (const refresh of screenGuardRefreshers) refresh(true);
}

const getAutomations = async () => (await chrome.storage.local.get(AUTOMATIONS_KEY))[AUTOMATIONS_KEY] || [];
const setAutomations = async (automations) => chrome.storage.local.set({ [AUTOMATIONS_KEY]: automations });

function normalizeImportedAutomation(raw) {
  const version = Number(raw?.version);
  if (!raw || raw.schema !== "flowdetect_chrome_automation" || ![1, 2, 3].includes(version) || !Array.isArray(raw.steps)) {
    throw new Error("Escolha um arquivo JSON exportado pelo FlowDetect Studio para Chrome.");
  }
  return {
    ...raw,
    id: crypto.randomUUID(),
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

function renderLiveSteps(container, automation, run) {
  const list = container.querySelector(".live-steps-list");
  const saved = Array.isArray(run.recentSteps) ? run.recentSteps.slice(-3).reverse() : [];
  const fallbackIndex = Number(run.currentIndex ?? run.lastBlockIndex);
  const entries = saved.length ? saved : Number(run.currentStep || 0) > 0 && Number.isInteger(fallbackIndex)
    ? [{ index: fallbackIndex, state: run.status === "running" ? "running"
      : run.status === "failed" ? "failed" : run.status === "stopped" ? "stopped" : "done" }] : [];
  const states = { running: "Executando", done: "Concluído", failed: "Falhou", stopped: "Parado" };
  container.querySelector(".live-steps-count").textContent = ["running", "waiting_screen"].includes(run.status)
    ? "Atualizando" : "Últimas etapas";
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
    item.append(number, title, status);
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
    slide.classList.remove("flip-in", "failure-shake", "terminal-failure", "success-shake");
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
    const showingSuccess = feedback?.type === "success" && feedback.index === state.index;
    const feedbackElement = container.querySelector(".block-carousel-feedback");
    feedbackElement.hidden = !feedback;
    if (feedback) {
      const feedbackStep = steps[feedback.index];
      const blockNumber = String(feedbackStep?.source_order || feedback.index + 1).padStart(2, "0");
      const result = feedback.type === "success" ? "Encontrado"
        : feedbackStep?.type === "ocr_text" ? "Não encontrado" : "Falhou";
      feedbackElement.textContent = `B${blockNumber} · ${result}`;
      feedbackElement.dataset.tone = feedback.type === "success" ? "success" : "failed";
    }
    const status = showingFailure ? (step.type === "ocr_text" ? "Não encontrado" : "Falhou · redirecionando")
      : showingSuccess ? "Encontrado" : state.index !== activeIndex ? "No fluxo" :
      run.status === "running" ? "Executando" : run.status === "completed" ? "Concluído" :
      run.status === "failed" ? "Falhou" : run.status === "stopped" ? "Parado" : "Aguardando";
    const statusElement = container.querySelector(".block-carousel-state");
    statusElement.textContent = status;
    statusElement.dataset.status = showingFailure ? "failed" : showingSuccess ? "completed"
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
      const progressState = showingFailure ? "failed" : showingSuccess ? "success"
        : currentOcrStep?.state === "failed" ? "failed"
          : currentOcrStep?.state === "done" ? "success" : "searching";
      ocrProgress.dataset.state = progressState;
      ocrProgress.querySelector(".block-carousel-ocr-label").textContent = progressState === "failed"
        ? "Texto não encontrado" : progressState === "success" ? "Texto encontrado" : "Procurando e analisando OCR…";
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
      slide.classList.add("failure-shake");
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
  return String(value || "").trim().toLocaleLowerCase();
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
  const source = (automation?.steps || []).find((step) => (
    step?.type === "data_source" && Array.isArray(step.values) && step.values.length
  ));
  if (!source) return null;
  const name = String(source.name || "valor").trim() || "valor";
  const rows = Array.isArray(source.rows) ? source.rows : [];
  return {
    name,
    total: source.values.length,
    values: source.values.map((value) => String(value ?? "")),
    rows,
    columns: spreadsheetLoopColumns(rows, name)
  };
}

function spreadsheetCompanyLabel(loop, index) {
  const row = loop?.rows?.[index];
  const companyColumn = loop?.columns?.find((column) => normalizedSpreadsheetColumn(column) === "empresa")
    || loop?.columns?.find((column) => normalizedSpreadsheetColumn(column) === "razao social")
    || loop?.columns?.find((column) => normalizedSpreadsheetColumn(column) === "razão social");
  return spreadsheetLoopCellValue(row, companyColumn)
    || String(loop?.values?.[index] ?? "").trim()
    || "(sem nome)";
}

function loopDisplayColumn(automation, loop) {
  const columns = Array.isArray(loop?.columns) ? loop.columns : [];
  const requested = String(automation?.ui?.loopDisplayColumn || "").trim();
  const find = (value) => columns.find((column) => normalizedSpreadsheetColumn(column) === normalizedSpreadsheetColumn(value));
  return find(requested) || find("Empresa") || find(loop?.name) || columns[0] || "";
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

function screenGuardFromForm(form) {
  const enabled = form.querySelector(".screen-guard-enabled").checked;
  const text = form.querySelector(".screen-guard-text").value.trim();
  let url = form.querySelector(".screen-guard-url").value.trim();
  if (enabled) {
    let parsed;
    try { parsed = new URL(url); } catch (_) { throw new Error("Informe uma URL valida para a tela da automacao."); }
    if (!["http:", "https:"].includes(parsed.protocol) || !text) throw new Error("Informe a URL HTTP/HTTPS e o texto esperado na tela.");
    parsed.search = "";
    url = parsed.href;
  }
  return { enabled, url, text };
}

async function saveScreenGuard(automation, form) {
  const guard = screenGuardFromForm(form);
  const updated = { ...automation, screen_guard: guard };
  const stored = await getAutomations();
  await setAutomations(stored.map((item) => String(item.id) === String(automation.id) ? updated : item));
  automation.screen_guard = guard;
  return updated;
}

function clampSpreadsheetStartRow(value, total) {
  const parsed = Math.trunc(Number(value));
  return Math.min(Math.max(1, Number.isFinite(parsed) ? parsed : 1), Math.max(1, Number(total) || 1));
}

async function runAutomation(automation, startRow = 1) {
  if (!await ensureCurrentRuntime()) return;
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) throw new Error("Abra a pagina onde deseja executar a automacao.");
  if (automation.screen_guard?.enabled) {
    const screen = await chrome.runtime.sendMessage({ type: "flowdetect-screen-ready", screenGuard: automation.screen_guard, tabId: tab.id });
    if (!screen?.ready) throw new Error(screen?.reason || "Aguardando tela da automacao.");
  }
  const loop = spreadsheetLoopInfo(automation);
  const selectedStartRow = loop ? clampSpreadsheetStartRow(startRow, loop.total) : 1;
  managerViewRequested = false;
  companyPreviewRows.delete(String(automation.id));
  currentRun = {
    automationId: automation.id,
    automationName: automation.automation?.nome,
    status: "running",
    currentStep: 0,
    totalSteps: loop ? automation.steps.length * (loop.total - selectedStartRow + 1) : automation.steps.length,
    recentSteps: [],
    logs: [{ level: "info", message: loop ? `Iniciando na linha ${selectedStartRow} de ${loop.total}.` : "Iniciando automacao." }]
  };
  renderAutomations();
  const response = await chrome.runtime.sendMessage({ type: "flowdetect-start", automation, tabId: tab.id, startRow: selectedStartRow });
  if (response?.run) {
    updateRun(response.run);
    return response.run;
  }
  if (!response?.ok) throw new Error(response?.run?.logs?.at(-1)?.message || response?.error || "A automacao falhou.");
  return response;
}

function updateRun(run = {}) {
  if (["running", "waiting_screen"].includes(run?.status)
      && String(run?.id || "") !== String(currentRun?.id || "")) managerViewRequested = false;
  if (hasFinishedRun(run?.status) && !hasFinishedRun(currentRun?.status)) {
    const state = carouselStates.get(String(run?.automationId || ""));
    if (state) state.following = true;
  }
  currentRun = run || {};
  renderAutomations();
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
  currentRun = updated;
  await chrome.storage.local.set({ [RUN_STORAGE_KEY]: updated });
  renderAutomations();
}

async function deleteAutomation(automation) {
  const nome = automation?.automation?.nome || "esta automacao";
  if (!window.confirm(`Excluir "${nome}"? Essa acao nao pode ser desfeita.`)) return;

  const isCurrent = String(currentRun?.automationId || "") === String(automation.id);
  if (isCurrent && ["running", "waiting_screen"].includes(currentRun?.status)) {
    await chrome.runtime.sendMessage({ type: "flowdetect-stop" }).catch(() => null);
  }

  const remaining = (await getAutomations()).filter((item) => String(item.id) !== String(automation.id));
  await setAutomations(remaining);

  if (isCurrent) {
    currentRun = {};
    await chrome.storage.local.remove(RUN_STORAGE_KEY);
    renderAutomations(remaining);
  }
}

function renderAutomation(automation) {
  const fragment = automationTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".automation-card");
  fragment.querySelector(".automation-source").textContent = automation.automation?.source || "FLOWDETECT";
  fragment.querySelector(".automation-name").textContent = automation.automation?.nome || "Automacao Chrome";
  fragment.querySelector(".step-count").textContent = `${automation.steps.length} blocos`;
  const busy = ["running", "waiting_screen"].includes(currentRun?.status);
  const guardForm = fragment.querySelector(".screen-guard-form");
  const guard = automation.screen_guard || {};
  guardForm.querySelector(".screen-guard-enabled").checked = Boolean(guard.enabled);
  guardForm.querySelector(".screen-guard-url").value = guard.url || "";
  guardForm.querySelector(".screen-guard-text").value = guard.text || "";
  fragment.querySelector(".screen-guard-state").textContent = guard.enabled ? "Ativa" : "Desativada";
  guardForm.querySelector("fieldset").disabled = busy;
  const runButton = fragment.querySelector(".run-automation");
  const screenHint = fragment.querySelector(".screen-guard-hint");
  let checkVersion = 0;
  let lastGuardKey = "";
  const refreshGuard = async (invalidate = false) => {
    const version = ++checkVersion;
    if (invalidate) lastGuardKey = "";
    if (busy) { runButton.disabled = true; screenHint.hidden = true; return; }
    let configured;
    try { configured = screenGuardFromForm(guardForm); } catch (error) {
      runButton.disabled = true; screenHint.hidden = false; screenHint.textContent = error.message; return;
    }
    screenHint.hidden = !configured.enabled;
    if (!configured.enabled) { runButton.disabled = false; runButton.title = ""; return; }
    const key = JSON.stringify(configured);
    if (key !== lastGuardKey) { runButton.disabled = true; screenHint.textContent = "Identificando a tela da automacao..."; }
    lastGuardKey = key;
    const screen = await chrome.runtime.sendMessage({ type: "flowdetect-screen-ready", screenGuard: configured }).catch(() => null);
    if (version !== checkVersion || !runButton.isConnected) return;
    runButton.disabled = !screen?.ready;
    runButton.title = screen?.reason || "Aguardando tela da automacao.";
    screenHint.textContent = screen?.reason || "Aguardando tela da automacao.";
    screenHint.classList.toggle("ready", Boolean(screen?.ready));
  };
  const invalidateGuard = () => { lastGuardKey = ""; refreshGuard(); };
  screenGuardRefreshers.add(refreshGuard);
  guardForm.addEventListener("input", invalidateGuard);
  runButton.disabled = busy || Boolean(guard.enabled);
  guardForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveScreenGuard(automation, guardForm).catch((error) => window.alert(error.message));
  });
  fragment.querySelector(".screen-guard-current").addEventListener("click", async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const url = new URL(tab?.url || "");
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("Abra a pagina da automacao para usar sua URL.");
      url.search = "";
      guardForm.querySelector(".screen-guard-url").value = url.href;
      guardForm.querySelector(".screen-guard-enabled").checked = true;
      invalidateGuard();
    } catch (error) { window.alert(error.message); }
  });
  const loop = spreadsheetLoopInfo(automation);
  const loopStart = fragment.querySelector(".loop-start");
  const loopStartChoice = fragment.querySelector(".loop-start-choice");
  if (loop) {
    loopStart.hidden = false;
    loopStartChoice.replaceChildren(...loop.values.map((value, index) => {
      const option = document.createElement("option");
      option.value = String(index + 1);
      option.textContent = `#${index + 1} - ${value || "(vazio)"}`;
      return option;
    }));
    loopStartChoice.value = "1";
  }

  const isCurrent = String(currentRun?.automationId || "") === String(automation.id);
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
    if (loop?.total) {
      const companyField = fragment.querySelector(".execution-company");
      const companyChoice = fragment.querySelector(".execution-company-choice");
      const companyPosition = fragment.querySelector(".execution-company-position");
      const liveRow = Number(currentRun.spreadsheetLoop?.row);
      const hasLiveRow = currentRun.spreadsheetLoop && Number.isInteger(liveRow) && liveRow >= 0 && liveRow < loop.total;
      const liveName = hasLiveRow ? spreadsheetCompanyLabel(loop, liveRow) : "Aguardando empresa";
      const followOption = document.createElement("option");
      followOption.value = "";
      followOption.textContent = hasLiveRow ? `Atual · ${liveName}` : "Acompanhar empresa atual";
      companyChoice.replaceChildren(followOption, ...loop.values.map((_, index) => {
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = `#${index + 1} · ${spreadsheetCompanyLabel(loop, index)}`;
        return option;
      }));
      const previewRow = companyPreviewRows.get(String(automation.id));
      companyChoice.value = Number.isInteger(previewRow) && previewRow >= 0 && previewRow < loop.total ? String(previewRow) : "";
      companyChoice.title = "A escolha altera somente a visualização; a automação continua na ordem normal.";
      companyPosition.textContent = hasLiveRow ? `${liveRow + 1}/${loop.total}` : `${loop.total} no total`;
      companyChoice.addEventListener("change", () => {
        if (companyChoice.value === "") companyPreviewRows.delete(String(automation.id));
        else companyPreviewRows.set(String(automation.id), Number(companyChoice.value));
      });
      companyField.hidden = false;
    }
    renderBlockCarousel(fragment.querySelector(".block-carousel"), automation, currentRun);
    renderLiveSteps(fragment.querySelector(".live-steps"), automation, currentRun);
    const executionSummary = fragment.querySelector(".execution-summary");
    const executionColumnLabel = fragment.querySelector(".execution-column-label");
    const executionColumnChoice = fragment.querySelector(".execution-column-choice");
    const refreshExecutionLoopSummary = () => {
      if (status === "waiting_screen") {
        executionSummary.textContent = "Aguardando tela da automacao";
        executionSummary.title = currentRun.waitingReason || "URL e texto esperado ainda nao foram confirmados.";
        return;
      }
      if (!loop?.columns?.length) {
        executionSummary.textContent = "Preparando execucao";
        return;
      }
      const selectedColumn = loopDisplayColumn(automation, loop);
      executionColumnChoice.value = selectedColumn;
      if (status === "completed") {
        executionSummary.textContent = "Todas as linhas processadas";
        executionSummary.title = "Automação concluída";
        return;
      }
      const value = currentLoopDisplayValue(currentRun, loop, selectedColumn);
      executionSummary.textContent = value || "Aguardando a próxima linha";
      executionSummary.title = `${selectedColumn}: ${value || "Aguardando a próxima linha"}`;
    };
    if (loop?.columns?.length) {
      executionColumnLabel.hidden = false;
      const selectedColumn = loopDisplayColumn(automation, loop);
      executionColumnChoice.replaceChildren(...loop.columns.map((column) => {
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
    stop.addEventListener("click", () => chrome.runtime.sendMessage({ type: "flowdetect-stop" }));
    const managerButton = fragment.querySelector(".block-carousel-manager");
    managerButton.hidden = !hasFinishedRun(status);
    managerButton.addEventListener("click", () => { managerViewRequested = true; renderAutomations(); });
    const reportButton = fragment.querySelector(".report-button");
    const canGenerateReport = hasFinishedRun(status);
    reportButton.hidden = !canGenerateReport;
    if (canGenerateReport) {
      reportButton.textContent = currentRun.reportGeneratedAt ? "Gerar novo relatório PDF" : "Gerar relatório PDF";
      reportButton.addEventListener("click", () => downloadExecutionReport(currentRun).catch((error) => {
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

  fragment.querySelector(".run-automation").addEventListener("click", () => {
    const startRow = loop ? clampSpreadsheetStartRow(loopStartChoice.value, loop.total) : 1;
    return saveScreenGuard(automation, guardForm).then((configured) => runAutomation(configured, startRow)).catch((error) => {
      if (!["running", "waiting_screen"].includes(currentRun?.status)) {
        screenHint.hidden = false;
        screenHint.textContent = String(error.message || error);
        invalidateGuard();
        return;
      }
      updateRun({
        automationId: automation.id,
        automationName: automation.automation?.nome,
        status: "failed",
        totalSteps: automation.steps.length,
        currentStep: 0,
        logs: [{ level: "error", message: String(error.message || error) }]
      });
    });
  });
  fragment.querySelector(".delete-automation").addEventListener("click", () => deleteAutomation(automation).catch((error) => {
    window.alert(`Nao foi possivel excluir a automacao: ${String(error.message || error)}`);
  }));
  return fragment;
}

function renderAutomations(automations = automationsCache) {
  screenGuardRefreshers.clear();
  automationsCache = Array.isArray(automations) ? automations : [];
  document.body.classList.toggle("run-focused", !managerViewRequested
    && Boolean(currentRun?.automationId)
    && ["running", "waiting_screen", "completed", "failed", "stopped"].includes(currentRun?.status));
  automationList.replaceChildren();
  if (!automationsCache.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = 'Nenhuma automacao importada. Use + Adicionar automacao.';
    automationList.append(empty);
    return;
  }
  const activeId = String(currentRun?.automationId || "");
  const ordered = [...automationsCache].sort((first, second) => (
    Number(String(second.id) === activeId) - Number(String(first.id) === activeId)
  ));
  ordered.forEach((automation) => automationList.append(renderAutomation(automation)));
  refreshScreenGuards();
}

chrome.tabs.onActivated?.addListener(refreshScreenGuards);
chrome.tabs.onUpdated?.addListener(refreshScreenGuards);
chrome.windows?.onFocusChanged?.addListener(refreshScreenGuards);
setInterval(() => { for (const refresh of screenGuardRefreshers) refresh(); }, 1000);

importInput.addEventListener("change", async () => {
  const file = importInput.files?.[0];
  importInput.value = "";
  if (!file) return;
  try {
    const imported = normalizeImportedAutomation(JSON.parse(await file.text()));
    await setAutomations([...(await getAutomations()), imported]);
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
  if (changes[RUN_STORAGE_KEY]) updateRun(changes[RUN_STORAGE_KEY].newValue || {});
  if (changes[AUTOMATIONS_KEY]) renderAutomations(changes[AUTOMATIONS_KEY].newValue || []);
});

function reconcileStoredRun(run, runtime) {
  if (!["running", "waiting_screen"].includes(run?.status) ||
      !Array.isArray(runtime?.activeRunIds) || runtime.activeRunIds.includes(run.id)) return run;
  return { ...run, status: "stopped", finishedAt: new Date().toISOString(), waitingReason: "" };
}

Promise.all([getAutomations(), chrome.storage.local.get(RUN_STORAGE_KEY),
  chrome.runtime.sendMessage({ type: "flowdetect-runtime-info" }).catch(() => null)])
  .then(async ([automations, storage, runtime]) => {
    automationsCache = automations;
    const storedRun = storage[RUN_STORAGE_KEY] || {};
    currentRun = reconcileStoredRun(storedRun, runtime);
    if (currentRun !== storedRun) await chrome.storage.local.set({ [RUN_STORAGE_KEY]: currentRun });
    renderAutomations();
  });

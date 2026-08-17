const tauriCore = window.__TAURI__?.core ?? null;
const tauriEvent = window.__TAURI__?.event ?? null;
const tauriDialog = window.__TAURI__?.dialog ?? null;

const FLOWDETECT_WINDOW_PATTERN = /flowdetect/i;

const state = {
  library: [],
  selectedAutomationId: "",
  roadmap: null,
  selectedTarget: null,
  windows: [],
  running: false,
  progress: {
    percent: 0,
    company: "",
    line: "",
    block: "Aguardando",
  },
  logs: [],
};

const elements = {
  automationName: document.getElementById("automationName"),
  automationDescription: document.getElementById("automationDescription"),
  importZipButton: document.getElementById("importZipButton"),
  refreshButton: document.getElementById("refreshButton"),
  targetTitle: document.getElementById("targetTitle"),
  targetDescription: document.getElementById("targetDescription"),
  targetChip: document.getElementById("targetChip"),
  refreshWindowsButton: document.getElementById("refreshWindowsButton"),
  clearTargetButton: document.getElementById("clearTargetButton"),
  windowList: document.getElementById("windowList"),
  statusTitle: document.getElementById("statusTitle"),
  progressPercent: document.getElementById("progressPercent"),
  progressFill: document.getElementById("progressFill"),
  companyText: document.getElementById("companyText"),
  lineText: document.getElementById("lineText"),
  blockText: document.getElementById("blockText"),
  delayInput: document.getElementById("delayInput"),
  loopStartInput: document.getElementById("loopStartInput"),
  runButton: document.getElementById("runButton"),
  stopButton: document.getElementById("stopButton"),
  logList: document.getElementById("logList"),
};

function invoke(command, payload = {}) {
  if (typeof tauriCore?.invoke !== "function") {
    throw new Error("API do Tauri indisponivel.");
  }
  return tauriCore.invoke(command, payload);
}

async function listen(eventName, handler) {
  if (typeof tauriEvent?.listen !== "function") {
    return null;
  }
  try {
    return await tauriEvent.listen(eventName, handler);
  } catch (error) {
    console.warn(`Falha ao ouvir ${eventName}`, error);
    return null;
  }
}

async function openFileDialog(options = {}) {
  if (typeof tauriDialog?.open !== "function") {
    throw new Error("Seletor de arquivos indisponivel.");
  }
  return tauriDialog.open(options);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function pushLog(message, type = "info") {
  const text = String(message || "").trim();
  if (!text) return;
  state.logs.unshift({ text, type, at: new Date() });
  state.logs = state.logs.slice(0, 20);
  renderLogs();
}

function selectedAutomation() {
  return state.library.find((item) => String(item.id) === String(state.selectedAutomationId)) || null;
}

function normalizeWindow(item) {
  return {
    hwnd: Number(item?.hwnd || 0),
    title: String(item?.title || "").trim(),
    class_name: String(item?.class_name || item?.className || "").trim(),
    left: Number(item?.left || 0),
    top: Number(item?.top || 0),
    width: Number(item?.width || 0),
    height: Number(item?.height || 0),
  };
}

function isFlowDetectWindow(item) {
  return FLOWDETECT_WINDOW_PATTERN.test(`${item?.title || ""} ${item?.class_name || ""}`);
}

function renderAutomation() {
  const automation = selectedAutomation();
  if (!automation) {
    elements.automationName.textContent = "Nenhuma automacao carregada";
    elements.automationDescription.textContent = "Importe um ZIP gerado pelo Studio para executar esta tarefa neste computador.";
    elements.runButton.disabled = true;
    return;
  }
  const totalBlocks = Number(automation.total_blocos || automation.total_blocks || automation.comandos || 0);
  const updated = automation.updated_at || automation.atualizado_em || automation.updatedAt || "";
  elements.automationName.textContent = automation.nome || automation.name || "Automacao FlowDetect";
  elements.automationDescription.textContent = `${totalBlocks || "Alguns"} blocos prontos para executar.${updated ? ` Atualizada em ${updated}.` : ""}`;
  elements.runButton.disabled = state.running;
}

function renderTarget() {
  const target = state.selectedTarget;
  if (!target) {
    elements.targetTitle.textContent = "Tela inteira";
    elements.targetChip.textContent = "Opcional";
    elements.targetDescription.textContent = "Nenhuma janela travada. Recomendado selecionar a janela onde a tarefa vai rodar.";
    return;
  }
  elements.targetTitle.textContent = target.title || "Janela selecionada";
  elements.targetChip.textContent = "Borda azul ativa";
  elements.targetDescription.textContent = `A automacao vai procurar e clicar nesta janela. hwnd ${target.hwnd}`;
}

function renderProgress() {
  const percent = Math.max(0, Math.min(100, Number(state.progress.percent || 0)));
  elements.progressPercent.textContent = `${Math.round(percent)}%`;
  elements.progressFill.style.width = `${percent}%`;
  elements.companyText.textContent = state.progress.company || "-";
  elements.lineText.textContent = state.progress.line || "-";
  elements.blockText.textContent = state.progress.block || "Aguardando";
  elements.statusTitle.textContent = state.running ? "Executando" : percent >= 100 ? "Concluida" : "Pronto";
}

function renderWindows() {
  elements.windowList.hidden = false;
  if (!state.windows.length) {
    elements.windowList.innerHTML = `<div class="runner-log-item">Nenhuma janela visivel encontrada.</div>`;
    return;
  }
  elements.windowList.innerHTML = state.windows
    .map((item, index) => `
      <button class="runner-button runner-window-item" type="button" data-window-index="${index}">
        ${escapeHtml(item.title)}
      </button>
    `)
    .join("");
}

function renderLogs() {
  elements.logList.innerHTML = state.logs.length
    ? state.logs
        .map((item) => `<div class="runner-log-item is-${escapeHtml(item.type)}">${escapeHtml(item.text)}</div>`)
        .join("")
    : `<div class="runner-log-item">Aguardando acao.</div>`;
}

function updateButtons() {
  elements.runButton.disabled = state.running || !state.selectedAutomationId;
  elements.stopButton.disabled = !state.running;
  elements.importZipButton.disabled = state.running;
  elements.refreshButton.disabled = state.running;
}

async function refreshLibrary(preferredId = "") {
  const result = await invoke("list_saved_automations");
  state.library = Array.isArray(result?.items) ? result.items : [];
  const preferred = String(preferredId || "").trim();
  if (preferred && state.library.some((item) => String(item.id) === preferred)) {
    state.selectedAutomationId = preferred;
  } else if (!state.selectedAutomationId && state.library.length) {
    state.selectedAutomationId = String(state.library[0].id || "");
  } else if (!state.library.some((item) => String(item.id) === String(state.selectedAutomationId))) {
    state.selectedAutomationId = state.library[0]?.id || "";
  }
  renderAutomation();
  updateButtons();
}

async function importZip() {
  const selected = await openFileDialog({
    multiple: false,
    directory: false,
    filters: [{ name: "Automacao FlowDetect", extensions: ["zip"] }],
  });
  if (!selected || Array.isArray(selected)) return;
  pushLog("Importando automacao...");
  const result = await invoke("import_saved_automation_zip_from_file_path", { filePath: selected });
  const importedId = result?.active_automation?.id || result?.imported_id || result?.importedId || "";
  await refreshLibrary(importedId);
  pushLog(`Automacao importada: ${result?.active_automation?.nome || "ZIP FlowDetect"}`, "success");
}

async function refreshWindows() {
  const result = await invoke("list_open_windows");
  const items = Array.isArray(result?.items) ? result.items : [];
  state.windows = items.map(normalizeWindow).filter((item) => item.hwnd > 0 && item.title && !isFlowDetectWindow(item));
  renderWindows();
  pushLog(state.windows.length ? `${state.windows.length} janela(s) encontrada(s).` : "Nenhuma janela encontrada.");
}

async function selectWindow(index) {
  const target = state.windows[index];
  if (!target) return;
  await invoke("show_target_window_overlay", {
    hwnd: target.hwnd,
    title: target.title,
  });
  state.selectedTarget = target;
  elements.windowList.hidden = true;
  renderTarget();
  pushLog(`Janela alvo selecionada: ${target.title}`, "success");
}

async function clearTarget() {
  await invoke("hide_target_window_overlay", { clearTarget: true });
  state.selectedTarget = null;
  renderTarget();
  pushLog("Janela alvo removida. A automacao usara a tela inteira.");
}

async function runAutomation() {
  const automation = selectedAutomation();
  if (!automation) {
    pushLog("Importe uma automacao antes de executar.", "error");
    return;
  }
  const delay = Number(elements.delayInput.value || 0);
  const loopStart = Number(elements.loopStartInput.value || 1);
  const windowTitle = state.selectedTarget?.title || "";
  state.running = true;
  state.progress = { percent: 0, company: "", line: "", block: "Iniciando" };
  renderProgress();
  updateButtons();
  pushLog("Execucao iniciada. Nao use mouse nem teclado ate finalizar.", "success");
  const opened = await invoke("open_saved_automation", { id: String(automation.id) });
  const hasSpreadsheet = Number(opened?.summary?.spreadsheet_blocks || automation.spreadsheet_blocks || automation.total_planilhas || 0) > 0;
  const command = hasSpreadsheet ? "launch_assisted_loop_test" : "launch_assisted_quick_test";
  const payload = hasSpreadsheet
    ? { delay, loopStart: Number.isFinite(loopStart) ? Math.max(1, Math.trunc(loopStart)) : 1, windowTitle, textOverrides: "" }
    : { delay, windowTitle, textOverrides: "" };
  const message = await invoke(command, payload);
  pushLog(message || "Automacao em execucao.");
}

async function stopAutomation() {
  const message = await invoke("stop_test_execution");
  pushLog(message || "Parada solicitada.");
}

function applyProgress(payload = {}) {
  state.running = true;
  state.progress.percent = Number(payload.percent || 0);
  state.progress.company = String(payload.company || "").trim();
  state.progress.line = payload.line ? String(payload.line) : "";
  state.progress.block = String(payload.description || "").replace(/^Iteracao\s+\d+\/\d+\s+-\s+/i, "");
  renderProgress();
  updateButtons();
}

function applyFinished(success, code) {
  state.running = false;
  if (success) {
    state.progress.percent = 100;
    state.progress.block = "Finalizada";
  }
  invoke("hide_target_window_overlay", { clearTarget: false }).catch(() => {});
  renderProgress();
  updateButtons();
  pushLog(success ? "Automacao finalizada com sucesso." : `Execucao encerrada com codigo ${code}.`, success ? "success" : "error");
}

function bindEvents() {
  elements.importZipButton.addEventListener("click", () => importZip().catch((error) => pushLog(error.message || error, "error")));
  elements.refreshButton.addEventListener("click", () => refreshLibrary().catch((error) => pushLog(error.message || error, "error")));
  elements.refreshWindowsButton.addEventListener("click", () => refreshWindows().catch((error) => pushLog(error.message || error, "error")));
  elements.clearTargetButton.addEventListener("click", () => clearTarget().catch((error) => pushLog(error.message || error, "error")));
  elements.windowList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-window-index]");
    if (!button) return;
    selectWindow(Number(button.dataset.windowIndex)).catch((error) => pushLog(error.message || error, "error"));
  });
  elements.runButton.addEventListener("click", () => runAutomation().catch((error) => {
    state.running = false;
    renderProgress();
    updateButtons();
    pushLog(error.message || error, "error");
  }));
  elements.stopButton.addEventListener("click", () => stopAutomation().catch((error) => pushLog(error.message || error, "error")));
}

async function init() {
  bindEvents();
  window.addEventListener("beforeunload", () => {
    invoke("hide_target_window_overlay", { clearTarget: false }).catch(() => {});
  });
  renderLogs();
  renderTarget();
  renderProgress();
  await listen("test-progress", (event) => applyProgress(event.payload || {}));
  await listen("test-log", (event) => pushLog(event.payload?.message || event.payload || ""));
  await listen("test-execution-state", (event) => {
    state.running = Boolean(event.payload?.running);
    renderProgress();
    updateButtons();
  });
  await listen("test-finished", (event) => applyFinished(Boolean(event.payload?.success), Number(event.payload?.code || 0)));
  await refreshLibrary();
}

init().catch((error) => pushLog(error.message || error, "error"));

const tauriCore = window.__TAURI__?.core ?? null;
const tauriEvent = window.__TAURI__?.event ?? null;
window.__GENERATOR_MAIN_READY = true;

async function invoke(command, payload) {
  if (typeof tauriCore?.invoke !== "function") {
    throw new Error("API do Tauri indisponivel na interface do gerador.");
  }
  return tauriCore.invoke(command, payload);
}

async function safeListen(eventName, handler) {
  if (typeof tauriEvent?.listen !== "function") {
    return null;
  }

  try {
    return await tauriEvent.listen(eventName, handler);
  } catch (error) {
    console.warn(`Nao foi possivel registrar o evento ${eventName}.`, error);
    return null;
  }
}

const state = {
  roadmap: null,
  workbook: null,
  workbookPreview: null,
  activeTab: "launcher",
  commandMapZoom: 1.08,
  commandMapFocusOrder: null,
  commandMapSave: {
    running: false,
    percent: 0,
    status: "Mapa ainda nao salvo.",
    dirty: false,
  },
  assist: {
    mode: "idle",
    current: 0,
    total: 0,
    percent: 0,
    description: "",
    company: "",
    windowTitle: "",
    currentOrder: null,
    success: null,
    logs: [],
  },
  assistPlayback: {
    running: false,
    timer: null,
    token: 0,
    mode: "idle",
  },
  testLaunchPending: false,
  insertPanel: null,
  captureTarget: null,
  captureBlurTimer: null,
  captureSequence: 0,
  imageImportTarget: null,
  draggingOrder: null,
  dragTargetIndex: null,
  dragPointerId: null,
  dragPreviewEl: null,
  dragOffsetX: 0,
  dragOffsetY: 0,
  workbookSearch: "",
  composerWorkbookId: "",
  previewWorkbookId: "",
  workbookSelectedSheet: "",
  workbookSelectedColumn: "",
  workbookSelectedCell: null,
  testLoopData: null,
  openWindows: [],
  library: {
    items: [],
    activeId: "",
    categories: [],
    search: "",
    category: "",
    createdFrom: "",
    updatedFrom: "",
    sort: "updated_desc",
    createOpen: false,
    createDraft: {
      nome: "",
      categoria: "",
      descricao: "",
    },
    editingId: "",
    editDraft: {
      nome: "",
      categoria: "",
      descricao: "",
    },
    filtersOpen: false,
    dirty: false,
  },
};

const builderShell = document.querySelector(".builder-shell");
const timelineList = document.getElementById("timelineList");
const commandMapList = document.getElementById("commandMapList");
const messageBar = document.getElementById("messageBar");
const timelineMeta = document.getElementById("timelineMeta");
const commandMapMeta = document.getElementById("commandMapMeta");
const builderStatus = document.getElementById("builderStatus");
const totalBlocks = document.getElementById("totalBlocks");
const textBlocks = document.getElementById("textBlocks");
const keyBlocks = document.getElementById("keyBlocks");
const spreadsheetBlocks = document.getElementById("spreadsheetBlocks");
const exportNameInput = document.getElementById("exportNameInput");
const testDelayInput = document.getElementById("testDelayInput");
const testLoopStartInput = document.getElementById("testLoopStartInput");
const testWindowTitleInput = document.getElementById("testWindowTitleInput");
const refreshWindowsButton = document.getElementById("refreshWindowsButton");
const testLoopHint = document.getElementById("testLoopHint");
const bulkDelayInput = document.getElementById("bulkDelayInput");
const applyBulkDelayButton = document.getElementById("applyBulkDelayButton");
const mapBulkDelayInput = document.getElementById("mapBulkDelayInput");
const mapApplyBulkDelayButton = document.getElementById("mapApplyBulkDelayButton");
const mapSaveButton = document.getElementById("mapSaveButton");
const mapSavePercent = document.getElementById("mapSavePercent");
const mapSaveFill = document.getElementById("mapSaveFill");
const mapSaveStatus = document.getElementById("mapSaveStatus");
const testOnceButton = document.getElementById("testOnceButton");
const testAutomationButton = document.getElementById("testAutomationButton");
const stopTestButton = document.getElementById("stopTestButton");
const assistTabButton = document.getElementById("assistTabButton");
const captureOverlay = document.getElementById("captureOverlay");
const captureOverlayText = document.getElementById("captureOverlayText");
const cancelCaptureButton = document.getElementById("cancelCaptureButton");
const editorTabButton = document.getElementById("editorTabButton");
const commandTabButton = document.getElementById("commandTabButton");
const workbookTabButton = document.getElementById("workbookTabButton");
const launcherTabButton = document.getElementById("launcherTabButton");
const launcherPanel = document.getElementById("launcherPanel");
const editorPanel = document.getElementById("editorPanel");
const assistPanel = document.getElementById("assistPanel");
const commandsPanel = document.getElementById("commandsPanel");
const mapPrevButton = document.getElementById("mapPrevButton");
const mapNextButton = document.getElementById("mapNextButton");
const workbookPanel = document.getElementById("workbookPanel");
const mapZoomOutButton = document.getElementById("mapZoomOutButton");
const mapZoomInButton = document.getElementById("mapZoomInButton");
const mapZoomRange = document.getElementById("mapZoomRange");
const mapZoomValue = document.getElementById("mapZoomValue");
const assistDelayInput = document.getElementById("assistDelayInput");
const assistLoopStartInput = document.getElementById("assistLoopStartInput");
const assistWindowTitleInput = document.getElementById("assistWindowTitleInput");
const refreshAssistWindowsButton = document.getElementById("refreshAssistWindowsButton");
const assistQuickButton = document.getElementById("assistQuickButton");
const assistLoopButton = document.getElementById("assistLoopButton");
const assistStopButton = document.getElementById("assistStopButton");
const assistStatusText = document.getElementById("assistStatusText");
const assistDetailText = document.getElementById("assistDetailText");
const assistOriginText = document.getElementById("assistOriginText");
const assistWindowText = document.getElementById("assistWindowText");
const assistWindowDetailText = document.getElementById("assistWindowDetailText");
const assistCompanyText = document.getElementById("assistCompanyText");
const assistModeText = document.getElementById("assistModeText");
const assistPercentText = document.getElementById("assistPercentText");
const assistProgressFill = document.getElementById("assistProgressFill");
const assistProgressMeta = document.getElementById("assistProgressMeta");
const assistMapList = document.getElementById("assistMapList");
const assistLogList = document.getElementById("assistLogList");
const workbookMeta = document.getElementById("workbookMeta");
const workbookFilesTabs = document.getElementById("workbookFilesTabs");
const addWorkbookButton = document.getElementById("addWorkbookButton");
const workbookFileInput = document.getElementById("workbookFileInput");
const imageFileInput = document.getElementById("imageFileInput");
const workbookSheetSelect = document.getElementById("workbookSheetSelect");
const workbookSearchInput = document.getElementById("workbookSearchInput");
const workbookRowsInfo = document.getElementById("workbookRowsInfo");
const workbookTableWrap = document.getElementById("workbookTableWrap");
const selectedWorkbookTitle = document.getElementById("selectedWorkbookTitle");
const selectedWorkbookSubtitle = document.getElementById("selectedWorkbookSubtitle");
const selectedWorkbookValue = document.getElementById("selectedWorkbookValue");
const selectedWorkbookColumnTitle = document.getElementById("selectedWorkbookColumnTitle");
const selectedWorkbookColumnSubtitle = document.getElementById("selectedWorkbookColumnSubtitle");
const workbookTextDelay = document.getElementById("workbookTextDelay");
const addWorkbookCellButton = document.getElementById("addWorkbookCellButton");
const workbookLoopDelay = document.getElementById("workbookLoopDelay");
const workbookAfterAction = document.getElementById("workbookAfterAction");
const workbookAfterActionCaptureButton = document.getElementById("workbookAfterActionCaptureButton");
const workbookBetweenItems = document.getElementById("workbookBetweenItems");
const addWorkbookColumnButton = document.getElementById("addWorkbookColumnButton");
const launcherList = document.getElementById("launcherList");
const launcherMeta = document.getElementById("launcherMeta");
const launcherSearchInput = document.getElementById("launcherSearchInput");
const launcherCategoryFilter = document.getElementById("launcherCategoryFilter");
const launcherCreatedFromInput = document.getElementById("launcherCreatedFromInput");
const launcherUpdatedFromInput = document.getElementById("launcherUpdatedFromInput");
const launcherSortInput = document.getElementById("launcherSortInput");
const launcherFiltersToggleButton = document.getElementById("launcherFiltersToggleButton");
const launcherExtraFilters = document.getElementById("launcherExtraFilters");
const newAutomationButton = document.getElementById("newAutomationButton");
const launcherCreatePanel = document.getElementById("launcherCreatePanel");
const newAutomationNameInput = document.getElementById("newAutomationNameInput");
const newAutomationCategoryInput = document.getElementById("newAutomationCategoryInput");
const newAutomationDescriptionInput = document.getElementById("newAutomationDescriptionInput");
const confirmCreateAutomationButton = document.getElementById("confirmCreateAutomationButton");
const cancelCreateAutomationButton = document.getElementById("cancelCreateAutomationButton");
const launcherCategorySuggestions = document.getElementById("launcherCategorySuggestions");
const windowSuggestions = document.getElementById("windowSuggestions");

const textInput = document.getElementById("textInput");
const textDelay = document.getElementById("textDelay");
const sequenceContextInput = document.getElementById("sequenceContextInput");
const keyInput = document.getElementById("keyInput");
const keyDelay = document.getElementById("keyDelay");
const keyRepeatInput = document.getElementById("keyRepeatInput");
const mouseXInput = document.getElementById("mouseXInput");
const mouseYInput = document.getElementById("mouseYInput");
const mouseButtonInput = document.getElementById("mouseButtonInput");
const mouseClicksInput = document.getElementById("mouseClicksInput");
const captureMouseButton = document.getElementById("captureMouseButton");
const mouseDelay = document.getElementById("mouseDelay");
const imagePathInput = document.getElementById("imagePathInput");
const selectImageButton = document.getElementById("selectImageButton");
const testImageRecognitionButton = document.getElementById("testImageRecognitionButton");
const imageTimeoutInput = document.getElementById("imageTimeoutInput");
const imageConfidenceInput = document.getElementById("imageConfidenceInput");
const imageSearchProfileInput = document.getElementById("imageSearchProfileInput");
const imageWindowTitleInput = document.getElementById("imageWindowTitleInput");
const refreshImageWindowsButton = document.getElementById("refreshImageWindowsButton");
const imageClickModeInput = document.getElementById("imageClickModeInput");
const imageFailureActionInput = document.getElementById("imageFailureActionInput");
const imageFailureBlockInput = document.getElementById("imageFailureBlockInput");
const imageRetryCountInput = document.getElementById("imageRetryCountInput");
const imageRetryIntervalInput = document.getElementById("imageRetryIntervalInput");
const imageDelayInput = document.getElementById("imageDelayInput");
const chromeBlockNameInput = document.getElementById("chromeBlockNameInput");
const chromeHtmlInput = document.getElementById("chromeHtmlInput");
const analyzeChromeHtmlButton = document.getElementById("analyzeChromeHtmlButton");
const chromeAnalysisJsonInput = document.getElementById("chromeAnalysisJsonInput");
const chromeHtmlPreview = document.getElementById("chromeHtmlPreview");
const chromeTargetMethodInput = document.getElementById("chromeTargetMethodInput");
const chromeTargetValueInput = document.getElementById("chromeTargetValueInput");
const chromeActionTypeInput = document.getElementById("chromeActionTypeInput");
const chromeValueSourceInput = document.getElementById("chromeValueSourceInput");
const chromeActionValueInput = document.getElementById("chromeActionValueInput");
const chromeSaveAsInput = document.getElementById("chromeSaveAsInput");
const chromeTimeoutInput = document.getElementById("chromeTimeoutInput");
const chromePressAfterInput = document.getElementById("chromePressAfterInput");
const chromeSuccessActionInput = document.getElementById("chromeSuccessActionInput");
const chromeSuccessBlockInput = document.getElementById("chromeSuccessBlockInput");
const chromeFailureActionInput = document.getElementById("chromeFailureActionInput");
const chromeFailureBlockInput = document.getElementById("chromeFailureBlockInput");
const chromeRetryCountInput = document.getElementById("chromeRetryCountInput");
const chromeRetryIntervalInput = document.getElementById("chromeRetryIntervalInput");
const chromeClearBeforeInput = document.getElementById("chromeClearBeforeInput");
const chromeFallbackVisualInput = document.getElementById("chromeFallbackVisualInput");
const chromeFallbackImageInput = document.getElementById("chromeFallbackImageInput");
const selectChromeFallbackImageButton = document.getElementById("selectChromeFallbackImageButton");
const chromeDelayInput = document.getElementById("chromeDelayInput");
const addChromeHtmlButton = document.getElementById("addChromeHtmlButton");
const verifyNameInput = document.getElementById("verifyNameInput");
const verifyActiveImageInput = document.getElementById("verifyActiveImageInput");
const verifyInactiveImageInput = document.getElementById("verifyInactiveImageInput");
const selectVerifyActiveImageButton = document.getElementById("selectVerifyActiveImageButton");
const selectVerifyInactiveImageButton = document.getElementById("selectVerifyInactiveImageButton");
const verifyTimeoutInput = document.getElementById("verifyTimeoutInput");
const verifyConfidenceInput = document.getElementById("verifyConfidenceInput");
const verifyActiveActionInput = document.getElementById("verifyActiveActionInput");
const verifyActiveSequenceInput = document.getElementById("verifyActiveSequenceInput");
const verifyInactiveActionInput = document.getElementById("verifyInactiveActionInput");
const verifyInactiveSequenceInput = document.getElementById("verifyInactiveSequenceInput");
const verifyMissingActionInput = document.getElementById("verifyMissingActionInput");
const verifyMissingSequenceInput = document.getElementById("verifyMissingSequenceInput");
const verifyDelayInput = document.getElementById("verifyDelayInput");
const composerWorkbookSelect = document.getElementById("composerWorkbookSelect");
const sheetSelect = document.getElementById("sheetSelect");
const columnSelect = document.getElementById("columnSelect");
const afterActionInput = document.getElementById("afterActionInput");
const afterActionCaptureButton = document.getElementById("afterActionCaptureButton");
const betweenItemsInput = document.getElementById("betweenItemsInput");
const spreadsheetDelay = document.getElementById("spreadsheetDelay");

if (messageBar) {
  messageBar.textContent = "main.js carregado. Inicializando interface...";
}

window.addEventListener("error", (event) => {
  const text = `Erro de interface: ${event.message || "falha desconhecida"}`;
  if (messageBar) {
    messageBar.textContent = text;
    messageBar.classList.remove("is-success");
    messageBar.classList.add("is-error");
  }
  console.error(event.error || event.message || event);
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason instanceof Error ? event.reason.message : String(event.reason || "promessa rejeitada");
  const text = `Erro async da interface: ${reason}`;
  if (messageBar) {
    messageBar.textContent = text;
    messageBar.classList.remove("is-success");
    messageBar.classList.add("is-error");
  }
  console.error(event.reason || event);
});

function setTestExecutionState(running) {
  const active = Boolean(running);
  stopTestButton.disabled = !active;
  assistStopButton.disabled = !active;
  if (active) {
    builderStatus.textContent = "Executando teste";
  } else if (builderStatus.textContent === "Executando teste") {
    builderStatus.textContent = "Pronto";
  }
}

function isTestExecutionActive() {
  return !stopTestButton.disabled || !assistStopButton.disabled;
}

function triggerSuccessPulse(button) {
  if (!button) {
    return;
  }
  button.classList.remove("button-confirm-pulse");
  void button.offsetWidth;
  button.classList.add("button-confirm-pulse");
  window.setTimeout(() => {
    button.classList.remove("button-confirm-pulse");
  }, 1200);
}

function hasUnsavedEditorChanges() {
  return Boolean(state.library?.dirty);
}

function confirmLeaveEditorIfDirty() {
  if (!hasUnsavedEditorChanges()) {
    return true;
  }
  return window.confirm("Existem alteracoes nao salvas. Deseja continuar mesmo assim?");
}

function setWorkspaceTab(tabName) {
  if (tabName === "editor") {
    tabName = "commands";
  }
  if (tabName === "launcher" && state.activeTab !== "launcher" && !confirmLeaveEditorIfDirty()) {
    return;
  }
  state.activeTab = tabName;
  const launcherActive = tabName === "launcher";
  const editorActive = tabName === "editor";
  const assistActive = tabName === "assist";
  const commandsActive = tabName === "commands";
  const workbookActive = tabName === "workbook";
  launcherTabButton.classList.toggle("is-active", launcherActive);
  editorTabButton.classList.toggle("is-active", editorActive);
  assistTabButton.classList.toggle("is-active", assistActive);
  commandTabButton.classList.toggle("is-active", commandsActive);
  workbookTabButton.classList.toggle("is-active", workbookActive);
  launcherPanel.classList.toggle("is-active", launcherActive);
  editorPanel.classList.toggle("is-active", editorActive);
  assistPanel.classList.toggle("is-active", assistActive);
  commandsPanel.classList.toggle("is-active", commandsActive);
  workbookPanel.classList.toggle("is-active", workbookActive);
  builderShell?.classList.toggle("is-launcher-active", launcherActive);
  builderShell?.classList.toggle("is-commands-active", commandsActive);
  builderShell?.classList.toggle("is-workbook-active", workbookActive);
  builderShell?.classList.toggle("is-assist-active", assistActive);
  if (commandsActive && state.commandMapFocusOrder) {
    requestAnimationFrame(() => centerCommandMapOrder(state.commandMapFocusOrder, "auto"));
  }
}

function applyCommandMapZoom() {
  const zoomPercent = Math.round(state.commandMapZoom * 100);
  commandMapList.style.setProperty("--command-map-zoom", String(state.commandMapZoom));
  if (mapZoomRange) {
    mapZoomRange.value = String(zoomPercent);
  }
  if (mapZoomValue) {
    mapZoomValue.textContent = `${zoomPercent}%`;
  }
}

function setCommandMapZoom(nextZoom) {
  state.commandMapZoom = Math.min(1.5, Math.max(0.85, Number(nextZoom) || 1));
  applyCommandMapZoom();
  if (state.activeTab === "commands" && state.commandMapFocusOrder) {
    requestAnimationFrame(() => centerCommandMapOrder(state.commandMapFocusOrder, "auto"));
  }
}

function getCommandMapOrders() {
  return (state.roadmap?.events ?? []).map((event) => Number(event.order)).filter((order) => Number.isFinite(order));
}

function updateCommandMapNavButtons() {
  const orders = getCommandMapOrders();
  const currentIndex = orders.indexOf(Number(state.commandMapFocusOrder));
  const hasOrders = orders.length > 0;
  if (mapPrevButton) {
    mapPrevButton.disabled = !hasOrders || currentIndex <= 0;
  }
  if (mapNextButton) {
    mapNextButton.disabled = !hasOrders || currentIndex < 0 || currentIndex >= orders.length - 1;
  }
}

function moveCommandMapFocus(step) {
  const orders = getCommandMapOrders();
  if (!orders.length) {
    return;
  }

  const currentIndex = Math.max(0, orders.indexOf(Number(state.commandMapFocusOrder)));
  const nextIndex = Math.min(orders.length - 1, Math.max(0, currentIndex + step));
  const nextOrder = orders[nextIndex];
  if (nextOrder == null || nextOrder === state.commandMapFocusOrder) {
    return;
  }
  setCommandMapFocus(nextOrder);
}

function syncTestInputsFrom(source) {
  const delayValue = source === "assist" ? assistDelayInput.value : testDelayInput.value;
  const loopValue = source === "assist" ? assistLoopStartInput.value : testLoopStartInput.value;
  const windowValue = source === "assist" ? assistWindowTitleInput.value : testWindowTitleInput.value;
  testDelayInput.value = delayValue;
  assistDelayInput.value = delayValue;
  testLoopStartInput.value = loopValue;
  assistLoopStartInput.value = loopValue;
  testWindowTitleInput.value = windowValue;
  assistWindowTitleInput.value = windowValue;
  updateTestLoopHint();
}

function getConfiguredWindowTitle(fromAssist = false) {
  const raw = fromAssist ? assistWindowTitleInput?.value : testWindowTitleInput?.value;
  return String(raw || "").trim();
}

function renderWindowSuggestions() {
  if (!windowSuggestions) {
    return;
  }

  const items = state.openWindows || [];
  windowSuggestions.innerHTML = items
    .map((item) => `<option value="${escapeHtml(item.title || "")}"></option>`)
    .join("");
}

async function refreshOpenWindows(feedbackMessage = "") {
  const result = await invoke("list_open_windows");
  state.openWindows = Array.isArray(result?.items) ? result.items : [];
  renderWindowSuggestions();
  if (feedbackMessage) {
    setMessage(feedbackMessage, "success");
  }
}

async function runImageRecognitionTest(values, options = {}) {
  const imagePath = String(values?.imagePath || "").trim();
  if (!imagePath) {
    setMessage("Selecione uma referencia visual antes de testar o reconhecimento.", "error");
    return;
  }

  const inheritWindowFallback = options.inheritWindowFallback !== false;
  const ownWindowTitle = String(values?.windowTitle || "").trim();
  const resolvedWindowTitle =
    ownWindowTitle ||
    (inheritWindowFallback
      ? String(imageWindowTitleInput?.value || "").trim() ||
        String(assistWindowTitleInput?.value || "").trim() ||
        String(testWindowTitleInput?.value || "").trim()
      : "") ||
    null;

  try {
    setBusy("Testando reconhecimento");
    setMessage(
      inheritWindowFallback
        ? "Testando somente o bloco de reconhecimento..."
        : "Testando o bloco no estado atual da tela, usando apenas os dados dele.",
      "info"
    );
    const result = await invoke("test_image_recognition", {
      imagem: imagePath,
      timeout: parseNumber(values.timeout, 10),
      confianca: parseNumber(values.confidence, 0.8),
      perfilBusca: normalizeRecognitionProfile(values.searchProfile, "balanced"),
      janelaAlvo: resolvedWindowTitle,
    });
    setBusy("Pronto");
    setMessage(result || "Reconhecimento testado com sucesso.", "success");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
}

function extractOrderFromDescription(description) {
  const match = String(description || "").match(/Evento\s+#(\d+)/i);
  return match ? Number(match[1]) : null;
}

function updateAssistProgressUI() {
  const assist = state.assist;
  assistStatusText.textContent =
    assist.mode === "running"
      ? `Executando ${assist.current}/${assist.total || 0}`
      : assist.mode === "done"
        ? "Concluido"
        : assist.mode === "failed"
          ? "Falha"
        : assist.mode === "stopped"
          ? "Interrompido"
          : "Pronto";
  assistDetailText.textContent =
    assist.description || (assist.mode === "idle" ? "Aguardando inicio de um teste." : "Sem detalhes da execucao.");
  assistOriginText.textContent = "Criador de automacoes";
  assistWindowText.textContent = assist.windowTitle || "Aguardando captura";
  assistWindowDetailText.textContent =
    assist.windowTitle
      ? "Janela capturada pelo executor real da automacao."
      : "A janela ativa sera mostrada assim que o teste comecar.";
  assistCompanyText.textContent = assist.company || "-";
  assistModeText.textContent =
    assist.mode === "running"
      ? "A trilha fica verde conforme a execucao avanca."
      : assist.mode === "done"
        ? "Ultimo teste finalizado com sucesso."
        : assist.mode === "failed"
          ? "A execucao terminou com erro. Veja a ultima mensagem exibida."
        : assist.mode === "stopped"
          ? "Execucao interrompida pelo launcher."
          : "Modo assistido pronto para acompanhar a execucao.";
  assistPercentText.textContent = `${Math.round(assist.percent || 0)}%`;
  assistProgressFill.style.width = `${Math.max(0, Math.min(100, assist.percent || 0))}%`;
  assistProgressMeta.textContent =
    assist.total > 0 ? `${assist.current}/${assist.total} passos observados.` : "Nenhum passo em execucao.";
}

function renderAssistLogs() {
  if (!assistLogList) {
    return;
  }
  const logs = Array.isArray(state.assist.logs) ? state.assist.logs : [];
  if (!logs.length) {
    assistLogList.innerHTML = `<div class="assist-log-line is-muted">Aguardando logs da execucao...</div>`;
    return;
  }
  assistLogList.innerHTML = logs
    .slice(-18)
    .map(
      (entry) => `
        <div class="assist-log-line${entry.kind ? ` is-${escapeHtml(entry.kind)}` : ""}">
          ${escapeHtml(entry.message || "")}
        </div>
      `
    )
    .join("");
  assistLogList.scrollTop = assistLogList.scrollHeight;
}

function pushAssistLog(message, kind = "info") {
  const text = String(message || "").trim();
  if (!text) {
    return;
  }
  state.assist.logs = [...(state.assist.logs || []), { message: text, kind }].slice(-80);
  renderAssistLogs();
}

function renderAssistExecutionMap() {
  const events = state.roadmap?.events ?? [];
  assistMapList.innerHTML = "";

  if (!events.length) {
    assistMapList.innerHTML = `<div class="empty-state">Adicione blocos ao roteiro para acompanhar a execucao assistida aqui.</div>`;
    return;
  }

  const activeOrder = state.assist.currentOrder;
  const activeIndex = events.findIndex((event) => Number(event.order) === Number(activeOrder));
  const showProgress = activeIndex >= 0 && state.assist.mode !== "idle";

  const markup = events
    .map((event, index) => {
      const isDone = showProgress && index < activeIndex;
      const isCurrent = showProgress && index === activeIndex;
      const stateClass = isCurrent ? "is-current" : isDone ? "is-done" : "is-upcoming";
      const connectorClass =
        showProgress && index < activeIndex
          ? "is-done"
          : showProgress && index === activeIndex - 1
            ? "is-current"
            : "is-upcoming";

      const card = `
        <article class="assist-card ${stateClass}" data-assist-order="${Number(event.order)}">
          <div class="assist-card-top">
            <span class="assist-card-index">${String(event.order).padStart(2, "0")}</span>
            <span class="assist-card-chip">${escapeHtml(event.type.replaceAll("_", " "))}</span>
          </div>
          <h3>${escapeHtml(event.title)}</h3>
          <p>${escapeHtml(event.subtitle)}</p>
        </article>
      `;

      if (index === events.length - 1) {
        return `${card}<div class="assist-end ${state.assist.mode === "done" ? "is-done" : ""}">Fim</div>`;
      }

      return `
        ${card}
        <div class="assist-connector ${connectorClass}">
          <span></span>
        </div>
      `;
    })
    .join("");

  assistMapList.innerHTML = `<div class="assist-flow-row">${markup}</div>`;
  requestAnimationFrame(() => centerAssistOrder(state.assist.currentOrder, state.assist.mode === "running" ? "smooth" : "auto"));
}

function centerAssistOrder(order, behavior = "smooth") {
  if (!assistMapList || order == null) {
    return;
  }

  const target = assistMapList.querySelector(`[data-assist-order="${Number(order)}"]`);
  if (!target) {
    return;
  }

  const containerRect = assistMapList.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const currentScrollLeft = assistMapList.scrollLeft;
  const delta = (targetRect.left + targetRect.width / 2) - (containerRect.left + containerRect.width / 2);
  const left = Math.max(0, currentScrollLeft + delta);

  assistMapList.scrollTo({
    left,
    behavior,
  });
}

function resetAssistState(mode = "idle") {
  state.assist = {
    mode,
    current: 0,
    total: 0,
    percent: 0,
    description: "",
    company: "",
    windowTitle: "",
    currentOrder: mode === "running" ? null : state.roadmap?.events?.[0]?.order ?? null,
    success: null,
    logs: [],
  };
  updateAssistProgressUI();
  renderAssistLogs();
  renderAssistExecutionMap();
}

function clearAssistPlaybackTimer() {
  if (state.assistPlayback.timer) {
    clearTimeout(state.assistPlayback.timer);
    state.assistPlayback.timer = null;
  }
}

function stopAssistPlayback() {
  clearAssistPlaybackTimer();
  state.assistPlayback.running = false;
  state.assistPlayback.mode = "idle";
  state.assistPlayback.steps = [];
  state.assistPlayback.index = 0;
}

function formatAssistValue(value, max = 40) {
  const text = String(value ?? "").replaceAll("\n", " ").replaceAll("\r", " ").trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function getSpreadsheetEventValues(event) {
  const values = event?.details?.values ?? event?.detalhes?.valores ?? [];
  return Array.isArray(values) ? values : [];
}

function describeAssistBaseEvent(event, index = null, total = null, value = null) {
  if (!event) {
    return "Passo da automacao";
  }

  const order = Number(event.order || event.ordem || 0);
  const type = String(event.type || event.tipo || "");
  const details = event.details || event.detalhes || {};

  if (type === "texto_livre") {
    return `Evento #${order}: texto ${formatAssistValue(event.text || event.texto || "", 28)}`;
  }

  if (type === "tecla" || type === "atalho") {
    const keys = Array.isArray(event.keys || event.teclas) ? (event.keys || event.teclas) : [];
    const label = keys.join(" + ") || formatAssistValue(event.text || event.texto || "tecla", 24);
    return `Evento #${order}: ${label}`;
  }

  if (type === "mouse_click") {
    const button = String(details.button || details.botao || "left").toUpperCase();
    const x = Number(details.x || 0);
    const y = Number(details.y || 0);
    const clicks = Number(details.clicks || details.cliques || 1);
    return `Evento #${order}: mouse ${button} ${clicks === 2 ? "duplo" : "simples"} X=${x} Y=${y}`;
  }

  if (type === "sequencia_planilha") {
    const column = String(details.column || details.coluna || "coluna");
    const totalItems = total ?? getSpreadsheetEventValues(event).length;
    if (index != null) {
      return `Evento #${order}: ${column} ${index + 1}/${totalItems} (${formatAssistValue(value ?? "", 22)})`;
    }
    return `Evento #${order}: sequencia da coluna ${column}`;
  }

  return `Evento #${order}: ${formatAssistValue(event.text || event.texto || "acao", 28)}`;
}

function buildAssistSimulationSteps(mode, loopStart) {
  const events = state.roadmap?.events ?? [];
  if (!events.length) {
    return [];
  }

  const steps = [];
  if (mode === "normal") {
    events.forEach((event) => {
      const delayBefore = Math.max(0, parseNumber(event.delay ?? event.intervalo_antes, 0));
      if (event.type === "sequencia_planilha") {
        const details = event.details || event.detalhes || {};
        const values = getSpreadsheetEventValues(event);
        const intervalBetween = Math.max(0, parseNumber(details.interval_between ?? details.intervalo_entre_itens, 0.5));
        values.forEach((value, index) => {
          steps.push({
            order: Number(event.order),
            wait: index === 0 ? delayBefore : intervalBetween,
            company: "",
            description: describeAssistBaseEvent(event, index, values.length, value),
          });
        });
      } else {
        steps.push({
          order: Number(event.order),
          wait: delayBefore,
          company: "",
          description: describeAssistBaseEvent(event),
        });
      }
    });
    return steps;
  }

  const primaryLoopRows = state.testLoopData?.rows ?? [];
  if (!primaryLoopRows.length) {
    throw new Error("Nao ha dados de loop disponiveis para a execucao assistida.");
  }

  let startIndex = primaryLoopRows.findIndex((row) => Number(row.row_number) >= loopStart);
  if (startIndex < 0) {
    const lastLine = primaryLoopRows.at(-1)?.row_number ?? 0;
    throw new Error(`A linha ${loopStart} nao existe nesse loop. Ultima linha disponivel: ${lastLine}.`);
  }

  const iterations = primaryLoopRows.slice(startIndex);
  const totalIterations = iterations.length;

  iterations.forEach((row, iterationIndex) => {
    events.forEach((event) => {
      const delayBefore = Math.max(0, parseNumber(event.delay ?? event.intervalo_antes, 0));
      const details = event.details || event.detalhes || {};
      if (event.type === "sequencia_planilha") {
        const values = getSpreadsheetEventValues(event);
        const relativeIndex = startIndex + iterationIndex;
        const value = values[relativeIndex] ?? row.value ?? "";
        steps.push({
          order: Number(event.order),
          wait: delayBefore,
          company: String(row.company || ""),
          description:
            `Iteracao ${iterationIndex + 1}/${totalIterations} - linha ${row.row_number} - ` +
            describeAssistBaseEvent(event, relativeIndex, values.length || totalIterations, value),
        });
      } else {
        steps.push({
          order: Number(event.order),
          wait: delayBefore,
          company: String(row.company || ""),
          description:
            `Iteracao ${iterationIndex + 1}/${totalIterations} - ${describeAssistBaseEvent(event)}`,
        });
      }
    });
  });

  return steps;
}

function scheduleAssistPlaybackStep(token, delayMs) {
  clearAssistPlaybackTimer();
  state.assistPlayback.timer = setTimeout(() => {
    if (!state.assistPlayback.running || state.assistPlayback.token !== token) {
      return;
    }

    const steps = state.assistPlayback.steps || [];
    const index = state.assistPlayback.index || 0;
    const step = steps[index];
    if (!step) {
      state.assist.mode = "done";
      state.assist.success = true;
      state.assist.current = state.assist.total;
      state.assist.percent = 100;
      state.assist.description = "Execucao assistida concluida.";
      updateAssistProgressUI();
      renderAssistExecutionMap();
      stopAssistPlayback();
      setTestExecutionState(false);
      return;
    }

    state.assist.mode = "running";
    state.assist.currentOrder = step.order;
    state.assist.current = index + 1;
    state.assist.total = steps.length;
    state.assist.percent = (state.assist.current / state.assist.total) * 100;
    state.assist.company = step.company || "";
    state.assist.description = step.description || "Executando etapa da automacao.";
    updateAssistProgressUI();
    renderAssistExecutionMap();

    state.assistPlayback.index = index + 1;
    const nextDelay = Math.max(140, Math.round((Number(step.wait || 0) || 0) * 1000));
    scheduleAssistPlaybackStep(token, nextDelay);
  }, Math.max(0, delayMs));
}

function startAssistPlayback(mode, initialDelaySeconds, loopStart = 1) {
  const steps = buildAssistSimulationSteps(mode, loopStart);
  const token = Date.now();
  state.assistPlayback.token = token;
  state.assistPlayback.running = true;
  state.assistPlayback.mode = mode;
  state.assistPlayback.steps = steps;
  state.assistPlayback.index = 0;
  state.assist.total = steps.length;
  state.assist.current = 0;
  state.assist.percent = 0;
  state.assist.currentOrder = state.roadmap?.events?.[0]?.order ?? null;
  updateAssistProgressUI();
  renderAssistExecutionMap();
  scheduleAssistPlaybackStep(token, Math.max(0, initialDelaySeconds) * 1000);
}


  async function startQuickTestExecution(forceAssist = false) {
    try {
      await persistCommandMapDraftsForExecution();

      if (state.testLaunchPending) {
        setMessage("Ja existe um disparo de teste em andamento.", "error");
        return;
    }
    if (isTestExecutionActive()) {
      setMessage("Ja existe uma automacao em execucao. Pare a atual antes de iniciar outra.", "error");
      return;
    }

    const fromAssist = forceAssist || assistPanel.classList.contains("is-active");
    const delay = parseNumber(fromAssist ? assistDelayInput.value : testDelayInput.value, 0);
    const windowTitle = getConfiguredWindowTitle(fromAssist);
    syncTestInputsFrom(fromAssist ? "assist" : "top");
    state.testLaunchPending = true;
    setMessage("Clique detectado: iniciando teste simples...", "info");
    setBusy("Iniciando teste");
    setTestExecutionState(true);
    resetAssistState("running");
    if (windowTitle) {
      state.assist.windowTitle = windowTitle;
    }
    state.assist.description = `Voce tem ${delay}s para focar a janela onde a automacao deve executar.`;
    updateAssistProgressUI();
    pushAssistLog(`Teste simples iniciado. Atraso inicial: ${delay}s.`, "info");
    const result = fromAssist
      ? await invoke("launch_assisted_quick_test", { delay, windowTitle: windowTitle || null })
      : await invoke("launch_quick_test", { delay, minimizeWindow: true, windowTitle: windowTitle || null });
    setBusy("Pronto");
    setMessage(result, "success");
  } catch (error) {
    setBusy("Erro");
    setTestExecutionState(false);
    stopAssistPlayback();
    resetAssistState("idle");
    setMessage(String(error), "error");
  } finally {
    state.testLaunchPending = false;
  }
}

  async function startLoopTestExecution(forceAssist = false) {
    try {
      await persistCommandMapDraftsForExecution();

      const hasSpreadsheetBlock = (state.roadmap?.events ?? []).some((event) => event.type === "sequencia_planilha");
    if (!hasSpreadsheetBlock) {
      setMessage("Esse roteiro nao possui bloco de planilha. Use 'Testar uma vez' ou o botao 'Testar reconhecimento'.", "error");
      return;
    }

    await refreshTestLoopData();

    if (state.testLaunchPending) {
      setMessage("Ja existe um disparo de teste em andamento.", "error");
      return;
    }
    if (isTestExecutionActive()) {
      setMessage("Ja existe uma automacao em execucao. Pare a atual antes de iniciar outra.", "error");
      return;
    }

    const fromAssist = forceAssist || assistPanel.classList.contains("is-active");
    const delay = parseNumber(fromAssist ? assistDelayInput.value : testDelayInput.value, 0);
    const windowTitle = getConfiguredWindowTitle(fromAssist);
    const loopStart = Math.max(
      1,
      Math.trunc(parseNumber(fromAssist ? assistLoopStartInput.value : testLoopStartInput.value, 1)),
    );
    syncTestInputsFrom(fromAssist ? "assist" : "top");
    state.testLaunchPending = true;
    setMessage("Clique detectado: iniciando teste com loop...", "info");
    setBusy("Iniciando teste com loop");
    setTestExecutionState(true);
    resetAssistState("running");
    if (windowTitle) {
      state.assist.windowTitle = windowTitle;
    }
    state.assist.description =
      `Voce tem ${delay}s para focar a janela da automacao. O loop vai procurar a linha ${loopStart}.`;
    updateAssistProgressUI();
    pushAssistLog(`Teste com loop iniciado. Linha inicial: ${loopStart}. Atraso: ${delay}s.`, "info");
    const result = fromAssist
      ? await invoke("launch_assisted_loop_test", {
          delay,
          loopStart,
          windowTitle: windowTitle || null,
        })
      : await invoke("launch_test_automation", {
          delay,
          loopStart,
          minimizeWindow: true,
          windowTitle: windowTitle || null,
        });
    triggerSuccessPulse(fromAssist ? assistLoopButton : testAutomationButton);
    setBusy("Pronto");
    setMessage(result, "success");
  } catch (error) {
    setBusy("Erro");
    setTestExecutionState(false);
    stopAssistPlayback();
    resetAssistState("idle");
    setMessage(String(error), "error");
  } finally {
    state.testLaunchPending = false;
  }
}

async function stopCurrentTestExecution() {
  try {
    state.testLaunchPending = false;
    setMessage("Solicitando parada da automacao...", "info");
    const result = await invoke("stop_test_execution");
    state.assist.mode = "stopped";
    state.assist.description = "Parada solicitada pelo launcher.";
    stopAssistPlayback();
    updateAssistProgressUI();
    setTestExecutionState(false);
    setBusy("Pronto");
    setMessage(result, "success");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
}

window.handleQuickTestClick = () => {
  startQuickTestExecution(false);
};

window.handleLoopTestClick = () => {
  startLoopTestExecution(false);
};

window.handleAssistQuickTestClick = () => {
  startQuickTestExecution(true);
};

window.handleAssistLoopTestClick = () => {
  startLoopTestExecution(true);
};

window.handleStopTestClick = () => {
  stopCurrentTestExecution();
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function setMessage(message, variant = "info") {
  messageBar.textContent = message;
  messageBar.className = "message-bar";
  if (variant === "success") {
    messageBar.classList.add("is-success");
  } else if (variant === "error") {
    messageBar.classList.add("is-error");
  }
}

function updateCommandMapSaveUI() {
  if (!mapSaveButton || !mapSavePercent || !mapSaveFill || !mapSaveStatus) {
    return;
  }

  const shell = mapSaveButton.closest(".command-map-save-panel");
  const percent = Math.max(0, Math.min(100, Math.round(Number(state.commandMapSave.percent) || 0)));
  mapSavePercent.textContent = `${percent}%`;
  mapSaveFill.style.width = `${percent}%`;
  mapSaveStatus.textContent = state.commandMapSave.status || "Mapa ainda nao salvo.";
  mapSaveButton.disabled = Boolean(state.commandMapSave.running);
  mapSaveButton.textContent = state.commandMapSave.running ? "Salvando..." : "Salvar mapa";

  shell?.classList.toggle("is-running", Boolean(state.commandMapSave.running));
  shell?.classList.toggle("is-success", !state.commandMapSave.running && percent >= 100 && !state.commandMapSave.dirty);
  shell?.classList.toggle("is-dirty", Boolean(state.commandMapSave.dirty) && !state.commandMapSave.running);
}

function setCommandMapSaveState(partial = {}) {
  state.commandMapSave = {
    ...state.commandMapSave,
    ...partial,
  };
  updateCommandMapSaveUI();
}

function markCommandMapSaveDirty() {
  setCommandMapSaveState({
    dirty: true,
    percent: 0,
    status: "Alteracoes pendentes no mapa.",
  });
}

function showCaptureOverlay(text) {
  captureOverlayText.textContent = text;
  captureOverlay.hidden = false;
}

function resolveNearestCommandMapFocus(roadmap, preferredOrder) {
  const events = roadmap?.events ?? [];
  if (!events.length) {
    return null;
  }

  const exact = events.find((event) => event.order === preferredOrder);
  if (exact) {
    return exact.order;
  }

  const next = events.find((event) => event.order >= preferredOrder);
  if (next) {
    return next.order;
  }

  return events.at(-1)?.order ?? events[0]?.order ?? null;
}

function centerCommandMapOrder(order, behavior = "smooth") {
  const targetSegment = commandMapList.querySelector(`.command-flow-segment[data-order="${order}"]`);
  if (!targetSegment) {
    return;
  }

  const containerRect = commandMapList.getBoundingClientRect();
  const targetRect = targetSegment.getBoundingClientRect();
  const delta = targetRect.left - containerRect.left - (commandMapList.clientWidth / 2 - targetRect.width / 2);
  commandMapList.scrollTo({
    left: commandMapList.scrollLeft + delta,
    behavior,
  });
}

function applyCommandMapFocus(behavior = "smooth") {
  const events = state.roadmap?.events ?? [];
  const focusOrder = resolveNearestCommandMapFocus(state.roadmap, state.commandMapFocusOrder ?? events[0]?.order ?? null);
  state.commandMapFocusOrder = focusOrder;

  const row = commandMapList.querySelector(".command-flow-row");
  if (!row) {
    updateCommandMapNavButtons();
    return;
  }

  row.classList.toggle("is-carousel-focus", Boolean(focusOrder));
  commandMapList.querySelectorAll(".command-flow-segment").forEach((segment) => {
    const order = Number(segment.dataset.order);
    const isFocused = order === focusOrder;
    const isNeighbor = focusOrder != null && Math.abs(order - focusOrder) === 1;
    segment.classList.toggle("is-focused", isFocused);
    segment.classList.toggle("is-neighbor", isNeighbor);
  });

  commandMapList.querySelectorAll(".command-inline-connector").forEach((connector) => {
    const targetIndex = Number(connector.dataset.targetIndex);
    const nearFocus = focusOrder != null && (targetIndex === focusOrder || targetIndex === focusOrder + 1);
    connector.classList.toggle("is-near-focus", nearFocus);
  });

  updateCommandMapNavButtons();

  if (state.activeTab === "commands" && focusOrder) {
    requestAnimationFrame(() => centerCommandMapOrder(focusOrder, behavior));
  }
}

function setCommandMapFocus(order, behavior = "smooth") {
  state.commandMapFocusOrder = order;
  applyCommandMapFocus(behavior);
}

function focusLastCommandMapCard(roadmap) {
  return roadmap?.events?.at(-1)?.order ?? state.commandMapFocusOrder;
}

function hideCaptureOverlay() {
  captureOverlay.hidden = true;
}

function clearCaptureBlurTimer() {
  if (state.captureBlurTimer) {
    clearTimeout(state.captureBlurTimer);
    state.captureBlurTimer = null;
  }
}

function cancelCapture(message = "Captura cancelada.") {
  clearCaptureBlurTimer();
  state.captureTarget = null;
  hideCaptureOverlay();
  setMessage(message, "error");
}

function isModifierOnlyKey(key) {
  return ["ctrl", "alt", "shift", "cmd"].includes(key);
}

function writeCapturedShortcut(captured) {
  const field = state.captureTarget.field || "keys";

  if (state.captureTarget.scope === "update-tree") {
    const card = commandMapList.querySelector(`.command-tree-card[data-order="${state.captureTarget.order}"]`);
    const input = card?.querySelector(`[data-tree-field="${field}"]`);
    if (input) {
      input.value = captured;
    }
  } else if (state.captureTarget.scope === "update-editor") {
    const card = timelineList.querySelector(`.flow-card[data-order="${state.captureTarget.order}"]`);
    const input = card?.querySelector(`[data-field="${field}"]`);
    if (input) {
      input.value = captured;
    }
  } else if (state.captureTarget.scope === "insert-panel") {
    const panel = commandMapList.querySelector(`.insert-card-panel[data-target-order="${state.captureTarget.order}"]`);
    const input = panel?.querySelector(`[data-insert-field="${field}"]`);
    if (input) {
      input.value = captured;
      if (state.insertPanel) {
        state.insertPanel[field] = captured;
      }
    }
  } else if (state.captureTarget.scope === "composer-after-action") {
    afterActionInput.value = captured;
  } else if (state.captureTarget.scope === "workbook-after-action") {
    workbookAfterAction.value = captured;
  }
}

function writeCapturedMouse(payload) {
  const x = Number(payload?.x ?? 0);
  const y = Number(payload?.y ?? 0);
  const button = String(payload?.button ?? "left").toLowerCase();

  if (state.captureTarget.scope === "composer-mouse") {
    mouseXInput.value = String(x);
    mouseYInput.value = String(y);
    mouseButtonInput.value = button;
    return;
  }

  if (state.captureTarget.scope === "update-tree") {
    const card = commandMapList.querySelector(`.command-tree-card[data-order="${state.captureTarget.order}"]`);
    const xInput = card?.querySelector('[data-tree-field="x"]');
    const yInput = card?.querySelector('[data-tree-field="y"]');
    const buttonInput = card?.querySelector('[data-tree-field="button"]');
    if (xInput) {
      xInput.value = String(x);
    }
    if (yInput) {
      yInput.value = String(y);
    }
    if (buttonInput) {
      buttonInput.value = button;
    }
    return;
  }

  if (state.captureTarget.scope === "update-editor") {
    const card = timelineList.querySelector(`.flow-card[data-order="${state.captureTarget.order}"]`);
    const xInput = card?.querySelector('[data-field="x"]');
    const yInput = card?.querySelector('[data-field="y"]');
    const buttonInput = card?.querySelector('[data-field="button"]');
    if (xInput) {
      xInput.value = String(x);
    }
    if (yInput) {
      yInput.value = String(y);
    }
    if (buttonInput) {
      buttonInput.value = button;
    }
    return;
  }

  if (state.captureTarget.scope === "insert-panel") {
    const panel = commandMapList.querySelector(`.insert-card-panel[data-target-order="${state.captureTarget.order}"]`);
    const xInput = panel?.querySelector('[data-insert-field="x"]');
    const yInput = panel?.querySelector('[data-insert-field="y"]');
    const buttonInput = panel?.querySelector('[data-insert-field="button"]');
    if (xInput) {
      xInput.value = String(x);
    }
    if (yInput) {
      yInput.value = String(y);
    }
    if (buttonInput) {
      buttonInput.value = button;
    }
    if (state.insertPanel) {
      state.insertPanel.x = x;
      state.insertPanel.y = y;
      state.insertPanel.button = button;
    }
  }
}

function formatMouseButtonLabel(button) {
  const labels = {
    left: "esquerdo",
    right: "direito",
    middle: "meio",
  };
  return labels[String(button || "").toLowerCase()] || String(button || "left").toLowerCase();
}

function clearDragState() {
  if (state.dragPreviewEl) {
    state.dragPreviewEl.remove();
    state.dragPreviewEl = null;
  }
  state.draggingOrder = null;
  state.dragTargetIndex = null;
  state.dragPointerId = null;
  state.dragOffsetX = 0;
  state.dragOffsetY = 0;
  builderShell?.classList.remove("is-map-dragging");
  commandMapList.querySelectorAll(".command-drop-zone").forEach((zone) => {
    zone.classList.remove("is-drop-target");
  });
  commandMapList.querySelectorAll(".command-flow-segment").forEach((segment) => {
    segment.classList.remove("is-drag-source");
    segment.classList.remove("is-drop-before");
    segment.classList.remove("is-drop-after");
  });
}

function updateDragTarget(targetIndex) {
  if (!targetIndex || state.dragTargetIndex === targetIndex) {
    return;
  }

  state.dragTargetIndex = targetIndex;
  commandMapList.querySelectorAll(".command-drop-zone").forEach((zone) => {
    zone.classList.toggle("is-drop-target", Number(zone.dataset.targetIndex) === targetIndex);
  });

  commandMapList.querySelectorAll(".command-flow-segment").forEach((segment) => {
    const order = Number(segment.dataset.order);
    segment.classList.toggle("is-drop-before", order === targetIndex);
    segment.classList.toggle("is-drop-after", order + 1 === targetIndex);
  });
}

function getDragTargetIndexFromEvent(event) {
  const zone = event.target.closest(".command-drop-zone");
  if (zone) {
    return Number(zone.dataset.targetIndex);
  }

  const connector = event.target.closest(".command-inline-connector");
  if (connector) {
    return Number(connector.dataset.targetIndex);
  }

  const segment = event.target.closest(".command-flow-segment");
  if (segment) {
    const order = Number(segment.dataset.order);
    const rect = segment.getBoundingClientRect();
    const isLeftHalf = event.clientX <= rect.left + rect.width / 2;
    return isLeftHalf ? order : order + 1;
  }

  return null;
}

function getDragTargetIndexFromPoint(clientX, clientY) {
  const target = document.elementFromPoint(clientX, clientY);
  if (!target) {
    return null;
  }

  return getDragTargetIndexFromEvent({
    target,
    clientX,
  });
}

function autoScrollCommandMap(clientX) {
  const rect = commandMapList.getBoundingClientRect();
  const edge = 72;
  const speed = 18;

  if (clientX < rect.left + edge) {
    commandMapList.scrollLeft -= speed;
  } else if (clientX > rect.right - edge) {
    commandMapList.scrollLeft += speed;
  }
}

function moveDragPreview(clientX, clientY) {
  if (!state.dragPreviewEl) {
    return;
  }

  state.dragPreviewEl.style.left = `${clientX - state.dragOffsetX}px`;
  state.dragPreviewEl.style.top = `${clientY - state.dragOffsetY}px`;
}

function beginCardDrag(handle, pointerEvent) {
  const segment = handle.closest(".command-flow-segment");
  if (!segment) {
    return;
  }

  const order = Number(handle.dataset.order);
  const rect = segment.getBoundingClientRect();
  const preview = segment.cloneNode(true);

  preview.classList.remove("is-drop-before", "is-drop-after");
  preview.classList.add("command-drag-preview");
  preview.style.width = `${rect.width}px`;
  preview.style.height = `${rect.height}px`;

  document.body.appendChild(preview);

  state.draggingOrder = order;
  state.dragPointerId = pointerEvent.pointerId;
  state.dragPreviewEl = preview;
  state.dragOffsetX = pointerEvent.clientX - rect.left;
  state.dragOffsetY = pointerEvent.clientY - rect.top;

  segment.classList.add("is-drag-source");
  builderShell?.classList.add("is-map-dragging");
  moveDragPreview(pointerEvent.clientX, pointerEvent.clientY);

  if (typeof handle.setPointerCapture === "function") {
    handle.setPointerCapture(pointerEvent.pointerId);
  }

  const initialTarget = getDragTargetIndexFromPoint(pointerEvent.clientX, pointerEvent.clientY);
  if (initialTarget) {
    updateDragTarget(initialTarget);
  }
}

function finishCardDrag(shouldDrop = true) {
  if (!state.draggingOrder) {
    clearDragState();
    return;
  }

  const order = state.draggingOrder;
  const targetIndex = state.dragTargetIndex;
  clearDragState();

  if (shouldDrop && targetIndex) {
    runMutation("Bloco reordenado", () =>
      invoke("reorder_block", {
        order,
        targetIndex,
      })
    );
  }
}

function createInsertPanelState(targetOrder, position) {
  const workbookId = state.composerWorkbookId || state.workbook?.default_workbook || availableWorkbooks()[0]?.id || "";
  return {
    targetOrder,
    position,
    type: "key",
    text: "",
    keys: "",
    repeat: 1,
    x: 0,
    y: 0,
    button: "left",
    clicks: 1,
    imagePath: "",
    timeout: 10,
    confidence: 0.8,
    searchProfile: "balanced",
    windowTitle: "",
    recognitionClickMode: "single",
    failureAction: "parar",
    failureBlock: "",
    retryCount: 3,
    retryInterval: 1,
    successAction: "continuar",
    successBlock: "",
    chromeName: "Chrome / Elemento HTML",
    chromeHtml: "",
    chromeAnalysis: null,
    chromeTargetMethod: "css",
    chromeTargetValue: "",
    chromeActionType: "clicar",
    chromeValueSource: "texto_fixo",
    chromeActionValue: "",
    chromeSaveAs: "",
    chromeTimeout: 10000,
    chromePressAfter: "",
    chromeSuccessAction: "continuar",
    chromeSuccessBlock: "",
    chromeFailureAction: "parar",
    chromeFailureBlock: "",
    chromeRetryCount: 1,
    chromeRetryInterval: 0.5,
    chromeClearBefore: true,
    chromeFallbackVisual: false,
    chromeFallbackImage: "",
    delay: 0.3,
    workbook: workbookId,
    sheet: workbookSheetsFor(workbookId)[0]?.name ?? "",
    column: columnsForSheetInWorkbook(workbookId, workbookSheetsFor(workbookId)[0]?.name ?? "")?.[0] ?? "",
    afterAction: "nenhuma",
    intervalBetween: 0.5,
  };
}

function setBusy(label) {
  builderStatus.textContent = label;
}

function parseNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value, fallback = true) {
  if (typeof value === "boolean") {
    return value;
  }
  if (value == null || value === "") {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  return ["1", "true", "sim", "yes"].includes(normalized);
}

function recognitionClickModeFromDetails(details = {}) {
  const clicks = Math.max(0, Math.trunc(parseNumber(details.clicks ?? details.cliques ?? (details.clicar === false ? 0 : 1), 1)));
  if (clicks >= 2) {
    return "double";
  }
  if (clicks === 1) {
    return "single";
  }
  return "identify";
}

function recognitionClicksFromMode(value, fallback = 1) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "double") {
    return 2;
  }
  if (normalized === "identify" || normalized === "false" || normalized === "0") {
    return 0;
  }
  if (normalized === "single" || normalized === "true" || normalized === "1") {
    return 1;
  }
  return Math.max(0, Math.trunc(Number(fallback) || 0));
}

function normalizeRecognitionProfile(value, fallback = "balanced") {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "fast" || normalized === "balanced" || normalized === "precise") {
    return normalized;
  }
  return fallback;
}

function optionalPositiveInt(value) {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseChromeAnalysisJson(raw) {
  if (!raw) {
    return null;
  }
  if (typeof raw === "object") {
    return raw;
  }
  try {
    return JSON.parse(String(raw));
  } catch (_error) {
    return null;
  }
}

function chromeKindFromAnalysis(analysis) {
  return String(analysis?.tipo_provavel || analysis?.elemento?.tipo_provavel || "").trim() || "generic";
}

function chromeKindLabel(kind) {
  switch (kind) {
    case "text_input":
      return "Campo de texto";
    case "textarea":
      return "Textarea";
    case "select":
      return "Select";
    case "button":
      return "Botao";
    case "link":
      return "Link";
    case "editable":
      return "Campo editavel";
    case "choice":
      return "Escolha";
    default:
      return "Elemento generico";
  }
}

function chromeActionOptionsForKind(kind) {
  if (kind === "text_input" || kind === "textarea" || kind === "editable") {
    return [
      ["preencher", "Preencher texto"],
      ["limpar", "Limpar campo"],
      ["clicar", "Clicar no campo"],
      ["esperar", "Esperar aparecer"],
      ["verificar_existe", "Verificar se existe"],
      ["pegar_texto", "Pegar texto"],
    ];
  }
  if (kind === "select") {
    return [
      ["selecionar_texto", "Selecionar por texto"],
      ["selecionar_valor", "Selecionar por value"],
      ["selecionar_indice", "Selecionar por indice"],
      ["clicar", "Clicar"],
      ["esperar", "Esperar aparecer"],
      ["verificar_existe", "Verificar se existe"],
    ];
  }
  return [
    ["clicar", "Clicar"],
    ["esperar", "Esperar aparecer"],
    ["verificar_existe", "Verificar se existe"],
    ["pegar_texto", "Pegar texto"],
    ["clicar_aguardar_carregamento", "Clicar e aguardar carregamento"],
    ["clicar_aguardar_download", "Clicar e aguardar download"],
  ];
}

function renderChromeActionOptions(kind, selectedValue = "") {
  const selected = String(selectedValue || "").trim();
  return chromeActionOptionsForKind(kind)
    .map(([value, label]) => `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`)
    .join("");
}

function chromeActionNeedsValue(actionType = "") {
  return ["preencher", "selecionar_texto", "selecionar_valor", "selecionar_indice"].includes(String(actionType || "").trim());
}

function chromeActionSupportsClear(actionType = "") {
  return String(actionType || "").trim() === "preencher";
}

function chromeActionSupportsPressAfter(actionType = "") {
  return String(actionType || "").trim() === "preencher";
}

function chromeActionSupportsSaveAs(actionType = "") {
  return String(actionType || "").trim() === "pegar_texto";
}

function renderChromeMethodOptions(analysis, selectedValue = "") {
  const selected = String(selectedValue || analysis?.alvo_recomendado?.metodo || "css").trim();
  const selectors = Array.isArray(analysis?.seletores) ? analysis.seletores : [];
  const defaults = [
    ["placeholder", "Placeholder"],
    ["name", "Name"],
    ["aria-label", "Aria-label"],
    ["labelledby", "Label / aria-labelledby"],
    ["id", "ID"],
    ["css", "CSS"],
    ["xpath", "XPath"],
    ["text", "Texto"],
    ["role", "Role"],
  ];
  const available = new Set(selectors.map((item) => String(item?.metodo || "").trim()).filter(Boolean));
  return defaults
    .filter(([value]) => available.size === 0 || available.has(value) || value === selected)
    .map(([value, label]) => `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`)
    .join("");
}

function findChromeSelectorByMethod(analysis, method) {
  const selectedMethod = String(method || "").trim();
  return (analysis?.seletores || []).find((item) => String(item?.metodo || "").trim() === selectedMethod)
    || analysis?.alvo_recomendado
    || null;
}

function renderChromePreviewHtml(analysis) {
  if (!analysis) {
    return `
      <div class="chrome-preview-copy chrome-preview-empty">
        <p class="panel-kicker">Fluxo sugerido</p>
        <h3>Cole o elemento HTML</h3>
        <p class="muted-copy">O gerador analisa o elemento, identifica o melhor seletor e sugere automaticamente a ação mais adequada.</p>
      </div>
    `;
  }
  const element = analysis.elemento || {};
  const best = analysis.alvo_recomendado || {};
  return `
    <div class="chrome-preview-copy">
      <p class="panel-kicker">Elemento detectado</p>
      <h3>${escapeHtml(chromeKindLabel(chromeKindFromAnalysis(analysis)))}</h3>
      <p class="muted-copy">Tag: <strong>${escapeHtml(element.tag || "-")}</strong>${element.type ? ` | Tipo: <strong>${escapeHtml(element.type)}</strong>` : ""}${element.placeholder ? ` | Placeholder: <strong>${escapeHtml(element.placeholder)}</strong>` : ""}</p>
      <p class="muted-copy">Melhor método: <strong>${escapeHtml(best.metodo || "css")}</strong></p>
      <p class="muted-copy">Alvo: <strong>${escapeHtml(best.valor || "-")}</strong></p>
      <p class="muted-copy">Confiança: <strong>${escapeHtml(best.confianca || analysis.confianca || "media")}</strong> | Ação sugerida: <strong>${escapeHtml((analysis.acao_sugerida || {}).tipo || "clicar")}</strong></p>
    </div>
  `;
}

function renderChromeBlockFields(event, mode = "card", currentOrder = null) {
  const details = event.details ?? {};
  const analysis = {
    html_original: details.html_original ?? "",
    elemento: details.elemento ?? {},
    tipo_provavel: details.tipo_provavel ?? "",
    seletores: details.seletores ?? [],
    alvo_recomendado: details.alvo ?? {},
    acao_sugerida: details.acao ?? {},
    nome_sugerido: details.nome ?? "Chrome / Elemento HTML",
    confianca: details.alvo?.confianca ?? "media",
  };
  const fieldAttr = mode === "tree" ? "data-tree-field" : "data-field";
  const actionAttr = mode === "tree" ? "data-tree-action" : "data-action";
  const kind = chromeKindFromAnalysis(analysis);
  const actionType = String(details.acao?.tipo || analysis?.acao_sugerida?.tipo || "clicar").trim();
  const hasAnalysis = Boolean((details.html_original ?? "").trim()) || Boolean((details.alvo?.valor ?? "").trim());
  return `
    <div class="field-stack chrome-block-fields">
      <label>
        <span>Nome do bloco</span>
        <input ${fieldAttr}="chromeName" type="text" value="${escapeHtml(details.nome ?? "Chrome / Elemento HTML")}" />
      </label>
      <label>
        <span>HTML do elemento</span>
        <textarea ${fieldAttr}="chromeHtml" rows="5" placeholder="<input ...> ou <button ...>">${escapeHtml(details.html_original ?? "")}</textarea>
      </label>
      <input ${fieldAttr}="chromeAnalysis" type="hidden" value="${escapeHtml(JSON.stringify(analysis))}" />
      <div class="recognition-action-row">
        <button class="tree-open-button" ${actionAttr}="analyze-chrome-html" type="button">Analisar HTML</button>
        <span class="recognition-action-help">Cole o elemento e deixe o gerador sugerir o que fazer.</span>
      </div>
      <div class="chrome-preview-card" data-chrome-preview>
        ${renderChromePreviewHtml(analysis)}
      </div>
      ${hasAnalysis ? `
      <div class="chrome-quick-grid">
        <label>
          <span>Método de busca</span>
          <select ${fieldAttr}="chromeTargetMethod">
            ${renderChromeMethodOptions(analysis, details.alvo?.metodo ?? "css")}
          </select>
        </label>
        <label>
          <span>Alvo encontrado</span>
          <input ${fieldAttr}="chromeTargetValue" type="text" value="${escapeHtml(details.alvo?.valor ?? "")}" />
        </label>
        <label>
          <span>Ação</span>
          <select ${fieldAttr}="chromeActionType">
            ${renderChromeActionOptions(kind, actionType)}
          </select>
        </label>
        ${chromeActionNeedsValue(actionType) ? `
        <label>
          <span>Origem do valor</span>
          <select ${fieldAttr}="chromeValueSource">
            <option value="texto_fixo" ${String(details.acao?.origem_valor ?? "texto_fixo") === "texto_fixo" ? "selected" : ""}>Texto fixo</option>
            <option value="variavel" ${String(details.acao?.origem_valor ?? "") === "variavel" ? "selected" : ""}>Variavel</option>
            <option value="planilha" ${String(details.acao?.origem_valor ?? "") === "planilha" ? "selected" : ""}>Planilha</option>
          </select>
        </label>
        <label>
          <span>Valor</span>
          <input ${fieldAttr}="chromeActionValue" type="text" value="${escapeHtml(details.acao?.valor ?? "")}" placeholder='Texto fixo ou {{CNPJ}} / {{linha.CNPJ}}' />
        </label>
        ` : ""}
      </div>
      <details class="chrome-advanced-panel">
        <summary>Configurações avançadas</summary>
        <div class="chrome-advanced-grid">
          <label>
            <span>Timeout (ms)</span>
            <input ${fieldAttr}="chromeTimeout" type="number" min="500" step="500" value="${escapeHtml(details.timeout ?? 10000)}" />
          </label>
          ${chromeActionSupportsSaveAs(actionType) ? `
          <label>
            <span>Salvar texto em</span>
            <input ${fieldAttr}="chromeSaveAs" type="text" value="${escapeHtml(details.acao?.salvar_em ?? "")}" placeholder="Nome da variável" />
          </label>
          ` : `<input ${fieldAttr}="chromeSaveAs" type="hidden" value="${escapeHtml(details.acao?.salvar_em ?? "")}" />`}
          ${chromeActionSupportsPressAfter(actionType) ? `
          <label>
            <span>Pressionar depois</span>
            <select ${fieldAttr}="chromePressAfter">
              <option value="" ${!(details.acao?.pressionar_depois) ? "selected" : ""}>Nada</option>
              <option value="Enter" ${String(details.acao?.pressionar_depois ?? "") === "Enter" ? "selected" : ""}>Enter</option>
              <option value="Tab" ${String(details.acao?.pressionar_depois ?? "") === "Tab" ? "selected" : ""}>Tab</option>
            </select>
          </label>
          ` : `<input ${fieldAttr}="chromePressAfter" type="hidden" value="${escapeHtml(details.acao?.pressionar_depois ?? "")}" />`}
          <label>
            <span>Ao concluir</span>
            <select ${fieldAttr}="chromeSuccessAction">
              <option value="continuar" ${String(details.ao_sucesso ?? "continuar") === "continuar" ? "selected" : ""}>Continuar</option>
              <option value="ir_para_bloco" ${String(details.ao_sucesso ?? "") === "ir_para_bloco" ? "selected" : ""}>Ir para bloco</option>
            </select>
          </label>
          <label>
            <span>Bloco após sucesso</span>
            <select ${fieldAttr}="chromeSuccessBlock">
              ${blockTargetOptions(details.bloco_sucesso ?? "", currentOrder, "Escolha um bloco")}
            </select>
          </label>
          <label>
            <span>Falha</span>
            <select ${fieldAttr}="chromeFailureAction">
              <option value="parar" ${String(details.ao_falhar ?? "parar") === "parar" ? "selected" : ""}>Parar</option>
              <option value="continuar" ${String(details.ao_falhar ?? "") === "continuar" ? "selected" : ""}>Continuar</option>
              <option value="tentar_novamente" ${String(details.ao_falhar ?? "") === "tentar_novamente" ? "selected" : ""}>Tentar novamente</option>
              <option value="ir_para_bloco" ${String(details.ao_falhar ?? "") === "ir_para_bloco" ? "selected" : ""}>Ir para bloco</option>
            </select>
          </label>
          <label>
            <span>Ir para bloco</span>
            <select ${fieldAttr}="chromeFailureBlock">
              ${blockTargetOptions(details.bloco_falha ?? "", currentOrder, "Escolha um bloco")}
            </select>
          </label>
          <label>
            <span>Tentativas</span>
            <input ${fieldAttr}="chromeRetryCount" type="number" min="1" step="1" value="${escapeHtml(details.quantidade_tentativas ?? 1)}" />
          </label>
          <label>
            <span>Intervalo tentativas</span>
            <input ${fieldAttr}="chromeRetryInterval" type="number" min="0" step="0.5" value="${escapeHtml(details.intervalo_tentativas ?? 0.5)}" />
          </label>
          ${chromeActionSupportsClear(actionType) ? `
          <label class="inline-checkbox">
            <input ${fieldAttr}="chromeClearBefore" type="checkbox" ${details.acao?.limpar_antes !== false ? "checked" : ""} />
            <span>Limpar antes</span>
          </label>
          ` : `<input ${fieldAttr}="chromeClearBefore" type="hidden" value="${details.acao?.limpar_antes !== false ? "true" : "false"}" />`}
          <label class="inline-checkbox">
            <input ${fieldAttr}="chromeFallbackVisual" type="checkbox" ${details.fallback_visual ? "checked" : ""} />
            <span>Usar fallback visual</span>
          </label>
          <label class="chrome-fallback-field">
            <span>Imagem do fallback</span>
            <div class="capture-inline">
              <input ${fieldAttr}="chromeFallbackImage" type="text" value="${escapeHtml(details.fallback_imagem ?? "")}" placeholder="imagens/campo.png" />
              <button class="tree-open-button" ${actionAttr}="select-chrome-fallback-image" type="button">Selecionar</button>
            </div>
          </label>
        </div>
      </details>
      ` : `
      <div class="chrome-minimal-help">
        <p class="muted-copy">Depois da análise, o gerador mostra automaticamente o melhor método de busca e a ação sugerida para esse elemento.</p>
      </div>
      `}
    </div>
  `;
}

function buildChromeDetailsFromAnalysisAndValues(analysis, values) {
  const selector = findChromeSelectorByMethod(analysis, values.chromeTargetMethod);
  const targetMethod = String(values.chromeTargetMethod || selector?.metodo || analysis?.alvo_recomendado?.metodo || "css").trim();
  const targetValue = String(values.chromeTargetValue || selector?.valor || analysis?.alvo_recomendado?.valor || "").trim();
  const selectorCss = selector?.seletor_css || analysis?.alvo_recomendado?.seletor_css || "";
  const element = { ...(analysis?.elemento || {}) };
  const action = {
    tipo: values.chromeActionType,
    origem_valor: values.chromeValueSource,
    valor: values.chromeActionValue,
    limpar_antes: values.chromeClearBefore,
    pressionar_depois: values.chromePressAfter,
    salvar_em: values.chromeSaveAs,
  };
  const target = {
    metodo: targetMethod,
    valor: targetValue,
    confianca: selector?.confianca || analysis?.alvo_recomendado?.confianca || analysis?.confianca || "media",
    seletor_css: selectorCss,
    codigo_playwright: selector?.codigo_playwright || "",
    role: selector?.role || element.role || "",
  };
  return {
    nome: values.chromeName || analysis?.nome_sugerido || "Chrome / Elemento HTML",
    html_original: values.chromeHtml,
    elemento: element,
    tipo_provavel: chromeKindFromAnalysis(analysis),
    seletores: Array.isArray(analysis?.seletores) ? analysis.seletores : [],
    alvo: target,
    acao: action,
    timeout: Math.max(500, Math.trunc(Number(values.chromeTimeout) || 10000)),
    fallback_visual: Boolean(values.chromeFallbackVisual),
    fallback_imagem: values.chromeFallbackImage || "",
    ao_sucesso: values.chromeSuccessAction || "continuar",
    bloco_sucesso: optionalPositiveInt(values.chromeSuccessBlock),
    ao_falhar: values.chromeFailureAction || "parar",
    bloco_falha: optionalPositiveInt(values.chromeFailureBlock),
    quantidade_tentativas: Math.max(1, Math.trunc(Number(values.chromeRetryCount) || 1)),
    intervalo_tentativas: Number(values.chromeRetryInterval) || 0,
  };
}

function refreshChromeComposerActionOptions() {
  if (!chromeActionTypeInput) {
    return;
  }
  const analysis = parseChromeAnalysisJson(chromeAnalysisJsonInput?.value);
  const current = chromeActionTypeInput.value || (analysis?.acao_sugerida || {}).tipo || "clicar";
  chromeActionTypeInput.innerHTML = renderChromeActionOptions(chromeKindFromAnalysis(analysis), current);
  chromeActionTypeInput.value = current;
}

function applyChromeAnalysisToComposer(analysis, preserveTargetMethod = false) {
  if (!analysis) {
    return;
  }
  if (chromeAnalysisJsonInput) {
    chromeAnalysisJsonInput.value = JSON.stringify(analysis);
  }
  if (chromeHtmlPreview) {
    chromeHtmlPreview.innerHTML = renderChromePreviewHtml(analysis);
  }
  if (chromeBlockNameInput && !chromeBlockNameInput.value.trim()) {
    chromeBlockNameInput.value = analysis.nome_sugerido || "Chrome / Elemento HTML";
  } else if (chromeBlockNameInput && chromeBlockNameInput.value === "Chrome / Elemento HTML") {
    chromeBlockNameInput.value = analysis.nome_sugerido || "Chrome / Elemento HTML";
  }
  if (chromeTargetMethodInput) {
    const selectedMethod = preserveTargetMethod ? chromeTargetMethodInput.value : (analysis.alvo_recomendado?.metodo || "css");
    chromeTargetMethodInput.innerHTML = renderChromeMethodOptions(analysis, selectedMethod);
    chromeTargetMethodInput.value = selectedMethod;
  }
  const selector = findChromeSelectorByMethod(analysis, chromeTargetMethodInput?.value);
  if (chromeTargetValueInput) {
    chromeTargetValueInput.value = selector?.valor || analysis.alvo_recomendado?.valor || "";
  }
  refreshChromeComposerActionOptions();
  if (chromeActionTypeInput && !chromeActionTypeInput.value) {
    chromeActionTypeInput.value = (analysis.acao_sugerida || {}).tipo || "clicar";
  }
  if (chromeValueSourceInput) {
    chromeValueSourceInput.value = (analysis.acao_sugerida || {}).origem_valor || "texto_fixo";
  }
  if (chromeActionValueInput && !chromeActionValueInput.value.trim()) {
    chromeActionValueInput.value = (analysis.acao_sugerida || {}).valor || "";
  }
  if (chromeClearBeforeInput) {
    chromeClearBeforeInput.checked = Boolean((analysis.acao_sugerida || {}).limpar_antes);
  }
  if (chromePressAfterInput && !chromePressAfterInput.value) {
    chromePressAfterInput.value = (analysis.acao_sugerida || {}).pressionar_depois || "";
  }
}

async function analyzeChromeHtmlForComposer() {
  const html = chromeHtmlInput?.value?.trim() || "";
  if (!html) {
    setMessage("Cole o elemento HTML antes de analisar.", "error");
    return null;
  }
  const analysis = await invoke("analyze_html_element", { html });
  applyChromeAnalysisToComposer(analysis);
  setMessage("Elemento HTML analisado com sucesso.", "success");
  return analysis;
}

function composerChromeValues() {
  return {
    chromeName: chromeBlockNameInput?.value?.trim() || "",
    chromeHtml: chromeHtmlInput?.value?.trim() || "",
    chromeAnalysis: parseChromeAnalysisJson(chromeAnalysisJsonInput?.value),
    chromeTargetMethod: chromeTargetMethodInput?.value || "css",
    chromeTargetValue: chromeTargetValueInput?.value || "",
    chromeActionType: chromeActionTypeInput?.value || "clicar",
    chromeValueSource: chromeValueSourceInput?.value || "texto_fixo",
    chromeActionValue: chromeActionValueInput?.value || "",
    chromeSaveAs: chromeSaveAsInput?.value?.trim() || "",
    chromeTimeout: parseNumber(chromeTimeoutInput?.value, 10000),
    chromePressAfter: chromePressAfterInput?.value || "",
    chromeSuccessAction: chromeSuccessActionInput?.value || "continuar",
    chromeSuccessBlock: chromeSuccessBlockInput?.value || "",
    chromeFailureAction: chromeFailureActionInput?.value || "parar",
    chromeFailureBlock: chromeFailureBlockInput?.value || "",
    chromeRetryCount: Math.max(1, Math.trunc(parseNumber(chromeRetryCountInput?.value, 1))),
    chromeRetryInterval: parseNumber(chromeRetryIntervalInput?.value, 0.5),
    chromeClearBefore: Boolean(chromeClearBeforeInput?.checked),
    chromeFallbackVisual: Boolean(chromeFallbackVisualInput?.checked),
    chromeFallbackImage: chromeFallbackImageInput?.value?.trim() || "",
    delay: parseNumber(chromeDelayInput?.value, 0),
  };
}

function applyChromeAnalysisToContainer(container, fieldAttr, analysis, preserveMethod = false) {
  if (!container || !analysis) {
    return;
  }
  const get = (field) => container.querySelector(`[${fieldAttr}="${field}"]`);
  const analysisField = get("chromeAnalysis");
  if (analysisField) {
    analysisField.value = JSON.stringify(analysis);
  }
  const preview = container.querySelector("[data-chrome-preview]");
  if (preview) {
    preview.innerHTML = renderChromePreviewHtml(analysis);
  }
  const nameField = get("chromeName");
  if (nameField && (!nameField.value.trim() || nameField.value === "Chrome / Elemento HTML")) {
    nameField.value = analysis.nome_sugerido || "Chrome / Elemento HTML";
  }
  const methodField = get("chromeTargetMethod");
  if (methodField) {
    const nextMethod = preserveMethod ? methodField.value : (analysis.alvo_recomendado?.metodo || "css");
    methodField.innerHTML = renderChromeMethodOptions(analysis, nextMethod);
    methodField.value = nextMethod;
  }
  const selector = findChromeSelectorByMethod(analysis, methodField?.value);
  const valueField = get("chromeTargetValue");
  if (valueField) {
    valueField.value = selector?.valor || analysis.alvo_recomendado?.valor || "";
  }
  const actionField = get("chromeActionType");
  if (actionField) {
    const currentAction = actionField.value || analysis.acao_sugerida?.tipo || "clicar";
    actionField.innerHTML = renderChromeActionOptions(chromeKindFromAnalysis(analysis), currentAction);
    actionField.value = currentAction;
  }
  const valueSourceField = get("chromeValueSource");
  if (valueSourceField) {
    valueSourceField.value = analysis.acao_sugerida?.origem_valor || valueSourceField.value || "texto_fixo";
  }
  const actionValueField = get("chromeActionValue");
  if (actionValueField && !actionValueField.value.trim()) {
    actionValueField.value = analysis.acao_sugerida?.valor || "";
  }
  const clearField = get("chromeClearBefore");
  if (clearField) {
    clearField.checked = analysis.acao_sugerida?.limpar_antes !== false;
  }
  const pressField = get("chromePressAfter");
  if (pressField && !pressField.value) {
    pressField.value = analysis.acao_sugerida?.pressionar_depois || "";
  }
}

async function analyzeChromeHtmlInContainer(container, fieldAttr) {
  if (!container) {
    return null;
  }
  const htmlField = container.querySelector(`[${fieldAttr}="chromeHtml"]`);
  const html = htmlField?.value?.trim() || "";
  if (!html) {
    setMessage("Cole o HTML do elemento antes de analisar.", "error");
    return null;
  }
  const analysis = await invoke("analyze_html_element", { html });
  applyChromeAnalysisToContainer(container, fieldAttr, analysis);
  setMessage("Elemento HTML analisado com sucesso.", "success");
  return analysis;
}

function availableBlockTargets(currentOrder = null) {
  return (state.roadmap?.events ?? []).filter((event) => {
    const order = Number(event?.order);
    if (!Number.isFinite(order)) {
      return false;
    }
    if (currentOrder == null) {
      return true;
    }
    return order !== Number(currentOrder);
  });
}

function blockTargetLabel(event) {
  const order = Number(event?.order);
  const title = String(event?.title || event?.type || "Bloco").trim();
  return `Bloco ${Number.isFinite(order) ? order : "?"} - ${title}`;
}

function blockTargetOptions(selectedValue = "", currentOrder = null, placeholder = "Escolha um bloco") {
  const selected = String(selectedValue ?? "").trim();
  const options = [`<option value="">${escapeHtml(placeholder)}</option>`];
  for (const event of availableBlockTargets(currentOrder)) {
    const order = Number(event.order);
    const selectedAttr = String(order) === selected ? " selected" : "";
    options.push(
      `<option value="${escapeHtml(order)}"${selectedAttr}>${escapeHtml(blockTargetLabel(event))}</option>`
    );
  }
  return options.join("");
}

function renderSuccessFlowFields(fieldAttr, successAction = "continuar", successBlock = "", currentOrder = null) {
  const action = String(successAction || "continuar");
  const block = String(successBlock ?? "");
  return `
    <label>
      <span>Ao concluir</span>
      <select ${fieldAttr}="successAction">
        <option value="continuar" ${action === "continuar" ? "selected" : ""}>Continuar</option>
        <option value="ir_para_bloco" ${action === "ir_para_bloco" ? "selected" : ""}>Ir para bloco</option>
      </select>
    </label>
    <label>
      <span>Bloco apos sucesso</span>
      <select ${fieldAttr}="successBlock">
        ${blockTargetOptions(block, currentOrder, "Escolha um bloco")}
      </select>
    </label>
  `;
}

function populateImageFailureBlockSelect() {
  if (!imageFailureBlockInput) {
    return;
  }
  const currentValue = String(imageFailureBlockInput.value ?? "").trim();
  imageFailureBlockInput.innerHTML = blockTargetOptions(currentValue, null, "Escolha um bloco");
  if (currentValue) {
    imageFailureBlockInput.value = currentValue;
  }
}

function populateChromeFailureBlockSelect() {
  if (!chromeFailureBlockInput) {
    return;
  }
  const currentValue = String(chromeFailureBlockInput.value ?? "").trim();
  chromeFailureBlockInput.innerHTML = blockTargetOptions(currentValue, null, "Escolha um bloco");
  if (currentValue) {
    chromeFailureBlockInput.value = currentValue;
  }
}

function populateChromeSuccessBlockSelect() {
  if (!chromeSuccessBlockInput) {
    return;
  }
  const currentValue = String(chromeSuccessBlockInput.value ?? "").trim();
  chromeSuccessBlockInput.innerHTML = blockTargetOptions(currentValue, null, "Escolha um bloco");
  if (currentValue) {
    chromeSuccessBlockInput.value = currentValue;
  }
}

function typeChipLabel(type) {
  switch (type) {
    case "clicar_imagem":
      return "RECONHECIMENTO";
    case "verificar_estado_botao":
      return "ESTADO DO BOTAO";
    case "chrome_elemento_html":
      return "CHROME HTML";
    case "sequencia_planilha":
      return "SEQUENCIA PLANILHA";
    default:
      return String(type || "").replaceAll("_", " ");
  }
}

function currentSequenceName() {
  return (sequenceContextInput?.value || "").trim() || "principal";
}

function refreshSequenceSuggestions() {
  const list = document.getElementById("sequenceSuggestions");
  if (!list) {
    return;
  }
  const names = Array.from(new Set(["principal", ...(state.roadmap?.sequences ?? [])])).filter(Boolean);
  list.innerHTML = names.map((name) => `<option value="${escapeHtml(name)}"></option>`).join("");
}

function openImagePicker(target) {
  state.imageImportTarget = target;
  imageFileInput.click();
}

async function importImageToProject(file) {
  const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
  return invoke("import_image_asset", {
    fileName: file.name,
    bytes,
  });
}

function writeImportedImagePath(target, imageId) {
  if (!target || !imageId) {
    return;
  }

  if (target.scope === "composer-image") {
    imagePathInput.value = imageId;
    return;
  }

  if (target.scope === "composer-chrome-fallback") {
    chromeFallbackImageInput.value = imageId;
    return;
  }

  if (target.scope === "composer-verify-active") {
    verifyActiveImageInput.value = imageId;
    return;
  }

  if (target.scope === "composer-verify-inactive") {
    verifyInactiveImageInput.value = imageId;
    return;
  }

  if (target.scope === "update-editor") {
    const card = timelineList.querySelector(`.flow-card[data-order="${target.order}"]`);
    const input = card?.querySelector('[data-field="imagePath"]');
    if (input) {
      input.value = imageId;
    }
    return;
  }

  if (target.scope === "update-editor-verify-active") {
    const card = timelineList.querySelector(`.flow-card[data-order="${target.order}"]`);
    const input = card?.querySelector('[data-field="verifyActiveImage"]');
    if (input) {
      input.value = imageId;
    }
    return;
  }

  if (target.scope === "update-editor-verify-inactive") {
    const card = timelineList.querySelector(`.flow-card[data-order="${target.order}"]`);
    const input = card?.querySelector('[data-field="verifyInactiveImage"]');
    if (input) {
      input.value = imageId;
    }
    return;
  }

  if (target.scope === "update-editor-chrome-fallback") {
    const card = timelineList.querySelector(`.flow-card[data-order="${target.order}"]`);
    const input = card?.querySelector('[data-field="chromeFallbackImage"]');
    if (input) {
      input.value = imageId;
    }
    return;
  }

  if (target.scope === "update-tree") {
    const card = commandMapList.querySelector(`.command-tree-card[data-order="${target.order}"]`);
    const input = card?.querySelector('[data-tree-field="imagePath"]');
    if (input) {
      input.value = imageId;
    }
    return;
  }

  if (target.scope === "update-tree-chrome-fallback") {
    const card = commandMapList.querySelector(`.command-tree-card[data-order="${target.order}"]`);
    const input = card?.querySelector('[data-tree-field="chromeFallbackImage"]');
    if (input) {
      input.value = imageId;
    }
    return;
  }

  if (target.scope === "update-tree-verify-active") {
    const card = commandMapList.querySelector(`.command-tree-card[data-order="${target.order}"]`);
    const input = card?.querySelector('[data-tree-field="verifyActiveImage"]');
    if (input) {
      input.value = imageId;
    }
    return;
  }

  if (target.scope === "update-tree-verify-inactive") {
    const card = commandMapList.querySelector(`.command-tree-card[data-order="${target.order}"]`);
    const input = card?.querySelector('[data-tree-field="verifyInactiveImage"]');
    if (input) {
      input.value = imageId;
    }
    return;
  }

  if (target.scope === "insert-panel") {
    const panel = commandMapList.querySelector(`.insert-card-panel[data-target-order="${target.order}"]`);
    const input = panel?.querySelector('[data-insert-field="imagePath"]');
    if (input) {
      input.value = imageId;
    }
    if (state.insertPanel) {
      state.insertPanel.imagePath = imageId;
    }
    return;
  }

  if (target.scope === "insert-panel-chrome-fallback") {
    const panel = commandMapList.querySelector(`.insert-card-panel[data-target-order="${target.order}"]`);
    const input = panel?.querySelector('[data-insert-field="chromeFallbackImage"]');
    if (input) {
      input.value = imageId;
    }
    if (state.insertPanel) {
      state.insertPanel.chromeFallbackImage = imageId;
    }
  }
}

function updateTestLoopHint() {
  const payload = state.testLoopData;
  if (!payload?.rows?.length) {
    testLoopHint.textContent = "Nenhum loop de planilha encontrado no roteiro para testar por linha.";
    return;
  }

  const requestedLine = Math.max(1, Math.trunc(parseNumber(testLoopStartInput.value, 1)));
  const resolvedRow = payload.rows.find((row) => Number(row.row_number) >= requestedLine);

  if (!resolvedRow) {
    const lastRow = payload.rows[payload.rows.length - 1];
    testLoopHint.textContent =
      `A linha ${requestedLine} nao existe nesse loop. Ultima linha disponivel: ${lastRow.row_number}.`;
    return;
  }

  const company = resolvedRow.company ? ` | ${resolvedRow.company}` : "";
  testLoopHint.textContent =
    `O teste vai comecar na linha ${resolvedRow.row_number}: ${resolvedRow.value}${company}. ` +
    "Se houver outros loops de planilha, eles acompanham essa mesma linha quando ela existir.";
}

async function refreshTestLoopData() {
  try {
    state.testLoopData = await invoke("get_test_loop_data");
  } catch (_error) {
    state.testLoopData = null;
  }
  updateTestLoopHint();
}

function workbookSheets() {
  return selectedComposerWorkbookMeta()?.sheets ?? [];
}

function columnsForSheet(sheetName) {
  return workbookSheets().find((sheet) => sheet.name === sheetName)?.columns ?? [];
}

function availableWorkbooks() {
  return state.workbook?.workbooks ?? [];
}

function workbookById(workbookId) {
  return availableWorkbooks().find((item) => item.id === workbookId) || null;
}

function selectedComposerWorkbookMeta() {
  const workbooks = availableWorkbooks();
  if (!workbooks.length) {
    return null;
  }

  const activeId = state.composerWorkbookId || state.workbook?.default_workbook || workbooks[0]?.id;
  return workbookById(activeId) || workbooks[0] || null;
}

function selectedPreviewWorkbookMeta() {
  const workbooks = availableWorkbooks();
  if (!workbooks.length) {
    return null;
  }

  const activeId = state.previewWorkbookId || state.workbook?.default_workbook || workbooks[0]?.id;
  return workbookById(activeId) || workbooks[0] || null;
}

function workbookSheetsFor(workbookId) {
  return workbookById(workbookId)?.sheets ?? [];
}

function columnsForSheetInWorkbook(workbookId, sheetName) {
  return workbookSheetsFor(workbookId).find((sheet) => sheet.name === sheetName)?.columns ?? [];
}

function populateSheetSelect(selectedName) {
  const sheets = workbookSheets();
  const chosen = selectedName && sheets.some((sheet) => sheet.name === selectedName)
    ? selectedName
    : sheets[0]?.name ?? "";

  sheetSelect.innerHTML = sheets.length
    ? sheets.map((sheet) => `<option value="${escapeHtml(sheet.name)}">${escapeHtml(sheet.name)}</option>`).join("")
    : `<option value="">Nenhuma aba</option>`;
  sheetSelect.value = chosen;
  populateColumnSelect(chosen);
}

function populateColumnSelect(sheetName, selectedColumn) {
  const columns = columnsForSheet(sheetName);
  const chosen = selectedColumn && columns.includes(selectedColumn) ? selectedColumn : columns[0] ?? "";
  columnSelect.innerHTML = columns.length
    ? columns.map((column) => `<option value="${escapeHtml(column)}">${escapeHtml(column)}</option>`).join("")
    : `<option value="">Nenhuma coluna</option>`;
  columnSelect.value = chosen;
}

function syncWorkbook(workbook) {
  if (workbook) {
    state.workbook = workbook;
  }
  const workbooks = availableWorkbooks();
  const defaultWorkbookId = state.workbook?.default_workbook || workbooks[0]?.id || "";
  if (!state.composerWorkbookId || !workbooks.some((item) => item.id === state.composerWorkbookId)) {
    state.composerWorkbookId = defaultWorkbookId;
  }
  if (!state.previewWorkbookId || !workbooks.some((item) => item.id === state.previewWorkbookId)) {
    state.previewWorkbookId = defaultWorkbookId;
  }
  populateComposerWorkbookSelect();
  populateSheetSelect(sheetSelect.value);
}

function populateComposerWorkbookSelect() {
  const workbooks = availableWorkbooks();
  composerWorkbookSelect.innerHTML = workbooks.length
    ? workbooks
        .map((workbook) => `<option value="${escapeHtml(workbook.id)}">${escapeHtml(workbook.file_name)}</option>`)
        .join("")
    : `<option value="">Nenhuma planilha</option>`;
  composerWorkbookSelect.value = state.composerWorkbookId || workbooks[0]?.id || "";
}

function populateWorkbookSheetSelect() {
  const sheets = selectedPreviewWorkbookMeta()?.sheets ?? [];
  const chosen = state.workbookSelectedSheet && sheets.some((sheet) => sheet.name === state.workbookSelectedSheet)
    ? state.workbookSelectedSheet
    : sheets[0]?.name ?? "";

  workbookSheetSelect.innerHTML = sheets.length
    ? sheets.map((sheet) => `<option value="${escapeHtml(sheet.name)}">${escapeHtml(sheet.name)}</option>`).join("")
    : `<option value="">Nenhuma aba</option>`;
  workbookSheetSelect.value = chosen;
  state.workbookSelectedSheet = chosen;
}

function renderWorkbookFileTabs() {
  const workbooks = availableWorkbooks();
  if (!workbooks.length) {
    workbookFilesTabs.innerHTML = "";
    return;
  }

  workbookFilesTabs.innerHTML = workbooks
    .map((workbook) => {
      const activeClass = workbook.id === state.previewWorkbookId ? " is-active" : "";
      return `<button class="workbook-file-tab${activeClass}" type="button" data-workbook-tab="${escapeHtml(workbook.id)}">${escapeHtml(workbook.file_name)}</button>`;
    })
    .join("");
}

function filteredWorkbookRows() {
  const preview = state.workbookPreview;
  if (!preview) {
    return [];
  }

  const filter = state.workbookSearch.trim().toLowerCase();
  if (!filter) {
    return preview.rows ?? [];
  }

  return (preview.rows ?? []).filter((row) =>
    row.values.some((value) => String(value ?? "").toLowerCase().includes(filter))
  );
}

function updateWorkbookSelectionLabels() {
  const preview = state.workbookPreview;
  const selectedCell = state.workbookSelectedCell;
  const selectedColumn = state.workbookSelectedColumn;

  if (selectedCell?.value) {
    selectedWorkbookTitle.textContent = `${selectedCell.header} • linha ${selectedCell.rowNumber}`;
    selectedWorkbookSubtitle.textContent = `Valor pronto para entrar como texto no mapa a partir da aba ${selectedCell.sheet}.`;
    selectedWorkbookValue.textContent = selectedCell.value;
    addWorkbookCellButton.disabled = false;
  } else {
    selectedWorkbookTitle.textContent = "Nada selecionado";
    selectedWorkbookSubtitle.textContent = "Clique em uma celula da tabela para enviar esse valor como texto ao mapa.";
    selectedWorkbookValue.textContent = "-";
    addWorkbookCellButton.disabled = true;
  }

  if (selectedColumn && preview?.headers?.includes(selectedColumn)) {
    selectedWorkbookColumnTitle.textContent = selectedColumn;
    selectedWorkbookColumnSubtitle.textContent = `Coluna pronta para virar um loop da aba ${preview.sheet}.`;
    addWorkbookColumnButton.disabled = false;
  } else {
    selectedWorkbookColumnTitle.textContent = "Nenhuma coluna";
    selectedWorkbookColumnSubtitle.textContent = "Clique no cabecalho de uma coluna para adicionar esse loop ao mapa.";
    addWorkbookColumnButton.disabled = true;
  }
}

function renderWorkbookPreview() {
  populateWorkbookSheetSelect();
  renderWorkbookFileTabs();
  const preview = state.workbookPreview;
  if (!preview?.headers?.length) {
    workbookMeta.textContent = "A planilha ainda nao foi encontrada ou nao possui colunas legiveis.";
    workbookRowsInfo.textContent = "Sem linhas carregadas.";
    workbookTableWrap.innerHTML = `<div class="empty-state">Nenhum dado de planilha disponivel no momento.</div>`;
    updateWorkbookSelectionLabels();
    return;
  }

  if (!preview.headers.includes(state.workbookSelectedColumn)) {
    state.workbookSelectedColumn = preview.headers[0] ?? "";
  }

  const rows = filteredWorkbookRows();
  workbookMeta.textContent = `${preview.workbook_name} • ${preview.total_rows} linhas encontradas na aba ${preview.sheet}. Use a tabela para escolher valores ou colunas.`;
  workbookRowsInfo.textContent = `${rows.length} de ${preview.total_rows} linhas visiveis`;

  const headerCells = preview.headers
    .map((header) => {
      const selectedClass = header === state.workbookSelectedColumn ? " is-selected" : "";
      return `
        <th class="workbook-col-head${selectedClass}" data-workbook-column="${escapeHtml(header)}">
          <div class="workbook-col-head-inner">
            <span>${escapeHtml(header)}</span>
            <button class="micro-button" type="button" data-workbook-column-action="select" data-column="${escapeHtml(header)}">Loop</button>
          </div>
        </th>
      `;
    })
    .join("");

  const bodyRows = rows.length
    ? rows
        .map((row) => {
          const cells = row.values
            .map((value, index) => {
              const header = preview.headers[index] ?? `Coluna ${index + 1}`;
              const selected =
                state.workbookSelectedCell &&
                state.workbookSelectedCell.rowNumber === row.row_number &&
                state.workbookSelectedCell.header === header;
              const classes = ["workbook-cell"];
              if (selected) {
                classes.push("is-selected");
              }
              if (header === state.workbookSelectedColumn) {
                classes.push("is-column-selected");
              }
              const safeValue = String(value ?? "");
              return `
                <td class="${classes.join(" ")}" data-workbook-cell="true" data-row-number="${row.row_number}" data-column="${escapeHtml(header)}" data-value="${escapeHtml(safeValue)}">
                  <div class="workbook-cell-inner">
                    <span>${escapeHtml(safeValue || "-")}</span>
                    ${safeValue ? `<button class="micro-button workbook-cell-add" type="button" data-workbook-cell-add="true" data-row-number="${row.row_number}" data-column="${escapeHtml(header)}" data-value="${escapeHtml(safeValue)}">Mapa</button>` : ""}
                  </div>
                </td>
              `;
            })
            .join("");
          return `<tr><td class="workbook-row-number">${row.row_number}</td>${cells}</tr>`;
        })
        .join("")
    : `<tr><td class="workbook-empty-row" colspan="${preview.headers.length + 1}">Nenhuma linha encontrada para esse filtro.</td></tr>`;

  workbookTableWrap.innerHTML = `
    <table class="workbook-table">
      <thead>
        <tr>
          <th class="workbook-row-number-head">#</th>
          ${headerCells}
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>
  `;

  updateWorkbookSelectionLabels();
}

function updateStats() {
  const summary = state.roadmap?.summary ?? {};
  totalBlocks.textContent = summary.total ?? 0;
  textBlocks.textContent = summary.text_blocks ?? 0;
  keyBlocks.textContent = summary.key_blocks ?? 0;
  spreadsheetBlocks.textContent = summary.spreadsheet_blocks ?? 0;

  const total = summary.total ?? 0;
  timelineMeta.textContent = total
    ? `${total} blocos conectados no fluxo. Edite qualquer card e salve no proprio lugar.`
    : "Sem blocos no momento. Comece adicionando um texto, atalho, clique, reconhecimento ou loop.";
  commandMapMeta.textContent = total
    ? `${total} etapas no caminho. Use esta aba para enxergar toda a sequencia e editar a trilha sem perder o contexto.`
    : "Sem comandos ainda. A arvore completa vai aparecer aqui.";
}

function setLauncherCreateOpen(open) {
  state.library.createOpen = Boolean(open);
  if (!state.library.createOpen) {
    state.library.createDraft = {
      nome: "",
      categoria: "",
      descricao: "",
    };
    if (newAutomationNameInput) {
      newAutomationNameInput.value = "";
    }
    if (newAutomationCategoryInput) {
      newAutomationCategoryInput.value = "";
    }
    if (newAutomationDescriptionInput) {
      newAutomationDescriptionInput.value = "";
    }
  }
  if (launcherCreatePanel) {
    launcherCreatePanel.hidden = true;
  }
  renderLauncherLibrary();
  if (state.library.createOpen) {
    requestAnimationFrame(() => {
      launcherList?.querySelector('[data-create-field="nome"]')?.focus();
    });
  }
}

async function createAutomationFromDraft() {
  const nome = String(state.library.createDraft?.nome || "").trim();
  if (!nome) {
    setMessage("Informe um nome para a nova automacao.", "error");
    return;
  }

  try {
    setBusy("Criando");
    const result = await invoke("create_saved_automation", {
      nome,
      descricao: String(state.library.createDraft?.descricao || "").trim(),
      categoria: String(state.library.createDraft?.categoria || "").trim() || "Outros",
    });
    applyRoadmap(result);
    state.library.items = result.library?.items || state.library.items;
    state.library.categories = result.library?.categories || state.library.categories;
    state.library.activeId = result.library?.active_id || "";
    exportNameInput.value = nome;
    setLauncherCreateOpen(false);
    setWorkspaceTab("commands");
    setBusy("Pronto");
    setMessage("Automacao criada com sucesso.", "success");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
}

function renderLauncherCreateCard() {
  const draft = state.library.createDraft || {};
  if (state.library.createOpen) {
    return `
      <article class="automation-library-card automation-library-card--create automation-library-card--create-open" data-automation-id="__new__">
        <div class="automation-library-card-stage">
          <section class="automation-library-card-face automation-library-card-front automation-library-create-face automation-library-create-form-face">
            <div class="automation-library-top automation-library-top--create">
              <div>
                <p class="panel-kicker">Novo projeto</p>
                <h3>Novo card de automacao</h3>
              </div>
              <button class="launcher-flip-trigger" type="button" data-library-action="create-cancel">Cancelar</button>
            </div>
            <div class="automation-library-create-form">
              <label class="automation-library-create-field">
                <span>Nome</span>
                <input data-create-field="nome" type="text" placeholder="Ex.: Cadastro de Cliente Alterdata" value="${escapeHtml(draft.nome || "")}" />
              </label>
              <label class="automation-library-create-field">
                <span>Categoria</span>
                <input data-create-field="categoria" type="text" list="launcherCategorySuggestions" placeholder="Alterdata" value="${escapeHtml(draft.categoria || "")}" />
              </label>
              <label class="automation-library-create-field automation-library-create-field--full">
                <span>Descricao</span>
                <textarea data-create-field="descricao" rows="4" placeholder="Explique rapidamente o objetivo da automacao">${escapeHtml(draft.descricao || "")}</textarea>
              </label>
            </div>
            <div class="automation-library-actions automation-library-actions--create">
              <button class="ghost-button secondary-inline-action" data-library-action="create-cancel">Cancelar</button>
              <button class="primary-button primary-inline-action" data-library-action="create-confirm">Criar automacao</button>
            </div>
          </section>
        </div>
      </article>
    `;
  }

  return `
    <article class="automation-library-card automation-library-card--create" data-automation-id="__new__">
      <div class="automation-library-card-stage">
        <section class="automation-library-card-face automation-library-card-front automation-library-create-face">
          <p class="panel-kicker">Novo projeto</p>
          <h3>Criar automacao</h3>
          <p class="automation-library-description">Inicie outra automacao sem sair da biblioteca.</p>
          <div class="automation-library-actions">
            <button class="primary-button primary-inline-action" data-library-action="create">+ Nova automacao</button>
          </div>
        </section>
      </div>
    </article>
  `;
}

function setLibraryEditOpen(automationId, open) {
  const targetId = String(automationId || "");
  if (!open) {
    state.library.editingId = "";
    state.library.editDraft = {
      nome: "",
      categoria: "",
      descricao: "",
    };
    renderLauncherLibrary();
    return;
  }

  const item = state.library.items.find((entry) => String(entry.id) === targetId);
  if (!item) {
    return;
  }

  state.library.editingId = targetId;
  state.library.editDraft = {
    nome: String(item.nome || ""),
    categoria: String(item.categoria || "Outros"),
    descricao: String(item.descricao || ""),
  };
  renderLauncherLibrary();
}

async function saveLibraryCardEdit(automationId) {
  const targetId = String(automationId || "");
  const nome = String(state.library.editDraft?.nome || "").trim();
  if (!nome) {
    throw new Error("Informe um nome para a automacao.");
  }

  const categoria = String(state.library.editDraft?.categoria || "").trim() || "Outros";
  const descricao = String(state.library.editDraft?.descricao || "").trim();

  const result = await invoke("rename_saved_automation", {
    id: targetId,
    nome,
    descricao,
    categoria,
  });

  state.library.items = result.library?.items || state.library.items;
  state.library.categories = result.library?.categories || state.library.categories;
  state.library.activeId = result.library?.active_id || state.library.activeId;
  state.library.editingId = "";
  state.library.editDraft = {
    nome: "",
    categoria: "",
    descricao: "",
  };
  renderLauncherLibrary();
}

function formatDateLabel(value) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return parsed.toLocaleString("pt-BR");
}

function compareAutomationItems(a, b) {
  const sort = state.library.sort || "updated_desc";
  if (sort === "name_asc") {
    return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
  }
  if (sort === "created_desc") {
    return String(b.criado_em || "").localeCompare(String(a.criado_em || ""));
  }
  if (sort === "used_desc") {
    const usedDiff = Number(b.vezes_executada || 0) - Number(a.vezes_executada || 0);
    if (usedDiff !== 0) {
      return usedDiff;
    }
  }
  return String(b.atualizado_em || "").localeCompare(String(a.atualizado_em || ""));
}

function filteredAutomationItems() {
  const search = (state.library.search || "").trim().toLowerCase();
  const category = (state.library.category || "").trim();
  const createdFrom = state.library.createdFrom || "";
  const updatedFrom = state.library.updatedFrom || "";
  return [...(state.library.items || [])]
    .filter((item) => {
      if (search) {
        const haystack = `${item.nome || ""} ${item.descricao || ""}`.toLowerCase();
        if (!haystack.includes(search)) {
          return false;
        }
      }
      if (category && String(item.categoria || "") !== category) {
        return false;
      }
      if (createdFrom && String(item.criado_em || "").slice(0, 10) < createdFrom) {
        return false;
      }
      if (updatedFrom && String(item.atualizado_em || "").slice(0, 10) < updatedFrom) {
        return false;
      }
      return true;
    })
    .sort(compareAutomationItems);
}

function renderLauncherLibrary() {
  if (!launcherList) {
    return;
  }
  const items = filteredAutomationItems();
  launcherMeta.textContent = items.length
    ? `${items.length} automacoes encontradas. Abra, execute e organize sua biblioteca.`
    : "Nenhuma automacao encontrada.";

  launcherCategoryFilter.innerHTML = [
    '<option value="">Todas</option>',
    ...(state.library.categories || []).map((category) => {
      const selected = category === state.library.category ? "selected" : "";
      return `<option value="${escapeHtml(category)}" ${selected}>${escapeHtml(category)}</option>`;
    }),
  ].join("");

  launcherCategorySuggestions.innerHTML = (state.library.categories || [])
    .map((category) => `<option value="${escapeHtml(category)}"></option>`)
    .join("");

  if (launcherExtraFilters) {
    launcherExtraFilters.hidden = true;
  }

  const createCard = renderLauncherCreateCard();

  if (!items.length) {
    launcherList.innerHTML = `
      ${createCard}
      <div class="empty-state">Nenhuma automacao encontrada.</div>
    `;
    return;
  }

  launcherList.innerHTML = createCard + items
    .map((item) => {
      const activeClass = item.active ? " is-active" : "";
      const isEditing = String(state.library.editingId || "") === String(item.id);
      const editingClass = isEditing ? " is-editing" : "";
      const flippedClass = isEditing ? " is-flipped" : "";
      const description = escapeHtml(item.descricao || "Sem descricao curta.");
      const lastExecution = item.ultima_execucao
        ? escapeHtml(formatDateLabel(item.ultima_execucao))
        : "Nunca executada";
      const updatedAt = escapeHtml(formatDateLabel(item.atualizado_em));
      const editDraft = isEditing
        ? (state.library.editDraft || {})
        : {
            nome: item.nome || "",
            categoria: item.categoria || "Outros",
            descricao: item.descricao || "",
          };
      return `
        <article class="automation-library-card${activeClass}${editingClass}${flippedClass}" data-automation-id="${escapeHtml(item.id)}">
          <div class="automation-library-card-stage">
            <section class="automation-library-card-face automation-library-card-front">
              <div class="automation-library-top">
                <div>
                  <p class="panel-kicker">${escapeHtml(item.categoria || "Outros")}</p>
                  <h3>${escapeHtml(item.nome)}</h3>
                </div>
                <div class="automation-library-top-side">
                  ${item.active ? '<span class="library-active-chip">Em edicao</span>' : ""}
                  <button class="launcher-flip-trigger" type="button" data-library-action="flip">Virar</button>
                </div>
              </div>

              <div class="automation-library-front-summary">
                <p class="automation-library-description">${description}</p>
                <div class="automation-library-quick-meta">
                  <span>
                    <small>Comandos</small>
                    <strong>${escapeHtml(item.command_count ?? 0)}</strong>
                  </span>
                  <span>
                    <small>Sequencias</small>
                    <strong>${escapeHtml(item.sequence_count ?? 1)}</strong>
                  </span>
                  <span>
                    <small>Execucoes</small>
                    <strong>${escapeHtml(item.vezes_executada ?? 0)}</strong>
                  </span>
                </div>
                <div class="automation-library-front-footer">
                  <span class="automation-library-front-note">Atualizada: ${updatedAt}</span>
                  <span class="automation-library-front-note">Ultima: ${lastExecution}</span>
                </div>
              </div>

              <div class="automation-library-actions">
                <button class="tree-open-button primary-inline-action" data-library-action="edit">Editar</button>
                <button class="soft-button primary-inline-action" data-library-action="run">Executar</button>
                <button class="ghost-button secondary-inline-action" data-library-action="duplicate">Duplicar</button>
              </div>
            </section>

            <section class="automation-library-card-face automation-library-card-back">
              <div class="automation-library-back-top">
                <div>
                  <p class="panel-kicker">${escapeHtml(item.categoria || "Outros")}</p>
                  <h3 class="automation-library-back-title">${escapeHtml(item.nome)}</h3>
                </div>
                <div class="automation-library-top-side">
                  ${item.active ? '<span class="library-active-chip">Ativa</span>' : ""}
                  <button class="launcher-flip-trigger" type="button" data-library-action="${isEditing ? "edit-cancel" : "unflip"}">${isEditing ? "Cancelar" : "Voltar"}</button>
                </div>
              </div>

              ${
                isEditing
                  ? `
                    <div class="automation-library-back-body automation-library-back-body--edit">
                      <div class="automation-library-card-edit-form">
                        <label class="automation-library-card-edit-field">
                          <span>Nome</span>
                          <input type="text" value="${escapeHtml(String(editDraft.nome || ""))}" data-library-edit-field="nome" />
                        </label>
                        <label class="automation-library-card-edit-field">
                          <span>Categoria</span>
                          <input type="text" value="${escapeHtml(String(editDraft.categoria || ""))}" list="launcherCategorySuggestions" data-library-edit-field="categoria" />
                        </label>
                        <label class="automation-library-card-edit-field automation-library-card-edit-field--full">
                          <span>Descricao</span>
                          <textarea rows="5" data-library-edit-field="descricao">${escapeHtml(String(editDraft.descricao || ""))}</textarea>
                        </label>
                        <div class="automation-library-id">ID: ${escapeHtml(item.id)}</div>
                      </div>
                    </div>

                    <div class="automation-library-actions">
                      <button class="ghost-button secondary-inline-action" data-library-action="edit-cancel">Cancelar</button>
                      <button class="primary-button primary-inline-action" data-library-action="edit-save">Salvar</button>
                    </div>
                  `
                  : `
                    <p class="automation-library-description-full">${description}</p>

                    <div class="automation-library-back-body">
                      <div class="automation-library-back-grid">
                        <span>
                          <small>Criada em</small>
                          <strong>${escapeHtml(formatDateLabel(item.criado_em))}</strong>
                        </span>
                        <span>
                          <small>Atualizada em</small>
                          <strong>${escapeHtml(formatDateLabel(item.atualizado_em))}</strong>
                        </span>
                        <span>
                          <small>Ultima execucao</small>
                          <strong>${lastExecution}</strong>
                        </span>
                        <span>
                          <small>Categoria</small>
                          <strong>${escapeHtml(item.categoria || "Outros")}</strong>
                        </span>
                        <span>
                          <small>Comandos</small>
                          <strong>${escapeHtml(item.command_count ?? 0)}</strong>
                        </span>
                        <span>
                          <small>Sequencias</small>
                          <strong>${escapeHtml(item.sequence_count ?? 1)}</strong>
                        </span>
                        <span>
                          <small>Execucoes</small>
                          <strong>${escapeHtml(item.vezes_executada ?? 0)}</strong>
                        </span>
                        <span>
                          <small>Status</small>
                          <strong>${item.active ? "Em edicao" : "Disponivel"}</strong>
                        </span>
                      </div>

                      <div class="automation-library-id">ID: ${escapeHtml(item.id)}</div>
                    </div>

                    <div class="automation-library-actions">
                      <button class="ghost-button secondary-inline-action" data-library-action="edit-meta">Editar dados</button>
                      <button class="danger-button secondary-inline-action" data-library-action="delete">Excluir</button>
                    </div>
                  `
              }
            </section>
          </div>
        </article>
      `;
    })
    .join("");
}

async function refreshAutomationLibrary(feedbackMessage = "") {
  const result = await invoke("list_saved_automations");
  state.library.items = result.items || [];
  state.library.activeId = result.active_id || "";
  state.library.categories = result.categories || [];
  if (!state.library.items.some((item) => String(item.id) === String(state.library.editingId || ""))) {
    state.library.editingId = "";
    state.library.editDraft = {
      nome: "",
      categoria: "",
      descricao: "",
    };
  }
  const activeItem = state.library.items.find((item) => String(item.id) === String(state.library.activeId));
  if (activeItem?.nome) {
    exportNameInput.value = activeItem.nome;
  }
  renderLauncherLibrary();
  if (feedbackMessage) {
    setMessage(feedbackMessage, "success");
  }
}

function renderEditorFields(event) {
  const delayField = `
    <label>
      <span>Tempo antes do bloco</span>
      <input data-field="delay" type="number" min="0" step="0.1" value="${escapeHtml(event.delay)}" />
    </label>
  `;

  if (event.type === "texto_livre") {
    return `
      <div class="field-stack">
        <label>
          <span>Texto que sera digitado</span>
          <textarea data-field="text" rows="5">${escapeHtml(event.text)}</textarea>
        </label>
        ${delayField}
      </div>
    `;
  }

  if (event.type === "tecla" || event.type === "atalho") {
    const repeatCount = Math.max(1, Number(event.details?.repeticoes ?? 1));
    return `
      <div class="field-stack">
        <label>
          <span>Tecla ou atalho</span>
          <div class="capture-inline">
            <input data-field="keys" type="text" value="${escapeHtml(event.keys.join("+"))}" />
            <button class="tree-open-button" data-action="record-key">Gravar tecla</button>
          </div>
        </label>
        <label>
          <span>Repetir quantas vezes</span>
          <input data-field="repeat" type="number" min="1" step="1" value="${escapeHtml(repeatCount)}" />
        </label>
        ${delayField}
      </div>
    `;
  }

  if (event.type === "mouse_click") {
    const details = event.details ?? {};
    const clicks = Number(details.clicks ?? details.cliques ?? 1);
    return `
      <div class="field-stack">
        <div class="triple-grid">
          <label>
            <span>X</span>
            <input data-field="x" type="number" step="1" value="${escapeHtml(details.x ?? 0)}" />
          </label>
          <label>
            <span>Y</span>
            <input data-field="y" type="number" step="1" value="${escapeHtml(details.y ?? 0)}" />
          </label>
          <label>
            <span>Botao</span>
            <select data-field="button">
              <option value="left" ${details.botao === "left" ? "selected" : ""}>Esquerdo</option>
              <option value="right" ${details.botao === "right" ? "selected" : ""}>Direito</option>
              <option value="middle" ${details.botao === "middle" ? "selected" : ""}>Meio</option>
            </select>
          </label>
          <label>
            <span>Cliques</span>
            <select data-field="clicks">
              <option value="1" ${clicks === 1 ? "selected" : ""}>1 clique</option>
              <option value="2" ${clicks === 2 ? "selected" : ""}>2 cliques</option>
            </select>
          </label>
        </div>
        <button class="tree-open-button capture-mouse-inline-button" data-action="record-mouse" type="button">Capturar mouse</button>
        ${delayField}
      </div>
    `;
  }

  if (event.type === "clicar_imagem") {
    const details = event.details ?? {};
    return `
      <div class="field-stack">
        <label>
          <span>Referencia visual</span>
          <div class="capture-inline">
            <input data-field="imagePath" type="text" value="${escapeHtml(details.imagem ?? "")}" placeholder="imagens/botao_salvar.png, painel_erro.png..." />
            <button class="tree-open-button" data-action="select-image" type="button">Selecionar referencia</button>
          </div>
        </label>
        <button class="tree-open-button" data-action="test-image-recognition" type="button">Testar reconhecimento</button>
        <div class="triple-grid">
          <label>
            <span>Timeout</span>
            <input data-field="timeout" type="number" min="0.1" step="0.5" value="${escapeHtml(details.timeout ?? 10)}" />
          </label>
          <label>
            <span>Confianca</span>
            <input data-field="confidence" type="number" min="0.1" max="1" step="0.05" value="${escapeHtml(details.confianca ?? 0.8)}" />
          </label>
          <label>
            <span>Perfil de busca</span>
            <select data-field="searchProfile">
              <option value="fast" ${normalizeRecognitionProfile(details.perfil_busca, "balanced") === "fast" ? "selected" : ""}>Rapido</option>
              <option value="balanced" ${normalizeRecognitionProfile(details.perfil_busca, "balanced") === "balanced" ? "selected" : ""}>Equilibrado</option>
              <option value="precise" ${normalizeRecognitionProfile(details.perfil_busca, "balanced") === "precise" ? "selected" : ""}>Preciso</option>
            </select>
          </label>
          <label>
            <span>Janela alvo</span>
            <input data-field="windowTitle" type="text" list="windowSuggestions" value="${escapeHtml(details.janela_alvo ?? "")}" placeholder="Ex.: Alterdata, painel, navegador..." />
          </label>
          <label>
            <span>Ao reconhecer</span>
            <select data-field="clickOnFind">
              <option value="single" ${recognitionClickModeFromDetails(details) === "single" ? "selected" : ""}>1 clique</option>
              <option value="double" ${recognitionClickModeFromDetails(details) === "double" ? "selected" : ""}>2 cliques</option>
              <option value="identify" ${recognitionClickModeFromDetails(details) === "identify" ? "selected" : ""}>Somente identificar</option>
            </select>
          </label>
          <label>
            <span>Se nao encontrar</span>
            <select data-field="failureAction">
              <option value="parar" ${String(details.ao_nao_encontrar ?? "parar") === "parar" ? "selected" : ""}>Parar</option>
              <option value="continuar" ${String(details.ao_nao_encontrar ?? "") === "continuar" || String(details.ao_nao_encontrar ?? "") === "pular" ? "selected" : ""}>Continuar</option>
              <option value="tentar_novamente" ${String(details.ao_nao_encontrar ?? "") === "tentar_novamente" ? "selected" : ""}>Tentar novamente</option>
              <option value="ir_para_bloco" ${String(details.ao_nao_encontrar ?? "") === "ir_para_bloco" ? "selected" : ""}>Ir para bloco</option>
            </select>
          </label>
          <label>
            <span>Ir para este bloco</span>
            <select data-field="failureBlock">
              ${blockTargetOptions(details.bloco_nao_encontrar ?? "", event.order)}
            </select>
          </label>
          <label>
            <span>Tentativas</span>
            <input data-field="retryCount" type="number" min="1" step="1" value="${escapeHtml(details.quantidade_tentativas ?? 1)}" />
          </label>
          <label>
            <span>Intervalo entre tentativas</span>
            <input data-field="retryInterval" type="number" min="0" step="0.5" value="${escapeHtml(details.intervalo_tentativas ?? 1)}" />
          </label>
        </div>
        ${delayField}
      </div>
    `;
  }

  if (event.type === "chrome_elemento_html") {
    return renderChromeBlockFields(event, "card", event.order);
  }

  if (event.type === "verificar_estado_botao") {
    const details = event.details ?? {};
    const activeAction = details.se_ativo?.acao ?? "continuar";
    const inactiveAction = details.se_desativado?.acao ?? "ir_para_sequencia";
    const missingAction = details.se_nao_encontrar?.acao ?? "parar";
    return `
      <div class="field-stack">
        <label>
          <span>Nome do bloco</span>
          <input data-field="verifyName" type="text" value="${escapeHtml(details.nome ?? "Verificar botao")}" />
        </label>
        <label>
          <span>Referencia ativa</span>
          <div class="capture-inline">
            <input data-field="verifyActiveImage" type="text" value="${escapeHtml(details.imagem_ativo ?? "")}" />
            <button class="tree-open-button" data-action="select-verify-active-image" type="button">Selecionar ativa</button>
          </div>
        </label>
        <label>
          <span>Referencia desativada</span>
          <div class="capture-inline">
            <input data-field="verifyInactiveImage" type="text" value="${escapeHtml(details.imagem_desativado ?? "")}" />
            <button class="tree-open-button" data-action="select-verify-inactive-image" type="button">Selecionar desativada</button>
          </div>
        </label>
        <div class="double-grid">
          <label>
            <span>Timeout</span>
            <input data-field="verifyTimeout" type="number" min="0.1" step="0.5" value="${escapeHtml(details.timeout ?? 5)}" />
          </label>
          <label>
            <span>Confianca</span>
            <input data-field="verifyConfidence" type="number" min="0.1" max="1" step="0.05" value="${escapeHtml(details.confianca ?? 0.85)}" />
          </label>
        </div>
        <div class="tree-inline-fields">
          <label><span>Se ativo</span><select data-field="verifyActiveAction"><option value="continuar" ${activeAction === "continuar" ? "selected" : ""}>Continuar</option><option value="pular_card" ${activeAction === "pular_card" ? "selected" : ""}>Pular card</option><option value="ir_para_sequencia" ${activeAction === "ir_para_sequencia" ? "selected" : ""}>Ir para sequencia</option><option value="parar" ${activeAction === "parar" ? "selected" : ""}>Parar</option></select></label>
          <label><span>Sequencia se ativo</span><input data-field="verifyActiveSequence" type="text" list="sequenceSuggestions" value="${escapeHtml(details.se_ativo?.sequencia ?? "")}" /></label>
          <label><span>Se desativado</span><select data-field="verifyInactiveAction"><option value="ir_para_sequencia" ${inactiveAction === "ir_para_sequencia" ? "selected" : ""}>Ir para sequencia</option><option value="continuar" ${inactiveAction === "continuar" ? "selected" : ""}>Continuar</option><option value="pular_card" ${inactiveAction === "pular_card" ? "selected" : ""}>Pular card</option><option value="parar" ${inactiveAction === "parar" ? "selected" : ""}>Parar</option></select></label>
          <label><span>Sequencia se desativado</span><input data-field="verifyInactiveSequence" type="text" list="sequenceSuggestions" value="${escapeHtml(details.se_desativado?.sequencia ?? "")}" /></label>
          <label><span>Se nao encontrar</span><select data-field="verifyMissingAction"><option value="parar" ${missingAction === "parar" ? "selected" : ""}>Parar</option><option value="ir_para_sequencia" ${missingAction === "ir_para_sequencia" ? "selected" : ""}>Ir para sequencia</option><option value="continuar" ${missingAction === "continuar" ? "selected" : ""}>Continuar</option><option value="pular_card" ${missingAction === "pular_card" ? "selected" : ""}>Pular card</option></select></label>
          <label><span>Sequencia se nao encontrar</span><input data-field="verifyMissingSequence" type="text" list="sequenceSuggestions" value="${escapeHtml(details.se_nao_encontrar?.sequencia ?? "")}" /></label>
        </div>
        ${delayField}
      </div>
    `;
  }

  if (event.type === "clicar_imagem") {
    const details = event.details ?? {};
    return `
      <div class="field-stack field-stack-recognition">
        <label class="recognition-reference-field">
          <span>Referencia visual</span>
          <div class="capture-inline">
            <input data-tree-field="imagePath" type="text" value="${escapeHtml(details.imagem ?? "")}" placeholder="imagens/botao_salvar.png, painel_erro.png..." />
            <button class="tree-open-button" data-tree-action="select-image" type="button">Selecionar referencia</button>
          </div>
        </label>
        <button class="tree-open-button recognition-test-inline" data-tree-action="test-image-recognition" type="button">Testar reconhecimento</button>
        <div class="tree-inline-fields tree-inline-fields-recognition">
          <label class="recognition-cell recognition-cell-sm">
            <span>Timeout</span>
            <input data-tree-field="timeout" type="number" min="0.1" step="0.5" value="${escapeHtml(details.timeout ?? 10)}" />
          </label>
          <label class="recognition-cell recognition-cell-sm">
            <span>Confianca</span>
            <input data-tree-field="confidence" type="number" min="0.1" max="1" step="0.05" value="${escapeHtml(details.confianca ?? 0.8)}" />
          </label>
          <label class="recognition-cell recognition-cell-sm">
            <span>Perfil</span>
            <select data-tree-field="searchProfile">
              <option value="fast" ${normalizeRecognitionProfile(details.perfil_busca, "balanced") === "fast" ? "selected" : ""}>Rapido</option>
              <option value="balanced" ${normalizeRecognitionProfile(details.perfil_busca, "balanced") === "balanced" ? "selected" : ""}>Equilibrado</option>
              <option value="precise" ${normalizeRecognitionProfile(details.perfil_busca, "balanced") === "precise" ? "selected" : ""}>Preciso</option>
            </select>
          </label>
          <label class="recognition-cell recognition-cell-wide">
            <span>Janela alvo</span>
            <input data-tree-field="windowTitle" type="text" list="windowSuggestions" value="${escapeHtml(details.janela_alvo ?? "")}" placeholder="Ex.: Alterdata, painel, navegador..." />
          </label>
          <label class="recognition-cell recognition-cell-sm">
            <span>Ao reconhecer</span>
            <select data-tree-field="clickOnFind">
              <option value="single" ${recognitionClickModeFromDetails(details) === "single" ? "selected" : ""}>1 clique</option>
              <option value="double" ${recognitionClickModeFromDetails(details) === "double" ? "selected" : ""}>2 cliques</option>
              <option value="identify" ${recognitionClickModeFromDetails(details) === "identify" ? "selected" : ""}>Identificar</option>
            </select>
          </label>
          ${renderSuccessFlowFields("data-tree-field", details.ao_sucesso ?? "continuar", details.bloco_sucesso ?? "", event.order)}
          <label class="recognition-cell recognition-cell-wide">
            <span>Se nao encontrar</span>
            <select data-tree-field="failureAction">
              <option value="parar" ${String(details.ao_nao_encontrar ?? "parar") === "parar" ? "selected" : ""}>Parar</option>
              <option value="continuar" ${String(details.ao_nao_encontrar ?? "") === "continuar" || String(details.ao_nao_encontrar ?? "") === "pular" ? "selected" : ""}>Continuar</option>
              <option value="tentar_novamente" ${String(details.ao_nao_encontrar ?? "") === "tentar_novamente" ? "selected" : ""}>Tentar novamente</option>
              <option value="ir_para_bloco" ${String(details.ao_nao_encontrar ?? "") === "ir_para_bloco" ? "selected" : ""}>Ir para bloco</option>
            </select>
          </label>
          <label class="recognition-cell recognition-cell-sm">
            <span>Ir para este bloco</span>
            <select data-tree-field="failureBlock">
              ${blockTargetOptions(details.bloco_nao_encontrar ?? "", event.order)}
            </select>
          </label>
          <label class="recognition-cell recognition-cell-sm">
            <span>Tentativas</span>
            <input data-tree-field="retryCount" type="number" min="1" step="1" value="${escapeHtml(details.quantidade_tentativas ?? 1)}" />
          </label>
          <label class="recognition-cell recognition-cell-sm">
            <span>Intervalo entre tentativas</span>
            <input data-tree-field="retryInterval" type="number" min="0" step="0.5" value="${escapeHtml(details.intervalo_tentativas ?? 1)}" />
          </label>
        </div>
      </div>
    `;
  }

  if (event.type === "chrome_elemento_html") {
    return renderChromeBlockFields(event, "tree", event.order);
  }

  if (event.type === "verificar_estado_botao") {
    const details = event.details ?? {};
    const activeAction = details.se_ativo?.acao ?? "continuar";
    const inactiveAction = details.se_desativado?.acao ?? "ir_para_sequencia";
    const missingAction = details.se_nao_encontrar?.acao ?? "parar";
    return `
      <div class="field-stack">
        <label>
          <span>Nome do bloco</span>
          <input data-tree-field="verifyName" type="text" value="${escapeHtml(details.nome ?? "Verificar botao")}" />
        </label>
        <label>
          <span>Referencia ativa</span>
          <div class="capture-inline">
            <input data-tree-field="verifyActiveImage" type="text" value="${escapeHtml(details.imagem_ativo ?? "")}" />
            <button class="tree-open-button" data-tree-action="select-verify-active-image" type="button">Selecionar ativa</button>
          </div>
        </label>
        <label>
          <span>Referencia desativada</span>
          <div class="capture-inline">
            <input data-tree-field="verifyInactiveImage" type="text" value="${escapeHtml(details.imagem_desativado ?? "")}" />
            <button class="tree-open-button" data-tree-action="select-verify-inactive-image" type="button">Selecionar desativada</button>
          </div>
        </label>
        <div class="tree-inline-fields">
          <label><span>Timeout</span><input data-tree-field="verifyTimeout" type="number" min="0.1" step="0.5" value="${escapeHtml(details.timeout ?? 5)}" /></label>
          <label><span>Confianca</span><input data-tree-field="verifyConfidence" type="number" min="0.1" max="1" step="0.05" value="${escapeHtml(details.confianca ?? 0.85)}" /></label>
          <label><span>Se ativo</span><select data-tree-field="verifyActiveAction"><option value="continuar" ${activeAction === "continuar" ? "selected" : ""}>Continuar</option><option value="pular_card" ${activeAction === "pular_card" ? "selected" : ""}>Pular card</option><option value="ir_para_sequencia" ${activeAction === "ir_para_sequencia" ? "selected" : ""}>Ir para sequencia</option><option value="parar" ${activeAction === "parar" ? "selected" : ""}>Parar</option></select></label>
          <label><span>Sequencia se ativo</span><input data-tree-field="verifyActiveSequence" type="text" list="sequenceSuggestions" value="${escapeHtml(details.se_ativo?.sequencia ?? "")}" /></label>
          <label><span>Se desativado</span><select data-tree-field="verifyInactiveAction"><option value="ir_para_sequencia" ${inactiveAction === "ir_para_sequencia" ? "selected" : ""}>Ir para sequencia</option><option value="continuar" ${inactiveAction === "continuar" ? "selected" : ""}>Continuar</option><option value="pular_card" ${inactiveAction === "pular_card" ? "selected" : ""}>Pular card</option><option value="parar" ${inactiveAction === "parar" ? "selected" : ""}>Parar</option></select></label>
          <label><span>Sequencia se desativado</span><input data-tree-field="verifyInactiveSequence" type="text" list="sequenceSuggestions" value="${escapeHtml(details.se_desativado?.sequencia ?? "")}" /></label>
          <label><span>Se nao encontrar</span><select data-tree-field="verifyMissingAction"><option value="parar" ${missingAction === "parar" ? "selected" : ""}>Parar</option><option value="ir_para_sequencia" ${missingAction === "ir_para_sequencia" ? "selected" : ""}>Ir para sequencia</option><option value="continuar" ${missingAction === "continuar" ? "selected" : ""}>Continuar</option><option value="pular_card" ${missingAction === "pular_card" ? "selected" : ""}>Pular card</option></select></label>
          <label><span>Sequencia se nao encontrar</span><input data-tree-field="verifyMissingSequence" type="text" list="sequenceSuggestions" value="${escapeHtml(details.se_nao_encontrar?.sequencia ?? "")}" /></label>
        </div>
      </div>
    `;
  }

  const details = event.details ?? {};
  const workbookId = details.arquivo || state.composerWorkbookId || state.workbook?.default_workbook || "";
  const workbookOptions = availableWorkbooks()
    .map(
      (workbook) =>
        `<option value="${escapeHtml(workbook.id)}" ${workbook.id === workbookId ? "selected" : ""}>${escapeHtml(workbook.file_name)}</option>`
    )
    .join("");
  const availableSheets = workbookSheetsFor(workbookId);
  const selectedSheet = availableSheets.some((sheet) => sheet.name === details.aba)
    ? details.aba
    : availableSheets[0]?.name ?? "";
  const sheetOptions = availableSheets
    .map(
      (sheet) =>
        `<option value="${escapeHtml(sheet.name)}" ${sheet.name === selectedSheet ? "selected" : ""}>${escapeHtml(sheet.name)}</option>`
    )
    .join("");
  const availableColumns = columnsForSheetInWorkbook(workbookId, selectedSheet);
  const selectedColumn = availableColumns.includes(details.coluna) ? details.coluna : availableColumns[0] ?? "";
  const columnOptions = availableColumns
    .map(
      (column) =>
        `<option value="${escapeHtml(column)}" ${column === selectedColumn ? "selected" : ""}>${escapeHtml(column)}</option>`
    )
    .join("");

  return `
    <div class="field-stack">
      <div class="double-grid">
        <label>
          <span>Arquivo</span>
          <select data-field="workbook">${workbookOptions}</select>
        </label>
        <label>
          <span>Aba</span>
          <select data-field="sheet">${sheetOptions}</select>
        </label>
        <label>
          <span>Coluna</span>
          <select data-field="column">${columnOptions}</select>
        </label>
      </div>
      <div class="double-grid">
        <label>
          <span>Acao apos item</span>
          <div class="capture-inline">
            <input data-field="afterAction" type="text" value="${escapeHtml(details.acao_apos_item_texto ?? "nenhuma")}" />
            <button class="tree-open-button" data-action="record-after-action" type="button">Gravar tecla</button>
          </div>
        </label>
        <label>
          <span>Intervalo entre itens</span>
          <input data-field="intervalBetween" type="number" min="0" step="0.1" value="${escapeHtml(details.intervalo_entre_itens ?? 0.5)}" />
        </label>
      </div>
      ${delayField}
      <p class="muted-copy">${(details.valores ?? []).length} itens encontrados nessa coluna.</p>
    </div>
  `;
}

function renderTreeEditorFields(event) {
  if (event.type === "texto_livre") {
    return `
      <div class="field-stack">
        <label>
          <span>Texto do bloco</span>
          <textarea data-tree-field="text" rows="3">${escapeHtml(event.text)}</textarea>
        </label>
        <div class="tree-inline-fields">
          ${renderSuccessFlowFields("data-tree-field", event.details?.ao_sucesso ?? "continuar", event.details?.bloco_sucesso ?? "", event.order)}
        </div>
      </div>
    `;
  }

  if (event.type === "tecla" || event.type === "atalho") {
    const repeatCount = Math.max(1, Number(event.details?.repeticoes ?? 1));
    return `
      <div class="field-stack">
        <label>
          <span>Tecla ou atalho</span>
          <input data-tree-field="keys" type="text" value="${escapeHtml(event.keys.join("+"))}" />
        </label>
        <label>
          <span>Repetir quantas vezes</span>
          <input data-tree-field="repeat" type="number" min="1" step="1" value="${escapeHtml(repeatCount)}" />
        </label>
        <div class="tree-inline-fields">
          ${renderSuccessFlowFields("data-tree-field", event.details?.ao_sucesso ?? "continuar", event.details?.bloco_sucesso ?? "", event.order)}
        </div>
      </div>
    `;
  }

  if (event.type === "mouse_click") {
    const details = event.details ?? {};
    const clicks = Number(details.clicks ?? details.cliques ?? 1);
    return `
      <div class="field-stack">
        <div class="tree-inline-fields-wide">
          <label>
            <span>X</span>
            <input data-tree-field="x" type="number" step="1" value="${escapeHtml(details.x ?? 0)}" />
          </label>
          <label>
            <span>Y</span>
            <input data-tree-field="y" type="number" step="1" value="${escapeHtml(details.y ?? 0)}" />
          </label>
          <label>
            <span>Botao</span>
            <select data-tree-field="button">
              <option value="left" ${details.botao === "left" ? "selected" : ""}>Esquerdo</option>
              <option value="right" ${details.botao === "right" ? "selected" : ""}>Direito</option>
              <option value="middle" ${details.botao === "middle" ? "selected" : ""}>Meio</option>
            </select>
          </label>
          <label>
            <span>Cliques</span>
            <select data-tree-field="clicks">
              <option value="1" ${clicks === 1 ? "selected" : ""}>1 clique</option>
              <option value="2" ${clicks === 2 ? "selected" : ""}>2 cliques</option>
            </select>
          </label>
        </div>
        <button class="tree-open-button capture-mouse-inline-button" data-tree-action="record-mouse" type="button">Capturar mouse</button>
        <div class="tree-inline-fields">
          ${renderSuccessFlowFields("data-tree-field", details.ao_sucesso ?? "continuar", details.bloco_sucesso ?? "", event.order)}
        </div>
      </div>
    `;
  }

  if (event.type === "clicar_imagem") {
    const details = event.details ?? {};
    return `
      <div class="field-stack">
        <label>
          <span>Referencia visual</span>
          <div class="capture-inline">
            <input data-tree-field="imagePath" type="text" value="${escapeHtml(details.imagem ?? "")}" placeholder="imagens/botao_salvar.png, painel_erro.png..." />
            <button class="tree-open-button" data-tree-action="select-image" type="button">Selecionar referencia</button>
          </div>
        </label>
        <div class="tree-inline-fields">
          <label>
            <span>Timeout</span>
            <input data-tree-field="timeout" type="number" min="0.1" step="0.5" value="${escapeHtml(details.timeout ?? 10)}" />
          </label>
          <label>
            <span>Confianca</span>
            <input data-tree-field="confidence" type="number" min="0.1" max="1" step="0.05" value="${escapeHtml(details.confianca ?? 0.8)}" />
          </label>
          <label>
            <span>Perfil de busca</span>
            <select data-tree-field="searchProfile">
              <option value="fast" ${normalizeRecognitionProfile(details.perfil_busca, "balanced") === "fast" ? "selected" : ""}>Rapido</option>
              <option value="balanced" ${normalizeRecognitionProfile(details.perfil_busca, "balanced") === "balanced" ? "selected" : ""}>Equilibrado</option>
              <option value="precise" ${normalizeRecognitionProfile(details.perfil_busca, "balanced") === "precise" ? "selected" : ""}>Preciso</option>
            </select>
          </label>
          <label>
            <span>Janela alvo</span>
            <input data-tree-field="windowTitle" type="text" list="windowSuggestions" value="${escapeHtml(details.janela_alvo ?? "")}" placeholder="Ex.: Alterdata, painel, navegador..." />
          </label>
          <label>
            <span>Ao reconhecer</span>
            <select data-tree-field="clickOnFind">
              <option value="single" ${recognitionClickModeFromDetails(details) === "single" ? "selected" : ""}>1 clique</option>
              <option value="double" ${recognitionClickModeFromDetails(details) === "double" ? "selected" : ""}>2 cliques</option>
              <option value="identify" ${recognitionClickModeFromDetails(details) === "identify" ? "selected" : ""}>Identificar</option>
            </select>
          </label>
          ${renderSuccessFlowFields("data-tree-field", details.ao_sucesso ?? "continuar", details.bloco_sucesso ?? "", event.order)}
          <label>
            <span>Se nao encontrar</span>
            <select data-tree-field="failureAction">
              <option value="parar" ${String(details.ao_nao_encontrar ?? "parar") === "parar" ? "selected" : ""}>Parar</option>
              <option value="continuar" ${String(details.ao_nao_encontrar ?? "") === "continuar" || String(details.ao_nao_encontrar ?? "") === "pular" ? "selected" : ""}>Continuar</option>
              <option value="tentar_novamente" ${String(details.ao_nao_encontrar ?? "") === "tentar_novamente" ? "selected" : ""}>Tentar novamente</option>
              <option value="ir_para_bloco" ${String(details.ao_nao_encontrar ?? "") === "ir_para_bloco" ? "selected" : ""}>Ir para bloco</option>
            </select>
          </label>
          <label>
            <span>Ir para este bloco</span>
            <select data-tree-field="failureBlock">
              ${blockTargetOptions(details.bloco_nao_encontrar ?? "", event.order)}
            </select>
          </label>
          <label>
            <span>Tentativas</span>
            <input data-tree-field="retryCount" type="number" min="1" step="1" value="${escapeHtml(details.quantidade_tentativas ?? 1)}" />
          </label>
          <label>
            <span>Intervalo entre tentativas</span>
            <input data-tree-field="retryInterval" type="number" min="0" step="0.5" value="${escapeHtml(details.intervalo_tentativas ?? 1)}" />
          </label>
        </div>
      </div>
    `;
  }

  if (event.type === "verificar_estado_botao") {
    const details = event.details ?? {};
    const activeAction = details.se_ativo?.acao ?? "continuar";
    const inactiveAction = details.se_desativado?.acao ?? "ir_para_sequencia";
    const missingAction = details.se_nao_encontrar?.acao ?? "parar";
    return `
      <div class="field-stack">
        <label>
          <span>Nome do bloco</span>
          <input data-tree-field="verifyName" type="text" value="${escapeHtml(details.nome ?? "Verificar botao")}" />
        </label>
        <label>
          <span>Referencia ativa</span>
          <div class="capture-inline">
            <input data-tree-field="verifyActiveImage" type="text" value="${escapeHtml(details.imagem_ativo ?? "")}" />
            <button class="tree-open-button" data-tree-action="select-verify-active-image" type="button">Selecionar ativa</button>
          </div>
        </label>
        <label>
          <span>Referencia desativada</span>
          <div class="capture-inline">
            <input data-tree-field="verifyInactiveImage" type="text" value="${escapeHtml(details.imagem_desativado ?? "")}" />
            <button class="tree-open-button" data-tree-action="select-verify-inactive-image" type="button">Selecionar desativada</button>
          </div>
        </label>
        <div class="tree-inline-fields">
          <label><span>Timeout</span><input data-tree-field="verifyTimeout" type="number" min="0.1" step="0.5" value="${escapeHtml(details.timeout ?? 5)}" /></label>
          <label><span>Confianca</span><input data-tree-field="verifyConfidence" type="number" min="0.1" max="1" step="0.05" value="${escapeHtml(details.confianca ?? 0.85)}" /></label>
          <label><span>Se ativo</span><select data-tree-field="verifyActiveAction"><option value="continuar" ${activeAction === "continuar" ? "selected" : ""}>Continuar</option><option value="pular_card" ${activeAction === "pular_card" ? "selected" : ""}>Pular card</option><option value="ir_para_sequencia" ${activeAction === "ir_para_sequencia" ? "selected" : ""}>Ir para sequencia</option><option value="parar" ${activeAction === "parar" ? "selected" : ""}>Parar</option></select></label>
          <label><span>Sequencia se ativo</span><input data-tree-field="verifyActiveSequence" type="text" list="sequenceSuggestions" value="${escapeHtml(details.se_ativo?.sequencia ?? "")}" /></label>
          <label><span>Se desativado</span><select data-tree-field="verifyInactiveAction"><option value="ir_para_sequencia" ${inactiveAction === "ir_para_sequencia" ? "selected" : ""}>Ir para sequencia</option><option value="continuar" ${inactiveAction === "continuar" ? "selected" : ""}>Continuar</option><option value="pular_card" ${inactiveAction === "pular_card" ? "selected" : ""}>Pular card</option><option value="parar" ${inactiveAction === "parar" ? "selected" : ""}>Parar</option></select></label>
          <label><span>Sequencia se desativado</span><input data-tree-field="verifyInactiveSequence" type="text" list="sequenceSuggestions" value="${escapeHtml(details.se_desativado?.sequencia ?? "")}" /></label>
          <label><span>Se nao encontrar</span><select data-tree-field="verifyMissingAction"><option value="parar" ${missingAction === "parar" ? "selected" : ""}>Parar</option><option value="ir_para_sequencia" ${missingAction === "ir_para_sequencia" ? "selected" : ""}>Ir para sequencia</option><option value="continuar" ${missingAction === "continuar" ? "selected" : ""}>Continuar</option><option value="pular_card" ${missingAction === "pular_card" ? "selected" : ""}>Pular card</option></select></label>
          <label><span>Sequencia se nao encontrar</span><input data-tree-field="verifyMissingSequence" type="text" list="sequenceSuggestions" value="${escapeHtml(details.se_nao_encontrar?.sequencia ?? "")}" /></label>
        </div>
      </div>
    `;
  }

  const details = event.details ?? {};
  const workbookId = details.arquivo || state.composerWorkbookId || state.workbook?.default_workbook || "";
  const workbookOptions = availableWorkbooks()
    .map(
      (workbook) =>
        `<option value="${escapeHtml(workbook.id)}" ${workbook.id === workbookId ? "selected" : ""}>${escapeHtml(workbook.file_name)}</option>`
    )
    .join("");
  const availableSheets = workbookSheetsFor(workbookId);
  const selectedSheet = availableSheets.some((sheet) => sheet.name === details.aba)
    ? details.aba
    : availableSheets[0]?.name ?? "";
  const sheetOptions = availableSheets
    .map(
      (sheet) =>
        `<option value="${escapeHtml(sheet.name)}" ${sheet.name === selectedSheet ? "selected" : ""}>${escapeHtml(sheet.name)}</option>`
    )
    .join("");
  const availableColumns = columnsForSheetInWorkbook(workbookId, selectedSheet);
  const selectedColumn = availableColumns.includes(details.coluna) ? details.coluna : availableColumns[0] ?? "";
  const columnOptions = availableColumns
    .map(
      (column) =>
        `<option value="${escapeHtml(column)}" ${column === selectedColumn ? "selected" : ""}>${escapeHtml(column)}</option>`
    )
    .join("");

  return `
    <div class="tree-inline-fields">
      <label>
        <span>Arquivo</span>
        <select data-tree-field="workbook">${workbookOptions}</select>
      </label>
      <label>
        <span>Aba</span>
        <select data-tree-field="sheet">${sheetOptions}</select>
      </label>
      <label>
        <span>Coluna</span>
        <select data-tree-field="column">${columnOptions}</select>
      </label>
      <label>
        <span>Acao apos item</span>
        <div class="capture-inline">
          <input data-tree-field="afterAction" type="text" value="${escapeHtml(details.acao_apos_item_texto ?? "nenhuma")}" />
          <button class="tree-open-button" data-tree-action="record-after-action" type="button">Gravar tecla</button>
        </div>
      </label>
      <label>
        <span>Intervalo entre itens</span>
        <input data-tree-field="intervalBetween" type="number" min="0" step="0.1" value="${escapeHtml(details.intervalo_entre_itens ?? 0.5)}" />
      </label>
      ${renderSuccessFlowFields("data-tree-field", details.ao_sucesso ?? "continuar", details.bloco_sucesso ?? "", event.order)}
    </div>
  `;
}

function renderInsertPanel(order) {
  if (!state.insertPanel || state.insertPanel.targetOrder !== order) {
    return "";
  }

  const panel = state.insertPanel;
  const workbookId = panel.workbook || state.composerWorkbookId || state.workbook?.default_workbook || "";
  const workbookOptions = availableWorkbooks()
    .map(
      (workbook) =>
        `<option value="${escapeHtml(workbook.id)}" ${workbook.id === workbookId ? "selected" : ""}>${escapeHtml(workbook.file_name)}</option>`
    )
    .join("");
  const sheets = workbookSheetsFor(workbookId);
  const selectedSheet = sheets.some((sheet) => sheet.name === panel.sheet) ? panel.sheet : sheets[0]?.name ?? "";
  const sheetOptions = sheets
    .map(
      (sheet) =>
        `<option value="${escapeHtml(sheet.name)}" ${sheet.name === selectedSheet ? "selected" : ""}>${escapeHtml(sheet.name)}</option>`
    )
    .join("");
  const columns = columnsForSheetInWorkbook(workbookId, selectedSheet);
  const selectedColumn = columns.includes(panel.column) ? panel.column : columns[0] ?? "";
  const columnOptions = columns
    .map(
      (column) =>
        `<option value="${escapeHtml(column)}" ${column === selectedColumn ? "selected" : ""}>${escapeHtml(column)}</option>`
    )
    .join("");

  let body = "";
  if (panel.type === "text") {
    body = `
      <div class="field-stack">
        <label>
          <span>Texto do novo bloco</span>
          <textarea data-insert-field="text" rows="3">${escapeHtml(panel.text)}</textarea>
        </label>
        <div class="tree-inline-fields">
          ${renderSuccessFlowFields("data-insert-field", panel.successAction ?? "continuar", panel.successBlock ?? "", order)}
        </div>
      </div>
    `;
  } else if (panel.type === "key") {
    body = `
      <div class="field-stack">
        <label>
          <span>Tecla ou atalho</span>
          <div class="capture-inline">
            <input data-insert-field="keys" type="text" value="${escapeHtml(panel.keys)}" placeholder="tab, enter, alt+f..." />
            <button class="tree-open-button" data-insert-action="record-key">Gravar tecla</button>
          </div>
        </label>
        <label>
          <span>Repetir quantas vezes</span>
          <input data-insert-field="repeat" type="number" min="1" step="1" value="${escapeHtml(panel.repeat ?? 1)}" />
        </label>
        <div class="tree-inline-fields">
          ${renderSuccessFlowFields("data-insert-field", panel.successAction ?? "continuar", panel.successBlock ?? "", order)}
        </div>
      </div>
    `;
  } else if (panel.type === "mouse") {
    body = `
      <div class="field-stack">
        <div class="tree-inline-fields-wide">
          <label>
            <span>X</span>
            <input data-insert-field="x" type="number" step="1" value="${escapeHtml(panel.x)}" />
          </label>
          <label>
            <span>Y</span>
            <input data-insert-field="y" type="number" step="1" value="${escapeHtml(panel.y)}" />
          </label>
          <label>
            <span>Botao</span>
            <select data-insert-field="button">
              <option value="left" ${panel.button === "left" ? "selected" : ""}>Esquerdo</option>
              <option value="right" ${panel.button === "right" ? "selected" : ""}>Direito</option>
              <option value="middle" ${panel.button === "middle" ? "selected" : ""}>Meio</option>
            </select>
          </label>
          <label>
            <span>Cliques</span>
            <select data-insert-field="clicks">
              <option value="1" ${Number(panel.clicks ?? 1) === 1 ? "selected" : ""}>1 clique</option>
              <option value="2" ${Number(panel.clicks ?? 1) === 2 ? "selected" : ""}>2 cliques</option>
            </select>
          </label>
        </div>
        <button class="tree-open-button capture-mouse-inline-button" data-insert-action="record-mouse" type="button">Capturar mouse</button>
        <div class="tree-inline-fields">
          ${renderSuccessFlowFields("data-insert-field", panel.successAction ?? "continuar", panel.successBlock ?? "", order)}
        </div>
      </div>
    `;
  } else if (panel.type === "image") {
    body = `
      <div class="field-stack">
        <label>
          <span>Referencia visual</span>
          <div class="capture-inline">
            <input data-insert-field="imagePath" type="text" value="${escapeHtml(panel.imagePath ?? "")}" placeholder="imagens/botao_salvar.png, painel_erro.png..." />
            <button class="tree-open-button" data-insert-action="select-image" type="button">Selecionar referencia</button>
          </div>
        </label>
        <div class="tree-inline-fields">
          <label>
            <span>Timeout</span>
            <input data-insert-field="timeout" type="number" min="0.1" step="0.5" value="${escapeHtml(panel.timeout ?? 10)}" />
          </label>
          <label>
            <span>Confianca</span>
            <input data-insert-field="confidence" type="number" min="0.1" max="1" step="0.05" value="${escapeHtml(panel.confidence ?? 0.8)}" />
          </label>
          <label>
            <span>Perfil de busca</span>
            <select data-insert-field="searchProfile">
              <option value="fast" ${normalizeRecognitionProfile(panel.searchProfile, "balanced") === "fast" ? "selected" : ""}>Rapido</option>
              <option value="balanced" ${normalizeRecognitionProfile(panel.searchProfile, "balanced") === "balanced" ? "selected" : ""}>Equilibrado</option>
              <option value="precise" ${normalizeRecognitionProfile(panel.searchProfile, "balanced") === "precise" ? "selected" : ""}>Preciso</option>
            </select>
          </label>
          <label>
            <span>Janela alvo</span>
            <input data-insert-field="windowTitle" type="text" list="windowSuggestions" value="${escapeHtml(panel.windowTitle ?? "")}" placeholder="Ex.: Alterdata, painel, navegador..." />
          </label>
          <label>
            <span>Ao reconhecer</span>
            <select data-insert-field="clickOnFind">
              <option value="single" ${String(panel.recognitionClickMode ?? "single") === "single" ? "selected" : ""}>1 clique</option>
              <option value="double" ${String(panel.recognitionClickMode ?? "single") === "double" ? "selected" : ""}>2 cliques</option>
              <option value="identify" ${String(panel.recognitionClickMode ?? "single") === "identify" ? "selected" : ""}>Identificar</option>
            </select>
          </label>
          ${renderSuccessFlowFields("data-insert-field", panel.successAction ?? "continuar", panel.successBlock ?? "", order)}
          <label>
            <span>Se nao encontrar</span>
            <select data-insert-field="failureAction">
              <option value="parar" ${String(panel.failureAction ?? "parar") === "parar" ? "selected" : ""}>Parar</option>
              <option value="continuar" ${String(panel.failureAction ?? "") === "continuar" || String(panel.failureAction ?? "") === "pular" ? "selected" : ""}>Continuar</option>
              <option value="tentar_novamente" ${String(panel.failureAction ?? "") === "tentar_novamente" ? "selected" : ""}>Tentar novamente</option>
              <option value="ir_para_bloco" ${String(panel.failureAction ?? "") === "ir_para_bloco" ? "selected" : ""}>Ir para bloco</option>
            </select>
          </label>
          <label>
            <span>Ir para este bloco</span>
            <select data-insert-field="failureBlock">
              ${blockTargetOptions(panel.failureBlock ?? "", order)}
            </select>
          </label>
          <label>
            <span>Tentativas</span>
            <input data-insert-field="retryCount" type="number" min="1" step="1" value="${escapeHtml(panel.retryCount ?? 1)}" />
          </label>
          <label>
            <span>Intervalo entre tentativas</span>
            <input data-insert-field="retryInterval" type="number" min="0" step="0.5" value="${escapeHtml(panel.retryInterval ?? 1)}" />
          </label>
        </div>
      </div>
    `;
  } else if (panel.type === "chrome") {
    const analysis = panel.chromeAnalysis || {};
    body = `
      <div class="field-stack">
        <label>
          <span>Nome do bloco</span>
          <input data-insert-field="chromeName" type="text" value="${escapeHtml(panel.chromeName ?? "Chrome / Elemento HTML")}" />
        </label>
        <label>
          <span>HTML do elemento</span>
          <textarea data-insert-field="chromeHtml" rows="5" placeholder="<input ...> ou <button ...>">${escapeHtml(panel.chromeHtml ?? "")}</textarea>
        </label>
        <input data-insert-field="chromeAnalysis" type="hidden" value="${escapeHtml(JSON.stringify(analysis))}" />
        <div class="recognition-action-row">
          <button class="tree-open-button" data-insert-action="analyze-chrome-html" type="button">Analisar HTML</button>
        </div>
        <div class="chrome-preview-card" data-chrome-preview>
          ${renderChromePreviewHtml(analysis)}
        </div>
        <div class="tree-inline-fields">
          <label>
            <span>Metodo de busca</span>
            <select data-insert-field="chromeTargetMethod">
              ${renderChromeMethodOptions(analysis, panel.chromeTargetMethod ?? analysis?.alvo_recomendado?.metodo ?? "css")}
            </select>
          </label>
          <label>
            <span>Alvo</span>
            <input data-insert-field="chromeTargetValue" type="text" value="${escapeHtml(panel.chromeTargetValue ?? analysis?.alvo_recomendado?.valor ?? "")}" />
          </label>
          <label>
            <span>Ação</span>
            <select data-insert-field="chromeActionType">
              ${renderChromeActionOptions(chromeKindFromAnalysis(analysis), panel.chromeActionType ?? analysis?.acao_sugerida?.tipo ?? "clicar")}
            </select>
          </label>
          <label>
            <span>Origem do valor</span>
            <select data-insert-field="chromeValueSource">
              <option value="texto_fixo" ${String(panel.chromeValueSource ?? analysis?.acao_sugerida?.origem_valor ?? "texto_fixo") === "texto_fixo" ? "selected" : ""}>Texto fixo</option>
              <option value="variavel" ${String(panel.chromeValueSource ?? "") === "variavel" ? "selected" : ""}>Variavel</option>
              <option value="planilha" ${String(panel.chromeValueSource ?? "") === "planilha" ? "selected" : ""}>Planilha</option>
            </select>
          </label>
          <label>
            <span>Valor</span>
            <input data-insert-field="chromeActionValue" type="text" value="${escapeHtml(panel.chromeActionValue ?? analysis?.acao_sugerida?.valor ?? "")}" />
          </label>
          <label>
            <span>Salvar texto em</span>
            <input data-insert-field="chromeSaveAs" type="text" value="${escapeHtml(panel.chromeSaveAs ?? "")}" />
          </label>
          <label>
            <span>Timeout (ms)</span>
            <input data-insert-field="chromeTimeout" type="number" min="500" step="500" value="${escapeHtml(panel.chromeTimeout ?? 10000)}" />
          </label>
          <label>
            <span>Pressionar depois</span>
            <select data-insert-field="chromePressAfter">
              <option value="" ${!(panel.chromePressAfter) ? "selected" : ""}>Nada</option>
              <option value="Enter" ${String(panel.chromePressAfter ?? "") === "Enter" ? "selected" : ""}>Enter</option>
              <option value="Tab" ${String(panel.chromePressAfter ?? "") === "Tab" ? "selected" : ""}>Tab</option>
            </select>
          </label>
          <label>
            <span>Ao concluir</span>
            <select data-insert-field="chromeSuccessAction">
              <option value="continuar" ${String(panel.chromeSuccessAction ?? "continuar") === "continuar" ? "selected" : ""}>Continuar</option>
              <option value="ir_para_bloco" ${String(panel.chromeSuccessAction ?? "") === "ir_para_bloco" ? "selected" : ""}>Ir para bloco</option>
            </select>
          </label>
          <label>
            <span>Bloco apos sucesso</span>
            <select data-insert-field="chromeSuccessBlock">
              ${blockTargetOptions(panel.chromeSuccessBlock ?? "", order)}
            </select>
          </label>
          <label>
            <span>Falha</span>
            <select data-insert-field="chromeFailureAction">
              <option value="parar" ${String(panel.chromeFailureAction ?? "parar") === "parar" ? "selected" : ""}>Parar</option>
              <option value="continuar" ${String(panel.chromeFailureAction ?? "") === "continuar" ? "selected" : ""}>Continuar</option>
              <option value="tentar_novamente" ${String(panel.chromeFailureAction ?? "") === "tentar_novamente" ? "selected" : ""}>Tentar novamente</option>
              <option value="ir_para_bloco" ${String(panel.chromeFailureAction ?? "") === "ir_para_bloco" ? "selected" : ""}>Ir para bloco</option>
            </select>
          </label>
          <label>
            <span>Ir para bloco</span>
            <select data-insert-field="chromeFailureBlock">
              ${blockTargetOptions(panel.chromeFailureBlock ?? "", order)}
            </select>
          </label>
          <label>
            <span>Tentativas</span>
            <input data-insert-field="chromeRetryCount" type="number" min="1" step="1" value="${escapeHtml(panel.chromeRetryCount ?? 1)}" />
          </label>
          <label>
            <span>Intervalo tentativas</span>
            <input data-insert-field="chromeRetryInterval" type="number" min="0" step="0.5" value="${escapeHtml(panel.chromeRetryInterval ?? 0.5)}" />
          </label>
        </div>
        <div class="inline-field">
          <label class="inline-checkbox">
            <input data-insert-field="chromeClearBefore" type="checkbox" ${panel.chromeClearBefore !== false ? "checked" : ""} />
            <span>Limpar antes</span>
          </label>
          <label class="inline-checkbox">
            <input data-insert-field="chromeFallbackVisual" type="checkbox" ${panel.chromeFallbackVisual ? "checked" : ""} />
            <span>Fallback visual</span>
          </label>
          <div class="capture-inline">
            <input data-insert-field="chromeFallbackImage" type="text" value="${escapeHtml(panel.chromeFallbackImage ?? "")}" placeholder="imagens/campo.png" />
            <button class="tree-open-button" data-insert-action="select-chrome-fallback-image" type="button">Selecionar fallback</button>
          </div>
        </div>
      </div>
    `;
  } else {
    body = `
      <div class="tree-inline-fields">
        <label>
          <span>Arquivo</span>
          <select data-insert-field="workbook">${workbookOptions}</select>
        </label>
        <label>
          <span>Aba</span>
          <select data-insert-field="sheet">${sheetOptions}</select>
        </label>
        <label>
          <span>Coluna</span>
          <select data-insert-field="column">${columnOptions}</select>
        </label>
        <label>
          <span>Acao apos item</span>
          <div class="capture-inline">
            <input data-insert-field="afterAction" type="text" value="${escapeHtml(panel.afterAction)}" />
            <button class="tree-open-button" data-insert-action="record-after-action" type="button">Gravar tecla</button>
          </div>
        </label>
        <label>
          <span>Intervalo entre itens</span>
          <input data-insert-field="intervalBetween" type="number" min="0" step="0.1" value="${escapeHtml(panel.intervalBetween)}" />
        </label>
        ${renderSuccessFlowFields("data-insert-field", panel.successAction ?? "continuar", panel.successBlock ?? "", order)}
      </div>
    `;
  }

  return `
    <div class="insert-card-panel" data-target-order="${order}">
      <div class="insert-card-header">
        <div>
          <p class="panel-kicker">Novo bloco</p>
          <h4>${panel.position === "before" ? "Inserir antes" : "Inserir depois"} do bloco ${order}</h4>
        </div>
        <button class="micro-button" data-insert-action="cancel">Fechar</button>
      </div>
      <div class="insert-type-row">
        <button class="insert-type-button ${panel.type === "key" ? "is-active" : ""}" data-insert-type="key">Tecla</button>
        <button class="insert-type-button ${panel.type === "text" ? "is-active" : ""}" data-insert-type="text">Texto</button>
        <button class="insert-type-button ${panel.type === "mouse" ? "is-active" : ""}" data-insert-type="mouse">Mouse</button>
        <button class="insert-type-button ${panel.type === "image" ? "is-active" : ""}" data-insert-type="image">Reconhecimento</button>
        <button class="insert-type-button ${panel.type === "chrome" ? "is-active" : ""}" data-insert-type="chrome">Chrome HTML</button>
        <button class="insert-type-button ${panel.type === "spreadsheet" ? "is-active" : ""}" data-insert-type="spreadsheet">Planilha</button>
      </div>
      <div class="insert-card-body">
        ${body}
        <label>
          <span>Tempo antes do novo bloco</span>
          <input data-insert-field="delay" type="number" min="0" step="0.1" value="${escapeHtml(panel.delay)}" />
        </label>
      </div>
      <div class="insert-card-actions">
        <button class="tree-save-button" data-insert-action="save">Adicionar bloco</button>
      </div>
    </div>
  `;
}

function renderEmptyCommandMapStarter() {
  if (!state.insertPanel || state.insertPanel.targetOrder !== 0) {
    return `
      <div class="empty-command-map-state">
        <div class="empty-command-map-copy">
          <p class="panel-kicker">Mapa vazio</p>
          <h3>Crie o primeiro bloco por aqui</h3>
          <p>A automacao ainda nao tem comandos. Escolha um tipo abaixo para comecar direto no mapa.</p>
        </div>
        <div class="empty-command-map-actions">
          <button class="insert-type-button is-active" data-empty-insert-type="key" type="button">Tecla</button>
          <button class="insert-type-button" data-empty-insert-type="text" type="button">Texto</button>
          <button class="insert-type-button" data-empty-insert-type="mouse" type="button">Mouse</button>
          <button class="insert-type-button" data-empty-insert-type="image" type="button">Reconhecimento</button>
          <button class="insert-type-button" data-empty-insert-type="chrome" type="button">Chrome HTML</button>
          <button class="insert-type-button" data-empty-insert-type="spreadsheet" type="button">Planilha</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="empty-command-map-panel-wrap">
      ${renderInsertPanel(0)}
    </div>
  `;
}

function normalizeCapturedKey(event) {
  const raw = (event.key || "").toLowerCase();
  const specialMap = {
    " ": "space",
    spacebar: "space",
    escape: "esc",
    esc: "esc",
    arrowup: "up",
    arrowdown: "down",
    arrowleft: "left",
    arrowright: "right",
    control: "ctrl",
    shift: "shift",
    alt: "alt",
    meta: "cmd",
  };

  if (specialMap[raw]) {
    return specialMap[raw];
  }
  if (raw.length === 1) {
    return raw;
  }
  return raw;
}

function beginKeyCapture(target) {
  if (state.captureTarget) {
    setMessage("Ja existe uma captura em andamento.", "error");
    return;
  }

  clearCaptureBlurTimer();
  state.captureTarget = { ...target, mode: "key", requestId: ++state.captureSequence };
  showCaptureOverlay("Aperte a tecla ou o atalho desejado. Quando capturar, esta janela some automaticamente.");
  setMessage("Pressione a tecla ou combinacao agora. Use ESC para cancelar.", "success");
}

async function beginMouseCapture(target) {
  if (state.captureTarget) {
    setMessage("Ja existe uma captura em andamento.", "error");
    return;
  }

  clearCaptureBlurTimer();
  const requestId = ++state.captureSequence;
  state.captureTarget = { ...target, mode: "mouse", requestId };
  showCaptureOverlay("Clique no ponto exato da tela. Vamos capturar a posicao do mouse e o botao usado nesse clique.");
  setMessage("Captura de mouse iniciada. Clique na tela desejada para preencher o bloco.", "success");

  try {
    const payload = await invoke("capture_mouse_click");
    if (!state.captureTarget || state.captureTarget.mode !== "mouse" || state.captureTarget.requestId !== requestId) {
      return;
    }

    writeCapturedMouse(payload);
    state.captureTarget = null;
    hideCaptureOverlay();
    setMessage(
      `Clique gravado: ${formatMouseButtonLabel(payload.button)} em X ${payload.x} | Y ${payload.y}.`,
      "success"
    );
  } catch (error) {
    if (!state.captureTarget || state.captureTarget.mode !== "mouse" || state.captureTarget.requestId !== requestId) {
      return;
    }

    state.captureTarget = null;
    hideCaptureOverlay();
    setMessage(String(error), "error");
  }
}

window.addEventListener("keydown", (event) => {
  if (!state.captureTarget || state.captureTarget.mode !== "key") {
    if (state.captureTarget?.mode === "mouse" && event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancelCapture("Captura de mouse cancelada.");
    }
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  if (event.key === "Escape") {
    cancelCapture("Gravacao de tecla cancelada.");
    return;
  }

  const parts = [];
  if (event.ctrlKey) {
    parts.push("ctrl");
  }
  if (event.altKey) {
    parts.push("alt");
  }
  if (event.shiftKey) {
    parts.push("shift");
  }
  if (event.metaKey) {
    parts.push("cmd");
  }

  const normalized = normalizeCapturedKey(event);
  if (isModifierOnlyKey(normalized)) {
    showCaptureOverlay("Modificador detectado. Agora pressione a tecla final do atalho.");
    setMessage(`Modificador ${normalized} detectado. Falta a tecla final.`, "success");
    return;
  }

  if (!isModifierOnlyKey(normalized)) {
    parts.push(normalized);
  }

  const captured = [...new Set(parts)].join("+");
  if (!captured) {
    return;
  }

  clearCaptureBlurTimer();
  writeCapturedShortcut(captured);
  state.captureTarget = null;
  hideCaptureOverlay();
  setMessage(`Tecla gravada: ${captured}`, "success");
});

captureOverlay.addEventListener("click", (event) => {
  if (event.target === captureOverlay) {
    cancelCapture(
      state.captureTarget?.mode === "mouse" ? "Captura de mouse cancelada." : "Gravacao de tecla cancelada."
    );
  }
});

cancelCaptureButton.addEventListener("click", () => {
  cancelCapture(
    state.captureTarget?.mode === "mouse" ? "Captura de mouse cancelada." : "Gravacao de tecla cancelada."
  );
});

window.addEventListener("blur", () => {
  if (state.captureTarget?.mode === "key") {
    clearCaptureBlurTimer();
    state.captureBlurTimer = setTimeout(() => {
      state.captureBlurTimer = null;
      if (state.captureTarget?.mode === "key" && !document.hasFocus()) {
        cancelCapture("Captura cancelada porque a janela perdeu o foco.");
      }
    }, 180);
  }
});

window.addEventListener("focus", () => {
  clearCaptureBlurTimer();
});

window.addEventListener("keydown", (event) => {
  if (state.activeTab !== "commands" || state.captureTarget) {
    return;
  }

  const target = event.target;
  const tagName = String(target?.tagName || "").toUpperCase();
  const editingField =
    target?.isContentEditable || tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
  if (editingField) {
    return;
  }

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    moveCommandMapFocus(-1);
    return;
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    moveCommandMapFocus(1);
  }
});

function renderTimeline() {
  updateStats();
  const events = state.roadmap?.events ?? [];
  if (!events.length) {
    timelineList.innerHTML = `<div class="empty-state">Nenhum bloco salvo ainda. Monte o fluxo pela coluna da esquerda e ele vai aparecer conectado aqui.</div>`;
    return;
  }

  timelineList.innerHTML = events
    .map((event, index) => {
      const delayLabel = index === 0 ? `Inicio + ${event.delay}s` : `${event.delay}s antes do proximo bloco`;
      return `
        <div class="timeline-node">
          <div class="delay-bridge">
            <span class="delay-pill">${escapeHtml(delayLabel)}</span>
          </div>
          <article class="flow-card" data-order="${event.order}" data-type="${escapeHtml(event.type)}">
            <div class="card-top">
              <div>
                <p class="panel-kicker">Bloco ${event.order}</p>
                <h3>${escapeHtml(event.title)}</h3>
                <p>${escapeHtml(event.subtitle)}</p>
              </div>
              <span class="type-chip ${escapeHtml(event.type)}">${escapeHtml(typeChipLabel(event.type))}</span>
            </div>

            <div class="block-grid">
              <div class="block-editor">
                ${renderEditorFields(event)}
                <div class="card-actions">
                  <button class="save-button" data-action="save">Salvar bloco</button>
                  <button class="micro-button" data-action="up">Subir</button>
                  <button class="micro-button" data-action="down">Descer</button>
                  <button class="micro-button" data-action="remove">Excluir</button>
                </div>
              </div>

              <div>
                <p class="card-description">${escapeHtml(event.description)}</p>
                <div class="command-preview">${escapeHtml(event.command)}</div>
              </div>
            </div>
          </article>
        </div>
      `;
    })
    .join("");
}

function renderCommandMap() {
  const events = state.roadmap?.events ?? [];
  builderShell?.classList.toggle("has-insert-panel", Boolean(state.insertPanel));
  if (!events.length) {
    commandMapList.innerHTML = renderEmptyCommandMapStarter();
    applyCommandMapZoom();
    updateCommandMapNavButtons();
    return;
  }

  const segments = events.map((event, index) => {
    const nextEvent = events[index + 1];
    const hasRecordButton = event.type === "tecla" || event.type === "atalho";
    const isRecognitionCard = event.type === "clicar_imagem";
    const primaryActionClass = isRecognitionCard
      ? "has-recognition-button"
      : hasRecordButton
        ? "has-record-button"
        : "";
    const card = `
      <div class="command-flow-segment ${isRecognitionCard ? "visual-recognition-segment" : ""}" data-order="${event.order}">
      <article class="command-tree-card ${isRecognitionCard ? "is-visual-recognition" : ""}" data-order="${event.order}" data-type="${escapeHtml(event.type)}" data-delay="${escapeHtml(event.delay)}">
        <div class="command-tree-top">
          <div class="command-tree-main">
            <span class="command-index">${String(event.order).padStart(2, "0")}</span>
            <div>
              <h3>${escapeHtml(event.title)}</h3>
              <p>${escapeHtml(event.subtitle)}</p>
            </div>
          </div>
          <div class="command-tree-side">
            <span class="type-chip ${escapeHtml(event.type)}">${escapeHtml(typeChipLabel(event.type))}</span>
            <button class="drag-handle" data-drag-handle="true" data-order="${event.order}" title="Arrastar card" type="button">
              <span>Arrastar</span>
            </button>
          </div>
        </div>

        <div class="command-tree-grid">
          <div class="tree-editor">
            ${renderTreeEditorFields(event)}
          </div>
          <div class="tree-command-preview">${escapeHtml(event.command)}</div>
        </div>

        <div class="command-tree-actions">
          <div class="command-action-group command-action-group-primary ${primaryActionClass}">
            <button class="tree-save-button" data-tree-action="save">Salvar</button>
            <button class="tree-open-button" data-tree-action="open-editor">Editor</button>
            ${isRecognitionCard ? '<button class="tree-open-button" data-tree-action="test-image-recognition">Testar</button>' : ""}
            ${hasRecordButton ? '<button class="tree-open-button" data-tree-action="record-key">Gravar</button>' : ""}
          </div>
          <div class="command-action-group command-action-group-secondary">
            <button class="micro-button" data-tree-action="insert-before">Antes</button>
            <button class="micro-button" data-tree-action="insert-after">Depois</button>
            <button class="micro-button" data-tree-action="up">Subir</button>
            <button class="micro-button" data-tree-action="down">Descer</button>
            <button class="micro-button" data-tree-action="remove">Excluir</button>
          </div>
        </div>
      </article>
      ${renderInsertPanel(event.order)}
      </div>
    `;

    if (!nextEvent) {
      return `${card}<div class="command-flow-end">Fim da sequencia</div>`;
    }

    return `
      ${card}
      <div class="command-inline-connector" data-target-index="${nextEvent.order}">
        <label class="connector-time connector-time-inline">
          <span class="connector-link-label">${event.order} > ${nextEvent.order}</span>
          <input
            data-connector-delay="true"
            data-order="${nextEvent.order}"
            type="number"
            min="0"
            step="0.1"
            value="${escapeHtml(nextEvent.delay)}"
          />
          <strong>s</strong>
        </label>
        <div class="connector-track"></div>
      </div>
    `;
  });

  commandMapList.innerHTML = `<div class="command-flow-row">${events
    .map((_event, index) => {
      const zone = `<div class="command-drop-zone" data-target-index="${index + 1}" aria-label="Soltar na posicao ${index + 1}"></div>`;
      return `${zone}${segments[index]}`;
    })
    .join("")}<div class="command-drop-zone command-drop-zone-end" data-target-index="${events.length + 1}" aria-label="Soltar no final"></div></div>`;
  applyCommandMapZoom();
  applyCommandMapFocus();
}

function applyRoadmap(roadmap) {
  state.roadmap = roadmap;
  state.library.dirty = false;
  refreshSequenceSuggestions();
  populateImageFailureBlockSelect();
  populateChromeFailureBlockSelect();
  populateChromeSuccessBlockSelect();
  state.commandMapFocusOrder = resolveNearestCommandMapFocus(
    roadmap,
    state.commandMapFocusOrder ?? roadmap?.events?.[0]?.order ?? null
  );
  syncWorkbook(roadmap.workbook);
  renderTimeline();
  renderCommandMap();
  if (state.assist.mode === "idle" && !state.assist.currentOrder) {
    state.assist.currentOrder = roadmap?.events?.[0]?.order ?? null;
  }
  renderAssistExecutionMap();
  if (!state.commandMapSave.running && !state.commandMapSave.dirty) {
    setCommandMapSaveState({
      percent: 100,
      status: "Mapa sincronizado e pronto para o loop.",
    });
  }
}

async function refreshRoadmap(message = "Roteiro atualizado.") {
  setBusy("Atualizando");
  const roadmap = await invoke("get_roadmap");
  applyRoadmap(roadmap);
  await refreshTestLoopData();
  setBusy("Pronto");
  setMessage(message, "success");
}

async function applyBulkDelayToAllBlocks(source = "top") {
  const sourceInput = source === "map" ? mapBulkDelayInput : bulkDelayInput;
  const delay = Math.max(0, parseNumber(sourceInput?.value, 0));
  if (bulkDelayInput) {
    bulkDelayInput.value = String(delay);
  }
  if (mapBulkDelayInput) {
    mapBulkDelayInput.value = String(delay);
  }
  const totalEvents = state.roadmap?.events?.length ?? 0;
  if (!totalEvents) {
    setMessage("Nao existe nenhum bloco no roteiro para aplicar o atraso global.", "error");
    return;
  }

  try {
    setBusy("Aplicando atraso global");
    const roadmap = await invoke("update_all_blocks_delay", { delay });
    applyRoadmap(roadmap);
    await refreshAutomationLibrary();
    setBusy("Pronto");
    setMessage(`Atraso de ${delay}s aplicado em ${totalEvents} bloco(s).`, "success");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
}

async function refreshWorkbookMeta() {
  const workbook = await invoke("get_workbook_meta");
  syncWorkbook(workbook);
  populateWorkbookSheetSelect();
}

async function loadWorkbookPreview(
  sheetName = state.workbookSelectedSheet || selectedPreviewWorkbookMeta()?.sheets?.[0]?.name || "",
  workbookId = state.previewWorkbookId || state.workbook?.default_workbook || availableWorkbooks()[0]?.id || ""
) {
  state.previewWorkbookId = workbookId;
  state.workbookSelectedSheet = sheetName;
  const preview = await invoke("get_workbook_preview", {
    workbook: workbookId || null,
    sheet: sheetName || null,
    limit: 240,
  });
  state.workbookPreview = preview;
  state.previewWorkbookId = preview.workbook_id || workbookId;
  state.workbookSelectedSheet = preview.sheet || sheetName;
  if (!preview.headers?.includes(state.workbookSelectedColumn)) {
    state.workbookSelectedColumn = preview.headers?.[0] ?? "";
  }
  if (
    state.workbookSelectedCell &&
    state.workbookSelectedCell.sheet !== state.workbookSelectedSheet
  ) {
    state.workbookSelectedCell = null;
  }
  renderWorkbookPreview();
}

async function runMutation(label, promiseFactory, focusResolver = null) {
  try {
    setBusy(label);
    const roadmap = await promiseFactory();
    if (typeof focusResolver === "function") {
      state.commandMapFocusOrder = focusResolver(roadmap);
    }
    applyRoadmap(roadmap);
    await refreshAutomationLibrary();
    setBusy("Pronto");
    setMessage(`${label} com sucesso.`, "success");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
}

function formValuesFromCard(card) {
  const get = (field) => card.querySelector(`[data-field="${field}"]`);
  return {
    delay: parseNumber(get("delay")?.value, 0),
    successAction: get("successAction")?.value ?? "continuar",
    successBlock: get("successBlock")?.value ?? "",
    text: get("text")?.value ?? "",
    keys: get("keys")?.value ?? "",
    repeat: Math.max(1, Math.trunc(parseNumber(get("repeat")?.value, 1))),
    x: parseNumber(get("x")?.value, 0),
    y: parseNumber(get("y")?.value, 0),
    button: get("button")?.value ?? "left",
    clicks: Math.max(1, Math.trunc(parseNumber(get("clicks")?.value, 1))),
    imagePath: get("imagePath")?.value ?? "",
    timeout: parseNumber(get("timeout")?.value, 10),
    confidence: parseNumber(get("confidence")?.value, 0.8),
    searchProfile: normalizeRecognitionProfile(get("searchProfile")?.value, "balanced"),
    windowTitle: get("windowTitle")?.value ?? "",
    recognitionClickMode: get("clickOnFind")?.value ?? "single",
    failureAction: get("failureAction")?.value ?? "parar",
    failureBlock: get("failureBlock")?.value ?? "",
    retryCount: Math.max(1, Math.trunc(parseNumber(get("retryCount")?.value, 1))),
    retryInterval: parseNumber(get("retryInterval")?.value, 1),
    verifyName: get("verifyName")?.value ?? "",
    verifyActiveImage: get("verifyActiveImage")?.value ?? "",
    verifyInactiveImage: get("verifyInactiveImage")?.value ?? "",
    verifyTimeout: parseNumber(get("verifyTimeout")?.value, 5),
    verifyConfidence: parseNumber(get("verifyConfidence")?.value, 0.85),
    verifyActiveAction: get("verifyActiveAction")?.value ?? "continuar",
    verifyActiveSequence: get("verifyActiveSequence")?.value ?? "",
    verifyInactiveAction: get("verifyInactiveAction")?.value ?? "ir_para_sequencia",
    verifyInactiveSequence: get("verifyInactiveSequence")?.value ?? "",
    verifyMissingAction: get("verifyMissingAction")?.value ?? "parar",
    verifyMissingSequence: get("verifyMissingSequence")?.value ?? "",
    chromeName: get("chromeName")?.value ?? "",
    chromeHtml: get("chromeHtml")?.value ?? "",
    chromeAnalysis: parseChromeAnalysisJson(get("chromeAnalysis")?.value ?? ""),
    chromeTargetMethod: get("chromeTargetMethod")?.value ?? "css",
    chromeTargetValue: get("chromeTargetValue")?.value ?? "",
    chromeActionType: get("chromeActionType")?.value ?? "clicar",
    chromeValueSource: get("chromeValueSource")?.value ?? "texto_fixo",
    chromeActionValue: get("chromeActionValue")?.value ?? "",
    chromeSaveAs: get("chromeSaveAs")?.value ?? "",
    chromeTimeout: parseNumber(get("chromeTimeout")?.value, 10000),
    chromePressAfter: get("chromePressAfter")?.value ?? "",
    chromeSuccessAction: get("chromeSuccessAction")?.value ?? "continuar",
    chromeSuccessBlock: get("chromeSuccessBlock")?.value ?? "",
    chromeFailureAction: get("chromeFailureAction")?.value ?? "parar",
    chromeFailureBlock: get("chromeFailureBlock")?.value ?? "",
    chromeRetryCount: Math.max(1, Math.trunc(parseNumber(get("chromeRetryCount")?.value, 1))),
    chromeRetryInterval: parseNumber(get("chromeRetryInterval")?.value, 0.5),
    chromeClearBefore: Boolean(get("chromeClearBefore")?.checked),
    chromeFallbackVisual: Boolean(get("chromeFallbackVisual")?.checked),
    chromeFallbackImage: get("chromeFallbackImage")?.value ?? "",
    workbook: get("workbook")?.value ?? "",
    sheet: get("sheet")?.value ?? "",
    column: get("column")?.value ?? "",
    afterAction: get("afterAction")?.value ?? "nenhuma",
    intervalBetween: parseNumber(get("intervalBetween")?.value, 0.5),
  };
}

function treeValuesFromCard(card) {
  const get = (field) => card.querySelector(`[data-tree-field="${field}"]`);
  return {
    delay: parseNumber(card.dataset.delay, 0),
    successAction: get("successAction")?.value ?? "continuar",
    successBlock: get("successBlock")?.value ?? "",
    text: get("text")?.value ?? "",
    keys: get("keys")?.value ?? "",
    repeat: Math.max(1, Math.trunc(parseNumber(get("repeat")?.value, 1))),
    x: parseNumber(get("x")?.value, 0),
    y: parseNumber(get("y")?.value, 0),
    button: get("button")?.value ?? "left",
    clicks: Math.max(1, Math.trunc(parseNumber(get("clicks")?.value, 1))),
    imagePath: get("imagePath")?.value ?? "",
    timeout: parseNumber(get("timeout")?.value, 10),
    confidence: parseNumber(get("confidence")?.value, 0.8),
    searchProfile: normalizeRecognitionProfile(get("searchProfile")?.value, "balanced"),
    windowTitle: get("windowTitle")?.value ?? "",
    recognitionClickMode: get("clickOnFind")?.value ?? "single",
    failureAction: get("failureAction")?.value ?? "parar",
    failureBlock: get("failureBlock")?.value ?? "",
    retryCount: Math.max(1, Math.trunc(parseNumber(get("retryCount")?.value, 1))),
    retryInterval: parseNumber(get("retryInterval")?.value, 1),
    verifyName: get("verifyName")?.value ?? "",
    verifyActiveImage: get("verifyActiveImage")?.value ?? "",
    verifyInactiveImage: get("verifyInactiveImage")?.value ?? "",
    verifyTimeout: parseNumber(get("verifyTimeout")?.value, 5),
    verifyConfidence: parseNumber(get("verifyConfidence")?.value, 0.85),
    verifyActiveAction: get("verifyActiveAction")?.value ?? "continuar",
    verifyActiveSequence: get("verifyActiveSequence")?.value ?? "",
    verifyInactiveAction: get("verifyInactiveAction")?.value ?? "ir_para_sequencia",
    verifyInactiveSequence: get("verifyInactiveSequence")?.value ?? "",
    verifyMissingAction: get("verifyMissingAction")?.value ?? "parar",
    verifyMissingSequence: get("verifyMissingSequence")?.value ?? "",
    chromeName: get("chromeName")?.value ?? "",
    chromeHtml: get("chromeHtml")?.value ?? "",
    chromeAnalysis: parseChromeAnalysisJson(get("chromeAnalysis")?.value ?? ""),
    chromeTargetMethod: get("chromeTargetMethod")?.value ?? "css",
    chromeTargetValue: get("chromeTargetValue")?.value ?? "",
    chromeActionType: get("chromeActionType")?.value ?? "clicar",
    chromeValueSource: get("chromeValueSource")?.value ?? "texto_fixo",
    chromeActionValue: get("chromeActionValue")?.value ?? "",
    chromeSaveAs: get("chromeSaveAs")?.value ?? "",
    chromeTimeout: parseNumber(get("chromeTimeout")?.value, 10000),
    chromePressAfter: get("chromePressAfter")?.value ?? "",
    chromeSuccessAction: get("chromeSuccessAction")?.value ?? "continuar",
    chromeSuccessBlock: get("chromeSuccessBlock")?.value ?? "",
    chromeFailureAction: get("chromeFailureAction")?.value ?? "parar",
    chromeFailureBlock: get("chromeFailureBlock")?.value ?? "",
    chromeRetryCount: Math.max(1, Math.trunc(parseNumber(get("chromeRetryCount")?.value, 1))),
    chromeRetryInterval: parseNumber(get("chromeRetryInterval")?.value, 0.5),
    chromeClearBefore: Boolean(get("chromeClearBefore")?.checked),
    chromeFallbackVisual: Boolean(get("chromeFallbackVisual")?.checked),
    chromeFallbackImage: get("chromeFallbackImage")?.value ?? "",
    workbook: get("workbook")?.value ?? "",
    sheet: get("sheet")?.value ?? "",
    column: get("column")?.value ?? "",
    afterAction: get("afterAction")?.value ?? "nenhuma",
    intervalBetween: parseNumber(get("intervalBetween")?.value, 0.5),
  };
}

function findRoadmapEventByOrder(order) {
  return (state.roadmap?.events ?? []).find((event) => Number(event.order) === Number(order)) || null;
}

function approxEqual(a, b, epsilon = 0.0001) {
  return Math.abs(Number(a || 0) - Number(b || 0)) <= epsilon;
}

function normalizeStringValue(value) {
  return String(value ?? "").trim();
}

function successFlowChanged(values, details = {}) {
  return (
    normalizeStringValue(values.successAction) !== normalizeStringValue(details.ao_sucesso ?? "continuar")
    || Number(optionalPositiveInt(values.successBlock) || 0) !== Number(details.bloco_sucesso ?? 0)
  );
}

function commandCardSnapshot(card) {
  return {
    order: Number(card.dataset.order),
    type: String(card.dataset.type || ""),
    values: treeValuesFromCard(card),
  };
}

function commandCardHasUnsavedChanges(snapshot) {
  const event = findRoadmapEventByOrder(snapshot.order);
  if (!event) {
    return false;
  }

  const details = event.details ?? {};
  const values = snapshot.values || {};
  const eventDelay = Number(event.delay ?? 0);

  if (!approxEqual(values.delay, eventDelay)) {
    return true;
  }

  if (snapshot.type === "texto_livre") {
    return normalizeStringValue(values.text) !== normalizeStringValue(event.text)
      || successFlowChanged(values, details);
  }

  if (snapshot.type === "tecla" || snapshot.type === "atalho") {
    return (
      normalizeStringValue(values.keys) !== normalizeStringValue((event.keys || []).join("+"))
      || Number(values.repeat || 1) !== Number(details.repeticoes ?? 1)
      || successFlowChanged(values, details)
    );
  }

  if (snapshot.type === "mouse_click") {
    return (
      Number(values.x || 0) !== Number(details.x ?? 0)
      || Number(values.y || 0) !== Number(details.y ?? 0)
      || normalizeStringValue(values.button) !== normalizeStringValue(details.botao ?? "left")
      || Number(values.clicks || 1) !== Number(details.cliques ?? details.clicks ?? 1)
      || successFlowChanged(values, details)
    );
  }

  if (snapshot.type === "clicar_imagem") {
    return (
      normalizeStringValue(values.imagePath) !== normalizeStringValue(details.imagem)
      || !approxEqual(values.timeout, details.timeout ?? 10)
      || !approxEqual(values.confidence, details.confianca ?? 0.8)
      || normalizeRecognitionProfile(values.searchProfile, "balanced") !== normalizeRecognitionProfile(details.perfil_busca, "balanced")
      || normalizeStringValue(values.windowTitle) !== normalizeStringValue(details.janela_alvo)
      || normalizeStringValue(values.recognitionClickMode) !== normalizeStringValue(recognitionClickModeFromDetails(details))
      || successFlowChanged(values, details)
      || normalizeStringValue(values.failureAction) !== normalizeStringValue(details.ao_nao_encontrar ?? "parar")
      || Number(optionalPositiveInt(values.failureBlock) || 0) !== Number(details.bloco_nao_encontrar ?? 0)
      || Number(values.retryCount || 1) !== Number(details.quantidade_tentativas ?? 1)
      || !approxEqual(values.retryInterval, details.intervalo_tentativas ?? 1)
    );
  }

  if (snapshot.type === "chrome_elemento_html") {
    const action = details.acao ?? {};
    const target = details.alvo ?? {};
    return (
      normalizeStringValue(values.chromeName) !== normalizeStringValue(details.nome ?? "Chrome / Elemento HTML")
      || normalizeStringValue(values.chromeHtml) !== normalizeStringValue(details.html_original ?? "")
      || normalizeStringValue(values.chromeTargetMethod) !== normalizeStringValue(target.metodo ?? "css")
      || normalizeStringValue(values.chromeTargetValue) !== normalizeStringValue(target.valor ?? "")
      || normalizeStringValue(values.chromeActionType) !== normalizeStringValue(action.tipo ?? "clicar")
      || normalizeStringValue(values.chromeValueSource) !== normalizeStringValue(action.origem_valor ?? "texto_fixo")
      || normalizeStringValue(values.chromeActionValue) !== normalizeStringValue(action.valor ?? "")
      || normalizeStringValue(values.chromeSaveAs) !== normalizeStringValue(action.salvar_em ?? "")
      || !approxEqual(values.chromeTimeout, details.timeout ?? 10000)
      || normalizeStringValue(values.chromePressAfter) !== normalizeStringValue(action.pressionar_depois ?? "")
      || normalizeStringValue(values.chromeSuccessAction) !== normalizeStringValue(details.ao_sucesso ?? "continuar")
      || Number(optionalPositiveInt(values.chromeSuccessBlock) || 0) !== Number(details.bloco_sucesso ?? 0)
      || normalizeStringValue(values.chromeFailureAction) !== normalizeStringValue(details.ao_falhar ?? "parar")
      || Number(optionalPositiveInt(values.chromeFailureBlock) || 0) !== Number(details.bloco_falha ?? 0)
      || Number(values.chromeRetryCount || 1) !== Number(details.quantidade_tentativas ?? 1)
      || !approxEqual(values.chromeRetryInterval, details.intervalo_tentativas ?? 0.5)
      || Boolean(values.chromeClearBefore) !== Boolean(action.limpar_antes ?? true)
      || Boolean(values.chromeFallbackVisual) !== Boolean(details.fallback_visual ?? false)
      || normalizeStringValue(values.chromeFallbackImage) !== normalizeStringValue(details.fallback_imagem ?? "")
    );
  }

  if (snapshot.type === "verificar_estado_botao") {
    return (
      normalizeStringValue(values.verifyName) !== normalizeStringValue(details.nome ?? "Verificar botao")
      || normalizeStringValue(values.verifyActiveImage) !== normalizeStringValue(details.imagem_ativo)
      || normalizeStringValue(values.verifyInactiveImage) !== normalizeStringValue(details.imagem_desativado)
      || !approxEqual(values.verifyTimeout, details.timeout ?? 5)
      || !approxEqual(values.verifyConfidence, details.confianca ?? 0.85)
      || normalizeStringValue(values.verifyActiveAction) !== normalizeStringValue(details.se_ativo?.acao ?? "continuar")
      || normalizeStringValue(values.verifyActiveSequence) !== normalizeStringValue(details.se_ativo?.sequencia ?? "")
      || normalizeStringValue(values.verifyInactiveAction) !== normalizeStringValue(details.se_desativado?.acao ?? "ir_para_sequencia")
      || normalizeStringValue(values.verifyInactiveSequence) !== normalizeStringValue(details.se_desativado?.sequencia ?? "")
      || normalizeStringValue(values.verifyMissingAction) !== normalizeStringValue(details.se_nao_encontrar?.acao ?? "parar")
      || normalizeStringValue(values.verifyMissingSequence) !== normalizeStringValue(details.se_nao_encontrar?.sequencia ?? "")
    );
  }

  if (snapshot.type === "sequencia_planilha") {
    return (
      normalizeStringValue(values.workbook) !== normalizeStringValue(details.arquivo)
      || normalizeStringValue(values.sheet) !== normalizeStringValue(details.aba)
      || normalizeStringValue(values.column) !== normalizeStringValue(details.coluna)
      || normalizeStringValue(values.afterAction) !== normalizeStringValue(details.acao_apos_item_texto ?? "nenhuma")
      || !approxEqual(values.intervalBetween, details.intervalo_entre_itens ?? 0.5)
      || successFlowChanged(values, details)
    );
  }

  return false;
}

async function invokeCommandCardUpdate(snapshot) {
  const { order, type, values } = snapshot;

  if (type === "texto_livre") {
    return invoke("update_text_block", {
      order,
      text: values.text,
      delay: values.delay,
      aoSucesso: values.successAction,
      blocoSucesso: optionalPositiveInt(values.successBlock),
    });
  }

  if (type === "tecla" || type === "atalho") {
    return invoke("update_key_block", {
      order,
      keys: values.keys,
      repeat: values.repeat,
      delay: values.delay,
      aoSucesso: values.successAction,
      blocoSucesso: optionalPositiveInt(values.successBlock),
    });
  }

  if (type === "mouse_click") {
    return invoke("update_mouse_block", {
      order,
      x: values.x,
      y: values.y,
      button: values.button,
      clicks: values.clicks,
      delay: values.delay,
      aoSucesso: values.successAction,
      blocoSucesso: optionalPositiveInt(values.successBlock),
    });
  }

  if (type === "clicar_imagem") {
    if (!normalizeStringValue(values.imagePath)) {
      throw new Error(`O bloco ${order} de reconhecimento esta sem referencia visual.`);
    }
    return invoke("update_image_click_block", {
      order,
      imagem: values.imagePath,
      timeout: values.timeout,
      confianca: values.confidence,
      perfilBusca: values.searchProfile,
      clicar: recognitionClicksFromMode(values.recognitionClickMode, 1) > 0,
      clicks: recognitionClicksFromMode(values.recognitionClickMode, 1),
      offsetX: 0,
      offsetY: 0,
      janelaAlvo: values.windowTitle.trim() || null,
      aoNaoEncontrar: values.failureAction,
      blocoNaoEncontrar: optionalPositiveInt(values.failureBlock),
      quantidadeTentativas: values.retryCount,
      intervaloTentativas: values.retryInterval,
      delay: values.delay,
      aoSucesso: values.successAction,
      blocoSucesso: optionalPositiveInt(values.successBlock),
    });
  }

  if (type === "chrome_elemento_html") {
    if (!normalizeStringValue(values.chromeHtml)) {
      throw new Error(`O bloco ${order} de Chrome HTML esta sem o elemento colado.`);
    }
    const analysis = values.chromeAnalysis || await invoke("analyze_html_element", { html: values.chromeHtml });
    const details = buildChromeDetailsFromAnalysisAndValues(analysis, values);
    return invoke("update_chrome_html_block", {
      order,
      nome: details.nome,
      htmlOriginal: details.html_original,
      elemento: details.elemento,
      alvo: details.alvo,
      acao: details.acao,
      timeout: details.timeout,
      fallbackVisual: details.fallback_visual,
      fallbackImagem: details.fallback_imagem || null,
      aoSucesso: details.ao_sucesso,
      blocoSucesso: optionalPositiveInt(details.bloco_sucesso),
      aoFalhar: details.ao_falhar,
      blocoFalha: optionalPositiveInt(details.bloco_falha),
      quantidadeTentativas: details.quantidade_tentativas,
      intervaloTentativas: details.intervalo_tentativas,
      delay: values.delay,
    });
  }

  if (type === "verificar_estado_botao") {
    if (!normalizeStringValue(values.verifyActiveImage) || !normalizeStringValue(values.verifyInactiveImage)) {
      throw new Error(`O bloco ${order} de verificacao esta sem as referencias ativa e desativada.`);
    }
    return invoke("update_verify_button_state_block", {
      order,
      nome: values.verifyName || "Verificar botao",
      imagemAtivo: values.verifyActiveImage,
      imagemDesativado: values.verifyInactiveImage,
      timeout: values.verifyTimeout,
      confianca: values.verifyConfidence,
      acaoAtivo: values.verifyActiveAction,
      sequenciaAtivo: values.verifyActiveSequence.trim() || null,
      acaoDesativado: values.verifyInactiveAction,
      sequenciaDesativado: values.verifyInactiveSequence.trim() || null,
      acaoNaoEncontrar: values.verifyMissingAction,
      sequenciaNaoEncontrar: values.verifyMissingSequence.trim() || null,
      delay: values.delay,
    });
  }

  if (type === "sequencia_planilha") {
    return invoke("update_spreadsheet_block", {
      order,
      workbook: values.workbook || null,
      sheet: values.sheet,
      column: values.column,
      afterAction: values.afterAction,
      intervalBetween: values.intervalBetween,
      delay: values.delay,
      aoSucesso: values.successAction,
      blocoSucesso: optionalPositiveInt(values.successBlock),
    });
  }

  return null;
}

function getPendingCommandMapSnapshots() {
  const cards = Array.from(commandMapList?.querySelectorAll(".command-tree-card") || []);
  if (!cards.length) {
    return [];
  }

  const snapshots = cards
    .map((card) => commandCardSnapshot(card))
    .filter((snapshot) => Number.isFinite(snapshot.order) && snapshot.order > 0);

  return snapshots.filter((snapshot) => commandCardHasUnsavedChanges(snapshot));
}

async function persistCommandMapDraftsForExecution(options = {}) {
  const { onProgress = null } = options;
  const pending = getPendingCommandMapSnapshots();
  if (!pending.length) {
    if (typeof onProgress === "function") {
      onProgress({
        current: 0,
        total: 0,
        percent: 100,
        done: true,
      });
    }
    return { saved: 0, total: 0, roadmap: null };
  }

  let latestRoadmap = null;
  const total = pending.length;
  for (let index = 0; index < pending.length; index += 1) {
    const snapshot = pending[index];
    latestRoadmap = await invokeCommandCardUpdate(snapshot);
    if (typeof onProgress === "function") {
      onProgress({
        current: index + 1,
        total,
        percent: Math.round(((index + 1) / total) * 100),
        snapshot,
        done: index + 1 === total,
      });
    }
  }

  if (latestRoadmap) {
    applyRoadmap(latestRoadmap);
    await refreshAutomationLibrary();
    await refreshTestLoopData();
  }

  if (pending.length) {
    setCommandMapSaveState({
      running: false,
      dirty: false,
      percent: 100,
      status: "Mapa sincronizado e pronto para o loop.",
    });
  }

  return {
    saved: total,
    total,
    roadmap: latestRoadmap,
  };
}

function insertValuesFromPanel(panelElement) {
  const get = (field) => panelElement.querySelector(`[data-insert-field="${field}"]`);
  return {
    type: state.insertPanel?.type ?? "key",
    targetOrder: Number(panelElement.dataset.targetOrder),
    position: state.insertPanel?.position ?? "after",
    text: get("text")?.value ?? "",
    keys: get("keys")?.value ?? "",
    repeat: Math.max(1, Math.trunc(parseNumber(get("repeat")?.value, state.insertPanel?.repeat ?? 1))),
    x: parseNumber(get("x")?.value, 0),
    y: parseNumber(get("y")?.value, 0),
    button: get("button")?.value ?? "left",
    clicks: Math.max(1, Math.trunc(parseNumber(get("clicks")?.value, 1))),
    imagePath: get("imagePath")?.value ?? state.insertPanel?.imagePath ?? "",
    timeout: parseNumber(get("timeout")?.value, state.insertPanel?.timeout ?? 10),
    confidence: parseNumber(get("confidence")?.value, state.insertPanel?.confidence ?? 0.8),
    searchProfile: normalizeRecognitionProfile(get("searchProfile")?.value, state.insertPanel?.searchProfile ?? "balanced"),
    windowTitle: get("windowTitle")?.value ?? state.insertPanel?.windowTitle ?? "",
    recognitionClickMode: get("clickOnFind")?.value ?? state.insertPanel?.recognitionClickMode ?? "single",
    failureAction: get("failureAction")?.value ?? state.insertPanel?.failureAction ?? "parar",
    failureBlock: get("failureBlock")?.value ?? state.insertPanel?.failureBlock ?? "",
    retryCount: Math.max(1, Math.trunc(parseNumber(get("retryCount")?.value, state.insertPanel?.retryCount ?? 1))),
    retryInterval: parseNumber(get("retryInterval")?.value, state.insertPanel?.retryInterval ?? 1),
    successAction: get("successAction")?.value ?? state.insertPanel?.successAction ?? "continuar",
    successBlock: get("successBlock")?.value ?? state.insertPanel?.successBlock ?? "",
    chromeName: get("chromeName")?.value ?? state.insertPanel?.chromeName ?? "Chrome / Elemento HTML",
    chromeHtml: get("chromeHtml")?.value ?? state.insertPanel?.chromeHtml ?? "",
    chromeAnalysis: parseChromeAnalysisJson(get("chromeAnalysis")?.value ?? state.insertPanel?.chromeAnalysis ?? ""),
    chromeTargetMethod: get("chromeTargetMethod")?.value ?? state.insertPanel?.chromeTargetMethod ?? "css",
    chromeTargetValue: get("chromeTargetValue")?.value ?? state.insertPanel?.chromeTargetValue ?? "",
    chromeActionType: get("chromeActionType")?.value ?? state.insertPanel?.chromeActionType ?? "clicar",
    chromeValueSource: get("chromeValueSource")?.value ?? state.insertPanel?.chromeValueSource ?? "texto_fixo",
    chromeActionValue: get("chromeActionValue")?.value ?? state.insertPanel?.chromeActionValue ?? "",
    chromeSaveAs: get("chromeSaveAs")?.value ?? state.insertPanel?.chromeSaveAs ?? "",
    chromeTimeout: parseNumber(get("chromeTimeout")?.value, state.insertPanel?.chromeTimeout ?? 10000),
    chromePressAfter: get("chromePressAfter")?.value ?? state.insertPanel?.chromePressAfter ?? "",
    chromeSuccessAction: get("chromeSuccessAction")?.value ?? state.insertPanel?.chromeSuccessAction ?? "continuar",
    chromeSuccessBlock: get("chromeSuccessBlock")?.value ?? state.insertPanel?.chromeSuccessBlock ?? "",
    chromeFailureAction: get("chromeFailureAction")?.value ?? state.insertPanel?.chromeFailureAction ?? "parar",
    chromeFailureBlock: get("chromeFailureBlock")?.value ?? state.insertPanel?.chromeFailureBlock ?? "",
    chromeRetryCount: Math.max(1, Math.trunc(parseNumber(get("chromeRetryCount")?.value, state.insertPanel?.chromeRetryCount ?? 1))),
    chromeRetryInterval: parseNumber(get("chromeRetryInterval")?.value, state.insertPanel?.chromeRetryInterval ?? 0.5),
    chromeClearBefore: Boolean(get("chromeClearBefore")?.checked ?? state.insertPanel?.chromeClearBefore),
    chromeFallbackVisual: Boolean(get("chromeFallbackVisual")?.checked ?? state.insertPanel?.chromeFallbackVisual),
    chromeFallbackImage: get("chromeFallbackImage")?.value ?? state.insertPanel?.chromeFallbackImage ?? "",
    delay: parseNumber(get("delay")?.value, 0),
    workbook: get("workbook")?.value ?? state.insertPanel?.workbook ?? "",
    sheet: get("sheet")?.value ?? "",
    column: get("column")?.value ?? "",
    afterAction: get("afterAction")?.value ?? "nenhuma",
    intervalBetween: parseNumber(get("intervalBetween")?.value, 0.5),
  };
}

async function persistCommandMapDrafts() {
  const focusedOrder = Number(state.commandMapFocusOrder);
  if (!Number.isFinite(focusedOrder) || focusedOrder <= 0) {
    return;
  }

  const card = commandMapList?.querySelector(`.command-tree-card[data-order="${focusedOrder}"]`);
  if (!card) {
    return;
  }

  const order = Number(card.dataset.order);
  const type = card.dataset.type;
  const values = treeValuesFromCard(card);
  let roadmap = null;

  if (type === "texto_livre") {
    roadmap = await invoke("update_text_block", {
      order,
      text: values.text,
      delay: values.delay,
      aoSucesso: values.successAction,
      blocoSucesso: optionalPositiveInt(values.successBlock),
    });
  } else if (type === "tecla" || type === "atalho") {
    roadmap = await invoke("update_key_block", {
      order,
      keys: values.keys,
      repeat: values.repeat,
      delay: values.delay,
      aoSucesso: values.successAction,
      blocoSucesso: optionalPositiveInt(values.successBlock),
    });
  } else if (type === "mouse_click") {
    roadmap = await invoke("update_mouse_block", {
      order,
      x: values.x,
      y: values.y,
      button: values.button,
      clicks: values.clicks,
      delay: values.delay,
      aoSucesso: values.successAction,
      blocoSucesso: optionalPositiveInt(values.successBlock),
    });
  } else if (type === "clicar_imagem") {
    if (!values.imagePath.trim()) {
      throw new Error(`O bloco ${order} de reconhecimento esta sem referencia visual.`);
    }
    roadmap = await invoke("update_image_click_block", {
      order,
      imagem: values.imagePath,
      timeout: values.timeout,
      confianca: values.confidence,
      perfilBusca: values.searchProfile,
      clicar: recognitionClicksFromMode(values.recognitionClickMode, 1) > 0,
      clicks: recognitionClicksFromMode(values.recognitionClickMode, 1),
      offsetX: 0,
      offsetY: 0,
      janelaAlvo: values.windowTitle.trim() || null,
      aoNaoEncontrar: values.failureAction,
      blocoNaoEncontrar: optionalPositiveInt(values.failureBlock),
      quantidadeTentativas: values.retryCount,
      intervaloTentativas: values.retryInterval,
      delay: values.delay,
      aoSucesso: values.successAction,
      blocoSucesso: optionalPositiveInt(values.successBlock),
    });
  } else if (type === "chrome_elemento_html") {
    if (!values.chromeHtml.trim()) {
      throw new Error(`O bloco ${order} de Chrome HTML esta sem o elemento colado.`);
    }
    const analysis = values.chromeAnalysis || await invoke("analyze_html_element", { html: values.chromeHtml });
    const details = buildChromeDetailsFromAnalysisAndValues(analysis, values);
    roadmap = await invoke("update_chrome_html_block", {
      order,
      nome: details.nome,
      htmlOriginal: details.html_original,
      elemento: details.elemento,
      alvo: details.alvo,
      acao: details.acao,
      timeout: details.timeout,
      fallbackVisual: details.fallback_visual,
      fallbackImagem: details.fallback_imagem || null,
      aoSucesso: details.ao_sucesso,
      blocoSucesso: optionalPositiveInt(details.bloco_sucesso),
      aoFalhar: details.ao_falhar,
      blocoFalha: optionalPositiveInt(details.bloco_falha),
      quantidadeTentativas: details.quantidade_tentativas,
      intervaloTentativas: details.intervalo_tentativas,
      delay: values.delay,
    });
  } else if (type === "verificar_estado_botao") {
    if (!values.verifyActiveImage.trim() || !values.verifyInactiveImage.trim()) {
      throw new Error(`O bloco ${order} de verificacao esta sem as referencias ativa e desativada.`);
    }
    roadmap = await invoke("update_verify_button_state_block", {
      order,
      nome: values.verifyName || "Verificar botao",
      imagemAtivo: values.verifyActiveImage,
      imagemDesativado: values.verifyInactiveImage,
      timeout: values.verifyTimeout,
      confianca: values.verifyConfidence,
      acaoAtivo: values.verifyActiveAction,
      sequenciaAtivo: values.verifyActiveSequence.trim() || null,
      acaoDesativado: values.verifyInactiveAction,
      sequenciaDesativado: values.verifyInactiveSequence.trim() || null,
      acaoNaoEncontrar: values.verifyMissingAction,
      sequenciaNaoEncontrar: values.verifyMissingSequence.trim() || null,
      delay: values.delay,
    });
  } else if (type === "sequencia_planilha") {
    roadmap = await invoke("update_spreadsheet_block", {
      order,
      workbook: values.workbook || null,
      sheet: values.sheet,
      column: values.column,
      afterAction: values.afterAction,
      intervalBetween: values.intervalBetween,
      delay: values.delay,
      aoSucesso: values.successAction,
      blocoSucesso: optionalPositiveInt(values.successBlock),
    });
  }

  if (roadmap) {
    applyRoadmap(roadmap);
    await refreshAutomationLibrary();
    await refreshTestLoopData();
  }
}

async function saveEntireCommandMap() {
  try {
    setCommandMapSaveState({
      running: true,
      dirty: true,
      percent: 0,
      status: "Salvando todo o mapa...",
    });

    const result = await persistCommandMapDraftsForExecution({
      onProgress: ({ current, total, percent }) => {
        const status = total
          ? `Salvando blocos ${current}/${total} para preparar o loop.`
          : "Nenhuma alteracao pendente no mapa.";
        setCommandMapSaveState({
          running: total > 0 && current < total,
          percent,
          status,
        });
      },
    });

    if (!result.total) {
      setCommandMapSaveState({
        running: false,
        dirty: false,
        percent: 100,
        status: "Mapa ja estava salvo e pronto para o loop.",
      });
      setMessage("Mapa ja estava salvo e pronto para o loop.", "success");
      return;
    }

    setCommandMapSaveState({
      running: false,
      dirty: false,
      percent: 100,
      status: `Mapa salvo com sucesso. ${result.saved} bloco(s) pronto(s) para o loop.`,
    });
    setMessage("Mapa salvo com sucesso e pronto para o loop.", "success");
  } catch (error) {
    setCommandMapSaveState({
      running: false,
      dirty: true,
      status: `Falha ao salvar o mapa: ${String(error)}`,
    });
    throw error;
  }
}

async function persistVisibleRecognitionDrafts() {
  const cards = Array.from(
    commandMapList?.querySelectorAll('.command-tree-card[data-type="clicar_imagem"]') || []
  );
  if (!cards.length) {
    return;
  }

  for (const card of cards) {
    const order = Number(card.dataset.order);
    if (!Number.isFinite(order) || order <= 0) {
      continue;
    }

    const values = treeValuesFromCard(card);
    if (!String(values.imagePath || "").trim()) {
      continue;
    }

    const roadmap = await invoke("update_image_click_block", {
      order,
      imagem: values.imagePath,
      timeout: values.timeout,
      confianca: values.confidence,
      perfilBusca: values.searchProfile,
      clicar: recognitionClicksFromMode(values.recognitionClickMode, 1) > 0,
      clicks: recognitionClicksFromMode(values.recognitionClickMode, 1),
      offsetX: 0,
      offsetY: 0,
      janelaAlvo: values.windowTitle.trim() || null,
      aoNaoEncontrar: values.failureAction,
      blocoNaoEncontrar: optionalPositiveInt(values.failureBlock),
      quantidadeTentativas: values.retryCount,
      intervaloTentativas: values.retryInterval,
      delay: values.delay,
    });
    if (roadmap) {
      applyRoadmap(roadmap);
    }
  }

  await refreshAutomationLibrary();
  await refreshTestLoopData();
}

function focusEditorBlock(order) {
  setWorkspaceTab("commands");
  requestAnimationFrame(() => {
    setCommandMapFocus(order, { scroll: true, force: true });
    const target = commandMapList?.querySelector(`.command-tree-card[data-order="${order}"]`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.style.boxShadow = "0 0 0 1px rgba(223, 109, 58, 0.42), 0 0 0 10px rgba(223, 109, 58, 0.1)";
      setTimeout(() => {
        target.style.boxShadow = "";
      }, 1400);
    }
  });
}

document.getElementById("addTextButton").addEventListener("click", () => {
  const text = textInput.value.trimEnd();
  if (!text) {
    setMessage("Digite um texto antes de adicionar o bloco.", "error");
    return;
  }
  runMutation("Texto adicionado", () =>
    invoke("add_text_block", {
      text: text.includes("\n") ? text : text,
      delay: parseNumber(textDelay.value, 0),
      sequencia: currentSequenceName(),
      aoSucesso: "continuar",
      blocoSucesso: null,
    })
  , focusLastCommandMapCard);
});

mapZoomRange.addEventListener("input", (event) => {
  setCommandMapZoom(Number(event.target.value) / 100);
});

mapZoomOutButton.addEventListener("click", () => {
  setCommandMapZoom(Math.round((state.commandMapZoom - 0.05) * 100) / 100);
});

mapZoomInButton.addEventListener("click", () => {
  setCommandMapZoom(Math.round((state.commandMapZoom + 0.05) * 100) / 100);
});

mapPrevButton?.addEventListener("click", () => {
  moveCommandMapFocus(-1);
});

mapNextButton?.addEventListener("click", () => {
  moveCommandMapFocus(1);
});

document.getElementById("addKeyButton").addEventListener("click", () => {
  const keys = keyInput.value.trim();
  if (!keys) {
    setMessage("Informe uma tecla ou um atalho.", "error");
    return;
  }
  runMutation("Bloco de teclado adicionado", () =>
    invoke("add_key_block", {
      keys,
      repeat: Math.max(1, Math.trunc(parseNumber(keyRepeatInput.value, 1))),
      delay: parseNumber(keyDelay.value, 0),
      sequencia: currentSequenceName(),
      aoSucesso: "continuar",
      blocoSucesso: null,
    })
  , focusLastCommandMapCard);
});

document.getElementById("addMouseButton").addEventListener("click", () => {
  runMutation("Bloco de mouse adicionado", () =>
    invoke("add_mouse_block", {
      x: parseNumber(mouseXInput.value, 0),
      y: parseNumber(mouseYInput.value, 0),
      button: mouseButtonInput.value,
      clicks: Math.max(1, Math.trunc(parseNumber(mouseClicksInput.value, 1))),
      delay: parseNumber(mouseDelay.value, 0),
      sequencia: currentSequenceName(),
      aoSucesso: "continuar",
      blocoSucesso: null,
    })
  , focusLastCommandMapCard);
});

document.getElementById("addImageButton").addEventListener("click", () => {
  const imagePath = imagePathInput.value.trim();
  if (!imagePath) {
    setMessage("Selecione uma referencia visual antes de adicionar o bloco.", "error");
    return;
  }
  runMutation("Bloco de reconhecimento adicionado", () =>
    invoke("add_image_click_block", {
      imagem: imagePath,
      timeout: parseNumber(imageTimeoutInput.value, 10),
      confianca: parseNumber(imageConfidenceInput.value, 0.8),
      perfilBusca: normalizeRecognitionProfile(imageSearchProfileInput.value, "balanced"),
      clicar: recognitionClicksFromMode(imageClickModeInput.value, 1) > 0,
      clicks: recognitionClicksFromMode(imageClickModeInput.value, 1),
      offsetX: 0,
      offsetY: 0,
      janelaAlvo: imageWindowTitleInput.value.trim() || null,
      aoNaoEncontrar: imageFailureActionInput.value || "parar",
      blocoNaoEncontrar: optionalPositiveInt(imageFailureBlockInput.value),
      quantidadeTentativas: Math.max(1, Math.trunc(parseNumber(imageRetryCountInput.value, 1))),
      intervaloTentativas: parseNumber(imageRetryIntervalInput.value, 1),
      delay: parseNumber(imageDelayInput.value, 0),
      sequencia: currentSequenceName(),
      aoSucesso: "continuar",
      blocoSucesso: null,
    })
  , focusLastCommandMapCard);
});

analyzeChromeHtmlButton?.addEventListener("click", () => {
  analyzeChromeHtmlForComposer().catch((error) => setMessage(String(error), "error"));
});

chromeHtmlInput?.addEventListener("paste", () => {
  setTimeout(() => {
    analyzeChromeHtmlForComposer().catch(() => {});
  }, 80);
});

chromeTargetMethodInput?.addEventListener("change", () => {
  const analysis = parseChromeAnalysisJson(chromeAnalysisJsonInput?.value);
  const selector = findChromeSelectorByMethod(analysis, chromeTargetMethodInput.value);
  if (chromeTargetValueInput && selector?.valor) {
    chromeTargetValueInput.value = selector.valor;
  }
});

selectChromeFallbackImageButton?.addEventListener("click", () => {
  openImagePicker({ scope: "composer-chrome-fallback" });
});

addChromeHtmlButton?.addEventListener("click", () => {
  const values = composerChromeValues();
  if (!values.chromeHtml.trim()) {
    setMessage("Cole o HTML do elemento antes de adicionar o bloco Chrome.", "error");
    return;
  }
  runMutation("Bloco Chrome HTML adicionado", async () => {
    const analysis = values.chromeAnalysis || await invoke("analyze_html_element", { html: values.chromeHtml });
    const details = buildChromeDetailsFromAnalysisAndValues(analysis, values);
    return invoke("add_chrome_html_block", {
      nome: details.nome,
      htmlOriginal: details.html_original,
      elemento: details.elemento,
      alvo: details.alvo,
      acao: details.acao,
      timeout: details.timeout,
      fallbackVisual: details.fallback_visual,
      fallbackImagem: details.fallback_imagem || null,
      aoSucesso: details.ao_sucesso,
      blocoSucesso: optionalPositiveInt(details.bloco_sucesso),
      aoFalhar: details.ao_falhar,
      blocoFalha: optionalPositiveInt(details.bloco_falha),
      quantidadeTentativas: details.quantidade_tentativas,
      intervaloTentativas: details.intervalo_tentativas,
      delay: values.delay,
      sequencia: currentSequenceName(),
    });
  }, focusLastCommandMapCard);
});

document.getElementById("addVerifyButton").addEventListener("click", () => {
  if (!verifyActiveImageInput.value.trim() || !verifyInactiveImageInput.value.trim()) {
    setMessage("Selecione as referencias ativa e desativada antes de adicionar a verificacao.", "error");
    return;
  }
  runMutation("Bloco de verificacao adicionado", () =>
    invoke("add_verify_button_state_block", {
      nome: verifyNameInput.value.trim() || "Verificar botao",
      imagemAtivo: verifyActiveImageInput.value.trim(),
      imagemDesativado: verifyInactiveImageInput.value.trim(),
      timeout: parseNumber(verifyTimeoutInput.value, 5),
      confianca: parseNumber(verifyConfidenceInput.value, 0.85),
      acaoAtivo: verifyActiveActionInput.value,
      sequenciaAtivo: verifyActiveSequenceInput.value.trim() || null,
      acaoDesativado: verifyInactiveActionInput.value,
      sequenciaDesativado: verifyInactiveSequenceInput.value.trim() || null,
      acaoNaoEncontrar: verifyMissingActionInput.value,
      sequenciaNaoEncontrar: verifyMissingSequenceInput.value.trim() || null,
      delay: parseNumber(verifyDelayInput.value, 0),
      sequencia: currentSequenceName(),
    })
  , focusLastCommandMapCard);
});

captureMouseButton.addEventListener("click", () => {
  beginMouseCapture({ scope: "composer-mouse" });
});

selectImageButton.addEventListener("click", () => {
  openImagePicker({ scope: "composer-image" });
});

testImageRecognitionButton?.addEventListener("click", () => {
  runImageRecognitionTest({
    imagePath: imagePathInput.value.trim(),
    timeout: parseNumber(imageTimeoutInput.value, 10),
    confidence: parseNumber(imageConfidenceInput.value, 0.8),
    windowTitle: imageWindowTitleInput.value.trim(),
    searchProfile: normalizeRecognitionProfile(imageSearchProfileInput.value, "balanced"),
  }, { inheritWindowFallback: true });
});

selectVerifyActiveImageButton.addEventListener("click", () => {
  openImagePicker({ scope: "composer-verify-active" });
});

selectVerifyInactiveImageButton.addEventListener("click", () => {
  openImagePicker({ scope: "composer-verify-inactive" });
});

document.getElementById("addSpreadsheetButton").addEventListener("click", () => {
  if (!sheetSelect.value || !columnSelect.value) {
    setMessage("Escolha uma aba e uma coluna da planilha.", "error");
    return;
  }
  runMutation("Loop da planilha adicionado", () =>
    invoke("add_spreadsheet_block", {
      workbook: composerWorkbookSelect.value || state.composerWorkbookId || null,
      sheet: sheetSelect.value,
      column: columnSelect.value,
      delay: parseNumber(spreadsheetDelay.value, 0),
      afterAction: afterActionInput.value.trim() || "nenhuma",
      intervalBetween: parseNumber(betweenItemsInput.value, 0.5),
      sequencia: currentSequenceName(),
      aoSucesso: "continuar",
      blocoSucesso: null,
    })
  , focusLastCommandMapCard);
});

afterActionCaptureButton.addEventListener("click", () => {
  beginKeyCapture({ scope: "composer-after-action", field: "afterAction" });
});

sheetSelect.addEventListener("change", () => {
  populateColumnSelect(sheetSelect.value);
});

composerWorkbookSelect.addEventListener("change", () => {
  state.composerWorkbookId = composerWorkbookSelect.value;
  populateSheetSelect("");
});

editorTabButton.addEventListener("click", () => setWorkspaceTab("commands"));
assistTabButton.addEventListener("click", () => setWorkspaceTab("assist"));
commandTabButton.addEventListener("click", () => setWorkspaceTab("commands"));
workbookTabButton.addEventListener("click", () => setWorkspaceTab("workbook"));
launcherTabButton.addEventListener("click", () => setWorkspaceTab("launcher"));
document.getElementById("openEditorFromMap").addEventListener("click", () => setWorkspaceTab("commands"));

newAutomationButton.addEventListener("click", () => {
  setLauncherCreateOpen(true);
});

cancelCreateAutomationButton.addEventListener("click", () => {
  setLauncherCreateOpen(false);
});

confirmCreateAutomationButton.addEventListener("click", async () => {
  state.library.createDraft.nome = newAutomationNameInput.value.trim();
  state.library.createDraft.categoria = newAutomationCategoryInput.value.trim();
  state.library.createDraft.descricao = newAutomationDescriptionInput.value.trim();
  await createAutomationFromDraft();
});

launcherSearchInput.addEventListener("input", () => {
  state.library.search = launcherSearchInput.value;
  renderLauncherLibrary();
});

launcherCategoryFilter.addEventListener("change", () => {
  state.library.category = launcherCategoryFilter.value;
  renderLauncherLibrary();
});

launcherCreatedFromInput.addEventListener("change", () => {
  state.library.createdFrom = launcherCreatedFromInput.value;
  renderLauncherLibrary();
});

launcherUpdatedFromInput.addEventListener("change", () => {
  state.library.updatedFrom = launcherUpdatedFromInput.value;
  renderLauncherLibrary();
});

launcherSortInput.addEventListener("change", () => {
  state.library.sort = launcherSortInput.value;
  renderLauncherLibrary();
});

launcherFiltersToggleButton?.addEventListener("click", () => {
  if (launcherExtraFilters) {
    launcherExtraFilters.hidden = true;
  }
});

launcherList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-library-action]");
  if (!button) {
    return;
  }
  const card = button.closest("[data-automation-id]");
  const automationId = card?.dataset.automationId;
  if (!automationId) {
    return;
  }
  const action = button.dataset.libraryAction;

  try {
    if (action === "create") {
      setLauncherCreateOpen(true);
      return;
    }

    if (action === "create-cancel") {
      setLauncherCreateOpen(false);
      return;
    }

    if (action === "create-confirm") {
      await createAutomationFromDraft();
      return;
    }

    if (action === "flip" || action === "unflip") {
      card.classList.toggle("is-flipped", action === "flip");
      return;
    }

    if (action === "edit") {
      if (!confirmLeaveEditorIfDirty()) {
        return;
      }
      setBusy("Abrindo");
      const result = await invoke("open_saved_automation", { id: automationId });
      applyRoadmap(result);
      await refreshTestLoopData();
      state.library.items = result.library?.items || state.library.items;
      state.library.categories = result.library?.categories || state.library.categories;
      state.library.activeId = result.library?.active_id || automationId;
      if (result.active_automation?.nome) {
        exportNameInput.value = result.active_automation.nome;
      }
      renderLauncherLibrary();
      setWorkspaceTab("commands");
      setBusy("Pronto");
      setMessage("Automacao carregada no mapa dos comandos.", "success");
      return;
    }

    if (action === "run") {
      if (!window.confirm("Deseja executar esta automacao agora?")) {
        return;
      }
      setBusy("Executando");
      const result = await invoke("execute_saved_automation", {
        id: automationId,
        delay: parseNumber(testDelayInput.value, 3),
        loopStart: Math.max(1, Math.trunc(parseNumber(testLoopStartInput.value, 1))),
      });
      await refreshAutomationLibrary();
      setBusy("Pronto");
      setMessage(result || "Executando automacao...", "success");
      return;
    }

    if (action === "duplicate") {
      setBusy("Duplicando");
      await invoke("duplicate_saved_automation", { id: automationId });
      await refreshAutomationLibrary("Automacao duplicada.");
      setBusy("Pronto");
      return;
    }

    if (action === "edit-meta") {
      setLibraryEditOpen(automationId, true);
      card.classList.add("is-flipped");
      return;
    }

    if (action === "edit-cancel") {
      setLibraryEditOpen(automationId, false);
      card.classList.remove("is-flipped");
      return;
    }

    if (action === "edit-save") {
      setBusy("Salvando");
      await saveLibraryCardEdit(automationId);
      card.classList.add("is-flipped");
      setBusy("Pronto");
      return;
    }

    if (action === "rename") {
      const item = state.library.items.find((entry) => String(entry.id) === String(automationId));
      const novoNome = window.prompt("Novo nome da automacao:", item?.nome || "");
      if (!novoNome) {
        return;
      }
      setBusy("Renomeando");
      await invoke("rename_saved_automation", {
        id: automationId,
        nome: novoNome,
        descricao: item?.descricao || "",
        categoria: item?.categoria || "Outros",
      });
      await refreshAutomationLibrary("Automacao renomeada.");
      setBusy("Pronto");
      return;
    }

    if (action === "delete") {
      if (!window.confirm("Tem certeza que deseja excluir esta automacao?")) {
        return;
      }
      setBusy("Excluindo");
      await invoke("delete_saved_automation", { id: automationId });
      await refreshAutomationLibrary("Automacao excluida.");
      setBusy("Pronto");
    }
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
});

launcherList.addEventListener("input", (event) => {
  const editField = event.target.closest("[data-library-edit-field]");
  if (editField) {
    const key = editField.dataset.libraryEditField;
    if (key) {
      state.library.editDraft[key] = editField.value;
    }
    return;
  }

  const field = event.target.closest("[data-create-field]");
  if (!field) {
    return;
  }
  const key = field.dataset.createField;
  if (!key) {
    return;
  }
  state.library.createDraft[key] = field.value;
});

[editorPanel, commandsPanel, workbookPanel].forEach((panel) => {
  panel?.addEventListener("input", () => {
    state.library.dirty = true;
  });
});

commandsPanel?.addEventListener("input", () => {
  markCommandMapSaveDirty();
});

mapSaveButton?.addEventListener("click", async () => {
  try {
    setBusy("Salvando mapa");
    await saveEntireCommandMap();
    setBusy("Pronto");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
});

testDelayInput.addEventListener("input", () => syncTestInputsFrom("top"));
testLoopStartInput.addEventListener("input", () => syncTestInputsFrom("top"));
testWindowTitleInput.addEventListener("input", () => syncTestInputsFrom("top"));
assistDelayInput.addEventListener("input", () => syncTestInputsFrom("assist"));
assistLoopStartInput.addEventListener("input", () => syncTestInputsFrom("assist"));
assistWindowTitleInput.addEventListener("input", () => syncTestInputsFrom("assist"));

workbookSheetSelect.addEventListener("change", async () => {
  try {
    setBusy("Carregando planilha");
    await loadWorkbookPreview(workbookSheetSelect.value, state.previewWorkbookId);
    setBusy("Pronto");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
});

workbookSearchInput.addEventListener("input", () => {
  state.workbookSearch = workbookSearchInput.value;
  renderWorkbookPreview();
});

workbookFilesTabs.addEventListener("click", async (event) => {
  const tab = event.target.closest("[data-workbook-tab]");
  if (!tab) {
    return;
  }

  try {
    state.previewWorkbookId = tab.dataset.workbookTab || "";
    state.workbookSelectedSheet = "";
    state.workbookSelectedColumn = "";
    state.workbookSelectedCell = null;
    setBusy("Carregando planilha");
    await loadWorkbookPreview("", state.previewWorkbookId);
    populateSheetSelect("");
    setBusy("Pronto");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
});

addWorkbookButton.addEventListener("click", () => {
  workbookFileInput.click();
});

refreshWindowsButton?.addEventListener("click", async () => {
  try {
    setBusy("Lendo janelas");
    await refreshOpenWindows("Janelas abertas atualizadas.");
    setBusy("Pronto");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
});

refreshAssistWindowsButton?.addEventListener("click", async () => {
  try {
    setBusy("Lendo janelas");
    await refreshOpenWindows("Janelas abertas atualizadas.");
    setBusy("Pronto");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
});

refreshImageWindowsButton?.addEventListener("click", async () => {
  try {
    setBusy("Lendo janelas");
    await refreshOpenWindows("Janelas abertas atualizadas.");
    setBusy("Pronto");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
});

workbookFileInput.addEventListener("change", async () => {
  const file = workbookFileInput.files?.[0];
  if (!file) {
    return;
  }

  try {
    setBusy("Importando planilha");
    const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
    const result = await invoke("import_workbook", {
      fileName: file.name,
      bytes,
    });
    await refreshWorkbookMeta();
    state.previewWorkbookId = result.workbook_id || state.previewWorkbookId;
    await loadWorkbookPreview("", state.previewWorkbookId);
    populateSheetSelect("");
    setBusy("Pronto");
    setMessage(`Planilha ${file.name} adicionada ao projeto.`, "success");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  } finally {
    workbookFileInput.value = "";
  }
});

imageFileInput.addEventListener("change", async () => {
  const file = imageFileInput.files?.[0];
  if (!file) {
    return;
  }

  try {
    setBusy("Importando imagem");
    const result = await importImageToProject(file);
    writeImportedImagePath(state.imageImportTarget, result.image_id || "");
    setBusy("Pronto");
    setMessage(`Referencia ${file.name} adicionada ao projeto.`, "success");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  } finally {
    state.imageImportTarget = null;
    imageFileInput.value = "";
  }
});

workbookTableWrap.addEventListener("click", (event) => {
  const columnButton = event.target.closest("[data-workbook-column-action]");
  if (columnButton) {
    state.workbookSelectedColumn = columnButton.dataset.column || "";
    renderWorkbookPreview();
    return;
  }

  const addButton = event.target.closest("[data-workbook-cell-add]");
  if (addButton) {
    state.workbookSelectedCell = {
      sheet: state.workbookSelectedSheet,
      rowNumber: Number(addButton.dataset.rowNumber),
      header: addButton.dataset.column || "",
      value: addButton.dataset.value || "",
    };
    updateWorkbookSelectionLabels();
    runMutation("Valor da planilha adicionado", () =>
      invoke("add_text_block", {
        text: state.workbookSelectedCell.value,
        delay: parseNumber(workbookTextDelay.value, 0),
        sequencia: currentSequenceName(),
      })
    , focusLastCommandMapCard);
    return;
  }

  const cell = event.target.closest("[data-workbook-cell]");
  if (!cell) {
    return;
  }

  state.workbookSelectedCell = {
    sheet: state.workbookSelectedSheet,
    rowNumber: Number(cell.dataset.rowNumber),
    header: cell.dataset.column || "",
    value: cell.dataset.value || "",
  };
  state.workbookSelectedColumn = cell.dataset.column || state.workbookSelectedColumn;
  renderWorkbookPreview();
});

addWorkbookCellButton.addEventListener("click", () => {
  if (!state.workbookSelectedCell?.value) {
    setMessage("Selecione um valor da planilha antes de adicionar ao mapa.", "error");
    return;
  }

  runMutation("Valor da planilha adicionado", () =>
    invoke("add_text_block", {
      text: state.workbookSelectedCell.value,
      delay: parseNumber(workbookTextDelay.value, 0),
      sequencia: currentSequenceName(),
    })
  , focusLastCommandMapCard);
});

addWorkbookColumnButton.addEventListener("click", () => {
  if (!state.workbookSelectedSheet || !state.workbookSelectedColumn) {
    setMessage("Selecione uma coluna da planilha antes de criar o loop.", "error");
    return;
  }

  runMutation("Loop da planilha adicionado", () =>
    invoke("add_spreadsheet_block", {
      workbook: state.previewWorkbookId || null,
      sheet: state.workbookSelectedSheet,
      column: state.workbookSelectedColumn,
      delay: parseNumber(workbookLoopDelay.value, 0),
      afterAction: workbookAfterAction.value.trim() || "nenhuma",
      intervalBetween: parseNumber(workbookBetweenItems.value, 0.5),
      sequencia: currentSequenceName(),
    })
  , focusLastCommandMapCard);
});

workbookAfterActionCaptureButton.addEventListener("click", () => {
  beginKeyCapture({ scope: "workbook-after-action", field: "afterAction" });
});

document.getElementById("refreshButton").addEventListener("click", async () => {
  try {
    setBusy("Atualizando");
    await refreshWorkbookMeta();
    await loadWorkbookPreview(state.workbookSelectedSheet || workbookSheetSelect.value, state.previewWorkbookId);
    await refreshRoadmap("Roteiro recarregado.");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
});

document.getElementById("legacyButton").addEventListener("click", async () => {
  try {
    setBusy("Abrindo captura");
    const result = await invoke("launch_legacy_capture");
    setBusy("Pronto");
    setMessage(result, "success");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
});

applyBulkDelayButton?.addEventListener("click", async () => {
  await applyBulkDelayToAllBlocks("top");
});

mapApplyBulkDelayButton?.addEventListener("click", async () => {
  await applyBulkDelayToAllBlocks("map");
});


document.getElementById("exportButton").addEventListener("click", async () => {
  const automationName = exportNameInput.value.trim();
  if (!automationName) {
    setMessage("Informe um nome para a automacao antes de exportar.", "error");
    return;
  }

  try {
    setBusy("Exportando");
    const result = await invoke("export_automation_bundle", { automationName });
    setBusy("Pronto");
    setMessage(
      `Automacao "${automationName}" gerada em ${result.export_dir} com interface propria, Dados do loop e Textos livres editaveis. Copiados: ${result.copied.length}.`,
      "success"
    );
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
});

document.getElementById("clearButton").addEventListener("click", () => {
  runMutation("Roteiro limpo", () => invoke("clear_blocks"), () => null);
});

timelineList.addEventListener("change", (event) => {
  const target = event.target;
  if (target.matches('[data-field="chromeTargetMethod"]')) {
    const card = target.closest(".flow-card");
    const analysis = parseChromeAnalysisJson(card?.querySelector('[data-field="chromeAnalysis"]')?.value);
    const selector = findChromeSelectorByMethod(analysis, target.value);
    const valueField = card?.querySelector('[data-field="chromeTargetValue"]');
    if (valueField && selector?.valor) {
      valueField.value = selector.valor;
    }
    return;
  }
  if (target.matches('[data-field="workbook"]')) {
    const card = target.closest(".flow-card");
    const sheetField = card.querySelector('[data-field="sheet"]');
    const columnField = card.querySelector('[data-field="column"]');
    const sheets = workbookSheetsFor(target.value);
    const nextSheet = sheets[0]?.name ?? "";
    sheetField.innerHTML = sheets
      .map((sheet) => `<option value="${escapeHtml(sheet.name)}">${escapeHtml(sheet.name)}</option>`)
      .join("");
    sheetField.value = nextSheet;
    const columns = columnsForSheetInWorkbook(target.value, nextSheet);
    columnField.innerHTML = columns
      .map((column) => `<option value="${escapeHtml(column)}">${escapeHtml(column)}</option>`)
      .join("");
    columnField.value = columns[0] ?? "";
    return;
  }

  if (target.matches('[data-field="sheet"]')) {
    const card = target.closest(".flow-card");
    const workbookField = card.querySelector('[data-field="workbook"]');
    const columnField = card.querySelector('[data-field="column"]');
    const columns = columnsForSheetInWorkbook(workbookField?.value, target.value);
    columnField.innerHTML = columns
      .map((column) => `<option value="${escapeHtml(column)}">${escapeHtml(column)}</option>`)
      .join("");
    columnField.value = columns[0] ?? "";
  }
});

timelineList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const card = button.closest(".flow-card");
  const order = Number(card.dataset.order);
  const type = card.dataset.type;
  const values = formValuesFromCard(card);
  const action = button.dataset.action;

  if (action === "record-key") {
    state.commandMapFocusOrder = order;
    beginKeyCapture({ scope: "update-editor", order });
    return;
  }

  if (action === "record-mouse") {
    state.commandMapFocusOrder = order;
    beginMouseCapture({ scope: "update-editor", order });
    return;
  }

  if (action === "record-after-action") {
    state.commandMapFocusOrder = order;
    beginKeyCapture({ scope: "update-editor", order, field: "afterAction" });
    return;
  }

  if (action === "select-image") {
    state.commandMapFocusOrder = order;
    openImagePicker({ scope: "update-editor", order });
    return;
  }

  if (action === "analyze-chrome-html") {
    state.commandMapFocusOrder = order;
    analyzeChromeHtmlInContainer(card, "data-field");
    return;
  }

  if (action === "select-chrome-fallback-image") {
    state.commandMapFocusOrder = order;
    openImagePicker({ scope: "update-editor-chrome-fallback", order });
    return;
  }

  if (action === "test-image-recognition") {
      state.commandMapFocusOrder = order;
      runImageRecognitionTest(values, { inheritWindowFallback: false });
      return;
    }

  if (action === "select-verify-active-image") {
    state.commandMapFocusOrder = order;
    openImagePicker({ scope: "update-editor-verify-active", order });
    return;
  }

  if (action === "select-verify-inactive-image") {
    state.commandMapFocusOrder = order;
    openImagePicker({ scope: "update-editor-verify-inactive", order });
    return;
  }

  if (action === "up") {
    runMutation("Bloco movido", () => invoke("move_block", { order, direction: "up" }), (roadmap) =>
      resolveNearestCommandMapFocus(roadmap, order - 1)
    );
    return;
  }

  if (action === "down") {
    runMutation("Bloco movido", () => invoke("move_block", { order, direction: "down" }), (roadmap) =>
      resolveNearestCommandMapFocus(roadmap, order + 1)
    );
    return;
  }

  if (action === "remove") {
    runMutation("Bloco removido", () => invoke("remove_block", { order }), (roadmap) =>
      resolveNearestCommandMapFocus(roadmap, order)
    );
    return;
  }

  if (action === "save") {
    if (type === "texto_livre") {
      runMutation("Bloco salvo", () =>
        invoke("update_text_block", {
          order,
          text: values.text,
          delay: values.delay,
          aoSucesso: values.successAction,
          blocoSucesso: optionalPositiveInt(values.successBlock),
        })
      , () => order);
      return;
    }

    if (type === "tecla" || type === "atalho") {
      runMutation("Bloco salvo", () =>
        invoke("update_key_block", {
          order,
          keys: values.keys,
          repeat: values.repeat,
          delay: values.delay,
          aoSucesso: values.successAction,
          blocoSucesso: optionalPositiveInt(values.successBlock),
        })
      , () => order);
      return;
    }

    if (type === "mouse_click") {
      runMutation("Bloco salvo", () =>
        invoke("update_mouse_block", {
          order,
          x: values.x,
          y: values.y,
          button: values.button,
          clicks: values.clicks,
          delay: values.delay,
          aoSucesso: values.successAction,
          blocoSucesso: optionalPositiveInt(values.successBlock),
        })
      , () => order);
      return;
    }

    if (type === "clicar_imagem") {
      if (!values.imagePath.trim()) {
        setMessage("Selecione uma referencia visual antes de salvar esse bloco.", "error");
        return;
      }
      runMutation("Bloco salvo", () =>
        invoke("update_image_click_block", {
          order,
          imagem: values.imagePath,
          timeout: values.timeout,
          confianca: values.confidence,
          perfilBusca: values.searchProfile,
          clicar: recognitionClicksFromMode(values.recognitionClickMode, 1) > 0,
          clicks: recognitionClicksFromMode(values.recognitionClickMode, 1),
          offsetX: 0,
          offsetY: 0,
          janelaAlvo: values.windowTitle.trim() || null,
          aoNaoEncontrar: values.failureAction,
          blocoNaoEncontrar: optionalPositiveInt(values.failureBlock),
          quantidadeTentativas: values.retryCount,
          intervaloTentativas: values.retryInterval,
          delay: values.delay,
          aoSucesso: values.successAction,
          blocoSucesso: optionalPositiveInt(values.successBlock),
        })
      , () => order);
      return;
    }

    if (type === "chrome_elemento_html") {
      if (!values.chromeHtml.trim()) {
        setMessage("Cole o HTML do elemento antes de salvar esse bloco.", "error");
        return;
      }
      runMutation("Bloco salvo", async () => {
        const analysis = values.chromeAnalysis || await invoke("analyze_html_element", { html: values.chromeHtml });
        const details = buildChromeDetailsFromAnalysisAndValues(analysis, values);
        return invoke("update_chrome_html_block", {
          order,
          nome: details.nome,
          htmlOriginal: details.html_original,
          elemento: details.elemento,
          alvo: details.alvo,
          acao: details.acao,
          timeout: details.timeout,
          fallbackVisual: details.fallback_visual,
          fallbackImagem: details.fallback_imagem || null,
          aoSucesso: details.ao_sucesso,
          blocoSucesso: optionalPositiveInt(details.bloco_sucesso),
          aoFalhar: details.ao_falhar,
          blocoFalha: optionalPositiveInt(details.bloco_falha),
          quantidadeTentativas: details.quantidade_tentativas,
          intervaloTentativas: details.intervalo_tentativas,
          delay: values.delay,
        });
      }, () => order);
      return;
    }

    if (type === "verificar_estado_botao") {
      if (!values.verifyActiveImage.trim() || !values.verifyInactiveImage.trim()) {
        setMessage("Selecione as referencias ativa e desativada antes de salvar esse bloco.", "error");
        return;
      }
      runMutation("Bloco salvo", () =>
        invoke("update_verify_button_state_block", {
          order,
          nome: values.verifyName || "Verificar botao",
          imagemAtivo: values.verifyActiveImage,
          imagemDesativado: values.verifyInactiveImage,
          timeout: values.verifyTimeout,
          confianca: values.verifyConfidence,
          acaoAtivo: values.verifyActiveAction,
          sequenciaAtivo: values.verifyActiveSequence.trim() || null,
          acaoDesativado: values.verifyInactiveAction,
          sequenciaDesativado: values.verifyInactiveSequence.trim() || null,
          acaoNaoEncontrar: values.verifyMissingAction,
          sequenciaNaoEncontrar: values.verifyMissingSequence.trim() || null,
          delay: values.delay,
        })
      , () => order);
      return;
    }

    runMutation("Bloco salvo", () =>
      invoke("update_spreadsheet_block", {
        order,
        workbook: values.workbook || null,
        sheet: values.sheet,
        column: values.column,
        afterAction: values.afterAction,
        intervalBetween: values.intervalBetween,
        delay: values.delay,
        aoSucesso: values.successAction,
        blocoSucesso: optionalPositiveInt(values.successBlock),
      })
    , () => order);
  }
});

commandMapList.addEventListener("change", (event) => {
  const target = event.target;
  if (target.matches('[data-tree-field="chromeTargetMethod"]')) {
    const card = target.closest(".command-tree-card");
    const analysis = parseChromeAnalysisJson(card?.querySelector('[data-tree-field="chromeAnalysis"]')?.value);
    const selector = findChromeSelectorByMethod(analysis, target.value);
    const valueField = card?.querySelector('[data-tree-field="chromeTargetValue"]');
    if (valueField && selector?.valor) {
      valueField.value = selector.valor;
    }
    return;
  }

  if (target.matches("[data-connector-delay]")) {
    const order = Number(target.dataset.order);
    runMutation("Tempo entre blocos atualizado", () =>
      invoke("update_block_delay", {
        order,
        delay: parseNumber(target.value, 0),
      })
    );
    return;
  }

  if (target.matches('[data-tree-field="workbook"]')) {
    const card = target.closest(".command-tree-card");
    const sheetField = card.querySelector('[data-tree-field="sheet"]');
    const columnField = card.querySelector('[data-tree-field="column"]');
    const sheets = workbookSheetsFor(target.value);
    const nextSheet = sheets[0]?.name ?? "";
    sheetField.innerHTML = sheets
      .map((sheet) => `<option value="${escapeHtml(sheet.name)}">${escapeHtml(sheet.name)}</option>`)
      .join("");
    sheetField.value = nextSheet;
    const columns = columnsForSheetInWorkbook(target.value, nextSheet);
    columnField.innerHTML = columns
      .map((column) => `<option value="${escapeHtml(column)}">${escapeHtml(column)}</option>`)
      .join("");
    columnField.value = columns[0] ?? "";
    return;
  }

  if (target.matches('[data-tree-field="sheet"]')) {
    const card = target.closest(".command-tree-card");
    const workbookField = card.querySelector('[data-tree-field="workbook"]');
    const columnField = card.querySelector('[data-tree-field="column"]');
    const columns = columnsForSheetInWorkbook(workbookField?.value, target.value);
    columnField.innerHTML = columns
      .map((column) => `<option value="${escapeHtml(column)}">${escapeHtml(column)}</option>`)
      .join("");
    columnField.value = columns[0] ?? "";
    return;
  }

  if (target.matches('[data-insert-field="workbook"]')) {
    const panel = target.closest(".insert-card-panel");
    const sheetField = panel.querySelector('[data-insert-field="sheet"]');
    const columnField = panel.querySelector('[data-insert-field="column"]');
    const sheets = workbookSheetsFor(target.value);
    const nextSheet = sheets[0]?.name ?? "";
    sheetField.innerHTML = sheets
      .map((sheet) => `<option value="${escapeHtml(sheet.name)}">${escapeHtml(sheet.name)}</option>`)
      .join("");
    sheetField.value = nextSheet;
    const columns = columnsForSheetInWorkbook(target.value, nextSheet);
    columnField.innerHTML = columns
      .map((column) => `<option value="${escapeHtml(column)}">${escapeHtml(column)}</option>`)
      .join("");
    columnField.value = columns[0] ?? "";
    if (state.insertPanel) {
      state.insertPanel.workbook = target.value;
      state.insertPanel.sheet = nextSheet;
      state.insertPanel.column = columns[0] ?? "";
    }
    return;
  }

  if (target.matches('[data-insert-field="chromeTargetMethod"]')) {
    const panel = target.closest(".insert-card-panel");
    const analysis = parseChromeAnalysisJson(panel?.querySelector('[data-insert-field="chromeAnalysis"]')?.value);
    const selector = findChromeSelectorByMethod(analysis, target.value);
    const valueField = panel?.querySelector('[data-insert-field="chromeTargetValue"]');
    if (valueField && selector?.valor) {
      valueField.value = selector.valor;
    }
    if (state.insertPanel) {
      state.insertPanel.chromeTargetMethod = target.value;
      state.insertPanel.chromeTargetValue = selector?.valor || state.insertPanel.chromeTargetValue || "";
    }
  }

  if (target.matches('[data-insert-field="sheet"]')) {
    const panel = target.closest(".insert-card-panel");
    const workbookField = panel.querySelector('[data-insert-field="workbook"]');
    const columns = columnsForSheetInWorkbook(workbookField?.value, target.value);
    const columnField = panel.querySelector('[data-insert-field="column"]');
    columnField.innerHTML = columns
      .map((column) => `<option value="${escapeHtml(column)}">${escapeHtml(column)}</option>`)
      .join("");
    columnField.value = columns[0] ?? "";
    if (state.insertPanel) {
      state.insertPanel.sheet = target.value;
      state.insertPanel.column = columns[0] ?? "";
    }
  }
});

commandMapList.addEventListener("pointerdown", (event) => {
  const segment = event.target.closest(".command-flow-segment");
  if (segment) {
    setCommandMapFocus(Number(segment.dataset.order), "auto");
  }

  const handle = event.target.closest("[data-drag-handle]");
  if (!handle || event.button !== 0) {
    return;
  }

  event.preventDefault();
  beginCardDrag(handle, event);
});

commandMapList.addEventListener("focusin", (event) => {
  const segment = event.target.closest(".command-flow-segment");
  if (segment) {
    setCommandMapFocus(Number(segment.dataset.order), "smooth");
  }
});

window.addEventListener("pointermove", (event) => {
  if (!state.draggingOrder || state.dragPointerId !== event.pointerId) {
    return;
  }

  event.preventDefault();
  moveDragPreview(event.clientX, event.clientY);
  autoScrollCommandMap(event.clientX);

  const targetIndex = getDragTargetIndexFromPoint(event.clientX, event.clientY);
  if (targetIndex) {
    updateDragTarget(targetIndex);
  }
});

window.addEventListener("pointerup", (event) => {
  if (!state.draggingOrder || state.dragPointerId !== event.pointerId) {
    return;
  }

  event.preventDefault();
  const targetIndex = getDragTargetIndexFromPoint(event.clientX, event.clientY);
  if (targetIndex) {
    updateDragTarget(targetIndex);
  }
  finishCardDrag(true);
});

window.addEventListener("pointercancel", (event) => {
  if (!state.draggingOrder || state.dragPointerId !== event.pointerId) {
    return;
  }

  finishCardDrag(false);
});

commandMapList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-tree-action]");
  if (!button) {
    return;
  }

  const card = button.closest(".command-tree-card");
  const order = Number(card.dataset.order);
  const type = card.dataset.type;
  const values = treeValuesFromCard(card);
  const action = button.dataset.treeAction;

  if (action === "open-editor") {
    setCommandMapFocus(order);
    focusEditorBlock(order);
    return;
  }

  if (action === "record-key") {
    setCommandMapFocus(order);
    beginKeyCapture({ scope: "update-tree", order });
    return;
  }

  if (action === "record-mouse") {
    setCommandMapFocus(order);
    beginMouseCapture({ scope: "update-tree", order });
    return;
  }

  if (action === "record-after-action") {
    setCommandMapFocus(order);
    beginKeyCapture({ scope: "update-tree", order, field: "afterAction" });
    return;
  }

  if (action === "select-image") {
    setCommandMapFocus(order);
    openImagePicker({ scope: "update-tree", order });
    return;
  }

  if (action === "analyze-chrome-html") {
    setCommandMapFocus(order);
    analyzeChromeHtmlInContainer(card, "data-tree-field");
    return;
  }

  if (action === "select-chrome-fallback-image") {
    setCommandMapFocus(order);
    openImagePicker({ scope: "update-tree-chrome-fallback", order });
    return;
  }

  if (action === "test-image-recognition") {
      setCommandMapFocus(order);
      runImageRecognitionTest(values, { inheritWindowFallback: false });
      return;
    }

  if (action === "select-verify-active-image") {
    setCommandMapFocus(order);
    openImagePicker({ scope: "update-tree-verify-active", order });
    return;
  }

  if (action === "select-verify-inactive-image") {
    setCommandMapFocus(order);
    openImagePicker({ scope: "update-tree-verify-inactive", order });
    return;
  }

  if (action === "insert-before" || action === "insert-after") {
    setCommandMapFocus(order);
    state.insertPanel = createInsertPanelState(order, action === "insert-before" ? "before" : "after");
    if (state.commandMapZoom > 1) {
      setCommandMapZoom(1);
    }
    commandMapList.scrollTop = 0;
    renderCommandMap();
    return;
  }

  if (action === "up") {
    runMutation("Bloco movido", () => invoke("move_block", { order, direction: "up" }), (roadmap) =>
      resolveNearestCommandMapFocus(roadmap, order - 1)
    );
    return;
  }

  if (action === "down") {
    runMutation("Bloco movido", () => invoke("move_block", { order, direction: "down" }), (roadmap) =>
      resolveNearestCommandMapFocus(roadmap, order + 1)
    );
    return;
  }

  if (action === "remove") {
    runMutation("Bloco removido", () => invoke("remove_block", { order }), (roadmap) =>
      resolveNearestCommandMapFocus(roadmap, order)
    );
    return;
  }

  if (action === "save") {
    if (type === "texto_livre") {
      runMutation("Bloco salvo", () =>
        invoke("update_text_block", {
          order,
          text: values.text,
          delay: values.delay,
          aoSucesso: values.successAction,
          blocoSucesso: optionalPositiveInt(values.successBlock),
        })
      , () => order);
      return;
    }

    if (type === "tecla" || type === "atalho") {
      runMutation("Bloco salvo", () =>
        invoke("update_key_block", {
          order,
          keys: values.keys,
          repeat: values.repeat,
          delay: values.delay,
          aoSucesso: values.successAction,
          blocoSucesso: optionalPositiveInt(values.successBlock),
        })
      , () => order);
      return;
    }

    if (type === "mouse_click") {
      runMutation("Bloco salvo", () =>
        invoke("update_mouse_block", {
          order,
          x: values.x,
          y: values.y,
          button: values.button,
          clicks: values.clicks,
          delay: values.delay,
          aoSucesso: values.successAction,
          blocoSucesso: optionalPositiveInt(values.successBlock),
        })
      , () => order);
      return;
    }

    if (type === "clicar_imagem") {
      if (!values.imagePath.trim()) {
        setMessage("Selecione uma referencia visual antes de salvar esse bloco.", "error");
        return;
      }
      runMutation("Bloco salvo", () =>
        invoke("update_image_click_block", {
          order,
          imagem: values.imagePath,
          timeout: values.timeout,
          confianca: values.confidence,
          perfilBusca: values.searchProfile,
          clicar: recognitionClicksFromMode(values.recognitionClickMode, 1) > 0,
          clicks: recognitionClicksFromMode(values.recognitionClickMode, 1),
          offsetX: 0,
          offsetY: 0,
          janelaAlvo: values.windowTitle.trim() || null,
          aoNaoEncontrar: values.failureAction,
          blocoNaoEncontrar: optionalPositiveInt(values.failureBlock),
          quantidadeTentativas: values.retryCount,
          intervaloTentativas: values.retryInterval,
          delay: values.delay,
          aoSucesso: values.successAction,
          blocoSucesso: optionalPositiveInt(values.successBlock),
        })
      , () => order);
      return;
    }

    if (type === "chrome_elemento_html") {
      if (!values.chromeHtml.trim()) {
        setMessage("Cole o HTML do elemento antes de salvar esse bloco.", "error");
        return;
      }
      runMutation("Bloco salvo", async () => {
        const analysis = values.chromeAnalysis || await invoke("analyze_html_element", { html: values.chromeHtml });
        const details = buildChromeDetailsFromAnalysisAndValues(analysis, values);
        return invoke("update_chrome_html_block", {
          order,
          nome: details.nome,
          htmlOriginal: details.html_original,
          elemento: details.elemento,
          alvo: details.alvo,
          acao: details.acao,
          timeout: details.timeout,
          fallbackVisual: details.fallback_visual,
          fallbackImagem: details.fallback_imagem || null,
          aoSucesso: details.ao_sucesso,
          blocoSucesso: optionalPositiveInt(details.bloco_sucesso),
          aoFalhar: details.ao_falhar,
          blocoFalha: optionalPositiveInt(details.bloco_falha),
          quantidadeTentativas: details.quantidade_tentativas,
          intervaloTentativas: details.intervalo_tentativas,
          delay: values.delay,
        });
      }, () => order);
      return;
    }

    if (type === "verificar_estado_botao") {
      if (!values.verifyActiveImage.trim() || !values.verifyInactiveImage.trim()) {
        setMessage("Selecione as referencias ativa e desativada antes de salvar esse bloco.", "error");
        return;
      }
      runMutation("Bloco salvo", () =>
        invoke("update_verify_button_state_block", {
          order,
          nome: values.verifyName || "Verificar botao",
          imagemAtivo: values.verifyActiveImage,
          imagemDesativado: values.verifyInactiveImage,
          timeout: values.verifyTimeout,
          confianca: values.verifyConfidence,
          acaoAtivo: values.verifyActiveAction,
          sequenciaAtivo: values.verifyActiveSequence.trim() || null,
          acaoDesativado: values.verifyInactiveAction,
          sequenciaDesativado: values.verifyInactiveSequence.trim() || null,
          acaoNaoEncontrar: values.verifyMissingAction,
          sequenciaNaoEncontrar: values.verifyMissingSequence.trim() || null,
          delay: values.delay,
        })
      , () => order);
      return;
    }

    runMutation("Bloco salvo", () =>
      invoke("update_spreadsheet_block", {
        order,
        workbook: values.workbook || null,
        sheet: values.sheet,
        column: values.column,
        afterAction: values.afterAction,
        intervalBetween: values.intervalBetween,
        delay: values.delay,
      })
    , () => order);
  }
});

commandMapList.addEventListener("click", (event) => {
  const emptyTypeButton = event.target.closest("button[data-empty-insert-type]");
  if (emptyTypeButton) {
    state.insertPanel = createInsertPanelState(0, "after");
    state.insertPanel.type = emptyTypeButton.dataset.emptyInsertType || "key";
    if (state.insertPanel.type === "spreadsheet") {
      state.insertPanel.workbook = state.insertPanel.workbook || state.composerWorkbookId || state.workbook?.default_workbook || "";
      state.insertPanel.sheet = state.insertPanel.sheet || workbookSheetsFor(state.insertPanel.workbook)[0]?.name || "";
      state.insertPanel.column = state.insertPanel.column || columnsForSheetInWorkbook(state.insertPanel.workbook, state.insertPanel.sheet)[0] || "";
    }
    renderCommandMap();
    return;
  }

  const button = event.target.closest("button[data-insert-action], button[data-insert-type]");
  if (!button) {
    return;
  }

  if (button.dataset.insertType) {
    if (!state.insertPanel) {
      return;
    }
    state.insertPanel.type = button.dataset.insertType;
    if (state.insertPanel.type === "spreadsheet") {
      state.insertPanel.workbook = state.insertPanel.workbook || state.composerWorkbookId || state.workbook?.default_workbook || "";
      state.insertPanel.sheet = state.insertPanel.sheet || workbookSheetsFor(state.insertPanel.workbook)[0]?.name || "";
      state.insertPanel.column = state.insertPanel.column || columnsForSheetInWorkbook(state.insertPanel.workbook, state.insertPanel.sheet)[0] || "";
    }
    setCommandMapFocus(state.insertPanel.targetOrder);
    renderCommandMap();
    return;
  }

  const panel = button.closest(".insert-card-panel");
  if (!panel || !state.insertPanel) {
    return;
  }

  const action = button.dataset.insertAction;
  if (action === "cancel") {
    setCommandMapFocus(Number(panel.dataset.targetOrder));
    state.insertPanel = null;
    renderCommandMap();
    return;
  }

  if (action === "record-key") {
    setCommandMapFocus(Number(panel.dataset.targetOrder));
    beginKeyCapture({ scope: "insert-panel", order: Number(panel.dataset.targetOrder) });
    return;
  }

  if (action === "record-mouse") {
    setCommandMapFocus(Number(panel.dataset.targetOrder));
    beginMouseCapture({ scope: "insert-panel", order: Number(panel.dataset.targetOrder) });
    return;
  }

  if (action === "record-after-action") {
    setCommandMapFocus(Number(panel.dataset.targetOrder));
    beginKeyCapture({ scope: "insert-panel", order: Number(panel.dataset.targetOrder), field: "afterAction" });
    return;
  }

  if (action === "select-image") {
    setCommandMapFocus(Number(panel.dataset.targetOrder));
    openImagePicker({ scope: "insert-panel", order: Number(panel.dataset.targetOrder) });
    return;
  }

  if (action === "analyze-chrome-html") {
    setCommandMapFocus(Number(panel.dataset.targetOrder));
    analyzeChromeHtmlInContainer(panel, "data-insert-field");
    return;
  }

  if (action === "select-chrome-fallback-image") {
    setCommandMapFocus(Number(panel.dataset.targetOrder));
    openImagePicker({ scope: "insert-panel-chrome-fallback", order: Number(panel.dataset.targetOrder) });
    return;
  }

  if (action === "save") {
    const values = insertValuesFromPanel(panel);
    const common = {
      targetOrder: values.targetOrder,
      position: values.position,
      delay: values.delay,
      aoSucesso: values.successAction,
      blocoSucesso: optionalPositiveInt(values.successBlock),
    };
    const isFirstBlock = Number(common.targetOrder) <= 0;

    let promiseFactory;
    if (values.type === "text") {
      promiseFactory = () =>
        isFirstBlock
          ? invoke("add_text_block", {
              text: values.text,
              delay: common.delay,
              sequencia: currentSequenceName(),
              aoSucesso: common.aoSucesso,
              blocoSucesso: common.blocoSucesso,
            })
          : invoke("insert_text_block", {
              targetOrder: common.targetOrder,
              position: common.position,
              text: values.text,
              delay: common.delay,
              aoSucesso: common.aoSucesso,
              blocoSucesso: common.blocoSucesso,
            });
    } else if (values.type === "key") {
      promiseFactory = () =>
        isFirstBlock
          ? invoke("add_key_block", {
              keys: values.keys,
              repeat: values.repeat,
              delay: common.delay,
              sequencia: currentSequenceName(),
              aoSucesso: common.aoSucesso,
              blocoSucesso: common.blocoSucesso,
            })
          : invoke("insert_key_block", {
              targetOrder: common.targetOrder,
              position: common.position,
              keys: values.keys,
              repeat: values.repeat,
              delay: common.delay,
              aoSucesso: common.aoSucesso,
              blocoSucesso: common.blocoSucesso,
            });
    } else if (values.type === "mouse") {
      promiseFactory = () =>
        isFirstBlock
          ? invoke("add_mouse_block", {
              x: values.x,
              y: values.y,
              button: values.button,
              clicks: values.clicks,
              delay: common.delay,
              sequencia: currentSequenceName(),
              aoSucesso: common.aoSucesso,
              blocoSucesso: common.blocoSucesso,
            })
          : invoke("insert_mouse_block", {
              targetOrder: common.targetOrder,
              position: common.position,
              x: values.x,
              y: values.y,
              button: values.button,
              clicks: values.clicks,
              delay: common.delay,
              aoSucesso: common.aoSucesso,
              blocoSucesso: common.blocoSucesso,
            });
    } else if (values.type === "image") {
      if (!values.imagePath.trim()) {
        setMessage("Selecione uma referencia visual antes de inserir esse bloco.", "error");
        return;
      }
      promiseFactory = () =>
        isFirstBlock
          ? invoke("add_image_click_block", {
              imagem: values.imagePath,
              timeout: values.timeout,
              confianca: values.confidence,
              perfilBusca: values.searchProfile,
              clicar: recognitionClicksFromMode(values.recognitionClickMode, 1) > 0,
              clicks: recognitionClicksFromMode(values.recognitionClickMode, 1),
              offsetX: 0,
              offsetY: 0,
              janelaAlvo: values.windowTitle.trim() || null,
              aoNaoEncontrar: values.failureAction,
              blocoNaoEncontrar: optionalPositiveInt(values.failureBlock),
              quantidadeTentativas: values.retryCount,
              intervaloTentativas: values.retryInterval,
              delay: common.delay,
              sequencia: currentSequenceName(),
              aoSucesso: common.aoSucesso,
              blocoSucesso: common.blocoSucesso,
            })
          : invoke("insert_image_click_block", {
              targetOrder: common.targetOrder,
              position: common.position,
              imagem: values.imagePath,
              timeout: values.timeout,
              confianca: values.confidence,
              perfilBusca: values.searchProfile,
              clicar: recognitionClicksFromMode(values.recognitionClickMode, 1) > 0,
              clicks: recognitionClicksFromMode(values.recognitionClickMode, 1),
              offsetX: 0,
              offsetY: 0,
              janelaAlvo: values.windowTitle.trim() || null,
              aoNaoEncontrar: values.failureAction,
              blocoNaoEncontrar: optionalPositiveInt(values.failureBlock),
              quantidadeTentativas: values.retryCount,
              intervaloTentativas: values.retryInterval,
              delay: common.delay,
              aoSucesso: common.aoSucesso,
              blocoSucesso: common.blocoSucesso,
            });
    } else if (values.type === "chrome") {
      if (!values.chromeHtml.trim()) {
        setMessage("Cole o HTML do elemento antes de inserir esse bloco.", "error");
        return;
      }
      promiseFactory = async () => {
        const analysis = values.chromeAnalysis || await invoke("analyze_html_element", { html: values.chromeHtml });
        const details = buildChromeDetailsFromAnalysisAndValues(analysis, values);
        return isFirstBlock
          ? invoke("add_chrome_html_block", {
              nome: details.nome,
              htmlOriginal: details.html_original,
              elemento: details.elemento,
              alvo: details.alvo,
              acao: details.acao,
              timeout: details.timeout,
              fallbackVisual: details.fallback_visual,
              fallbackImagem: details.fallback_imagem || null,
              aoSucesso: details.ao_sucesso,
              blocoSucesso: optionalPositiveInt(details.bloco_sucesso),
              aoFalhar: details.ao_falhar,
              blocoFalha: optionalPositiveInt(details.bloco_falha),
              quantidadeTentativas: details.quantidade_tentativas,
              intervaloTentativas: details.intervalo_tentativas,
              delay: common.delay,
              sequencia: currentSequenceName(),
            })
          : invoke("insert_chrome_html_block", {
              targetOrder: common.targetOrder,
              position: common.position,
              nome: details.nome,
              htmlOriginal: details.html_original,
              elemento: details.elemento,
              alvo: details.alvo,
              acao: details.acao,
              timeout: details.timeout,
              fallbackVisual: details.fallback_visual,
              fallbackImagem: details.fallback_imagem || null,
              aoSucesso: details.ao_sucesso,
              blocoSucesso: optionalPositiveInt(details.bloco_sucesso),
              aoFalhar: details.ao_falhar,
              blocoFalha: optionalPositiveInt(details.bloco_falha),
              quantidadeTentativas: details.quantidade_tentativas,
              intervaloTentativas: details.intervalo_tentativas,
              delay: common.delay,
            });
      };
    } else {
      promiseFactory = () =>
        isFirstBlock
          ? invoke("add_spreadsheet_block", {
              workbook: values.workbook || state.composerWorkbookId || null,
              sheet: values.sheet,
              column: values.column,
              delay: common.delay,
              afterAction: values.afterAction,
              intervalBetween: values.intervalBetween,
              sequencia: currentSequenceName(),
              aoSucesso: common.aoSucesso,
              blocoSucesso: common.blocoSucesso,
            })
          : invoke("insert_spreadsheet_block", {
              targetOrder: common.targetOrder,
              position: common.position,
              workbook: values.workbook || state.composerWorkbookId || null,
              sheet: values.sheet,
              column: values.column,
              delay: common.delay,
              afterAction: values.afterAction,
              intervalBetween: values.intervalBetween,
              aoSucesso: common.aoSucesso,
              blocoSucesso: common.blocoSucesso,
            });
    }

    runMutation("Bloco inserido", async () => {
      const roadmap = await promiseFactory();
      state.insertPanel = null;
      return roadmap;
    }, (roadmap) =>
      resolveNearestCommandMapFocus(
        roadmap,
        isFirstBlock ? roadmap?.events?.[0]?.order ?? null : common.position === "before" ? common.targetOrder : common.targetOrder + 1
      )
    );
  }
});

async function boot() {
  try {
    setBusy("Carregando");
    updateCommandMapSaveUI();
    setWorkspaceTab(state.activeTab);
    try {
      const executionState = await invoke("get_test_execution_state");
      setTestExecutionState(executionState?.running);
    } catch (error) {
      console.warn("Falha ao consultar estado inicial de teste.", error);
      setTestExecutionState(false);
    }

    await safeListen("test-execution-state", (event) => {
      setTestExecutionState(event.payload?.running);
      if (!event.payload?.running && builderStatus.textContent === "Executando teste") {
        builderStatus.textContent = "Pronto";
      }
    });
    await safeListen("test-log", (event) => {
      const message = event.payload?.message;
      if (message) {
        const text = String(message);
        const lowered = text.toLowerCase();
        const kind = lowered.includes("erro")
          || lowered.includes("falha")
          || lowered.includes("nao encontrada")
          || lowered.includes("não encontrada")
          ? "error"
          : lowered.includes("encontrada")
            || lowered.includes("confirmacao visual")
            || lowered.includes("confirmação visual")
            || lowered.includes("clique executado")
            ? "success"
            : "info";
        pushAssistLog(text, kind);
        if (text.toLowerCase().includes("janela alvo capturada:")) {
          state.assist.windowTitle = text.split(":").slice(1).join(":").trim() || text;
          updateAssistProgressUI();
        }
        if (state.assist.mode === "running" && !state.assist.description) {
          state.assist.description = text;
          updateAssistProgressUI();
        }
        setMessage(text, "info");
      }
    });
    await safeListen("test-progress", (event) => {
      const payload = event.payload || {};
      stopAssistPlayback();
      state.assist.mode = "running";
      state.assist.current = Number(payload.current || 0);
      state.assist.total = Number(payload.total || 0);
      state.assist.percent = Number(payload.percent || 0);
      state.assist.description = String(payload.description || "");
      state.assist.company = String(payload.company || "");
      state.assist.currentOrder = extractOrderFromDescription(payload.description) ?? state.assist.currentOrder;
      updateAssistProgressUI();
      pushAssistLog(state.assist.description, "info");
      renderAssistExecutionMap();
    });
    await safeListen("test-finished", (event) => {
      const payload = event.payload || {};
      stopAssistPlayback();
      state.assist.mode = payload.success ? "done" : payload.code === -9 ? "stopped" : "failed";
      state.assist.success = Boolean(payload.success);
      if (payload.success) {
        state.assist.percent = 100;
        state.assist.current = state.assist.total || state.roadmap?.events?.length || 0;
        state.assist.description = state.assist.description || "Execucao finalizada com sucesso.";
        pushAssistLog("Execucao finalizada com sucesso.", "success");
      } else {
        state.assist.description = state.assist.description || `Execucao encerrada com codigo ${payload.code}.`;
        pushAssistLog(state.assist.description, payload.code === -9 ? "info" : "error");
      }
      updateAssistProgressUI();
      renderAssistExecutionMap();
    });
    await refreshAutomationLibrary();
    await refreshOpenWindows();
    await refreshWorkbookMeta();
    await loadWorkbookPreview();
    const roadmap = await invoke("get_roadmap");
    applyRoadmap(roadmap);
    await refreshTestLoopData();
    resetAssistState("idle");
    setBusy("Pronto");
    setMessage("Gerador pronto para uso.", "success");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
}

boot();

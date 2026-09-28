const tauriCore = window.__TAURI__?.core ?? null;
const tauriEvent = window.__TAURI__?.event ?? null;
const tauriWindow = window.__TAURI__?.window ?? null;

const FLOWDETECT_WINDOW_PATTERN = /flowdetect/i;
const INTERNAL_AUTOMATION_NAMES = new Set(["aceito_compartilhamento"]);
const PAGE_DEFINITIONS = Object.freeze([
  { sequence: "principal", label: "Pagina 1", shortLabel: "1", theme: "principal" },
  { sequence: "pagina_2", label: "Pagina 2", shortLabel: "2", theme: "pagina_2" },
  { sequence: "pagina_3", label: "Pagina 3", shortLabel: "3", theme: "pagina_3" },
  { sequence: "pagina_4", label: "Pagina 4", shortLabel: "4", theme: "pagina_4" },
]);

const state = {
  library: [],
  selectedAutomationId: "",
  roadmap: null,
  windows: [],
  selectedTarget: null,
  running: false,
  currentSequence: "principal",
  currentOrder: null,
  detailOpenOrder: null,
  activeView: "realtime",
  imagePreviewCache: {},
  imagePreviewLoading: {},
  safeAreaTimer: null,
  safeAreaBusy: false,
  progress: {
    percent: 0,
    title: "Aguardando execucao",
    description: "O FlowDetect Agent fica pronto para acompanhar os blocos da automacao em tempo real.",
    company: "",
  },
  logs: [],
  librarySignature: "",
  remotePollTimer: null,
  remoteStatusRefreshing: false,
  remoteConnected: false,
  lowPowerMode: true,
  mouseControlEnabled: false,
  lastProgressSignature: "",
  lastAssistMapSignature: "",
  lastObserverSignature: "",
  lastRemoteLibraryCheckAt: 0,
  lastRemoteProgressRenderAt: 0,
};

const elements = {
  agentShell: document.getElementById("agentShell"),
  agentConnectionAddress: document.getElementById("agentConnectionAddress"),
  observerConnectionAddress: document.getElementById("observerConnectionAddress"),
  observerConnectionStatus: document.getElementById("observerConnectionStatus"),
  observerAgentName: document.getElementById("observerAgentName"),
  observerProgressPercent: document.getElementById("observerProgressPercent"),
  observerProgressFill: document.getElementById("observerProgressFill"),
  observerProgressTitle: document.getElementById("observerProgressTitle"),
  observerCurrentBlockText: document.getElementById("observerCurrentBlockText"),
  observerBlockList: document.getElementById("observerBlockList"),
  toggleAgentPanelButton: document.getElementById("toggleAgentPanelButton"),
  toggleMouseControlButton: document.getElementById("toggleMouseControlButton"),
  toggleMouseControlInlineButton: document.getElementById("toggleMouseControlInlineButton"),
  minimizeAgentButton: document.getElementById("minimizeAgentButton"),
  importZipButton: document.getElementById("importZipButton"),
  refreshLibraryButton: document.getElementById("refreshLibraryButton"),
  automationZipInput: document.getElementById("automationZipInput"),
  overviewAutomationCount: document.getElementById("overviewAutomationCount"),
  overviewExecutionStatus: document.getElementById("overviewExecutionStatus"),
  overviewTargetStatus: document.getElementById("overviewTargetStatus"),
  overviewProgressText: document.getElementById("overviewProgressText"),
  libraryMeta: document.getElementById("libraryMeta"),
  libraryEmptyState: document.getElementById("libraryEmptyState"),
  automationList: document.getElementById("automationList"),
  selectedAutomationTitle: document.getElementById("selectedAutomationTitle"),
  selectedAutomationSummary: document.getElementById("selectedAutomationSummary"),
  selectedAutomationBadge: document.getElementById("selectedAutomationBadge"),
  delayInput: document.getElementById("delayInput"),
  loopStartInput: document.getElementById("loopStartInput"),
  runAutomationButton: document.getElementById("runAutomationButton"),
  stopAutomationButton: document.getElementById("stopAutomationButton"),
  progressTitle: document.getElementById("progressTitle"),
  progressPercent: document.getElementById("progressPercent"),
  progressFill: document.getElementById("progressFill"),
  progressDescription: document.getElementById("progressDescription"),
  previewPrevButton: document.getElementById("previewPrevButton"),
  previewNextButton: document.getElementById("previewNextButton"),
  pageChipList: document.getElementById("pageChipList"),
  assistMapList: document.getElementById("assistMapList"),
  currentCompanyText: document.getElementById("currentCompanyText"),
  currentPageText: document.getElementById("currentPageText"),
  currentBlockText: document.getElementById("currentBlockText"),
  targetSummaryText: document.getElementById("targetSummaryText"),
  targetTitleText: document.getElementById("targetTitleText"),
  targetDetailText: document.getElementById("targetDetailText"),
  refreshWindowsButton: document.getElementById("refreshWindowsButton"),
  clearTargetButton: document.getElementById("clearTargetButton"),
  windowList: document.getElementById("windowList"),
  logList: document.getElementById("logList"),
  statusChip: document.getElementById("statusChip"),
  viewButtons: Array.from(document.querySelectorAll("[data-agent-view]")),
  viewPanels: Array.from(document.querySelectorAll("[data-agent-panel]")),
};

let progressRenderTimer = null;
let pendingProgressPayload = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setElementText(element, value) {
  if (element) {
    element.textContent = value;
  }
}

function formatDateTime(value) {
  if (!value) {
    return "Sem data";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function normalizeSequenceName(sequenceName) {
  const normalized = String(sequenceName || "").trim();
  if (!normalized) {
    return "principal";
  }

  const lowered = normalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (["principal", "pagina_1", "pagina 1", "pagina1", "p1"].includes(lowered)) {
    return "principal";
  }
  if (["pagina_2", "pagina 2", "pagina2", "p2"].includes(lowered)) {
    return "pagina_2";
  }
  if (["pagina_3", "pagina 3", "pagina3", "p3"].includes(lowered)) {
    return "pagina_3";
  }
  if (["pagina_4", "pagina 4", "pagina4", "p4"].includes(lowered)) {
    return "pagina_4";
  }

  return normalized;
}

function normalizeSequenceExecutionMode(mode) {
  return String(mode || "").trim().toLowerCase() === "loop_planilha" ? "loop_planilha" : "normal";
}

function getRoadmapSequenceSettings(roadmap = state.roadmap) {
  const settings = roadmap?.sequence_settings;
  return settings && typeof settings === "object" ? settings : {};
}

function getPageDefinitions(roadmap = state.roadmap) {
  const base = PAGE_DEFINITIONS.map((page) => ({ ...page, isExtra: false }));
  const known = new Set(base.map((page) => page.sequence));
  const extra = Array.from(new Set(roadmap?.sequences || []))
    .map((sequence) => normalizeSequenceName(sequence))
    .filter((sequence) => !known.has(sequence))
    .map((sequence, index) => ({
      sequence,
      label: sequence,
      shortLabel: String(base.length + index + 1),
      theme: "principal",
      isExtra: true,
    }));
  return [...base, ...extra];
}

function getBrowsablePages(roadmap = state.roadmap) {
  return getPageDefinitions(roadmap)
    .filter((page) => getSequenceEvents(page.sequence, roadmap).length > 0);
}

function getPageDefinition(sequenceName, roadmap = state.roadmap) {
  const normalized = normalizeSequenceName(sequenceName);
  return (
    getPageDefinitions(roadmap).find((page) => page.sequence === normalized)
    || getPageDefinitions(roadmap)[0]
    || PAGE_DEFINITIONS[0]
  );
}

function resolvePageTheme(sequenceName) {
  const normalized = normalizeSequenceName(sequenceName);
  return PAGE_DEFINITIONS.some((page) => page.sequence === normalized) ? normalized : "principal";
}

function resolveRoadmapInitialSequence(roadmap = state.roadmap) {
  const preferred = normalizeSequenceName(roadmap?.initial_sequence || roadmap?.sequencia_inicial || "principal");
  const pages = getPageDefinitions(roadmap);
  if (pages.some((page) => page.sequence === preferred)) {
    return preferred;
  }
  const firstEventSequence = roadmap?.events?.[0]?.sequence || roadmap?.events?.[0]?.sequencia || "principal";
  return normalizeSequenceName(firstEventSequence);
}

function getSequenceExecutionSettings(sequenceName, roadmap = state.roadmap) {
  const settings = getRoadmapSequenceSettings(roadmap);
  const raw = settings[normalizeSequenceName(sequenceName)] || {};
  return {
    executionMode: normalizeSequenceExecutionMode(raw.execution_mode ?? raw.executionMode ?? raw.modo_execucao),
  };
}

function getSequenceEvents(sequenceName, roadmap = state.roadmap) {
  const normalized = normalizeSequenceName(sequenceName);
  return (roadmap?.events || []).filter((event) => normalizeSequenceName(event.sequence || event.sequencia) === normalized);
}

function getEventByOrder(order, roadmap = state.roadmap) {
  return (roadmap?.events || []).find((event) => Number(event.order) === Number(order)) || null;
}

function selectedAutomation() {
  return visibleLibrary().find((item) => String(item.id) === String(state.selectedAutomationId)) || null;
}

function automationNameKey(item = {}) {
  return String(item.nome || item.name || "").trim().toLowerCase();
}

function isInternalAutomation(item = {}) {
  return INTERNAL_AUTOMATION_NAMES.has(automationNameKey(item));
}

function visibleLibrary() {
  return state.library.filter((item) => !isInternalAutomation(item));
}

function normalizeWindow(item) {
  return {
    hwnd: Number(item?.hwnd || 0),
    title: String(item?.title || "").trim(),
    className: String(item?.class_name || item?.className || "").trim(),
    left: Number(item?.left || 0),
    top: Number(item?.top || 0),
    width: Number(item?.width || 0),
    height: Number(item?.height || 0),
  };
}

function windowKey(item) {
  return `${item.hwnd}::${item.title}::${item.className}`;
}

function isFlowDetectWindow(item) {
  return FLOWDETECT_WINDOW_PATTERN.test(String(item?.title || ""));
}

function blockChipLabel(event = {}) {
  const labels = {
    texto_livre: "TEXTO",
    tecla: "TECLA",
    atalho: "ATALHO",
    clicar_imagem: "RECONHECIMENTO",
    abrir_url: "ABRIR URL",
    abrir_programa: "PROGRAMA",
    verificar_estado_botao: "VERIFICACAO",
    sequencia_planilha: "PLANILHA",
    escrever_planilha: "ESCREVER CELULA",
    inicio_loop: "INICIO LOOP",
    fim_loop: "FIM LOOP",
  };
  return labels[String(event.type || "").trim()] || String(event.type || "BLOCO").replaceAll("_", " ").toUpperCase();
}

function compactText(value, limit = 80) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "-";
  }
  return normalized.length <= limit ? normalized : `${normalized.slice(0, Math.max(0, limit - 3))}...`;
}

function formatDecimal(value, digits = 1) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) {
    return "0";
  }
  return number.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function formatDelayLabel(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) {
    return "Sem atraso";
  }
  return `${formatDecimal(number, 2)}s antes`;
}

function formatRepeatLabel(value) {
  const repeat = Math.max(1, Number(value || 1));
  return repeat === 1 ? "1 vez" : `${repeat} vezes`;
}

function formatFailureAction(details = {}) {
  const action = String(details.ao_nao_encontrar || "").trim() || "parar";
  if (action === "ir_para_bloco" && details.bloco_nao_encontrar) {
    return `Ir para bloco ${details.bloco_nao_encontrar}`;
  }
  if (action === "ir_para_pagina" && details.sequencia_nao_encontrar) {
    return `Ir para ${String(details.sequencia_nao_encontrar).replaceAll("_", " ")}`;
  }
  const labels = {
    continuar: "Continuar",
    parar: "Parar",
    tentar_novamente: "Tentar de novo",
    ir_para_bloco: "Ir para bloco",
    ir_para_pagina: "Ir para pagina",
  };
  return labels[action] || compactText(action, 32);
}

function formatSearchProfile(profile) {
  const normalized = String(profile || "").trim().toLowerCase();
  const labels = {
    fast: "Rapido",
    rapido: "Rapido",
    balanced: "Equilibrado",
    equilibrado: "Equilibrado",
    precise: "Preciso",
    preciso: "Preciso",
  };
  return labels[normalized] || compactText(profile || "Padrao", 20);
}

function formatSearchAreaMode(mode) {
  const normalized = String(mode || "").trim().toLowerCase();
  const labels = {
    target_window: "Janela alvo",
    janela_alvo: "Janela alvo",
    custom_region: "Area definida",
    area_personalizada: "Area definida",
    last_position: "Ultima posicao",
    last_found_region: "Ultima posicao",
    near_last_position: "Ultima posicao",
  };
  return labels[normalized] || "Janela alvo";
}

function buildActionAfterItemLabel(details = {}) {
  const text = String(details.acao_apos_item_texto || "").trim();
  if (text) {
    return compactText(text, 28);
  }

  if (Array.isArray(details.acao_apos_item) && details.acao_apos_item.length) {
    return compactText(details.acao_apos_item.join(" + "), 28);
  }

  return "Nenhuma";
}

function buildDetailRows(event = {}) {
  const details = event.details || {};
  const type = String(event.type || "").trim();
  const rows = [];

  if (type === "texto_livre") {
    rows.push({ label: "Texto", value: compactText(event.text || event.subtitle, 110), emphasis: true });
    rows.push({ label: "Tamanho", value: `${String(event.text || "").length} caracteres` });
  } else if (type === "tecla" || type === "atalho") {
    rows.push({ label: type === "atalho" ? "Atalho" : "Tecla", value: compactText(event.subtitle || (event.keys || []).join(" + "), 60), emphasis: true });
    rows.push({ label: "Repeticao", value: formatRepeatLabel(details.repeticoes || 1) });
  } else if (type === "clicar_imagem") {
    rows.push({ label: "Arquivo", value: compactText(String(details.imagem || event.subtitle || "").split(/[\\/]/).pop(), 36), emphasis: true });
    rows.push({ label: "Precisao", value: `${Math.round(Number(details.confianca || 0.8) * 100)}% | ${formatSearchProfile(details.perfil_busca)} | ${formatSearchAreaMode(details.modo_area_busca || details.area_busca || "target_window")}` });
    rows.push({ label: "Acao", value: `${details.clicar === false ? "Localizar" : `${Math.max(1, Number(details.cliques || 1))} clique(s)`} | ${formatFailureAction(details)}` });
    rows.push({ label: "Tempo", value: `${formatDecimal(details.timeout || 10, 1)}s | ${Math.max(1, Number(details.quantidade_tentativas || 1))} tentativa(s)` });
  } else if (type === "sequencia_planilha") {
    rows.push({ label: "Planilha", value: compactText(String(details.arquivo || "").split(/[\\/]/).pop() || "-", 36), emphasis: true });
    rows.push({ label: "Origem", value: `${compactText(details.aba || "Sheet1", 18)} -> ${compactText(details.coluna || "-", 18)}` });
    rows.push({ label: "Loop", value: `${Array.isArray(details.valores) ? details.valores.length : 0} item(ns) | apos: ${buildActionAfterItemLabel(details)}` });
    rows.push({ label: "Intervalo item", value: `${formatDecimal(details.intervalo_entre_itens || 0, 2)}s` });
  } else if (type === "escrever_planilha") {
    rows.push({ label: "Planilha", value: compactText(String(details.arquivo || "").split(/[\\/]/).pop() || "-", 36), emphasis: true });
    rows.push({ label: "Destino", value: `${compactText(details.aba || "Sheet1", 18)} -> ${compactText(details.coluna || "-", 18)}` });
    rows.push({ label: "Valor", value: compactText(details.valor || "-", 42) });
    rows.push({ label: "Linha", value: "Linha atual do loop" });
  } else if (type === "abrir_url") {
    rows.push({ label: "URL", value: compactText(details.url || event.subtitle || "-", 92), emphasis: true });
    rows.push({ label: "Navegador", value: compactText(details.navegador || "padrao", 24) });
    rows.push({ label: "Modo", value: details.modo_abertura === "nova_aba" ? "Nova aba" : "Nova janela" });
    rows.push({ label: "Aguardar", value: `${formatDecimal(details.aguardar_segundos || 0, 1)}s` });
  } else if (type === "abrir_programa") {
    rows.push({ label: "Programa", value: compactText(String(details.caminho || event.subtitle || "-").split(/[\\/]/).pop(), 46), emphasis: true });
    rows.push({ label: "Caminho", value: compactText(details.caminho || "-", 92) });
    rows.push({ label: "Parametros", value: compactText(details.parametros || "-", 70) });
    rows.push({ label: "Aguardar", value: `${formatDecimal(details.aguardar_segundos || 0, 1)}s` });
  } else if (type === "verificar_estado_botao") {
    rows.push({ label: "Ativo", value: compactText((details.se_ativo || {}).acao || "continuar", 26) });
    rows.push({ label: "Desativado", value: compactText((details.se_desativado || {}).acao || "continuar", 26) });
    rows.push({ label: "Falha", value: compactText((details.se_nao_encontrar || {}).acao || "parar", 26) });
  } else if (type === "inicio_loop" || type === "fim_loop") {
    rows.push({ label: "Funcao", value: compactText(event.description || event.subtitle || "Marca o trecho de repeticao.", 98), emphasis: true });
  } else {
    rows.push({ label: "Detalhe", value: compactText(event.description || event.command || event.subtitle || "-", 100), emphasis: true });
  }

  rows.push({ label: "Intervalo", value: formatDelayLabel(event.delay || 0) });
  return rows.slice(0, 6);
}

function renderDetailRows(event = {}) {
  return buildDetailRows(event)
    .map((row) => `
      <div class="agent-assist-detail-row ${row.emphasis ? "is-emphasis" : ""}">
        <span>${escapeHtml(row.label)}</span>
        <strong>${escapeHtml(row.value)}</strong>
      </div>
    `)
    .join("");
}

function detailFooterText(event = {}) {
  const type = String(event.type || "").trim();
  if (type === "clicar_imagem") {
    return "Preview real da referencia";
  }
  if (type === "sequencia_planilha") {
    return "Resumo do loop da planilha";
  }
  if (type === "escrever_planilha") {
    return "Escrita na linha atual";
  }
  return "Resumo rapido do bloco";
}

async function ensureRecognitionPreview(event = {}) {
  const imageId = String(event?.details?.imagem || "").trim().replaceAll("\\", "/");
  if (!imageId || state.imagePreviewCache[imageId] || state.imagePreviewLoading[imageId]) {
    return;
  }

  state.imagePreviewLoading[imageId] = true;
  try {
    const preview = await invoke("get_recognition_image_preview", { imageId });
    if (preview?.src) {
      state.imagePreviewCache[imageId] = preview;
    }
  } catch (_error) {
    state.imagePreviewCache[imageId] = { failed: true };
  } finally {
    delete state.imagePreviewLoading[imageId];
    if (state.detailOpenOrder === Number(event.order || 0)) {
      updateRecognitionPreviewInDom(event.order);
    }
  }
}

function renderRecognitionPreview(event = {}) {
  const imageId = String(event?.details?.imagem || "").trim().replaceAll("\\", "/");
  if (!imageId) {
    return "";
  }

  const cached = state.imagePreviewCache[imageId];
  const isLoading = Boolean(state.imagePreviewLoading[imageId]);

  if (cached?.src) {
    return `
      <div class="agent-assist-preview" data-recognition-preview-order="${Number(event.order || 0)}">
        <img src="${escapeHtml(cached.src)}" alt="${escapeHtml(cached.file_name || "Preview do reconhecimento")}" />
      </div>
    `;
  }

  return `
    <div class="agent-assist-preview" data-recognition-preview-order="${Number(event.order || 0)}">
      <div class="agent-assist-preview-empty">
        ${isLoading ? "Carregando preview..." : escapeHtml(compactText(imageId.split("/").pop(), 34))}
      </div>
    </div>
  `;
}

function updateRecognitionPreviewInDom(order) {
  const slot = elements.assistMapList?.querySelector(`[data-recognition-preview-order="${Number(order)}"]`);
  const assistEvent = getEventByOrder(order);
  if (slot && assistEvent) {
    slot.outerHTML = renderRecognitionPreview(assistEvent);
  }
}

function syncAssistDetailContainer() {
  const hasDetailOpen = Boolean(state.detailOpenOrder);
  elements.assistMapList?.classList.toggle("has-detail-open", hasDetailOpen);
  elements.assistMapList?.querySelector(".agent-assist-flow-row")?.classList.toggle("has-detail-open", hasDetailOpen);
}

function closeAssistDetailDom(order = null) {
  const selector = order == null
    ? ".agent-assist-card.is-flipped"
    : `.agent-assist-card[data-assist-order="${Number(order)}"]`;
  elements.assistMapList?.querySelector(selector)?.classList.remove("is-flipped");
}

function openAssistDetailDom(order) {
  elements.assistMapList?.querySelector(`.agent-assist-card[data-assist-order="${Number(order)}"]`)?.classList.add("is-flipped");
}

function renderAssistCardFace(event = {}, order, isBack = false) {
  const detailsButton = `
    <button
      type="button"
      class="agent-ghost-button agent-assist-detail-toggle"
      data-detail-action="${isBack ? "close" : "open"}"
      data-assist-order="${Number(order)}"
      ${state.running ? "disabled" : ""}
    >
      ${isBack ? "Voltar" : "Ver detalhes"}
    </button>
  `;

  if (!isBack) {
    return `
      <div class="agent-assist-card-face agent-assist-card-front">
        <div class="agent-assist-card-top">
          <span class="agent-assist-card-index">${String(event.order).padStart(2, "0")}</span>
          <span class="agent-assist-card-chip">${escapeHtml(blockChipLabel(event))}</span>
        </div>
        <h3>${escapeHtml(event.title || "Bloco")}</h3>
        <p>${escapeHtml(event.subtitle || event.description || "Sem detalhes")}</p>
        <div class="agent-assist-card-actions">
          <span class="agent-assist-card-meta">${escapeHtml(formatDelayLabel(event.delay || 0))}</span>
          ${detailsButton}
        </div>
      </div>
    `;
  }

  return `
    <div class="agent-assist-card-face agent-assist-card-back ${event.type === "clicar_imagem" ? "has-visual-preview" : ""}">
      <div class="agent-assist-card-top">
        <span class="agent-assist-card-index">${String(event.order).padStart(2, "0")}</span>
        <span class="agent-assist-card-chip">DETALHES</span>
      </div>
      <h3>${escapeHtml(event.title || "Bloco")}</h3>
      <div class="agent-assist-detail-list">
        ${renderDetailRows(event)}
      </div>
      ${event.type === "clicar_imagem" ? renderRecognitionPreview(event) : ""}
      <div class="agent-assist-card-actions">
        <span class="agent-assist-card-meta">${escapeHtml(detailFooterText(event))}</span>
        ${detailsButton}
      </div>
    </div>
  `;
}

function currentVisibleEvents() {
  const events = getSequenceEvents(state.currentSequence);
  return events.length ? events : (state.roadmap?.events || []);
}

function currentBlockEvent() {
  return getEventByOrder(state.currentOrder) || currentVisibleEvents()[0] || null;
}

function firstOrderForSequence(sequenceName) {
  return getSequenceEvents(sequenceName)[0]?.order ?? null;
}

function syncTheme() {
  elements.agentShell.dataset.pageTheme = resolvePageTheme(state.currentSequence);
}

async function invoke(command, payload) {
  if (typeof tauriCore?.invoke !== "function") {
    throw new Error("API do Tauri indisponivel no FlowDetect Agent.");
  }
  return tauriCore.invoke(command, payload);
}

async function syncAgentCompactWindow(reason = "sync") {
  if (!document.body.classList.contains("agent-compact-mode")) {
    return null;
  }
  try {
    return await invoke("set_agent_compact_mode", { compact: true });
  } catch (error) {
    console.warn(`Nao foi possivel alinhar a janela do Agent (${reason}).`, error);
    return null;
  }
}

function scheduleAgentCompactWindowSync(reason = "sync") {
  // O Agent agora roda como servico visualmente discreto; nao force resize/overlay.
  void reason;
}

async function loadAgentConnectionInfo() {
  if (!elements.agentConnectionAddress) {
    return;
  }
  try {
    const info = await invoke("get_agent_connection_info");
    const address = String(info?.address || info?.local || "127.0.0.1:18452").trim();
    elements.agentConnectionAddress.textContent = `Aguardando Studio: ${address}`;
    setElementText(elements.observerConnectionAddress, address);
    setElementText(elements.observerAgentName, info?.agent_name || info?.agentName || "AGENTE PRINCIPAL");
    elements.agentConnectionAddress.title = `Use este endereco no FlowDetect Control: ${address}`;
    elements.agentConnectionAddress.classList.remove("is-online");
  } catch (error) {
    elements.agentConnectionAddress.textContent = "Aguardando conexao: 127.0.0.1:18452";
    setElementText(elements.observerConnectionAddress, "127.0.0.1:18452");
    elements.agentConnectionAddress.title = "Use este endereco se o Control estiver no mesmo computador.";
    elements.agentConnectionAddress.classList.remove("is-online");
  }
}

function renderMouseControlState() {
  const enabled = Boolean(state.mouseControlEnabled);
  document.body.classList.toggle("agent-mouse-control-enabled", enabled);
  document.body.classList.toggle("agent-mouse-control-disabled", !enabled);
  [
    elements.toggleMouseControlButton,
    elements.toggleMouseControlInlineButton,
  ].forEach((button) => {
    if (!button) {
      return;
    }
    button.classList.toggle("is-enabled", enabled);
    button.classList.toggle("is-disabled", !enabled);
    button.setAttribute("aria-pressed", enabled ? "true" : "false");
    button.textContent = enabled ? "Mouse ligado" : "Mouse desligado";
    button.title = enabled
      ? "Mouse remoto liberado. Clique para bloquear movimentos e cliques enviados pelo Studio."
      : "Mouse remoto bloqueado. Clique para permitir movimentos e cliques enviados pelo Studio.";
  });
}

async function loadMouseControlState() {
  try {
    const payload = await invoke("get_agent_mouse_control_state");
    state.mouseControlEnabled = Boolean(payload?.mouse_enabled);
  } catch (error) {
    state.mouseControlEnabled = false;
    pushLog(`Mouse remoto bloqueado por seguranca: ${String(error)}`, "warn", "Mouse");
  }
  renderMouseControlState();
}

async function toggleMouseControl() {
  const nextEnabled = !Boolean(state.mouseControlEnabled);
  try {
    const payload = await invoke("set_agent_mouse_control_enabled", { enabled: nextEnabled });
    state.mouseControlEnabled = Boolean(payload?.mouse_enabled);
    renderMouseControlState();
    pushLog(
      state.mouseControlEnabled
        ? "Mouse remoto liberado pelo Agent."
        : "Mouse remoto bloqueado pelo Agent.",
      state.mouseControlEnabled ? "success" : "info",
      "Mouse"
    );
  } catch (error) {
    pushLog(String(error), "error", "Mouse");
    renderMouseControlState();
  }
}

function renderAgentConnectionState(snapshot = {}) {
  if (!elements.agentConnectionAddress) {
    return;
  }
  const connection = snapshot.remote_connection || snapshot.remoteConnection || {};
  const connected = Boolean(connection.connected);
  const currentText = elements.agentConnectionAddress.textContent || "";
  const address = currentText.includes(": ")
    ? currentText.split(": ").slice(1).join(": ").trim()
    : currentText.replace(/^Conectado:\s*/i, "").replace(/^Aguardando Studio:\s*/i, "").trim();
  const safeAddress = address || "127.0.0.1:18452";
  state.remoteConnected = connected;
  elements.agentConnectionAddress.classList.toggle("is-online", connected);
  elements.agentConnectionAddress.textContent = connected
    ? `Conectado ao Studio: ${safeAddress}`
    : `Aguardando Studio: ${safeAddress}`;
  setElementText(elements.observerConnectionAddress, safeAddress);
  setElementText(elements.observerConnectionStatus, connected ? "CONECTADO" : "ONLINE");
}

async function safeListen(eventName, handler) {
  if (typeof tauriEvent?.listen !== "function") {
    return null;
  }
  try {
    return await tauriEvent.listen(eventName, handler);
  } catch (error) {
    console.warn(`Falha ao registrar o evento ${eventName}.`, error);
    return null;
  }
}

function setStatusChip(label, tone = "idle") {
  elements.statusChip.textContent = label;
  elements.statusChip.className = `agent-status-chip is-${tone}`;
}

function renderAgentViews() {
  elements.viewButtons.forEach((button) => {
    const active = button.dataset.agentView === state.activeView;
    button.classList.toggle("is-active", active);
  });
  elements.viewPanels.forEach((panel) => {
    const active = panel.dataset.agentPanel === state.activeView;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  });
}

function pushLog(message, tone = "info", title = "") {
  const text = String(message || "").trim();
  if (!text) {
    return;
  }
  state.logs.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: title || (tone === "error" ? "Falha" : tone === "success" ? "Sucesso" : "Info"),
    message: text,
    tone,
  });
  state.logs = state.logs.slice(0, 120);
  renderLogs();
}

function librarySignature(items = state.library) {
  return (Array.isArray(items) ? items : [])
    .map((item) => `${item.id || ""}:${item.updated_at || item.atualizado_em || item.nome || ""}`)
    .join("|");
}

function replaceRemoteLogs(lines = []) {
  const normalized = (Array.isArray(lines) ? lines : [])
    .map((line) => String(line || "").trim())
    .filter(Boolean)
    .slice(-40);
  if (!normalized.length) {
    return;
  }
  state.logs = normalized.reverse().map((message, index) => ({
    id: `remote-${Date.now()}-${index}`,
    title: message.toLowerCase().includes("erro") || message.toLowerCase().includes("falha") ? "Execucao" : "Agent remoto",
    message,
    tone: message.toLowerCase().includes("erro") || message.toLowerCase().includes("falha") ? "error" : "info",
  }));
  renderLogs();
}

function renderLogs() {
  if (!state.logs.length) {
    elements.logList.innerHTML = `
      <article class="agent-log-entry is-info">
        <strong>Pronto</strong>
        <p>Os logs da automacao vao aparecer aqui em tempo real.</p>
      </article>
    `;
    return;
  }

  elements.logList.innerHTML = state.logs
    .map((entry) => `
      <article class="agent-log-entry is-${escapeHtml(entry.tone)}">
        <strong>${escapeHtml(entry.title)}</strong>
        <p>${escapeHtml(entry.message)}</p>
      </article>
    `)
    .join("");
}

function renderOverview() {
  elements.overviewAutomationCount.textContent = String(visibleLibrary().length);
  elements.overviewExecutionStatus.textContent = state.running ? "Executando" : "Pronta";
  elements.overviewTargetStatus.textContent = state.selectedTarget?.title ? "Janela fixa" : "Tela inteira";
  elements.overviewProgressText.textContent = `${Math.round(Math.max(0, Math.min(100, Number(state.progress.percent || 0))))}%`;
}

async function fitSelectedTargetToSafeArea({ log = false } = {}) {
  if (!state.selectedTarget?.hwnd) {
    return null;
  }
  if (log) {
    pushLog(`Janela alvo fixada sem redimensionar: ${state.selectedTarget.title} / hwnd ${state.selectedTarget.hwnd}`, "success", "Janela alvo");
  }
  return { ok: true, adjusted: false, hwnd: Number(state.selectedTarget.hwnd), mode: "preserve_window" };
}

async function fitActiveWindowToSafeArea() {
  return { ok: true, adjusted: false, mode: "preserve_window" };
}

async function protectAgentSafeArea() {
  return null;
}

function syncSafeAreaGuard() {
  if (state.safeAreaTimer) {
    window.clearInterval(state.safeAreaTimer);
    state.safeAreaTimer = null;
  }
}

function observerBlockMarkup(event = {}, stateClass = "is-upcoming") {
  return `
    <article class="agent-observer-block ${stateClass}">
      <span>${String(event.order || 0).padStart(2, "0")}</span>
      <strong>${escapeHtml(compactText(event.title || blockChipLabel(event), 38))}</strong>
      <small>${escapeHtml(blockChipLabel(event))}</small>
    </article>
  `;
}

function renderObserverBlocks() {
  if (!elements.observerBlockList) {
    return;
  }

  const visibleEvents = currentVisibleEvents();
  const activeOrder = Number(state.currentOrder || 0);
  const activeIndex = visibleEvents.findIndex((event) => Number(event.order) === activeOrder);
  const currentEvent = activeIndex >= 0 ? visibleEvents[activeIndex] : currentBlockEvent();
  setElementText(elements.observerCurrentBlockText, currentEvent?.title || "Aguardando execucao");
  const observerSignature = [
    visibleEvents.length,
    activeOrder,
    activeIndex,
    state.running ? 1 : 0,
  ].join("|");
  if (state.lastObserverSignature === observerSignature) {
    return;
  }
  state.lastObserverSignature = observerSignature;

  if (!visibleEvents.length) {
    elements.observerBlockList.innerHTML = `
      <article class="agent-observer-block is-empty">
        <span>--</span>
        <strong>Nenhuma automacao carregada</strong>
        <small>AGUARDANDO</small>
      </article>
    `;
    return;
  }

  const safeActiveIndex = activeIndex >= 0 ? activeIndex : 0;
  const start = Math.max(0, safeActiveIndex - 2);
  const end = Math.min(visibleEvents.length, start + 6);
  elements.observerBlockList.innerHTML = visibleEvents.slice(start, end).map((event, offset) => {
    const index = start + offset;
    const stateClass = index === safeActiveIndex
      ? "is-current"
      : index < safeActiveIndex
        ? "is-done"
        : "is-upcoming";
    return observerBlockMarkup(event, stateClass);
  }).join("");
}

function renderProgress() {
  const percent = Math.max(0, Math.min(100, Number(state.progress.percent || 0)));
  const roundedPercent = Math.round(percent);
  const progressSignature = [
    roundedPercent,
    state.progress.title || "",
    state.progress.description || "",
    state.progress.company || "",
    state.currentSequence || "",
    state.currentOrder || "",
    state.running ? 1 : 0,
  ].join("|");
  if (state.lastProgressSignature === progressSignature) {
    return;
  }
  state.lastProgressSignature = progressSignature;

  if (elements.progressTitle) elements.progressTitle.textContent = state.progress.title;
  if (elements.progressPercent) elements.progressPercent.textContent = `${roundedPercent}%`;
  if (elements.progressFill) elements.progressFill.style.width = `${percent}%`;
  if (elements.progressDescription) elements.progressDescription.textContent = state.progress.description;

  const currentPage = getPageDefinition(state.currentSequence);
  if (elements.currentCompanyText) elements.currentCompanyText.textContent = state.progress.company || "-";
  if (elements.currentPageText) elements.currentPageText.textContent = currentPage?.label || "Pagina 1";
  if (elements.currentBlockText) elements.currentBlockText.textContent = currentBlockEvent()?.title || "Aguardando execucao";

  setElementText(elements.observerProgressPercent, `${roundedPercent}%`);
  setElementText(elements.observerProgressTitle, state.progress.title || "Aguardando execucao");
  if (elements.observerProgressFill) {
    elements.observerProgressFill.style.width = `${percent}%`;
  }
  document.body.classList.toggle("agent-is-running", Boolean(state.running));
  syncSafeAreaGuard();
  renderObserverBlocks();
  renderOverview();
}

function renderTarget() {
  const target = state.selectedTarget;
  const hasTarget = Boolean(target?.title);
  elements.targetSummaryText.textContent = hasTarget ? target.title : "Tela inteira";
  elements.targetTitleText.textContent = hasTarget ? target.title : "Tela inteira";
  elements.targetDetailText.textContent = hasTarget
    ? `${target.className || "Janela sem classe"} | hwnd ${target.hwnd} | ${target.width}x${target.height}`
    : "Sem janela fixa. O reconhecimento vai usar a tela inteira quando a automacao precisar.";

  elements.windowList.innerHTML = state.windows.length
    ? state.windows.map((item) => {
      const selected = target && windowKey(target) === windowKey(item);
      return `
        <article class="agent-window-card ${selected ? "is-selected" : ""}">
          <button type="button" data-window-key="${escapeHtml(windowKey(item))}">
            <div class="agent-window-top">
              <div>
                <div class="agent-window-title">${escapeHtml(item.title || "Janela sem titulo")}</div>
                <div class="agent-window-meta">${escapeHtml(item.className || "Classe nao informada")} | hwnd ${escapeHtml(item.hwnd)}</div>
              </div>
              <span class="agent-window-pill">${selected ? "Em uso" : "Selecionar"}</span>
            </div>
          </button>
        </article>
      `;
    }).join("")
    : `
      <article class="agent-window-card">
        <div class="agent-window-title">Nenhuma janela visivel encontrada</div>
        <div class="agent-window-meta">Abra o sistema alvo e clique em Atualizar janelas.</div>
      </article>
    `;

  renderOverview();
}

function renderSelection() {
  const automation = selectedAutomation();
  if (!automation) {
    setElementText(elements.selectedAutomationTitle, "Selecione uma automacao");
    setElementText(elements.selectedAutomationBadge, "Sem selecao");
    setElementText(elements.selectedAutomationSummary, "Escolha uma automacao na biblioteca para carregar a visualizacao do fluxo.");
    return;
  }

  setElementText(elements.selectedAutomationTitle, automation.nome || "Automacao");
  setElementText(elements.selectedAutomationBadge, automation.categoria || "Sem categoria");
  setElementText(elements.selectedAutomationSummary, [
    automation.descricao || "Sem descricao informada.",
    `${automation.command_count || 0} blocos`,
    `${automation.sequence_count || 0} pagina(s)`,
    `Atualizada em ${formatDateTime(automation.atualizado_em)}`,
  ].join(" | "));
}

function renderLibrary() {
  const items = visibleLibrary().sort((left, right) => {
    const leftTime = new Date(left.atualizado_em || 0).getTime();
    const rightTime = new Date(right.atualizado_em || 0).getTime();
    return rightTime - leftTime;
  });
  const hasItems = items.length > 0;

  elements.libraryMeta.textContent = hasItems
    ? `${items.length} automacao${items.length === 1 ? "" : "oes"}`
    : "Vazia";
  elements.libraryEmptyState.hidden = hasItems;

  if (!hasItems) {
    elements.automationList.innerHTML = "";
    return;
  }

  elements.automationList.innerHTML = items.map((item) => {
    const selected = String(item.id) === String(state.selectedAutomationId);
    return `
      <article class="agent-automation-card ${selected ? "is-selected" : ""}">
        <div class="agent-automation-top">
          <div>
            <h3 class="agent-automation-title">${escapeHtml(item.nome || "Automacao sem nome")}</h3>
            <p class="agent-automation-description">${escapeHtml(item.descricao || "Automacao pronta para este Agent.")}</p>
          </div>
          <span class="agent-meta-chip">${escapeHtml(item.categoria || "Sem categoria")}</span>
        </div>

        <div class="agent-automation-meta">
          <span class="agent-automation-pill">${escapeHtml(item.command_count || 0)} blocos</span>
          <span class="agent-automation-pill">${escapeHtml(item.sequence_count || 0)} pagina(s)</span>
        </div>

        <div class="agent-automation-footer">
          <span class="agent-automation-updated">${escapeHtml(formatDateTime(item.atualizado_em))}</span>
          <div class="agent-hero-actions">
            <button class="agent-secondary-button agent-card-run-button" type="button" data-action="select" data-id="${escapeHtml(item.id)}">Abrir</button>
            <button class="agent-primary-button agent-card-run-button" type="button" data-action="run" data-id="${escapeHtml(item.id)}">Executar</button>
            <button class="agent-ghost-button agent-card-run-button" type="button" data-action="delete" data-id="${escapeHtml(item.id)}">Excluir</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function renderPageChips() {
  if (!state.roadmap?.events?.length) {
    elements.pageChipList.innerHTML = "";
    return;
  }

  elements.pageChipList.innerHTML = getBrowsablePages(state.roadmap)
    .map((page) => {
      const isActive = normalizeSequenceName(page.sequence) === normalizeSequenceName(state.currentSequence);
      const mode = getSequenceExecutionSettings(page.sequence, state.roadmap).executionMode;
      return `
        <button type="button" class="agent-page-chip ${isActive ? "is-active" : ""}" data-sequence="${escapeHtml(page.sequence)}">
          <span class="agent-page-chip-copy">
            <span class="agent-page-chip-title">${escapeHtml(page.label)}</span>
            <span class="agent-page-chip-mode">${mode === "loop_planilha" ? "Loop" : "Executar uma vez"}</span>
          </span>
          <span class="agent-page-chip-badge ${mode === "loop_planilha" ? "is-loop" : ""}">
            ${mode === "loop_planilha" ? "Loop" : "Fluxo"}
          </span>
        </button>
      `;
    })
    .join("");
}

function resolvePreviewTargets() {
  const pages = getBrowsablePages(state.roadmap);
  if (!pages.length) {
    return { previous: null, next: null };
  }

  let pageIndex = pages.findIndex((page) => normalizeSequenceName(page.sequence) === normalizeSequenceName(state.currentSequence));
  if (pageIndex < 0) {
    pageIndex = 0;
  }

  const currentPage = pages[pageIndex];
  const currentEvents = getSequenceEvents(currentPage.sequence);
  if (!currentEvents.length) {
    return { previous: null, next: null };
  }

  let eventIndex = currentEvents.findIndex((event) => Number(event.order) === Number(state.currentOrder));
  if (eventIndex < 0) {
    eventIndex = 0;
  }

  let previous = null;
  let next = null;

  if (eventIndex > 0) {
    previous = {
      sequence: currentPage.sequence,
      order: currentEvents[eventIndex - 1].order,
    };
  } else if (pageIndex > 0) {
    const previousPage = pages[pageIndex - 1];
    const previousEvents = getSequenceEvents(previousPage.sequence);
    const previousEvent = previousEvents[previousEvents.length - 1];
    if (previousEvent) {
      previous = {
        sequence: previousPage.sequence,
        order: previousEvent.order,
      };
    }
  }

  if (eventIndex < currentEvents.length - 1) {
    next = {
      sequence: currentPage.sequence,
      order: currentEvents[eventIndex + 1].order,
    };
  } else if (pageIndex < pages.length - 1) {
    const nextPage = pages[pageIndex + 1];
    const nextEvent = getSequenceEvents(nextPage.sequence)[0];
    if (nextEvent) {
      next = {
        sequence: nextPage.sequence,
        order: nextEvent.order,
      };
    }
  }

  return { previous, next };
}

function applyPreviewTarget(target) {
  if (!target) {
    return;
  }

  state.currentSequence = normalizeSequenceName(target.sequence || state.currentSequence);
  state.currentOrder = Number(target.order || state.currentOrder || 0) || state.currentOrder;
  state.detailOpenOrder = null;
  renderPageChips();
  renderAssistMap();
  renderProgress();
}

function renderPreviewToolbar() {
  if (!elements.previewPrevButton || !elements.previewNextButton) {
    return;
  }

  const { previous, next } = resolvePreviewTargets();
  elements.previewPrevButton.disabled = state.running || !previous;
  elements.previewNextButton.disabled = state.running || !next;
}

function centerCurrentCard(order, behavior = "smooth") {
  if (!elements.assistMapList || order == null) {
    return;
  }
  const target = elements.assistMapList.querySelector(`[data-assist-order="${Number(order)}"]`);
  if (!target) {
    return;
  }
  const containerRect = elements.assistMapList.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const currentScrollLeft = elements.assistMapList.scrollLeft;
  const delta = (targetRect.left + targetRect.width / 2) - (containerRect.left + containerRect.width / 2);
  const left = Math.max(0, currentScrollLeft + delta);
  elements.assistMapList.scrollTo({ left, behavior });
}

function renderAssistMap() {
  syncTheme();
  const visibleEvents = currentVisibleEvents();
  const assistSignature = [
    visibleEvents.map((event) => `${event.order}:${event.type}:${event.title}`).join(","),
    state.currentSequence || "",
    state.currentOrder || "",
    state.detailOpenOrder || "",
    state.running ? 1 : 0,
    Math.round(Number(state.progress.percent || 0)),
  ].join("|");
  if (state.lastAssistMapSignature === assistSignature) {
    renderPreviewToolbar();
    return;
  }
  state.lastAssistMapSignature = assistSignature;
  if (!visibleEvents.length) {
    state.detailOpenOrder = null;
    elements.assistMapList.classList.remove("has-detail-open");
    renderPreviewToolbar();
    elements.assistMapList.innerHTML = `<div class="agent-empty-map">Selecione uma automacao para acompanhar os blocos aqui no centro.</div>`;
    return;
  }

  const hasKnownCurrentOrder = visibleEvents.some((event) => Number(event.order) === Number(state.currentOrder));
  if (!hasKnownCurrentOrder) {
    state.currentOrder = visibleEvents[0]?.order ?? null;
  }
  if (!visibleEvents.some((event) => Number(event.order) === Number(state.detailOpenOrder))) {
    state.detailOpenOrder = null;
  }

  const activeIndex = visibleEvents.findIndex((event) => Number(event.order) === Number(state.currentOrder));
  const hasProgress = activeIndex >= 0 && (state.running || Number(state.progress.percent || 0) > 0);
  const leadingSpacer = `<div class="agent-assist-edge-spacer is-start" aria-hidden="true"></div>`;
  const trailingSpacer = `<div class="agent-assist-edge-spacer is-end" aria-hidden="true"></div>`;

  const markup = visibleEvents
    .map((event, index) => {
      const isDone = hasProgress && index < activeIndex;
      const isCurrent = activeIndex >= 0 ? index === activeIndex : index === 0;
      const stateClass = isCurrent ? "is-current" : isDone ? "is-done" : "is-upcoming";
      const flipClass = Number(state.detailOpenOrder) === Number(event.order) ? "is-flipped" : "";
      const connectorClass =
        hasProgress && index < activeIndex
          ? "is-done"
          : hasProgress && index === activeIndex - 1
            ? "is-current"
            : "is-upcoming";

      const card = `
        <article class="agent-assist-card ${stateClass} ${flipClass}" data-assist-order="${Number(event.order)}">
          <div class="agent-assist-card-flip">
            ${renderAssistCardFace(event, event.order, false)}
            ${renderAssistCardFace(event, event.order, true)}
          </div>
        </article>
      `;

      if (index === visibleEvents.length - 1) {
        return `${card}<div class="agent-assist-end ${!state.running && Number(state.progress.percent || 0) >= 100 ? "is-done" : ""}">Fim</div>`;
      }

      return `
        ${card}
        <div class="agent-assist-connector ${connectorClass}">
          <span></span>
        </div>
      `;
    })
    .join("");

  elements.assistMapList.classList.toggle("has-detail-open", Boolean(state.detailOpenOrder));
  elements.assistMapList.innerHTML = `<div class="agent-assist-flow-row ${state.detailOpenOrder ? "has-detail-open" : ""}">${leadingSpacer}${markup}${trailingSpacer}</div>`;
  renderPreviewToolbar();
  requestAnimationFrame(() => centerCurrentCard(state.currentOrder, state.running || state.detailOpenOrder ? "smooth" : "auto"));
}

function updateButtons() {
  const hasAutomation = Boolean(selectedAutomation());
  if (elements.runAutomationButton) {
    elements.runAutomationButton.disabled = !hasAutomation || state.running;
  }
  if (elements.stopAutomationButton) {
    elements.stopAutomationButton.disabled = !state.running;
  }
}

async function loadAutomationRoadmap(id, options = {}) {
  const normalizedId = String(id || "").trim();
  if (!normalizedId) {
    state.roadmap = null;
    state.selectedAutomationId = "";
    state.currentSequence = "principal";
    state.currentOrder = null;
    state.detailOpenOrder = null;
    state.imagePreviewCache = {};
    state.imagePreviewLoading = {};
    renderSelection();
    renderPageChips();
    renderAssistMap();
    renderProgress();
    updateButtons();
    return null;
  }

  const roadmap = await invoke("open_saved_automation", { id: normalizedId });
  state.selectedAutomationId = normalizedId;
  state.roadmap = roadmap;
  state.currentSequence = resolveRoadmapInitialSequence(roadmap);
  state.currentOrder = firstOrderForSequence(state.currentSequence) ?? roadmap?.events?.[0]?.order ?? null;
  state.detailOpenOrder = null;
  state.imagePreviewCache = {};
  state.imagePreviewLoading = {};

  renderLibrary();
  renderSelection();
  renderPageChips();
  renderAssistMap();
  renderProgress();
  updateButtons();

  if (!options.silent) {
    pushLog(`Automacao carregada no Agent: ${selectedAutomation()?.nome || normalizedId}`, "info", "Biblioteca");
  }

  return roadmap;
}

async function refreshLibrary(options = {}) {
  const result = await invoke("list_saved_automations");
  const nextLibrary = Array.isArray(result?.items) ? result.items : [];
  const nextSignature = librarySignature(nextLibrary);
  const changed = nextSignature !== state.librarySignature;
  state.library = nextLibrary;
  state.librarySignature = nextSignature;
  renderLibrary();
  renderOverview();

  const visibleItems = visibleLibrary();
  if (!visibleItems.length) {
    await loadAutomationRoadmap("", { silent: true });
    return;
  }

  const requestedId = String(options.preferredId || state.selectedAutomationId || "").trim();
  const preferredId = visibleItems.some((item) => String(item.id) === requestedId)
    ? requestedId
    : String(visibleItems[0]?.id || "");
  if (preferredId && (changed || options.forceRoadmap || !state.roadmap || String(state.selectedAutomationId) !== preferredId)) {
    await loadAutomationRoadmap(preferredId, { silent: options.silent !== false });
  }
}

async function deleteAutomationFromAgent(id) {
  const normalizedId = String(id || "").trim();
  if (!normalizedId) {
    return;
  }
  const automation = state.library.find((item) => String(item.id) === normalizedId);
  const name = automation?.nome || "esta automacao";
  if (state.running && String(state.selectedAutomationId) === normalizedId) {
    throw new Error("Pare a automacao antes de excluir.");
  }
  if (!window.confirm(`Excluir "${name}" deste Agent?`)) {
    return;
  }
  await invoke("delete_saved_automation", { id: normalizedId });
  pushLog(`Automacao excluida do Agent: ${name}`, "success", "Biblioteca");
  if (String(state.selectedAutomationId) === normalizedId) {
    state.selectedAutomationId = "";
    state.roadmap = null;
    state.currentOrder = null;
    state.detailOpenOrder = null;
  }
  await refreshLibrary({ silent: true });
}

async function refreshWindows() {
  const result = await invoke("list_open_windows");
  const unique = new Map();
  (Array.isArray(result?.items) ? result.items : [])
    .map(normalizeWindow)
    .filter((item) => item.title && item.hwnd > 0 && !isFlowDetectWindow(item))
    .forEach((item) => {
      unique.set(windowKey(item), item);
    });
  state.windows = Array.from(unique.values());
  renderTarget();
}

async function setSelectedTarget(windowItem) {
  const result = await invoke("show_target_window_overlay", {
    hwnd: Number(windowItem?.hwnd || 0),
    title: windowItem?.title || "",
  });
  state.selectedTarget = normalizeWindow(result?.target || windowItem);
  await fitSelectedTargetToSafeArea({ log: true }).catch((error) => pushLog(String(error), "error", "Janela alvo"));
  renderTarget();
}

async function clearSelectedTarget() {
  await invoke("hide_target_window_overlay", { clearTarget: true });
  state.selectedTarget = null;
  renderTarget();
  pushLog("Janela alvo removida. O Agent vai usar a tela inteira quando a automacao precisar.", "info", "Janela alvo");
}

async function importZipFile(file) {
  if (!file) {
    return;
  }
  const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
  const result = await invoke("import_saved_automation_zip", {
    fileName: file.name,
    bytes,
  });
  const importedId = result?.imported_id || result?.importedId || "";
  await refreshLibrary({ preferredId: importedId, silent: true });
  pushLog(`Automacao importada com sucesso: ${file.name}`, "success", "Importacao");
}

async function runAutomation(id = "") {
  const targetId = String(id || state.selectedAutomationId || "").trim();
  if (!targetId) {
    throw new Error("Selecione uma automacao antes de executar.");
  }

  if (!state.roadmap || String(state.selectedAutomationId) !== targetId) {
    await loadAutomationRoadmap(targetId, { silent: true });
  }

  const automation = selectedAutomation();
  const delay = Number(elements.delayInput?.value || 0);
  const loopStart = Number(elements.loopStartInput?.value || 1);

  const message = await invoke("execute_saved_automation", {
    id: targetId,
    delay: Number.isFinite(delay) ? delay : 0,
    loopStart: Number.isFinite(loopStart) && loopStart > 0 ? Math.trunc(loopStart) : 1,
  });

  state.running = true;
  state.progress.title = `Executando ${automation?.nome || "automacao"}`;
  state.progress.description = String(message || "Execucao iniciada.");
  state.progress.percent = 0;
  state.progress.company = "";
  state.lastProgressSignature = "";
  state.lastAssistMapSignature = "";
  state.lastObserverSignature = "";
  renderProgress();
  renderAssistMap();
  updateButtons();
  setStatusChip("Executando", "running");
  pushLog(message || `Executando ${automation?.nome || "automacao"}...`, "info", "Execucao");
}

async function stopAutomation() {
  const message = await invoke("stop_test_execution");
  pushLog(message || "Parada solicitada.", "info", "Parada");
}

function applyProgressPosition(payload = {}) {
  const sequence = String(payload.sequence || "").trim();
  const order = Number(payload.order || 0);

  if (sequence) {
    state.currentSequence = normalizeSequenceName(sequence);
  }

  if (order > 0) {
    state.currentOrder = order;
    const event = getEventByOrder(order);
    if (event?.sequence) {
      state.currentSequence = normalizeSequenceName(event.sequence);
    }
  } else if (sequence) {
    const firstOrder = firstOrderForSequence(sequence);
    if (firstOrder != null) {
      state.currentOrder = firstOrder;
    }
  }
}

function applyProgressPayload(payload = {}, options = {}) {
  const forceMap = Boolean(options.forceMap);
  const remoteRunning = options.running ?? true;
  const previousOrder = Number(state.currentOrder || 0);
  state.running = Boolean(remoteRunning);
  applyProgressPosition(payload);
  state.progress.percent = Number(payload.percent || state.progress.percent || 0);
  state.progress.company = String(payload.company || state.progress.company || "");
  state.progress.title = state.progress.company
    ? `Executando ${state.progress.company}`
    : String(payload.title || payload.titulo || "Executando automacao");
  state.progress.description = String(payload.description || payload.descricao || state.progress.description || "Executando etapa da automacao.");
  renderProgress();
  const now = Date.now();
  const orderChanged = Number(state.currentOrder || 0) !== previousOrder;
  if (forceMap || orderChanged || now - state.lastRemoteProgressRenderAt > 900) {
    state.lastRemoteProgressRenderAt = now;
    renderPageChips();
    renderAssistMap();
  }
  updateButtons();
  setStatusChip(state.running ? "Executando" : "Pronto", state.running ? "running" : "idle");
}

function scheduleProgressPayload(payload = {}) {
  pendingProgressPayload = { ...(pendingProgressPayload || {}), ...payload };
  if (progressRenderTimer) {
    return;
  }
  progressRenderTimer = window.setTimeout(() => {
    const nextPayload = pendingProgressPayload || {};
    pendingProgressPayload = null;
    progressRenderTimer = null;
    applyProgressPayload(nextPayload);
  }, state.lowPowerMode ? 250 : 80);
}

function applyFinishedState(success, code) {
  state.running = false;
  state.progress.percent = success ? 100 : state.progress.percent;
  state.progress.title = success ? "Execucao finalizada" : "Execucao encerrada";
  state.progress.description = success
    ? "Automacao concluida com sucesso."
    : `Execucao encerrada com codigo ${code}.`;
  state.lastProgressSignature = "";
  state.lastAssistMapSignature = "";
  state.lastObserverSignature = "";
  renderProgress();
  renderAssistMap();
  updateButtons();
  setStatusChip(success ? "Concluida" : "Falha", success ? "idle" : "error");
  pushLog(state.progress.description, success ? "success" : "error", "Execucao");
}

async function refreshRemoteAgentState() {
  if (state.remoteStatusRefreshing) {
    return;
  }
  state.remoteStatusRefreshing = true;
  try {
    const now = Date.now();
    const snapshotPayload = await invoke("get_agent_remote_snapshot");
    const snapshot = snapshotPayload?.snapshot || {};
    const progress = snapshot.progress || {};
    const remoteAutomationId = String(snapshot.automation_id || snapshot.automationId || "").trim();
    const remoteRunning = Boolean(snapshot.running);
    renderAgentConnectionState(snapshot);

    const shouldCheckLibrary = !state.lastRemoteLibraryCheckAt
      || now - state.lastRemoteLibraryCheckAt > (remoteRunning ? 15000 : 8000)
      || (remoteAutomationId && !state.library.some((item) => String(item.id) === remoteAutomationId));
    if (shouldCheckLibrary) {
      state.lastRemoteLibraryCheckAt = now;
      const libraryResult = await invoke("list_saved_automations");
      const nextLibrary = Array.isArray(libraryResult?.items) ? libraryResult.items : [];
      const nextSignature = librarySignature(nextLibrary);
      const libraryChanged = nextSignature !== state.librarySignature;
      if (libraryChanged) {
        await refreshLibrary({
          preferredId: remoteAutomationId || state.selectedAutomationId,
          silent: true,
          forceRoadmap: Boolean(remoteAutomationId),
        });
        if (!state.running) {
          pushLog("Biblioteca atualizada automaticamente pelo Control.", "info", "Sincronizacao");
        }
      }
    }

    if (remoteAutomationId && String(state.selectedAutomationId) !== remoteAutomationId) {
      await loadAutomationRoadmap(remoteAutomationId, { silent: true });
    }

    if (remoteRunning || state.running) {
      applyProgressPayload({
        ...progress,
        title: remoteRunning
          ? `Executando ${selectedAutomation()?.nome || snapshot.automation_name || "automacao"}`
          : state.progress.title,
      }, { running: remoteRunning });
    }

    if (Array.isArray(snapshot.logs) && snapshot.logs.length) {
      replaceRemoteLogs(snapshot.logs);
    }
  } catch (_error) {
    // O Agent continua utilizavel localmente mesmo se o snapshot remoto ainda nao estiver pronto.
  } finally {
    state.remoteStatusRefreshing = false;
  }
}

function startRemoteAgentPolling() {
  if (state.remotePollTimer) {
    window.clearInterval(state.remotePollTimer);
  }
  state.remotePollTimer = window.setInterval(() => {
    refreshRemoteAgentState().catch(() => {});
  }, 3000);
}

async function handleLibraryClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) {
    return;
  }

  const action = button.dataset.action || "";
  const id = String(button.dataset.id || "");

  if (action === "select") {
    try {
      await loadAutomationRoadmap(id);
    } catch (error) {
      pushLog(String(error), "error", "Biblioteca");
      setStatusChip("Falha", "error");
    }
    return;
  }

  if (action === "run") {
    try {
      await runAutomation(id);
    } catch (error) {
      pushLog(String(error), "error", "Execucao");
      setStatusChip("Falha", "error");
    }
    return;
  }

  if (action === "delete") {
    try {
      await deleteAutomationFromAgent(id);
    } catch (error) {
      pushLog(String(error), "error", "Biblioteca");
      setStatusChip("Falha", "error");
    }
  }
}

async function handleWindowClick(event) {
  const button = event.target.closest("[data-window-key]");
  if (!button) {
    return;
  }

  const key = button.dataset.windowKey || "";
  const target = state.windows.find((item) => windowKey(item) === key);
  if (!target) {
    return;
  }

  try {
    await setSelectedTarget(target);
  } catch (error) {
    pushLog(String(error), "error", "Janela alvo");
    setStatusChip("Falha", "error");
  }
}

function handlePageChipClick(event) {
  const button = event.target.closest("[data-sequence]");
  if (!button || state.running) {
    return;
  }

  const sequence = normalizeSequenceName(button.dataset.sequence || "principal");
  state.currentSequence = sequence;
  state.detailOpenOrder = null;
  if (!getSequenceEvents(sequence).some((entry) => Number(entry.order) === Number(state.currentOrder))) {
    state.currentOrder = firstOrderForSequence(sequence);
  }
  renderPageChips();
  renderAssistMap();
  renderProgress();
}

function handleAssistMapClick(event) {
  const detailButton = event.target.closest("[data-detail-action]");
  if (detailButton) {
    void handleAssistDetailClick(detailButton);
    return;
  }

  const card = event.target.closest("[data-assist-order]");
  if (!card || state.running) {
    return;
  }

  const order = Number(card.dataset.assistOrder || 0);
  if (!order) {
    return;
  }
  if (Number(state.detailOpenOrder) === order) {
    return;
  }

  const assistEvent = getEventByOrder(order);
  applyPreviewTarget({
    sequence: assistEvent?.sequence || state.currentSequence,
    order,
  });
}

function handleAssistDetailClick(button) {
  if (state.running) {
    return;
  }

  const order = Number(button.dataset.assistOrder || 0);
  if (!order) {
    return;
  }

  const action = String(button.dataset.detailAction || "");
  const assistEvent = getEventByOrder(order);
  if (!assistEvent) {
    return;
  }

  state.currentSequence = normalizeSequenceName(assistEvent.sequence || state.currentSequence);
  state.currentOrder = order;

  if (action === "close") {
    closeAssistDetailDom(order);
    state.detailOpenOrder = null;
    syncAssistDetailContainer();
    renderPageChips();
    renderProgress();
    renderPreviewToolbar();
    return;
  }

  if (state.detailOpenOrder && Number(state.detailOpenOrder) !== order) {
    closeAssistDetailDom(state.detailOpenOrder);
  }
  state.detailOpenOrder = order;
  openAssistDetailDom(order);
  syncAssistDetailContainer();
  renderPageChips();
  renderProgress();
  renderPreviewToolbar();
  centerCurrentCard(order, "smooth");

  if (assistEvent.type === "clicar_imagem") {
    void ensureRecognitionPreview(assistEvent);
  }
}

function movePreview(step) {
  if (state.running) {
    return;
  }

  const targets = resolvePreviewTargets();
  applyPreviewTarget(step < 0 ? targets.previous : targets.next);
}

function handleAssistMapKeydown(event) {
  if (state.running) {
    return;
  }

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    movePreview(-1);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    movePreview(1);
  }
}

async function boot() {
  document.body.classList.add("agent-service-mode", "agent-lite-mode");
  await loadAgentConnectionInfo();
  await loadMouseControlState();
  renderLogs();
  renderSelection();
  renderTarget();
  renderOverview();
  renderPageChips();
  renderAssistMap();
  renderProgress();
  renderAgentViews();
  updateButtons();

  const toggleOverlayMode = async () => {
    const currentWindow = tauriWindow?.getCurrentWindow?.();
    await currentWindow?.show?.().catch(() => {});
    await currentWindow?.setFocus?.().catch(() => {});
    document.body.classList.remove("agent-service-mode");
    document.body.classList.toggle("agent-compact-mode", false);
    elements.toggleAgentPanelButton.textContent = "Ocultar";
  };
  await safeListen("agent-overlay-toggle-request", () => { void toggleOverlayMode(); });
  await safeListen("agent-identity-updated", (event) => {
    setElementText(elements.observerAgentName, event.payload?.name || "AGENTE PRINCIPAL");
  });

  elements.viewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.activeView = button.dataset.agentView || "realtime";
      renderAgentViews();
    });
  });

  elements.importZipButton?.addEventListener("click", () => elements.automationZipInput?.click());
  elements.toggleMouseControlButton?.addEventListener("click", () => { void toggleMouseControl(); });
  elements.toggleMouseControlInlineButton?.addEventListener("click", () => { void toggleMouseControl(); });
  elements.toggleAgentPanelButton?.addEventListener("click", async () => {
    document.body.classList.add("agent-service-mode");
    await tauriWindow?.getCurrentWindow?.()?.hide?.().catch(() => {});
  });
  elements.minimizeAgentButton?.addEventListener("click", () => {
    document.body.classList.add("agent-service-mode");
    tauriWindow?.getCurrentWindow?.()?.hide?.().catch(() => {});
  });
  elements.refreshLibraryButton?.addEventListener("click", async () => {
    try {
      await refreshLibrary({ silent: true });
      pushLog("Biblioteca atualizada.", "info", "Biblioteca");
    } catch (error) {
      pushLog(String(error), "error", "Biblioteca");
      setStatusChip("Falha", "error");
    }
  });

  elements.automationZipInput?.addEventListener("change", async () => {
    const file = elements.automationZipInput.files?.[0] || null;
    elements.automationZipInput.value = "";
    if (!file) {
      return;
    }
    try {
      await importZipFile(file);
    } catch (error) {
      pushLog(String(error), "error", "Importacao");
      setStatusChip("Falha", "error");
    }
  });

  elements.runAutomationButton?.addEventListener("click", async () => {
    try {
      await runAutomation();
    } catch (error) {
      pushLog(String(error), "error", "Execucao");
      setStatusChip("Falha", "error");
    }
  });

  elements.stopAutomationButton?.addEventListener("click", async () => {
    try {
      await stopAutomation();
    } catch (error) {
      pushLog(String(error), "error", "Parada");
      setStatusChip("Falha", "error");
    }
  });

  elements.refreshWindowsButton?.addEventListener("click", async () => {
    try {
      await refreshWindows();
      pushLog(state.windows.length ? `${state.windows.length} janela(s) carregada(s).` : "Nenhuma janela visivel encontrada agora.", "info", "Janela alvo");
    } catch (error) {
      pushLog(String(error), "error", "Janela alvo");
      setStatusChip("Falha", "error");
    }
  });

  elements.clearTargetButton?.addEventListener("click", async () => {
    try {
      await clearSelectedTarget();
    } catch (error) {
      pushLog(String(error), "error", "Janela alvo");
      setStatusChip("Falha", "error");
    }
  });

  elements.automationList?.addEventListener("click", (event) => {
    void handleLibraryClick(event);
  });
  elements.windowList?.addEventListener("click", (event) => {
    void handleWindowClick(event);
  });
  elements.pageChipList?.addEventListener("click", handlePageChipClick);
  elements.assistMapList?.addEventListener("click", handleAssistMapClick);
  elements.assistMapList?.addEventListener("keydown", handleAssistMapKeydown);
  elements.previewPrevButton?.addEventListener("click", () => movePreview(-1));
  elements.previewNextButton?.addEventListener("click", () => movePreview(1));

  window.addEventListener("beforeunload", () => {
    invoke("hide_target_window_overlay", { clearTarget: true }).catch(() => {});
  });

  let compactResizeTimer = null;
  window.addEventListener("resize", () => {
    if (!document.body.classList.contains("agent-compact-mode")) {
      return;
    }
    if (compactResizeTimer) {
      window.clearTimeout(compactResizeTimer);
    }
    compactResizeTimer = window.setTimeout(() => {
      compactResizeTimer = null;
      void syncAgentCompactWindow("window-resize");
    }, 120);
  });

  await safeListen("test-execution-state", (event) => {
    const wasRunning = state.running;
    state.running = Boolean(event.payload?.running);
    if (wasRunning !== state.running) {
      state.lastProgressSignature = "";
      state.lastAssistMapSignature = "";
      state.lastObserverSignature = "";
    }
    renderProgress();
    renderAssistMap();
    updateButtons();
    setStatusChip(state.running ? "Executando" : "Pronto", state.running ? "running" : "idle");
  });

  await safeListen("test-log", (event) => {
    const message = String(event.payload?.message || "");
    const lowered = message.toLowerCase();
    const tone = lowered.includes("erro") || lowered.includes("falha")
      ? "error"
      : lowered.includes("sucesso") || lowered.includes("confirmou")
        ? "success"
        : "info";
    pushLog(message, tone, "Execucao");
    if (lowered.includes("janela alvo perdida")) {
      setStatusChip("Janela perdida", "error");
    }
  });

  await safeListen("test-progress", (event) => {
    const payload = event.payload || {};
    scheduleProgressPayload(payload);
  });

  await safeListen("test-finished", (event) => {
    const payload = event.payload || {};
    applyFinishedState(Boolean(payload.success), Number(payload.code || 0));
  });

  try {
    await refreshLibrary({ silent: true });
    await refreshWindows();
    const executionState = await invoke("get_test_execution_state");
    state.running = Boolean(executionState?.running);
    renderProgress();
    renderAssistMap();
    updateButtons();
    setStatusChip(state.running ? "Executando" : "Pronto", state.running ? "running" : "idle");
    startRemoteAgentPolling();
    pushLog("FlowDetect Agent pronto para uso.", "success", "Inicializacao");
  } catch (error) {
    pushLog(String(error), "error", "Inicializacao");
    setStatusChip("Falha", "error");
  }
}

boot();

const tauriCore = window.__TAURI__?.core ?? null

const PAGE_DEFINITIONS = Object.freeze([
  { sequence: "principal", label: "Pagina 1", shortLabel: "1", theme: "principal" },
  { sequence: "pagina_2", label: "Pagina 2", shortLabel: "2", theme: "pagina_2" },
  { sequence: "pagina_3", label: "Pagina 3", shortLabel: "3", theme: "pagina_3" },
  { sequence: "pagina_4", label: "Pagina 4", shortLabel: "4", theme: "pagina_4" },
])

const state = {
  address: "127.0.0.1:18452",
  connected: false,
  agentLabel: "Aguardando conexao",
  activeView: "automation",
  library: [],
  libraryFlippedIds: new Set(),
  selectedAutomationId: "",
  roadmap: null,
  running: false,
  currentSequence: "principal",
  currentOrder: null,
  detailOpenOrder: null,
  detailScrollTop: 0,
  importingZip: false,
  imagePreviewCache: {},
  imagePreviewLoading: {},
  targetTitle: "",
  logs: [],
  progress: {
    percent: 0,
    title: "Aguardando execucao",
    description: "Conecte no Agent para carregar as automacoes remotas.",
    company: "",
  },
  pollTimer: null,
  statusRefreshing: false,
}

const elements = {
  agentShell: document.getElementById("agentShell"),
  connectionHint: document.getElementById("connectionHint"),
  targetStatusPill: document.getElementById("targetStatusPill"),
  agentAddressInput: document.getElementById("agentAddressInput"),
  connectButton: document.getElementById("connectButton"),
  refreshButton: document.getElementById("refreshButton"),
  viewTabButtons: Array.from(document.querySelectorAll("[data-control-view]")),
  viewPanels: Array.from(document.querySelectorAll("[data-view-panel]")),
  connectionStatusText: document.getElementById("connectionStatusText"),
  agentIdentityText: document.getElementById("agentIdentityText"),
  automationCountText: document.getElementById("automationCountText"),
  libraryMeta: document.getElementById("libraryMeta"),
  importZipButton: document.getElementById("importZipButton"),
  importZipInput: document.getElementById("importZipInput"),
  libraryEmptyState: document.getElementById("libraryEmptyState"),
  automationList: document.getElementById("automationList"),
  selectedAutomationTitle: document.getElementById("selectedAutomationTitle"),
  selectedAutomationSummary: document.getElementById("selectedAutomationSummary"),
  selectedAutomationBadge: document.getElementById("selectedAutomationBadge"),
  runAutomationButton: document.getElementById("runAutomationButton"),
  stopAutomationButton: document.getElementById("stopAutomationButton"),
  statusChip: document.getElementById("statusChip"),
  currentCompanyText: document.getElementById("currentCompanyText"),
  currentPageText: document.getElementById("currentPageText"),
  currentBlockText: document.getElementById("currentBlockText"),
  progressTitle: document.getElementById("progressTitle"),
  progressPercent: document.getElementById("progressPercent"),
  progressFill: document.getElementById("progressFill"),
  progressDescription: document.getElementById("progressDescription"),
  previewPrevButton: document.getElementById("previewPrevButton"),
  previewNextButton: document.getElementById("previewNextButton"),
  pageChipList: document.getElementById("pageChipList"),
  assistMapList: document.getElementById("assistMapList"),
  logList: document.getElementById("logList"),
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function setElementText(element, value) {
  if (element) {
    element.textContent = value
  }
}

function formatDateTime(value) {
  if (!value) {
    return "Sem data"
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value)
  }
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date)
}

function normalizeSequenceName(sequenceName) {
  const normalized = String(sequenceName || "").trim()
  if (!normalized) {
    return "principal"
  }

  const lowered = normalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

  if (["principal", "pagina_1", "pagina 1", "pagina1", "p1"].includes(lowered)) {
    return "principal"
  }
  if (["pagina_2", "pagina 2", "pagina2", "p2"].includes(lowered)) {
    return "pagina_2"
  }
  if (["pagina_3", "pagina 3", "pagina3", "p3"].includes(lowered)) {
    return "pagina_3"
  }
  if (["pagina_4", "pagina 4", "pagina4", "p4"].includes(lowered)) {
    return "pagina_4"
  }

  return normalized
}

function normalizeSequenceExecutionMode(mode) {
  return String(mode || "").trim().toLowerCase() === "loop_planilha" ? "loop_planilha" : "normal"
}

function getRoadmapSequenceSettings(roadmap = state.roadmap) {
  const settings = roadmap?.sequence_settings
  return settings && typeof settings === "object" ? settings : {}
}

function getPageDefinitions(roadmap = state.roadmap) {
  const base = PAGE_DEFINITIONS.map((page) => ({ ...page, isExtra: false }))
  const known = new Set(base.map((page) => page.sequence))
  const extra = Array.from(new Set(roadmap?.sequences || []))
    .map((sequence) => normalizeSequenceName(sequence))
    .filter((sequence) => !known.has(sequence))
    .map((sequence, index) => ({
      sequence,
      label: sequence,
      shortLabel: String(base.length + index + 1),
      theme: "principal",
      isExtra: true,
    }))
  return [...base, ...extra]
}

function getBrowsablePages(roadmap = state.roadmap) {
  return getPageDefinitions(roadmap)
    .filter((page) => getSequenceEvents(page.sequence, roadmap).length > 0)
}

function getPageDefinition(sequenceName, roadmap = state.roadmap) {
  const normalized = normalizeSequenceName(sequenceName)
  return (
    getPageDefinitions(roadmap).find((page) => page.sequence === normalized)
    || getPageDefinitions(roadmap)[0]
    || PAGE_DEFINITIONS[0]
  )
}

function resolvePageTheme(sequenceName) {
  const normalized = normalizeSequenceName(sequenceName)
  return PAGE_DEFINITIONS.some((page) => page.sequence === normalized) ? normalized : "principal"
}

function resolveRoadmapInitialSequence(roadmap = state.roadmap) {
  const preferred = normalizeSequenceName(roadmap?.initial_sequence || roadmap?.sequencia_inicial || "principal")
  const pages = getPageDefinitions(roadmap)
  if (pages.some((page) => page.sequence === preferred)) {
    return preferred
  }
  const firstEventSequence = roadmap?.events?.[0]?.sequence || roadmap?.events?.[0]?.sequencia || "principal"
  return normalizeSequenceName(firstEventSequence)
}

function getSequenceExecutionSettings(sequenceName, roadmap = state.roadmap) {
  const settings = getRoadmapSequenceSettings(roadmap)
  const raw = settings[normalizeSequenceName(sequenceName)] || {}
  return {
    executionMode: normalizeSequenceExecutionMode(raw.execution_mode ?? raw.executionMode ?? raw.modo_execucao),
  }
}

function getSequenceEvents(sequenceName, roadmap = state.roadmap) {
  const normalized = normalizeSequenceName(sequenceName)
  return (roadmap?.events || []).filter((event) => normalizeSequenceName(event.sequence || event.sequencia) === normalized)
}

function getEventByOrder(order, roadmap = state.roadmap) {
  return (roadmap?.events || []).find((event) => Number(event.order) === Number(order)) || null
}

function selectedAutomation() {
  return state.library.find((item) => String(item.id) === String(state.selectedAutomationId)) || null
}

function blockChipLabel(event = {}) {
  const labels = {
    texto_livre: "TEXTO",
    tecla: "TECLA",
    atalho: "ATALHO",
    mouse_click: "MOUSE",
    clicar_imagem: "RECONHECIMENTO",
    chrome_elemento_html: "CHROME",
    abrir_url: "ABRIR URL",
    abrir_programa: "PROGRAMA",
    verificar_estado_botao: "VERIFICACAO",
    sequencia_planilha: "PLANILHA",
    escrever_planilha: "ESCREVER CELULA",
    inicio_loop: "INICIO LOOP",
    fim_loop: "FIM LOOP",
  }
  return labels[String(event.type || "").trim()] || String(event.type || "BLOCO").replaceAll("_", " ").toUpperCase()
}

function compactText(value, limit = 80) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim()
  if (!normalized) {
    return "-"
  }
  return normalized.length <= limit ? normalized : `${normalized.slice(0, Math.max(0, limit - 3))}...`
}

function formatDecimal(value, digits = 1) {
  const number = Number(value || 0)
  if (!Number.isFinite(number)) {
    return "0"
  }
  return number.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })
}

function formatDelayLabel(value) {
  const number = Number(value || 0)
  if (!Number.isFinite(number) || number <= 0) {
    return "Sem atraso"
  }
  return `${formatDecimal(number, 2)}s antes`
}

function formatRepeatLabel(value) {
  const repeat = Math.max(1, Number(value || 1))
  return repeat === 1 ? "1 vez" : `${repeat} vezes`
}

function formatFailureAction(details = {}) {
  const action = String(details.ao_nao_encontrar || "").trim() || "parar"
  if (action === "ir_para_bloco" && details.bloco_nao_encontrar) {
    return `Ir para bloco ${details.bloco_nao_encontrar}`
  }
  if (action === "ir_para_pagina" && details.sequencia_nao_encontrar) {
    return `Ir para ${String(details.sequencia_nao_encontrar).replaceAll("_", " ")}`
  }
  const labels = {
    continuar: "Continuar",
    parar: "Parar",
    tentar_novamente: "Tentar de novo",
    ir_para_bloco: "Ir para bloco",
    ir_para_pagina: "Ir para pagina",
  }
  return labels[action] || compactText(action, 32)
}

function formatSearchProfile(profile) {
  const normalized = String(profile || "").trim().toLowerCase()
  const labels = {
    fast: "Rapido",
    rapido: "Rapido",
    balanced: "Equilibrado",
    equilibrado: "Equilibrado",
    precise: "Preciso",
    preciso: "Preciso",
  }
  return labels[normalized] || compactText(profile || "Padrao", 20)
}

function formatSearchAreaMode(mode) {
  const normalized = String(mode || "").trim().toLowerCase()
  const labels = {
    target_window: "Janela alvo",
    janela_alvo: "Janela alvo",
    custom_region: "Area definida",
    area_personalizada: "Area definida",
    last_position: "Ultima posicao",
    last_found_region: "Ultima posicao",
    near_last_position: "Ultima posicao",
  }
  return labels[normalized] || "Janela alvo"
}

function buildActionAfterItemLabel(details = {}) {
  const text = String(details.acao_apos_item_texto || "").trim()
  if (text) {
    return compactText(text, 28)
  }

  if (Array.isArray(details.acao_apos_item) && details.acao_apos_item.length) {
    return compactText(details.acao_apos_item.join(" + "), 28)
  }

  return "Nenhuma"
}

function buildDetailRows(event = {}) {
  const details = event.details || {}
  const type = String(event.type || "").trim()
  const rows = []

  if (type === "texto_livre") {
    rows.push({ label: "Texto", value: compactText(event.text || event.subtitle, 110), emphasis: true })
    rows.push({ label: "Tamanho", value: `${String(event.text || "").length} caracteres` })
  } else if (type === "tecla" || type === "atalho") {
    rows.push({ label: type === "atalho" ? "Atalho" : "Tecla", value: compactText(event.subtitle || (event.keys || []).join(" + "), 60), emphasis: true })
    rows.push({ label: "Repeticao", value: formatRepeatLabel(details.repeticoes || 1) })
  } else if (type === "mouse_click") {
    rows.push({ label: "Botao", value: String(details.botao || "left").toUpperCase() })
    rows.push({ label: "Cliques", value: formatRepeatLabel(details.cliques || 1) })
    rows.push({ label: "Posicao", value: `X ${details.x ?? 0} | Y ${details.y ?? 0}` })
  } else if (type === "clicar_imagem") {
    rows.push({ label: "Arquivo", value: compactText(String(details.imagem || event.subtitle || "").split(/[\\/]/).pop(), 36), emphasis: true })
    rows.push({ label: "Precisao", value: `${Math.round(Number(details.confianca || 0.8) * 100)}% | ${formatSearchProfile(details.perfil_busca)} | ${formatSearchAreaMode(details.modo_area_busca || details.area_busca || "target_window")}` })
    rows.push({ label: "Acao", value: `${details.clicar === false ? "Localizar" : `${Math.max(1, Number(details.cliques || 1))} clique(s)`} | ${formatFailureAction(details)}` })
    rows.push({ label: "Tempo", value: `${formatDecimal(details.timeout || 10, 1)}s | ${Math.max(1, Number(details.quantidade_tentativas || 1))} tentativa(s)` })
  } else if (type === "sequencia_planilha") {
    rows.push({ label: "Planilha", value: compactText(String(details.arquivo || "").split(/[\\/]/).pop() || "-", 36), emphasis: true })
    rows.push({ label: "Origem", value: `${compactText(details.aba || "Sheet1", 18)} -> ${compactText(details.coluna || "-", 18)}` })
    rows.push({ label: "Loop", value: `${Array.isArray(details.valores) ? details.valores.length : 0} item(ns) | apos: ${buildActionAfterItemLabel(details)}` })
    rows.push({ label: "Intervalo item", value: `${formatDecimal(details.intervalo_entre_itens || 0, 2)}s` })
  } else if (type === "escrever_planilha") {
    rows.push({ label: "Planilha", value: compactText(String(details.arquivo || "").split(/[\\/]/).pop() || "-", 36), emphasis: true })
    rows.push({ label: "Destino", value: `${compactText(details.aba || "Sheet1", 18)} -> ${compactText(details.coluna || "-", 18)}` })
    rows.push({ label: "Valor", value: compactText(details.valor || "-", 42) })
    rows.push({ label: "Linha", value: "Linha atual do loop" })
  } else if (type === "chrome_elemento_html") {
    const alvo = details.alvo || {}
    const acao = details.acao || {}
    rows.push({ label: "Elemento", value: compactText(`${alvo.metodo || "css"}: ${alvo.valor || "-"}`, 86), emphasis: true })
    rows.push({ label: "Acao", value: compactText(acao.tipo || "clicar", 28) })
  } else if (type === "abrir_url") {
    rows.push({ label: "URL", value: compactText(details.url || event.subtitle || "-", 92), emphasis: true })
    rows.push({ label: "Navegador", value: compactText(details.navegador || "padrao", 24) })
    rows.push({ label: "Modo", value: details.modo_abertura === "nova_aba" ? "Nova aba" : "Nova janela" })
    rows.push({ label: "Aguardar", value: `${formatDecimal(details.aguardar_segundos || 0, 1)}s` })
  } else if (type === "abrir_programa") {
    rows.push({ label: "Programa", value: compactText(String(details.caminho || event.subtitle || "-").split(/[\\/]/).pop(), 46), emphasis: true })
    rows.push({ label: "Caminho", value: compactText(details.caminho || "-", 92) })
    rows.push({ label: "Parametros", value: compactText(details.parametros || "-", 70) })
    rows.push({ label: "Aguardar", value: `${formatDecimal(details.aguardar_segundos || 0, 1)}s` })
  } else if (type === "verificar_estado_botao") {
    rows.push({ label: "Ativo", value: compactText((details.se_ativo || {}).acao || "continuar", 26) })
    rows.push({ label: "Desativado", value: compactText((details.se_desativado || {}).acao || "continuar", 26) })
    rows.push({ label: "Falha", value: compactText((details.se_nao_encontrar || {}).acao || "parar", 26) })
  } else if (type === "inicio_loop" || type === "fim_loop") {
    rows.push({ label: "Funcao", value: compactText(event.description || event.subtitle || "Marca o trecho de repeticao.", 98), emphasis: true })
  } else {
    rows.push({ label: "Detalhe", value: compactText(event.description || event.command || event.subtitle || "-", 100), emphasis: true })
  }

  rows.push({ label: "Intervalo", value: formatDelayLabel(event.delay || 0) })
  return rows.slice(0, 6)
}

function renderDetailRows(event = {}) {
  return buildDetailRows(event)
    .map((row) => `
      <div class="agent-assist-detail-row ${row.emphasis ? "is-emphasis" : ""}">
        <span>${escapeHtml(row.label)}</span>
        <strong>${escapeHtml(row.value)}</strong>
      </div>
    `)
    .join("")
}

function detailFooterText(event = {}) {
  const type = String(event.type || "").trim()
  if (type === "clicar_imagem") {
    return "Preview real da referencia"
  }
  if (type === "sequencia_planilha") {
    return "Resumo do loop da planilha"
  }
  if (type === "escrever_planilha") {
    return "Escrita na linha atual"
  }
  return "Resumo rapido do bloco"
}

function currentVisibleEvents() {
  const events = getSequenceEvents(state.currentSequence)
  return events.length ? events : (state.roadmap?.events || [])
}

function currentBlockEvent() {
  return getEventByOrder(state.currentOrder) || currentVisibleEvents()[0] || null
}

function firstOrderForSequence(sequenceName) {
  return getSequenceEvents(sequenceName)[0]?.order ?? null
}

function syncTheme() {
  elements.agentShell.dataset.pageTheme = resolvePageTheme(state.currentSequence)
}

async function invoke(command, payload) {
  if (typeof tauriCore?.invoke !== "function") {
    throw new Error("API do Tauri indisponivel no FlowDetect Control.")
  }
  return tauriCore.invoke(command, payload)
}

function showHint(message) {
  setElementText(elements.connectionHint, message)
}

function setStatusChip(label, tone = "idle") {
  elements.statusChip.textContent = label
  elements.statusChip.className = `agent-status-chip is-${tone}`
}

function setConnectionChip(label, connected) {
  elements.connectionStatusText.textContent = label
  elements.connectionStatusText.className = `control-connection-chip ${connected ? "is-connected" : "is-offline"}`
}

function setControlView(viewName) {
  const normalized = String(viewName || "automation").trim() === "library" ? "library" : "automation"
  state.activeView = normalized

  elements.viewTabButtons.forEach((button) => {
    const isActive = button.dataset.controlView === normalized
    button.classList.toggle("is-active", isActive)
    button.setAttribute("aria-selected", String(isActive))
  })

  elements.viewPanels.forEach((panel) => {
    panel.hidden = panel.dataset.viewPanel !== normalized
  })
}

function resolveLogTone(message) {
  const lowered = String(message || "").toLowerCase()
  if (lowered.includes("erro") || lowered.includes("falha")) {
    return "error"
  }
  if (lowered.includes("sucesso") || lowered.includes("concluida") || lowered.includes("confirmou")) {
    return "success"
  }
  return "info"
}

async function ensureRecognitionPreview(event = {}) {
  const imageId = String(event?.details?.imagem || "").trim().replaceAll("\\", "/")
  if (!imageId || state.imagePreviewCache[imageId] || state.imagePreviewLoading[imageId]) {
    return
  }

  state.imagePreviewLoading[imageId] = true
  try {
    const preview = await invoke("remote_agent_get_recognition_preview", {
      address: state.address,
      imageId,
      image_id: imageId,
    })
    if (preview?.src) {
      state.imagePreviewCache[imageId] = preview
    }
  } catch (_error) {
    state.imagePreviewCache[imageId] = { failed: true }
  } finally {
    delete state.imagePreviewLoading[imageId]
    if (state.detailOpenOrder === Number(event.order || 0)) {
      updateRecognitionPreviewInDom(event.order)
    }
  }
}

function renderRecognitionPreview(event = {}) {
  const imageId = String(event?.details?.imagem || "").trim().replaceAll("\\", "/")
  if (!imageId) {
    return ""
  }

  const cached = state.imagePreviewCache[imageId]
  const isLoading = Boolean(state.imagePreviewLoading[imageId])

  if (cached?.src) {
    return `
      <div class="agent-assist-preview" data-recognition-preview-order="${Number(event.order || 0)}">
        <img src="${escapeHtml(cached.src)}" alt="${escapeHtml(cached.file_name || "Preview do reconhecimento")}" />
      </div>
    `
  }

  if (cached?.failed) {
    return `
      <div class="agent-assist-preview" data-recognition-preview-order="${Number(event.order || 0)}">
        <div class="agent-assist-preview-empty">
          Preview indisponivel
        </div>
      </div>
    `
  }

  return `
    <div class="agent-assist-preview" data-recognition-preview-order="${Number(event.order || 0)}">
      <div class="agent-assist-preview-empty">
        ${isLoading ? "Carregando preview..." : escapeHtml(compactText(imageId.split("/").pop(), 34))}
      </div>
    </div>
  `
}

function updateRecognitionPreviewInDom(order) {
  const slot = elements.assistMapList?.querySelector(`[data-recognition-preview-order="${Number(order)}"]`)
  const assistEvent = getEventByOrder(order)
  if (slot && assistEvent) {
    slot.outerHTML = renderRecognitionPreview(assistEvent)
  }
}

function syncAssistDetailContainer() {
  const hasDetailOpen = Boolean(state.detailOpenOrder)
  elements.assistMapList?.classList.toggle("has-detail-open", hasDetailOpen)
  elements.assistMapList?.querySelector(".agent-assist-flow-row")?.classList.toggle("has-detail-open", hasDetailOpen)
}

function closeAssistDetailDom(order = null) {
  const selector = order == null
    ? ".control-assist-card.is-flipped"
    : `.control-assist-card[data-assist-order="${Number(order)}"]`
  elements.assistMapList?.querySelector(selector)?.classList.remove("is-flipped")
}

function openAssistDetailDom(order) {
  elements.assistMapList?.querySelector(`.control-assist-card[data-assist-order="${Number(order)}"]`)?.classList.add("is-flipped")
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
  `

  if (!isBack) {
    return `
      <div class="control-assist-card-face control-assist-card-front">
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
    `
  }

  return `
    <div class="control-assist-card-face control-assist-card-back ${event.type === "clicar_imagem" ? "has-visual-preview" : ""}">
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
  `
}

function renderConnection() {
  setConnectionChip(state.connected ? "Conectado" : "Desconectado", state.connected)
  setElementText(elements.agentIdentityText, state.agentLabel)
  setElementText(
    elements.automationCountText,
    `${state.library.length} automacao${state.library.length === 1 ? "" : "oes"}`
  )
  setElementText(
    elements.targetStatusPill,
    state.targetTitle ? `Janela: ${compactText(state.targetTitle, 24)}` : "Tela inteira"
  )
  elements.connectButton.disabled = false
  elements.refreshButton.disabled = !state.connected
}

function renderSelection() {
  const automation = selectedAutomation()
  if (!automation) {
    setElementText(elements.selectedAutomationTitle, "Selecione uma automacao")
    setElementText(elements.selectedAutomationBadge, "Sem selecao")
    setElementText(
      elements.selectedAutomationSummary,
      "Escolha uma automacao no card para abrir a trilha visual e iniciar quando quiser."
    )
    return
  }

  setElementText(elements.selectedAutomationTitle, automation.nome || "Automacao")
  setElementText(
    elements.selectedAutomationBadge,
    state.running && String(state.selectedAutomationId) === String(automation.id)
      ? "Executando"
      : automation.categoria || "Remota"
  )
  setElementText(
    elements.selectedAutomationSummary,
    [
      automation.descricao || "Automacao pronta para iniciar remotamente.",
      `${automation.command_count || 0} blocos`,
      `${automation.sequence_count || 0} pagina(s)`,
      `Atualizada em ${formatDateTime(automation.atualizado_em)}`,
    ].join(" | ")
  )
}

function renderLibrary() {
  const items = [...state.library].sort((left, right) => {
    const leftTime = new Date(left.atualizado_em || 0).getTime()
    const rightTime = new Date(right.atualizado_em || 0).getTime()
    return rightTime - leftTime
  })
  const hasItems = items.length > 0
  const runningId = String(state.running ? state.selectedAutomationId : "") || String(state.selectedAutomationId || "")

  setElementText(
    elements.libraryMeta,
    hasItems ? `${items.length} automacao${items.length === 1 ? "" : "oes"}` : "Vazia"
  )
  elements.libraryEmptyState.hidden = hasItems

  if (!hasItems) {
    elements.automationList.innerHTML = ""
    return
  }

  elements.automationList.innerHTML = items.map((item) => {
    const selected = String(item.id) === String(state.selectedAutomationId)
    const running = state.running && String(item.id) === runningId
    const flipped = state.libraryFlippedIds.has(String(item.id))
    const description = item.descricao || "Automacao pronta para este Agent."
    const lastExecution = item.ultima_execucao ? formatDateTime(item.ultima_execucao) : "Nunca executada"
    const updatedAt = formatDateTime(item.atualizado_em)
    const createdAt = formatDateTime(item.criado_em)
    return `
      <article class="automation-library-card control-library-card ${selected ? "is-active" : ""} ${flipped ? "is-flipped" : ""}" data-automation-id="${escapeHtml(item.id)}">
        <div class="automation-library-card-stage">
          <section class="automation-library-card-face automation-library-card-front">
            <div class="automation-library-top">
              <div>
                <p class="agent-panel-kicker">${escapeHtml(item.categoria || "Remota")}</p>
                <h3>${escapeHtml(item.nome || "Automacao sem nome")}</h3>
              </div>
              <div class="automation-library-top-side">
                ${running ? '<span class="library-active-chip">Executando</span>' : selected ? '<span class="library-active-chip">Aberta</span>' : ""}
                <button class="launcher-flip-trigger" type="button" data-action="flip" data-id="${escapeHtml(item.id)}">Virar</button>
              </div>
            </div>

            <div class="automation-library-front-summary">
              <p class="automation-library-description">${escapeHtml(description)}</p>
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
                <span class="automation-library-front-note">Atualizada: ${escapeHtml(updatedAt)}</span>
                <span class="automation-library-front-note">Ultima: ${escapeHtml(lastExecution)}</span>
              </div>
            </div>

            <div class="automation-library-actions">
              <button class="agent-secondary-button" type="button" data-action="select" data-id="${escapeHtml(item.id)}">Abrir</button>
              <button
                class="agent-primary-button"
                type="button"
                data-action="run"
                data-id="${escapeHtml(item.id)}"
                ${(!state.connected || (state.running && !running)) ? "disabled" : ""}
              >
                ${running ? "Em execucao" : "Iniciar"}
              </button>
              <button class="agent-ghost-button" type="button" data-action="delete" data-id="${escapeHtml(item.id)}" ${running ? "disabled" : ""}>Excluir</button>
              <button class="agent-ghost-button" type="button" data-action="flip" data-id="${escapeHtml(item.id)}">Detalhes</button>
            </div>
          </section>

          <section class="automation-library-card-face automation-library-card-back">
            <div class="automation-library-back-top">
              <div>
                <p class="agent-panel-kicker">${escapeHtml(item.categoria || "Remota")}</p>
                <h3 class="automation-library-back-title">${escapeHtml(item.nome || "Automacao sem nome")}</h3>
              </div>
              <div class="automation-library-top-side">
                ${running ? '<span class="library-active-chip">Executando</span>' : selected ? '<span class="library-active-chip">Aberta</span>' : ""}
                <button class="launcher-flip-trigger" type="button" data-action="unflip" data-id="${escapeHtml(item.id)}">Voltar</button>
              </div>
            </div>

            <p class="automation-library-description-full">${escapeHtml(description)}</p>

            <div class="automation-library-back-body">
              <div class="automation-library-back-grid">
                <span>
                  <small>Criada em</small>
                  <strong>${escapeHtml(createdAt)}</strong>
                </span>
                <span>
                  <small>Atualizada em</small>
                  <strong>${escapeHtml(updatedAt)}</strong>
                </span>
                <span>
                  <small>Ultima execucao</small>
                  <strong>${escapeHtml(lastExecution)}</strong>
                </span>
                <span>
                  <small>Categoria</small>
                  <strong>${escapeHtml(item.categoria || "Remota")}</strong>
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
                  <strong>${running ? "Executando" : selected ? "Aberta" : "Disponivel"}</strong>
                </span>
              </div>
              <div class="automation-library-id">ID: ${escapeHtml(item.id)}</div>
            </div>

            <div class="automation-library-actions">
              <button class="agent-secondary-button" type="button" data-action="select" data-id="${escapeHtml(item.id)}">Abrir</button>
              <button
                class="agent-primary-button"
                type="button"
                data-action="run"
                data-id="${escapeHtml(item.id)}"
                ${(!state.connected || (state.running && !running)) ? "disabled" : ""}
              >
                ${running ? "Em execucao" : "Iniciar"}
              </button>
              <button class="agent-ghost-button" type="button" data-action="delete" data-id="${escapeHtml(item.id)}" ${running ? "disabled" : ""}>Excluir</button>
            </div>
          </section>
        </div>
      </article>
    `
  }).join("")
}

function renderPageChips() {
  if (!state.roadmap?.events?.length) {
    elements.pageChipList.innerHTML = ""
    return
  }

  elements.pageChipList.innerHTML = getBrowsablePages(state.roadmap)
    .map((page) => {
      const isActive = normalizeSequenceName(page.sequence) === normalizeSequenceName(state.currentSequence)
      const mode = getSequenceExecutionSettings(page.sequence, state.roadmap).executionMode
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
      `
    })
    .join("")
}

function resolvePreviewTargets() {
  const pages = getBrowsablePages(state.roadmap)
  if (!pages.length) {
    return { previous: null, next: null }
  }

  let pageIndex = pages.findIndex((page) => normalizeSequenceName(page.sequence) === normalizeSequenceName(state.currentSequence))
  if (pageIndex < 0) {
    pageIndex = 0
  }

  const currentPage = pages[pageIndex]
  const currentEvents = getSequenceEvents(currentPage.sequence)
  if (!currentEvents.length) {
    return { previous: null, next: null }
  }

  let eventIndex = currentEvents.findIndex((event) => Number(event.order) === Number(state.currentOrder))
  if (eventIndex < 0) {
    eventIndex = 0
  }

  let previous = null
  let next = null

  if (eventIndex > 0) {
    previous = {
      sequence: currentPage.sequence,
      order: currentEvents[eventIndex - 1].order,
    }
  } else if (pageIndex > 0) {
    const previousPage = pages[pageIndex - 1]
    const previousEvents = getSequenceEvents(previousPage.sequence)
    const previousEvent = previousEvents[previousEvents.length - 1]
    if (previousEvent) {
      previous = {
        sequence: previousPage.sequence,
        order: previousEvent.order,
      }
    }
  }

  if (eventIndex < currentEvents.length - 1) {
    next = {
      sequence: currentPage.sequence,
      order: currentEvents[eventIndex + 1].order,
    }
  } else if (pageIndex < pages.length - 1) {
    const nextPage = pages[pageIndex + 1]
    const nextEvent = getSequenceEvents(nextPage.sequence)[0]
    if (nextEvent) {
      next = {
        sequence: nextPage.sequence,
        order: nextEvent.order,
      }
    }
  }

  return { previous, next }
}

function applyPreviewTarget(target) {
  if (!target) {
    return
  }

  state.currentSequence = normalizeSequenceName(target.sequence || state.currentSequence)
  state.currentOrder = Number(target.order || state.currentOrder || 0) || state.currentOrder
  state.detailOpenOrder = null
  renderPageChips()
  renderAssistMap()
  renderProgress()
}

function renderPreviewToolbar() {
  const { previous, next } = resolvePreviewTargets()
  elements.previewPrevButton.disabled = state.running || !previous
  elements.previewNextButton.disabled = state.running || !next
}

function centerCurrentCard(order, behavior = "smooth") {
  if (!elements.assistMapList || order == null) {
    return
  }
  const target = elements.assistMapList.querySelector(`[data-assist-order="${Number(order)}"]`)
  if (!target) {
    return
  }
  const containerRect = elements.assistMapList.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  const currentScrollLeft = elements.assistMapList.scrollLeft
  const delta = (targetRect.left + targetRect.width / 2) - (containerRect.left + containerRect.width / 2)
  const left = Math.max(0, currentScrollLeft + delta)
  elements.assistMapList.scrollTo({ left, behavior })
}

function renderAssistMap() {
  syncTheme()
  const visibleEvents = currentVisibleEvents()
  const savedDetailScrollTop = Number(state.detailScrollTop || 0)
  if (!visibleEvents.length) {
    state.detailOpenOrder = null
    state.detailScrollTop = 0
    elements.assistMapList.classList.remove("has-detail-open")
    renderPreviewToolbar()
    elements.assistMapList.innerHTML = `<div class="agent-empty-map">Conecte no Agent e abra uma automacao para ver os blocos aqui.</div>`
    return
  }

  const hasKnownCurrentOrder = visibleEvents.some((event) => Number(event.order) === Number(state.currentOrder))
  if (!hasKnownCurrentOrder) {
    state.currentOrder = visibleEvents[0]?.order ?? null
  }
  if (!visibleEvents.some((event) => Number(event.order) === Number(state.detailOpenOrder))) {
    state.detailOpenOrder = null
  }

  const activeIndex = visibleEvents.findIndex((event) => Number(event.order) === Number(state.currentOrder))
  const hasProgress = activeIndex >= 0 && (state.running || Number(state.progress.percent || 0) > 0)
  const leadingSpacer = `<div class="agent-assist-edge-spacer is-start" aria-hidden="true"></div>`
  const trailingSpacer = `<div class="agent-assist-edge-spacer is-end" aria-hidden="true"></div>`

  const markup = visibleEvents
    .map((event, index) => {
      const isDone = hasProgress && index < activeIndex
      const isCurrent = activeIndex >= 0 ? index === activeIndex : index === 0
      const stateClass = isCurrent ? "is-current" : isDone ? "is-done" : "is-upcoming"
      const flipClass = Number(state.detailOpenOrder) === Number(event.order) ? "is-flipped" : ""
      const connectorClass =
        hasProgress && index < activeIndex
          ? "is-done"
          : hasProgress && index === activeIndex - 1
            ? "is-current"
            : "is-upcoming"

      const card = `
        <article class="control-assist-card ${stateClass} ${flipClass}" data-assist-order="${Number(event.order)}">
          <div class="control-assist-card-flip">
            ${renderAssistCardFace(event, event.order, false)}
            ${renderAssistCardFace(event, event.order, true)}
          </div>
        </article>
      `

      if (index === visibleEvents.length - 1) {
        return `${card}<div class="control-assist-end ${!state.running && Number(state.progress.percent || 0) >= 100 ? "is-done" : ""}">Fim</div>`
      }

      return `
        ${card}
        <div class="control-assist-connector ${connectorClass}">
          <span></span>
        </div>
      `
    })
    .join("")

  elements.assistMapList.classList.toggle("has-detail-open", Boolean(state.detailOpenOrder))
  elements.assistMapList.innerHTML = `<div class="agent-assist-flow-row ${state.detailOpenOrder ? "has-detail-open" : ""}">${leadingSpacer}${markup}${trailingSpacer}</div>`
  renderPreviewToolbar()
  requestAnimationFrame(() => {
    centerCurrentCard(state.currentOrder, state.running || state.detailOpenOrder ? "smooth" : "auto")
    if (state.detailOpenOrder) {
      const detailBox = elements.assistMapList.querySelector(".control-assist-card.is-flipped .agent-assist-detail-list")
      if (detailBox) {
        detailBox.scrollTop = savedDetailScrollTop
      }
    }
  })
}

function renderLogs() {
  if (!state.logs.length) {
    elements.logList.innerHTML = `
      <article class="agent-log-entry is-info">
        <strong>Pronto</strong>
        <p>${escapeHtml(state.connected ? "Os logs remotos vao aparecer aqui em tempo real." : "Conecte no FlowDetect Agent para carregar os logs.")}</p>
      </article>
    `
    return
  }

  elements.logList.innerHTML = state.logs
    .map((message, index) => `
      <article class="agent-log-entry is-${escapeHtml(resolveLogTone(message))}">
        <strong>${index === 0 ? "Atual" : "Execucao"}</strong>
        <p>${escapeHtml(message)}</p>
      </article>
    `)
    .join("")
}

function renderProgress() {
  const percent = Math.max(0, Math.min(100, Number(state.progress.percent || 0)))
  elements.progressTitle.textContent = state.progress.title
  elements.progressPercent.textContent = `${Math.round(percent)}%`
  elements.progressFill.style.width = `${percent}%`
  elements.progressDescription.textContent = state.progress.description

  const currentPage = getPageDefinition(state.currentSequence)
  elements.currentCompanyText.textContent = state.progress.company || "-"
  elements.currentPageText.textContent = currentPage?.label || "Pagina 1"
  elements.currentBlockText.textContent = currentBlockEvent()?.title || "Aguardando execucao"
}

function updateButtons() {
  const hasAutomation = Boolean(selectedAutomation())
  elements.runAutomationButton.disabled = !state.connected || !hasAutomation || state.running
  elements.stopAutomationButton.disabled = !state.connected || !state.running
  elements.importZipButton.disabled = !state.connected || state.running || state.importingZip
}

function applyProgressPosition(payload = {}) {
  const sequence = String(payload.sequence || "").trim()
  const order = Number(payload.order || 0)

  if (sequence) {
    state.currentSequence = normalizeSequenceName(sequence)
  }

  if (order > 0) {
    state.currentOrder = order
    const event = getEventByOrder(order)
    if (event?.sequence) {
      state.currentSequence = normalizeSequenceName(event.sequence)
    }
  } else if (sequence) {
    const firstOrder = firstOrderForSequence(sequence)
    if (firstOrder != null) {
      state.currentOrder = firstOrder
    }
  }
}

function applyStatusPayload(payload = {}) {
  const snapshot = payload?.snapshot || {}
  const progress = snapshot.progress || {}
  const runningId = String(snapshot.automation_id || snapshot.automationId || "").trim()
  const wasRunning = state.running

  if (runningId && state.library.some((item) => String(item.id) === runningId)) {
    state.selectedAutomationId = runningId
  }

  state.running = Boolean(snapshot.running)
  state.targetTitle = String(snapshot.target_title || snapshot.targetTitle || "").trim()
  state.logs = Array.isArray(snapshot.logs) ? snapshot.logs.map((entry) => String(entry || "")).filter(Boolean) : []

  if ((state.running || wasRunning) && (progress.sequence || progress.order)) {
    applyProgressPosition(progress)
  }

  const selectedName = selectedAutomation()?.nome || snapshot.automation_name || "automacao"
  state.progress = {
    percent: Number(progress.percent || 0),
    title: state.running
      ? `Executando ${selectedName}`
      : Number(progress.percent || 0) >= 100
        ? "Ultima execucao concluida"
        : "Pronto para iniciar",
    description: String(
      progress.description
      || (state.running
        ? "A automacao remota esta em andamento."
        : "Selecione uma automacao e clique em executar.")
    ),
    company: String(progress.company || ""),
  }

  if (state.running) {
    showHint(state.progress.description)
    setStatusChip("Executando", "running")
  } else if (Number(progress.percent || 0) >= 100) {
    showHint("A ultima execucao foi concluida no Agent.")
    setStatusChip("Concluida", "idle")
  } else if (state.connected) {
    showHint("Escolha uma automacao no card e clique em executar.")
    setStatusChip("Pronto", "idle")
  }

  renderConnection()
  renderSelection()
  renderLibrary()
  renderPageChips()
  renderAssistMap()
  renderProgress()
  renderLogs()
  updateButtons()
}

function clearConnectionState(message) {
  state.connected = false
  state.agentLabel = "Aguardando conexao"
  state.library = []
  state.libraryFlippedIds.clear()
  state.selectedAutomationId = ""
  state.roadmap = null
  state.running = false
  state.currentSequence = "principal"
  state.currentOrder = null
  state.detailOpenOrder = null
  state.detailScrollTop = 0
  state.importingZip = false
  state.imagePreviewCache = {}
  state.imagePreviewLoading = {}
  state.targetTitle = ""
  state.logs = []
  state.progress = {
    percent: 0,
    title: "Aguardando execucao",
    description: "Conecte no Agent para carregar as automacoes remotas.",
    company: "",
  }
  if (message) {
    showHint(message)
  }
  setStatusChip("Desconectado", "error")
  renderConnection()
  renderSelection()
  renderLibrary()
  renderPageChips()
  renderAssistMap()
  renderProgress()
  renderLogs()
  updateButtons()
}

async function loadAutomationRoadmap(id, options = {}) {
  const normalizedId = String(id || "").trim()
  if (!normalizedId) {
    state.roadmap = null
    state.selectedAutomationId = ""
    state.currentSequence = "principal"
    state.currentOrder = null
    state.detailOpenOrder = null
    state.detailScrollTop = 0
    state.imagePreviewCache = {}
    state.imagePreviewLoading = {}
    renderSelection()
    renderPageChips()
    renderAssistMap()
    renderProgress()
    updateButtons()
    return null
  }

  const roadmap = await invoke("remote_agent_open_automation", {
    address: state.address,
    id: normalizedId,
  })

  state.selectedAutomationId = normalizedId
  state.roadmap = roadmap
  state.currentSequence = resolveRoadmapInitialSequence(roadmap)
  state.currentOrder = firstOrderForSequence(state.currentSequence) ?? roadmap?.events?.[0]?.order ?? null
  state.detailOpenOrder = null
  state.detailScrollTop = 0
  state.imagePreviewCache = {}
  state.imagePreviewLoading = {}

  if (options.progressPayload) {
    applyProgressPosition(options.progressPayload)
  }

  renderSelection()
  renderLibrary()
  renderPageChips()
  renderAssistMap()
  renderProgress()
  updateButtons()

  return roadmap
}

async function refreshLibrary(options = {}) {
  const result = await invoke("remote_agent_list_automations", { address: state.address })
  state.library = Array.isArray(result?.items) ? result.items : []
  const knownIds = new Set(state.library.map((item) => String(item.id)))
  state.libraryFlippedIds.forEach((id) => {
    if (!knownIds.has(String(id))) {
      state.libraryFlippedIds.delete(id)
    }
  })

  if (!state.library.length) {
    await loadAutomationRoadmap("", { silent: true })
    renderConnection()
    renderLibrary()
    return
  }

  const preferredId = String(
    options.preferredId
    || state.selectedAutomationId
    || state.library[0]?.id
    || ""
  )

  renderConnection()
  renderLibrary()

  if (preferredId) {
    await loadAutomationRoadmap(preferredId, {
      progressPayload: options.progressPayload,
    })
  }
}

async function refreshStatus(options = {}) {
  if (!state.connected) {
    return
  }
  if (state.statusRefreshing) {
    return
  }

  state.statusRefreshing = true
  try {
    const result = await invoke("remote_agent_status", { address: state.address })
    const snapshot = result?.snapshot || {}
    const runningId = String(snapshot.automation_id || snapshot.automationId || "").trim()

    if (runningId && String(state.selectedAutomationId) !== runningId) {
      await loadAutomationRoadmap(runningId, { progressPayload: snapshot.progress })
    } else if (!state.roadmap && state.selectedAutomationId) {
      await loadAutomationRoadmap(state.selectedAutomationId, { progressPayload: snapshot.progress })
    }

    applyStatusPayload(result)
  } catch (error) {
    clearConnectionState(String(error))
    if (!options.silent) {
      throw error
    }
  } finally {
    state.statusRefreshing = false
  }
}

function startPolling() {
  if (state.pollTimer) {
    window.clearInterval(state.pollTimer)
  }
  state.pollTimer = window.setInterval(() => {
    refreshStatus({ silent: true }).catch(() => {})
  }, 1800)
}

async function connectToAgent() {
  const rawAddress = String(elements.agentAddressInput.value || "").trim()
  state.address = rawAddress || "127.0.0.1:18452"
  elements.agentAddressInput.value = state.address

  const ping = await invoke("remote_agent_ping", { address: state.address })
  state.connected = true
  state.agentLabel = `${ping?.agent || "FlowDetect Agent"} | porta ${ping?.port || 18452}`
  showHint(`Conectado em ${state.address}.`)
  setStatusChip("Pronto", "idle")

  await refreshLibrary()
  await refreshStatus({ silent: true })
  startPolling()
}

async function runAutomation(id = "") {
  const targetId = String(id || state.selectedAutomationId || "").trim()
  if (!targetId) {
    throw new Error("Selecione uma automacao antes de executar.")
  }

  if (!state.roadmap || String(state.selectedAutomationId) !== targetId) {
    await loadAutomationRoadmap(targetId)
  }

  const result = await invoke("remote_agent_execute", {
    address: state.address,
    id: targetId,
    delay: 3,
    loopStart: 1,
  })

  applyStatusPayload(result)
}

async function stopAutomation() {
  const result = await invoke("remote_agent_stop", { address: state.address })
  applyStatusPayload(result)
}

async function importAutomationZipToAgent(file) {
  if (!file) {
    return
  }

  if (!state.connected) {
    throw new Error("Conecte no Agent antes de importar um ZIP.")
  }

  if (state.running) {
    throw new Error("Pare a automacao atual antes de importar outro projeto.")
  }

  if (!String(file.name || "").toLowerCase().endsWith(".zip")) {
    throw new Error("Selecione um arquivo .zip de automacao.")
  }

  state.importingZip = true
  updateButtons()
  showHint(`Enviando ${file.name} para o Agent...`)
  setStatusChip("Importando", "running")

  try {
    const bytes = Array.from(new Uint8Array(await file.arrayBuffer()))
    const result = await invoke("remote_agent_import_automation_zip", {
      address: state.address,
      fileName: file.name,
      bytes,
    })
    const importedId = String(result?.imported_bundle?.imported_id || result?.active_automation?.id || "").trim()
    await refreshLibrary({ preferredId: importedId || undefined })
    await refreshStatus({ silent: true })
    setControlView("automation")
    showHint(`Projeto "${result?.active_automation?.nome || file.name}" enviado ao Agent.`)
    setStatusChip("Pronto", "idle")
  } finally {
    state.importingZip = false
    elements.importZipInput.value = ""
    updateButtons()
  }
}

async function deleteAutomationOnAgent(id) {
  const normalizedId = String(id || "").trim()
  if (!normalizedId) {
    return
  }
  const automation = state.library.find((item) => String(item.id) === normalizedId)
  const name = automation?.nome || "esta automacao"
  if (state.running && String(state.selectedAutomationId) === normalizedId) {
    throw new Error("Pare a automacao antes de excluir.")
  }
  if (!window.confirm(`Excluir "${name}" do Agent conectado?`)) {
    return
  }
  await invoke("remote_agent_delete_automation", {
    address: state.address,
    id: normalizedId,
  })
  if (String(state.selectedAutomationId) === normalizedId) {
    state.selectedAutomationId = ""
    state.roadmap = null
    state.currentOrder = null
    state.detailOpenOrder = null
    state.imagePreviewCache = {}
    state.imagePreviewLoading = {}
  }
  state.libraryFlippedIds.delete(normalizedId)
  await refreshLibrary()
  await refreshStatus({ silent: true })
  showHint(`Automacao "${name}" excluida do Agent.`)
}

async function handleLibraryClick(event) {
  const button = event.target.closest("[data-action]")
  if (!button) {
    return
  }

  const action = button.dataset.action || ""
  const id = String(button.dataset.id || "")

  if (action === "flip" || action === "unflip") {
    if (action === "flip") {
      state.libraryFlippedIds.add(id)
    } else {
      state.libraryFlippedIds.delete(id)
    }
    renderLibrary()
    return
  }

  if (action === "select") {
    await loadAutomationRoadmap(id)
    state.libraryFlippedIds.delete(id)
    setControlView("automation")
    if (state.connected && !state.running) {
      showHint("Automacao aberta. Clique em executar quando quiser iniciar no Agent.")
    }
    return
  }

  if (action === "run") {
    setControlView("automation")
    await runAutomation(id)
    return
  }

  if (action === "delete") {
    await deleteAutomationOnAgent(id)
  }
}

function handlePageChipClick(event) {
  const button = event.target.closest("[data-sequence]")
  if (!button || state.running) {
    return
  }

  const sequence = normalizeSequenceName(button.dataset.sequence || "principal")
  state.currentSequence = sequence
  state.detailOpenOrder = null
  state.detailScrollTop = 0
  if (!getSequenceEvents(sequence).some((entry) => Number(entry.order) === Number(state.currentOrder))) {
    state.currentOrder = firstOrderForSequence(sequence)
  }
  renderPageChips()
  renderAssistMap()
  renderProgress()
}

function handleAssistDetailClick(button) {
  if (state.running) {
    return
  }

  const order = Number(button.dataset.assistOrder || 0)
  if (!order) {
    return
  }

  const action = String(button.dataset.detailAction || "")
  const assistEvent = getEventByOrder(order)
  if (!assistEvent) {
    return
  }

  state.currentSequence = normalizeSequenceName(assistEvent.sequence || state.currentSequence)
  state.currentOrder = order

  if (action === "close") {
    closeAssistDetailDom(order)
    state.detailOpenOrder = null
    state.detailScrollTop = 0
    syncAssistDetailContainer()
    renderPageChips()
    renderProgress()
    renderPreviewToolbar()
    return
  }

  if (state.detailOpenOrder && Number(state.detailOpenOrder) !== order) {
    closeAssistDetailDom(state.detailOpenOrder)
  }
  state.detailOpenOrder = order
  state.detailScrollTop = 0
  openAssistDetailDom(order)
  syncAssistDetailContainer()
  renderPageChips()
  renderProgress()
  renderPreviewToolbar()
  centerCurrentCard(order, "smooth")

  if (assistEvent.type === "clicar_imagem") {
    void ensureRecognitionPreview(assistEvent)
  }
}

function handleAssistMapClick(event) {
  const detailButton = event.target.closest("[data-detail-action]")
  if (detailButton) {
    handleAssistDetailClick(detailButton)
    return
  }

  const card = event.target.closest("[data-assist-order]")
  if (!card || state.running) {
    return
  }

  const order = Number(card.dataset.assistOrder || 0)
  if (!order) {
    return
  }
  if (Number(state.detailOpenOrder) === order) {
    return
  }

  const assistEvent = getEventByOrder(order)
  applyPreviewTarget({
    sequence: assistEvent?.sequence || state.currentSequence,
    order,
  })
}

function movePreview(step) {
  if (state.running) {
    return
  }

  const targets = resolvePreviewTargets()
  state.detailScrollTop = 0
  applyPreviewTarget(step < 0 ? targets.previous : targets.next)
}

function handleAssistMapKeydown(event) {
  if (state.running) {
    return
  }

  if (event.key === "ArrowLeft") {
    event.preventDefault()
    movePreview(-1)
  } else if (event.key === "ArrowRight") {
    event.preventDefault()
    movePreview(1)
  }
}

function handleAssistDetailWheel(event) {
  const scrollBox = event.target.closest(".agent-assist-detail-list")
  if (!scrollBox || state.running) {
    return
  }

  if (scrollBox.scrollHeight <= scrollBox.clientHeight) {
    return
  }

  const canScrollUp = scrollBox.scrollTop > 0
  const canScrollDown = scrollBox.scrollTop + scrollBox.clientHeight < scrollBox.scrollHeight - 1

  if ((event.deltaY < 0 && canScrollUp) || (event.deltaY > 0 && canScrollDown)) {
    event.stopPropagation()
    return
  }

  state.detailScrollTop = scrollBox.scrollTop
  event.stopPropagation()
  event.preventDefault()
}

function handleAssistDetailScroll(event) {
  const scrollBox = event.target.closest(".agent-assist-detail-list")
  if (!scrollBox) {
    return
  }
  state.detailScrollTop = scrollBox.scrollTop
}

function registerEvents() {
  elements.connectButton.addEventListener("click", async () => {
    try {
      await connectToAgent()
    } catch (error) {
      clearConnectionState(String(error))
    }
  })

  elements.refreshButton.addEventListener("click", async () => {
    if (!state.connected) {
      return
    }
    try {
      await refreshLibrary()
      await refreshStatus({ silent: true })
    } catch (error) {
      clearConnectionState(String(error))
    }
  })

  elements.runAutomationButton.addEventListener("click", async () => {
    try {
      await runAutomation()
    } catch (error) {
      showHint(String(error))
    }
  })

  elements.stopAutomationButton.addEventListener("click", async () => {
    try {
      await stopAutomation()
    } catch (error) {
      showHint(String(error))
    }
  })

  elements.viewTabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setControlView(button.dataset.controlView || "automation")
    })
  })

  elements.importZipButton.addEventListener("click", () => {
    if (state.connected && !state.running && !state.importingZip) {
      elements.importZipInput.click()
    }
  })

  elements.importZipInput.addEventListener("change", async () => {
    const file = elements.importZipInput.files?.[0]
    try {
      await importAutomationZipToAgent(file)
    } catch (error) {
      elements.importZipInput.value = ""
      state.importingZip = false
      updateButtons()
      showHint(String(error))
      setStatusChip(state.connected ? "Pronto" : "Desconectado", state.connected ? "idle" : "error")
    }
  })

  elements.automationList.addEventListener("click", (event) => {
    handleLibraryClick(event).catch((error) => {
      showHint(String(error))
    })
  })

  elements.pageChipList.addEventListener("click", handlePageChipClick)
  elements.assistMapList.addEventListener("click", handleAssistMapClick)
  elements.assistMapList.addEventListener("keydown", handleAssistMapKeydown)
  elements.assistMapList.addEventListener("wheel", handleAssistDetailWheel, { passive: false })
  elements.assistMapList.addEventListener("scroll", handleAssistDetailScroll, true)
  elements.previewPrevButton.addEventListener("click", () => movePreview(-1))
  elements.previewNextButton.addEventListener("click", () => movePreview(1))
}

function renderAll() {
  setControlView(state.activeView)
  renderConnection()
  renderSelection()
  renderLibrary()
  renderPageChips()
  renderAssistMap()
  renderProgress()
  renderLogs()
  updateButtons()
}

async function init() {
  renderAll()
  registerEvents()
  try {
    await connectToAgent()
  } catch (error) {
    clearConnectionState(`Nao foi possivel conectar automaticamente: ${String(error)}`)
  }
}

init().catch((error) => {
  clearConnectionState(String(error))
})

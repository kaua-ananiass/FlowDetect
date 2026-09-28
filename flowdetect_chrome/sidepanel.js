const AUTOMATIONS_KEY = "flowdetectChromeAutomations";
const RUN_STORAGE_KEY = "flowdetectChromeLastRun";
const REQUIRED_RUNTIME_VERSION = "0.2.46";
const automationList = document.querySelector("#automationList");
const automationTemplate = document.querySelector("#automationTemplate");
const importInput = document.querySelector("#importInput");
const newButton = document.querySelector("#newButton");
let automationsCache = [];
let currentRun = {};
const screenGuardRefreshers = new Set();

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
  currentRun = {
    automationId: automation.id,
    automationName: automation.automation?.nome,
    status: "running",
    currentStep: 0,
    totalSteps: loop ? automation.steps.length * (loop.total - selectedStartRow + 1) : automation.steps.length,
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
  if (isCurrent) {
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
    const reportButton = fragment.querySelector(".report-button");
    const canGenerateReport = hasFinishedRun(status);
    reportButton.hidden = !canGenerateReport;
    if (canGenerateReport) {
      reportButton.textContent = currentRun.reportGeneratedAt ? "Gerar novo relatório PDF" : "Gerar relatório PDF";
      reportButton.addEventListener("click", () => downloadExecutionReport(currentRun).catch((error) => {
        window.alert(`Nao foi possivel gerar o relatorio: ${String(error.message || error)}`);
      }));
    }
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

const AUTOMATIONS_KEY = "flowdetectChromeAutomations";
const RUN_STORAGE_KEY = "flowdetectChromeLastRun";
const REQUIRED_RUNTIME_VERSION = "0.2.21";
const automationList = document.querySelector("#automationList");
const automationTemplate = document.querySelector("#automationTemplate");
const importInput = document.querySelector("#importInput");
const newButton = document.querySelector("#newButton");
let automationsCache = [];
let currentRun = {};

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
  return {
    total,
    completed,
    percent: total ? Math.min(100, Math.round((completed / total) * 100)) : 0
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

function spreadsheetLoopInfo(automation) {
  const source = (automation?.steps || []).find((step) => (
    step?.type === "data_source" && Array.isArray(step.values) && step.values.length
  ));
  if (!source) return null;
  return {
    name: String(source.name || "valor"),
    total: source.values.length,
    values: source.values.map((value) => String(value ?? ""))
  };
}

function clampSpreadsheetStartRow(value, total) {
  const parsed = Math.trunc(Number(value));
  return Math.min(Math.max(1, Number.isFinite(parsed) ? parsed : 1), Math.max(1, Number(total) || 1));
}

async function runAutomation(automation, startRow = 1) {
  if (!await ensureCurrentRuntime()) return;
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) throw new Error("Abra a pagina onde deseja executar a automacao.");
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
  if (response?.run) updateRun(response.run);
  if (!response?.ok) throw new Error(response?.run?.logs?.at(-1)?.message || response?.error || "A automacao falhou.");
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
  if (isCurrent && currentRun?.status === "running") {
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
  const loop = spreadsheetLoopInfo(automation);
  const loopStart = fragment.querySelector(".loop-start");
  const loopStartChoice = fragment.querySelector(".loop-start-choice");
  if (loop) {
    loopStart.hidden = false;
    loopStartChoice.replaceChildren(...loop.values.map((value, index) => {
      const option = document.createElement("option");
      option.value = String(index + 1);
      option.textContent = `${index + 1} · ${value || "(vazio)"}`;
      return option;
    }));
    const atualizarResumoLoop = () => {
      const startRow = clampSpreadsheetStartRow(loopStartChoice.value, loop.total);
      loopStartChoice.value = String(startRow);
      fragment.querySelector(".loop-start-summary").textContent = `Loop ${loop.name}: ${loop.total} itens`;
    };
    loopStartChoice.addEventListener("change", atualizarResumoLoop);
    atualizarResumoLoop();
  }

  const isCurrent = String(currentRun?.automationId || "") === String(automation.id);
  if (isCurrent) {
    const status = currentRun.status || "ready";
    const labels = { ready: "Pronto", running: "Executando", completed: "Concluida", failed: "Falhou", stopped: "Parada" };
    const progress = runProgress(currentRun);
    card.classList.add("is-active");
    const execution = fragment.querySelector(".execution");
    execution.hidden = false;
    const statusElement = fragment.querySelector(".execution-status");
    statusElement.textContent = labels[status] || status;
    statusElement.className = `execution-status ${status}`;
    fragment.querySelector(".execution-percent").textContent = `${progress.percent}%`;
    fragment.querySelector(".execution-summary").textContent = progress.total
      ? `${progress.completed} de ${progress.total} blocos`
      : "Preparando execucao";
    fragment.querySelector(".progress-bar").style.width = `${progress.percent}%`;
    const stop = fragment.querySelector(".stop-button");
    stop.hidden = status !== "running";
    stop.addEventListener("click", () => chrome.runtime.sendMessage({ type: "flowdetect-stop" }));
    const reportButton = fragment.querySelector(".report-button");
    const canGenerateReport = hasFinishedRun(status);
    reportButton.hidden = !canGenerateReport;
    if (canGenerateReport) {
      reportButton.textContent = currentRun.reportGeneratedAt ? "Gerar novo relatorio PDF" : "Gerar relatorio PDF";
      reportButton.addEventListener("click", () => downloadExecutionReport(currentRun).catch((error) => {
        window.alert(`Nao foi possivel gerar o relatorio: ${String(error.message || error)}`);
      }));
    }
    appendLogs(fragment.querySelector(".run-log"), currentRun.logs);
  }

  fragment.querySelector(".run-automation").addEventListener("click", () => {
    const startRow = loop ? clampSpreadsheetStartRow(loopStartChoice.value, loop.total) : 1;
    return runAutomation(automation, startRow).catch((error) => {
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
}

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

Promise.all([getAutomations(), chrome.storage.local.get(RUN_STORAGE_KEY)])
  .then(([automations, storage]) => {
    automationsCache = automations;
    currentRun = storage[RUN_STORAGE_KEY] || {};
    renderAutomations();
  });

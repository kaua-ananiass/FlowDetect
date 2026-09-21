const AUTOMATIONS_KEY = "flowdetectChromeAutomations";
const RUN_STORAGE_KEY = "flowdetectChromeLastRun";
const REQUIRED_RUNTIME_VERSION = "0.2.10";
const automationList = document.querySelector("#automationList");
const automationTemplate = document.querySelector("#automationTemplate");
const importInput = document.querySelector("#importInput");
const newButton = document.querySelector("#newButton");
const stopButton = document.querySelector("#stopButton");
const captureButton = document.querySelector("#captureButton");
const runTitle = document.querySelector("#runTitle");
const runStatus = document.querySelector("#runStatus");
const runProgress = document.querySelector("#runProgress");
const progressBar = document.querySelector("#progressBar");
const runLog = document.querySelector("#runLog");
const tabPreview = document.querySelector("#tabPreview");
const activeTabName = document.querySelector("#activeTabName");
const automationCount = document.querySelector("#automationCount");
const ocrCount = document.querySelector("#ocrCount");
const visualCount = document.querySelector("#visualCount");
const libraryCount = document.querySelector("#libraryCount");

const STEP_META = {
  navigate: { label: "URL", kind: "action" },
  element_action: { label: "Elemento", kind: "action" },
  focused_text: { label: "Texto", kind: "action" },
  key_sequence: { label: "Tecla", kind: "action" },
  viewport_click: { label: "Clique", kind: "action" },
  ocr_text: { label: "OCR", kind: "ocr" },
  visual_match: { label: "Visual", kind: "visual" },
  visual_state: { label: "Estado visual", kind: "visual" },
  data_source: { label: "Planilha", kind: "action" },
  loop_start: { label: "Loop", kind: "action" },
  loop_end: { label: "Fim loop", kind: "action" },
  wait_text: { label: "OCR", kind: "ocr" }
};

const getAutomations = async () => (await chrome.storage.local.get(AUTOMATIONS_KEY))[AUTOMATIONS_KEY] || [];
const setAutomations = async (automations) => chrome.storage.local.set({ [AUTOMATIONS_KEY]: automations });
const fileName = (name) => String(name || "Automacao_Chrome").replace(/[<>:"/\\|?*]+/g, "_").trim() || "Automacao_Chrome";

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

function downloadAutomation(automation) {
  const payload = { ...automation };
  delete payload.id;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName(automation.automation?.nome)}_Chrome.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) throw new Error("Abra a página onde deseja executar a automação.");
  return tab;
}

async function refreshActiveTab() {
  try {
    const tab = await getActiveTab();
    activeTabName.textContent = tab.title || tab.url || "Página sem título";
    activeTabName.title = tab.url || "";
  } catch (_) {
    activeTabName.textContent = "Abra uma página HTTP ou HTTPS";
  }
}

async function ensureCurrentRuntime() {
  const runtime = await chrome.runtime.sendMessage({ type: "flowdetect-runtime-info" }).catch(() => null);
  if (runtime?.ok && runtime.version === REQUIRED_RUNTIME_VERSION) return true;
  runStatus.textContent = "Atualizando";
  runStatus.className = "status-chip running";
  runProgress.textContent = "Atualizando o motor da extensão para executar OCR e reconhecimento visual.";
  chrome.runtime.reload();
  return false;
}

async function runAutomation(automation) {
  if (!await ensureCurrentRuntime()) return;
  const tab = await getActiveTab();
  runTitle.textContent = automation.automation.nome;
  runStatus.textContent = "Executando";
  runStatus.className = "status-chip running";
  runProgress.textContent = "A automação foi iniciada na aba atual.";
  progressBar.style.width = "0%";
  const response = await chrome.runtime.sendMessage({ type: "flowdetect-start", automation, tabId: tab.id });
  if (response?.run) renderRun(response.run);
  if (!response?.ok) throw new Error(response?.run?.logs?.at(-1)?.message || response?.error || "A automação falhou.");
}

function renderRun(run = {}) {
  const status = run.status || "ready";
  const labels = { ready: "Pronto", running: "Executando", completed: "Concluída", failed: "Falhou", stopped: "Parada" };
  runTitle.textContent = run.automationName || "Pronto para executar";
  runStatus.textContent = labels[status] || status;
  runStatus.className = `status-chip ${status}`;
  const progress = run.totalSteps ? Math.min(100, Math.round((Number(run.currentStep || 0) / run.totalSteps) * 100)) : 0;
  progressBar.style.width = `${progress}%`;
  runProgress.textContent = run.totalSteps
    ? `${run.currentStep || 0} de ${run.totalSteps} blocos concluídos${run.lastMessage ? ` · ${run.lastMessage}` : "."}`
    : "Selecione uma automação e execute na aba aberta.";
  runLog.replaceChildren(...(run.logs || []).slice(-28).reverse().map((entry) => {
    const item = document.createElement("li");
    item.className = entry.level || "info";
    item.textContent = entry.message;
    return item;
  }));
}

function updateMetrics(automations) {
  const steps = automations.flatMap((automation) => automation.steps || []);
  automationCount.textContent = automations.length;
  ocrCount.textContent = steps.filter((step) => ["ocr_text", "wait_text"].includes(step.type)).length;
  visualCount.textContent = steps.filter((step) => ["visual_match", "visual_state"].includes(step.type)).length;
  libraryCount.textContent = automations.length;
}

function renderStepPreview(container, steps) {
  const counts = new Map();
  for (const step of steps) counts.set(step.type || "unknown", (counts.get(step.type || "unknown") || 0) + 1);
  const entries = [...counts.entries()];
  for (const [type, count] of entries.slice(0, 4)) {
    const meta = STEP_META[type] || { label: "Bloco", kind: "warning" };
    const chip = document.createElement("span");
    chip.className = `step-chip ${meta.kind}`;
    chip.innerHTML = `<b>${meta.label}</b> ${count}`;
    container.append(chip);
  }
  if (entries.length > 4) {
    const extra = document.createElement("span");
    extra.className = "step-chip";
    extra.textContent = `+${entries.length - 4}`;
    container.append(extra);
  }
}

function renderAutomations(automations) {
  updateMetrics(automations);
  automationList.replaceChildren();
  if (!automations.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Ainda não há automações. No Studio, use “Exportar para Chrome” e importe o arquivo aqui.";
    automationList.append(empty);
    return;
  }
  for (const [index, automation] of automations.entries()) {
    const fragment = automationTemplate.content.cloneNode(true);
    fragment.querySelector(".automation-index").textContent = String(index + 1).padStart(2, "0");
    fragment.querySelector(".automation-source").textContent = automation.automation?.source || "FLOWDETECT STUDIO";
    fragment.querySelector(".automation-name").textContent = automation.automation?.nome || "Automacao Chrome";
    fragment.querySelector(".automation-description").textContent = automation.automation?.descricao || "Pronta para executar na aba atual.";
    fragment.querySelector(".step-count").textContent = `${automation.steps.length} blocos`;
    renderStepPreview(fragment.querySelector(".step-preview"), automation.steps);
    const warning = fragment.querySelector(".automation-warning");
    if (automation.warnings?.length) {
      warning.hidden = false;
      warning.textContent = `${automation.warnings.length} aviso(s): alguns blocos precisam do Studio.`;
    }
    fragment.querySelector(".run-automation").addEventListener("click", () => runAutomation(automation).catch((error) => {
      runStatus.textContent = "Falhou";
      runStatus.className = "status-chip failed";
      runProgress.textContent = String(error.message || error);
    }));
    fragment.querySelector(".export-automation").addEventListener("click", () => downloadAutomation(automation));
    fragment.querySelector(".delete-automation").addEventListener("click", async () => {
      await setAutomations((await getAutomations()).filter((item) => item.id !== automation.id));
      renderAutomations(await getAutomations());
    });
    automationList.append(fragment);
  }
}

importInput.addEventListener("change", async () => {
  const file = importInput.files?.[0];
  importInput.value = "";
  if (!file) return;
  try {
    const imported = normalizeImportedAutomation(JSON.parse(await file.text()));
    await setAutomations([...(await getAutomations()), imported]);
    renderAutomations(await getAutomations());
  } catch (error) {
    window.alert(String(error.message || error));
  }
});

newButton.addEventListener("click", async () => {
  const nome = window.prompt("Nome da automação:", "Nova automação Chrome");
  if (!nome) return;
  const automation = normalizeImportedAutomation({
    schema: "flowdetect_chrome_automation",
    version: 3,
    automation: { nome, descricao: "Adicione blocos no FlowDetect Studio e exporte novamente.", source: "FlowDetect Chrome" },
    steps: [],
    warnings: []
  });
  await setAutomations([...(await getAutomations()), automation]);
  renderAutomations(await getAutomations());
});

stopButton.addEventListener("click", () => chrome.runtime.sendMessage({ type: "flowdetect-stop" }));
captureButton.addEventListener("click", async () => {
  try {
    const tab = await getActiveTab();
    const response = await chrome.runtime.sendMessage({ type: "flowdetect-capture-preview", tabId: tab.id });
    if (!response?.ok) throw new Error(response?.error || "Não foi possível capturar a aba.");
    tabPreview.src = response.dataUrl;
    tabPreview.hidden = false;
  } catch (error) {
    runProgress.textContent = String(error.message || error);
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[RUN_STORAGE_KEY]) renderRun(changes[RUN_STORAGE_KEY].newValue);
  if (area === "local" && changes[AUTOMATIONS_KEY]) renderAutomations(changes[AUTOMATIONS_KEY].newValue || []);
});
chrome.tabs.onActivated.addListener(refreshActiveTab);
chrome.tabs.onUpdated.addListener((_tabId, changes) => { if (changes.title || changes.url) refreshActiveTab(); });

Promise.all([getAutomations(), chrome.storage.local.get(RUN_STORAGE_KEY)])
  .then(([automations, storage]) => { renderAutomations(automations); renderRun(storage[RUN_STORAGE_KEY]); refreshActiveTab(); });

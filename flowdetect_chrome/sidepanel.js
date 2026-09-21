const AUTOMATIONS_KEY = "flowdetectChromeAutomations";
const RUN_STORAGE_KEY = "flowdetectChromeLastRun";
const automationList = document.querySelector("#automationList");
const automationTemplate = document.querySelector("#automationTemplate");
const importInput = document.querySelector("#importInput");
const newButton = document.querySelector("#newButton");
const stopButton = document.querySelector("#stopButton");
const captureButton = document.querySelector("#captureButton");
const runTitle = document.querySelector("#runTitle");
const runStatus = document.querySelector("#runStatus");
const runProgress = document.querySelector("#runProgress");
const runLog = document.querySelector("#runLog");
const tabPreview = document.querySelector("#tabPreview");

const getAutomations = async () => (await chrome.storage.local.get(AUTOMATIONS_KEY))[AUTOMATIONS_KEY] || [];
const setAutomations = async (automations) => chrome.storage.local.set({ [AUTOMATIONS_KEY]: automations });
const fileName = (name) => String(name || "Automacao_Chrome").replace(/[<>:"/\\|?*]+/g, "_").trim() || "Automacao_Chrome";

function normalizeImportedAutomation(raw) {
  if (!raw || raw.schema !== "flowdetect_chrome_automation" || Number(raw.version) !== 1 || !Array.isArray(raw.steps)) {
    throw new Error("Escolha um arquivo JSON exportado pelo FlowDetect Studio para Chrome.");
  }
  return {
    ...raw,
    id: crypto.randomUUID(),
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
  if (!tab?.id) throw new Error("Abra a pagina onde deseja executar a automacao.");
  return tab;
}

async function runAutomation(automation) {
  const tab = await getActiveTab();
  runTitle.textContent = automation.automation.nome;
  runStatus.textContent = "Executando";
  runProgress.textContent = "A automacao foi iniciada na aba atual.";
  const response = await chrome.runtime.sendMessage({ type: "flowdetect-start", automation, tabId: tab.id });
  if (!response?.ok) throw new Error(response?.run?.logs?.at(-1)?.message || response?.error || "A automacao falhou.");
}

function renderRun(run = {}) {
  const status = run.status || "ready";
  const labels = { ready: "Pronto", running: "Executando", completed: "Concluída", failed: "Falhou", stopped: "Parada" };
  runTitle.textContent = run.automationName || "Nenhuma execução";
  runStatus.textContent = labels[status] || status;
  runStatus.className = `status-chip ${status}`;
  runProgress.textContent = run.totalSteps
    ? `Etapa ${run.currentStep || 0} de ${run.totalSteps}.`
    : "Escolha uma automação para executar na aba aberta.";
  runLog.replaceChildren(...(run.logs || []).slice(-25).map((entry) => {
    const item = document.createElement("li");
    item.className = entry.level || "info";
    item.textContent = entry.message;
    return item;
  }));
}

function renderAutomations(automations) {
  automationList.replaceChildren();
  if (!automations.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Ainda não há automações. No Studio, abra a biblioteca e use Enviar ao Chrome. Depois importe o arquivo aqui.";
    automationList.append(empty);
    return;
  }
  for (const automation of automations) {
    const fragment = automationTemplate.content.cloneNode(true);
    fragment.querySelector(".automation-source").textContent = automation.automation?.source || "FLOWDETECT STUDIO";
    fragment.querySelector(".automation-name").textContent = automation.automation?.nome || "Automacao Chrome";
    fragment.querySelector(".automation-description").textContent = automation.automation?.descricao || "Sem descricao.";
    fragment.querySelector(".step-count").textContent = `${automation.steps.length} etapa(s)`;
    const warning = fragment.querySelector(".automation-warning");
    if (automation.warnings?.length) {
      warning.hidden = false;
      warning.textContent = `${automation.warnings.length} aviso(s) de compatibilidade.`;
    }
    fragment.querySelector(".run-automation").addEventListener("click", () => runAutomation(automation).catch((error) => {
      runStatus.textContent = "Falhou";
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
    const automations = await getAutomations();
    await setAutomations([...automations, imported]);
    renderAutomations(await getAutomations());
  } catch (error) {
    window.alert(String(error.message || error));
  }
});

newButton.addEventListener("click", async () => {
  const nome = window.prompt("Nome da automacao:", "Nova automacao Chrome");
  if (!nome) return;
  const automation = normalizeImportedAutomation({
    schema: "flowdetect_chrome_automation",
    version: 1,
    automation: { nome, descricao: "Adicione etapas no FlowDetect Studio e exporte novamente.", source: "FlowDetect Chrome" },
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
    if (!response?.ok) throw new Error(response?.error || "Nao foi possivel capturar a aba.");
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

Promise.all([getAutomations(), chrome.storage.local.get(RUN_STORAGE_KEY)])
  .then(([automations, storage]) => {
    renderAutomations(automations);
    renderRun(storage[RUN_STORAGE_KEY]);
  });

const RUN_STORAGE_KEY = "flowdetectChromeLastRun";
const activeRuns = new Map();

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => null);

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, Math.max(0, milliseconds)));

function createRun(automation, tabId) {
  return {
    id: crypto.randomUUID(),
    automationId: String(automation?.id || ""),
    automationName: String(automation?.automation?.nome || "Automacao Chrome"),
    tabId,
    status: "running",
    startedAt: new Date().toISOString(),
    finishedAt: "",
    currentStep: 0,
    totalSteps: Array.isArray(automation?.steps) ? automation.steps.length : 0,
    logs: []
  };
}

async function persistRun(run) {
  await chrome.storage.local.set({ [RUN_STORAGE_KEY]: { ...run, logs: run.logs.slice(-80) } });
}

async function addLog(run, message, level = "info") {
  run.logs.push({ at: new Date().toISOString(), message, level });
  await persistRun(run);
}

async function ensureContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  } catch (error) {
    throw new Error("Nao foi possivel acessar esta pagina. Abra uma pagina HTTP ou HTTPS e tente novamente.");
  }
}

async function sendToPage(tabId, message) {
  await ensureContentScript(tabId);
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    throw new Error("A pagina foi atualizada ou nao respondeu a automacao. Tente executar novamente.");
  }
}

function waitForTabComplete(tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      reject(new Error("A pagina demorou mais que o esperado para carregar."));
    }, Math.max(1000, timeoutMs));

    function onUpdated(updatedTabId, changeInfo) {
      if (updatedTabId !== tabId || changeInfo.status !== "complete") return;
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve();
    }

    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

async function executeStep(run, step) {
  if (step.delay_ms) await sleep(Number(step.delay_ms));
  if (step.type === "navigate") {
    await addLog(run, `Abrindo ${step.url}`);
    const loaded = waitForTabComplete(run.tabId, step.timeout_ms || 15000);
    await chrome.tabs.update(run.tabId, { url: step.url });
    await loaded;
    return;
  }

  if (step.type === "element_action" || step.type === "wait_text") {
    const response = await sendToPage(run.tabId, {
      type: "flowdetect-execute-step",
      step
    });
    if (!response?.ok) throw new Error(response?.error || "A etapa nao foi concluida.");
    await addLog(run, response.message || "Etapa concluida.", "success");
    return;
  }

  throw new Error(`Tipo de etapa nao suportado: ${step.type || "desconhecido"}.`);
}

async function executeAutomation(automation, tabId) {
  if (!automation || automation.schema !== "flowdetect_chrome_automation") {
    throw new Error("Arquivo de automacao Chrome invalido.");
  }
  if (!Array.isArray(automation.steps) || !automation.steps.length) {
    throw new Error("Essa automacao nao possui etapas compativeis com a extensao.");
  }

  const run = createRun(automation, tabId);
  activeRuns.set(run.id, run);
  await addLog(run, `Iniciando ${run.automationName}.`);

  try {
    for (let index = 0; index < automation.steps.length; index += 1) {
      if (run.cancelled) throw new Error("Execucao interrompida pelo usuario.");
      run.currentStep = index + 1;
      await persistRun(run);
      await addLog(run, `Etapa ${run.currentStep}/${run.totalSteps} em andamento.`);
      await executeStep(run, automation.steps[index]);
    }
    run.status = "completed";
    await addLog(run, "Automacao concluida com sucesso.", "success");
  } catch (error) {
    run.status = run.cancelled ? "stopped" : "failed";
    await addLog(run, String(error?.message || error), "error");
  } finally {
    run.finishedAt = new Date().toISOString();
    activeRuns.delete(run.id);
    await persistRun(run);
  }
  return run;
}

async function handleMessage(message, sender) {
  if (message?.type === "flowdetect-start") {
    const tabId = Number(message.tabId || sender?.tab?.id);
    if (!Number.isInteger(tabId)) throw new Error("Nao encontrei a aba que recebera a automacao.");
    const run = await executeAutomation(message.automation, tabId);
    return { ok: run.status === "completed", run };
  }

  if (message?.type === "flowdetect-stop") {
    const running = [...activeRuns.values()].find((run) => run.status === "running");
    if (running) {
      running.cancelled = true;
      await addLog(running, "Parada solicitada pelo usuario.", "warning");
    }
    return { ok: true, stopped: Boolean(running) };
  }

  if (message?.type === "flowdetect-capture-preview") {
    const tab = await chrome.tabs.get(Number(message.tabId));
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    return { ok: true, dataUrl };
  }

  return { ok: false, error: "Mensagem FlowDetect desconhecida." };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));
  return true;
});

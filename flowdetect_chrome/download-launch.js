const STAGE_FOLDER = "FlowDetect-Temporario";
const STAGE_MARKER = "LEIA-ME-FlowDetect.txt";
const STAGE_CONTENT = "FlowDetect: pasta temporaria para guias da extensao.\n";
const pendingId = new URL(location.href).searchParams.get("id");
const pendingKey = `flowdetectPendingFolderRun:${pendingId}`;
const $ = (id) => document.getElementById(id);
let pending = null;
let stageHandle = null;
let stageReady = false;
let markerReady = false;
let routeId = null;
let started = false;

function status(message, kind = "") {
  const node = $("runStatus");
  node.textContent = message;
  node.classList.toggle("ready", kind === "ready");
  node.classList.toggle("error", kind === "error");
}

async function validStage(handle) {
  if (handle?.kind !== "directory" || handle.name !== STAGE_FOLDER
      || await handle.queryPermission({ mode: "read" }) !== "granted") return false;
  try { return (await (await (await handle.getFileHandle(STAGE_MARKER)).getFile()).text()) === STAGE_CONTENT; }
  catch { return false; }
}

async function waitForMarker(downloadId) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const [download] = await chrome.downloads.search({ id: downloadId });
    if (download?.state === "complete") return;
    if (download?.state === "interrupted") throw new Error("O Chrome interrompeu a preparação dos downloads.");
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("A preparação dos downloads demorou demais. Tente novamente.");
}

async function prepareMarker() {
  markerReady = false;
  $("chooseFolder").disabled = true;
  status("Preparando o acesso aos downloads...");
  const downloadId = await chrome.downloads.download({
    url: `data:text/plain;charset=utf-8,${encodeURIComponent(STAGE_CONTENT)}`,
    filename: `${STAGE_FOLDER}/${STAGE_MARKER}`,
    conflictAction: "overwrite",
  });
  await waitForMarker(downloadId);
  markerReady = true;
}

async function refreshStage() {
  stageHandle = await FlowDetectDownloadFolders.get("stage");
  stageReady = await validStage(stageHandle).catch(() => false);
  const choose = $("chooseFolder");
  choose.disabled = started || (!stageReady && !markerReady);
  choose.textContent = stageReady ? "Escolher pasta e iniciar" : "Autorizar Downloads uma vez";
  if (!started) status(stageReady
    ? "A pasta escolhida receberá as guias desta execução."
    : "Na primeira utilização, autorize a pasta temporária do FlowDetect dentro de Downloads.", stageReady ? "ready" : "");
}

async function authorizeStage() {
  if (stageHandle?.kind === "directory" && stageHandle.name === STAGE_FOLDER
      && await stageHandle.queryPermission({ mode: "read" }) !== "granted") {
    const permission = await stageHandle.requestPermission({ mode: "read" });
    if (permission !== "granted") throw new Error("É preciso autorizar a pasta temporária uma vez.");
  } else if (!stageHandle || stageHandle.name !== STAGE_FOLDER) {
    // Keep the picker directly inside the click handler so Chrome accepts the user gesture.
    const handle = await showDirectoryPicker({ id: "flowdetect-download-stage", startIn: "downloads", mode: "read" });
    if (!await validStage(handle)) throw new Error(`Selecione Downloads/${STAGE_FOLDER}.`);
    await FlowDetectDownloadFolders.put("stage", handle);
  }
  await refreshStage();
  if (!stageReady) throw new Error(`Selecione Downloads/${STAGE_FOLDER}.`);
  status("Pronto. Agora clique em Escolher pasta e iniciar.", "ready");
}

async function startAutomation() {
  started = true;
  $("chooseFolder").disabled = true;
  status("Iniciando automação na aba original...");
  try {
    if (!await validStage(await FlowDetectDownloadFolders.get("stage"))) {
      throw new Error("A autorização de Downloads expirou. Abra novamente e autorize a pasta temporária.");
    }
    const destination = await FlowDetectDownloadFolders.get(`destination:${routeId}`);
    if (!destination || await destination.queryPermission({ mode: "readwrite" }) !== "granted") {
      throw new Error("O destino perdeu a permissão. Escolha a pasta novamente.");
    }
    const tab = await chrome.tabs.get(pending.tabId);
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.storage.local.set({ [pendingKey]: { ...pending, started: true } });
    const response = await chrome.runtime.sendMessage({ type: "flowdetect-start",
      automation: pending.automation, tabId: tab.id, pageId: pending.pageId, startRow: pending.startRow,
      loopIncludedIndices: pending.loopIncludedIndices, loopExcludedRows: pending.loopExcludedRows,
      downloadRouteId: routeId });
    if (!response?.run) throw new Error(response?.error || "A automação não iniciou.");
    status(response.run.status === "completed" ? "Automação concluída. Confira os downloads abaixo."
      : `Automação ${response.run.status}. Confira o histórico na extensão.`, response.run.status === "completed" ? "ready" : "error");
    await chrome.storage.local.remove(pendingKey);
  } catch (error) {
    status(String(error.message || error), "error");
  }
}

$("chooseFolder").addEventListener("click", async () => {
  if (!pending || started) return;
  try {
    if (!stageReady) return await authorizeStage();
    const destination = await showDirectoryPicker({ id: "flowdetect-guides-destination", mode: "readwrite" });
    if (await stageHandle.isSameEntry(destination)) throw new Error("Escolha uma pasta diferente da temporária.");
    routeId = crypto.randomUUID();
    await FlowDetectDownloadFolders.put(`destination:${routeId}`, destination);
    status(`Destino selecionado: ${destination.name}. Iniciando...`, "ready");
    await startAutomation();
  } catch (error) {
    if (error.name !== "AbortError") status(String(error.message || error), "error");
  }
});

$("backToSite").addEventListener("click", async () => {
  const tabId = pending?.tabId;
  if (!started) {
    await chrome.storage.local.remove(pendingKey).catch(() => {});
    pending = null;
    $("chooseFolder").disabled = true;
    status("Execução cancelada. Abra a extensão para iniciar novamente.");
  }
  if (tabId) await chrome.tabs.update(tabId, { active: true }).catch(() => {});
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  const report = changes.flowdetectDownloadStatus?.newValue;
  if (report?.routeId && report.routeId === routeId) {
    $("downloadStatus").hidden = false;
    const node = $("downloadStatus");
    node.textContent = report.status === "saved" ? `${report.filename} salvo em ${report.detail}.`
      : report.status === "error" ? `Falha: ${report.detail}`
      : report.status === "saved_with_temp" ? report.detail
      : report.status === "downloading" ? `${report.filename}: baixando...`
      : `Aguardando downloads para ${report.detail}.`;
    node.classList.toggle("error", report.status === "error");
    node.classList.toggle("ready", report.status !== "error");
  }
});

(async () => {
  if (!/^[0-9a-f-]{36}$/i.test(String(pendingId || ""))) throw new Error("Pedido de execução inválido.");
  pending = (await chrome.storage.local.get(pendingKey))[pendingKey];
  if (!pending?.automation || !Number.isInteger(pending.tabId)) throw new Error("Pedido não encontrado. Abra a extensão e tente novamente.");
  const runtime = await chrome.runtime.sendMessage({ type: "flowdetect-runtime-info" });
  if (!runtime?.capabilities?.includes("download_destination")) {
    throw new Error("Recarregue a extensão FlowDetect em chrome://extensions para usar o destino dos downloads.");
  }
  $("automationName").textContent = pending.automation.automation?.nome || "Automação Chrome";
  await refreshStage();
  if (!stageReady) {
    await prepareMarker();
    await refreshStage();
  }
})().catch((error) => {
  status(String(error.message || error), "error");
  $("chooseFolder").disabled = true;
});

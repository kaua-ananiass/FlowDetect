import "./download-folders.js";

const STAGE_FOLDER = "FlowDetect-Temporario";
const STAGE_MARKER = "LEIA-ME-FlowDetect.txt";
const STAGE_CONTENT = "FlowDetect: pasta temporaria para guias da extensao.\n";
const ROUTE_KEY = "flowdetectActiveDownloadRoute";
const ROUTED_PREFIX = "flowdetectRoutedDownload:";
const ROUTE_STATUS_KEY = "flowdetectDownloadStatus";
const processingDownloads = new Set();
let copyQueue = Promise.resolve();

function safeDownloadName(value) {
  const name = String(value || "download").split(/[\\/]/).pop()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/[. ]+$/g, "");
  return name && name !== "." && name !== ".." ? name.slice(0, 180) : "download";
}

async function folderPermission(handle, mode) {
  return Boolean(handle && await handle.queryPermission({ mode }) === "granted");
}

async function validateStage(handle) {
  if (handle?.kind !== "directory" || handle.name !== STAGE_FOLDER) return false;
  try {
    const marker = await (await handle.getFileHandle(STAGE_MARKER)).getFile();
    return (await marker.text()) === STAGE_CONTENT;
  } catch { return false; }
}

async function routeAvailable(routeId) {
  const stage = await FlowDetectDownloadFolders.get("stage");
  const destination = await FlowDetectDownloadFolders.get(`destination:${routeId}`);
  if (!await folderPermission(stage, "read") || !await validateStage(stage)) {
    throw new Error("Autorize a pasta temporaria do FlowDetect dentro de Downloads antes de executar.");
  }
  if (!await folderPermission(destination, "readwrite")) {
    throw new Error("A pasta de destino perdeu a permissao. Escolha-a novamente.");
  }
  if (await stage.isSameEntry(destination)) {
    throw new Error("Escolha um destino diferente da pasta temporaria.");
  }
  return { stage, destination };
}

async function activateDownloadRoute(routeId, tabId, runId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(routeId || ""))) throw new Error("Destino de download invalido.");
  await routeAvailable(routeId);
  await chrome.storage.session.set({ [ROUTE_KEY]: {
    routeId, tabId, runId, active: true, startedAt: Date.now(),
  } });
  const destination = await FlowDetectDownloadFolders.get(`destination:${routeId}`);
  await recordDownloadStatus("waiting", "", destination.name, routeId);
}

async function deactivateDownloadRoute(runId) {
  const route = (await chrome.storage.session.get(ROUTE_KEY))[ROUTE_KEY];
  if (route?.runId === runId) {
    // A site may begin the download just after its last click completes.
    await chrome.storage.session.set({ [ROUTE_KEY]: { ...route, active: false, acceptUntil: Date.now() + 60000 } });
  }
}

async function clearDownloadRouteForTab(tabId) {
  const route = (await chrome.storage.session.get(ROUTE_KEY))[ROUTE_KEY];
  if (route?.tabId === tabId) {
    await chrome.storage.session.set({ [ROUTE_KEY]: { ...route, active: false, acceptUntil: 0 } });
  }
}

async function recordDownloadStatus(status, filename, detail = "", routeId = "") {
  await chrome.storage.local.set({ [ROUTE_STATUS_KEY]: {
    status, filename, detail, routeId, at: new Date().toISOString(),
  } });
}

async function unusedFilename(directory, originalName) {
  const name = safeDownloadName(originalName);
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : "";
  for (let index = 0; index < 1000; index += 1) {
    const candidate = index ? `${stem} (${index})${extension}` : name;
    try { await directory.getFileHandle(candidate); }
    catch (error) {
      if (error.name === "NotFoundError") return candidate;
      throw error;
    }
  }
  throw new Error("Ha muitos arquivos com o mesmo nome na pasta de destino.");
}

async function copyCompletedDownload(item, route) {
  const { stage, destination } = await routeAvailable(route.routeId);
  const folder = await stage.getDirectoryHandle(route.routeId);
  const name = safeDownloadName(item.filename);
  const source = await (await folder.getFileHandle(name)).getFile();
  const targetName = await unusedFilename(destination, name);
  const target = await destination.getFileHandle(targetName, { create: true });
  const writer = await target.createWritable();
  try { await source.stream().pipeTo(writer); }
  catch (error) { await writer.abort().catch(() => {}); throw error; }
  const saved = await target.getFile();
  if (saved.size !== source.size) throw new Error("A copia ficou com tamanho diferente do arquivo original.");
  try { await chrome.downloads.removeFile(item.id); }
  catch {
    await recordDownloadStatus("saved_with_temp", targetName,
      `Salvo em ${destination.name}; a copia temporaria permanece em Downloads/${STAGE_FOLDER}.`, route.routeId);
    return;
  }
  await recordDownloadStatus("saved", targetName, destination.name, route.routeId);
}

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  (async () => {
    const route = (await chrome.storage.session.get(ROUTE_KEY))[ROUTE_KEY];
    if ((!route?.active && Date.now() > Number(route?.acceptUntil || 0))
        || route.tabId !== item.tabId || item.byExtensionId) return suggest();
    const name = safeDownloadName(item.filename);
    await chrome.storage.session.set({ [`${ROUTED_PREFIX}${item.id}`]: {
      routeId: route.routeId, runId: route.runId,
    } });
    await recordDownloadStatus("downloading", name, "Baixando para a pasta temporaria...", route.routeId);
    suggest({ filename: `${STAGE_FOLDER}/${route.routeId}/${name}`, conflictAction: "uniquify" });
  })().catch(() => suggest());
  return true;
});

chrome.downloads.onChanged.addListener((delta) => {
  if (!delta.state?.current || !["complete", "interrupted"].includes(delta.state.current)
      || processingDownloads.has(delta.id)) return;
  processingDownloads.add(delta.id);
  const process = async () => {
    const key = `${ROUTED_PREFIX}${delta.id}`;
    const route = (await chrome.storage.session.get(key))[key];
    if (!route) return;
    if (delta.state.current === "interrupted") {
      await recordDownloadStatus("error", "", "O download foi interrompido pelo Chrome.", route.routeId);
      await chrome.storage.session.remove(key);
      return;
    }
    const [item] = await chrome.downloads.search({ id: delta.id });
    if (!item) throw new Error("O arquivo concluido nao foi encontrado no Chrome.");
    try {
      await copyCompletedDownload(item, route);
      await chrome.storage.session.remove(key);
    } catch (error) {
      await recordDownloadStatus("error", safeDownloadName(item.filename),
        `${String(error.message || error)} O original não foi apagado: ${item.filename || `Downloads/${STAGE_FOLDER}`}.`, route.routeId);
    }
  };
  copyQueue = copyQueue.then(process, process)
    .catch((error) => recordDownloadStatus("error", "", String(error.message || error)))
    .finally(() => processingDownloads.delete(delta.id));
});

export { STAGE_FOLDER, STAGE_MARKER, STAGE_CONTENT, ROUTE_STATUS_KEY,
  validateStage, routeAvailable, activateDownloadRoute, deactivateDownloadRoute,
  clearDownloadRouteForTab,
  safeDownloadName, unusedFilename };

import "./download-folders.js";

const STAGE_FOLDER = "FlowDetect-Temporario";
const STAGE_MARKER = "LEIA-ME-FlowDetect.txt";
const STAGE_CONTENT = "FlowDetect: pasta temporaria para guias da extensao.\n";
const ROUTE_KEY = "flowdetectActiveDownloadRoute";
const routeTabKey = (tabId) => `${ROUTE_KEY}:tab:${tabId}`;
const routeRunKey = (runId) => `${ROUTE_KEY}:run:${runId}`;
const ROUTED_PREFIX = "flowdetectRoutedDownload:";
const ROUTE_STATUS_KEY = "flowdetectDownloadStatus";
const processingDownloads = new Set();

const downloadOrigins = [];
const MAX_DOWNLOAD_ORIGINS = 240;
const DOWNLOAD_ORIGIN_WINDOW_MS = 60_000;

// downloads.DownloadItem does not contain tabId. Never infer a route merely
// because a download occurred while several automations were running.
function noteDownloadSource(tabId, url, kind = "click") {
  const source = String(url || "");
  if (!Number.isInteger(tabId) || tabId < 0 || source.length > 4096
      || !/^(https?:|blob:)/i.test(source)) return false;
  const now = Date.now();
  downloadOrigins.push({ tabId, url: source, kind, time: now });
  while (downloadOrigins.length > MAX_DOWNLOAD_ORIGINS
      || (downloadOrigins.length && now - downloadOrigins[0].time > DOWNLOAD_ORIGIN_WINDOW_MS)) {
    downloadOrigins.shift();
  }
  return true;
}

// webRequest provides a genuine source tab for HTTP attachments. In contrast,
// chrome.downloads.onDeterminingFilename's DownloadItem has no source tab ID.
chrome.webRequest?.onHeadersReceived?.addListener((details) => {
  const disposition = (details.responseHeaders || [])
    .find((header) => header.name?.toLowerCase() === "content-disposition")?.value || "";
  if (/\battachment\b|\bfilename\s*\*?\s*=/i.test(disposition)) {
    noteDownloadSource(details.tabId, details.url, "attachment");
  }
}, { urls: ["http://*/*", "https://*/*"] }, ["responseHeaders"]);

function matchingDownloadOrigin(item) {
  if (Number.isInteger(item.tabId) && item.tabId >= 0) return { tabId: item.tabId };
  const urls = new Set([item.finalUrl, item.url].filter(Boolean));
  const now = Date.now();
  const matching = downloadOrigins.filter((entry) => urls.has(entry.url)
    && now - entry.time <= (entry.kind === "attachment" ? 60_000 : 20_000));
  const strong = matching.filter((entry) => entry.kind === "attachment");
  const matches = strong.length ? strong : matching;
  const tabIds = [...new Set(matches.map((entry) => entry.tabId))];
  if (tabIds.length === 1) return { tabId: tabIds[0] };
  return { tabId: null, ambiguousTabIds: tabIds.length > 1 ? tabIds : [] };
}

async function locateDownloadRoute(item) {
  const { tabId, ambiguousTabIds } = matchingDownloadOrigin(item);
  if (tabId !== null && tabId !== undefined) {
    const key = routeTabKey(tabId);
    const route = (await chrome.storage.session.get(key))[key];
    if (route?.tabId === tabId &&
        (route.active || Date.now() <= Number(route.acceptUntil || 0))) return route;
    return null;
  }
  // Same URL from different tabs cannot be safely assigned to one run through
  // the Chrome downloads API. Fail closed and inform both affected pages.
  for (const id of ambiguousTabIds) {
    const route = (await chrome.storage.session.get(routeTabKey(id)))[routeTabKey(id)];
    if (route?.active) {
      await recordDownloadStatus("error", safeDownloadName(item.filename),
        "Duas abas baixaram o mesmo endereço: o Chrome não informou qual iniciou este arquivo. "
        + "O download permaneceu na pasta padrão para evitar misturar as páginas.", route.routeId);
    }
  }
  return null;
}

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
  const route = {
    routeId, tabId, runId, active: true, startedAt: Date.now(),
  };
  await chrome.storage.session.set({ [routeTabKey(tabId)]: route, [routeRunKey(runId)]: route });
  const destination = await FlowDetectDownloadFolders.get(`destination:${routeId}`);
  await recordDownloadStatus("waiting", "", destination.name, routeId);
}

async function deactivateDownloadRoute(runId) {
  const key = routeRunKey(runId);
  const route = (await chrome.storage.session.get(key))[key];
  if (route?.runId === runId) {
    // A site may begin the download just after its last click completes.
    const tabKey = routeTabKey(route.tabId);
    const current = (await chrome.storage.session.get(tabKey))[tabKey];
    if (current?.runId === runId) await chrome.storage.session.set({ [tabKey]: { ...route, active: false, acceptUntil: Date.now() + 60000 } });
    await chrome.storage.session.remove(key);
  }
}

async function clearDownloadRouteForTab(tabId) {
  const key = routeTabKey(tabId);
  const route = (await chrome.storage.session.get(key))[key];
  if (route?.tabId === tabId) {
    await chrome.storage.session.remove(key);
  }
}

async function recordDownloadStatus(status, filename, detail = "", routeId = "") {
  const report = {
    status, filename, detail, routeId, at: new Date().toISOString(),
  };
  await chrome.storage.local.set({ [ROUTE_STATUS_KEY]: report, ...(routeId ? { [`${ROUTE_STATUS_KEY}:${routeId}`]: report } : {}) });
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
    if (item.byExtensionId) return suggest();
    const route = await locateDownloadRoute(item);
    if (!route) return suggest();
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
  safeDownloadName, unusedFilename, noteDownloadSource, matchingDownloadOrigin };

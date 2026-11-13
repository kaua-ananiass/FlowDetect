import { routeAvailable, activateDownloadRoute, deactivateDownloadRoute, clearDownloadRouteForTab, noteDownloadSource }
  from "./download-routing.js";
import { PAGE_RUN_PREFIX, PAGES_KEY, getPages, createPage, bindPage, unbindPage, deletePage, editPages } from "./execution-pages.js";
import { tableWorkbookDataUrl } from "./table-workbook.js";
async function updatePageOutline(tabId, page) {
  if (!Number.isInteger(tabId)) return;
  const update = { type: "flowdetect-page-outline-update", page: page || null };
  try {
    if ((await chrome.tabs.sendMessage?.(tabId, update))?.ok) return;
  } catch (_) { /* Pages opened before installation might not have the script. */ }
  if (!page || !chrome.scripting?.executeScript) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["page-outline.js"] });
    await chrome.tabs.sendMessage(tabId, update);
  } catch (_) { /* Restricted Chrome pages cannot be injected. */ }
}

const RUN_STORAGE_KEY = "flowdetectChromeLastRun";
const RUNTIME_VERSION = "0.2.96";
const CONTENT_RUNTIME_VERSION = "0.2.96";
const STUDIO_TEST_BRIDGE = "http://127.0.0.1:18453";
const AUTOMATIONS_KEY = "flowdetectChromeAutomations";
const PAIR_CODE_KEY = "flowdetectStudioPairCode";

async function ensureAutomationPageOwnership(pages) {
  const defaultPage = pages[0]?.id;
  if (!defaultPage) return [];
  const stored = (await chrome.storage.local.get(AUTOMATIONS_KEY))[AUTOMATIONS_KEY];
  const automations = Array.isArray(stored) ? stored : [];
  const valid = new Set(pages.map((page) => page.id));
  // One-time, non-destructive migration: existing global automations belong to
  // the first execution page. Original definitions and IDs are kept intact.
  const changed = automations.some((item) => !valid.has(item?.pageId));
  if (!changed) return automations;
  const updated = automations.map((item) => (
    valid.has(item?.pageId) ? item : { ...item, pageId: defaultPage }
  ));
  await chrome.storage.local.set({ [AUTOMATIONS_KEY]: updated });
  return updated;
}

async function chosenAutomationPageId() {
  let pages = await getPages();
  if (!pages.length) {
    await createPage(null);
    pages = await getPages();
  }
  await ensureAutomationPageOwnership(pages);
  const selection = (await chrome.storage.session.get("flowdetectSelectedPage")).flowdetectSelectedPage;
  return pages.find((page) => page.id === selection)?.id || pages[0].id;
}
let studioTestPolling = false;
let pairCodePromise = null;
const studioConnection = { lastSeen: 0, paired: false, phase: "offline", error: "" };
const activeRuns = new Map();
const chainRuns = new Map();
let chainReservation = "";
const reservedTabs = new Set();
const reservedPages = new Set();
const imageBitmapCache = new Map();
let creatingCaptureDocument = null;


const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, Math.max(0, milliseconds)));

function newPairCode() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0] % 1000000).padStart(6, "0");
}

function getPairCode() {
  if (!pairCodePromise) {
    pairCodePromise = chrome.storage.local.get(PAIR_CODE_KEY).then(async (stored) => {
      const existing = String(stored[PAIR_CODE_KEY] || "");
      if (/^\d{6}$/.test(existing)) return existing;
      const code = newPairCode();
      await chrome.storage.local.set({ [PAIR_CODE_KEY]: code });
      return code;
    }).catch((error) => { pairCodePromise = null; throw error; });
  }
  return pairCodePromise;
}

async function regeneratePairCode() {
  if (["testing", "importing"].includes(studioConnection.phase)) {
    throw new Error("Aguarde o teste ou envio atual terminar antes de gerar outro codigo.");
  }
  const code = newPairCode();
  await chrome.storage.local.set({ [PAIR_CODE_KEY]: code });
  pairCodePromise = Promise.resolve(code);
  studioConnection.paired = false;
  studioConnection.phase = "waiting_pair";
  return code;
}

async function runStudioRecognitionTest(job) {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id || !/^https?:\/\//i.test(String(tab.url || ""))) {
    return { ok: false, error: "Abra a aba do site no Chrome antes de testar.", results: [] };
  }
  try {
    const result = await Promise.race([
      chrome.tabs.sendMessage(tab.id, {
        type: "flowdetect-test-recognition-v1",
        texts: job.texts,
        selector: job.selector,
        capture: job.capture,
      }),
      sleep(10000).then(() => { throw new Error("A aba nao respondeu ao teste em 10 segundos."); }),
    ]);
    return { ...result, tabId: tab.id, url: result?.url || tab.url };
  } catch (error) {
    return { ok: false, url: tab.url, results: [], error: `Nao foi possivel ler esta aba. Recarregue-a e tente novamente. ${String(error?.message || error)}` };
  }
}

async function importStudioAutomation(job) {
  const raw = job.automation;
  if (raw?.schema !== "flowdetect_chrome_automation" || ![1, 2, 3].includes(Number(raw.version)) || !Array.isArray(raw.steps)) {
    return { ok: false, error: "A automacao enviada pelo Studio e invalida." };
  }
  const pageId = await chosenAutomationPageId();
  const stored = (await chrome.storage.local.get(AUTOMATIONS_KEY))[AUTOMATIONS_KEY] || [];
  const previous = job.id && stored.find((item) => item.studioTransferId === job.id);
  if (previous) return { ok: true, steps: previous.steps?.length || 0 };
  const imported = {
    ...raw,
    id: crypto.randomUUID(),
    studioTransferId: job.id,
    pageId,
    automation: {
      ...raw.automation,
      nome: String(raw.automation?.nome || "Automacao Chrome"),
      descricao: String(raw.automation?.descricao || ""),
    },
    warnings: Array.isArray(raw.warnings) ? raw.warnings : [],
  };
  await chrome.storage.local.set({ [AUTOMATIONS_KEY]: [...stored, imported] });
  return { ok: true, steps: imported.steps.length };
}

async function runStudioTableMapping(job){
  const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});
  if(!tab?.id || !/^https?:\/\//i.test(tab.url||''))throw Error('Abra a tabela no Chrome antes de mapear.');
  if(activeRuns.size)throw Error('Pare as automações antes de mapear uma tabela.');
  await chrome.scripting.executeScript({target:{tabId:tab.id},files:['table-reader.js']});
  const result=await chrome.tabs.sendMessage(tab.id,job?.request?.pick_control?{type:'flowdetect-control-pick'}:job?.request?.descriptor?{type:'flowdetect-table-preview',config:job.request}:{type:'flowdetect-table-pick'});
  if(!result?.ok||result.control)return result;
  const {rows,actions,...schema}=result;
  const fixedButtons=[...new Map((actions||[]).flat().map(a=>[JSON.stringify([a.column,a.signature]),a])).values()];
  return {...schema,rows:[],actions:[fixedButtons],schema_only:true};
}

async function handleStudioChainJob(job) {
  if (job.type === "chain_pages") {
    const pages = await getPages();
    return { ok: true, pages: await Promise.all(pages.map(async page => {
      const tab = Number.isInteger(page.tabId) ? await chrome.tabs.get(page.tabId).catch(() => null) : null;
      return { ...page, tabId: tab?.id ?? null, url: tab?.url || "", tabTitle: tab?.title || page.tabTitle };
    })) };
  }
  if (job.type === "chain_reserve") {
    if (activeRuns.size || (chainReservation && chainReservation !== job.chainId)) throw new Error("O Chrome já está reservado ou executando outra automação.");
    if (typeof job.chainId !== "string" || !job.chainId) throw new Error("Encadeamento sem identificador.");
    const pages = await getPages();
    for (const stage of (job.stages || []).filter(stage => stage.engine === "chrome")) {
      const page = pages.find(page => page.id === stage.pageId);
      if (!Number.isInteger(page?.tabId)) throw new Error("Uma página do encadeamento não tem aba vinculada.");
      const tab = await chrome.tabs.get(page.tabId);
      const actual = new URL(tab.url);
      if (!["http:", "https:"].includes(actual.protocol)) throw new Error("Vincule uma página HTTP ou HTTPS.");
      if (stage.expectedUrl) {
        const expected = new URL(stage.expectedUrl);
        if (actual.origin !== expected.origin || actual.pathname !== expected.pathname) throw new Error("Uma aba não está na URL esperada. Prepare o Chrome antes de iniciar.");
      }
    }
    // Tab inspection yields to other extension events; check again before reserving.
    if (activeRuns.size || (chainReservation && chainReservation !== job.chainId)) throw new Error("O Chrome iniciou outra execução durante a conferência. Aguarde e tente novamente.");
    chainReservation = job.chainId;
    return { ok: true };
  }
  if (job.type === "chain_release") {
    if (activeRuns.size) throw new Error("Pare a execução do Chrome antes de liberar.");
    if (chainReservation && chainReservation !== job.chainId) throw new Error("A reserva pertence a outro encadeamento.");
    chainReservation = "";
    return { ok: true };
  }
  if (job.type === "chain_activity") return { ok: true, running: activeRuns.size > 0 };
  if (job.type === "chain_status" || job.type === "chain_stop") {
    const id = String(job.runId || "");
    const run = activeRuns.get(id) || chainRuns.get(id);
    if (!run) return { ok: false, error: "Execução não encontrada. A extensão pode ter reiniciado; confira a aba antes de repetir." };
    if (job.type === "chain_stop" && activeRuns.has(id)) run.cancelled = true;
    return { ok: true, run: { id: run.id, status: run.status, currentStep: run.currentStep, totalSteps: run.totalSteps, message: run.lastMessage, mapExit:run.mapExit || null, capturedVariables:run.capturedVariables || {} } };
  }
  if (job.type !== "chain_start") return { ok: false, error: "Comando de encadeamento desconhecido." };
  if (!chainReservation || chainReservation !== job.chainId) throw new Error("A reserva do Chrome foi perdida. Confira a aba antes de reiniciar.");
  const automation = structuredClone(job.automation);
  if (automation?.schema !== "flowdetect_chrome_automation" || !automation.steps?.length) throw new Error("Fluxo Chrome inválido.");
  const page = (await getPages()).find(item => item.id === job.pageId);
  if (!Number.isInteger(page?.tabId)) throw new Error("Vincule uma aba à página do Chrome no agente.");
  const tab = await chrome.tabs.get(page.tabId);
  if (job.expectedUrl) {
    const expected = new URL(job.expectedUrl), actual = new URL(tab.url);
    if (!["http:", "https:"].includes(expected.protocol)) throw new Error("Informe um endereço HTTP ou HTTPS.");
    if (actual.origin !== expected.origin || actual.pathname !== expected.pathname) throw new Error("A aba do agente não está no endereço esperado.");
  }
  automation.entry_order = Number(job.entryOrder) || null;
  if (automation.entry_order && !automation.steps.some(step => Number(step.source_order) === automation.entry_order)) throw new Error("Bloco de entrada não encontrado na exportação Chrome.");
  // Entry after a spreadsheet source cannot safely reconstruct the active row.
  if (automation.entry_order && automation.steps.some(step => ["loop_start", "spreadsheet_loop"].includes(step.type) || step.spreadsheet_loop) && Number(automation.steps[0].source_order)!==automation.entry_order) throw new Error("Em fluxos com loop, inicie pelo começo para preservar o contexto da planilha.");
  if (activeRuns.size) throw new Error("O Chrome já possui uma execução ativa.");
  if (chainRuns.size > 100) for (const [id, run] of chainRuns) { if (!activeRuns.has(id)) chainRuns.delete(id); }
  await chrome.tabs.update(tab.id, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
  return new Promise(resolve => {
    executeAutomation(automation, tab.id, 1, null, [], null, page.id, run => {
      chainRuns.set(run.id, run);
      resolve({ ok: true, runId: run.id });
    }).then(run => { chainRuns.set(run.id, run); }).catch(error => resolve({ ok: false, error: String(error?.message || error) }));
  });
}

function startStudioTestBridge() {
  if (studioTestPolling) return;
  studioTestPolling = true;
  (async () => {
    while (studioTestPolling) {
      try {
        const pairCode = await getPairCode();
        const response = await fetch(`${STUDIO_TEST_BRIDGE}/poll`, {
          cache: "no-store", headers: {
            "X-FlowDetect-Version": RUNTIME_VERSION,
            "X-FlowDetect-Extension-ID": chrome.runtime.id,
            "X-FlowDetect-Pair-Code": pairCode,
          },
        });
        if (!response.ok) throw new Error(response.status === 426 ? "Versao do Studio incompativel. Reinicie o Studio atualizado." : "Studio indisponivel");
        studioConnection.lastSeen = Date.now();
        studioConnection.error = "";
        const { job, paired } = await response.json();
        if (pairCode !== await getPairCode()) {
          studioConnection.paired = false;
          studioConnection.phase = "waiting_pair";
          if (job?.id) {
            await fetch(`${STUDIO_TEST_BRIDGE}/result`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-FlowDetect-Extension-ID": chrome.runtime.id, "X-FlowDetect-Pair-Code": pairCode },
              body: JSON.stringify({ id: job.id, result: { ok: false, error: "O codigo da extensao mudou. Pareie novamente." } }),
            });
          }
          continue;
        }
        studioConnection.paired = Boolean(paired);
        if (!paired) {
          studioConnection.phase = "waiting_pair";
          await sleep(2000);
          continue;
        }
        if (!job?.id) { studioConnection.phase = "connected"; continue; }
        studioConnection.phase = job.type === "import_automation" ? "importing" : "testing";
        let result;
        try {
          result = job.type.startsWith("chain_")
            ? await handleStudioChainJob(job)
            : job.type === "import_automation"
            ? await importStudioAutomation(job)
            : job.type === "test_recognition"
              ? await runStudioRecognitionTest(job)
              : job.type === "map_table"
                ? await runStudioTableMapping(job)
              : { ok: false, error: "Pedido desconhecido do Studio." };
        } catch (error) {
          result = { ok: false, error: String(error?.message || error) };
        }
        await fetch(`${STUDIO_TEST_BRIDGE}/result`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-FlowDetect-Extension-ID": chrome.runtime.id, "X-FlowDetect-Pair-Code": pairCode },
          body: JSON.stringify({ id: job.id, result }),
        });
        studioConnection.phase = result.ok ? "done" : "error";
        studioConnection.error = result.error || "";
      } catch (error) {
        studioConnection.phase = "offline";
        studioConnection.paired = false;
        studioConnection.error = String(error?.message || error);
        await sleep(3000);
      }
    }
  })();
}

chrome.alarms.create("flowdetect-studio-test-bridge", { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "flowdetect-studio-test-bridge") startStudioTestBridge();
});
startStudioTestBridge();

function normalizeScreenGuard(raw = {}) {
  if (!raw?.enabled) return { enabled: false };
  const text = String(raw.text || "").trim();
  let url;
  try { url = new URL(String(raw.url || "").trim()); } catch (_) { throw new Error("Informe uma URL valida para a tela da automacao."); }
  if (!["http:", "https:"].includes(url.protocol) || !text) throw new Error("A tela da automacao precisa de uma URL HTTP/HTTPS e um texto esperado.");
  url.search = "";
  return { enabled: true, url: url.href, text };
}

function screenUrlMatches(actual, expected) {
  try {
    const current = new URL(actual);
    const required = new URL(expected);
    return current.origin === required.origin && current.pathname === required.pathname && current.hash === required.hash;
  } catch (_) { return false; }
}

async function checkAutomationScreen(raw, tabId) {
  const guard = normalizeScreenGuard(raw);
  if (!guard.enabled) return { ready: true, tabId };
  const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!active?.id || (tabId != null && active.id !== tabId)) return { ready: false, reason: "Abra a aba da automacao." };
  const tab = await chrome.tabs.get(active.id).catch(() => null);
  if (!tab || !screenUrlMatches(tab.url, guard.url)) return { ready: false, reason: "Aguardando tela da automacao: abra a URL configurada." };
  if (tab.status !== "complete") return { ready: false, reason: "Aguardando a pagina carregar." };
  const response = await chrome.tabs.sendMessage(tab.id, {
    type: "flowdetect-screen-check-v2", text: guard.text,
  }).catch(() => null);
  // Recheck after the asynchronous text read: focus/navigation may have changed.
  const [latestActive] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const latestTab = await chrome.tabs.get(tab.id).catch(() => null);
  if (latestActive?.id !== tab.id || latestTab?.status !== "complete" || !screenUrlMatches(latestTab?.url, guard.url))
    return { ready: false, reason: "Aguardando tela da automacao na aba atual." };
  const ready = Boolean(response?.ok && response.hasText && screenUrlMatches(response.url, guard.url));
  return { ready, tabId: tab.id, reason: ready ? "Tela da automacao identificada." :
    response?.ok ? `Aguardando o texto: ${guard.text}` : "Recarregue a pagina para a extensao identificar a tela." };
}

function createRun(automation, tabId, startRow = 1, loopIncludedIndices = null, loopExcludedRows = []) {
  return {
    id: crypto.randomUUID(),
    automationId: String(automation?.id || ""),
    automationName: String(automation?.automation?.nome || "Automação Chrome"),
    tabId,
    status: "running",
    captureMode: "visible",
    startedAt: new Date().toISOString(),
    finishedAt: "",
    currentStep: 0,
    totalSteps: Array.isArray(automation?.steps) ? automation.steps.filter(step=>!['loop_start','loop_end'].includes(step.type)).length : 0,
    loopIncludedIndices: Array.isArray(loopIncludedIndices) ? loopIncludedIndices : null,
    loopExcludedRows: Array.isArray(loopExcludedRows) ? loopExcludedRows : [],
    recentSteps: [],
    lastMessage: "",
    logs: [],
    variables: {},
    report: {
      sourceName: "",
      rows: [],
      summary: {},
      excludedRows: Array.isArray(loopExcludedRows) ? loopExcludedRows : [],
      requestedStartRow: Math.max(1, Math.trunc(Number(startRow) || 1))
    },
    requestedStartRow: Math.max(1, Math.trunc(Number(startRow) || 1))
  };
}

function updateSpreadsheetProgress(run) {
  const loop = run.spreadsheetLoop;
  if (!loop || !Number(run.stepsPerIteration)) return;
  const firstRow = Math.max(0, Number(run.spreadsheetStartRow || 1) - 1);
  const totalRows = Math.max(1, Number(loop.total) - firstRow);
  const finishedRows = Math.max(0, Number(loop.row) - firstRow);
  const rowSteps = Math.max(0, Number(run.currentStep || 0) - Number(loop.startedStep || 0));
  const rowFraction = Math.min(0.99, rowSteps / Math.max(1, Number(run.stepsPerIteration)));
  const percent = Math.min(99, Math.floor(((finishedRows + rowFraction) / totalRows) * 100));
  run.progressPercent = Math.max(Number(run.progressPercent || 0), percent);
}

async function updateProgressBadge(run) {
  if (!chrome.action?.setBadgeText) return;
  if (!["running", "waiting_screen"].includes(run?.status)) {
    await chrome.action.setBadgeText({ tabId: run.tabId, text: "" });
    return;
  }
  const total = Math.max(0, Number(run.totalSteps || 0));
  const measured = typeof run.progressPercent === "number" ? run.progressPercent : NaN;
  const estimated = total ? Math.round((Math.max(0, Number(run.currentStep || 0)) / total) * 100) : 0;
  const percent = Math.max(0, Math.min(99, Number.isFinite(measured) ? measured : estimated));
  await chrome.action.setBadgeBackgroundColor?.({ tabId: run.tabId, color: "#087d89" });
  await chrome.action.setBadgeText({ tabId: run.tabId, text: `${percent}%` });
}

async function persistRun(run) {
  updateSpreadsheetProgress(run);
  const persisted = { ...run, logs: run.logs.slice(-100) };
  delete persisted.cancelled;
  await chrome.storage.local.set({ [run.pageId ? `${PAGE_RUN_PREFIX}${run.pageId}` : RUN_STORAGE_KEY]: persisted });
  await updateProgressBadge(run).catch(() => {});
}

async function notifyRunFinished(run) {
  if (!["completed", "failed"].includes(run.status) || !chrome.notifications?.create) return;
  const name = String(run.automationName || "Automação").trim();
  await chrome.notifications.create(`flowdetect-run-${run.id}`, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon-128.png"),
    title: run.status === "completed" ? "FlowDetect · Concluída" : "FlowDetect · Falhou",
    message: run.status === "completed"
      ? `${name} terminou. O relatório PDF está disponível na extensão.`
      : `${name} foi interrompida por uma falha. Abra a extensão para ver os detalhes.`,
    priority: 0,
  });
}

async function addLog(run, message, level = "info") {
  run.lastMessage = String(message || "");
  run.logs.push({ at: new Date().toISOString(), message: run.lastMessage, level });
  await persistRun(run);
}

function reportTone(value, fallback = "success") {
  const tone = String(value || fallback).trim().toLowerCase();
  return ["success", "info", "warning", "danger"].includes(tone) ? tone : fallback;
}

function runWasInterrupted(run, error = "") {
  const message = String(error?.message || error || "").toLowerCase();
  return Boolean(run?.cancelled) || message.includes("interrompid") || message.includes("parada solicitada");
}

function beginReportRow(run, { index, value, sourceName, total }) {
  if (!run.report) run.report = { sourceName: "", rows: [], summary: {} };
  run.report.sourceName = String(sourceName || run.report.sourceName || "valor");
  const entry = {
    index: Math.max(1, Number(index) || 1),
    value: String(value ?? ""),
    total: Math.max(0, Number(total) || 0),
    startedAt: new Date().toISOString(),
    finishedAt: "",
    success: null,
    status: "",
    tone: "",
    result: "",
    error: ""
  };
  run.report.rows.push(entry);
  run.reportCurrentRow = entry;
  return entry;
}

function finalizeReportRow(run, success, error = "") {
  const entry = run.reportCurrentRow;
  if (!entry) return;
  entry.success = Boolean(success);
  entry.error = String(error || "").trim();
  entry.finishedAt = new Date().toISOString();
  const interrupted = !entry.success && runWasInterrupted(run, error);
  if (!entry.status) entry.status = entry.success ? "Concluida" : (interrupted ? "Interrompida" : "Falhou");
  if (!entry.tone) entry.tone = entry.success ? "success" : (interrupted ? "warning" : "danger");
  if (!entry.result) {
    entry.result = entry.success
      ? "Todas as etapas da linha foram executadas."
      : (interrupted ? "Execucao interrompida pelo usuario." : (entry.error || "Falha durante a execucao desta linha."));
  }
  delete run.reportCurrentRow;
}

function spreadsheetRowData(source, row) {
  const value = source?.rows?.[row];
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function spreadsheetColumnValue(rowData, column) {
  const requested = String(column || "").trim();
  if (!requested || !rowData || typeof rowData !== "object") return "";
  if (Object.prototype.hasOwnProperty.call(rowData, requested)) return String(rowData[requested] ?? "").trim();
  const normalized = requested.toLocaleLowerCase();
  const key = Object.keys(rowData).find((name) => String(name).trim().toLocaleLowerCase() === normalized);
  return key ? String(rowData[key] ?? "").trim() : "";
}

function reportColumnValue(rowData, column, variables = {}) {
  const selected = spreadsheetColumnValue(rowData, column);
  if (selected) return selected;
  const requested = String(column || "").trim();
  return requested ? String(variables?.[requested] ?? "").trim() : "";
}

function reportStepForRow(rawStep, variables = {}, rowData = {}) {
  const reportColumn = String(rawStep?.report_column || "").trim();
  const itemValue = reportColumnValue(rowData, reportColumn, variables);
  const reportVariables = itemValue ? { ...variables, empresa: itemValue } : variables;
  const step = replaceVariables(rawStep, reportVariables);
  // Resultado e status pertencem ao bloco. Somente a empresa pode vir
  // de outra coluna da mesma linha da planilha.
  delete step.result_column;
  delete step.confirmation_column;
  delete step.confirmation;
  return step;
}

function recordReportResult(run, step) {
  if (!run.report) run.report = { sourceName: "", rows: [], summary: {} };
  const result = {
    status: String(step.status || "Concluida").trim() || "Concluida",
    tone: reportTone(step.tone),
    result: String(step.result || "").trim()
  };
  if (run.reportCurrentRow) {
    const reportColumn = String(step.report_column || "").trim();
    const selectedValue = spreadsheetColumnValue(run.spreadsheetLoop?.rowData, reportColumn);
    if (reportColumn) {
      run.report.sourceName = reportColumn;
      if (selectedValue) run.reportCurrentRow.value = selectedValue;
    }
    Object.assign(run.reportCurrentRow, result);
  } else {
    run.report.summary = result;
  }
  return result;
}

function registerRunFailureInReport(run, error) {
  const message = String(error?.message || error || "Falha durante a execucao.").trim();
  if (run.reportCurrentRow) {
    finalizeReportRow(run, false, message);
    return;
  }
  if (!run.report) run.report = { sourceName: "", rows: [], summary: {} };
  if (!run.report.rows.length) {
    beginReportRow(run, { index: 1, value: "Execucao", sourceName: "Execucao", total: 1 });
    finalizeReportRow(run, false, message);
  }
}

function timeoutDaPagina(message, fallback = 12000) {
  return Math.max(2000, Math.min(30000, Number(message?.step?.timeout_ms || fallback)));
}

async function esperarAbaPronta(tabId, timeoutMs) {
  const limite = Date.now() + Math.max(1000, Number(timeoutMs || 12000));
  let ultimoErro = null;
  while (Date.now() < limite) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (!tab.url?.startsWith("http://") && !tab.url?.startsWith("https://")) {
        ultimoErro = new Error("Abra uma página HTTP ou HTTPS para executar a automação.");
      } else if (tab.status === "complete") {
        return tab;
      }
    } catch (error) {
      ultimoErro = error;
    }
    await sleep(140);
  }
  if (ultimoErro) throw ultimoErro;
  throw new Error("A página demorou mais que o tempo configurado para carregar.");
}

async function sendToPage(tabId, message) {
  const versionedMessage = {
    ...message,
    type: String(message?.type || "") + "-v2"
  };
  const limite = Date.now() + timeoutDaPagina(versionedMessage);
  let ultimoErro = null;
  while (Date.now() < limite) {
    try {
      await esperarAbaPronta(tabId, Math.min(1200, Math.max(250, limite - Date.now())));
      const contentRuntime = await chrome.tabs.sendMessage(tabId, {
        type: "flowdetect-content-runtime-v2"
      }).catch(() => null);
      if (!contentRuntime) {
        ultimoErro = new Error("Recarregue a pagina do site apos atualizar a extensao FlowDetect.");
        await sleep(180);
        continue;
      }
      if (contentRuntime.version !== CONTENT_RUNTIME_VERSION) {
        const error = new Error("A aba ainda usa uma versao antiga do FlowDetect. Recarregue a pagina do site apos atualizar a extensao e inicie a automacao novamente.");
        error.flowdetectContentRuntimeMismatch = true;
        throw error;
      }
      const resposta = await chrome.tabs.sendMessage(tabId, versionedMessage);
      if (resposta) return resposta;
      ultimoErro = new Error("A página ainda está inicializando.");
    } catch (error) {
      if (error?.flowdetectContentRuntimeMismatch) throw error;
      ultimoErro = error;
    }
    await sleep(180);
  }
  const error = new Error(`A página ainda não respondeu após recarregar. ${String(ultimoErro?.message || "Tente executar novamente.")}`);
  error.flowdetectContentRuntimeMismatch = /Recarregue a pagina do site/.test(String(ultimoErro?.message || ""));
  throw error;
}

async function aguardarTransicaoDaPagina(tabId, timeoutMs) {
  await sleep(160);
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (tab?.status === "loading") await esperarAbaPronta(tabId, timeoutMs);
}

function replaceVariables(value, variables) {
  if (typeof value === "string") {
    return Object.entries(variables || {}).reduce((result, [name, item]) => (
      result.split(`{{${name}}}`).join(String(item)).split(`{${name}}`).join(String(item))
    ), value);
  }
  if (Array.isArray(value)) return value.map((item) => replaceVariables(item, variables));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceVariables(item, variables)]));
  }
  return value;
}

function setSpreadsheetRowVariables(run, source, row) {
  if (!run.variables) run.variables = {};
  for (const name of Object.keys(run.capturedVariables || {})) delete run.variables[name];
  run.capturedVariables = {};
  const value = String(source?.values?.[row] ?? "");
  const sourceName = String(source?.name || "valor").trim() || "valor";
  const rowData = spreadsheetRowData(source, row);
  const line = String(Math.max(1, Number(row) + 1));
  Object.entries(rowData).forEach(([name, item]) => {
    const key = String(name || "").trim();
    if (key) run.variables[key] = String(item ?? "");
  });
  run.variables[sourceName] = value;
  run.variables.valor = value;
  run.variables.empresa = spreadsheetColumnValue(rowData, "empresa") || (source?.tableSource ? run.variables.empresa || '' : value);
  run.variables.linha_atual = line;
  run.variables.linha = line;
  return value;
}

async function bitmapForDataUrl(dataUrl) {
  if (!dataUrl) throw new Error("Imagem de referência ausente.");
  if (!imageBitmapCache.has(dataUrl)) {
    imageBitmapCache.set(dataUrl, fetch(dataUrl).then((response) => response.blob()).then((blob) => createImageBitmap(blob)));
  }
  return imageBitmapCache.get(dataUrl);
}

async function bitmapFromCapture(dataUrl) {
  const response = await fetch(dataUrl);
  return createImageBitmap(await response.blob());
}

function imageDataFromBitmap(bitmap, maxDimension = 980, scale = 1) {
  const baseScale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(2, Math.round(bitmap.width * baseScale * scale));
  const height = Math.max(2, Math.round(bitmap.height * baseScale * scale));
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0, width, height);
  return { image: context.getImageData(0, 0, width, height), width, height, scale: baseScale * scale, originalWidth: bitmap.width, originalHeight: bitmap.height };
}

function scaledImageData(bitmap, scale = 1) {
  const width = Math.max(2, Math.round(bitmap.width * scale));
  const height = Math.max(2, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0, width, height);
  return { image: context.getImageData(0, 0, width, height), width, height, scale };
}

function templateSamples(image) {
  const cols = 11;
  const rows = 8;
  const samples = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = Math.max(0, Math.min(image.width - 1, Math.round(((col + .5) / cols) * (image.width - 1))));
      const y = Math.max(0, Math.min(image.height - 1, Math.round(((row + .5) / rows) * (image.height - 1))));
      const index = (y * image.width + x) * 4;
      if (image.data[index + 3] < 72) continue;
      samples.push({ x, y, r: image.data[index], g: image.data[index + 1], b: image.data[index + 2] });
    }
  }
  if (samples.length < 12) throw new Error("A imagem de referência é transparente ou pequena demais.");
  return samples;
}

function scoreAt(source, x, y, samples) {
  let difference = 0;
  for (const sample of samples) {
    const index = ((y + sample.y) * source.width + (x + sample.x)) * 4;
    difference += Math.abs(source.data[index] - sample.r);
    difference += Math.abs(source.data[index + 1] - sample.g);
    difference += Math.abs(source.data[index + 2] - sample.b);
  }
  return 1 - (difference / (samples.length * 3 * 255));
}

function findTemplateInImage(source, template) {
  const samples = templateSamples(template.image);
  const stride = Math.max(2, Math.round(Math.min(template.width, template.height) / 32));
  let best = { score: -1, x: 0, y: 0 };
  for (let y = 0; y <= source.height - template.height; y += stride) {
    for (let x = 0; x <= source.width - template.width; x += stride) {
      const score = scoreAt(source.image, x, y, samples);
      if (score > best.score) best = { score, x, y };
    }
  }
  return {
    ...best,
    width: template.width,
    height: template.height,
    centerX: (best.x + (template.width / 2)) / source.scale,
    centerY: (best.y + (template.height / 2)) / source.scale
  };
}

async function ensureCaptureDocument() {
  if (creatingCaptureDocument) return creatingCaptureDocument;
  creatingCaptureDocument = (async () => {
    const url = chrome.runtime.getURL("capture-offscreen.html");
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [url]
    });
    if (!contexts.length) {
      await chrome.offscreen.createDocument({
        url: "capture-offscreen.html",
        reasons: ["USER_MEDIA"],
        justification: "Reconhecer imagens da aba escolhida durante a automacao."
      });
    }
  })();
  try {
    await creatingCaptureDocument;
  } finally {
    creatingCaptureDocument = null;
  }
}

async function startTabCapture(run) {
  await ensureCaptureDocument();
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: run.tabId });
  const response = await chrome.runtime.sendMessage({
    target: "flowdetect-offscreen",
    type: "flowdetect-capture-start",
    runId: run.id,
    streamId
  });
  if (!response?.ok) throw new Error(response?.error || "A captura da aba nao iniciou.");
  run.captureMode = "tab";
}

async function stopTabCapture(run) {
  if (!run?.id) return;
  await chrome.runtime.sendMessage({
    target: "flowdetect-offscreen",
    type: "flowdetect-capture-stop",
    runId: run.id
  }).catch(() => null);
}

async function activeTabForWindow(windowId) {
  const [active] = await chrome.tabs.query({ windowId, active: true });
  return active;
}

function captureUnavailable(message) {
  const error = new Error(message);
  error.flowdetectCaptureUnavailable = true;
  return error;
}

async function waitForActiveTargetTab(run) {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (run.cancelled) throw new Error("Execucao interrompida pelo usuario.");
    const tab = await chrome.tabs.get(run.tabId).catch(() => null);
    if (!tab) throw captureUnavailable("A aba da automacao foi fechada; nao foi possivel continuar a captura.");
    const active = await activeTabForWindow(tab.windowId);
    if (active?.id === run.tabId) {
      if (run.captureWaiting) {
        delete run.captureWaiting;
        await addLog(run, "A aba da automacao voltou a ficar disponivel; retomando o reconhecimento.", "info");
      }
      return tab;
    }
    if (!run.captureWaiting) {
      run.captureWaiting = true;
      await addLog(run, "Aguardando a imagem da aba da automacao. O bloco nao sera avaliado com outra aba.", "warning");
    }
    await sleep(600);
  }
  throw captureUnavailable("A captura da aba da automacao ficou indisponivel por 2 minutos. Nenhum resultado visual foi confirmado.");
}

async function captureImage(run) {
  const cursor = await chrome.tabs.sendMessage(run.tabId, {type:'flowdetect-cursor-suspend'}).catch(()=>null);
  if(cursor?.visible) await new Promise(resolve=>setTimeout(resolve,50));
  try { return await captureImageWithoutCursor(run); }
  finally { await chrome.tabs.sendMessage(run.tabId, {type:'flowdetect-cursor-resume'}).catch(()=>{}); }
}

async function captureImageWithoutCursor(run) {
  if (run.captureMode === "tab") {
    try {
      const response = await chrome.runtime.sendMessage({
        target: "flowdetect-offscreen",
        type: "flowdetect-capture-frame",
        runId: run.id
      });
      if (!response?.ok || !response.dataUrl) throw new Error(response?.error || "A captura da aba parou.");
      const bitmap = await bitmapFromCapture(response.dataUrl);
      const source = imageDataFromBitmap(bitmap);
      source.originalWidth = Number(response.width) || bitmap.width;
      source.originalHeight = Number(response.height) || bitmap.height;
      source.scale = source.width / source.originalWidth;
      bitmap.close?.();
      return source;
    } catch (error) {
      run.captureMode = "visible";
      await stopTabCapture(run);
      await addLog(run, `A captura vinculada a aba parou: ${String(error?.message || error)}. Aguardando a aba correta para continuar.`, "warning");
    }
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const tab = await waitForActiveTargetTab(run);
    let dataUrl;
    try {
      dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    } catch (error) {
      throw captureUnavailable(`Nao foi possivel capturar a aba da automacao: ${String(error?.message || error)}`);
    }
    if ((await activeTabForWindow(tab.windowId))?.id !== run.tabId) continue;
    const bitmap = await bitmapFromCapture(dataUrl);
    const source = imageDataFromBitmap(bitmap);
    bitmap.close?.();
    return source;
  }
  throw captureUnavailable("A aba ativa mudou durante a captura. Nenhum resultado visual foi confirmado.");
}

async function findVisualMatch(run, asset, capturedSource = null) {
  const [source, originalTemplate] = await Promise.all([capturedSource || captureImage(run), bitmapForDataUrl(asset?.data_url)]);
  let best = { score: -1 };
  for (const requestedScale of [.74, .87, 1, 1.15, 1.32]) {
    const template = scaledImageData(originalTemplate, source.scale * requestedScale);
    if (template.width > source.width || template.height > source.height) continue;
    const candidate = findTemplateInImage(source, template);
    if (candidate.score > best.score) best = candidate;
  }
  if (best.score < 0) throw new Error("A imagem de referência é maior do que a área visível da aba.");
  return {
    ...best,
    screenshotWidth: source.originalWidth,
    screenshotHeight: source.originalHeight,
    screenshotScale: source.scale
  };
}

async function waitForVisualMatch(run, step, asset) {
  await chrome.tabs.sendMessage?.(run.tabId, {type:'flowdetect-cursor-analysis',active:true}).catch(()=>{});
  try {
  const interval = Math.max(180, Number(step.interval_ms || 550));
  const timeout = Math.max(500, Number(step.timeout_ms || 10000));
  const attempts = Math.max(Number(step.attempts || 1), Math.ceil(timeout / interval));
  const confidence = Math.max(.35, Math.min(.99, Number(step.confidence || .8)));
  let best = { score: -1 };
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (run.cancelled) throw new Error("Execução interrompida pelo usuário.");
    const candidate = await findVisualMatch(run, asset);
    if (candidate.score > best.score) best = candidate;
    if (candidate.score >= confidence) return candidate;
    if (attempt < attempts - 1) await sleep(interval);
  }
  throw new Error(`Referência visual não encontrada. Melhor similaridade: ${Math.max(0, best.score * 100).toFixed(0)}%.`);
  } finally {
    await chrome.tabs.sendMessage?.(run.tabId, {type:'flowdetect-cursor-analysis',active:false}).catch(()=>{});
  }
}

async function clickVisualResult(run, step, match, label = "VISUAL") {
  const viewport = await sendToPage(run.tabId, { type: "flowdetect-viewport-info" });
  if (!viewport?.ok) throw new Error("Não foi possível calcular a posição visual na página.");
  const screenshotScaleX = Number(match.screenshotWidth || 0) / Math.max(1, Number(viewport.width || 1));
  const screenshotScaleY = Number(match.screenshotHeight || 0) / Math.max(1, Number(viewport.height || 1));
  const x = match.centerX / screenshotScaleX + Number(step.offset_x || 0);
  const y = match.centerY / screenshotScaleY + Number(step.offset_y || 0);
  const response = await sendToPage(run.tabId, {
    type: "flowdetect-click-coordinate",
    x,
    y,
    clicks: step.click ? Math.max(1, Number(step.clicks || 1)) : 0,
    timeout_ms: Math.max(500, Number(step.timeout_ms || 10000)),
    label,
    color: label === "OCR" ? (run.pageColor || "#12b5cb") : "#cf8cff",
    width: (match.width / Math.max(.001, match.screenshotScale || 1)) / screenshotScaleX,
    height: match.height / screenshotScaleY
  });
  if (!response?.ok) throw new Error(response?.error || "Não foi possível destacar o reconhecimento visual.");
  return { x, y, response };
}

async function executeVisualMatch(run, step) {
  const match = await waitForVisualMatch(run, step, step.image);
  const result = await clickVisualResult(run, step, match, "VISUAL");
  if (step.click) await aguardarTransicaoDaPagina(run.tabId, step.timeout_ms || 12000);
  return `Visual encontrado (${(match.score * 100).toFixed(0)}%)${step.click ? " e clicado" : ""} em ${Math.round(result.x)}, ${Math.round(result.y)}.`;
}

async function executeVisualState(run, step) {
  await chrome.tabs.sendMessage?.(run.tabId, {type:'flowdetect-cursor-analysis',active:true}).catch(()=>{});
  try {
  const candidates = [];
  if (step.active_image) candidates.push({ state: "ativo", asset: step.active_image });
  if (step.inactive_image) candidates.push({ state: "desativado", asset: step.inactive_image });
  const source = await captureImage(run);
  const results = await Promise.all(candidates.map(async (candidate) => ({ ...candidate, match: await findVisualMatch(run, candidate.asset, source) })));
  const best = results.sort((first, second) => second.match.score - first.match.score)[0];
  const confidence = Math.max(.35, Math.min(.99, Number(step.confidence || .85)));
  if (!best || best.match.score < confidence) throw new Error(`Não identifiquei o estado de ${step.name || "botão"}.`);
  await clickVisualResult(run, { ...step, click: false }, best.match, "ESTADO");
  return {
    message: `${step.name || "Botão"}: ${best.state} (${(best.match.score * 100).toFixed(0)}%).`,
    flow: step.state_flows?.[best.state] || step.on_success
  };
  } finally {
    await chrome.tabs.sendMessage?.(run.tabId, {type:'flowdetect-cursor-analysis',active:false}).catch(()=>{});
  }
}

async function executePageStep(run, step) {
  const response = await sendToPage(run.tabId, {
    type: "flowdetect-execute-step",
    step: { ...step, highlight_color: run.pageColor || "#12b5cb" },
    run_id: `${run.id}:${run.spreadsheetLoop?.row ?? ""}`,
  });
  if (!response?.ok) throw new Error(response?.error || "A etapa não foi concluída.");
  if (response.capture) {
    const {name,value} = response.capture;
    if (name !== step.variable_capture?.name || !/^[A-Za-z_][A-Za-z0-9_]{0,47}$/.test(name) || typeof value!=='string') throw Error('Resposta de captura inválida.');
    run.variables[name]=value;
    (run.capturedVariables ||= {})[name]=value;
    await addLog(run, `Variável {{${name}}} capturada: ${value}`, 'info');
  }
  await aguardarTransicaoDaPagina(run.tabId, step.timeout_ms || 12000);
  return response.message || "Etapa concluída.";
}

function normalizedOcrTargetAction(value) {
  const action = String(value || "continuar").trim().toLowerCase();
  if (["continue", "seguir"].includes(action)) return "continuar";
  if (["click", "clique"].includes(action)) return "clicar";
  if (["click_and_jump", "click_goto", "clicar_e_ir_para_bloco"].includes(action)) return "clicar_ir_para_bloco";
  if (["confirm_and_jump", "confirm_goto", "confirmar_e_ir_para_bloco", "ir_para_bloco", "bloco", "navegar"].includes(action)) return "confirmar_ir_para_bloco";
  return action || "continuar";
}

async function updateOcrLive(run, targets, targetIndex, state, detail, flow = null) {
  const entry = run.recentSteps?.at(-1);
  if (!entry || entry.index !== run.currentIndex) return;
  if (!Array.isArray(entry.ocrChecks)) {
    entry.ocrChecks = targets.map((target) => ({ text: String(target.text || ""), state: "pending" }));
  }
  entry.ocrChecks[targetIndex] = { text: String(targets[targetIndex].text || ""), state };
  entry.message = detail;
  if (flow) entry.route = flowContinues(flow) ? flowLabel(flow) : "Regra: parar automacao.";
  await persistRun(run);
}

async function executeOcrTargets(run, step) {
  const targets = Array.isArray(step.ocr_targets)
    ? step.ocr_targets.filter((target) => String(target?.text || "").trim())
    : [];
  if (!targets.length) return null;

  // Neste padrao o primeiro OCR e o rotulo do campo; o segundo decide a rota.
  // Se o rotulo esta visivel, nao clique nele: verifique diretamente o mes/ano
  // e respeite a rota de falha do OCR 2 caso o valor seja diferente.
  const finalTarget = targets.at(-1);
  const finalAction = normalizedOcrTargetAction(finalTarget.action);
  let startTargetIndex = 0;
  if (targets.length === 2 && normalizedOcrTargetAction(targets[0].action) === "clicar"
      && String(targets[0].on_success?.action || "continuar").toLowerCase() === "continuar"
      && finalAction === "confirmar_ir_para_bloco" && !finalTarget.click
      && /^(0?[1-9]|1[0-2])\s*[/.-]\s*20\d{2}$/.test(String(finalTarget.text).trim())) {
    try {
      await updateOcrLive(run, targets, 0, "checking", `Validando OCR 1/${targets.length}: ${targets[0].text}`);
      await executePageStep(run, {
        ...step, ...targets[0], type: "ocr_text", text: String(targets[0].text).trim(),
        action: "confirmar", click: false, timeout_ms: 800, ocr_targets: undefined
      });
      await updateOcrLive(run, targets, 0, "found", `OCR 1/${targets.length} encontrado. Validando a competencia.`);
      startTargetIndex = 1;
    } catch (error) {
      if (run.cancelled || !/OCR nao encontrou o texto/i.test(String(error?.message || ""))) throw error;
      await updateOcrLive(run, targets, 0, "not_found", `OCR 1/${targets.length} nao encontrado; seguindo a regra configurada.`);
    }
  }

  for (let targetIndex = startTargetIndex; targetIndex < targets.length; targetIndex += 1) {
    const target = targets[targetIndex];
    const isLastTarget = targetIndex === targets.length - 1;
    const action = normalizedOcrTargetAction(target.action);
    const targetStep = {
      ...step,
      ...target,
      type: "ocr_text",
      variable_capture: targetIndex === 0 ? step.variable_capture : undefined,
      text: String(target.text || "").trim(),
      click: Boolean(target.click),
      clicks: Math.max(1, Number(target.clicks || 1)),
      ocr_targets: undefined
    };

    try {
      await updateOcrLive(run, targets, targetIndex, "checking", `Procurando OCR ${targetIndex + 1}/${targets.length}: ${targetStep.text}`);
      const message = await executePageStep(run, targetStep);
      await updateOcrLive(run, targets, targetIndex, "found", `OCR ${targetIndex + 1}/${targets.length} encontrado: ${targetStep.text}`);
      if ((action === "continuar" || (action === "clicar" &&
          String(target.on_success?.action || "continuar").toLowerCase() === "continuar")) && !isLastTarget) {
        await addLog(run, `OCR ${targetIndex + 1} confirmado; procurando OCR ${targetIndex + 2} conforme a regra do bloco.`, "info");
        continue;
      }
      return { message, flow: target.on_success || step.on_success };
    } catch (error) {
      if (run.cancelled || error?.flowdetectCaptureUnavailable || error?.flowdetectContentRuntimeMismatch) throw error;
      const reason = String(error?.message || error || "");
      if (reason.includes("desativado") && reason.includes("clique")) {
        error.message = `OCR ${targetIndex + 1} encontrou o texto, mas o alvo ficou desativado. ${reason}`;
        error.flowdetectOcrTargetFailure = true;
        throw error;
      }
      const flow = target.on_failure || step.on_failure;
      const detail = /OCR nao encontrou o texto/i.test(reason)
        ? `OCR ${targetIndex + 1} nao encontrou o texto: ${targetStep.text}.`
        : `OCR ${targetIndex + 1} falhou em "${targetStep.text}": ${reason}`;
      await updateOcrLive(run, targets, targetIndex, "not_found", detail, flow);
      if (String(flow?.action || "continuar").toLowerCase() === "continuar" && !isLastTarget) {
        await addLog(run, `${detail} Procurando OCR ${targetIndex + 2} conforme a regra do bloco.`, "warning");
        continue;
      }
      if (flowContinues(flow)) {
        await addLog(run, `${detail} ${flowLabel(flow)}`, "warning");
        return { message: detail, flow, level: "warning" };
      }
      error.message = `${detail} Regra configurada: parar automacao.`;
      error.flowdetectOcrTargetFailure = true;
      throw error;
    }
  }
  throw new Error("Nenhum OCR configurado confirmou o alvo.");
}

async function executeStep(run, rawStep) {
  if(rawStep.type==='table_read'){
    const config=replaceVariables(rawStep.table,run.variables);
    const tableCommand=async(message)=>{
      if(run.cancelled)throw Error('Execução interrompida.');
      const mutating=['flowdetect-table-click','flowdetect-table-return'].includes(message.type);
      const authorized=mutating&&message.runId===run.id&&Boolean(message.nonce)&&run.pendingTableClick===message.nonce;
      if(mutating&&!authorized)throw Error('A operação de clique não possui autorização válida nesta execução.');
      if(authorized)delete run.pendingTableClick;
      const operationId=message.nonce||`${run.id}:${Date.now()}:${Math.random()}`;
      const deadline=Date.now()+(message.type==='flowdetect-table-return'?20000:message.type==='flowdetect-table-preview'?5000:180000);
      const request={...message,operationId,deadline,authorized};
      let watchdog;
      const execute=async()=>{
      await chrome.scripting.executeScript({target:{tabId:run.tabId,frameIds:[0]},files:['automation-cursor.js','table-reader.js']});
      if(run.cancelled||Date.now()>=deadline)throw Error('A operação da tabela foi interrompida antes de iniciar.');
      if(message.type==='flowdetect-table-return'){
        const started=await chrome.scripting.executeScript({target:{tabId:run.tabId,frameIds:[0]},func:request=>{
          const operations=globalThis.__flowDetectTableOperations||=new Map();
          for(const [id,entry] of operations)if(entry.deadline&&entry.deadline<Date.now())operations.delete(id);
          const operation={aborted:false,used:false,state:'running',deadline:request.deadline,phase:'Iniciando o fechamento.'};operations.set(request.operationId,operation);
          const permit=async()=>{
            if(!request.authorized||operation.used||operation.aborted||Date.now()>=request.deadline)return false;
            operation.used=true;return true;
          };
          const dispatchClose=button=>new Promise((resolve,reject)=>{
            if(operation.aborted||Date.now()>=request.deadline){reject(Error('Fechamento interrompido antes do clique.'));return;}
            button.setAttribute('data-flowdetect-close-token',request.operationId);
            operation.clickRequest={token:request.operationId,signature:request.config.return_control.signature,origin:location.origin,pathname:location.pathname,deadline:request.deadline};
            operation.phase='Botão validado; enviando o clique no contexto da página.';
            operation.resolveClick=result=>{
              button.removeAttribute('data-flowdetect-close-token');delete operation.clickRequest;delete operation.resolveClick;
              result?.ok?resolve():reject(Error(result?.error||'O portal não confirmou o envio do clique.'));
            };
          });
          // Retain the task in the tab and return only a synchronous receipt.
          // Closing the modal must not own a long-lived injection response.
          operation.task=Promise.resolve().then(()=>globalThis.FlowDetectTables.returnToList(request.config,permit,phase=>{operation.phase=phase;},dispatchClose))
            .then(data=>{operation.response={ok:true,...data};operation.state='done';},error=>{operation.response={ok:false,error:String(error?.message||error)};operation.state='done';});
          return {operationId:request.operationId};
        },args:[request]});
        if(!started?.find(item=>item.frameId===0)?.result?.operationId)throw Error('Não foi possível iniciar o fechamento na aba. Nenhum clique será repetido.');
        let clickDispatched=false;
        while(!run.cancelled&&Date.now()<deadline){
          const polled=await chrome.scripting.executeScript({target:{tabId:run.tabId,frameIds:[0]},func:id=>{
            const operations=globalThis.__flowDetectTableOperations,op=operations?.get(id);
            if(!op)return {state:'missing'};
            const status={state:op.state,phase:op.phase,response:op.response,clickRequest:op.clickRequest};
            if(op.state==='done')operations.delete(id);
            return status;
          },args:[operationId]});
          const status=polled?.find(item=>item.frameId===0)?.result;
          if(!status||status.state==='missing')throw Error('A aba perdeu a tarefa de fechamento. Nenhum clique será repetido.');
          if(status.phase&&run.tableOperationPhase!==status.phase){
            run.tableOperationPhase=status.phase;
            if(typeof persistRun==='function')await persistRun(run);
          }
          if(status.clickRequest&&!clickDispatched){
            if(run.cancelled||Date.now()>=deadline)throw Error('Fechamento interrompido antes do clique.');
            clickDispatched=true;
            if(!chrome.debugger?.attach)throw Error('O fechamento nativo precisa da permissão debugger. Recarregue e habilite a extensão atualizada no Chrome.');
            const target={tabId:run.tabId};let attached=false;
            let clickResult;
            try{
            await chrome.debugger.attach(target,'1.3');attached=true;
            await chrome.debugger.sendCommand(target,'Emulation.setFocusEmulationEnabled',{enabled:true});
            let point=null,lastPointError='',stablePoint='';
            for(let attempt=0;attempt<40&&!run.cancelled&&Date.now()<deadline;attempt++){
            const prepared=await chrome.scripting.executeScript({target:{tabId:run.tabId,frameIds:[0]},world:'MAIN',func:request=>{
              try{
                if(Date.now()>=request.deadline||location.origin!==request.origin||location.pathname!==request.pathname)throw Error('A página mudou antes do clique de fechar.');
                const matches=[...document.querySelectorAll('[data-flowdetect-close-token]')].filter(b=>b.getAttribute('data-flowdetect-close-token')===request.token);
                if(matches.length!==1)throw Error('O botão de fechar mudou antes do clique.');
                const b=matches[0],signature={tag:b.tagName.toLowerCase(),aria:b.getAttribute('aria-label')||'',title:b.getAttribute('title')||'',text:String(b.innerText??b.textContent??'').replace(/\s+/g,' ').trim(),icons:[...b.querySelectorAll('i,svg,[data-icon]')].map(i=>i.getAttribute('data-icon')||[...i.classList].filter(c=>/^(fa-|bi-|icon-)/.test(c)).sort().join(' ')).filter(Boolean).join('|')};
                if(!b.isConnected||!b.getClientRects().length||b.closest('[hidden],[aria-hidden="true"]')||b.disabled||b.getAttribute('aria-disabled')==='true'||!['tag','aria','title','text','icons'].every(k=>signature[k]===(request.signature[k]??'')))throw Error('O botão de fechar não está mais disponível com o mapeamento confirmado.');
                b.scrollIntoView({block:'nearest',inline:'nearest'});
                const r=b.getBoundingClientRect(),blockers=new Set();
                if(r.width<=0||r.height<=0)throw Error('O botão Fechar ainda não possui área visível.');
                const fractions=[[.5,.5],[.2,.2],[.8,.2],[.2,.8],[.8,.8],[.5,.2],[.5,.8],[.2,.5],[.8,.5]];
                for(const [fx,fy] of fractions){
                  const x=r.left+r.width*fx,y=r.top+r.height*fy;
                  if(x<0||y<0||x>=innerWidth||y>=innerHeight)continue;
                  const top=document.elementFromPoint(x,y);
                  if(top&&(top===b||b.contains(top)))return {ok:true,x,y};
                  if(top)blockers.add(top.tagName.toLowerCase()+'.'+[...top.classList].slice(0,4).join('.'));
                }
                throw Error('O botão Fechar está coberto. Elemento à frente: '+([...blockers].join(', ').slice(0,240)||'fora da área visível')+'. Nenhum clique foi enviado.');
              }catch(error){return {ok:false,error:String(error?.message||error)};}
            },args:[status.clickRequest]});
            const candidate=prepared?.find(item=>item.frameId===0)?.result;
            if(candidate?.ok){
              const position=candidate.x.toFixed(1)+':'+candidate.y.toFixed(1);
              if(position===stablePoint){point=candidate;break;}
              stablePoint=position;
            }else{stablePoint='';lastPointError=candidate?.error||'Não foi possível validar o botão antes do clique nativo.';}
            await new Promise(resolve=>setTimeout(resolve,100));
            }
            if(!point)throw Error(lastPointError||'O botão Fechar não estabilizou antes do clique nativo.');
            if(run.cancelled||Date.now()>=deadline)throw Error('Fechamento interrompido antes do clique nativo.');
            await chrome.scripting.executeScript({target:{tabId:run.tabId,frameIds:[0]},func:request=>{
              const button=[...document.querySelectorAll('[data-flowdetect-close-token]')].find(b=>b.getAttribute('data-flowdetect-close-token')===request.token);
              if(!button)throw Error('O botão mudou antes do clique nativo.');
              globalThis.__flowDetectNativeClick={runId:request.runId,target:button,expiresAt:Math.min(request.deadline,Date.now()+2000),types:['pointerdown','mousedown','pointerup','mouseup','click']};
            },args:[{token:operationId,runId:run.id,deadline}]});
            if(run.cancelled||Date.now()>=deadline)throw Error('Fechamento interrompido antes do clique nativo.');
            await chrome.debugger.sendCommand(target,'Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y});
            await chrome.scripting.executeScript({target:{tabId:run.tabId,frameIds:[0]},func:p=>{
              globalThis.FlowDetectCursor?.indicate(document.elementFromPoint(p.x,p.y),'Clique',p);
            },args:[point]});
            if(run.cancelled||Date.now()>=deadline)throw Error('Fechamento interrompido antes de pressionar o botão do mouse.');
            await chrome.debugger.sendCommand(target,'Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',buttons:1,clickCount:1});
            await chrome.debugger.sendCommand(target,'Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',buttons:0,clickCount:1});
            clickResult={ok:true};
            }finally{
              chrome.scripting.executeScript({target:{tabId:run.tabId,frameIds:[0]},func:()=>{delete globalThis.__flowDetectNativeClick;},args:[]}).catch(()=>{});
              if(attached){
                await chrome.debugger.sendCommand(target,'Emulation.setFocusEmulationEnabled',{enabled:false}).catch(()=>{});
                await chrome.debugger.detach(target).catch(()=>{});
              }
            }
            await chrome.scripting.executeScript({target:{tabId:run.tabId,frameIds:[0]},func:result=>{globalThis.__flowDetectTableOperations?.get(result.operationId)?.resolveClick?.(result.response);},args:[{operationId,response:clickResult}]});
          }
          if(status.state==='done')return [{frameId:0,result:status.response}];
          await new Promise(resolve=>setTimeout(resolve,100));
        }
        throw Error('O fechamento foi interrompido. '+(run.tableOperationPhase||''));
      }
      return chrome.scripting.executeScript({
        target:{tabId:run.tabId,frameIds:[0]},
        func:async request=>{
          const operations=globalThis.__flowDetectTableOperations||=new Map();
          const operation={aborted:false,used:false};operations.set(request.operationId,operation);
          try{
            const tables=globalThis.FlowDetectTables;
            if(!tables)throw Error('O leitor de tabelas não foi carregado nesta aba.');
            // The worker already authorized this isolated-world invocation.
            // No nested runtime message may block the click permission.
            const permit=async()=>{
              if(!request.authorized||operation.used||operation.aborted||Date.now()>=request.deadline)return false;
              operation.used=true;return true;
            };
            let data;
            if(request.type==='flowdetect-table-click'){await tables.waitReady(request.config);data=await tables.clickRow(request.config,permit);}
            else if(request.type==='flowdetect-table-preview')data=tables.describe(await tables.waitReady({...request.config,wait_ready:false,allow_empty:true}));
            else data=await tables.read(request.config);
            return {ok:true,...data};
          }catch(error){return {ok:false,error:String(error?.message||error)};}
          finally{operations.delete(request.operationId);}
        },args:[request]
      });
      };
      let results;
      try{
        results=await Promise.race([execute(),new Promise((_,reject)=>{
          watchdog=setInterval(()=>{
            if(!run.cancelled&&Date.now()<deadline)return;
            clearInterval(watchdog);
            chrome.scripting.executeScript({target:{tabId:run.tabId,frameIds:[0]},func:id=>{const op=globalThis.__flowDetectTableOperations?.get(id);if(op){op.aborted=true;op.resolveClick?.({ok:false,error:'Fechamento interrompido.'});}},args:[operationId]}).catch(()=>{});
            reject(Error(run.cancelled?'Execução interrompida.':'Tempo limite da operação da tabela. '+(run.tableOperationPhase||'Sem confirmação de início na aba.')+' A execução parou; nenhum clique será repetido automaticamente.'));
          },100);
        })]);
      }catch(error){
        if(message.type==='flowdetect-table-return')chrome.scripting.executeScript({target:{tabId:run.tabId,frameIds:[0]},func:id=>{const op=globalThis.__flowDetectTableOperations?.get(id);if(op){op.aborted=true;op.resolveClick?.({ok:false,error:'Fechamento interrompido.'});}},args:[operationId]}).catch(()=>{});
        throw error;
      }finally{clearInterval(watchdog);delete run.tableOperationPhase;}
      if(run.cancelled)throw Error('Execução interrompida.');
      if(Date.now()>=deadline)throw Error('Tempo limite da operação da tabela. O resultado atrasado não será usado.');
      const response=results?.find(item=>item.frameId===0)?.result;
      if(!response)throw Error('A aba perdeu a conexão durante a operação da tabela. Nenhum clique será repetido automaticamente.');
      return response;
    };
    if(config.mode==='export'){
      const bundle=run.tableCollections?.[config.variable]||{groups:{},guides:[]};
      const records=Object.values(bundle.groups).flat();
      run.variables[config.variable]=JSON.stringify(records);
      if(config.xlsx)await chrome.downloads.download({url:tableWorkbookDataUrl(bundle.guides,records),filename:`FlowDetect/${config.variable}.xlsx`,saveAs:false,conflictAction:'uniquify'});
      if(config.csv){
        const quote=value=>'"'+String(value??'').replaceAll('"','""').replace(/^[\s]*[=+@-]/,"'"+'$&')+'"';
        for(const [label,rows] of [['Guias',bundle.guides],['Detalhamento',records]]){
          const columns=[...new Set(rows.flatMap(row=>Object.keys(row)))];
          const csv='\uFEFF'+[columns,...rows.map(row=>columns.map(c=>row[c]))].map(row=>row.map(quote).join(';')).join('\r\n');
          await chrome.downloads.download({url:'data:text/csv;charset=utf-8,'+encodeURIComponent(csv),filename:`FlowDetect/${config.variable}_${label}.csv`,saveAs:false});
        }
      }
      return `Coleta concluída: ${bundle.guides.length} guia(s), ${records.length} linha(s) de detalhes.`;
    }
    if(config.mode==='return'){
      if(run.cancelled)throw Error('Execução interrompida.');
      if(config.return_mode==='back')await chrome.tabs.goBack(run.tabId);
      else{
        const nonce=crypto.randomUUID();run.pendingTableClick=nonce;let result;
        try{result=await tableCommand({type:'flowdetect-table-return',config,runId:run.id,nonce});}finally{delete run.pendingTableClick;}
        if(!result?.ok||!result.returned)throw Error(result?.error||'Não foi possível fechar o detalhe.');
      }
      let lastTableError='';
      for(let i=0;i<75;i++){
        if(run.cancelled)throw Error('Execução interrompida.');
        try{const p=await tableCommand({type:'flowdetect-table-preview',config:{descriptor:config.descriptor}});if(p?.ok)return 'Detalhe fechado; lista de guias disponível para a próxima linha.';lastTableError=p?.error||'';}catch(error){lastTableError=String(error.message||error);}
        await sleep(200);
      }throw Error('A lista de guias não reapareceu após fechar o detalhe. '+lastTableError);
    }
    if(config.mode==='click'){
      if(run.cancelled)throw Error('Execução interrompida pelo usuário.');
      if(String(config.match_value||'').includes('{{'))throw Error(`A variável da linha ${config.match_value} ainda não foi preenchida. Leia a lista e crie o loop antes deste clique. Para o percurso automático, mapeie a tabela do detalhe e use Criar percurso no mapa.`);
      const nonce=crypto.randomUUID();run.pendingTableClick=nonce;
      let result;
      try{result=await tableCommand({type:'flowdetect-table-click',config,runId:run.id,nonce});}finally{delete run.pendingTableClick;}
      if(!result?.ok||!result.clicked)throw Error(result?.error||'O botão da linha não confirmou o clique.');
      if(config.traversal_id)(run.tableContexts||={})[config.traversal_id]={company:String(config.company||run.variables.empresa||''),key:String(config.match_value),guide:{...(run.spreadsheetLoop?.rowData||{})}};
      return `Tabela: ${result.action} — ${result.key}: ${result.value}.`;
    }
    const name=config.variable;
    if(!/^[A-Za-z_][A-Za-z0-9_]{0,47}$/.test(name)||['__proto__','constructor','prototype'].includes(name))throw Error('Nome de variável da tabela inválido.');
    delete run.variables[name];if(run.capturedVariables)delete run.capturedVariables[name];
    if(config.prepare_loop)run.dataSource=null;
    const readConfig=config.accumulate?{...config,expected_guide:run.tableContexts?.[config.traversal_id]?.key}:config;
    let result;
    try{result=await tableCommand({type:'flowdetect-table-read',config:readConfig});}
    catch(error){
      if(/message channel closed|context invalidated|receiving end does not exist/i.test(String(error?.message||error)))throw Error('A comunicação com a aba foi interrompida durante a captura. A coleta parou sem avançar para outra guia. Recarregue o FGTS e confira se há somente uma execução nesta aba.');
      throw error;
    }
    if(!result?.ok)throw Error(result?.error||'Falha ao ler a tabela.');
    if(typeof result.value!=='string'||result.value.length>2000000)throw Error('Resultado da tabela excedeu o limite.');
    run.variables[name]=result.value;(run.capturedVariables ||= {})[name]=result.value;
    if(config.prepare_loop && config.mode!=='value'){
      if(config.key_column&&!result.columns.includes(config.key_column))throw Error('Inclua a coluna identificadora na leitura da lista.');
      if(config.traversal_id){const keys=result.rows.map(row=>String(row[config.key_column]??'').trim());if(keys.some(k=>!k)||new Set(keys).size!==keys.length)throw Error('A lista contém identificadores vazios ou repetidos. Nenhuma guia foi aberta.');}
      run.dataSource={name:name+'_linha',values:result.rows.map(row=>String(row[config.key_column||result.columns[0]]??'')),rows:result.rows,index:run.currentIndex,interval:0,tableSource:true,allowEmpty:!!config.traversal_id};
      if(config.traversal_id){
        const company=String(config.company||run.variables.empresa||'');if(company.includes('{{'))throw Error('A variável da empresa ainda não foi preenchida.');
        const bundle=(run.tableCollections||={})[config.collection]||={groups:{},guides:[]};
        const indexed=new Map(bundle.guides.map(row=>[JSON.stringify([row.Empresa,row[config.key_column]]),row]));
        for(const row of result.rows){const id=JSON.stringify([company,row[config.key_column]]);indexed.set(id,{'Captura do detalhe':'Aguardando',...indexed.get(id),...row,Empresa:company,'Número da Guia':String(row[config.key_column])});}
        bundle.guides=[...indexed.values()];
        if(bundle.guides.length>10000||JSON.stringify(bundle.guides).length>2000000)throw Error('A lista consolidada de guias excedeu o limite de dados.');
      }
    }
    if(config.accumulate){
      const context=run.tableContexts?.[config.traversal_id];if(!context)throw Error('O detalhe não possui uma guia de origem.');
      const bundle=(run.tableCollections||={})[name];if(!bundle)throw Error('Inicie a coleta pela lista de guias.');
      const rows=result.rows.map(row=>Object.fromEntries([['Empresa',context.company],['Número da Guia',context.key],...Object.entries(row).map(([k,v])=>['Detalhe · '+k,v])]));
      bundle.groups[JSON.stringify([context.company,context.key])]=rows;
      for(const guide of bundle.guides)if(guide.Empresa===context.company&&guide['Número da Guia']===context.key){guide['Captura do detalhe']='Concluída';guide['Linhas do detalhe']=rows.length;}
      const total=Object.values(bundle.groups).flat();if(total.length>10000||JSON.stringify(total).length>2000000)throw Error('A coleta completa excedeu o limite de dados.');
      run.variables[name]=JSON.stringify(total);run.capturedVariables[name]=run.variables[name];
    }
    if(config.csv){
      const quote=value=>'"'+String(value??'').replaceAll('"','""').replace(/^[=+@-]/,"'"+'$&')+'"';
      const csv='\uFEFF'+[result.columns,...result.rows.map(row=>result.columns.map(c=>row[c]))].map(row=>row.map(quote).join(';')).join('\r\n');
      await chrome.downloads.download({url:'data:text/csv;charset=utf-8,'+encodeURIComponent(csv),filename:`FlowDetect/${name}.csv`,saveAs:false});
    }
    return `Tabela capturada: ${result.row_count} linha(s) em {{${name}}}.`;
  }
  if(rawStep.variable_capture?.enabled) {
    delete run.variables[rawStep.variable_capture.name];
    if(run.capturedVariables) delete run.capturedVariables[rawStep.variable_capture.name];
  }
  if(rawStep.type==='focused_text' || rawStep.type==='element_action') {
    const declared=(run.automationSnapshot?.steps||[]).flatMap(s=>s.type==='table_read'?(s.table?.mode==='click'?[]:[s.table?.variable]):s.variable_capture?.enabled?[s.variable_capture.name]:[]).filter(Boolean);
    for(const token of JSON.stringify(rawStep).matchAll(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g)) {
      if(declared.includes(token[1]) && !Object.hasOwn(run.variables,token[1])) throw Error(`A variável ${token[1]} ainda não foi capturada nesta linha.`);
    }
  }
  const step = replaceVariables(rawStep, run.variables);
  if (step.delay_ms) await sleep(Number(step.delay_ms));
  if (step.type === "navigate") {
    await addLog(run, `Abrindo ${step.url}`);
    await chrome.tabs.update(run.tabId, { url: step.url });
    await esperarAbaPronta(run.tabId, step.timeout_ms || 15000);
    return "Página carregada.";
  }
  if (step.type === "visual_match") return executeVisualMatch(run, step);
  if (step.type === "visual_state") return executeVisualState(run, step);
  if (step.type === "key_sequence") return executePageStep(run, step);
  if (step.type === "ocr_text" && Array.isArray(step.ocr_targets) && step.ocr_targets.length) {
    return executeOcrTargets(run, step);
  }
  if (step.type === "data_source") {
    const source = {
      name: step.name || "valor",
      values: Array.isArray(step.values) ? step.values.map((value) => String(value ?? "")) : [],
      rows: Array.isArray(step.rows) ? step.rows : [],
      interval: Math.max(0, Number(step.interval_ms || 0)),
      index: run.currentIndex
    };
    if (run.spreadsheetLoop?.sourceIndex === run.currentIndex) {
      const value = String(run.variables[source.name] ?? "");
      return executePageStep(run, {
        ...step,
        type: "focused_text",
        text: value,
        clear_before: true
      });
    }
    run.dataSource = source;
    return `${source.values.length} valor(es) preparados para o loop ${source.name}.`;
  }
  if (step.type === "report_result") {
    const reportStep = reportStepForRow(rawStep, run.variables || {}, run.spreadsheetLoop?.rowData || {});
    const result = recordReportResult(run, reportStep);
    return `Resultado do relatorio: ${result.status}.`;
  }
  if (step.type === "loop_end" || step.type === "loop_start") return "Marcador de loop processado.";
  if (["element_action", "ocr_text", "focused_text", "wait_text"].includes(step.type)) {
    try {
      return await executePageStep(run, step);
    } catch (error) {
      if (step.type === "element_action" && step.visual_fallback?.data_url) {
        await addLog(run, "Seletor não respondeu; tentando referência visual.", "warning");
        return executeVisualMatch(run, { ...step, image: step.visual_fallback, click: true });
      }
      throw error;
    }
  }
  throw new Error(`Tipo de etapa não suportado: ${step.type || "desconhecido"}.`);
}

function loopPairs(steps) {
  const stack = [];
  const pairs = new Map();
  steps.forEach((step, index) => {
    if (step.type === "loop_start") stack.push(index);
    if (step.type === "loop_end") {
      const start = stack.pop();
      if (Number.isInteger(start)) pairs.set(start, index);
    }
  });
  return pairs;
}

function normalizedSequence(value) {
  return String(value || "principal").trim() || "principal";
}

function buildFlowIndexes(steps) {
  const orderIndex = new Map();
  const sequenceStart = new Map();
  const nextByIndex = new Map();
  const lastBySequence = new Map();

  steps.forEach((step, index) => {
    const sequence = normalizedSequence(step?.sequence);
    const order = Number(step?.source_order);
    if (Number.isInteger(order)) orderIndex.set(order, index);
    if (!sequenceStart.has(sequence)) sequenceStart.set(sequence, index);
    const previous = lastBySequence.get(sequence);
    if (Number.isInteger(previous)) nextByIndex.set(previous, index);
    lastBySequence.set(sequence, index);
  });
  steps.forEach((_step, index) => {
    if (!nextByIndex.has(index)) nextByIndex.set(index, null);
  });
  return { orderIndex, sequenceStart, nextByIndex };
}

function mapPathActionToIndex(run, flow, indexes, fallback) {
  const boundary=run.mapBoundary, action=String(flow?.action||'continuar');
  if(boundary) {
    if(action==='ir_para_bloco' && !indexes.orderIndex.has(Number(flow.block)) && boundary.orders.includes(Number(flow.block)) || action==='ir_para_sequencia' && !indexes.sequenceStart.has(flow.sequence) && boundary.sequences.includes(flow.sequence)) {
      run.mapExit={action,block:flow.block||'',sequence:flow.sequence||''};return null;
    }
    if(['parar','stop','interromper'].includes(action))throw new Error('O caminho Chrome solicitou parar a automação.');
  }
  return actionToIndex(flow,indexes,fallback);
}

function actionToIndex(flow, indexes, fallback) {
  const action = String(flow?.action || "continuar").toLowerCase();
  if (["ir_para_bloco", "ir_para_outro_bloco", "ir_para"].includes(action)) {
    const targetOrder = Number(flow?.block);
    const target = indexes.orderIndex.get(targetOrder);
    if (Number.isInteger(target)) return target;
    throw new Error(`O bloco de destino ${flow?.block || "informado"} nao foi exportado para o Chrome.`);
  }
  if (["ir_para_sequencia", "ir_para_pagina", "ir_para_pag"].includes(action)) {
    const sequence = normalizedSequence(flow?.sequence);
    const target = indexes.sequenceStart.get(sequence);
    if (Number.isInteger(target)) return target;
    throw new Error(`A pagina de destino ${sequence} nao possui blocos compativeis com o Chrome.`);
  }
  if (["parar", "stop", "interromper"].includes(action)) return null;
  return fallback;
}

function flowContinues(flow) {
  const action = String(flow?.action || "parar").toLowerCase();
  return ["continuar", "continue", "seguir", "ir_para_bloco", "ir_para_outro_bloco", "ir_para", "ir_para_sequencia", "ir_para_pagina", "ir_para_pag"].includes(action);
}

function flowLabel(flow) {
  const action = String(flow?.action || "continuar").toLowerCase();
  if (["ir_para_bloco", "ir_para_outro_bloco", "ir_para"].includes(action)) return `Indo para bloco ${flow?.block}.`;
  if (["ir_para_sequencia", "ir_para_pagina", "ir_para_pag"].includes(action)) return `Indo para pagina ${normalizedSequence(flow?.sequence)}.`;
  return "Continuando conforme o bloco.";
}

async function waitForRouteDelay(run, flow) {
  const milliseconds = Number(flow?.delay_ms || 0);
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return;
  await addLog(run, `Aguardando ${milliseconds / 1000}s antes do bloco de destino.`, "info");
  for (let remaining = milliseconds; remaining > 0; remaining -= 100) {
    if (run.cancelled) throw new Error("Execucao interrompida pelo usuario.");
    await sleep(Math.min(remaining, 100));
  }
  if (run.cancelled) throw new Error("Execucao interrompida pelo usuario.");
}

function findSpreadsheetLoopSource(steps) {
  if (steps.some((step) => step?.type === "loop_start" || step?.type === "loop_end")) return null;
  const index = steps.findIndex((step) => step?.type === "data_source" && Array.isArray(step.values) && step.values.length);
  if (index < 0) return null;
  const step = steps[index];
  return {
    index,
    name: String(step.name || "valor"),
    values: step.values.map((value) => String(value ?? "")),
    rows: Array.isArray(step.rows) ? step.rows : [],
    interval: Math.max(0, Number(step.interval_ms || 0))
  };
}

function spreadsheetStartRow(value, total) {
  const parsed = Math.trunc(Number(value));
  return Math.min(Math.max(1, Number.isFinite(parsed) ? parsed : 1), Math.max(1, Number(total) || 1));
}

async function executeSpreadsheetLoop(run, source, executeIteration) {
  const firstRow = spreadsheetStartRow(run.requestedStartRow, source.values.length) - 1;
  run.totalSteps = Math.max(1, Number(run.stepsPerIteration || 1) * (source.values.length - firstRow));
  run.spreadsheetStartRow = firstRow + 1;
  if (run.report) run.report.sourceName = source.name;
  try {
    if (firstRow > 0) await addLog(run, `Planilha ${source.name}: iniciando na linha ${firstRow + 1} de ${source.values.length}.`);
    for (let row = firstRow; row < source.values.length; row += 1) {
      if (run.cancelled) throw new Error("Execucao interrompida pelo usuario.");
      const value = setSpreadsheetRowVariables(run, source, row);
      run.spreadsheetLoop = {
        sourceIndex: source.index,
        iterationStart: source.iterationStart,
        row,
        startedStep: Number(run.currentStep || 0),
        rowData: spreadsheetRowData(source, row),
        total: source.values.length
      };
      await addLog(run, "Planilha " + source.name + ": " + (row + 1) + "/" + source.values.length + " - " + value + ".");
      beginReportRow(run, {
        index: row + 1,
        value,
        sourceName: source.name,
        total: source.values.length
      });
      try {
        await executeIteration();
        finalizeReportRow(run, true);
      } catch (error) {
        finalizeReportRow(run, false, String(error?.message || error));
        throw error;
      }
      if (row < source.values.length - 1 && source.interval) await sleep(source.interval);
    }
  } finally {
    delete run.spreadsheetLoop;
    delete run.currentIndex;
  }
}

function mustAdvanceSpreadsheetRow(run, currentIndex, nextIndex) {
  const loop = run?.spreadsheetLoop;
  const iterationStart = Number(loop?.iterationStart);
  return Boolean(
    loop
    && Number.isInteger(iterationStart)
    && currentIndex !== iterationStart
    && nextIndex === iterationStart
  );
}

async function executeRange(run, steps, start, end, pairs, indexes, depth = 0) {
  if (depth > 5) throw new Error("Loops aninhados demais para executar no Chrome.");
  let index = start;
  while (index < end) {
    if(run.mapExit)return;
    if (run.cancelled) throw new Error("Execução interrompida pelo usuário.");
    const step = steps[index];
    run.currentIndex = index;
    run.lastBlockIndex = index;
    if (step.type === "loop_end") return;
    if (step.type === "loop_start") {
      const loopEnd = pairs.get(index);
      if (!Number.isInteger(loopEnd)) throw new Error("O bloco Início do loop não possui um Fim do loop.");
      const source = run.dataSource || { name: "valor", values: [] };
      if (!source.values.length && !source.allowEmpty) throw new Error("O loop não possui valores da planilha para executar.");
      const bodyUnits=steps.slice(index+1,loopEnd).filter(item=>!['loop_start','loop_end'].includes(item.type)).length;
      run.totalSteps=Math.max(0,Number(run.totalSteps||steps.filter(s=>!['loop_start','loop_end'].includes(s.type)).length)+bodyUnits*(source.values.length-1));
      if (run.report) run.report.sourceName = source.name;
      const firstRow = run.manualSpreadsheetLoopStarted
        ? 0
        : spreadsheetStartRow(run.requestedStartRow, source.values.length) - 1;
      if (!run.manualSpreadsheetLoopStarted) {
        run.manualSpreadsheetLoopStarted = true;
        run.spreadsheetStartRow = firstRow + 1;
        if (firstRow > 0) await addLog(run, `Planilha ${source.name}: iniciando na linha ${firstRow + 1} de ${source.values.length}.`);
      }
      for (let row = firstRow; row < source.values.length; row += 1) {
        const value = setSpreadsheetRowVariables(run, source, row);
        run.spreadsheetLoop = {
          sourceIndex: source.index,
          row,
          rowData: spreadsheetRowData(source, row),
          total: source.values.length
        };
        await addLog(run, `Loop ${source.name}: ${row + 1}/${source.values.length} · ${source.values[row]}`);
        beginReportRow(run, {
          index: row + 1,
          value,
          sourceName: source.name,
          total: source.values.length
        });
        try {
          await executeRange(run, steps, index + 1, loopEnd, pairs, indexes, depth + 1);
          if(run.mapExit)return;
          finalizeReportRow(run, true);
        } catch (error) {
          finalizeReportRow(run, false, String(error?.message || error));
          throw error;
        }
        if (row < source.values.length - 1 && source.interval) await sleep(source.interval);
      }
      const nextAfterLoop = indexes.nextByIndex.get(loopEnd);
      if (!Number.isInteger(nextAfterLoop)) return;
      index = nextAfterLoop;
      continue;
    }
    run.currentStep += 1;
    run.recentSteps = [...(run.recentSteps || []), {
      serial: run.currentStep, index, state: "running"
    }].slice(-4);
    await persistRun(run);
    await addLog(run, `Bloco ${step.source_order || index + 1}: ${step.type}.`);
    try {
      const output = await executeStep(run, step);
      const message = typeof output === "object" ? output.message : output;
      const flow = typeof output === "object" ? output.flow : step.on_success;
      const nextIndex = mapPathActionToIndex(run, flow, indexes, indexes.nextByIndex.get(index));
      if (typeof output === "object" && output.level === "warning") {
        run.blockFailure = { serial: Number(run.blockFailure?.serial || 0) + 1,
          index, nextIndex, message: String(message || ""), at: Date.now() };
      } else if (step.type === "ocr_text") {
        run.blockSuccess = { serial: Number(run.blockSuccess?.serial || 0) + 1,
          index, at: Date.now() };
      }
      const routed = typeof output === "object" && output.level === "warning";
      run.recentSteps.at(-1).state = routed && Number.isInteger(nextIndex) ? "routed" : routed ? "failed" : "done";
      run.recentSteps.at(-1).message = String(message || "");
      if (routed) run.recentSteps.at(-1).route = Number.isInteger(nextIndex)
        ? `Indo para B${String(steps[nextIndex]?.source_order || nextIndex + 1).padStart(2, "0")}`
        : flowLabel(flow);
      await addLog(run, message, typeof output === "object" ? output.level || "success" : "success");
      if (mustAdvanceSpreadsheetRow(run, index, nextIndex)) {
        await addLog(run, `Linha ${run.spreadsheetLoop.row + 1}/${run.spreadsheetLoop.total} concluida; avancando para o proximo valor.`);
        return;
      }
      if (!Number.isInteger(nextIndex)) return;
      if (nextIndex !== indexes.nextByIndex.get(index)) await addLog(run, flowLabel(flow), "info");
      await waitForRouteDelay(run, flow);
      index = nextIndex;
    } catch (error) {
      if(step.type==='table_read'){
        const phase={click:'Abrir guia',return:'Voltar à lista',export:'Consolidar dados'}[step.table?.mode]||(step.table?.accumulate?'Ler detalhe':'Ler lista');
        const key=run.tableContexts?.[step.table?.traversal_id]?.key||run.spreadsheetLoop?.rowData?.['Número da Guia']||run.dataSource?.values?.[run.spreadsheetLoop?.row]||'';
        const wrapped=new Error(`B${String(step.source_order||index+1).padStart(2,'0')} · ${phase}${key?' · Guia '+key:''}: ${error.message||error}`);wrapped.cause=error;error=wrapped;
        run.lastError=error.message;
      }
      if (run.recentSteps?.at(-1)?.index === index) {
        run.recentSteps.at(-1).state = run.cancelled ? "stopped" : "failed";
        run.recentSteps.at(-1).message = String(error?.message || error);
      }
      if (run.cancelled) throw error;
      const tableMustStop=step.type==='table_read'&&(step.table?.traversal_id||['return','export'].includes(step.table?.mode));
      const canRoute = !tableMustStop && !error?.flowdetectCaptureUnavailable && !error?.flowdetectContentRuntimeMismatch
        && !error?.flowdetectOcrTargetFailure && flowContinues(step.on_failure);
      const nextIndex = canRoute ? mapPathActionToIndex(run, step.on_failure, indexes, indexes.nextByIndex.get(index)) : null;
      run.blockFailure = { serial: Number(run.blockFailure?.serial || 0) + 1,
        index, nextIndex, message: String(error?.message || error), at: Date.now() };
      if (!canRoute) throw error;
      await addLog(run, `${String(error?.message || error)} ${flowLabel(step.on_failure)}`, "warning");
      if (mustAdvanceSpreadsheetRow(run, index, nextIndex)) {
        await addLog(run, `Linha ${run.spreadsheetLoop.row + 1}/${run.spreadsheetLoop.total} finalizada pela regra do bloco; avancando para o proximo valor.`, "warning");
        return;
      }
      if (!Number.isInteger(nextIndex)) return;
      await waitForRouteDelay(run, step.on_failure);
      index = nextIndex;
    }
  }
}

async function executeAutomation(automation, tabId, startRow = 1, loopIncludedIndices = null, loopExcludedRows = [], downloadRouteId = null, pageId = null, onStarted = null) {
  const page = pageId ? (await getPages()).find((item) => item.id === pageId) : await createPage(tabId);
  if (!page || page.tabId !== tabId) throw new Error("A aba não corresponde à página de execução. Vincule a aba novamente.");
  if (reservedTabs.has(tabId) || reservedPages.has(page.id)) throw new Error("Já existe uma execução nesta aba ou página.");
  if (reservedTabs.size >= 2) throw new Error("Duas execuções já estão ativas. Aguarde ou pare uma delas.");
  reservedTabs.add(tabId);
  reservedPages.add(page.id);
  try {
    const bound = (await getPages()).find((item) => item.id === page.id);
    if (bound?.tabId !== tabId) throw new Error("O vínculo da aba mudou. Confira a página antes de executar.");
    return await executeAutomationOnPage(automation, tabId, startRow, loopIncludedIndices, loopExcludedRows, downloadRouteId, page, onStarted);
  } finally {
    reservedTabs.delete(tabId);
    reservedPages.delete(page.id);
  }
}

async function executeAutomationOnPage(automation, tabId, startRow, loopIncludedIndices, loopExcludedRows, downloadRouteId, page, onStarted = null) {
  if (!automation || automation.schema !== "flowdetect_chrome_automation" || ![1, 2, 3].includes(Number(automation.version))) {
    throw new Error("Arquivo de automação Chrome inválido.");
  }
  if (!Array.isArray(automation.steps) || !automation.steps.length) {
    throw new Error("Essa automação não possui blocos compatíveis com a extensão.");
  }
  // Legacy screen_guard metadata no longer gates execution. The page/tab binding
  // and the checks configured in the actual automation blocks still apply.
  if (downloadRouteId) await routeAvailable(downloadRouteId);
  else await clearDownloadRouteForTab(tabId);
  const run = createRun(automation, tabId, startRow, loopIncludedIndices, loopExcludedRows);
  run.pageId = page.id;
  run.pageName = page.name;
  run.pageColor = page.color;
  run.blockInput = page.blockInput === true;
  Object.assign(run.variables, automation.chain_variables || {});
  run.mapBoundary=automation.map_boundary||null;
  // Retain the exact configuration for viewing this execution after library edits.
  run.automationSnapshot = automation;
  if (downloadRouteId) run.downloadRouteId = downloadRouteId;
  activeRuns.set(run.id, run);
  onStarted?.(run);
  try {
    if (run.blockInput) {
      await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ["input-lock.js"] });
    }
    await addLog(run, `Iniciando ${run.automationName} em ${page.name}.`);
    if (run.loopExcludedRows.length) await addLog(run,
      `${run.loopExcludedRows.length} linha(s) removida(s) deste loop antes da execução.`, "info");
    if (downloadRouteId) {
      await activateDownloadRoute(downloadRouteId, tabId, run.id);
      await addLog(run, "Downloads desta execucao serao enviados a pasta escolhida na extensao.");
    }
    try {
      await startTabCapture(run);
      await addLog(run, "Captura vinculada a aba da automacao iniciada; voce pode usar outras abas.", "info");
    } catch (error) {
      run.captureMode = "visible";
      await stopTabCapture(run);
      await addLog(run, `A captura em segundo plano nao iniciou: ${String(error?.message || error)}. O reconhecimento visual aguardara a aba da automacao ficar ativa.`, "warning");
    }
    if (run.cancelled) throw new Error("Execucao interrompida pelo usuario.");
    const steps = automation.steps;
    const indexes = buildFlowIndexes(steps);
    const initialSequence = normalizedSequence(automation.initial_sequence);
    const firstStep = automation.entry_order ? indexes.orderIndex.get(Number(automation.entry_order)) : indexes.sequenceStart.get(initialSequence);
    if (!Number.isInteger(firstStep)) {
      throw new Error(`A pagina inicial ${initialSequence} nao possui blocos compativeis com o Chrome.`);
    }
    const pairs = loopPairs(steps);
    const spreadsheetLoop = findSpreadsheetLoopSource(steps);
    if (spreadsheetLoop) {
      spreadsheetLoop.iterationStart = firstStep;
      run.stepsPerIteration = steps.filter((step) => step.type !== "loop_start" && step.type !== "loop_end").length;
      await executeSpreadsheetLoop(
        run,
        spreadsheetLoop,
        () => executeRange(run, steps, firstStep, steps.length, pairs, indexes)
      );
      delete run.stepsPerIteration;
    } else {
      await executeRange(run, steps, firstStep, steps.length, pairs, indexes);
    }
    run.status = "completed";
    if (run.report) {
      run.report.status = "completed";
      if (!run.report.rows.length && !run.report.summary?.status) {
        run.report.summary = {
          status: "Concluida",
          tone: "success",
          result: "Automacao concluida com sucesso."
        };
      }
    }
    await addLog(run, "Automação concluída com sucesso.", "success");
  } catch (error) {
    run.status = runWasInterrupted(run, error) ? "stopped" : "failed";
    registerRunFailureInReport(run, error);
    if (run.report) {
      run.report.status = run.status;
      if (!run.report.summary?.status && !run.report.rows.length) {
        run.report.summary = {
          status: run.status === "stopped" ? "Interrompida" : "Falhou",
          tone: run.status === "stopped" ? "warning" : "danger",
          result: String(error?.message || error || "Falha durante a execucao.")
        };
      }
    }
    await addLog(run, String(error?.message || error), "error");
  } finally {
    run.blockInput = false;
    await chrome.tabs.sendMessage(tabId, { type: 'flowdetect-cursor-stop' }).catch(() => {});
    await chrome.tabs.sendMessage(tabId, { type: "flowdetect-input-lock-refresh" }).catch(() => {});
    if (downloadRouteId) await deactivateDownloadRoute(run.id).catch(() => {});
    await stopTabCapture(run).catch(() => {});
    run.finishedAt = new Date().toISOString();
    if (run.report) run.report.finishedAt = run.finishedAt;
    activeRuns.delete(run.id);
    await persistRun(run);
    await notifyRunFinished(run).catch(() => {});
  }
  return run;
}

async function handleMessage(message, sender) {
  if (message?.type === 'flowdetect-cursor-position') {
    const tabId=sender?.tab?.id;
    const run=[...activeRuns.values()].find(r=>r.tabId===tabId&&!r.cancelled&&r.status==='running');
    if (!run || (sender.frameId ?? 0)!==0) return {ok:false,position:null};
    const p=message.position;
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(p.x)<100000 && Math.abs(p.y)<100000) {
      run.cursorPosition={x:p.x,y:p.y};
    }
    return {ok:true,position:run.cursorPosition||null};
  }
  if(message?.type==='flowdetect-table-permit-click'){
    const run=activeRuns.get(message.runId);
    const allowed=Boolean(run&&!run.cancelled&&run.tabId===sender?.tab?.id&&run.pendingTableClick&&run.pendingTableClick===message.nonce);
    if(allowed)delete run.pendingTableClick;
    return {allowed};
  }
  if (message?.type === "flowdetect-input-lock-state") {
    const run = [...activeRuns.values()].find(item => item.tabId === sender?.tab?.id && item.blockInput && !item.cancelled);
    return { locked: Boolean(run), runId: run?.id || null };
  }
  if (message?.type === "flowdetect-input-lock-release") {
    const run = [...activeRuns.values()].find(item => item.tabId === sender?.tab?.id && item.id === message.runId);
    if (run) {
      run.blockInput = false;
      await chrome.tabs.sendMessage(run.tabId, { type: "flowdetect-input-lock-refresh" }).catch(() => {});
    }
    return { ok: true };
  }
  if (message?.type === "flowdetect-page-input-lock") {
    if (chainReservation) throw new Error("Aguarde o encadeamento terminar para alterar a página.");
    if (reservedPages.has(message.pageId)) throw new Error("Aguarde a execução terminar para alterar o bloqueio.");
    const page = await editPages(pages => {
      const target = pages.find(item => item.id === message.pageId);
      if (!target) throw new Error("Página não encontrada.");
      target.blockInput = message.enabled === true;
      return target;
    });
    return { ok: true, page };
  }
  if (message?.type === "flowdetect-download-source") {
    // The sender tab, not a page-supplied tabId, is authoritative.
    return { ok: noteDownloadSource(sender?.tab?.id, message.url, "click") };
  }
  if (message?.type === "flowdetect-page-outline-state") {
    const tabId = sender?.tab?.id;
    const page = Number.isInteger(tabId) ? (await getPages()).find((item) => item.tabId === tabId) : null;
    return { ok: true, page: page || null };
  }
  if (message?.type === "flowdetect-pages") {
    let pages = await getPages();
    const saved = await chrome.storage.local.get(PAGES_KEY);
    if (!Array.isArray(saved[PAGES_KEY])) {
      const legacy = (await chrome.storage.local.get(RUN_STORAGE_KEY))[RUN_STORAGE_KEY];
      const page = await createPage(null);
      if (legacy?.automationId) await chrome.storage.local.set({ [`${PAGE_RUN_PREFIX}${page.id}`]: { ...legacy, pageId: page.id, pageName: page.name } });
      pages = await getPages();
    }
    await ensureAutomationPageOwnership(pages);
    const runs = {};
    for (const page of pages) {
      const key = `${PAGE_RUN_PREFIX}${page.id}`;
      let run = (await chrome.storage.local.get(key))[key];
      if (run && ["running", "waiting_screen"].includes(run.status) && !activeRuns.has(run.id) && !reservedPages.has(page.id)) {
        run = { ...run, status: "stopped", finishedAt: new Date().toISOString(), waitingReason: "A extensão reiniciou. Execução interrompida; não retomada automaticamente." };
        await chrome.storage.local.set({ [key]: run });
      }
      if (run) runs[page.id] = run;
    }
    return { ok: true, pages, runs, activeRunIds: [...activeRuns.keys()] };
  }
  if (message?.type === "flowdetect-page-create") {
    // The user selects the correct browser tab after creating an unbound page.
    const page = await createPage(null);
    await ensureAutomationPageOwnership(await getPages());
    return { ok: true, page };
  }
  if (message?.type === "flowdetect-page-bind") {
    if (chainReservation) throw new Error("Aguarde o encadeamento terminar para trocar a aba.");
    // Reserve synchronously, before the asynchronous tab/storage operations.
    const tabId = Number(message.tabId);
    if (reservedPages.has(message.pageId) || reservedTabs.has(tabId)) throw new Error("Pare a execução antes de trocar a aba.");
    reservedPages.add(message.pageId); reservedTabs.add(tabId);
    try {
      const old = (await getPages()).find((page) => page.id === message.pageId);
      const page = await bindPage(message.pageId, tabId);
      if (Number.isInteger(old?.tabId) && old.tabId !== tabId) {
        await updatePageOutline(old.tabId, null);
      }
      await updatePageOutline(tabId, page);
      return { ok: true, page };
    } finally { reservedPages.delete(message.pageId); reservedTabs.delete(tabId); }
  }
  if (message?.type === "flowdetect-page-unbind") {
    if (chainReservation) throw new Error("Aguarde o encadeamento terminar para desvincular a aba.");
    const pageId = String(message.pageId || "");
    if (reservedPages.has(pageId) || [...activeRuns.values()].some((run) => run.pageId === pageId)) {
      throw new Error("Pare a execução antes de desvincular a aba.");
    }
    reservedPages.add(pageId);
    try {
      const old = (await getPages()).find((page) => page.id === pageId);
      const oldTabId = old?.tabId;
      const page = await unbindPage(pageId);
      await updatePageOutline(oldTabId, null);
      return { ok: true, page };
    } finally { reservedPages.delete(pageId); }
  }
  if (message?.type === "flowdetect-page-delete") {
    if (chainReservation) throw new Error("Aguarde o encadeamento terminar para excluir a página.");
    const pageId = String(message.pageId || "");
    if (reservedPages.has(pageId) || [...activeRuns.values()].some((run) => run.pageId === pageId)) {
      throw new Error("Pare a automação desta página antes de excluí-la.");
    }
    reservedPages.add(pageId);
    try {
      const page = await deletePage(pageId);
      const remainingPages = await getPages();
      const owner = remainingPages[0]?.id || null;
      const automations = (await chrome.storage.local.get(AUTOMATIONS_KEY))[AUTOMATIONS_KEY] || [];
      const updated = automations.map((item) => item.pageId === pageId ? { ...item, pageId: owner } : item);
      const movedAutomations = automations.filter((item) => item.pageId === pageId).length;
      if (movedAutomations) await chrome.storage.local.set({ [AUTOMATIONS_KEY]: updated });
      await chrome.storage.local.remove(PAGE_RUN_PREFIX + pageId);
      await updatePageOutline(page.tabId, null);
      return { ok: true, pageId, movedAutomations, destinationPageId: owner };
    } finally { reservedPages.delete(pageId); }
  }
  if (message?.type === "flowdetect-studio-connection") {
    return {
      ok: true,
      pairCode: await getPairCode(),
      studioFound: Date.now() - studioConnection.lastSeen < 15000,
      connected: studioConnection.paired && Date.now() - studioConnection.lastSeen < 15000,
      phase: studioConnection.phase,
      error: studioConnection.error,
    };
  }
  if (message?.type === "flowdetect-studio-new-pair-code") {
    return { ok: true, pairCode: await regeneratePairCode() };
  }
  if (message?.type === "flowdetect-screen-ready") {
    return { ok: true, ...await checkAutomationScreen(message.screenGuard, message.tabId) };
  }
  if (message?.type === "flowdetect-runtime-info") {
    return {
      ok: true,
      version: RUNTIME_VERSION,
      activeRunIds: [...activeRuns.keys()],
      capabilities: ["ocr_text", "visual_match", "visual_state", "focused_text", "data_source", "key_sequence", "download_destination", "execution_pages"]
    };
  }
  if (message?.type === "flowdetect-start") {
    const tabId = Number(message.tabId || sender?.tab?.id);
    if (!Number.isInteger(tabId)) throw new Error("Não encontrei a aba que receberá a automação.");
    if (chainReservation) throw new Error("O agente reservou o Chrome para um encadeamento. Pare o encadeamento no Studio antes de iniciar outro fluxo.");
    if (message.automation?.pageId && message.automation.pageId !== message.pageId) {
      throw new Error("Esta automação pertence a outra página. Selecione a página correta.");
    }
    const run = await executeAutomation(message.automation, tabId, message.startRow,
      message.loopIncludedIndices, message.loopExcludedRows, message.downloadRouteId, message.pageId);
    return { ok: run.status === "completed", run };
  }
  if (message?.type === "flowdetect-stop") {
    const running = [...activeRuns.values()].find((run) => run.id === message.runId && (!message.pageId || run.pageId === message.pageId));
    if (running) {
      running.cancelled = true;
      await chrome.tabs.sendMessage(running.tabId, {type:'flowdetect-cursor-stop'}).catch(()=>{});
      await addLog(running, "Parada solicitada pelo usuário.", "warning");
    }
    return { ok: true, stopped: Boolean(running) };
  }
  if (message?.type === "flowdetect-capture-preview") {
    const tab = await chrome.tabs.get(Number(message.tabId));
    if ((await activeTabForWindow(tab.windowId))?.id !== tab.id) {
      throw new Error("Abra a aba escolhida antes de capturar a imagem de referencia.");
    }
    await chrome.tabs.sendMessage(tab.id, {type:'flowdetect-cursor-suspend'}).catch(()=>{});
    let dataUrl;
    try { dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" }); }
    finally { await chrome.tabs.sendMessage(tab.id, {type:'flowdetect-cursor-resume'}).catch(()=>{}); }
    if ((await activeTabForWindow(tab.windowId))?.id !== tab.id) {
      throw new Error("A aba ativa mudou durante a captura. Tente novamente na aba escolhida.");
    }
    return { ok: true, dataUrl };
  }
  return { ok: false, error: "Mensagem FlowDetect desconhecida." };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target === "flowdetect-offscreen") return false;
  handleMessage(message, sender).then(sendResponse).catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));
  return true;
});
chrome.runtime.onInstalled?.addListener(() => {
  // Refresh outlines for tabs that were already open before an extension update.
  getPages().then((pages) => Promise.all(pages
    .filter((page) => Number.isInteger(page.tabId))
    .map((page) => updatePageOutline(page.tabId, page))
  )).catch((error) => console.warn("FlowDetect: não foi possível restaurar todas as bordas:", error));
});

chrome.tabs.onRemoved?.addListener((tabId) => {
  for (const run of activeRuns.values()) if (run.tabId === tabId) run.cancelled = true;
  editPages((pages) => { for (const page of pages) if (page.tabId === tabId) { page.tabId = null; page.tabTitle = ""; } }).catch(() => {});
});
// Chrome tab IDs do not survive a browser restart reliably. Keep history, not bindings.
chrome.runtime.onStartup?.addListener(() => {
  editPages((pages) => { for (const page of pages) page.tabId = null; }).catch(() => {});
});

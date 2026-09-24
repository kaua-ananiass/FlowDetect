const RUN_STORAGE_KEY = "flowdetectChromeLastRun";
const RUNTIME_VERSION = "0.2.33";
const activeRuns = new Map();
const imageBitmapCache = new Map();


const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, Math.max(0, milliseconds)));

function createRun(automation, tabId, startRow = 1) {
  return {
    id: crypto.randomUUID(),
    automationId: String(automation?.id || ""),
    automationName: String(automation?.automation?.nome || "Automação Chrome"),
    tabId,
    status: "running",
    startedAt: new Date().toISOString(),
    finishedAt: "",
    currentStep: 0,
    totalSteps: Array.isArray(automation?.steps) ? automation.steps.length : 0,
    lastMessage: "",
    logs: [],
    variables: {},
    report: {
      sourceName: "",
      rows: [],
      summary: {},
      requestedStartRow: Math.max(1, Math.trunc(Number(startRow) || 1))
    },
    requestedStartRow: Math.max(1, Math.trunc(Number(startRow) || 1))
  };
}

async function persistRun(run) {
  const persisted = { ...run, logs: run.logs.slice(-100) };
  delete persisted.cancelled;
  await chrome.storage.local.set({ [RUN_STORAGE_KEY]: persisted });
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
      const resposta = await chrome.tabs.sendMessage(tabId, versionedMessage);
      if (resposta) return resposta;
      ultimoErro = new Error("A página ainda está inicializando.");
    } catch (error) {
      ultimoErro = error;
    }
    await sleep(180);
  }
  throw new Error(`A página ainda não respondeu após recarregar. ${String(ultimoErro?.message || "Tente executar novamente.")}`);
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
  run.variables.empresa = spreadsheetColumnValue(rowData, "empresa") || value;
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

async function captureImage(tabId) {
  const tab = await chrome.tabs.get(tabId);
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  const bitmap = await bitmapFromCapture(dataUrl);
  return imageDataFromBitmap(bitmap);
}

async function findVisualMatch(tabId, asset) {
  const [source, originalTemplate] = await Promise.all([captureImage(tabId), bitmapForDataUrl(asset?.data_url)]);
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
  const interval = Math.max(180, Number(step.interval_ms || 550));
  const timeout = Math.max(500, Number(step.timeout_ms || 10000));
  const attempts = Math.max(Number(step.attempts || 1), Math.ceil(timeout / interval));
  const confidence = Math.max(.35, Math.min(.99, Number(step.confidence || .8)));
  let best = { score: -1 };
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (run.cancelled) throw new Error("Execução interrompida pelo usuário.");
    const candidate = await findVisualMatch(run.tabId, asset);
    if (candidate.score > best.score) best = candidate;
    if (candidate.score >= confidence) return candidate;
    if (attempt < attempts - 1) await sleep(interval);
  }
  throw new Error(`Referência visual não encontrada. Melhor similaridade: ${Math.max(0, best.score * 100).toFixed(0)}%.`);
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
    color: label === "OCR" ? "#44b9ff" : "#cf8cff",
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
  const candidates = [];
  if (step.active_image) candidates.push({ state: "ativo", asset: step.active_image });
  if (step.inactive_image) candidates.push({ state: "desativado", asset: step.inactive_image });
  const results = await Promise.all(candidates.map(async (candidate) => ({ ...candidate, match: await findVisualMatch(run.tabId, candidate.asset) })));
  const best = results.sort((first, second) => second.match.score - first.match.score)[0];
  const confidence = Math.max(.35, Math.min(.99, Number(step.confidence || .85)));
  if (!best || best.match.score < confidence) throw new Error(`Não identifiquei o estado de ${step.name || "botão"}.`);
  await clickVisualResult(run, { ...step, click: false }, best.match, "ESTADO");
  return {
    message: `${step.name || "Botão"}: ${best.state} (${(best.match.score * 100).toFixed(0)}%).`,
    flow: step.state_flows?.[best.state] || step.on_success
  };
}

async function executePageStep(run, step) {
  const response = await sendToPage(run.tabId, { type: "flowdetect-execute-step", step });
  if (!response?.ok) throw new Error(response?.error || "A etapa não foi concluída.");
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

async function executeOcrTargets(run, step) {
  const targets = Array.isArray(step.ocr_targets)
    ? step.ocr_targets.filter((target) => String(target?.text || "").trim())
    : [];
  if (!targets.length) return null;

  for (let targetIndex = 0; targetIndex < targets.length; targetIndex += 1) {
    const target = targets[targetIndex];
    const isLastTarget = targetIndex === targets.length - 1;
    const action = normalizedOcrTargetAction(target.action);
    const targetStep = {
      ...step,
      ...target,
      type: "ocr_text",
      text: String(target.text || "").trim(),
      click: Boolean(target.click),
      clicks: Math.max(1, Number(target.clicks || 1)),
      ocr_targets: undefined
    };

    try {
      const message = await executePageStep(run, targetStep);
      if (action === "continuar" && !isLastTarget) {
        await addLog(run, `OCR ${targetIndex + 1} confirmado; procurando OCR ${targetIndex + 2} conforme a regra do bloco.`, "info");
        continue;
      }
      return { message, flow: target.on_success || step.on_success };
    } catch (error) {
      const reason = String(error?.message || error || "");
      if (reason.includes("desativado") && reason.includes("clique")) {
        error.message = `OCR ${targetIndex + 1} encontrou o texto, mas o alvo ficou desativado. ${reason}`;
        error.flowdetectOcrTargetFailure = true;
        throw error;
      }
      const flow = target.on_failure || step.on_failure;
      const detail = `OCR ${targetIndex + 1} nao encontrou o texto: ${targetStep.text}.`;
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
  if (["element_action", "ocr_text", "focused_text", "viewport_click", "wait_text"].includes(step.type)) {
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
    if (run.cancelled) throw new Error("Execução interrompida pelo usuário.");
    const step = steps[index];
    run.currentIndex = index;
    if (step.type === "loop_end") return;
    if (step.type === "loop_start") {
      const loopEnd = pairs.get(index);
      if (!Number.isInteger(loopEnd)) throw new Error("O bloco Início do loop não possui um Fim do loop.");
      const source = run.dataSource || { name: "valor", values: [] };
      if (!source.values.length) throw new Error("O loop não possui valores da planilha para executar.");
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
    await persistRun(run);
    await addLog(run, `Bloco ${step.source_order || index + 1}: ${step.type}.`);
    try {
      const output = await executeStep(run, step);
      const message = typeof output === "object" ? output.message : output;
      const flow = typeof output === "object" ? output.flow : step.on_success;
      await addLog(run, message, typeof output === "object" ? output.level || "success" : "success");
      const nextIndex = actionToIndex(flow, indexes, indexes.nextByIndex.get(index));
      if (mustAdvanceSpreadsheetRow(run, index, nextIndex)) {
        await addLog(run, `Linha ${run.spreadsheetLoop.row + 1}/${run.spreadsheetLoop.total} concluida; avancando para o proximo valor.`);
        return;
      }
      if (!Number.isInteger(nextIndex)) return;
      if (nextIndex !== indexes.nextByIndex.get(index)) await addLog(run, flowLabel(flow), "info");
      index = nextIndex;
    } catch (error) {
      if (error?.flowdetectOcrTargetFailure) throw error;
      if (!flowContinues(step.on_failure)) throw error;
      const nextIndex = actionToIndex(step.on_failure, indexes, indexes.nextByIndex.get(index));
      await addLog(run, `${String(error?.message || error)} ${flowLabel(step.on_failure)}`, "warning");
      if (mustAdvanceSpreadsheetRow(run, index, nextIndex)) {
        await addLog(run, `Linha ${run.spreadsheetLoop.row + 1}/${run.spreadsheetLoop.total} finalizada pela regra do bloco; avancando para o proximo valor.`, "warning");
        return;
      }
      if (!Number.isInteger(nextIndex)) return;
      index = nextIndex;
    }
  }
}

async function executeAutomation(automation, tabId, startRow = 1) {
  if (!automation || automation.schema !== "flowdetect_chrome_automation" || ![1, 2, 3].includes(Number(automation.version))) {
    throw new Error("Arquivo de automação Chrome inválido.");
  }
  if (!Array.isArray(automation.steps) || !automation.steps.length) {
    throw new Error("Essa automação não possui blocos compatíveis com a extensão.");
  }
  const run = createRun(automation, tabId, startRow);
  activeRuns.set(run.id, run);
  await addLog(run, `Iniciando ${run.automationName}.`);
  try {
    const steps = automation.steps;
    const indexes = buildFlowIndexes(steps);
    const initialSequence = normalizedSequence(automation.initial_sequence);
    const firstStep = indexes.sequenceStart.get(initialSequence);
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
    run.finishedAt = new Date().toISOString();
    if (run.report) run.report.finishedAt = run.finishedAt;
    activeRuns.delete(run.id);
    await persistRun(run);
  }
  return run;
}

async function handleMessage(message, sender) {
  if (message?.type === "flowdetect-runtime-info") {
    return {
      ok: true,
      version: RUNTIME_VERSION,
      capabilities: ["ocr_text", "visual_match", "visual_state", "focused_text", "data_source", "key_sequence", "viewport_click"]
    };
  }
  if (message?.type === "flowdetect-start") {
    const tabId = Number(message.tabId || sender?.tab?.id);
    if (!Number.isInteger(tabId)) throw new Error("Não encontrei a aba que receberá a automação.");
    const run = await executeAutomation(message.automation, tabId, message.startRow);
    return { ok: run.status === "completed", run };
  }
  if (message?.type === "flowdetect-stop") {
    const running = [...activeRuns.values()].find((run) => run.status === "running");
    if (running) {
      running.cancelled = true;
      await addLog(running, "Parada solicitada pelo usuário.", "warning");
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
  handleMessage(message, sender).then(sendResponse).catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));
  return true;
});

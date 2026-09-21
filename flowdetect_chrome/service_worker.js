const RUN_STORAGE_KEY = "flowdetectChromeLastRun";
const RUNTIME_VERSION = "0.2.2";
const activeRuns = new Map();
const imageBitmapCache = new Map();

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => null);

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, Math.max(0, milliseconds)));

function createRun(automation, tabId) {
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
    variables: {}
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
  const limite = Date.now() + timeoutDaPagina(message);
  let ultimoErro = null;
  while (Date.now() < limite) {
    try {
      await esperarAbaPronta(tabId, Math.min(1200, Math.max(250, limite - Date.now())));
      await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
      const resposta = await chrome.tabs.sendMessage(tabId, message);
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
  if (step.type === "data_source") {
    run.dataSource = { name: step.name || "valor", values: Array.isArray(step.values) ? step.values : [], interval: Number(step.interval_ms || 0) };
    return `${run.dataSource.values.length} valor(es) preparados para o loop ${run.dataSource.name}.`;
  }
  if (step.type === "loop_end" || step.type === "loop_start") return "Marcador de loop processado.";
  if (["element_action", "ocr_text", "focused_text", "key_sequence", "viewport_click", "wait_text"].includes(step.type)) {
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

function actionToIndex(flow, orderIndex, fallback) {
  const action = String(flow?.action || "continuar").toLowerCase();
  if (["ir_para_bloco", "ir_para_outro_bloco", "ir_para"].includes(action)) {
    const target = orderIndex.get(Number(flow?.block));
    if (Number.isInteger(target) && target !== fallback - 1) return target;
  }
  return fallback;
}

function flowContinues(flow) {
  const action = String(flow?.action || "parar").toLowerCase();
  return ["continuar", "continue", "seguir", "ir_para_bloco", "ir_para_outro_bloco", "ir_para"].includes(action);
}

async function executeRange(run, steps, start, end, pairs, orderIndex, depth = 0) {
  if (depth > 5) throw new Error("Loops aninhados demais para executar no Chrome.");
  let index = start;
  while (index < end) {
    if (run.cancelled) throw new Error("Execução interrompida pelo usuário.");
    const step = steps[index];
    if (step.type === "loop_end") return;
    if (step.type === "loop_start") {
      const loopEnd = pairs.get(index);
      if (!Number.isInteger(loopEnd)) throw new Error("O bloco Início do loop não possui um Fim do loop.");
      const source = run.dataSource || { name: "valor", values: [] };
      if (!source.values.length) throw new Error("O loop não possui valores da planilha para executar.");
      for (let row = 0; row < source.values.length; row += 1) {
        run.variables[source.name] = source.values[row];
        await addLog(run, `Loop ${source.name}: ${row + 1}/${source.values.length} · ${source.values[row]}`);
        await executeRange(run, steps, index + 1, loopEnd, pairs, orderIndex, depth + 1);
        if (row < source.values.length - 1 && source.interval) await sleep(source.interval);
      }
      index = loopEnd + 1;
      continue;
    }
    run.currentStep += 1;
    await persistRun(run);
    await addLog(run, `Bloco ${step.source_order || index + 1}: ${step.type}.`);
    try {
      const output = await executeStep(run, step);
      const message = typeof output === "object" ? output.message : output;
      const flow = typeof output === "object" ? output.flow : step.on_success;
      await addLog(run, message, "success");
      index = actionToIndex(flow, orderIndex, index + 1);
    } catch (error) {
      if (!flowContinues(step.on_failure)) throw error;
      await addLog(run, `${String(error?.message || error)} Continuando conforme o bloco.`, "warning");
      index = actionToIndex(step.on_failure, orderIndex, index + 1);
    }
  }
}

async function executeAutomation(automation, tabId) {
  if (!automation || automation.schema !== "flowdetect_chrome_automation" || ![1, 2].includes(Number(automation.version))) {
    throw new Error("Arquivo de automação Chrome inválido.");
  }
  if (!Array.isArray(automation.steps) || !automation.steps.length) {
    throw new Error("Essa automação não possui blocos compatíveis com a extensão.");
  }
  const run = createRun(automation, tabId);
  activeRuns.set(run.id, run);
  await addLog(run, `Iniciando ${run.automationName}.`);
  try {
    const steps = automation.steps;
    const orderIndex = new Map(steps.map((step, index) => [Number(step.source_order), index]));
    await executeRange(run, steps, 0, steps.length, loopPairs(steps), orderIndex);
    run.status = "completed";
    await addLog(run, "Automação concluída com sucesso.", "success");
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
  if (message?.type === "flowdetect-runtime-info") {
    return {
      ok: true,
      version: RUNTIME_VERSION,
      capabilities: ["ocr_text", "visual_match", "visual_state", "focused_text", "key_sequence", "viewport_click"]
    };
  }
  if (message?.type === "flowdetect-start") {
    const tabId = Number(message.tabId || sender?.tab?.id);
    if (!Number.isInteger(tabId)) throw new Error("Não encontrei a aba que receberá a automação.");
    const run = await executeAutomation(message.automation, tabId);
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

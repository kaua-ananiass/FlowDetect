if (!globalThis.__flowDetectChromeRunnerLoaded) {
  globalThis.__flowDetectChromeRunnerLoaded = true;

  const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
  const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, Math.max(0, milliseconds)));

  function escapeCss(value) {
    return globalThis.CSS?.escape ? CSS.escape(String(value)) : String(value).replace(/(["\\#.:,[\]>+~*^$|= !])/g, "\\$1");
  }

  function isVisible(element) {
    if (!element || !(element instanceof Element)) return false;
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0;
  }

  function elementText(element) {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) return element.value || element.placeholder || element.getAttribute("aria-label") || "";
    return element.innerText || element.textContent || element.getAttribute("aria-label") || element.getAttribute("alt") || element.getAttribute("title") || "";
  }

  function textMatches(value, expected) {
    const text = normalize(value);
    return text === expected || text.includes(expected);
  }

  function findTextTarget(text) {
    const expected = normalize(text);
    if (!expected) return null;
    const selectors = "button, a, input, textarea, select, label, [role='button'], [role='link'], [contenteditable='true'], [aria-label], [title], img[alt]";
    const candidates = [...document.querySelectorAll(selectors)].filter(isVisible);
    const direct = candidates.find((element) => normalize(elementText(element)) === expected)
      || candidates.find((element) => textMatches(elementText(element), expected));
    if (direct) return { element: direct, rect: direct.getBoundingClientRect(), text: elementText(direct) };

    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!textMatches(node.nodeValue, expected)) continue;
      const element = node.parentElement;
      if (!isVisible(element)) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rect = [...range.getClientRects()].find((item) => item.width > 0 && item.height > 0) || element.getBoundingClientRect();
      if (rect.width > 0 || rect.height > 0) return { element, rect, text: node.nodeValue.trim() };
    }
    return null;
  }

  function resolveElement(selector = {}) {
    const method = String(selector.method || "css").toLowerCase();
    const value = String(selector.value || "").trim();
    if (!value) return null;
    if (method === "css") return document.querySelector(value);
    if (method === "id") return document.getElementById(value);
    if (method === "name") return document.querySelector(`[name="${escapeCss(value)}"]`);
    if (method === "placeholder") return document.querySelector(`[placeholder="${escapeCss(value)}"]`);
    if (method === "aria-label") return document.querySelector(`[aria-label="${escapeCss(value)}"]`);
    if (method === "text") return findTextTarget(value)?.element || null;
    if (method === "xpath") {
      try { return document.evaluate(value, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue; } catch (_) { return null; }
    }
    return document.querySelector(value);
  }

  async function waitForElement(selector, timeoutMs) {
    const deadline = Date.now() + Math.max(500, Number(timeoutMs || 10000));
    while (Date.now() <= deadline) {
      const element = resolveElement(selector);
      if (element && isVisible(element)) return element;
      await sleep(120);
    }
    throw new Error(`Não encontrei o elemento: ${selector?.value || "seletor vazio"}.`);
  }

  async function waitForTextTarget(text, timeoutMs, attempts = 1, interval = 0) {
    const deadline = Date.now() + Math.max(500, Number(timeoutMs || 10000));
    let currentAttempt = 0;
    while (Date.now() <= deadline) {
      const target = findTextTarget(text);
      if (target) return target;
      currentAttempt += 1;
      if (currentAttempt >= Math.max(1, Number(attempts || 1)) && !interval) break;
      await sleep(Math.max(120, Number(interval || 150)));
    }
    throw new Error(`OCR não encontrou o texto: ${text}.`);
  }

  function highlightRect(rect, { color = "#32e6c6", label = "" } = {}) {
    const outline = document.createElement("div");
    outline.setAttribute("data-flowdetect-overlay", "true");
    outline.style.cssText = [
      "position:fixed", "pointer-events:none", "z-index:2147483647", `border:2px solid ${color}`,
      "border-radius:6px", `box-shadow:0 0 0 4px color-mix(in srgb, ${color} 18%, transparent),0 0 18px ${color}`,
      `left:${Math.round(rect.left)}px`, `top:${Math.round(rect.top)}px`, `width:${Math.max(4, Math.round(rect.width))}px`, `height:${Math.max(4, Math.round(rect.height))}px`,
      "transition:opacity .2s ease"
    ].join(";");
    if (label) {
      const tag = document.createElement("span");
      tag.textContent = label;
      tag.style.cssText = `position:absolute;left:-2px;top:-18px;padding:2px 5px;border-radius:5px;background:${color};color:#071018;font:800 10px/1 Inter,Arial,sans-serif;letter-spacing:.04em;`;
      outline.append(tag);
    }
    document.documentElement.appendChild(outline);
    setTimeout(() => outline.remove(), 1100);
  }

  function highlight(element, color = "#32e6c6", label = "") {
    highlightRect(element.getBoundingClientRect(), { color, label });
  }

  function setNativeValue(element, value) {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (setter) setter.call(element, value); else element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function focusableTarget(element) {
    return element?.closest?.("button,a,input,textarea,select,label,[role='button'],[contenteditable='true']") || element;
  }

  function clickTarget(target, clicks = 1) {
    const clickable = focusableTarget(target);
    clickable?.focus?.({ preventScroll: true });
    for (let index = 0; index < Math.max(1, Number(clicks || 1)); index += 1) clickable?.click?.();
    return clickable;
  }

  function setContentEditableValue(element, value, append) {
    element.focus();
    element.textContent = append ? `${element.textContent || ""}${value}` : value;
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  }

  function applyTextToFocused(step) {
    const element = document.activeElement;
    if (!element || element === document.body || element === document.documentElement) throw new Error("Selecione um campo na página antes do bloco Texto livre.");
    const text = String(step.text || "");
    if (element.isContentEditable) setContentEditableValue(element, text, !step.clear_before);
    else if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) setNativeValue(element, step.clear_before ? text : `${element.value || ""}${text}`);
    else throw new Error("O elemento ativo não aceita texto.");
    highlight(element, "#54ecd2", "TEXTO");
    return `Texto preenchido no campo ativo (${text.length} caracteres).`;
  }

  const KEY_NAMES = { ctrl: "Control", ctrl_r: "Control", shift: "Shift", shift_r: "Shift", alt: "Alt", alt_r: "Alt", cmd: "Meta", cmd_r: "Meta", esc: "Escape", space: " ", pgup: "PageUp", pgdn: "PageDown", del: "Delete" };
  function keyName(key) { return KEY_NAMES[key] || (key.length === 1 ? key : key[0]?.toUpperCase() + key.slice(1)); }
  function dispatchKeySequence(keys, repetitions = 1) {
    const target = document.activeElement || document.body;
    const raw = keys.map((key) => String(key || "").toLowerCase()).filter(Boolean);
    if (!raw.length) throw new Error("Sequência de teclas vazia.");
    for (let attempt = 0; attempt < Math.max(1, Number(repetitions || 1)); attempt += 1) {
      const modifiers = { ctrlKey: raw.some((key) => key === "ctrl" || key === "ctrl_r"), shiftKey: raw.some((key) => key === "shift" || key === "shift_r"), altKey: raw.some((key) => key === "alt" || key === "alt_r"), metaKey: raw.some((key) => key === "cmd" || key === "cmd_r") };
      raw.forEach((key) => target.dispatchEvent(new KeyboardEvent("keydown", { key: keyName(key), bubbles: true, ...modifiers })));
      raw.slice().reverse().forEach((key) => target.dispatchEvent(new KeyboardEvent("keyup", { key: keyName(key), bubbles: true, ...modifiers })));
      if (raw.length === 1 && raw[0] === "enter") target.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (target instanceof Element) highlight(target, "#55e6d5", "TECLA");
    return `Tecla enviada: ${raw.join(" + ")}.`;
  }

  async function executeElementAction(step) {
    const element = await waitForElement(step.selector, step.timeout_ms);
    element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    await sleep(120);
    highlight(element);
    const action = step.action || {};
    const type = String(action.type || "clicar").toLowerCase();
    const value = String(action.value || "");
    if (["esperar", "verificar_existe"].includes(type)) return "Elemento confirmado.";
    if (type === "pegar_texto") return `Texto lido: ${elementText(element).trim().slice(0, 120) || "vazio"}.`;
    if (type === "preencher" || type === "limpar") {
      if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element.isContentEditable)) throw new Error("O seletor encontrado não é um campo editável.");
      const nextValue = type === "limpar" ? "" : value;
      if (element.isContentEditable) setContentEditableValue(element, nextValue, action.clear_before === false);
      else setNativeValue(element, action.clear_before === false ? `${element.value}${nextValue}` : nextValue);
      if (action.press_after) dispatchKeySequence([action.press_after]);
      return type === "limpar" ? "Campo limpo." : "Campo preenchido.";
    }
    if (["selecionar_texto", "selecionar_valor", "selecionar_indice"].includes(type)) {
      if (!(element instanceof HTMLSelectElement)) throw new Error("O seletor encontrado não é uma lista de seleção.");
      if (type === "selecionar_indice") element.selectedIndex = Number.parseInt(value, 10);
      else {
        const option = [...element.options].find((item) => type === "selecionar_valor" ? item.value === value : normalize(item.text) === normalize(value));
        if (!option) throw new Error(`Não encontrei a opção: ${value}.`);
        element.value = option.value;
      }
      element.dispatchEvent(new Event("input", { bubbles: true })); element.dispatchEvent(new Event("change", { bubbles: true }));
      return "Opção selecionada.";
    }
    if (type === "marcar_checkbox") {
      if (element instanceof HTMLInputElement && !element.checked) element.click(); else if (!(element instanceof HTMLInputElement)) element.click();
      return "Opção marcada.";
    }
    clickTarget(element);
    return "Clique executado.";
  }

  async function executeOcrText(step) {
    const target = await waitForTextTarget(step.text, step.timeout_ms, step.attempts, step.interval_ms);
    target.element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    await sleep(130);
    const rect = target.element.getBoundingClientRect();
    highlightRect(rect, { color: "#44b9ff", label: "OCR" });
    const shouldClick = Boolean(step.click) && !["confirmar", "esperar", "verificar"].includes(String(step.action || "").toLowerCase());
    if (shouldClick) clickTarget(target.element, step.clicks);
    return `OCR encontrou “${String(step.text).slice(0, 80)}”${shouldClick ? " e clicou" : ""}.`;
  }

  function clickAt(step) {
    const x = Number(step.x || 0); const y = Number(step.y || 0);
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) throw new Error(`Clique ${Math.round(x)}, ${Math.round(y)} está fora da aba visível.`);
    const target = document.elementFromPoint(x, y);
    if (!target) throw new Error("Não encontrei um elemento na coordenada do clique.");
    const rect = target.getBoundingClientRect();
    highlightRect(rect.width && rect.height ? rect : { left: x - 5, top: y - 5, width: 10, height: 10 }, { color: "#54ecd2", label: "CLIQUE" });
    clickTarget(target, step.clicks);
    return `Clique executado em ${Math.round(x)}, ${Math.round(y)}.`;
  }

  function visualCoordinate(request) {
    const x = Number(request.x || 0); const y = Number(request.y || 0);
    const rect = { left: x - (Number(request.width || 12) / 2), top: y - (Number(request.height || 12) / 2), width: Number(request.width || 12), height: Number(request.height || 12) };
    highlightRect(rect, { color: request.color || "#cf8cff", label: request.label || "VISUAL" });
    if (Number(request.clicks || 0) > 0) {
      const target = document.elementFromPoint(x, y);
      if (target) clickTarget(target, request.clicks);
    }
    return { x, y };
  }

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request?.type === "flowdetect-viewport-info") {
      sendResponse({ ok: true, width: innerWidth, height: innerHeight, devicePixelRatio });
      return;
    }
    if (request?.type === "flowdetect-click-coordinate") {
      try { const point = visualCoordinate(request); sendResponse({ ok: true, point }); } catch (error) { sendResponse({ ok: false, error: String(error?.message || error) }); }
      return;
    }
    if (request?.type !== "flowdetect-execute-step") return;
    const step = request.step || {};
    let execute;
    if (step.type === "ocr_text") execute = executeOcrText(step);
    else if (step.type === "focused_text") execute = Promise.resolve().then(() => applyTextToFocused(step));
    else if (step.type === "key_sequence") execute = Promise.resolve().then(() => dispatchKeySequence(step.keys || [], step.repetitions));
    else if (step.type === "viewport_click") execute = Promise.resolve().then(() => clickAt(step));
    else if (step.type === "wait_text") execute = waitForTextTarget(step.text, step.timeout_ms).then(() => `Texto confirmado: ${step.text}.`);
    else execute = executeElementAction(step);
    execute.then((message) => sendResponse({ ok: true, message })).catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));
    return true;
  });
}

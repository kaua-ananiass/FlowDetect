(() => {
const CONTENT_RUNTIME_VERSION = "0.2.18";
if (globalThis.__flowDetectChromeRunnerVersion !== CONTENT_RUNTIME_VERSION) {
  const previousListener = globalThis.__flowDetectChromeRunnerListener;
  if (previousListener) chrome.runtime.onMessage.removeListener(previousListener);
  globalThis.__flowDetectChromeRunnerVersion = CONTENT_RUNTIME_VERSION;

  const normalize = (value) => String(value || "")
    .replace(/\uFFFD/g, "?")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");
  const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, Math.max(0, milliseconds)));

  function escapeCss(value) {
    return globalThis.CSS?.escape ? CSS.escape(String(value)) : String(value).replace(/(["\\#.:,[\]>+~*^$|= !])/g, "\\$1");
  }

  function isVisible(element) {
    if (!element || !(element instanceof Element)) return false;
    for (let current = element; current && current instanceof Element; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity || 1) <= 0) return false;
      if (current.getAttribute("aria-hidden") === "true") return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function elementText(element) {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) return element.value || element.placeholder || element.getAttribute("aria-label") || "";
    return element.innerText || element.textContent || element.getAttribute("aria-label") || element.getAttribute("alt") || element.getAttribute("title") || "";
  }

  function textMatches(value, expected) {
    const text = normalize(value);
    if (text === expected || text.includes(expected)) return true;
    if (!expected.includes("?")) return false;
    const meaningfulTerms = expected.split(/[^\p{L}\p{N}]+/u).filter((term) => term.length >= 4);
    return meaningfulTerms.length > 0 && meaningfulTerms.every((term) => text.includes(term));
  }

  function findStaticTextTarget(expected) {
    const selectors = [
      "[role='alert']", "[role='status']", "[role='banner']", "output",
      "[class*='alert']", "[class*='banner']", "[class*='message']",
      "[class*='notice']", "[class*='notification']", "[class*='toast']"
    ].join(", ");
    const matches = [...document.querySelectorAll(selectors)]
      .filter(isVisible)
      .map((element) => ({ element, text: elementText(element).trim() }))
      .filter((candidate) => candidate.text && textMatches(candidate.text, expected))
      .sort((first, second) => first.text.length - second.text.length);
    if (!matches.length) return null;
    const match = matches[0];
    return { element: match.element, rect: match.element.getBoundingClientRect(), text: match.text };
  }

  function findRenderedTextTarget(text) {
    const query = String(text || "").trim();
    if (!query || typeof window.find !== "function") return null;
    const selection = window.getSelection();
    const previousRange = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
    try {
      if (!window.find(query, false, false, true, false, false, false)) return null;
      if (!selection?.rangeCount) return null;
      const range = selection.getRangeAt(0);
      const rect = [...range.getClientRects()].find((item) => item.width > 0 && item.height > 0);
      const element = range.commonAncestorContainer?.nodeType === Node.ELEMENT_NODE
        ? range.commonAncestorContainer
        : range.commonAncestorContainer?.parentElement;
      if (!element || !rect || !isVisible(element)) return null;
      return { element, rect, text: range.toString().trim(), renderedText: true };
    } catch (_) {
      return null;
    } finally {
      if (selection) {
        selection.removeAllRanges();
        if (previousRange) selection.addRange(previousRange);
      }
    }
  }

  function findTextTarget(text, options = {}) {
    const expected = normalize(text);
    if (!expected) return null;
    const selectors = "button, a, input, textarea, select, label, [role='button'], [role='link'], [role='option'], [role='menuitem'], [role='tab'], [role='treeitem'], [role='gridcell'], [contenteditable='true'], [aria-label], [title], img[alt]";
    const candidates = [...document.querySelectorAll(selectors)].filter(isVisible);
    const direct = candidates.find((element) => normalize(elementText(element)) === expected)
      || candidates.find((element) => textMatches(elementText(element), expected));
    if (direct) return { element: direct, rect: direct.getBoundingClientRect(), text: elementText(direct) };

    const staticTarget = findStaticTextTarget(expected);
    if (staticTarget) return staticTarget;

    const renderedTarget = findRenderedTextTarget(text);
    if (renderedTarget) return renderedTarget;

    if (options.allowDocumentText) {
      const documentElement = document.body || document.documentElement;
      const renderedText = String(documentElement?.innerText || documentElement?.textContent || "");
      if (renderedText && textMatches(renderedText, expected)) {
        return {
          element: documentElement,
          rect: documentElement.getBoundingClientRect(),
          text: expected,
          documentText: true
        };
      }
    }

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

  async function waitForTextTarget(text, timeoutMs, attempts = 1, interval = 0, options = {}) {
    const timeout = Math.max(500, Number(timeoutMs || 10000));
    const deadline = Date.now() + timeout;
    const retryDelay = Math.max(120, Number(interval || 0) || Math.min(500, Math.round(timeout / (Math.max(1, Number(attempts || 1)) + 1))));
    while (Date.now() <= deadline) {
      const target = findTextTarget(text, options);
      if (target) return target;
      if (Date.now() + retryDelay > deadline) break;
      await sleep(retryDelay);
    }
    throw new Error("OCR nao encontrou o texto: " + text + ".");
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
    return element?.closest?.("button,a,input,textarea,select,label,[role='button'],[role='link'],[role='option'],[role='menuitem'],[role='tab'],[role='treeitem'],[role='gridcell'],[contenteditable='true']") || element;
  }

  function isClickReady(element) {
    if (!element || !(element instanceof Element)) return false;
    for (let current = element; current && current instanceof Element; current = current.parentElement) {
      if (current.disabled || current.getAttribute("disabled") !== null || current.getAttribute("aria-disabled") === "true") return false;
      const className = typeof current.className === "string" ? current.className : "";
      if (/(^|\s)(?:is-)?disabled(?=\s|$)|\bMui-disabled\b/.test(className)) return false;
      if (getComputedStyle(current).pointerEvents === "none") return false;
    }
    return true;
  }

  async function waitForClickableTarget(target, point = null, timeoutMs = 10000) {
    const timeout = Math.max(500, Number(timeoutMs || 10000));
    const deadline = Date.now() + timeout;
    const x = Number(point?.x);
    const y = Number(point?.y);
    const retryDelay = 140;
    while (Date.now() <= deadline) {
      const atRecognizedPoint = Number.isFinite(x) && Number.isFinite(y)
        ? document.elementFromPoint(x, y)
        : null;
      const clickable = focusableTarget(atRecognizedPoint || target);
      if (clickable && isVisible(clickable) && isClickReady(clickable)) return clickable;
      if (Date.now() + retryDelay > deadline) break;
      await sleep(retryDelay);
    }
    throw new Error("O alvo encontrado permaneceu desativado e nao recebeu o clique.");
  }

  function clickTarget(target, clicks = 1, point = null) {
    const x = Number(point?.x);
    const y = Number(point?.y);
    const atRecognizedPoint = Number.isFinite(x) && Number.isFinite(y)
      ? document.elementFromPoint(x, y)
      : null;
    const clickable = focusableTarget(atRecognizedPoint || target);
    if (!clickable || !isVisible(clickable)) throw new Error("O alvo reconhecido nao esta visivel para receber o clique.");
    if (!isClickReady(clickable)) throw new Error("O alvo reconhecido esta desativado e nao recebeu o clique.");
    clickable?.focus?.({ preventScroll: true });
    for (let index = 0; index < Math.max(1, Number(clicks || 1)); index += 1) {
      const rect = clickable.getBoundingClientRect();
      const clientX = Number.isFinite(x) ? x : rect.left + rect.width / 2;
      const clientY = Number.isFinite(y) ? y : rect.top + rect.height / 2;
      const mouse = { bubbles: true, cancelable: true, composed: true, view: window, clientX, clientY, button: 0, buttons: 1 };
      if (globalThis.PointerEvent) clickable.dispatchEvent(new PointerEvent("pointerdown", { ...mouse, pointerId: 1, pointerType: "mouse", isPrimary: true }));
      clickable.dispatchEvent(new MouseEvent("mousedown", mouse));
      clickable?.focus?.({ preventScroll: true });
      if (globalThis.PointerEvent) clickable.dispatchEvent(new PointerEvent("pointerup", { ...mouse, buttons: 0, pointerId: 1, pointerType: "mouse", isPrimary: true }));
      clickable.dispatchEvent(new MouseEvent("mouseup", { ...mouse, buttons: 0 }));
      clickable.click();
    }
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

  const KEY_NAMES = { ctrl: "Control", ctrl_r: "Control", shift: "Shift", shift_r: "Shift", alt: "Alt", alt_r: "Alt", cmd: "Meta", cmd_r: "Meta", esc: "Escape", escape: "Escape", space: " ", pgup: "PageUp", pgdn: "PageDown", del: "Delete" };
  const MODIFIER_KEYS = new Set(["ctrl", "ctrl_r", "shift", "shift_r", "alt", "alt_r", "cmd", "cmd_r"]);
  function keyName(key) { return KEY_NAMES[key] || (key.length === 1 ? key : key[0]?.toUpperCase() + key.slice(1)); }
  function currentKeyboardTarget() {
    return document.activeElement instanceof Element ? document.activeElement : document.body;
  }
  function focusableElements() {
    const selector = "a[href],button,input,textarea,select,[tabindex]:not([tabindex='-1']),[contenteditable='true'],[role='button'],[role='link'],[role='option'],[role='tab'],[role='menuitem']";
    return [...document.querySelectorAll(selector)].filter((element) => (
      isVisible(element) && !element.disabled && element.getAttribute("aria-disabled") !== "true"
    ));
  }
  function focusByTab(reverse = false) {
    const candidates = focusableElements();
    if (!candidates.length) return currentKeyboardTarget();
    const active = currentKeyboardTarget();
    const index = candidates.indexOf(active);
    const next = candidates[(index + (reverse ? -1 : 1) + candidates.length) % candidates.length];
    next.focus?.({ preventScroll: true });
    return next;
  }
  function changeSelectValue(element, direction) {
    const next = Math.max(0, Math.min(element.options.length - 1, element.selectedIndex + direction));
    if (next === element.selectedIndex) return false;
    element.selectedIndex = next;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  function applyKeyDefault(target, key, modifiers) {
    if (modifiers.ctrlKey || modifiers.altKey || modifiers.metaKey) return false;
    if (key === "tab") {
      focusByTab(modifiers.shiftKey);
      return true;
    }
    if (key === "escape" || key === "esc") {
      target.blur?.();
      return true;
    }
    if (key === "up" || key === "down") {
      if (target instanceof HTMLSelectElement) return changeSelectValue(target, key === "up" ? -1 : 1);
      return false;
    }
    if (key === "enter" || key === "space") {
      const clickable = focusableTarget(target);
      if (clickable?.matches?.("button,a,[role='button'],[role='link'],[role='option'],[role='menuitem'],input[type='checkbox'],input[type='radio']")) {
        clickTarget(clickable);
        return true;
      }
      if (key === "enter" && target instanceof HTMLInputElement && target.form?.requestSubmit) {
        target.form.requestSubmit();
        return true;
      }
    }
    return false;
  }
  function dispatchKeySequence(keys, repetitions = 1) {
    const raw = (keys || []).map((key) => String(key || "").trim().toLowerCase()).filter(Boolean);
    if (!raw.length) throw new Error("Sequ?ncia de teclas vazia.");
    const modifiers = {
      ctrlKey: raw.some((key) => key === "ctrl" || key === "ctrl_r"),
      shiftKey: raw.some((key) => key === "shift" || key === "shift_r"),
      altKey: raw.some((key) => key === "alt" || key === "alt_r"),
      metaKey: raw.some((key) => key === "cmd" || key === "cmd_r")
    };
    const primaryKeys = raw.filter((key) => !MODIFIER_KEYS.has(key));
    if (!primaryKeys.length) throw new Error("Informe uma tecla junto com o atalho.");
    let target = currentKeyboardTarget();
    for (let attempt = 0; attempt < Math.max(1, Number(repetitions || 1)); attempt += 1) {
      for (const key of primaryKeys) {
        target = currentKeyboardTarget();
        const event = { key: keyName(key), bubbles: true, cancelable: true, composed: true, ...modifiers };
        const notCancelled = target.dispatchEvent(new KeyboardEvent("keydown", event));
        if (notCancelled) applyKeyDefault(target, key, modifiers);
        target.dispatchEvent(new KeyboardEvent("keyup", event));
      }
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
      const clickable = await waitForClickableTarget(element, null, step.timeout_ms);
      if (element instanceof HTMLInputElement && !element.checked) clickTarget(clickable); else if (!(element instanceof HTMLInputElement)) clickTarget(clickable);
      return "Opção marcada.";
    }
    const clickable = await waitForClickableTarget(element, null, step.timeout_ms);
    clickTarget(clickable);
    return "Clique executado.";
  }

  async function executeOcrText(step) {
    const shouldClick = Boolean(step.click) && !["confirmar", "esperar", "verificar"].includes(String(step.action || "").toLowerCase());
    const target = await waitForTextTarget(step.text, step.timeout_ms, step.attempts, step.interval_ms, {
      allowDocumentText: !shouldClick
    });
    target.element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    await sleep(180);
    const refreshedTarget = findTextTarget(step.text, { allowDocumentText: !shouldClick }) || target;
    const rect = refreshedTarget.rect || refreshedTarget.element.getBoundingClientRect();
    const clickPoint = {
      x: Math.max(1, Math.min(innerWidth - 1, rect.left + rect.width / 2 + Number(step.offset_x || 0))),
      y: Math.max(1, Math.min(innerHeight - 1, rect.top + rect.height / 2 + Number(step.offset_y || 0)))
    };
    highlightRect(rect, { color: "#44b9ff", label: "OCR" });
    if (shouldClick) {
      const clickable = await waitForClickableTarget(refreshedTarget.element, clickPoint, step.timeout_ms);
      clickTarget(clickable, step.clicks, clickPoint);
    }
    return `OCR encontrou “${String(step.text).slice(0, 80)}”${shouldClick ? " e clicou" : ""}.`;
  }

  async function clickAt(step) {
    const x = Number(step.x || 0); const y = Number(step.y || 0);
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) throw new Error(`Clique ${Math.round(x)}, ${Math.round(y)} está fora da aba visível.`);
    const target = document.elementFromPoint(x, y);
    if (!target) throw new Error("Não encontrei um elemento na coordenada do clique.");
    const rect = target.getBoundingClientRect();
    highlightRect(rect.width && rect.height ? rect : { left: x - 5, top: y - 5, width: 10, height: 10 }, { color: "#54ecd2", label: "CLIQUE" });
    const clickable = await waitForClickableTarget(target, { x, y }, step.timeout_ms);
    clickTarget(clickable, step.clicks, { x, y });
    return `Clique executado em ${Math.round(x)}, ${Math.round(y)}.`;
  }

  async function visualCoordinate(request) {
    const x = Number(request.x || 0); const y = Number(request.y || 0);
    const rect = { left: x - (Number(request.width || 12) / 2), top: y - (Number(request.height || 12) / 2), width: Number(request.width || 12), height: Number(request.height || 12) };
    highlightRect(rect, { color: request.color || "#cf8cff", label: request.label || "VISUAL" });
    if (Number(request.clicks || 0) > 0) {
      const target = document.elementFromPoint(x, y);
      if (!target) throw new Error("Não encontrei o alvo visual para receber o clique.");
      const clickable = await waitForClickableTarget(target, { x, y }, request.timeout_ms);
      clickTarget(clickable, request.clicks, { x, y });
    }
    return { x, y };
  }

  const flowDetectMessageListener = (request, _sender, sendResponse) => {
    if (request?.type === "flowdetect-viewport-info-v2") {
      sendResponse({ ok: true, width: innerWidth, height: innerHeight, devicePixelRatio });
      return;
    }
    if (request?.type === "flowdetect-click-coordinate-v2") {
      visualCoordinate(request)
        .then((point) => sendResponse({ ok: true, point }))
        .catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));
      return true;
    }
    if (request?.type !== "flowdetect-execute-step-v2") return;
    const step = request.step || {};
    let execute;
    if (step.type === "ocr_text") execute = executeOcrText(step);
    else if (step.type === "focused_text") execute = Promise.resolve().then(() => applyTextToFocused(step));
    else if (step.type === "key_sequence") execute = Promise.resolve().then(() => dispatchKeySequence(step.keys || [], step.repetitions));
    else if (step.type === "viewport_click") execute = Promise.resolve().then(() => clickAt(step));
    else if (step.type === "wait_text") execute = waitForTextTarget(step.text, step.timeout_ms, 1, 0, {
      allowDocumentText: true
    }).then(() => `Texto confirmado: ${step.text}.`);
    else execute = executeElementAction(step);
    execute.then((message) => sendResponse({ ok: true, message })).catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));
    return true;
  };
  chrome.runtime.onMessage.addListener(flowDetectMessageListener);
  globalThis.__flowDetectChromeRunnerListener = flowDetectMessageListener;
}
})();

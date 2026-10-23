(() => {
const CONTENT_RUNTIME_VERSION = "0.2.59";
if (globalThis.__flowDetectChromeRunnerVersion !== CONTENT_RUNTIME_VERSION) {
  const previousListener = globalThis.__flowDetectChromeRunnerListener;
  if (previousListener) chrome.runtime.onMessage.removeListener(previousListener);
  globalThis.__flowDetectElementPickerStop?.();
  globalThis.__flowDetectChromeRunnerVersion = CONTENT_RUNTIME_VERSION;

  const normalize = (value) => String(value || "")
    .replace(/\uFFFD/g, "?")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");
  const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, Math.max(0, milliseconds)));
  let currentRunId = "";

  function escapeCss(value) {
    return globalThis.CSS?.escape ? CSS.escape(String(value)) : String(value).replace(/(["\\#.:,[\]>+~*^$|= !])/g, "\\$1");
  }

  function elementPickerAttributeValue(value) {
    const text = String(value || "").trim();
    if (!text || text.length > 120 || /[\u0000-\u001f\u007f]/.test(text)) return "";
    return `"${text.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
  }

  function buildElementPickerSelector(element) {
    if (!(element instanceof Element) || element.getRootNode() !== document) {
      throw new Error("Este elemento esta dentro de um Shadow DOM. Selecione o componente externo ou outro elemento da pagina.");
    }
    const unique = (selector) => {
      if (!selector || selector.length > 1500) return false;
      try {
        const matches = document.querySelectorAll(selector);
        return matches.length === 1 && matches[0] === element;
      } catch (_) { return false; }
    };
    const tag = element.localName.toLowerCase();
    if (element.id && unique(`#${escapeCss(element.id)}`)) return `#${escapeCss(element.id)}`;
    for (const name of ["data-testid", "data-test-id", "data-test", "data-qa", "name", "aria-label", "placeholder", "title"]) {
      const value = elementPickerAttributeValue(element.getAttribute(name));
      if (!value) continue;
      const selector = `${tag}[${name}=${value}]`;
      if (unique(selector)) return selector;
    }
    const classes = [...element.classList].filter((name) => name.length < 64 && !/^[a-f\d_-]{8,}$/i.test(name));
    for (const className of classes.slice(0, 5)) {
      const selector = `${tag}.${escapeCss(className)}`;
      if (unique(selector)) return selector;
    }
    const parts = [];
    for (let current = element; current && current instanceof Element; current = current.parentElement) {
      const siblings = current.parentElement
        ? [...current.parentElement.children].filter((child) => child.localName === current.localName)
        : [current];
      parts.unshift(`${current.localName.toLowerCase()}:nth-of-type(${siblings.indexOf(current) + 1})`);
      const selector = parts.join(" > ");
      if (unique(selector)) return selector;
    }
    throw new Error("Nao foi possivel criar um seletor unico para este elemento.");
  }

  let elementPicker = null;

  function stopElementPicker() {
    if (!elementPicker) return;
    const { host, move, click, key, position, suppress } = elementPicker;
    document.removeEventListener("pointermove", move, true);
    window.removeEventListener("click", click, true);
    window.removeEventListener("keydown", key, true);
    for (const name of ["pointerdown", "pointerup", "mousedown", "mouseup"]) {
      window.removeEventListener(name, suppress, true);
    }
    window.removeEventListener("scroll", position, true);
    window.removeEventListener("resize", position);
    host.remove();
    elementPicker = null;
  }

  function startElementPicker() {
    stopElementPicker();
    if (!document.documentElement) throw new Error("A pagina ainda nao esta pronta. Recarregue-a e tente novamente.");
    const host = document.createElement("div");
    host.setAttribute("data-flowdetect-picker", "true");
    host.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none";
    const shadow = host.attachShadow({ mode: "closed" });
    shadow.innerHTML = `
      <style>
        :host{all:initial}
        *,*::before,*::after{box-sizing:border-box}
        .outline{position:fixed;display:none;pointer-events:none;border:2px solid #12b5cb;border-radius:5px;background:rgba(18,181,203,.12);box-shadow:0 0 0 2px rgba(255,255,255,.85),0 0 22px rgba(18,181,203,.5)}
        .hint,.dialog{position:fixed;z-index:1;font:13px/1.45 "Segoe UI",Arial,sans-serif;color:#e6f7ff;background:#0e1b2e;border:1px solid rgba(94,234,212,.45);border-radius:12px;box-shadow:0 20px 55px rgba(0,0,0,.42);pointer-events:auto}
        .hint{top:16px;left:50%;transform:translateX(-50%);max-width:calc(100vw - 32px);padding:10px 14px;display:flex;align-items:center;flex-wrap:wrap;gap:12px}
        .dialog{top:16px;left:50%;transform:translateX(-50%);width:min(480px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow-y:auto;padding:17px;display:none}
        .dialog[open]{display:block}
        .dialog strong{display:block;font-size:15px;margin-bottom:5px}
        .dialog p{margin:0 0 11px;color:#b9d3dd}
        .dialog textarea{display:block;width:100%;height:74px;resize:vertical;padding:10px;border-radius:8px;border:1px solid rgba(94,234,212,.35);background:#07111f;color:#e6f7ff;font:12px/1.4 Consolas,monospace}
        .actions{display:flex;justify-content:flex-end;gap:8px;margin-top:11px}
        button{padding:7px 11px;border:1px solid rgba(94,234,212,.38);border-radius:8px;background:#123147;color:#e6f7ff;font:600 12px "Segoe UI",Arial,sans-serif;cursor:pointer}
        button.primary{background:#12b5cb;color:#05212a;border-color:#12b5cb}
        button:hover{filter:brightness(1.15)}
        .status{min-height:18px;margin-top:8px;color:#5eead4}
      </style>
      <div class="outline" aria-hidden="true"></div>
      <div class="hint"><span>Passe o mouse e clique no elemento que deseja copiar.</span><button class="cancel" type="button">Cancelar (Esc)</button></div>
      <section class="dialog" role="dialog" aria-label="Seletor do elemento">
        <strong>Elemento mapeado</strong>
        <p>Copie este seletor CSS e cole no bloco OCR, em Chrome · elemento da pagina.</p>
        <textarea aria-label="Seletor CSS" spellcheck="false" readonly></textarea>
        <div class="actions"><button class="again" type="button">Escolher outro</button><button class="copy primary" type="button">Copiar seletor</button><button class="close" type="button">Fechar</button></div>
        <div class="status" role="status" aria-live="polite"></div>
      </section>`;
    document.documentElement.append(host);
    const outline = shadow.querySelector(".outline");
    const hint = shadow.querySelector(".hint");
    const dialog = shadow.querySelector(".dialog");
    const field = shadow.querySelector("textarea");
    const status = shadow.querySelector(".status");
    let selected = null;
    const position = () => {
      if (!selected || !elementPicker || dialog.hasAttribute("open")) return;
      const rect = selected.getBoundingClientRect();
      Object.assign(outline.style, {
        display: "block", left: `${rect.left}px`, top: `${rect.top}px`,
        width: `${rect.width}px`, height: `${rect.height}px`,
      });
    };
    const move = (event) => {
      if (dialog.hasAttribute("open") || event.composedPath().includes(host)) return;
      const target = event.composedPath()[0];
      selected = target instanceof Element ? target : null;
      position();
    };
    const click = (event) => {
      if (dialog.hasAttribute("open") || event.composedPath().includes(host)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      selected = event.composedPath()[0];
      try {
        field.value = buildElementPickerSelector(selected);
        status.textContent = "";
        dialog.setAttribute("open", "");
        hint.style.display = "none";
        outline.style.display = "none";
        field.focus();
        field.select();
      } catch (error) {
        hint.querySelector("span").textContent = String(error.message || error);
      }
    };
    const suppress = (event) => {
      if (dialog.hasAttribute("open") || event.composedPath().includes(host)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const key = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      stopElementPicker();
    };
    shadow.querySelector(".cancel").addEventListener("click", stopElementPicker);
    shadow.querySelector(".close").addEventListener("click", stopElementPicker);
    shadow.querySelector(".again").addEventListener("click", () => {
      dialog.removeAttribute("open");
      hint.style.display = "flex";
      hint.querySelector("span").textContent = "Passe o mouse e clique no elemento que deseja copiar.";
      selected = null;
      field.value = "";
    });
    shadow.querySelector(".copy").addEventListener("click", async () => {
      try {
        let copied = false;
        if (navigator.clipboard?.writeText) {
          try {
            await navigator.clipboard.writeText(field.value);
            copied = true;
          } catch (_) { /* Tenta a copia tradicional abaixo. */ }
        }
        if (!copied) {
          field.focus(); field.select();
          copied = document.execCommand("copy");
        }
        if (!copied) throw new Error("Falha ao copiar.");
        status.textContent = "Seletor copiado. Cole no campo do bloco no FlowDetect Studio.";
      } catch (_) {
        field.focus(); field.select();
        status.textContent = "Nao foi possivel copiar automaticamente. Pressione Ctrl+C.";
      }
    });
    document.addEventListener("pointermove", move, true);
    window.addEventListener("click", click, true);
    window.addEventListener("keydown", key, true);
    for (const name of ["pointerdown", "pointerup", "mousedown", "mouseup"]) {
      window.addEventListener(name, suppress, true);
    }
    window.addEventListener("scroll", position, true);
    window.addEventListener("resize", position);
    elementPicker = { host, move, click, key, position, suppress };
    globalThis.__flowDetectElementPickerStop = stopElementPicker;
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
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) return element.value || element.getAttribute("aria-valuetext") || element.placeholder || element.getAttribute("aria-label") || "";
    return element.getAttribute("aria-valuetext") || element.innerText || element.textContent || element.getAttribute("aria-label") || element.getAttribute("alt") || element.getAttribute("title") || "";
  }

  function normalizeMonthYear(value) {
    return String(value).replace(/\b(20\d{2})\s*[/\.\-\u2044\u2215]\s*(0?[1-9]|1[0-2])\b/g,
      (_match, year, month) => `${month.padStart(2, "0")}/${year}`)
      .replace(/\b(0?[1-9]|1[0-2])\s*[/\.\-\u2044\u2215]\s*(20\d{2})\b/g,
        (_match, month, year) => `${month.padStart(2, "0")}/${year}`);
  }

  function textMatches(value, expected) {
    const text = normalizeMonthYear(normalize(value));
    const wanted = normalizeMonthYear(normalize(expected));
    if (text === wanted || text.includes(wanted)) return true;
    if (!expected.includes("?")) return false;
    const meaningfulTerms = expected.split(/[^\p{L}\p{N}]+/u).filter((term) => term.length >= 4);
    return meaningfulTerms.length > 0 && meaningfulTerms.every((term) => text.includes(term));
  }

  function textRectWithinElement(element, query) {
    if (!element || !query || !document.createRange || !document.createTreeWalker) return null;
    const terms = String(query).trim().split(/\s+/).filter(Boolean);
    if (!terms.length) return null;
    const pattern = new RegExp(terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+"), "i");
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const match = pattern.exec(String(node.nodeValue || ""));
      if (!match) continue;
      const range = document.createRange();
      range.setStart(node, match.index);
      range.setEnd(node, match.index + match[0].length);
      const rect = [...range.getClientRects()].find((item) => item.width > 0 && item.height > 0);
      if (rect) return rect;
    }
    return null;
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
    return { element: match.element, rect: textRectWithinElement(match.element, match.text) || match.element.getBoundingClientRect(), text: match.text };
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
    const selectors = "button, a, input, textarea, select, label, [role='button'], [role='link'], [role='combobox'], [role='textbox'], [role='option'], [role='menuitem'], [role='tab'], [role='treeitem'], [role='gridcell'], [contenteditable='true'], [aria-label], [aria-valuetext], [title], img[alt]";
    const candidates = [...document.querySelectorAll(selectors)].filter(isVisible);
    const direct = candidates.find((element) => normalize(elementText(element)) === expected)
      || candidates.find((element) => textMatches(elementText(element), expected));
    if (direct) return { element: direct, rect: textRectWithinElement(direct, text) || direct.getBoundingClientRect(), text: elementText(direct) };

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
      const rect = textRectWithinElement(element, text)
        || [...range.getClientRects()].find((item) => item.width > 0 && item.height > 0)
        || element.getBoundingClientRect();
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
      "position:fixed", "inset:auto", "margin:0", "padding:0", "background:transparent", "overflow:visible",
      "pointer-events:none", "z-index:2147483647", `border:2px solid ${color}`,
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
    // Um <dialog> modal fica na top layer do navegador, acima de qualquer z-index
    // do documento. Hospedar o marcador dentro dele e abri-lo como popover o
    // mantém visível mesmo quando a janela da empresa está aberta.
    const openModals = document.querySelectorAll("dialog:modal");
    const modal = openModals[openModals.length - 1];
    if (modal) {
      modal.appendChild(outline);
      if (typeof outline.showPopover === "function") {
        outline.setAttribute("popover", "manual");
        try { outline.showPopover(); }
        catch (_) { outline.removeAttribute("popover"); }
      }
    } else {
      document.documentElement.appendChild(outline);
    }
    setTimeout(() => {
      if (outline.matches(":popover-open")) outline.hidePopover();
      outline.remove();
    }, 1100);
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
    return element?.closest?.("button,a,input,textarea,select,label,[role='button'],[role='checkbox'],[role='link'],[role='option'],[role='menuitem'],[role='tab'],[role='treeitem'],[role='gridcell'],[contenteditable='true']") || element;
  }

  function isClickReady(element) {
    if (!element || !(element instanceof Element)) return false;
    if (element.disabled || element.getAttribute("disabled") !== null || element.getAttribute("aria-disabled") === "true") return false;
    try { return !element.matches?.(":disabled"); } catch (_) { return true; }
  }

  async function waitForClickableTarget(target, point = null, timeoutMs = 10000, preferTarget = false) {
    const timeout = Math.max(500, Number(timeoutMs || 10000));
    const deadline = Date.now() + timeout;
    const x = Number(point?.x);
    const y = Number(point?.y);
    const retryDelay = 140;
    while (Date.now() <= deadline) {
      const atRecognizedPoint = Number.isFinite(x) && Number.isFinite(y)
        ? document.elementFromPoint(x, y)
        : null;
      const clickable = focusableTarget(preferTarget ? target : (atRecognizedPoint || target));
      if (clickable && isVisible(clickable) && isClickReady(clickable)) return clickable;
      if (Date.now() + retryDelay > deadline) break;
      await sleep(retryDelay);
    }
    throw new Error("O alvo encontrado permaneceu desativado e nao recebeu o clique.");
  }

  function clickTarget(target, clicks = 1, point = null, preferTarget = false) {
    const x = Number(point?.x);
    const y = Number(point?.y);
    const atRecognizedPoint = Number.isFinite(x) && Number.isFinite(y)
      ? document.elementFromPoint(x, y)
      : null;
    const clickable = focusableTarget(preferTarget ? target : (atRecognizedPoint || target));
    if (!clickable || !isVisible(clickable)) throw new Error("O alvo reconhecido nao esta visivel para receber o clique.");
    if (!isClickReady(clickable)) throw new Error("O alvo reconhecido esta desativado e nao recebeu o clique.");
    const checkbox = checkboxControl(clickable);
    if (checkbox) {
      if (!isClickReady(checkbox)) throw new Error("A caixa de selecao esta desativada e nao recebeu o clique.");
      // Um evento por clique configurado. Clicar no label tambem produz um segundo evento
      // no input; eventos down/up sinteticos podem acionar handlers extras da tabela.
      const boxRect = checkbox.getBoundingClientRect();
      const boxStyle = getComputedStyle(checkbox);
      const isNative = checkbox.matches?.("input[type='checkbox']");
      const nearbyNative = isNative && boxRect.width > 0 && boxRect.height > 0
        && boxStyle.display !== "none" && boxStyle.visibility !== "hidden" && boxStyle.pointerEvents !== "none"
        && Number.isFinite(x) && Number.isFinite(y)
        && Math.hypot(boxRect.left + boxRect.width / 2 - x, boxRect.top + boxRect.height / 2 - y) <= 24;
      const nativeTarget = clickable === checkbox || clickable.control === checkbox || nearbyNative;
      const activationTarget = nativeTarget ? checkbox : clickable;
      activationTarget.focus?.({ preventScroll: true });
      const activationRect = activationTarget.getBoundingClientRect();
      for (let index = 0; index < Math.max(1, Math.floor(Number(clicks) || 1)); index += 1) {
        activationTarget.dispatchEvent(new MouseEvent("click", {
        bubbles: true, cancelable: true, composed: true, view: window, detail: 1,
        clientX: nativeTarget ? activationRect.left + activationRect.width / 2 : (Number.isFinite(x) ? x : activationRect.left + activationRect.width / 2),
        clientY: nativeTarget ? activationRect.top + activationRect.height / 2 : (Number.isFinite(y) ? y : activationRect.top + activationRect.height / 2),
        button: 0, buttons: 0,
        }));
      }
      return clickable;
    }
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

  function checkboxControl(element) {
    if (!element) return null;
    if (element.matches?.("input[type='checkbox'],[role='checkbox']")) return element;
    const label = element.closest?.("label");
    if (label?.control?.matches?.("input[type='checkbox']")) return label.control;
    const role = element.closest?.("[role='checkbox']");
    if (role) return role;
    if (element.matches?.("button,a,input,textarea,select,[role='button'],[role='link']")) return null;
    // Componentes de tabela desenham a caixa num div e mantem o input oculto
    // como irmao. Procura somente no componente/celula, nunca na linha ou tabela.
    for (let current = element, depth = 0; current && depth < 5; current = current.parentElement, depth += 1) {
      if (current.matches?.("tr,table,thead,tbody,tfoot,body,html")) break;
      const controls = current.querySelectorAll?.("input[type='checkbox'],[role='checkbox']") || [];
      if (controls.length === 1) return controls[0];
      if (controls.length > 1 || current.matches?.("td,th,[role='gridcell'],[role='columnheader']")) break;
    }
    return null;
  }

  function checkboxState(control) {
    if (!control) return null;
    if (control.matches?.("input[type='checkbox']")) return Boolean(control.checked);
    const value = control.getAttribute?.("aria-checked");
    return value === "true" ? true : value === "false" ? false : null;
  }

  async function clickAndConfirm(target, clicks = 1, point = null, preferTarget = false, ensureChecked = false) {
    const x = Number(point?.x);
    const y = Number(point?.y);
    const hit = Number.isFinite(x) && Number.isFinite(y) ? document.elementFromPoint(x, y) : null;
    let clickable = focusableTarget(preferTarget ? target : (hit || target));
    let control = checkboxControl(clickable);
    const before = checkboxState(control);
    if (ensureChecked && !control) throw new Error("O elemento encontrado nao e uma caixa de selecao.");
    if (ensureChecked && before === true) return clickable;
    if (!control) return clickTarget(clickable, clicks, point, true);
    const rect = clickable.getBoundingClientRect();
    const refreshX = Number.isFinite(x) ? x : rect.left + rect.width / 2;
    const refreshY = Number.isFinite(y) ? y : rect.top + rect.height / 2;
    let clicked = clickable;
    const count = ensureChecked ? 1 : Math.max(1, Math.floor(Number(clicks) || 1));
    for (let index = 0; index < count; index += 1) {
      const expected = checkboxState(control) !== true;
      clicked = clickTarget(clickable, 1, point, true);
      const deadline = Date.now() + 1800;
      let confirmed = false;
      while (Date.now() <= deadline) {
        if (!control || control.isConnected === false) {
          clickable = focusableTarget(document.elementFromPoint(refreshX, refreshY));
          control = checkboxControl(clickable);
        }
        if (control && checkboxState(control) === expected) {
          // Espera a pagina processar cada alternancia antes de enviar o proximo clique.
          await sleep(140);
          if (control.isConnected === false) {
            clickable = focusableTarget(document.elementFromPoint(refreshX, refreshY));
            control = checkboxControl(clickable);
          }
          if (control && checkboxState(control) === expected) { confirmed = true; break; }
        }
        await sleep(120);
      }
      if (!confirmed) throw new Error(`O clique ${index + 1}/${count} foi enviado, mas a caixa de selecao nao confirmou o estado esperado. A automacao nao confirmou esta etapa.`);
    }
    return clicked;
  }

  function preciseClickTarget(point) {
    const selector = "button, a, label, input[type='button'], input[type='checkbox'], input[type='radio'], [role='button'], [role='checkbox'], [role='menuitem']";
    const candidates = document.querySelectorAll?.(selector) || [];
    const hit = document.elementFromPoint?.(point.x, point.y);
    const associated = checkboxControl(hit);
    let best = null;
    for (const element of candidates) {
      if (element.tagName?.toLowerCase() === "label" && !checkboxControl(element)) continue;
      const rect = element.getBoundingClientRect?.();
      if (!rect || rect.width <= 0 || rect.height <= 0 || rect.width > 96 || rect.height > 96) continue;
      const control = checkboxControl(element);
      if (control && control !== associated && (point.x < rect.left || point.x > rect.left + rect.width
        || point.y < rect.top || point.y > rect.top + rect.height)) continue;
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distance = Math.hypot(centerX - point.x, centerY - point.y);
      if (distance > 24 || !isVisible(element)) continue;
      if (!best || distance < best.distance || (distance === best.distance && rect.width * rect.height < best.area)) {
        best = { element, point: { x: centerX, y: centerY }, distance, area: rect.width * rect.height };
      }
    }
    if (!best && associated?.matches?.("input[type='checkbox']") && isVisible(hit)) {
      const rect = associated.getBoundingClientRect();
      const style = getComputedStyle(associated);
      const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      if (rect.width > 0 && rect.height > 0 && rect.width <= 96 && rect.height <= 96
        && style.display !== "none" && style.visibility !== "hidden" && style.pointerEvents !== "none"
        && Math.hypot(center.x - point.x, center.y - point.y) <= 24) {
        best = { element: focusableTarget(hit), point: center };
      }
    }
    return best;
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
    if (step.require_unique && step.selector?.method === "css") {
      const count = document.querySelectorAll(step.selector.value).length;
      if (count !== 1) throw new Error(`O seletor encontrou ${count} elementos; precisa encontrar exatamente 1.`);
    }
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
      await clickAndConfirm(clickable, 1, null, true, true);
      return "Opção marcada.";
    }
    const clickable = await waitForClickableTarget(element, null, step.timeout_ms);
    await clickAndConfirm(clickable, Math.max(1, Number(step.clicks || 1)));
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
    highlightRect(rect, { color: "#44b9ff", label: "OCR" });
    if (shouldClick) {
      const anchor = step.click_anchor;
      const useMarkedArea = anchor
        && Number.isFinite(Number(anchor.from_text_left))
        && Number.isFinite(Number(anchor.from_text_top));
      const rawX = useMarkedArea
        ? rect.left + Number(anchor.from_text_left)
        : rect.left + rect.width / 2 + Number(step.offset_x || 0);
      const rawY = useMarkedArea
        ? rect.top + Number(anchor.from_text_top)
        : rect.top + rect.height / 2 + Number(step.offset_y || 0);
      if (rawX < 0 || rawY < 0 || rawX >= innerWidth || rawY >= innerHeight) {
        throw new Error("O marcador Clique ficou fora da area visivel da pagina. Ajuste sua posicao no bloco OCR.");
      }
      const clickPoint = { x: rawX, y: rawY };
      const precise = preciseClickTarget(clickPoint);
      const finalPoint = precise?.point || clickPoint;
      const clickable = await waitForClickableTarget(precise?.element || refreshedTarget.element, finalPoint, step.timeout_ms, Boolean(precise));
      await clickAndConfirm(clickable, step.clicks, finalPoint, Boolean(precise));
      const checked = checkboxState(checkboxControl(clickable));
      const selection = checked === null ? "" : ` Caixa de selecao confirmada: ${checked ? "marcada" : "desmarcada"}.`;
      return `OCR encontrou "${String(step.text).slice(0, 80)}" e clicou em ${Math.round(finalPoint.x)}, ${Math.round(finalPoint.y)} (${String(clickable.tagName || "elemento").toLowerCase()}).${selection}`;
    }
    return `OCR encontrou “${String(step.text).slice(0, 80)}”${shouldClick ? " e clicou" : ""}.`;
  }

  async function visualCoordinate(request) {
    const x = Number(request.x || 0); const y = Number(request.y || 0);
    const rect = { left: x - (Number(request.width || 12) / 2), top: y - (Number(request.height || 12) / 2), width: Number(request.width || 12), height: Number(request.height || 12) };
    highlightRect(rect, { color: request.color || "#cf8cff", label: request.label || "VISUAL" });
    if (Number(request.clicks || 0) > 0) {
      const target = document.elementFromPoint(x, y);
      if (!target) throw new Error("Não encontrei o alvo visual para receber o clique.");
      const clickable = await waitForClickableTarget(target, { x, y }, request.timeout_ms);
      await clickAndConfirm(clickable, request.clicks, { x, y });
    }
    return { x, y };
  }

  const flowDetectMessageListener = (request, _sender, sendResponse) => {
    if (request?.type === "flowdetect-content-runtime-v2") {
      sendResponse({ ok: true, version: CONTENT_RUNTIME_VERSION });
      return;
    }
    if (request?.type === "flowdetect-test-recognition-v1") {
      try {
        const selector = String(request.selector || "").trim();
        const results = selector
          ? (() => {
              const matches = [...document.querySelectorAll(selector)].filter(isVisible);
              if (matches[0]) highlightRect(matches[0].getBoundingClientRect(), { color: "#22c55e", label: "Teste Chrome" });
              return [{ text: selector, found: matches.length === 1, matched: `${matches.length} elemento(s) visível(is)` }];
            })()
          : (Array.isArray(request.texts) ? request.texts : []).map((text) => {
              const target = findTextTarget(text);
              if (target?.rect) highlightRect(target.rect, { color: "#22c55e", label: "Teste Chrome" });
              return { text: String(text), found: Boolean(target), matched: String(target?.text || "").trim().slice(0, 160) };
            });
        sendResponse({ ok: results.length > 0 && results.every((item) => item.found), url: location.href, results });
      } catch (error) {
        sendResponse({ ok: false, url: location.href, error: String(error?.message || error), results: [] });
      }
      return;
    }
    if (request?.type === "flowdetect-map-element-v1") {
      try {
        startElementPicker();
        sendResponse({ ok: true });
      } catch (error) {
        sendResponse({ ok: false, error: String(error?.message || error) });
      }
      return;
    }
    if (request?.type === "flowdetect-screen-check-v2") {
      const expected = normalize(request.text);
      const rendered = normalize(document.body?.innerText || "");
      sendResponse({ ok: true, url: location.href, hasText: Boolean(expected && rendered.includes(expected)) });
      return;
    }
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
    if (request.run_id && request.run_id !== currentRunId) {
      currentRunId = request.run_id;
      }
    const step = request.step || {};
    let execute;
    if (step.type === "ocr_text") execute = executeOcrText(step);
    else if (step.type === "focused_text") execute = Promise.resolve().then(() => applyTextToFocused(step));
    else if (step.type === "key_sequence") execute = Promise.resolve().then(() => dispatchKeySequence(step.keys || [], step.repetitions));
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


// Associate a user-triggered download anchor with the actual tab.
if (typeof document !== "undefined" && !globalThis.__flowdetectDownloadHintInstalled) {
globalThis.__flowdetectDownloadHintInstalled = true;
document.addEventListener("click", (event) => {
  const anchor = event.target instanceof Element ? event.target.closest("a[download][href]") : null;
  if (!anchor || !/^(https?:|blob:)/i.test(anchor.href)) return;
  chrome.runtime.sendMessage({ type: "flowdetect-download-source", url: anchor.href }).catch(() => {});
}, true);

}
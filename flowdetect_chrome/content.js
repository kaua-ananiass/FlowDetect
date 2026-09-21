if (!globalThis.__flowDetectChromeRunnerLoaded) {
  globalThis.__flowDetectChromeRunnerLoaded = true;

  const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
  const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, Math.max(0, milliseconds)));

  function escapeCss(value) {
    return globalThis.CSS?.escape ? CSS.escape(String(value)) : String(value).replace(/(["\\#.:,[\]>+~*^$|= !])/g, "\\$1");
  }

  function elementText(element) {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) return element.value || element.placeholder || "";
    return element.innerText || element.textContent || element.getAttribute("aria-label") || "";
  }

  function findByText(text) {
    const expected = normalize(text);
    const candidates = document.querySelectorAll("button, a, input, textarea, select, label, [role='button'], [role='link'], [contenteditable='true']");
    return [...candidates].find((element) => normalize(elementText(element)) === expected)
      || [...candidates].find((element) => normalize(elementText(element)).includes(expected))
      || null;
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
    if (method === "text") return findByText(value);
    if (method === "xpath") {
      try {
        return document.evaluate(value, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      } catch (_) {
        return null;
      }
    }
    return document.querySelector(value);
  }

  async function waitForElement(selector, timeoutMs) {
    const deadline = Date.now() + Math.max(500, Number(timeoutMs || 10000));
    while (Date.now() <= deadline) {
      const element = resolveElement(selector);
      if (element) return element;
      await sleep(120);
    }
    throw new Error(`Nao encontrei o elemento: ${selector?.value || "seletor vazio"}.`);
  }

  async function waitForText(text, timeoutMs) {
    const expected = normalize(text);
    const deadline = Date.now() + Math.max(500, Number(timeoutMs || 10000));
    while (Date.now() <= deadline) {
      if (normalize(document.body?.innerText).includes(expected)) return;
      await sleep(150);
    }
    throw new Error(`Nao encontrei o texto: ${text}.`);
  }

  function highlight(element) {
    const outline = document.createElement("div");
    const rect = element.getBoundingClientRect();
    outline.style.cssText = [
      "position:fixed", "pointer-events:none", "z-index:2147483647", "border:2px solid #32e6c6",
      "border-radius:6px", "box-shadow:0 0 0 4px rgba(50,230,198,.18),0 0 18px rgba(50,230,198,.8)",
      `left:${rect.left}px`, `top:${rect.top}px`, `width:${rect.width}px`, `height:${rect.height}px`,
      "transition:opacity .2s ease"
    ].join(";");
    document.documentElement.appendChild(outline);
    setTimeout(() => outline.remove(), 700);
  }

  function setNativeValue(element, value) {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (setter) setter.call(element, value);
    else element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function pressKey(element, key) {
    if (!key) return;
    element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    element.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true }));
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
      if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element.isContentEditable)) {
        throw new Error("O seletor encontrado nao e um campo editavel.");
      }
      element.focus();
      const nextValue = type === "limpar" ? "" : value;
      if (element.isContentEditable) {
        element.textContent = nextValue;
        element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: nextValue }));
      } else {
        setNativeValue(element, action.clear_before === false ? `${element.value}${nextValue}` : nextValue);
      }
      pressKey(element, action.press_after);
      return type === "limpar" ? "Campo limpo." : "Campo preenchido.";
    }
    if (["selecionar_texto", "selecionar_valor", "selecionar_indice"].includes(type)) {
      if (!(element instanceof HTMLSelectElement)) throw new Error("O seletor encontrado nao e uma lista de selecao.");
      if (type === "selecionar_indice") element.selectedIndex = Number.parseInt(value, 10);
      else {
        const option = [...element.options].find((item) => type === "selecionar_valor"
          ? item.value === value
          : normalize(item.text) === normalize(value));
        if (!option) throw new Error(`Nao encontrei a opcao: ${value}.`);
        element.value = option.value;
      }
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return "Opcao selecionada.";
    }
    if (type === "marcar_checkbox") {
      if (element instanceof HTMLInputElement && !element.checked) element.click();
      else if (!(element instanceof HTMLInputElement)) element.click();
      return "Opcao marcada.";
    }
    element.focus?.();
    element.click();
    return "Clique executado.";
  }

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request?.type !== "flowdetect-execute-step") return;
    const step = request.step || {};
    const execute = step.type === "wait_text"
      ? waitForText(step.text, step.timeout_ms).then(() => `Texto confirmado: ${step.text}.`)
      : executeElementAction(step);
    execute
      .then((message) => sendResponse({ ok: true, message }))
      .catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));
    return true;
  });
}

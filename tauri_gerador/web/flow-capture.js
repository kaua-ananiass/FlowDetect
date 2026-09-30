/* Capture the editor's actual DOM. No replacement cards or automatic layout. */
(() => {
  "use strict";
  const embeddedFonts = new Map();
  const captureFonts = [
    { family: "Montserrat", weight: "500 900", file: "montserrat-latin.woff2" },
    { family: "Plus Jakarta Sans", weight: "400 800", file: "plus-jakarta-sans-latin.woff2" },
    { family: "Cormorant Garamond", weight: "600 700", file: "cormorant-garamond-latin.woff2" },
  ];

  function pngDimensions(width, height, preferredScale = 3) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error("Dimensões inválidas para a captura.");
    const scale = Math.min(preferredScale, 16384 / width, 16384 / height, Math.sqrt(48000000 / (width * height)));
    return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)), scale };
  }

  function mapDimensions(root) {
    // offset/scroll sizes are in map coordinates, not the current screen zoom.
    return {
      width: Math.ceil(Math.max(root.offsetWidth, root.scrollWidth, 1)),
      height: Math.ceil(Math.max(root.offsetHeight, root.scrollHeight, 1)),
    };
  }

  async function fontCss(root) {
    // The linked Google stylesheet is cross-origin. html-to-image may return
    // no @font-face rules even when the editor has actually loaded the fonts.
    // Embed matching local WOFF2 files only for families visible in the editor.
    const loaded = new Set(Array.from(document.fonts || [])
      .filter((face) => face.status === "loaded")
      .map((face) => face.family.replace(/^['"]|['"]$/g, "")));
    const active = captureFonts.filter((font) => loaded.has(font.family));
    const key = active.map((font) => font.file).join("|");
    if (!embeddedFonts.has(key)) {
      embeddedFonts.set(key, (async () => {
        const original = await globalThis.htmlToImage.getFontEmbedCSS(root, { preferredFontFormat: "woff2" }).catch(() => "");
        const local = await Promise.all(active.map(async (font) => {
          try {
            const response = await fetch(new URL(`./vendor/fonts/${font.file}`, document.baseURI));
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const blob = await response.blob();
            const dataUrl = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(blob);
            });
            return `@font-face{font-family:'${font.family}';font-style:normal;font-weight:${font.weight};src:url('${dataUrl}') format('woff2')}`;
          } catch { return ""; }
        }));
        return [original, ...local].filter(Boolean).join("\n");
      })());
    }
    return embeddedFonts.get(key);
  }

  function freezeDom(root, dimensions) {
    const clone = root.cloneNode(true);
    const originals = [root, ...root.querySelectorAll("*")];
    const copies = [clone, ...clone.querySelectorAll("*")];
    const styles = [];
    const delayFields = [];
    // Freeze synchronously before any await: a live map can refresh while the
    // asynchronous DOM serializer is working. Detached live nodes lose their
    // computed CSS; this isolated snapshot cannot be replaced by the editor.
    originals.forEach((original, index) => {
      const copy = copies[index];
      if (copy.style) {
        const computed = getComputedStyle(original);
        copy.style.cssText = Array.from(computed).map((name) => `${name}:${computed.getPropertyValue(name)};`).join("");
        copy.setAttribute("data-flow-capture-style-index", index);
        styles[index] = copy.style.cssText;
      }
      if (original instanceof HTMLInputElement) {
        copy.value = original.value; copy.setAttribute("value", original.value); copy.checked = original.checked;
        if (original.checked) copy.setAttribute("checked", ""); else copy.removeAttribute("checked");
        if (original.matches(".command-map-tree-edge-label input[type='number'], .command-map-tree-terminal-node input[type='number']")) {
          delayFields.push({ original, copy, index });
        }
      }
      if (original instanceof HTMLTextAreaElement) { copy.value = original.value; copy.textContent = original.value; }
      if (original instanceof HTMLSelectElement) copy.value = original.value;
    });
    // Native number inputs break their digits across lines inside Chromium's
    // SVG foreignObject. The exported map is read-only, so use a same-sized
    // text element with the original value instead of a native form control.
    delayFields.forEach(({ original, copy, index }) => {
      const label = document.createElement("span");
      Array.from(copy.attributes).forEach((attr) => {
        if (!["type", "value", "min", "max", "step", "checked"].includes(attr.name)) label.setAttribute(attr.name, attr.value);
      });
      const number = Number(original.value);
      label.textContent = Number.isFinite(number)
        ? new Intl.NumberFormat(document.documentElement.lang || "pt-BR", { maximumFractionDigits: 5 }).format(number)
        : original.value;
      Object.assign(label.style, { display: "inline-flex", alignItems: "center", justifyContent: "center", whiteSpace: "nowrap", boxSizing: "border-box" });
      styles[index] = label.style.cssText;
      copy.replaceWith(label);
    });
    Object.assign(clone.style, { zoom: "1", transform: "none", margin: "0", position: "relative", left: "0", top: "0", minWidth: "0", maxWidth: "none", minHeight: "0", maxHeight: "none", overflow: "visible", backgroundColor: "#0b0d16", boxSizing: "border-box", width: `${dimensions.width}px`, height: `${dimensions.height}px` });
    styles[0] = clone.style.cssText;
    const host = document.createElement("div");
    host.setAttribute("data-flow-capture-snapshot", "");
    host.style.cssText = "position:fixed;left:-100000px;top:0;width:max-content;pointer-events:none";
    host.append(clone); document.body.append(host);
    return { root: clone, styles, release: () => host.remove() };
  }

  function freezeSvg(dataUrl, styles) {
    const svg = decodeURIComponent(dataUrl.slice(dataUrl.indexOf(",") + 1));
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    if (doc.querySelector("parsererror")) throw new Error("Não foi possível preparar a imagem original do mapa.");
    doc.querySelectorAll("[data-flow-capture-style-index]").forEach((node) => {
      // Retain exact font sizes and SVG stroke styles, rather than the
      // serializer's font-size rounding or default unstyled SVG descendants.
      node.setAttribute("style", styles[Number(node.getAttribute("data-flow-capture-style-index"))] || "");
      node.removeAttribute("data-flow-capture-style-index");
    });
    const style = doc.createElementNS("http://www.w3.org/2000/svg", "style");
    const scrollbars = [];
    for (const sheet of document.styleSheets) {
      try { for (const rule of sheet.cssRules) if (rule.selectorText?.includes("::-webkit-scrollbar")) scrollbars.push(rule.cssText); } catch { /* External font sheets can be cross-origin. */ }
    }
    style.textContent = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}" + scrollbars.join("\n");
    doc.documentElement.prepend(style);
    return new XMLSerializer().serializeToString(doc.documentElement);
  }

  async function captureDom(root, { label = "Mapa", embedFonts = true } = {}) {
    if (!root || !globalThis.htmlToImage) throw new Error("Captura indisponível. Reinicie o Studio.");
    const dimensions = mapDimensions(root);
    const snapshot = freezeDom(root, dimensions);
    try {
      root = snapshot.root;
      if (document.fonts?.ready) await document.fonts.ready;
      const images = Array.from(root.querySelectorAll("img"));
      await Promise.all(images.map((image) => typeof image.decode === "function" ? image.decode().catch(() => null) : Promise.resolve()));
      const missingImages = images.filter((image) => !image.naturalWidth).length + root.querySelectorAll("[data-recognition-preview-stage].is-error").length;
      const dataUrl = await globalThis.htmlToImage.toSvg(root, {
        ...dimensions,
        fontEmbedCSS: embedFonts ? await fontCss(root) : "", skipFonts: !embedFonts,
        // Neutralize navigation only on the CLONE. Keep the actual cards,
        // buttons, positions, OCR overlays and SVG curves from the editor.
        style: {
          zoom: "1", transform: "none", margin: "0", position: "relative", left: "0", top: "0",
          minWidth: "0", maxWidth: "none", minHeight: "0", maxHeight: "none", overflow: "visible", backgroundColor: "#0b0d16",
        },
        filter: (node) => !node.classList?.contains("insert-card-panel") && !node.classList?.contains("command-map-selection-rectangle"),
      });
      return {
        svg: freezeSvg(dataUrl, snapshot.styles), ...dimensions, label, missingImages,
        nodeCount: root.querySelectorAll(".command-tree-card").length,
        edgeCount: root.querySelectorAll(".command-map-tree-link-path, .command-jump-path, .command-inline-connector").length,
        pageCount: 1,
      };
    } finally { snapshot.release(); }
  }

  function combinePages(pages) {
    if (!pages.length) throw new Error("Nenhuma página para capturar.");
    if (pages.length === 1) return pages[0];
    const width = Math.max(...pages.map((page) => page.width));
    const height = pages.reduce((sum, page) => sum + page.height, 0) + (pages.length - 1) * 40;
    const doc = document.implementation.createDocument("http://www.w3.org/2000/svg", "svg", null);
    const root = doc.documentElement;
    root.setAttribute("width", width); root.setAttribute("height", height); root.setAttribute("viewBox", `0 0 ${width} ${height}`);
    const background = doc.createElementNS(root.namespaceURI, "rect");
    background.setAttribute("width", width); background.setAttribute("height", height); background.setAttribute("fill", "#0b0d16"); root.append(background);
    let y = 0;
    pages.forEach((page) => {
      const nested = new DOMParser().parseFromString(page.svg, "image/svg+xml").documentElement;
      nested.setAttribute("x", "0"); nested.setAttribute("y", y);
      root.append(doc.importNode(nested, true)); y += page.height + 40;
    });
    return {
      svg: new XMLSerializer().serializeToString(root), width, height,
      nodeCount: pages.reduce((sum, page) => sum + page.nodeCount, 0),
      edgeCount: pages.reduce((sum, page) => sum + page.edgeCount, 0),
      missingImages: pages.reduce((sum, page) => sum + page.missingImages, 0), pageCount: pages.length,
    };
  }

  function svgDataUrl(svg) { return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; }

  async function renderPng(diagram, preferredScale = 3) {
    const dimensions = pngDimensions(diagram.width, diagram.height, preferredScale);
    const canvas = document.createElement("canvas");
    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error("Não foi possível renderizar o mapa original."));
        // data URLs keep Chromium's foreignObject snapshots canvas-safe.
        img.src = svgDataUrl(diagram.svg);
      });
      canvas.width = dimensions.width; canvas.height = dimensions.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Memória insuficiente para a captura PNG.");
      context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high";
      context.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Não foi possível gerar o PNG deste mapa.");
      return { blob, ...dimensions };
    } finally {
      canvas.width = 1; canvas.height = 1;
    }
  }

  globalThis.FlowDetectFlowCapture = Object.freeze({ captureDom, combinePages, mapDimensions, pngDimensions, renderPng, svgDataUrl });
})();

/*
 * Execute como Snippet do DevTools em https://contador.nibo.com.br/spa/Relationship/ServiceDeskRequest.
 * Nenhum dado e enviado a terceiros. A pagina continua usando a sessao normal do Nibo.
 */
(() => {
  "use strict";

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    const source = String(text || "").replace(/^\uFEFF/, "");
    const firstLine = source.split(/\r?\n/, 1)[0];
    const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      if (char === '"') {
        if (quoted && source[index + 1] === '"') { cell += '"'; index += 1; }
        else quoted = !quoted;
      } else if (char === delimiter && !quoted) {
        row.push(cell); cell = "";
      } else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && source[index + 1] === "\n") index += 1;
        row.push(cell); cell = "";
        if (row.some((value) => value.trim())) rows.push(row);
        row = [];
      } else cell += char;
    }
    if (quoted) throw new Error("O CSV terminou com aspas sem fechamento.");
    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);
    if (!rows.length) throw new Error("CSV vazio.");
    const headers = rows.shift().map((value) => value.trim());
    const idColumn = headers.findIndex((value) => value.toLowerCase() === "id");
    if (idColumn < 0) throw new Error("O CSV precisa ter a coluna ID.");
    const seen = new Set();
    return rows.map((values) => {
      const record = Object.fromEntries(headers.map((header, index) => [header, (values[index] || "").trim()]));
      return { id: String(values[idColumn] || "").trim(), record };
    }).filter((item) => {
      if (!/^\d{6}-\d{3}$/.test(item.id)) return false;
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function isOpeningEvent(message) {
    return message?.direction === "event"
      && /^Atendimento criado\b/i.test(String(message.content || "").trim());
  }

  function chooseEntries(entries, limit, onlyIds) {
    const ids = [...new Set(String(onlyIds || "").trim().split(/[\s,;]+/).filter(Boolean))];
    if (!ids.length) return entries.slice(0, Math.max(1, Math.min(entries.length, Number(limit) || 1)));
    const byId = new Map(entries.map((entry) => [entry.id, entry]));
    const missing = ids.filter((id) => !byId.has(id));
    if (missing.length) throw new Error(`ID(s) fora do CSV: ${missing.join(", ")}.`);
    return ids.map((id) => byId.get(id));
  }

  function dateFromBrazilianText(value) {
    const match = String(value || "").match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
    if (!match) return null;
    const [, day, month, year] = match;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1
      || date.getUTCDate() !== Number(day)) return null;
    return `${year}-${month}-${day}`;
  }

  function exportMetadata(record, messages) {
    const opening = messages.find(isOpeningEvent);
    const openingDate = dateFromBrazilianText(opening?.content) || dateFromBrazilianText(opening?.footer);
    const updatedDate = dateFromBrazilianText(record?.["Atualizado em"]);
    return {
      clienteEmpresa: String(record?.Cliente || "Não identificado").trim(),
      responsavel: String(record?.["Responsável"] || "Não informado").trim(),
      data: openingDate || updatedDate,
      origemData: openingDate ? "abertura" : updatedDate ? "última atualização do CSV" : "não disponível"
    };
  }

  function safeFilenamePart(value, maxLength = 48) {
    return String(value || "Nao_identificado").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, maxLength) || "Nao_identificado";
  }

  function exportBasename(id, metadata) {
    return `${metadata.data || "sem_data"}__${safeFilenamePart(metadata.clienteEmpresa)}__${safeFilenamePart(metadata.responsavel, 32)}__${id}`;
  }

  async function sessionFolderName(csvText, count) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(csvText));
    const key = [...new Uint8Array(digest)].slice(0, 8).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return `Nibo_Conversas_${count}_${key}`;
  }

  function makeControl(entries, sourceCsvName, folderName, previous = null) {
    const ids = entries.map((entry) => entry.id);
    if (previous) {
      if (previous.version !== 1 || previous.folderName !== folderName
        || !previous.items || JSON.stringify(previous.ids) !== JSON.stringify(ids)) {
        throw new Error("O controle existente não corresponde a este CSV. Escolha outra pasta de destino.");
      }
      return previous;
    }
    return {
      version: 1, folderName, sourceCsvName, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ids,
      items: Object.fromEntries(ids.map((id) => [id, { status: "PENDENTE", attempts: 0 }]))
    };
  }

  function controlCounts(control) {
    const counts = { OK: 0, INCOMPLETO: 0, ERRO: 0, PENDENTE: 0, EM_ANDAMENTO: 0 };
    for (const id of control.ids) {
      const status = control.items[id]?.status || "PENDENTE";
      counts[status in counts ? status : "ERRO"] += 1;
    }
    return counts;
  }

  function renderControlCsv(entries, control) {
    const cells = (values) => values.map((value) => {
      const raw = String(value ?? "");
      const safe = /^\s*[=+\-@]/.test(raw) ? `'${raw}` : raw;
      return `"${safe.replace(/"/g, '""')}"`;
    }).join(";");
    const header = ["ID", "Status", "Tentativas", "Histórico completo", "Mídias completas", "Mídias pendentes", "Mensagens",
      "Cliente/empresa", "Responsável", "Data", "Origem da data", "Arquivo HTML", "Arquivo JSON", "Erro", "Atualizado em"];
    const lines = entries.map(({ id, record }) => {
      const item = control.items[id] || {};
      return cells([id, item.status || "PENDENTE", item.attempts || 0,
        item.historyComplete === undefined ? "" : item.historyComplete ? "SIM" : "NÃO",
        item.mediaComplete === undefined ? "" : item.mediaComplete ? "SIM" : "NÃO", item.mediaErrorCount ?? "",
        item.messages ?? "", item.metadata?.clienteEmpresa || record.Cliente || "",
        item.metadata?.responsavel || record["Responsável"] || "", item.metadata?.data || "",
        item.metadata?.origemData || "", item.files?.html || "", item.files?.json || "",
        item.error || "", item.updatedAt || ""]);
    });
    return `\uFEFF${cells(header)}\r\n${lines.join("\r\n")}\r\n`;
  }

  function controlFromCsv(entries, csvText, sourceCsvName, folderName) {
    const rows = parseCsv(csvText);
    if (JSON.stringify(rows.map((row) => row.id)) !== JSON.stringify(entries.map((entry) => entry.id))) {
      throw new Error("Os IDs de controle.csv não correspondem ao CSV selecionado.");
    }
    const control = makeControl(entries, sourceCsvName, folderName);
    const statuses = new Set(["PENDENTE", "EM_ANDAMENTO", "OK", "INCOMPLETO", "ERRO"]);
    for (const { id, record } of rows) {
      const status = record.Status || "PENDENTE";
      if (!statuses.has(status)) throw new Error(`Status inválido em controle.csv para ${id}.`);
      const flag = (value) => value === "SIM" ? true : value === "NÃO" ? false : undefined;
      const number = (value) => value === "" ? undefined : Number(value);
      const historyComplete = flag(record["Histórico completo"]);
      const mediaComplete = flag(record["Mídias completas"]);
      const metadata = { clienteEmpresa: record["Cliente/empresa"] || "",
        responsavel: record["Responsável"] || "", data: record.Data || "",
        origemData: record["Origem da data"] || "" };
      const files = { html: record["Arquivo HTML"] || "", json: record["Arquivo JSON"] || "" };
      control.items[id] = { status, attempts: number(record.Tentativas) || 0,
        ...(historyComplete === undefined ? {} : { historyComplete }),
        ...(mediaComplete === undefined ? {} : { mediaComplete }),
        ...(historyComplete === undefined || mediaComplete === undefined ? {} : { complete: historyComplete && mediaComplete }),
        ...(number(record["Mídias pendentes"]) === undefined ? {} : { mediaErrorCount: number(record["Mídias pendentes"]) }),
        ...(number(record.Mensagens) === undefined ? {} : { messages: number(record.Mensagens) }),
        ...(Object.values(metadata).some(Boolean) ? { metadata } : {}),
        ...(files.html || files.json ? { files } : {}),
        error: record.Erro || "", updatedAt: record["Atualizado em"] || "" };
    }
    const latest = rows.map(({ record }) => record["Atualizado em"] || "").filter(Boolean).sort().at(-1);
    if (latest) control.updatedAt = latest;
    return control;
  }

  function renderHtml(data) {
    const cards = data.messages.map((message, index) => {
      const klass = message.direction === "outgoing" ? "outgoing" : message.direction === "incoming" ? "incoming" : "event";
      const media = (message.media || []).map((item) => {
        if (!item.file) return `<small>Mídia não baixada: ${escapeHtml(item.label || item.kind)}</small>`;
        if (item.kind === "audio") return `<audio controls src="${escapeHtml(item.file)}"></audio>`;
        if (item.kind === "image") return `<img src="${escapeHtml(item.file)}" alt="Imagem da conversa">`;
        return `<a href="${escapeHtml(item.file)}">${escapeHtml(item.file)}</a>`;
      }).join("");
      return `<article class="${klass}"><div class="meta">#${index + 1} · ${escapeHtml(message.header)}</div>`
        + `<div class="body">${escapeHtml(message.content)}</div>${media}`
        + `<div class="foot">${escapeHtml(message.footer)}</div></article>`;
    }).join("\n");
    return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`
      + `<title>Atendimento ${escapeHtml(data.id)}</title><style>`
      + `body{font:14px system-ui;background:#f4f6f8;color:#18222e;max-width:900px;margin:24px auto;padding:0 16px}`
      + `header{margin-bottom:24px}h1{font-size:22px}article{max-width:75%;padding:12px 14px;margin:10px 0;border-radius:12px;background:white;box-shadow:0 1px 4px #0001}`
      + `article.outgoing{margin-left:auto;background:#ddf4e5}article.event{max-width:100%;margin:16px auto;text-align:center;background:#e7ebf1}`
      + `.meta,.foot{font-size:11px;color:#65727d}.body{white-space:pre-wrap;overflow-wrap:anywhere;margin:7px 0}audio,img{display:block;max-width:100%;margin:8px 0}`
      + `</style><header><h1>Atendimento ${escapeHtml(data.id)}</h1><p>${escapeHtml(data.messages.length)} registros · Exportado em ${escapeHtml(data.exportedAt)}</p>`
      + `<p>Cliente/empresa: ${escapeHtml(data.metadata?.clienteEmpresa || data.record?.Cliente || "Não identificado")} · `
      + `Responsável: ${escapeHtml(data.metadata?.responsavel || data.record?.["Responsável"] || "Não informado")} · `
      + `Data (${escapeHtml(data.metadata?.origemData || "não disponível")}): ${escapeHtml(data.metadata?.data || "não disponível")}</p>`
      + `<p>Histórico: ${(data.historyComplete ?? data.complete) ? "desde a abertura do atendimento" : "INCOMPLETO — não foi possível confirmar a abertura do atendimento"}. `
      + `Mídias: ${(data.mediaComplete ?? data.complete) ? "baixadas" : "algumas não foram baixadas; confira os cartões"}.</p></header>${cards}</html>`;
  }

  if (typeof window === "undefined") {
    if (typeof module !== "undefined") module.exports = { parseCsv, escapeHtml, isOpeningEvent,
      chooseEntries, dateFromBrazilianText, exportMetadata, exportBasename,
      sessionFolderName, makeControl, controlCounts, renderControlCsv, controlFromCsv, renderHtml };
    return;
  }
  if (location.hostname !== "contador.nibo.com.br") {
    throw new Error("Abra a página de Atendimento do Nibo Contador antes de executar este Snippet.");
  }
  if (document.querySelector("#flowdetect-nibo-exporter")) return;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const visible = (element) => Boolean(element && element.getClientRects().length && getComputedStyle(element).visibility !== "hidden");
  const textOf = (element) => String(element?.innerText || element?.textContent || "").trim();
  const automation = window.__FLOWDETECT_NIBO_AUTO__ || null;
  const state = { entries: [], csvText: "", csvName: "", directory: null, running: false, stopped: false };
  const panel = document.createElement("aside");
  panel.id = "flowdetect-nibo-exporter";
  panel.style.cssText = "position:fixed;right:18px;top:18px;z-index:2147483647;width:310px;padding:14px;border-radius:12px;background:#10202d;color:#e8f8fb;box-shadow:0 8px 32px #0006;font:12px system-ui";
  panel.innerHTML = `<strong style="font-size:14px">Exportar conversas Nibo</strong><p>Usa a sessão aberta nesta página. Mesmo CSV + mesma pasta retomam pelos IDs pendentes; acompanhe controle.csv.</p>`
    + `<input type="file" accept=".csv,text/csv" hidden><div style="display:grid;gap:7px">`
    + `<button type="button" data-action="csv">1. Selecionar CSV</button><button type="button" data-action="folder">2. Escolher pasta</button>`
    + `<label>Máximo nesta execução (teste com 1 primeiro)<input data-limit type="number" min="1" value="1" style="width:100%;box-sizing:border-box;padding:6px"></label>`
    + `<label>Somente estes IDs (opcional, separados por vírgula)<input data-only-ids type="text" placeholder="260526-007" style="width:100%;box-sizing:border-box;padding:6px"></label>`
    + `<button type="button" data-action="start" disabled>3. Iniciar exportação</button><button type="button" data-action="stop" disabled>Parar após este ID</button>`
    + `<button type="button" data-action="close">Fechar painel</button></div><p data-status role="status">Aguardando CSV e pasta.</p>`
    + `<section data-progress hidden style="border-top:1px solid #4b8999;padding-top:9px">`
    + `<div data-counts style="font-weight:600;line-height:1.6"></div>`
    + `<div style="height:7px;background:#29434d;border-radius:9px;overflow:hidden"><div data-progress-bar style="height:100%;width:0;background:#35c985"></div></div>`
    + `<details open style="margin-top:9px"><summary>Últimos atendimentos</summary>`
    + `<div data-recent style="max-height:200px;overflow:auto;margin-top:6px"></div></details></section>`;
  for (const button of panel.querySelectorAll("button")) {
    button.style.cssText = "padding:7px 9px;border:1px solid #4b8999;border-radius:7px;background:#173e4a;color:#e8f8fb;cursor:pointer;text-align:left";
  }
  document.body.append(panel);
  const input = panel.querySelector('input[type="file"]');
  const status = panel.querySelector("[data-status]");
  const button = (action) => panel.querySelector(`[data-action="${action}"]`);
  const update = (message) => {
    status.textContent = message;
    console.info("[Nibo exportador]", message);
    if (automation?.onStatus) automation.onStatus(message);
  };
  const ready = () => { button("start").disabled = !state.entries.length || !state.directory || state.running; };
  const renderProgress = (control) => {
    const counts = controlCounts(control);
    const total = control.ids.length;
    const finished = counts.OK + counts.INCOMPLETO + counts.ERRO;
    panel.querySelector("[data-progress]").hidden = false;
    panel.querySelector("[data-counts]").textContent = `${finished}/${total} processados · ${counts.OK} OK · ${counts.INCOMPLETO} incompletos · ${counts.ERRO} erros`;
    panel.querySelector("[data-progress-bar]").style.width = `${total ? finished / total * 100 : 0}%`;
    const recent = control.ids.map((id) => ({ id, ...control.items[id] }))
      .filter((item) => item.status && item.status !== "PENDENTE")
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))).slice(0, 20);
    panel.querySelector("[data-recent]").innerHTML = recent.length ? recent.map((item) => {
      const color = item.status === "OK" ? "#66dfa8" : item.status === "ERRO" ? "#ff9494"
        : item.status === "INCOMPLETO" ? "#ffd17d" : "#9cd5e9";
      return `<div style="display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid #29434d;padding:4px 0">`
        + `<span>${escapeHtml(item.id)}</span><strong style="color:${color}">${escapeHtml(item.status)}</strong></div>`;
    }).join("") : "Nenhum atendimento processado ainda.";
  };

  button("csv").addEventListener("click", () => input.click());
  input.addEventListener("change", async () => {
    try {
      if (!input.files?.[0]) return;
      const csvText = await input.files[0].text();
      state.entries = parseCsv(csvText);
      state.csvText = csvText;
      state.csvName = input.files[0].name;
      panel.querySelector("[data-limit]").max = String(state.entries.length);
      update(`${state.entries.length} IDs válidos encontrados no CSV.`);
      ready();
    } catch (error) { update(`CSV: ${error.message}`); }
  });
  button("folder").addEventListener("click", async () => {
    try {
      if (!window.showDirectoryPicker) throw new Error("Este Chrome não permite escolher pasta pela página.");
      state.directory = await window.showDirectoryPicker({ mode: "readwrite" });
      update(`Pasta escolhida: ${state.directory.name}.`);
      ready();
    } catch (error) { if (error.name !== "AbortError") update(`Pasta: ${error.message}`); }
  });
  button("stop").addEventListener("click", () => { state.stopped = true; update("Parando após o ID atual..."); });
  button("close").addEventListener("click", () => { if (!state.running) panel.remove(); });

  async function waitFor(check, timeout = 15000, stage = "a interface") {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const result = check();
      if (result) return result;
      await sleep(150);
    }
    throw new Error(`Tempo esgotado ao aguardar ${stage} (${Math.round(timeout / 1000)} s).`);
  }

  function modalForId(id) {
    // O Nibo renderiza o detalhe no shadowRoot de <accountant-app>, fora de document.querySelectorAll().
    const roots = [document];
    for (let index = 0; index < roots.length; index += 1) {
      for (const host of roots[index].querySelectorAll("*")) {
        if (host.shadowRoot && !roots.includes(host.shadowRoot)) roots.push(host.shadowRoot);
      }
    }
    for (const root of roots) {
      for (const chat of root.querySelectorAll("service-desk-chat")) {
        if (!visible(chat)) continue;
        let current = chat;
        while (current && current !== document.body) {
          const text = textOf(current);
          if (text.includes("Detalhes do atendimento") && new RegExp(`\\bID\\s*${id}\\b`).test(text)) {
            return { chat, modal: current };
          }
          current = current.parentElement;
        }
      }
    }
    return null;
  }

  function rowForId(id) {
    return [...document.querySelectorAll("tr,[role=row]")].find((row) => (
      visible(row) && [...row.querySelectorAll("td,[role=cell],a,button")].some((cell) => textOf(cell) === id)
    ));
  }

  async function openId(id) {
    const readyConversation = () => {
      const opened = modalForId(id);
      return opened && scrollArea(opened.chat) ? opened : null;
    };
    const alreadyOpen = modalForId(id);
    if (alreadyOpen) return waitFor(readyConversation, 20000, `o histórico do ID ${id} carregar no painel de conversa`);
    const search = await waitFor(() => [...document.querySelectorAll("input")].find((element) => (
      visible(element) && /ID,? assunto,? contato ou WhatsApp/i.test(element.placeholder || "")
    )), 15000, "o campo de busca de Atendimento. Abra a lista de Atendimento no Nibo");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(search, id);
    search.dispatchEvent(new Event("input", { bubbles: true }));
    search.dispatchEvent(new Event("change", { bubbles: true }));
    // O ng-model do campo usa debounce de 500 ms; antes disso o botão pode filtrar pelo ID anterior.
    await sleep(750);
    const filter = [...document.querySelectorAll("button")].find((element) => visible(element) && /^Filtrar$/i.test(textOf(element)));
    if (filter) filter.click();
    let row;
    try {
      row = await waitFor(() => rowForId(id), 10000, `a linha do ID ${id} na lista de Atendimento`);
    } catch {
      // Uma resposta atrasada da busca anterior pode substituir a lista atual.
      if (filter) filter.click();
      row = await waitFor(() => rowForId(id), 15000,
        `a linha do ID ${id} na lista de Atendimento. Confira se ele aparece na busca manual`);
    }
    const target = [...row.querySelectorAll("a,button,td,[role=cell]")].find((element) => textOf(element) === id) || row;
    target.click();
    return waitFor(readyConversation, 20000, `o histórico do ID ${id} carregar no painel de conversa`);
  }

  function closeModal(modal) {
    const explicit = [...modal.querySelectorAll("button")].find((element) => (
      visible(element) && (/fechar|close/i.test(`${element.getAttribute("aria-label") || ""} ${element.getAttribute("title") || ""} ${textOf(element)}`) || element.matches(".btn-close,.close"))
    ));
    const rect = modal.getBoundingClientRect();
    const corner = [...modal.querySelectorAll("button")].find((element) => {
      if (!visible(element)) return false;
      const box = element.getBoundingClientRect();
      return box.top < rect.top + 100 && box.right > rect.right - 100;
    });
    const target = explicit || corner;
    if (!target) throw new Error("Não encontrei o botão de fechar o atendimento.");
    target.click();
  }

  function readMessage(element) {
    const balloon = element.querySelector("chat-balloon");
    const direction = !balloon ? "event" : balloon.classList.contains("chat-balloon-end") ? "outgoing" : "incoming";
    const content = balloon?.querySelector(".chat-balloon-content");
    const media = [...(content?.querySelectorAll("audio[src],img[src],video[src],a[href]") || [])].map((node) => ({
      kind: node.tagName.toLowerCase() === "a" ? "file" : node.tagName.toLowerCase() === "img" ? "image" : node.tagName.toLowerCase(),
      src: node.currentSrc || node.getAttribute("src") || node.getAttribute("href") || ""
    })).filter((item) => item.src && item.src !== "#" && !item.src.startsWith("javascript:"));
    for (const control of content?.querySelectorAll('button[aria-label="Baixar arquivo"]') || []) {
      media.push({ kind: "file", label: textOf(control.closest("chat-file-preview")) || "anexo", src: "" });
    }
    return {
      direction,
      header: textOf(balloon?.querySelector(".chat-balloon-header")),
      content: textOf(content || element),
      footer: textOf(balloon?.querySelector(".chat-balloon-footer")),
      media
    };
  }

  function scrollArea(chat) {
    const message = chat.querySelector("service-desk-chat-log-message,service-desk-chat-log-status,service-desk-chat-log-whatsapp-status,service-desk-chat-log-create");
    for (let current = message?.parentElement; current && current !== document.body; current = current.parentElement) {
      const overflow = getComputedStyle(current).overflowY;
      // Conversas curtas têm o painel, mas não têm barra de rolagem.
      if (/(auto|scroll)/.test(overflow) && current.clientHeight > 100) return current;
    }
    return null;
  }

  async function collectConversation(chat, directory, id, attempt) {
    const area = scrollArea(chat);
    if (!area) throw new Error("O histórico da conversa ainda não carregou.");
    const originalTop = area.scrollTop;
    const reversed = getComputedStyle(area).flexDirection === "column-reverse";
    const messages = [];
    const seen = new Set();
    const selector = "service-desk-chat-log-message,service-desk-chat-log-status,service-desk-chat-log-whatsapp-status,service-desk-chat-log-create";
    let openingFound = false;
    let lastProgress = Date.now();
    let previousTop = null;
    let previousHeight = null;
    const deadline = Date.now() + 30 * 60 * 1000;
    const mediaErrors = [];
    try {
      for (let round = 0; Date.now() < deadline; round += 1) {
        const occurrences = new Map();
        const fresh = [];
        for (const node of chat.querySelectorAll(selector)) {
          if (!visible(node)) continue;
          const item = readMessage(node);
          if (isOpeningEvent(item)) openingFound = true;
          const signature = JSON.stringify(item);
          const count = (occurrences.get(signature) || 0) + 1;
          occurrences.set(signature, count);
          const key = `${signature}:${count}`;
          if (!seen.has(key)) { seen.add(key); fresh.push(item); }
        }
        if (fresh.length) {
          mediaErrors.push(...await saveMedia(directory, `${id}_tentativa_${attempt}`, fresh, `parte_${round + 1}`));
          // O chat do Nibo lista os registros mais recentes primeiro no DOM.
          messages.push(...fresh);
        }
        const height = area.scrollHeight;
        if (fresh.length || area.scrollTop !== previousTop || height !== previousHeight) lastProgress = Date.now();
        if (openingFound) break;
        if (Date.now() - lastProgress > 30000) break;
        if (round && round % 15 === 0) update(`${id}: ${messages.length} registros; buscando o início da conversa...`);
        const atOldest = reversed ? area.scrollTop <= area.clientHeight - height + 2 : area.scrollTop <= 1;
        previousTop = area.scrollTop;
        previousHeight = height;
        area.scrollTop -= Math.max(180, area.clientHeight * 0.8);
        await sleep(atOldest ? 1000 : 650);
      }
    } finally { area.scrollTop = originalTop; }
    if (!messages.length) throw new Error("Nenhuma mensagem encontrada no atendimento.");
    return { messages: messages.reverse(), historyComplete: openingFound, limitReached: !openingFound, mediaErrors };
  }

  function extensionFromMime(mime, kind) {
    if (/mpeg|mp3/.test(mime)) return "mp3";
    if (/ogg/.test(mime)) return "ogg";
    if (/webm/.test(mime)) return "webm";
    if (/wav/.test(mime)) return "wav";
    if (/png/.test(mime)) return "png";
    if (/jpeg/.test(mime)) return "jpg";
    if (/pdf/.test(mime)) return "pdf";
    return kind === "audio" ? "audio" : "bin";
  }

  async function writeFile(directory, filename, data) {
    const file = await directory.getFileHandle(filename, { create: true });
    const writer = await file.createWritable();
    try { await writer.write(data); } finally { await writer.close(); }
  }

  async function readControl(directory, entries, sourceCsvName, folderName) {
    const candidates = [];
    const failures = [];
    let found = false;
    for (const filename of ["controle.json", "controle.reserva.json", "controle.csv"]) {
      let file;
      try { file = await (await directory.getFileHandle(filename)).getFile(); }
      catch (error) { if (error.name === "NotFoundError") continue; throw error; }
      found = true;
      try {
        const content = await file.text();
        const parsed = filename.endsWith(".csv") ? null : JSON.parse(content);
        if (parsed === null && !filename.endsWith(".csv")) throw new Error("JSON sem objeto de controle.");
        const control = filename.endsWith(".csv")
          ? controlFromCsv(entries, content, sourceCsvName, folderName)
          : makeControl(entries, sourceCsvName, folderName, parsed);
        candidates.push({ control, source: filename, modified: file.lastModified });
      } catch (error) { failures.push(`${filename}: ${error.message}`); }
    }
    if (!candidates.length) {
      if (!found) return { control: null, source: null };
      throw new Error(`Nenhum controle válido encontrado. ${failures.join(" | ")}`);
    }
    candidates.sort((a, b) => (Date.parse(b.control.updatedAt) || b.modified)
      - (Date.parse(a.control.updatedAt) || a.modified)
      || ["controle.json", "controle.reserva.json", "controle.csv"].indexOf(a.source)
      - ["controle.json", "controle.reserva.json", "controle.csv"].indexOf(b.source));
    return candidates[0];
  }

  async function savedFilesExist(directory, files) {
    if (!files?.json || !files?.html) return false;
    try {
      for (const filename of [files.json, files.html]) {
        if (!(await (await directory.getFileHandle(filename)).getFile()).size) return false;
      }
      return true;
    } catch (error) { if (error.name === "NotFoundError") return false; throw error; }
  }

  async function writeControl(directory, entries, control, includeCsv = true, source = "controle.json") {
    control.updatedAt = new Date().toISOString();
    const payload = JSON.stringify(control, null, 2);
    const order = source === "controle.json"
      ? ["controle.reserva.json", "controle.json"] : ["controle.json", "controle.reserva.json"];
    for (const filename of order) {
      await writeFile(directory, filename, payload);
      const saved = await (await (await directory.getFileHandle(filename)).getFile()).text();
      if (saved !== payload) throw new Error(`${filename} não foi gravado corretamente; controle anterior preservado.`);
    }
    if (includeCsv) await writeFile(directory, "controle.csv", renderControlCsv(entries, control));
  }

  async function saveMedia(directory, id, messages, part) {
    const errors = [];
    let mediaDirectory = null;
    for (let index = 0; index < messages.length; index += 1) {
      for (let mediaIndex = 0; mediaIndex < messages[index].media.length; mediaIndex += 1) {
        const item = messages[index].media[mediaIndex];
        try {
          if (!item.src) throw new Error(`${item.label || "Anexo"}: o Nibo nÃ£o expÃµe URL para baixar automaticamente.`);
          const url = new URL(item.src, location.href);
          if (url.protocol !== "blob:" && url.protocol !== "data:" && url.origin !== location.origin) {
            throw new Error("Mídia externa: download automático não permitido.");
          }
          const response = await fetch(url.href, { credentials: "same-origin" });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const blob = await response.blob();
          if (!mediaDirectory) mediaDirectory = await directory.getDirectoryHandle("midias", { create: true });
          const filename = `${id}_${part}_${String(index + 1).padStart(3, "0")}_${mediaIndex + 1}.${extensionFromMime(blob.type, item.kind)}`;
          await writeFile(mediaDirectory, filename, blob);
          item.file = `midias/${filename}`;
        } catch (error) {
          errors.push(`Registro ${index + 1}, ${item.kind}: ${error.message}`);
        }
        delete item.src;
      }
    }
    return errors;
  }

  button("start").addEventListener("click", async () => {
    if (state.running || !state.entries.length || !state.directory) return;
    let entries;
    try { entries = chooseEntries(state.entries, panel.querySelector("[data-limit]").value, panel.querySelector("[data-only-ids]").value); }
    catch (error) { update(error.message); return; }
    state.running = true;
    state.stopped = false;
    ready();
    button("stop").disabled = false;
    try {
      const batch = await sessionFolderName(state.csvText, state.entries.length);
      const directory = await state.directory.getDirectoryHandle(batch, { create: true });
      const checkpoint = await readControl(directory, state.entries, state.csvName, batch);
      const control = makeControl(state.entries, state.csvName, batch, checkpoint.control);
      if (checkpoint.source && checkpoint.source !== "controle.json") {
        update(`Controle retomado de ${checkpoint.source}; reparando a cópia principal...`);
      }
      await writeControl(directory, state.entries, control, true, checkpoint.source);
      renderProgress(control);
      let skipped = 0;
      for (let index = 0; index < entries.length; index += 1) {
        if (state.stopped) break;
        const { id, record } = entries[index];
        const previous = control.items[id] || { status: "PENDENTE", attempts: 0 };
        if (previous.status === "OK" && await savedFilesExist(directory, previous.files)) {
          skipped += 1;
          update(`${index + 1}/${entries.length}: ${id} já está OK; pulando.`);
          continue;
        }
        const attempt = (previous.attempts || 0) + 1;
        control.items[id] = { ...previous, status: "EM_ANDAMENTO", attempts: attempt, updatedAt: new Date().toISOString() };
        await writeControl(directory, state.entries, control, false);
        renderProgress(control);
        update(`${index + 1}/${entries.length}: abrindo ${id} (tentativa ${attempt})...`);
        let opened;
        let outcome;
        try {
          opened = await openId(id);
          const { messages, historyComplete, limitReached, mediaErrors } = await collectConversation(opened.chat, directory, id, attempt);
          const metadata = exportMetadata(record, messages);
          const basename = `${exportBasename(id, metadata)}__tentativa_${attempt}`;
          const filenames = { json: `${basename}.json`, html: `${basename}.html` };
          const data = {
            id, record, sourceUrl: location.href, exportedAt: new Date().toISOString(),
            metadata,
            messages, historyComplete, mediaComplete: !mediaErrors.length,
            complete: historyComplete && !mediaErrors.length, limitReached, mediaErrors
          };
          await writeFile(directory, filenames.json, JSON.stringify(data, null, 2));
          await writeFile(directory, filenames.html, renderHtml(data));
          outcome = { status: historyComplete ? "OK" : "INCOMPLETO", messages: messages.length,
            metadata, files: filenames, historyComplete, mediaComplete: data.mediaComplete,
            complete: data.complete, mediaErrorCount: mediaErrors.length,
            error: historyComplete ? "" : "Histórico incompleto: o evento Atendimento criado não foi encontrado." };
        } catch (error) {
          outcome = { status: "ERRO", error: String(error.message || error) };
        } finally {
          const toClose = opened || modalForId(id);
          if (toClose) {
            try {
              closeModal(toClose.modal);
              await waitFor(() => !modalForId(id), 8000, `o fechamento do atendimento ${id}`);
            }
            catch (error) {
              outcome.closeError = String(error.message || error);
              state.stopped = true;
            }
          }
        }
        control.items[id] = { ...previous, ...outcome, attempts: attempt, updatedAt: new Date().toISOString() };
        await writeControl(directory, state.entries, control);
        renderProgress(control);
        const counts = controlCounts(control);
        update(`${id}: ${outcome.status}. Controle salvo — ${counts.OK} OK, ${counts.INCOMPLETO} incompletos, ${counts.ERRO} erros, ${counts.PENDENTE} pendentes.${outcome.closeError ? ` Parei: ${outcome.closeError}` : ""}`);
      }
      const counts = controlCounts(control);
      const results = control.ids.filter((id) => control.items[id]?.status !== "PENDENTE").map((id) => {
        const item = control.items[id];
        return { id, ok: item.status === "OK", ...item,
          complete: item.complete ?? (item.historyComplete === true && item.mediaComplete === true) };
      });
      await writeFile(directory, "resultado.json", JSON.stringify({ exportedAt: new Date().toISOString(), results }, null, 2));
      update(`Sessão ${batch}: ${counts.OK} OK, ${counts.INCOMPLETO} incompletos, ${counts.ERRO} erros, ${counts.PENDENTE} pendentes; ${skipped} OK pulados. Confira controle.csv.`);
      if (automation) automation.onFinished({ ok: true, batch, counts,
        pendingMedia: control.ids.filter((id) => control.items[id]?.mediaComplete === false).length });
    } catch (error) {
      update(`Exportação interrompida: ${error.message}`);
      if (automation) automation.onFinished({ ok: false, error: String(error.message || error) });
    }
    finally { state.running = false; button("stop").disabled = true; ready(); }
  });
  if (automation) {
    try {
      state.csvText = automation.csvText;
      state.csvName = automation.csvName;
      state.entries = parseCsv(state.csvText);
      state.directory = automation.directory;
      panel.querySelector("[data-limit]").value = String(state.entries.length);
      ready();
      button("start").click();
    } catch (error) { automation.onFinished({ ok: false, error: String(error.message || error) }); }
  }
})();

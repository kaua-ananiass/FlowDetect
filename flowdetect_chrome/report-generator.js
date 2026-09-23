(() => {
  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const MARGIN = 27;

  const COLORS = {
    background: "#04131a",
    panel: "#08232e",
    panelSoft: "#0b2d39",
    border: "#165060",
    accent: "#48e0d0",
    accentBlue: "#4db9f2",
    white: "#e8f7fa",
    muted: "#87a8b1",
    success: "#37df94",
    info: "#4db9f2",
    warning: "#f5be63",
    danger: "#ff8695"
  };

  function dateLabel(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
    }).format(date);
  }

  function durationLabel(startedAt, finishedAt) {
    const start = new Date(startedAt || 0).getTime();
    const end = new Date(finishedAt || startedAt || 0).getTime();
    const seconds = Math.max(0, Math.round((end - start) / 1000));
    if (!Number.isFinite(seconds) || !seconds) return "-";
    const minutes = Math.floor(seconds / 60);
    return minutes ? `${minutes}m ${String(seconds % 60).padStart(2, "0")}s` : `${seconds}s`;
  }

  function reportTone(value, fallback = "success") {
    const tone = String(value || fallback).trim().toLowerCase();
    return ["success", "info", "warning", "danger"].includes(tone) ? tone : fallback;
  }

  function statusLabel(run) {
    const labels = { completed: "CONCLUIDA", failed: "FALHOU", stopped: "INTERROMPIDA" };
    return labels[String(run?.status || "").toLowerCase()] || "FINALIZADA";
  }

  function reportRows(run) {
    const rows = Array.isArray(run?.report?.rows) ? run.report.rows : [];
    if (rows.length) return rows;
    const summary = run?.report?.summary || {};
    const stopped = String(run?.status || "").toLowerCase() === "stopped";
    return [{
      index: 1,
      value: "Execucao geral",
      status: summary.status || statusLabel(run),
      tone: summary.tone || (run?.status === "completed" ? "success" : (stopped ? "warning" : "danger")),
      result: summary.result || run?.lastMessage || "Execucao finalizada.",
      confirmation: summary.confirmation || "",
      success: run?.status === "completed",
      startedAt: run?.startedAt,
      finishedAt: run?.finishedAt,
      error: ""
    }];
  }

  function reportCounters(rows) {
    const counters = { total: rows.length, success: 0, info: 0, review: 0, failed: 0 };
    rows.forEach((row) => {
      const tone = reportTone(row?.tone, row?.success === false ? "danger" : "success");
      if (tone === "success") counters.success += 1;
      else if (tone === "info") counters.info += 1;
      else if (tone === "warning") counters.review += 1;
      else counters.failed += 1;
    });
    return counters;
  }

  function colorCommand(hex) {
    const raw = String(hex || "#000000").replace("#", "");
    const pairs = raw.length === 3 ? raw.split("").map((part) => part + part) : [raw.slice(0, 2), raw.slice(2, 4), raw.slice(4, 6)];
    return pairs.map((part) => (parseInt(part || "0", 16) / 255).toFixed(3)).join(" ");
  }

  function pdfText(value) {
    return String(value ?? "")
      .replace(/[\r\n\t]+/g, " ")
      .replace(/[–—]/g, "-")
      .replace(/[•·]/g, " ")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[^\x20-\xFF]/g, "?")
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)");
  }

  function approximateWidth(value, size, bold = false) {
    return String(value || "").length * size * (bold ? 0.54 : 0.48);
  }

  function truncate(value, maxWidth, size, bold = false) {
    const text = String(value || "-").replace(/\s+/g, " ").trim() || "-";
    if (approximateWidth(text, size, bold) <= maxWidth) return text;
    let output = text;
    while (output.length > 1 && approximateWidth(`${output}...`, size, bold) > maxWidth) output = output.slice(0, -1);
    return `${output}...`;
  }

  function wrap(value, maxWidth, size, bold = false, maxLines = 2) {
    const words = String(value || "-").replace(/\s+/g, " ").trim().split(" ");
    const lines = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (approximateWidth(candidate, size, bold) <= maxWidth || !current) {
        current = candidate;
        continue;
      }
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    }
    if (current && lines.length < maxLines) lines.push(current);
    if (lines.length > maxLines) lines.length = maxLines;
    if (words.join(" ") !== lines.join(" ") && lines.length) lines[lines.length - 1] = truncate(lines[lines.length - 1], maxWidth, size, bold);
    return lines.length ? lines : ["-"];
  }

  function createPage() {
    const commands = [];
    const rect = (x, top, width, height, color) => {
      commands.push(`${colorCommand(color)} rg ${x.toFixed(2)} ${(PAGE_HEIGHT - top - height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f`);
    };
    const line = (x1, top1, x2, top2, color, width = 1) => {
      commands.push(`${colorCommand(color)} RG ${width.toFixed(2)} w ${x1.toFixed(2)} ${(PAGE_HEIGHT - top1).toFixed(2)} m ${x2.toFixed(2)} ${(PAGE_HEIGHT - top2).toFixed(2)} l S`);
    };
    const text = (x, top, value, size = 10, color = COLORS.white, bold = false) => {
      commands.push(`BT /${bold ? "F2" : "F1"} ${size.toFixed(2)} Tf ${colorCommand(color)} rg 1 0 0 1 ${x.toFixed(2)} ${(PAGE_HEIGHT - top - size).toFixed(2)} Tm (${pdfText(value)}) Tj ET`);
    };
    rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, COLORS.background);
    return { commands, rect, line, text, y: 0 };
  }

  function drawHeader(page, run, pageNumber = 1) {
    page.rect(MARGIN, 24, 30, 30, COLORS.accent);
    page.rect(MARGIN + 8, 35, 5, 5, COLORS.background);
    page.rect(MARGIN + 18, 35, 5, 5, COLORS.background);
    page.text(MARGIN + 42, 26, "FLOWDETECT", 7.5, COLORS.accent, true);
    page.text(MARGIN + 42, 36, "Relatorio de execucao", 15, COLORS.white, true);
    page.text(PAGE_WIDTH - MARGIN - 124, 28, statusLabel(run), 7.5, COLORS.accentBlue, true);
    page.text(PAGE_WIDTH - MARGIN - 124, 39, `Gerado em ${dateLabel(new Date())}`, 7.5, COLORS.muted, false);
    page.line(MARGIN, 66, PAGE_WIDTH - MARGIN, 66, COLORS.border, 1);
    if (pageNumber > 1) {
      page.text(MARGIN, 81, "Detalhes da execucao", 13, COLORS.white, true);
      page.text(PAGE_WIDTH - MARGIN - 50, 83, `Pagina ${pageNumber}`, 7.5, COLORS.muted, false);
      page.y = 104;
    } else {
      page.y = 84;
    }
  }

  function drawCounters(page, counters) {
    const gap = 8;
    const width = (PAGE_WIDTH - (MARGIN * 2) - (gap * 3)) / 4;
    const cards = [
      ["EXECUTADAS", counters.total, COLORS.white],
      ["CONFIRMADAS", counters.success, COLORS.success],
      ["INFORMATIVAS", counters.info, COLORS.info],
      ["REVISAR / FALHAS", counters.review + counters.failed, counters.failed ? COLORS.danger : COLORS.warning]
    ];
    cards.forEach(([label, value, color], index) => {
      const x = MARGIN + ((width + gap) * index);
      page.rect(x, page.y, width, 59, COLORS.panel);
      page.text(x + 11, page.y + 11, label, 6.7, COLORS.muted, true);
      page.text(x + 11, page.y + 25, String(value), 19, color, true);
    });
    page.y += 82;
  }

  function toneColor(tone) {
    return COLORS[reportTone(tone)] || COLORS.accent;
  }

  function drawTableHeader(page) {
    const y = page.y;
    page.text(MARGIN, y, "LINHA", 7, COLORS.accent, true);
    page.text(MARGIN + 48, y, "ITEM PROCESSADO", 7, COLORS.accent, true);
    page.text(MARGIN + 226, y, "RESULTADO / CONFIRMACAO", 7, COLORS.accent, true);
    page.text(PAGE_WIDTH - MARGIN - 89, y, "STATUS", 7, COLORS.accent, true);
    page.line(MARGIN, y + 14, PAGE_WIDTH - MARGIN, y + 14, COLORS.border, 1);
    page.y += 23;
  }

  function drawRow(page, row, sourceName) {
    const contentWidth = PAGE_WIDTH - (MARGIN * 2);
    const valueLines = wrap(row.value || "(vazio)", 166, 8.4, true, 2);
    const result = row.result || row.error || "Sem mensagem registrada.";
    const resultLines = wrap(result, 202, 8, false, 2);
    const confirmationLines = row.confirmation ? wrap(`Confirma: ${row.confirmation}`, 202, 7.2, false, 1) : [];
    const statusLines = wrap(row.status || (row.success === false ? "Falhou" : "Concluida"), 76, 7.1, true, 3);
    const lineCount = Math.max(valueLines.length, resultLines.length + confirmationLines.length, statusLines.length);
    const height = Math.max(49, 26 + (lineCount * 10));
    page.rect(MARGIN, page.y, contentWidth, height, COLORS.panel);
    const tone = toneColor(row.tone || (row.success === false ? "danger" : "success"));
    page.rect(MARGIN, page.y, 3, height, tone);
    page.text(MARGIN + 11, page.y + 12, String(row.index || "-"), 10, COLORS.white, true);
    valueLines.forEach((line, index) => page.text(MARGIN + 48, page.y + 10 + (index * 10), line, 8.4, COLORS.white, true));
    resultLines.forEach((line, index) => page.text(MARGIN + 226, page.y + 10 + (index * 10), line, 8, COLORS.muted, false));
    confirmationLines.forEach((line, index) => page.text(MARGIN + 226, page.y + 10 + ((resultLines.length + index) * 10), line, 7.2, COLORS.accent, false));
    const badgeWidth = 82;
    const badgeX = PAGE_WIDTH - MARGIN - badgeWidth - 5;
    const badgeHeight = Math.max(18, 8 + (statusLines.length * 9));
    const badgeTop = page.y + Math.max(8, Math.round((height - badgeHeight) / 2));
    page.rect(badgeX, badgeTop, badgeWidth, badgeHeight, COLORS.panelSoft);
    statusLines.forEach((line, index) => page.text(badgeX + 6, badgeTop + 5 + (index * 9), line.toUpperCase(), 7.1, tone, true));
    const detail = `${sourceName || "item"} ${row.index || "-"}  |  ${durationLabel(row.startedAt, row.finishedAt)}`;
    page.text(MARGIN + 48, page.y + height - 12, truncate(detail, 166, 6.7), 6.7, COLORS.muted, false);
    page.y += height + 8;
  }

  function appendPageFooters(pages) {
    pages.forEach((page, index) => {
      page.line(MARGIN, PAGE_HEIGHT - 33, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 33, COLORS.border, 0.7);
      page.text(MARGIN, PAGE_HEIGHT - 24, "FlowDetect - relatorio gerado pela extensao Chrome", 6.8, COLORS.muted, false);
      page.text(PAGE_WIDTH - MARGIN - 39, PAGE_HEIGHT - 24, `${index + 1}/${pages.length}`, 6.8, COLORS.muted, false);
    });
  }

  function latin1Bytes(value) {
    const text = String(value || "");
    const bytes = new Uint8Array(text.length);
    for (let index = 0; index < text.length; index += 1) bytes[index] = text.charCodeAt(index) & 0xFF;
    return bytes;
  }

  function joinBytes(parts, length) {
    const output = new Uint8Array(length);
    let offset = 0;
    parts.forEach((part) => {
      output.set(part, offset);
      offset += part.length;
    });
    return output;
  }

  function buildPdf(pages) {
    const objects = [];
    const pageRefs = pages.map((_page, index) => `${5 + (index * 2)} 0 R`).join(" ");
    objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    objects[2] = `<< /Type /Pages /Kids [${pageRefs}] /Count ${pages.length} >>`;
    objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
    objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
    pages.forEach((page, index) => {
      const pageObject = 5 + (index * 2);
      const contentObject = pageObject + 1;
      const stream = page.commands.join("\n");
      objects[pageObject] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObject} 0 R >>`;
      objects[contentObject] = `<< /Length ${latin1Bytes(stream).length} >>\nstream\n${stream}\nendstream`;
    });

    const chunks = [];
    const push = (value) => chunks.push(latin1Bytes(value));
    push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
    const offsets = [0];
    let byteLength = chunks.reduce((sum, part) => sum + part.length, 0);
    for (let index = 1; index < objects.length; index += 1) {
      offsets[index] = byteLength;
      const objectText = `${index} 0 obj\n${objects[index]}\nendobj\n`;
      const part = latin1Bytes(objectText);
      chunks.push(part);
      byteLength += part.length;
    }
    const xrefOffset = byteLength;
    let xref = `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let index = 1; index < objects.length; index += 1) xref += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
    xref += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    push(xref);
    return joinBytes(chunks, chunks.reduce((sum, part) => sum + part.length, 0));
  }

  function buildExecutionReportPdf(run) {
    const rows = reportRows(run);
    const counters = reportCounters(rows);
    const pages = [];
    let page = createPage();
    pages.push(page);
    drawHeader(page, run, 1);
    page.text(MARGIN, page.y, truncate(run?.automationName || "Automacao", 440, 24, true), 24, COLORS.white, true);
    page.y += 33;
    page.text(MARGIN, page.y, "Relatorio compacto da execucao no Chrome", 10, COLORS.muted, false);
    page.y += 27;
    drawCounters(page, counters);
    page.text(MARGIN, page.y, "LINHAS PROCESSADAS", 8, COLORS.accent, true);
    page.y += 15;
    drawTableHeader(page);
    rows.forEach((row) => {
      const estimatedHeight = 77;
      if (page.y + estimatedHeight > PAGE_HEIGHT - 47) {
        page = createPage();
        pages.push(page);
        drawHeader(page, run, pages.length);
        drawTableHeader(page);
      }
      drawRow(page, row, run?.report?.sourceName || "item");
    });
    appendPageFooters(pages);
    return buildPdf(pages);
  }

  function filenameFor(run) {
    const title = String(run?.automationName || "automacao")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "automacao";
    const now = new Date();
    const stamp = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("")
      + "_" + [String(now.getHours()).padStart(2, "0"), String(now.getMinutes()).padStart(2, "0"), String(now.getSeconds()).padStart(2, "0")].join("");
    return `FlowDetect_Relatorio_${title}_${stamp}.pdf`;
  }

  function download(run) {
    const bytes = buildExecutionReportPdf(run);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filenameFor(run);
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    return anchor.download;
  }

  globalThis.FlowDetectExecutionReport = { buildExecutionReportPdf, download, reportRows, reportCounters };
})();

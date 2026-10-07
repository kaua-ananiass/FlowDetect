(() => {
  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const MARGIN = 30;
  const REPORT_TABLE = Object.freeze({
    lineOffset: 12,
    companyOffset: 59,
    companyWidth: 153,
    resultOffset: 224,
    resultWidth: 193,
    statusOffset: 431,
    statusWidth: 92
  });

  const COLORS = {
    background: "#07111F",
    panel: "#0E1B2E",
    panelStrong: "#091525",
    panelSoft: "#11243B",
    border: "#28465F",
    accent: "#12B5CB",
    accentSoft: "#5EEAD4",
    white: "#E6F7FF",
    textSoft: "#B5CAD8",
    muted: "#7895A9",
    success: "#22C55E",
    info: "#4DB9F2",
    warning: "#F59E0B",
    danger: "#FF7185"
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
    const text = String(value || "");
    let units = 0;
    for (const character of text) {
      if (/\s/.test(character)) units += 0.28;
      else if (/[ilI1'`.,;:!|]/.test(character)) units += 0.28;
      else if (/[MW@#%&]/.test(character)) units += 0.86;
      else if (/[A-Z\xC0-\xDE]/.test(character)) units += 0.67;
      else if (/[0-9]/.test(character)) units += 0.56;
      else units += 0.54;
    }
    return units * size * (bold ? 1.02 : 1);
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
    let omitted = false;
    for (const rawWord of words) {
      const word = approximateWidth(rawWord, size, bold) > maxWidth
        ? truncate(rawWord, maxWidth, size, bold)
        : rawWord;
      const candidate = current ? `${current} ${word}` : word;
      if (approximateWidth(candidate, size, bold) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      if (lines.length >= maxLines) {
        omitted = true;
        current = "";
        break;
      }
      current = word;
    }
    if (current && lines.length < maxLines) lines.push(current);
    if (omitted && lines.length) lines[lines.length - 1] = truncate(`${lines[lines.length - 1]}...`, maxWidth, size, bold);
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

  function drawHeader(page) {
    page.text(MARGIN, 30, "FlowDetect", 13, COLORS.white, true);
    page.text(PAGE_WIDTH - MARGIN - 145, 29, "RELATORIO DE EXECUCAO", 7.1, COLORS.accentSoft, true);
    page.text(PAGE_WIDTH - MARGIN - 130, 40, `Gerado em ${dateLabel(new Date())}`, 7.1, COLORS.muted, false);
    page.line(MARGIN, 59, PAGE_WIDTH - MARGIN, 59, COLORS.border, 0.8);
    page.y = 75;
  }

  function toneColor(tone) {
    return COLORS[reportTone(tone)] || COLORS.accent;
  }

  function drawTableHeader(page, sourceName) {
    const contentWidth = PAGE_WIDTH - (MARGIN * 2);
    page.rect(MARGIN, page.y, contentWidth, 23, COLORS.panelSoft);
    page.text(MARGIN + REPORT_TABLE.lineOffset, page.y + 8, "LINHA", 6.4, COLORS.textSoft, true);
    page.text(MARGIN + REPORT_TABLE.companyOffset, page.y + 8, truncate(String(sourceName || "ITEM").toUpperCase(), REPORT_TABLE.companyWidth, 6.4, true), 6.4, COLORS.textSoft, true);
    page.text(MARGIN + REPORT_TABLE.resultOffset, page.y + 8, "RESULTADO", 6.4, COLORS.textSoft, true);
    page.text(MARGIN + REPORT_TABLE.statusOffset, page.y + 8, "STATUS", 6.4, COLORS.textSoft, true);
    page.y += 32;
  }

  function drawRow(page, row, sourceName, rowIndex = 1) {
    const contentWidth = PAGE_WIDTH - (MARGIN * 2);
    const valueLines = wrap(row.value || "(vazio)", REPORT_TABLE.companyWidth, 8.2, true, 2);
    const result = row.result || row.error || "Sem mensagem registrada.";
    const resultLines = wrap(result, REPORT_TABLE.resultWidth, 7.6, false, 2);
    const statusLines = wrap(row.status || (row.success === false ? "Falhou" : "Concluida"), REPORT_TABLE.statusWidth, 6.7, true, 2);
    const lineCount = Math.max(valueLines.length, resultLines.length, statusLines.length);
    const height = Math.max(64, 30 + (lineCount * 10));
    page.rect(MARGIN, page.y, contentWidth, height, rowIndex % 2 ? COLORS.panel : COLORS.panelStrong);
    const tone = toneColor(row.tone || (row.success === false ? "danger" : "success"));
    page.rect(MARGIN, page.y, 3, height, tone);
    page.text(MARGIN + REPORT_TABLE.lineOffset, page.y + 14, String(row.index || rowIndex).padStart(2, "0"), 9.8, COLORS.white, true);
    const time = row.finishedAt ? dateLabel(row.finishedAt).slice(-5) : "--:--";
    page.text(MARGIN + REPORT_TABLE.lineOffset, page.y + 31, time, 6.3, COLORS.muted, false);
    valueLines.forEach((line, index) => page.text(MARGIN + REPORT_TABLE.companyOffset, page.y + 14 + (index * 10), line, 8.2, COLORS.white, true));
    resultLines.forEach((line, index) => page.text(MARGIN + REPORT_TABLE.resultOffset, page.y + 14 + (index * 10), line, 7.6, COLORS.textSoft, false));
    statusLines.forEach((line, index) => page.text(MARGIN + REPORT_TABLE.statusOffset, page.y + 15 + (index * 10), line.toUpperCase(), 6.7, tone, true));
    const detail = `${sourceName || "item"} ${row.index || rowIndex} | ${durationLabel(row.startedAt, row.finishedAt)}`;
    page.text(MARGIN + REPORT_TABLE.companyOffset, page.y + height - 14, truncate(detail, REPORT_TABLE.companyWidth, 6.4), 6.4, COLORS.muted, false);
    page.y += height + 7;
  }

  function appendPageFooters(pages) {
    pages.forEach((page, index) => {
      page.line(MARGIN, PAGE_HEIGHT - 34, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 34, COLORS.border, 0.6);
      page.text(MARGIN, PAGE_HEIGHT - 24, "FlowDetect | Relatorio gerado pela extensao Chrome", 6.7, COLORS.muted, false);
      page.text(PAGE_WIDTH - MARGIN - 32, PAGE_HEIGHT - 24, `${index + 1}`, 6.7, COLORS.muted, false);
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
    const excludedRows = Array.isArray(run?.report?.excludedRows) ? run.report.excludedRows : [];
    const pages = [];
    let page = createPage();
    pages.push(page);
    drawHeader(page);
    page.text(MARGIN, page.y, truncate(run?.automationName || "Automacao", 440, 21, true), 21, COLORS.white, true);
    page.y += 28;
    page.text(MARGIN, page.y, `${rows.length} processada(s) | ${excludedRows.length} ignorada(s) | Planilha: ${run?.report?.sourceName || "-"}`, 8.5, COLORS.textSoft, false);
    page.y += 23;
    drawTableHeader(page, run?.report?.sourceName || "item");
    rows.forEach((row, rowIndex) => {
      const estimatedHeight = 77;
      if (page.y + estimatedHeight > PAGE_HEIGHT - 47) {
        page = createPage();
        pages.push(page);
        drawHeader(page);
        drawTableHeader(page, run?.report?.sourceName || "item");
      }
      drawRow(page, row, run?.report?.sourceName || "item", rowIndex + 1);
    });
    if (excludedRows.length) {
      if (page.y + 55 > PAGE_HEIGHT - 47) { page = createPage(); pages.push(page); drawHeader(page); }
      page.rect(MARGIN, page.y, PAGE_WIDTH - MARGIN * 2, 24, COLORS.panelSoft);
      page.text(MARGIN + 10, page.y + 8, "LINHAS IGNORADAS ANTES DA EXECUCAO", 7, COLORS.warning, true);
      page.y += 30;
      for (const item of excludedRows) {
        if (page.y + 25 > PAGE_HEIGHT - 47) { page = createPage(); pages.push(page); drawHeader(page); }
        page.text(MARGIN + 8, page.y + 3,
          truncate(`#${item.index}  ${item.company || item.value || "(sem nome)"}  |  ${item.value || ""}`,
            PAGE_WIDTH - MARGIN * 2 - 18, 7.5), 7.5, COLORS.textSoft, false);
        page.y += 17;
      }
    }
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

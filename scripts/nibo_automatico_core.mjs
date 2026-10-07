import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { parseCsv } = require("./nibo_exportar_conversas.js");

export function weekBounds(now = new Date(), since = null) {
  const start = since ? new Date(since) : new Date(now);
  if (Number.isNaN(start.getTime())) throw new Error("Data da última execução inválida.");
  if (!since) start.setDate(start.getDate() - 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { start, end };
}

export function updatedDate(record) {
  const match = String(record?.["Atualizado em"] || "").match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
  if (!match) return null;
  const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  return date.getFullYear() === Number(match[3]) && date.getMonth() === Number(match[2]) - 1
    && date.getDate() === Number(match[1]) ? date : null;
}

export function selectWeeklyEntries(entries, completed, now = new Date(), since = null) {
  const { start, end } = weekBounds(now, since);
  const selected = [];
  const summary = { outsidePeriod: 0, missingDate: 0, alreadyComplete: 0 };
  for (const entry of entries) {
    const date = updatedDate(entry.record);
    if (!date) { summary.missingDate += 1; continue; }
    if (date < start || date >= end) { summary.outsidePeriod += 1; continue; }
    const previous = completed.get(entry.id);
    const stamp = String(entry.record["Atualizado em"] || "").trim();
    if (previous?.stamp && previous.stamp === stamp) { summary.alreadyComplete += 1; continue; }
    selected.push(entry);
  }
  return { selected, summary, start, end };
}

export function renderSourceCsv(entries) {
  if (!entries.length) throw new Error("Nenhum atendimento selecionado para o CSV.");
  const headers = Object.keys(entries[0].record);
  const row = (values) => values.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(";");
  return `\uFEFF${row(headers)}\r\n${entries.map(({ record }) => row(headers.map((key) => record[key]))).join("\r\n")}\r\n`;
}

async function readableJson(filename) {
  try { return JSON.parse(await fs.readFile(filename, "utf8")); }
  catch { return null; }
}

export async function lastSuccessfulRun(destination) {
  const directory = path.join(destination, "relatorios_nibo");
  let names;
  try { names = await fs.readdir(directory); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
  let latest = null;
  for (const name of names.filter((item) => /^execucao_.*\.json$/.test(item))) {
    const report = await readableJson(path.join(directory, name));
    if (!report || !["CONCLUIDO", "SEM_PENDENCIAS"].includes(report.status)) continue;
    const date = new Date(report.finishedAt);
    if (!Number.isNaN(date.getTime()) && (!latest || date > latest)) latest = date;
  }
  return latest;
}

export async function completedIndex(destination) {
  const completed = new Map();
  let folders;
  try { folders = await fs.readdir(destination, { withFileTypes: true }); }
  catch (error) { if (error.code === "ENOENT") return completed; throw error; }
  for (const folder of folders) {
    if (!folder.isDirectory() || !folder.name.startsWith("Nibo_Conversas_")) continue;
    const directory = path.join(destination, folder.name);
    const control = await readableJson(path.join(directory, "controle.json"))
      || await readableJson(path.join(directory, "controle.reserva.json"));
    if (!control?.items) continue;
    for (const [id, item] of Object.entries(control.items)) {
      if (item.status !== "OK" || item.complete !== true || !item.files?.json || !item.files?.html) continue;
      if (path.basename(item.files.json) !== item.files.json || path.basename(item.files.html) !== item.files.html) continue;
      const jsonPath = path.join(directory, item.files.json);
      const htmlPath = path.join(directory, item.files.html);
      try {
        if (!(await fs.stat(jsonPath)).size || !(await fs.stat(htmlPath)).size) continue;
        const data = await readableJson(jsonPath);
        const stamp = String(data?.record?.["Atualizado em"] || "").trim();
        if (!stamp) continue;
        const exportedAt = Date.parse(data.exportedAt || "") || 0;
        if (!completed.has(id) || exportedAt > completed.get(id).exportedAt) {
          completed.set(id, { stamp, exportedAt, folder: folder.name });
        }
      } catch { /* Arquivos ausentes ou ilegíveis não contam como exportação completa. */ }
    }
  }
  return completed;
}

export function parseSourceCsv(text) { return parseCsv(text); }

export function safeSegment(value) {
  if (typeof value !== "string" || !value || value === "." || value === ".."
    || /[\\/\0:]/.test(value)) throw new Error("Nome de arquivo inválido no exportador.");
  return value;
}

export async function createFileBridge(destination) {
  const root = path.resolve(destination);
  await fs.mkdir(root, { recursive: true });
  const resolved = (parts = []) => {
    if (!Array.isArray(parts) || !parts.length || !/^Nibo_Conversas_[A-Za-z0-9_-]+$/.test(parts[0])) {
      throw new Error("A ponte só acessa as subpastas Nibo_Conversas_* configuradas.");
    }
    return path.join(root, ...parts.map(safeSegment));
  };
  return async ({ action, parts = [], encoding, content, create = false }) => {
    const filename = resolved(parts);
    try {
      if (action === "directory") {
        if (create) await fs.mkdir(filename, { recursive: true });
        if (!(await fs.stat(filename)).isDirectory()) throw new Error("Não é uma pasta.");
        return true;
      }
      if (action === "file") {
        if (create) return true;
        if (!(await fs.stat(filename)).isFile()) throw new Error("Não é um arquivo.");
        return true;
      }
      if (action === "read") {
        const stat = await fs.stat(filename);
        return { text: await fs.readFile(filename, "utf8"), size: stat.size, lastModified: stat.mtimeMs };
      }
      if (action === "write") {
        await fs.mkdir(path.dirname(filename), { recursive: true });
        const bytes = encoding === "base64" ? Buffer.from(content, "base64") : String(content ?? "");
        await fs.writeFile(filename, bytes);
        return true;
      }
      throw new Error("Operação não permitida no exportador.");
    } catch (error) {
      if (error.code === "ENOENT") return { error: "NotFoundError", message: error.message };
      throw error;
    }
  };
}

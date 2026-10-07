#!/usr/bin/env node
/* Exportação semanal do Nibo. Nunca armazena senha; usa um perfil Chrome separado. */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { completedIndex, createFileBridge, lastSuccessfulRun, parseSourceCsv,
  renderSourceCsv, selectWeeklyEntries } from "./nibo_automatico_core.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const settingsDir = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "FlowDetect", "Nibo");
const configPath = path.join(settingsDir, "config.json");
const profilePath = path.join(settingsDir, "chrome-profile");
const attendanceUrl = "https://contador.nibo.com.br/spa/Relationship/ServiceDeskRequest";

async function getBrowser() {
  try { return (await import("playwright-core")).chromium; }
  catch { throw new Error("Instale a dependência: npm install na pasta scripts/nibo_automatico."); }
}

async function readConfig() {
  let config;
  try { config = JSON.parse(await fs.readFile(configPath, "utf8")); }
  catch { throw new Error(`Configure primeiro a pasta de destino. Arquivo esperado: ${configPath}`); }
  if (!path.isAbsolute(config.destination)) throw new Error("A pasta de destino precisa ser um caminho absoluto.");
  return config;
}

async function saveConfig(config) {
  await fs.mkdir(settingsDir, { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
}

async function configure(destination) {
  if (!destination || !path.isAbsolute(destination)) throw new Error("Informe uma pasta absoluta com --destino.");
  await fs.mkdir(destination, { recursive: true });
  const old = await fs.readFile(configPath, "utf8").then(JSON.parse).catch(() => ({}));
  await saveConfig({ ...old, destination: path.resolve(destination) });
  console.log(`Destino configurado: ${path.resolve(destination)}`);
}

async function browserContext(headless) {
  const chromium = await getBrowser();
  await fs.mkdir(profilePath, { recursive: true });
  return chromium.launchPersistentContext(profilePath, {
    channel: "chrome", headless, acceptDownloads: true, bypassCSP: true,
    viewport: { width: 1440, height: 900 }
  });
}

async function openAttendance(page) {
  await page.goto(attendanceUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  try {
    await page.waitForFunction(() => [...document.querySelectorAll("input")].some((input) =>
      /ID,? assunto,? contato ou WhatsApp/i.test(input.placeholder || "")), null, { timeout: 25000 });
  } catch {
    throw new Error("Não encontrei a lista de Atendimento. A sessão pode ter expirado ou o Nibo mudou a tela. Execute o login assistido.");
  }
}

function stamp() { return new Date().toISOString().replace(/[:.]/g, "-"); }

async function saveDownload(download, destination) {
  const name = download.suggestedFilename();
  if (!/\.csv$/i.test(name)) throw new Error(`O Nibo baixou ${name}, não um CSV. Revise a calibração.`);
  const directory = path.join(destination, "relatorios_nibo");
  await fs.mkdir(directory, { recursive: true });
  const filename = path.join(directory, `Atendimentos_${stamp()}.csv`);
  await download.saveAs(filename);
  return filename;
}

async function login() {
  await readConfig();
  const context = await browserContext(false);
  try {
    const page = context.pages()[0] || await context.newPage();
    await page.goto("https://contador.nibo.com.br/", { waitUntil: "domcontentloaded" });
    console.log("Faça login no Nibo nesta janela. Quando a lista de Atendimento abrir, volte aqui e pressione Enter.");
    const prompt = readline.createInterface({ input: stdin, output: stdout });
    try { await prompt.question("Enter após o login: "); }
    finally { prompt.close(); }
    await openAttendance(page);
    console.log("Sessão autenticada neste perfil separado. Agora execute a calibração da exportação.");
  } finally { await context.close(); }
}

async function calibrate() {
  const config = await readConfig();
  const context = await browserContext(false);
  try {
    const page = context.pages()[0] || await context.newPage();
    await openAttendance(page);
    const clicks = [];
    await page.exposeBinding("__flowdetectExportClick", (_source, selector) => { clicks.push(selector); });
    await page.evaluate(() => {
      function selectorFor(element) {
        const parts = [];
        for (let node = element; node && node instanceof Element;) {
          let part = node.localName;
          if (node.id) part += `#${CSS.escape(node.id)}`;
          else {
            const stable = ["data-testid", "aria-label", "title"].find((name) => node.hasAttribute(name));
            if (stable) part += `[${stable}=${JSON.stringify(node.getAttribute(stable))}]`;
            else {
              const siblings = [...(node.parentElement?.children || [])].filter((sibling) => sibling.localName === node.localName);
              if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
            }
          }
          parts.unshift(part);
          node = node.parentElement || node.getRootNode().host;
        }
        return parts.join(" ");
      }
      document.addEventListener("click", (event) => {
        const target = event.composedPath().find((node) => node instanceof Element && node.matches("button,a,[role=button],[title]"))
          || event.composedPath().find((node) => node instanceof Element);
        if (target) window.__flowdetectExportClick(selectorFor(target));
      }, true);
    });
    console.log("Na janela do Chrome, clique SOMENTE no botão de exportar a lista e, se aparecer, na opção CSV.");
    const download = await page.waitForEvent("download", { timeout: 5 * 60 * 1000 });
    await page.waitForTimeout(400);
    if (!clicks.length) throw new Error("Não registrei o botão usado para exportar. Tente a calibração novamente.");
    const filename = await saveDownload(download, config.destination);
    const entries = parseSourceCsv(await fs.readFile(filename, "utf8"));
    if (!entries.length) throw new Error("O CSV de calibração não contém IDs válidos.");
    config.exportClicks = clicks.slice(-2);
    await saveConfig(config);
    console.log(`Exportação calibrada (${config.exportClicks.length} clique(s), ${entries.length} IDs). CSV de teste: ${filename}`);
  } finally { await context.close(); }
}

async function clickExport(page, selectors) {
  if (!Array.isArray(selectors) || !selectors.length) {
    throw new Error("Exporte um CSV manualmente uma vez com o comando calibrar antes do agendamento.");
  }
  let downloaded;
  page.once("download", (value) => { downloaded = value; });
  for (const selector of selectors) {
    if (downloaded) break;
    const button = page.locator(selector);
    if (await button.count() !== 1 || !await button.isVisible()) {
      throw new Error(`O botão de exportação mudou ou não está visível: ${selector}`);
    }
    await button.click();
    await page.waitForTimeout(500);
  }
  const deadline = Date.now() + 45000;
  while (!downloaded && Date.now() < deadline) await page.waitForTimeout(250);
  if (!downloaded) throw new Error("O clique calibrado não iniciou um download CSV. Revise a tela do Nibo e calibre novamente.");
  return downloaded;
}

async function run() {
  const config = await readConfig();
  const context = await browserContext(true);
  let page;
  let report = { startedAt: new Date().toISOString(), status: "ERRO" };
  try {
    page = context.pages()[0] || await context.newPage();
    await openAttendance(page);
    const download = await clickExport(page, config.exportClicks);
    const csvFile = await saveDownload(download, config.destination);
    const entries = parseSourceCsv(await fs.readFile(csvFile, "utf8"));
    if (!entries.length) throw new Error("O CSV exportado não contém IDs válidos.");
    const completed = await completedIndex(config.destination);
    const since = await lastSuccessfulRun(config.destination);
    const { selected, summary, start, end } = selectWeeklyEntries(entries, completed, new Date(), since);
    if (summary.missingDate === entries.length) throw new Error("O CSV não possui a coluna Atualizado em com datas válidas.");
    report = { ...report, csvFile, totalCsv: entries.length, selected: selected.length,
      periodStart: start.toISOString(), periodEnd: end.toISOString(), ...summary };
    console.log(`CSV: ${entries.length} IDs; ${selected.length} desde ${start.toLocaleDateString("pt-BR")} pendentes; ${summary.alreadyComplete} já completos.`);
    if (!selected.length) { report.status = "SEM_PENDENCIAS"; return; }

    const bridge = await createFileBridge(config.destination);
    let finish;
    const finished = new Promise((resolve) => { finish = resolve; });
    await page.exposeBinding("__flowdetectNiboFs", (source, request) => {
      if (new URL(source.frame.url()).origin !== "https://contador.nibo.com.br") {
        throw new Error("Origem não autorizada para gravar a exportação.");
      }
      return bridge(request);
    });
    await page.exposeBinding("__flowdetectNiboStatus", (_source, message) => console.log(`[Nibo] ${message}`));
    await page.exposeBinding("__flowdetectNiboFinished", (_source, result) => finish(result));
    await page.addScriptTag({ path: path.join(here, "nibo_automatico_bridge.js") });
    await page.evaluate(({ csvText, csvName }) => {
      window.__FLOWDETECT_NIBO_AUTO__ = {
        csvText, csvName, directory: window.__flowdetectNiboDirectory,
        onStatus: (message) => window.__flowdetectNiboStatus(message),
        onFinished: (result) => window.__flowdetectNiboFinished(result)
      };
    }, { csvText: renderSourceCsv(selected), csvName: path.basename(csvFile) });
    await page.addScriptTag({ path: path.join(here, "nibo_exportar_conversas.js") });
    const result = await Promise.race([
      finished,
      new Promise((_, reject) => {
        const timer = setTimeout(() => reject(new Error("Limite de 12 horas atingido.")), 12 * 60 * 60 * 1000);
        timer.unref();
      })
    ]);
    report = { ...report, ...result, status: result.ok ? "CONCLUIDO" : "ERRO" };
    if (!result.ok) throw new Error(result.error || "Falha na exportação.");
    if (result.counts.ERRO || result.counts.INCOMPLETO || result.counts.PENDENTE || result.pendingMedia) {
      report.status = "PENDENCIAS";
      report.error = "Há conversas incompletas ou mídias pendentes; elas serão tentadas na próxima execução.";
      process.exitCode = 2;
    }
  } catch (error) {
    report.error = String(error.message || error);
    console.error(report.error);
    if (page) {
      const filename = path.join(config.destination, "relatorios_nibo", `erro_${stamp()}.png`);
      await fs.mkdir(path.dirname(filename), { recursive: true });
      await page.screenshot({ path: filename }).catch(() => {});
      report.screenshot = filename;
    }
    process.exitCode = 1;
  } finally {
    report.finishedAt = new Date().toISOString();
    const directory = path.join(config.destination, "relatorios_nibo");
    await fs.mkdir(directory, { recursive: true });
    const filename = path.join(directory, `execucao_${stamp()}.json`);
    await fs.writeFile(filename, JSON.stringify(report, null, 2));
    console.log(`Relatório: ${filename}`);
    await context.close();
  }
}

const command = process.argv[2];
try {
  if (command === "configurar") await configure(process.argv[3]);
  else if (command === "login") await login();
  else if (command === "calibrar") await calibrate();
  else if (command === "rodar") await run();
  else throw new Error("Uso: node nibo_automatico.mjs configurar <pasta> | login | calibrar | rodar");
} catch (error) { console.error(error.message); process.exitCode = 1; }

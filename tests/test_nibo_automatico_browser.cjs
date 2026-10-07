const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

test("modo automático salva conversa e checkpoint sem seletores de arquivo do Chrome", async (t) => {
  let chromium;
  try { ({ chromium } = require("../scripts/node_modules/playwright-core")); }
  catch { return t.skip("playwright-core não instalado"); }
  let browser;
  try { browser = await chromium.launch({ channel: "chrome", headless: true }); }
  catch { return t.skip("Chrome não instalado"); }
  const destination = await fs.mkdtemp(path.join(os.tmpdir(), "nibo-auto-browser-"));
  const { createFileBridge } = await import("../scripts/nibo_automatico_core.mjs");
  try {
    const context = await browser.newContext({ bypassCSP: true });
    const page = await context.newPage();
    await page.route("https://contador.nibo.com.br/spa/Relationship/ServiceDeskRequest", (route) => route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><body>
      <input placeholder="ID, assunto, contato ou WhatsApp"><button>Filtrar</button>
      <table><tr><td onclick="document.querySelector('#modal').style.display='block'">261005-001</td></tr></table>
      <div id="modal" style="display:none">Detalhes do atendimento ID 261005-001
        <button title="Fechar" onclick="document.querySelector('#modal').style.display='none'">X</button>
        <service-desk-chat><div style="height:300px;overflow-y:auto">
          <service-desk-chat-log-create>Atendimento criado em 05/10/2026 09:00</service-desk-chat-log-create>
        </div></service-desk-chat>
      </div></body></html>`
    }));
    await page.goto("https://contador.nibo.com.br/spa/Relationship/ServiceDeskRequest");
    const bridge = await createFileBridge(destination);
    let finish;
    const finished = new Promise((resolve) => { finish = resolve; });
    await page.exposeBinding("__flowdetectNiboFs", (_source, request) => bridge(request));
    await page.exposeBinding("__flowdetectNiboStatus", () => {});
    await page.exposeBinding("__flowdetectNiboFinished", (_source, result) => finish(result));
    await page.addScriptTag({ path: path.join(__dirname, "..", "scripts", "nibo_automatico_bridge.js") });
    await page.evaluate(async () => {
      const batch = await window.__flowdetectNiboDirectory.getDirectoryHandle("Nibo_Conversas_bridge", { create: true });
      const media = await batch.getDirectoryHandle("midias", { create: true });
      const file = await media.getFileHandle("amostra.bin", { create: true });
      const writer = await file.createWritable();
      await writer.write(new Blob([new Uint8Array([0, 127, 255])]));
      await writer.close();
    });
    assert.deepEqual([...await fs.readFile(path.join(destination, "Nibo_Conversas_bridge", "midias", "amostra.bin"))], [0, 127, 255]);
    await page.evaluate(() => {
      window.__FLOWDETECT_NIBO_AUTO__ = {
        csvText: 'ID,Cliente,Responsável,Atualizado em\n261005-001,Empresa Teste,Ana,05/10/2026 09:00\n',
        csvName: "teste.csv", directory: window.__flowdetectNiboDirectory,
        onStatus: (message) => window.__flowdetectNiboStatus(message),
        onFinished: (result) => window.__flowdetectNiboFinished(result)
      };
    });
    await page.addScriptTag({ path: path.join(__dirname, "..", "scripts", "nibo_exportar_conversas.js") });
    const result = await Promise.race([
      finished, new Promise((_, reject) => {
        const timer = setTimeout(() => reject(new Error("exportação simulada travou")), 20000);
        timer.unref();
      })
    ]);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.counts.OK, 1);
    const folders = (await fs.readdir(destination)).filter((item) => item.startsWith("Nibo_Conversas_") && item !== "Nibo_Conversas_bridge");
    assert.equal(folders.length, 1);
    const control = JSON.parse(await fs.readFile(path.join(destination, folders[0], "controle.json"), "utf8"));
    assert.equal(control.items["261005-001"].status, "OK");
    const data = JSON.parse(await fs.readFile(path.join(destination, folders[0], control.items["261005-001"].files.json), "utf8"));
    assert.equal(data.historyComplete, true);
    assert.equal(data.id, "261005-001");
    await context.close();
  } finally {
    await browser.close();
    await fs.rm(destination, { recursive: true, force: true });
  }
});

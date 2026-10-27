// Run with PLAYWRIGHT_MODULE pointing to playwright or playwright-core when not installed locally.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

test("integration catalog: navigation, search, details, persistence and safe storage failures", async () => {
  const web = path.resolve(__dirname, "../tauri_gerador/web");
  const server = http.createServer(async (req, res) => {
    try {
      const filename = path.resolve(web, "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname.replace(/\/$/, "/index.html")));
      if (!filename.startsWith(web + path.sep)) { res.writeHead(403).end(); return; }
      const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".png": "image/png" };
      res.setHeader("Content-Type", types[path.extname(filename)] || "application/octet-stream");
      res.end(await fs.readFile(filename));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    // Browser-only test: no authenticated Tauri session or production accounts.
    await page.addStyleTag({ content: "#loginOverlay { display:none!important } .builder-shell { visibility:visible!important; pointer-events:auto!important; filter:none!important }" });
    await page.locator("#integrationsTabButton").click();
    await page.waitForSelector("#integrationsPanel.is-active .integration-card");
    assert.equal(await page.locator(".workspace-panel.is-active").count(), 1);
    assert.equal(await page.locator(".integration-card").count(), 4);
    assert.doesNotMatch(await page.locator("#integrationsGrid").innerText(), /nf-stock|eContador/);
    await page.locator('[data-detail-id="alterdata"]').click();
    assert.match(await page.locator("#integrationDetails").innerText(), /XMLs existentes/);
    assert.match(await page.locator("#integrationDetails").innerText(), /sem reimportar notas/);
    assert.match(await page.locator("#integrationDetails").innerText(), /Sem conexão ativa/);
    await page.getByRole("button", { name: "Fechar detalhes" }).click();
    assert.equal(await page.locator("#integrationDetails").isVisible(), false);
    await page.getByRole("button", { name: "Priorizar Alterdata", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: "Priorizar Alterdata", exact: true }).getAttribute("aria-pressed"), "true");
    await page.locator("#integrationsFilter").selectOption("selected");
    assert.equal(await page.locator(".integration-card").count(), 1);
    await page.reload();
    await page.addStyleTag({ content: "#loginOverlay { display:none!important } .builder-shell { visibility:visible!important; pointer-events:auto!important; filter:none!important }" });
    await page.locator("#integrationsTabButton").click();
    assert.equal(await page.getByRole("button", { name: "Priorizar Alterdata", exact: true }).getAttribute("aria-pressed"), "true");
    await page.locator("#integrationsSearch").fill("contabil");
    assert.equal(await page.locator(".integration-card").count(), 1);
    await page.locator("#integrationsSearch").fill("does-not-exist");
    assert.equal(await page.locator("#integrationsEmpty").isVisible(), true);
    await page.locator("#integrationsSearch").fill("");
    await page.locator("#launcherTabButton").click();
    assert.equal(await page.locator("#integrationsPanel").isVisible(), false);
    await page.locator("#integrationsTabButton").click();
    if (process.env.INTEGRATIONS_SCREENSHOT) await page.screenshot({ path: process.env.INTEGRATIONS_SCREENSHOT });
    await page.setViewportSize({ width: 600, height: 850 });
    assert.ok(await page.locator("#integrationsPanel").evaluate(el => el.scrollWidth <= el.clientWidth + 1), "No panel horizontal overflow");
    // Fresh instance with inaccessible storage: do not claim the selection was saved.
    await page.evaluate(async () => {
      const panel = document.getElementById("integrationsPanel");
      const clone = panel.cloneNode(true);
      panel.replaceWith(clone);
      clone.querySelector("#integrationsGrid").removeAttribute("data-initialized");
      const { initIntegrations } = await import("./integrations.js");
      initIntegrations(document, { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } });
    });
    await page.getByRole("button", { name: "Priorizar Nibo", exact: true }).click();
    assert.match(await page.locator("#integrationsFeedback").innerText(), /Não foi possível salvar/);
    assert.equal(await page.getByRole("button", { name: "Priorizar Nibo", exact: true }).getAttribute("aria-pressed"), "false");
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});

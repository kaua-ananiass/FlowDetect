const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

test('report editor separates controls, previews edits and fits long content without horizontal scrolling', async () => {
  const web = path.resolve(__dirname, '../tauri_gerador/web');
  const source = await fs.readFile(path.join(web, 'main.js'), 'utf8');
  const functions = ['renderReportResultFields', 'syncReportResultPreview'].map(name => source.match(new RegExp(`^function ${name}\\(.*?^}`, 'ms'))[0]).join('\n');
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/') {
        res.setHeader('Content-Type', 'text/html');
        res.end('<meta charset="utf-8"><link rel="stylesheet" href="/vendor/fonts/fonts.css"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/report-editor.css"><style>body{overflow:auto;padding:24px;background:#090f18}#test{max-width:840px;margin:auto}</style><main id="test"></main>');
      } else {
        const file = path.join(web, decodeURIComponent(url.pathname));
        res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : 'application/octet-stream');
        res.end(await fs.readFile(file));
      }
    } catch (_) { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.addScriptTag({ content: `
      const escapeHtml = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
      const reportColumnChoices = () => ({sourceName:'CNPJ', hasColumns:true, loopLabel:'Loop da planilha: CNPJ (Empresas)', companyOptions:()=>'<option value="">CNPJ da linha atual</option><option value="Empresa">Empresa</option>'});
      const renderSuccessFlowFields = () => '<label>Ao concluir<select><option>Ir para bloco</option></select></label><label>Bloco de destino<select><option>Bloco 5 · Reconhecimento OCR</option></select></label>';
      ${functions}
      const root = document.querySelector('#test');
      root.innerHTML = renderReportResultFields('data-tree-field', {status:'Concluída', resultado:'Automação concluída para {{empresa}}.'}, 7);
      root.addEventListener('input',()=>syncReportResultPreview(root));
      root.addEventListener('change',()=>syncReportResultPreview(root));
    ` });
    assert.equal(await page.locator('.report-pdf-preview-full input, .report-pdf-preview-full textarea, .report-pdf-preview-full select').count(), 0);
    await page.locator('[data-tree-field="reportStatus"]').fill('Revisar competência 09/2026');
    await page.locator('[data-tree-field="reportTone"]').selectOption('warning');
    await page.locator('[data-tree-field="reportColumn"]').selectOption('Empresa');
    await page.locator('[data-tree-field="reportResult"]').fill('Empresa com nome extenso: ' + 'verificação '.repeat(40));
    assert.match(await page.locator('[data-report-preview-company]').textContent(), /Empresa/);
    assert.equal(await page.locator('[data-report-row]').getAttribute('data-tone'), 'warning');
    assert.equal(await page.locator('[data-report-preview-status]').textContent(), 'Revisar competência 09/2026');
    for (const width of [1000, 640, 390]) {
      await page.setViewportSize({ width, height: 1100 });
      const overflow = await page.evaluate(() => ({ body: document.documentElement.scrollWidth, viewport: innerWidth,
        clipped: [...document.querySelectorAll('.report-editor-fields input,.report-editor-fields textarea,.report-editor-fields select,.report-document-row > div')].filter(el=>el.getBoundingClientRect().right>innerWidth || el.getBoundingClientRect().left<0).length }));
      assert.ok(overflow.body <= width, JSON.stringify(overflow));
      assert.equal(overflow.clipped, 0);
    }
    if (process.env.FLOWDETECT_TEST_SCREENSHOT_DIR) {
      await fs.mkdir(process.env.FLOWDETECT_TEST_SCREENSHOT_DIR, { recursive: true });
      await page.setViewportSize({ width: 1000, height: 1100 });
      await page.locator('[data-tree-field="reportResult"]').fill('Guia emitida com sucesso para {{empresa}}. Documento salvo na pasta da empresa.');
      await page.screenshot({ path: path.join(process.env.FLOWDETECT_TEST_SCREENSHOT_DIR, 'report-editor.png'), fullPage: true });
    }
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
});

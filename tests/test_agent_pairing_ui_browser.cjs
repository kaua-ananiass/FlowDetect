const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

test('Agent shows and renews a temporary pairing code', async () => {
  const base = path.resolve(__dirname, '../flowdetect_agent/web');
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      const name = path.resolve(base, '.' + pathname.replace(/\/$/, '/index.html'));
      if (!name.startsWith(base + path.sep)) return res.writeHead(403).end();
      res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[path.extname(name)] || 'application/octet-stream');
      res.end(await fs.readFile(name));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless:true, ...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {}) });
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    await page.addInitScript(() => {
      window.pairingRotations = 0;
      window.__TAURI__ = {
        core: { invoke: async command => {
          if (command === 'get_agent_connection_info') return {
            address: '192.0.2.40:18452', agent_name: 'Executor de teste',
            pairing: {code: window.pairingRotations ? 'WXYZ-3456-ABCD' : 'ABCD-EFGH-JKLM', expires_at: Date.now()/1000 + 600, pairing_protocol:1}
          };
          if (command === 'agent_pairing_renew') { window.pairingRotations++; return {}; }
          if (command === 'get_agent_mouse_control_state') return {mouse_enabled:false};
          if (command === 'get_agent_remote_snapshot') return {remote_connection:{connected:false}};
          if (command === 'list_saved_automations') return {items:[]};
          return {};
        }},
        event: {listen: async () => () => {}},
        window: {getCurrentWindow: () => ({hide:async()=>{},show:async()=>{},setFocus:async()=>{},setAlwaysOnTop:async()=>{}})}
      };
    });
    await page.goto('http://127.0.0.1:' + server.address().port + '/');
    await page.waitForFunction(() => document.querySelector('#agentPairCode')?.textContent === 'ABCD-EFGH-JKLM');
    await page.evaluate(() => document.body.classList.remove('agent-service-mode'));
    assert.equal(await page.locator('#agentPairCode').innerText(), 'ABCD-EFGH-JKLM');
    await page.locator('#agentRenewPairCode').click();
    await page.waitForFunction(() => document.querySelector('#agentPairCode')?.textContent === 'WXYZ-3456-ABCD');
    assert.equal(await page.locator('#agentPairCode').innerText(), 'WXYZ-3456-ABCD');
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
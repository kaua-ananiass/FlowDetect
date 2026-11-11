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
      window.agentSnapshots = 0;
      window.libraryAttempts = 0;
      window.chromeCode = '';
      window.chromePaired = false;
      window.__TAURI__ = {
        core: { invoke: async (command, args) => {
          if (command === 'get_agent_connection_info') return {
            address: '192.0.2.40:18452', agent_name: 'Executor de teste',
            remote_server_ok: !window.serverFailure, server_error: 'Porta ocupada pelo processo de teste',
            pairing: {code: window.pairingRotations ? 'WXYZ-3456-ABCD' : 'ABCD-EFGH-JKLM', expires_at: Date.now()/1000 + 600, pairing_protocol:1}
          };
          if (command === 'agent_pairing_renew') { window.pairingRotations++; return {}; }
          if (command === 'get_agent_mouse_control_state') return {mouse_enabled:false};
          if (command === 'get_agent_remote_snapshot') { window.agentSnapshots++; return {snapshot:{running:false}}; }
          if (command === 'list_saved_automations') {
            if (++window.libraryAttempts === 1) throw Error('Falha temporaria da biblioteca');
            return {items:[]};
          }
          if (command === 'pair_chrome_extension') {
            window.chromeCode = args.code;
            if (args.code !== '123456') throw Error('Codigo nao encontrado');
            window.chromePaired = true;
            return {ok:true};
          }
          if (command === 'chrome_extension_connection_status') return {bridgeActive:true,paired:window.chromePaired,connected:false};
          return {};
        }},
        event: {listen: async () => () => {}},
        window: {getCurrentWindow: () => ({hide:async()=>{},show:async()=>{},setFocus:async()=>{},setAlwaysOnTop:async()=>{}})}
      };
    });
    await page.goto('http://127.0.0.1:' + server.address().port + '/');
    await page.waitForFunction(() => document.querySelector('#agentPairCode')?.textContent === 'ABCD-EFGH-JKLM');
    assert.equal(await page.evaluate(() => document.body.classList.contains('agent-service-mode')), false);
    assert.equal(await page.locator('#agentPairCode').isVisible(), true);
    assert.equal(await page.locator('#agentPairCode').innerText(), 'ABCD-EFGH-JKLM');
    await page.locator('#agentRenewPairCode').click();
    await page.waitForFunction(() => document.querySelector('#agentPairCode')?.textContent === 'WXYZ-3456-ABCD');
    assert.equal(await page.locator('#agentPairCode').innerText(), 'WXYZ-3456-ABCD');
    await page.waitForFunction(() => window.agentSnapshots > 0);
    assert.ok(await page.evaluate(() => window.libraryAttempts > 1), 'Polling recovers after initial library error');
    await page.locator('#agentChromePairCode').fill('000000');
    await page.locator('#agentChromePairButton').click();
    await page.waitForFunction(() => document.querySelector('#agentChromeStatus').textContent.includes('nao encontrado'));
    assert.equal(await page.locator('#agentChromePairButton').isEnabled(), true);
    await page.locator('#agentChromePairCode').fill('123456');
    await page.locator('#agentChromePairButton').click();
    await page.waitForFunction(() => window.chromePaired);
    assert.equal(await page.evaluate(() => window.chromeCode), '123456');
    assert.equal(await page.locator('#agentChromePairCode').inputValue(), '');
    assert.match(await page.locator('#agentChromeStatus').innerText(), /Pareado/);
    await page.evaluate(async () => {
      window.serverFailure = true;
      await loadAgentConnectionInfo();
      await refreshRemoteAgentState();
    });
    assert.match(await page.locator('#agentConnectionAddress').innerText(), /Falha no servidor/);
    assert.match(await page.locator('#agentConnectionHelp').innerText(), /Porta ocupada/);
    await page.evaluate(async () => {
      window.serverFailure = false;
      await loadAgentConnectionInfo();
      renderAgentConnectionState({remote_connection:{connected:true}});
      await loadAgentConnectionInfo();
    });
    assert.equal(await page.locator('#agentConnectionAddress').innerText(), 'Conectado ao Studio: 192.0.2.40:18452');
    if (process.env.AGENT_SCREENSHOT) await page.screenshot({path:process.env.AGENT_SCREENSHOT,fullPage:true});
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});

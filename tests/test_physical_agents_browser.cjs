const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

test('physical agents: persistence, migration, isolated screen, input, reconnection and VM separation', async () => {
  const web = path.resolve(__dirname, '../tauri_gerador/web');
  const server = http.createServer(async (req, res) => {
    try {
      const filename = path.resolve(web, '.' + new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '/index.html'));
      if (!filename.startsWith(web + path.sep)) return res.writeHead(403).end();
      res.setHeader('Content-Type', ({ '.js':'text/javascript', '.html':'text/html', '.css':'text/css' })[path.extname(filename)] || 'application/octet-stream');
      res.end(await fs.readFile(filename));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({headless:true, ...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {})});
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.calls = [];
      window.RTCPeerConnection = undefined; // deterministic compatibility-path test
      window.__TAURI__ = { core: { invoke: async (command, payload = {}) => {
        window.calls.push({command, payload});
        if (command === 'remote_agent_ping') {
          if (window.failPing) throw new Error('PC desligado');
          return {pairing_protocol:1,agent_version:'3.1.0',agent:'Agent de teste'};
        }
        if (command === 'remote_agent_pair_by_code') {
          if (payload.code !== 'ABCD-EFGH-JKLM') throw new Error('Código incorreto ou expirado');
          return {address:'192.0.2.30:18452',name:'Agent de teste',agent_id:'1234567890abcdef1234567890abcdef',pairing_protocol:1,agent_version:'3.1.0'};
        }
        if (command === 'remote_agent_webrtc_offer') return {session_id:'rtc-test'};
        if (command === 'remote_agent_webrtc_answer') return window.waitVideo ? {} : {session_id:'rtc-test', answer:{type:'answer',sdp:'mock'}};
        if (command === 'remote_agent_screen_snapshot') {
          if (window.failSnapshot) throw new Error('Rede indisponível');
          return {mime:'image/svg+xml', data:btoa('<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#193147"/><text x="100" y="200" fill="white" font-size="48">PC remoto - teste</text></svg>')};
        }
        if (command === 'list_hyperv_vms') return {items:[{name:'VM-Teste',state:'Off',uuid:'test'}]};
        if (command === 'remote_agent_list_automations') return {items:[{id:'demo',nome:'Automação de teste'}]};
        return {};
      } } };
      if (!localStorage.getItem('physical-test-seeded')) {
        localStorage.setItem('flowdetect_agents_vms_v1', JSON.stringify([
          {id:'legacy-pc', name:'PC legado', address:'192.0.2.10:18452'},
          {id:'legacy-vm', name:'VM cadastrada', vmName:'VM-Teste', address:'192.0.2.20:18452'}
        ]));
        localStorage.setItem('physical-test-seeded','1');
      }
    });
    const unlock = async () => page.addStyleTag({content:'#loginOverlay {display:none!important} .builder-shell {visibility:visible!important; pointer-events:auto!important; filter:none!important}'});
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await unlock();
    await page.locator('#agentsTabButton').click();
    await page.locator('#agentsPhysicalTabButton').click();
    assert.equal(await page.locator('.physical-agent-card').count(),1);
    assert.match(await page.locator('.physical-agent-card').innerText(),/PC legado/);
    assert.equal(await page.locator('#refreshAgentVmsButton').isVisible(),false);
    await page.locator('[data-agent-action="new"]').click();
    assert.equal(await page.locator('#agentVmNameInput').count(),0);
    assert.equal(await page.locator('#agentAddressInput').count(),0);
    await page.locator('#agentNameInput').fill('Executor Fiscal');
    await page.locator('#agentPairCodeInput').fill('0000-0000-0000');
    await page.locator('[data-agent-action="create-save"]').click();
    assert.equal(await page.locator('.physical-agent-card').count(),1);
    await page.locator('#agentPairCodeInput').fill('ABCD-EFGH-JKLM');
    await page.locator('[data-agent-action="create-save"]').click();
    await page.waitForFunction(() => document.querySelectorAll('.physical-agent-card').length === 2);
    assert.equal(await page.locator('.physical-agent-card').count(),2);
    assert.ok(await page.evaluate(() => !localStorage.getItem('flowdetect_agents_vms_v1').includes('ABCD-EFGH-JKLM')), 'O código não deve ser persistido');
    await page.reload(); await unlock();
    await page.locator('#agentsTabButton').click(); await page.locator('#agentsPhysicalTabButton').click();
    assert.equal(await page.locator('.physical-agent-card').count(),2);
    const card = page.locator('.physical-agent-card').filter({hasText:'Executor Fiscal'});
    await card.locator('[data-agent-action="edit"]').click();
    await page.locator('#agentNameInput').fill('Executor DP');
    await page.locator('[data-agent-action="create-save"]').click();
    const edited = page.locator('.physical-agent-card').filter({hasText:'Executor DP'});
    await edited.waitFor();
    await page.evaluate(() => window.calls = []);
    await edited.locator('[data-agent-action="connect"]').click();
    await page.waitForSelector('#agentScreenPanel.is-active #studioControlScreenImage:not([hidden])');
    await page.waitForFunction(() => document.getElementById('studioControlScreenImage').naturalWidth === 1280);
    assert.equal(await page.locator('#agentScreenTitle').innerText(),'Executor DP');
    assert.equal(await page.locator('#agentScreenVmSelect').isVisible(),false);
    assert.match(await page.locator('#studioControlScreenStatus').innerText(),/Modo compatível/);
    if (process.env.AGENTS_SCREENSHOT) await page.screenshot({path:process.env.AGENTS_SCREENSHOT.replace(/\.png$/, '-screen.png')});
    assert.equal(await page.locator('#studioControlRemoteInputToggle').isChecked(),true);
    await page.locator('#studioControlScreenImage').click();
    await page.keyboard.press('a');
    await page.keyboard.down('Shift');
    await page.keyboard.press('Escape');
    const events = await page.evaluate(() => window.calls.filter(c => c.command === 'remote_agent_control_event').map(c => c.payload));
    assert.ok(events.some(p => p.event.kind === 'mouse' && p.event.event === 'down'));
    assert.ok(events.some(p => p.event.key === 'a' && p.event.event === 'down'));
    assert.ok(events.some(p => p.event.key === 'Shift' && p.event.event === 'up'));
    assert.ok(events.every(p => p.address === '192.0.2.30:18452'));
    const calls = await page.evaluate(() => window.calls.map(c => c.command));
    assert.ok(!calls.some(c => /start_hyperv|open_native_hyperv|execute_watch|remote_agent_execute$/.test(c)), 'Viewing physical screen must not start VM or automation');
    await page.locator('#studioControlHypervCloseButton').click();
    assert.equal(await page.locator('#studioControlScreenImage').isVisible(),false);
    await page.locator('#agentPhysicalReconnectButton').click();
    await page.waitForSelector('#studioControlScreenImage:not([hidden])');
    await page.evaluate(() => window.failSnapshot = true);
    await page.waitForFunction(() => document.getElementById('studioControlScreenStatus').textContent.includes('Rede indisponível'));
    assert.equal(await page.locator('#studioControlScreenImage').isVisible(),true, 'A última imagem válida deve continuar visível');
    await page.evaluate(() => { window.failSnapshot = false; window.failPing = true; });
    await page.locator('#agentPhysicalReconnectButton').click();
    await page.waitForFunction(() => document.getElementById('studioControlScreenStatus').textContent.includes('PC desligado'));
    await page.evaluate(() => window.failPing = false);
    await page.locator('#agentsTabButton').click(); await page.locator('#agentsPhysicalTabButton').click();
    await page.locator('.physical-agent-card').filter({hasText:'PC legado'}).locator('[data-agent-action="connect"]').click();
    await page.waitForSelector('#studioControlScreenImage:not([hidden])');
    assert.equal(await page.locator('#agentScreenTitle').innerText(),'PC legado');
    await page.locator('#studioControlHypervCloseButton').click();
    // The deployed Agent does not implement a WebRTC video sender yet.
    // Physical sessions must use the responsive authenticated JPEG transport.
    await page.locator('#agentPhysicalQualitySelect').selectOption('sharp');
    await page.locator('#agentPhysicalReconnectButton').click();
    await page.waitForSelector('#studioControlScreenImage:not([hidden])');
    await page.waitForFunction(() => window.calls.some(c => c.command === 'remote_agent_screen_snapshot' && c.payload.width === 1600));
    assert.equal(await page.evaluate(() => window.calls.some(c => c.command === 'remote_agent_webrtc_offer')),false);
    await page.locator('#studioControlHypervCloseButton').click();
    assert.equal(await page.locator('#studioControlScreenVideo').isVisible(),false);
    assert.equal(await page.locator('#studioControlScreenImage').isVisible(),false);
    await page.locator('#agentsTabButton').click(); await page.locator('#agentsMachinesTabButton').click();
    assert.equal(await page.locator('.physical-agent-card').count(),0);
    assert.ok(await page.locator('.vm-launcher-card').count() > 0);
    await page.locator('#agentsPhysicalTabButton').click();
    if (process.env.AGENTS_SCREENSHOT) await page.screenshot({path:process.env.AGENTS_SCREENSHOT});
    await page.setViewportSize({width:800,height:900});
    assert.ok(await page.locator('#agentsMachinesView').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
    assert.deepEqual(errors,[]);
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
});

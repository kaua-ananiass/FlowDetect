const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');

test('input lock is scoped to sender tab; emergency release affects only its own run', async () => {
  const worker = fs.readFileSync(path.join(root, 'flowdetect_chrome/service_worker.js'), 'utf8');
  const source = worker.match(/^async function handleMessage\(.*?^}/ms)[0];
  const runs = new Map([['a', { id: 'a', tabId: 1, blockInput: true }], ['b', { id: 'b', tabId: 2, blockInput: true }]]);
  const ctx = vm.createContext({ activeRuns: runs, chrome: { tabs: { sendMessage: async () => {} } } });
  vm.runInContext(source, ctx);
  assert.equal((await ctx.handleMessage({ type: 'flowdetect-input-lock-state' }, { tab: { id: 1 } })).runId, 'a');
  assert.equal((await ctx.handleMessage({ type: 'flowdetect-input-lock-state' }, {})).locked, false);
  await ctx.handleMessage({ type: 'flowdetect-input-lock-release', runId: 'b' }, { tab: { id: 1 } });
  assert.equal(runs.get('b').blockInput, true);
  await ctx.handleMessage({ type: 'flowdetect-input-lock-release', runId: 'a' }, { tab: { id: 1 } });
  assert.equal(runs.get('a').blockInput, false);
  assert.equal(runs.get('b').blockInput, true);
  runs.get('b').cancelled = true;
  assert.equal((await ctx.handleMessage({ type: 'flowdetect-input-lock-state' }, { tab: { id: 2 } })).locked, false);
});

test('browser blocks real input, permits automation and releases on emergency, completion and lost worker', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<button id="target" style="margin:40px">Executar</button><input id="text"><div style="height:3000px"></div>');
    await page.evaluate(() => {
      window.clicks = 0; window.locked = true; window.broken = false;
      document.querySelector('#target').onclick = () => window.clicks++;
      window.chrome = { runtime: {
        onMessage: { addListener() {} },
        sendMessage: async message => {
          if (window.broken) throw Error('Worker stopped');
          if (message.type === 'flowdetect-input-lock-release') window.locked = false;
          return { locked: window.locked, runId: 'run-1' };
        },
      } };
    });
    await page.addScriptTag({ path: path.join(root, 'flowdetect_chrome/input-lock.js') });
    await page.waitForSelector('[data-flowdetect-input-lock]');
    await page.locator('#target').click();
    assert.equal(await page.evaluate(() => clicks), 0);
    await page.locator('#text').evaluate(el => el.focus());
    await page.keyboard.type('manual');
    assert.equal(await page.locator('#text').inputValue(), '');
    await page.mouse.wheel(0, 500);
    assert.equal(await page.evaluate(() => scrollY), 0);
    await page.evaluate(() => { document.querySelector('#target').click(); document.querySelector('#text').value = 'automação'; });
    assert.equal(await page.evaluate(() => clicks), 1);
    assert.equal(await page.locator('#text').inputValue(), 'automação');
    await page.keyboard.press('Control+Alt+Shift+KeyL');
    await page.waitForSelector('[data-flowdetect-input-lock]', { state: 'detached' });
    await page.locator('#target').click();
    assert.equal(await page.evaluate(() => clicks), 2);
    // New run / newly injected document locks again, but completion releases it.
    await page.evaluate(async () => { window.locked = true; await __flowDetectInputLockRefresh(); });
    assert.equal(await page.locator('[data-flowdetect-input-lock]').count(), 1);
    await page.evaluate(() => { window.locked = false; });
    await page.waitForSelector('[data-flowdetect-input-lock]', { state: 'detached', timeout: 4000 });
    await page.evaluate(async () => { window.locked = true; await __flowDetectInputLockRefresh(); window.broken = true; });
    await page.waitForSelector('[data-flowdetect-input-lock]', { state: 'detached', timeout: 4000 });
    await page.locator('#target').click();
    assert.equal(await page.evaluate(() => clicks), 3);
  } finally { await browser.close(); }
});

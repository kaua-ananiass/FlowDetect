const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

test('packaged Chrome extension registers and starts its module worker', async () => {
  const root = path.resolve(process.env.FLOWDETECT_EXTENSION_DIR || path.join(__dirname, '../flowdetect_chrome'));
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'flowdetect-worker-startup-'));
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, {
      headless: true,
      channel: 'chromium',
      ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
      args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`],
    });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 20000 });
    const manifest = await worker.evaluate(() => chrome.runtime.getManifest());
    assert.equal(manifest.name, 'FlowDetect para Chrome');
    const extensionId = new URL(worker.url()).host;
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    const reply = await page.evaluate(() => chrome.runtime.sendMessage({ type: 'flowdetect-pages' }));
    assert.equal(reply.ok, true);
    assert.ok(Array.isArray(reply.pages));
  } finally {
    await context?.close();
    // Profiles are temporary test artifacts, retained for diagnostics.
  }
});

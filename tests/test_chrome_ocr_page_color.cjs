const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const worker = fs.readFileSync(path.join(root, 'flowdetect_chrome/service_worker.js'), 'utf8');
const fn = name => worker.match(new RegExp(`^async function ${name}\\(.*?^}`, 'ms'))[0];

test('parallel OCR requests retain the color of their own execution page', async () => {
  const sent = [];
  const ctx = vm.createContext({
    sendToPage: async (tab, message) => {
      sent.push({ tab, message });
      return message.type === 'flowdetect-viewport-info' ? { ok: true, width: 100, height: 100 } : { ok: true };
    },
    aguardarTransicaoDaPagina: async () => {},
  });
  vm.runInContext(`${fn('executePageStep')}\n${fn('clickVisualResult')}`, ctx);
  const step = { type: 'ocr_text', text: 'Competência', click: false };
  const match = { screenshotWidth: 100, screenshotHeight: 100, centerX: 50, centerY: 50, width: 30, height: 20 };
  await Promise.all(['#12b5cb', '#8b5cf6', '#4ade80', '#f59e0b'].map(async (color, i) => {
    const run = { id: `r${i}`, tabId: i + 1, pageColor: color };
    await ctx.executePageStep(run, step);
    await ctx.clickVisualResult(run, step, match, 'OCR');
  }));
  for (const [i, color] of ['#12b5cb', '#8b5cf6', '#4ade80', '#f59e0b'].entries()) {
    assert.equal(sent.find(s => s.tab === i + 1 && s.message.step)?.message.step.highlight_color, color);
    assert.equal(sent.find(s => s.tab === i + 1 && s.message.label === 'OCR')?.message.color, color);
  }
  assert.equal(step.highlight_color, undefined, 'saved automation is unchanged');
});

test('OCR border and label render with the page color in the browser', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<button style="margin:50px">Competência de Apuração</button>');
    await page.evaluate(() => { globalThis.chrome = { runtime: { onMessage: { addListener() {}, removeListener() {} } } }; });
    await page.addScriptTag({ path: path.join(root, 'flowdetect_chrome/content.js') });
    for (const color of ['#12b5cb', '#8b5cf6', '#4ade80', '#f59e0b']) {
      const result = await page.evaluate(color => new Promise(resolve => {
        document.querySelectorAll('[data-flowdetect-overlay]').forEach(el => el.remove());
        globalThis.__flowDetectChromeRunnerListener({
          type: 'flowdetect-execute-step-v2', run_id: color,
          step: { type: 'ocr_text', text: 'Competência de Apuração', click: false, highlight_color: color },
        }, null, resolve);
      }), color);
      assert.equal(result.ok, true, result.error);
      const rendered = await page.locator('[data-flowdetect-overlay]').evaluate(el => ({ border: el.style.borderColor, tag: el.querySelector('span').style.backgroundColor }));
      const rgb = `rgb(${[1, 3, 5].map(start => parseInt(color.slice(start, start + 2), 16)).join(', ')})`;
      assert.equal(rendered.border, rgb);
      assert.equal(rendered.tag, rgb);
    }
  } finally { await browser.close(); }
});

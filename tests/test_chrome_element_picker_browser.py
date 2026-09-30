"""End-to-end DOM checks for the extension's on-page element selector."""

import html
import json
from pathlib import Path
import re
import subprocess
import tempfile
import unittest

from tests.test_ocr_preview import browser_path


ROOT = Path(__file__).resolve().parents[1]
SCENARIO = r"""
(async () => {
  const checks = [], errors = [];
  const check = (name, condition) => {
    if (!condition) throw new Error(name);
    checks.push(name);
  };
  const begin = () => {
    let response;
    window.__flowDetectChromeRunnerListener({type:'flowdetect-map-element-v1'}, null, value => response=value);
    check('picker starts', response?.ok === true);
    return document.querySelector('[data-flowdetect-picker]');
  };
  const root = () => window.__pickerShadows.find(item => item.host.isConnected && item.host.hasAttribute('data-flowdetect-picker'));
  const click = target => target.dispatchEvent(new MouseEvent('click', {bubbles:true,cancelable:true,composed:true}));
  try {
    const pay = document.querySelector('#pay');
    let siteClicks = 0;
    pay.addEventListener('click', () => siteClicks++);
    const host = begin();
    check('only one picker overlay', document.querySelectorAll('[data-flowdetect-picker]').length === 1);
    pay.dispatchEvent(new PointerEvent('pointermove', {bubbles:true,composed:true}));
    check('hover highlights the page element', root().querySelector('.outline').style.display === 'block');
    click(pay);
    check('selection does not activate site button', siteClicks === 0);
    check('unique ID is copied as a CSS selector', root().querySelector('textarea').value === '#pay');
    check('result dialog opens on the page', root().querySelector('.dialog').hasAttribute('open'));
    root().querySelector('.copy').click();
    await new Promise(resolve => setTimeout(resolve, 30));
    check('copy button places selector on clipboard', window.__copied === '#pay');
    root().querySelector('.again').click();
    click(document.querySelector('[data-testid="company-card"]'));
    const semantic = root().querySelector('textarea').value;
    check('test ID selector is unique and directly reusable',
      semantic.includes('data-testid') && document.querySelectorAll(semantic).length === 1);
    root().querySelector('.again').click();
    click(document.querySelectorAll('.duplicate')[1]);
    const fallback = root().querySelector('textarea').value;
    check('repeated elements get a unique path',
      fallback.includes('nth-of-type') && document.querySelector(fallback) === document.querySelectorAll('.duplicate')[1]);
    root().querySelector('.again').click();
    const special=document.createElement('button');special.id='action:confirm';document.querySelector('main').append(special);
    click(special);
    const escaped=root().querySelector('textarea').value;
    check('CSS special characters remain valid', document.querySelector(escaped)===special);
    root().querySelector('.again').click();
    click(document.querySelector('#secret'));
    const secretSelector = root().querySelector('textarea').value;
    check('private field value is never copied', !secretSelector.includes('super-secret'));
    root().querySelector('.again').click();
    const external=document.createElement('div');document.querySelector('main').append(external);
    const inner=external.attachShadow({mode:'open'});
    const innerButton=document.createElement('button');inner.append(innerButton);
    click(innerButton);
    check('unsupported Shadow DOM is explained without copying a broken selector',
      !root().querySelector('.dialog').hasAttribute('open') && root().querySelector('.hint').textContent.includes('Shadow DOM'));
    root().querySelector('.close').click();
    check('close removes overlay', !document.querySelector('[data-flowdetect-picker]'));
    click(pay);
    check('normal page clicks resume', siteClicks === 1);
    begin(); begin();
    check('restarting leaves only one picker', document.querySelectorAll('[data-flowdetect-picker]').length === 1);
    document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true,cancelable:true}));
    check('Escape cancels and cleans up', !document.querySelector('[data-flowdetect-picker]'));
    check('popup button is in the extension toolbar', window.__panelHasMapButton);
    check('old UI is not required for mapping', document.querySelectorAll('.automation-card').length === 0);
  } catch (error) { errors.push(String(error.stack || error)); }
  document.querySelector('#result').textContent = JSON.stringify({checks, errors});
})();
"""


class ElementPickerBrowserTest(unittest.TestCase):
    def test_select_copy_retry_and_cancel(self):
        browser = browser_path()
        if not browser:
            self.skipTest("Install Chrome/Edge or set FLOWDETECT_TEST_BROWSER")
        source = (ROOT / "flowdetect_chrome/content.js").read_text(encoding="utf-8")
        panel = (ROOT / "flowdetect_chrome/sidepanel.html").read_text(encoding="utf-8")
        with tempfile.TemporaryDirectory(prefix="flowdetect-element-picker-") as temporary:
            fixture = Path(temporary) / "picker.html"
            fixture.write_text(
                '<!doctype html><meta charset="utf-8"><main>'
                '<button id="pay">Pagar</button>'
                '<div data-testid="company-card">Empresa</div>'
                '<section><button class="duplicate">A</button><button class="duplicate">B</button></section>'
                '<input id="secret" type="password" value="super-secret"></main>'
                '<pre id="result"></pre><script>'
                'window.__pickerShadows=[];'
                'const originalAttachShadow=Element.prototype.attachShadow;'
                'Element.prototype.attachShadow=function(options){const root=originalAttachShadow.call(this,options);'
                'window.__pickerShadows.push(root);return root};'
                'window.__panelHasMapButton=' + json.dumps('id="mapElementButton"' in panel) + ';'
                'Object.defineProperty(navigator,"clipboard",{value:{writeText:async text=>{window.__copied=text}}});'
                'window.chrome={runtime:{onMessage:{addListener(){},removeListener(){}}}};'
                + source + SCENARIO + '</script>', encoding="utf-8")
            completed = subprocess.run([
                browser, "--headless", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
                f"--user-data-dir={Path(temporary) / 'profile'}", "--window-size=900,650",
                "--virtual-time-budget=3500", "--dump-dom", fixture.as_uri(),
            ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=40,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            dom = completed.stdout.decode("utf-8", errors="replace")
            match = re.search(r'<pre id="result">(.*?)</pre>', dom, re.S)
            self.assertTrue(match and match.group(1), completed.stderr.decode(errors="replace")[-2000:])
            result = json.loads(html.unescape(match.group(1)))
            self.assertEqual(result["errors"], [], "\n".join(result["errors"]))
            self.assertEqual(len(result["checks"]), 20)


if __name__ == "__main__":
    unittest.main()

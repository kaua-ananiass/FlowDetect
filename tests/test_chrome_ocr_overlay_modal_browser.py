"""The Chrome OCR marker must stay visible above a native modal dialog."""

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
  const mark = (x, y) => new Promise(resolve => {
    window.__flowDetectChromeRunnerListener({
      type:'flowdetect-click-coordinate-v2',x,y,width:70,height:28,clicks:0,label:'OCR'
    }, null, resolve);
  });
  try {
    const modal = document.querySelector('#company-modal');
    modal.showModal();
    check('native dialog enters the top layer',modal.matches(':modal'));
    const target = modal.querySelector('#target');
    const rect = target.getBoundingClientRect();
    const result = await mark(rect.left + rect.width / 2, rect.top + rect.height / 2);
    check('recognition still succeeds',result?.ok === true);
    const marker = document.querySelector('[data-flowdetect-overlay]');
    check('marker is hosted by the active modal',marker?.parentElement === modal);
    check('marker is above the modal in the browser top layer',marker?.matches(':popover-open'));
    check('marker remains visually aligned to the OCR target',
      Math.abs(marker.getBoundingClientRect().left - (rect.left + rect.width / 2 - 35)) < 2);
    check('visual marker cannot intercept the automation click',getComputedStyle(marker).pointerEvents === 'none');
    modal.close();
    await mark(100, 100);
    const markers = [...document.querySelectorAll('[data-flowdetect-overlay]')];
    check('ordinary pages still receive a visual marker',markers.at(-1)?.parentElement === document.documentElement);
  } catch (error) { errors.push(String(error.stack || error)); }
  document.querySelector('#result').textContent = JSON.stringify({checks,errors});
})();
"""


class ChromeOcrOverlayModalBrowserTest(unittest.TestCase):
    def test_visual_marker_above_native_dialog(self):
        browser = browser_path()
        if not browser:
            self.skipTest("Install Chrome/Edge or set FLOWDETECT_TEST_BROWSER")
        source = (ROOT / "flowdetect_chrome/content.js").read_text(encoding="utf-8")
        with tempfile.TemporaryDirectory(prefix="flowdetect-ocr-modal-") as temporary:
            fixture = Path(temporary) / "modal.html"
            fixture.write_text(
                '<!doctype html><meta charset="utf-8">'
                '<dialog id="company-modal" style="width:400px;height:260px">'
                '<button id="target" style="margin:70px 100px;width:130px;height:45px">Sugestão</button>'
                '</dialog><pre id="result"></pre><script>'
                'window.chrome={runtime:{onMessage:{addListener(){},removeListener(){}}}};'
                + source + SCENARIO + '</script>', encoding="utf-8")
            completed = subprocess.run([
                browser, "--headless", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
                f"--user-data-dir={Path(temporary) / 'profile'}", "--window-size=900,650",
                "--virtual-time-budget=2500", "--dump-dom", fixture.as_uri(),
            ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=40,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            dom = completed.stdout.decode("utf-8", errors="replace")
            match = re.search(r'<pre id="result">(.*?)</pre>', dom, re.S)
            self.assertTrue(match and match.group(1), completed.stderr.decode(errors="replace")[-2000:])
            result = json.loads(html.unescape(match.group(1)))
            self.assertEqual(result["errors"], [], "\n".join(result["errors"]))
            self.assertEqual(len(result["checks"]), 7)


if __name__ == "__main__":
    unittest.main()

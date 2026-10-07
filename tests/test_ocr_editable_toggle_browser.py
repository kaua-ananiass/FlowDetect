import html
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import unittest

from tests.test_ocr_preview import browser_path


WEB = Path(__file__).resolve().parents[1] / "tauri_gerador" / "web"


class OcrEditableToggleBrowserTest(unittest.TestCase):
    def test_editable_ocr_toggle_has_accessible_click_target_and_no_clipping(self):
        browser = browser_path()
        if not browser:
            self.skipTest("Chrome/Edge unavailable")

        source = (WEB / "main.js").read_text(encoding="utf-8")
        render = re.search(r"function renderOcrTargetRows\(.*?(?=\nfunction refreshOcrTargetRows\()", source, re.S)
        self.assertIsNotNone(render)
        fixture_html = f'''<!doctype html><html lang="pt-BR"><meta charset="utf-8">
<link rel="stylesheet" href="{(WEB / 'vendor/fonts/fonts.css').as_uri()}">
<link rel="stylesheet" href="{(WEB / 'style.css').as_uri()}">
<style>body{{margin:0;padding:25px;background:#07111f;color:#e6f7ff;font-family:"Plus Jakarta Sans",sans-serif}}
#sample{{width:280px}}#result{{font-size:11px}}</style>
<div id="sample"></div><pre id="result">waiting</pre><script>
const OCR_TARGET_COLORS=['azul','roxo'];
const splitOcrTargetText=text=>String(text).split('\\n');
const escapeHtml=text=>String(text ?? '').replace(/[&<>"']/g,c=>({{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}})[c]);
const normalizeOcrTargetAction=value=>value||'continuar';
const normalizeOcrTargetFailureAction=value=>value||'continuar';
const formatTransitionDelayValue=value=>String(value);
const parseNumber=(value,fallback)=>Number(value)||fallback;
{render.group(0)}
document.querySelector('#sample').innerHTML=renderOcrTargetRows('data-field','data-action','09/2026\\nConfirmar',
  [{{editableChrome:true}},{{editableChrome:false}}]);
const rows=[...document.querySelectorAll('.ocr-target-row')];
const labels=rows.map(row=>row.querySelector('.ocr-target-editable'));
const switches=rows.map(row=>row.querySelector('.ocr-target-editable-switch'));
const removeButtons=rows.map(row=>row.querySelector('.ocr-target-remove'));
const before=rows.map(row=>row.querySelector('[data-ocr-target-editable]').checked);
labels[1].click();
const clicked=rows[1].querySelector('[data-ocr-target-editable]').checked;
labels[1].click();
const inside=labels.every((label,index)=>switches[index].getBoundingClientRect().right<=label.getBoundingClientRect().right+1
  && label.scrollWidth<=label.clientWidth+1);
const stacked=labels.every((label,index)=>label.getBoundingClientRect().bottom<removeButtons[index].getBoundingClientRect().top
  && removeButtons[index].querySelector('svg path'));
const aligned=labels.every((label,index)=>{{
  const top=label.getBoundingClientRect(),bottom=removeButtons[index].getBoundingClientRect();
  const topCenter=top.left+top.width/2,bottomCenter=bottom.left+bottom.width/2;
  return Math.abs(topCenter-bottomCenter)<1 && top.width<=44 && bottom.width<=30
    && bottom.height<=28 && getComputedStyle(label).backgroundColor==='rgba(0, 0, 0, 0)'
    && getComputedStyle(label).borderTopWidth==='0px' && getComputedStyle(switches[index]).borderTopWidth==='0px';
}});
document.querySelector('#result').textContent=JSON.stringify({{before,clicked,inside,stacked,aligned}});
</script></html>'''
        with tempfile.TemporaryDirectory(prefix="flowdetect-ocr-toggle-") as temporary:
            fixture = Path(temporary) / "toggle.html"
            fixture.write_text(fixture_html, encoding="utf-8")
            args = [browser, "--headless", "--disable-gpu", "--no-first-run",
                    "--no-default-browser-check", "--window-size=380,500",
                    "--virtual-time-budget=2500", f'--user-data-dir={Path(temporary) / "profile"}']
            completed = subprocess.run(args + ["--dump-dom", fixture.as_uri()], capture_output=True,
                                       timeout=30, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            output = completed.stdout.decode("utf-8", errors="replace")
            match = re.search(r'<pre id="result">(.*?)</pre>', output, re.S)
            self.assertIsNotNone(match, completed.stderr.decode(errors="replace")[-1000:])
            result = json.loads(html.unescape(match.group(1)))
            self.assertEqual(result, {"before": [True, False], "clicked": True, "inside": True,
                                      "stacked": True, "aligned": True})

            screenshot = os.environ.get("FLOWDETECT_OCR_TOGGLE_SCREENSHOT")
            if screenshot:
                subprocess.run(args[:-1] + [f'--user-data-dir={Path(temporary) / "visual-profile"}',
                                f"--screenshot={screenshot}", fixture.as_uri()], capture_output=True,
                               timeout=30, check=True,
                               creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))

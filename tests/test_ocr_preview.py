"""Browser regression for OCR guides (uses an installed Chrome/Edge, no npm deps)."""

import html
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "tauri_gerador" / "web"


def browser_path():
    candidates = [os.environ.get("FLOWDETECT_TEST_BROWSER")]
    for base in (os.environ.get("PROGRAMFILES"), os.environ.get("PROGRAMFILES(X86)")):
        if base:
            candidates += [str(Path(base) / relative) for relative in (
                "Google/Chrome/Application/chrome.exe",
                "Microsoft/Edge/Application/msedge.exe",
            )]
    candidates += [shutil.which(name) for name in ("chromium", "chromium-browser", "google-chrome")]
    return next((path for path in candidates if path and Path(path).is_file()), None)


def preview_functions():
    # Exercise production functions with a real NodeList and layout engine.
    # Top-level function closing braces in main.js are at column zero.
    source = (WEB / "main.js").read_text(encoding="utf-8-sig")
    names = (
        "parseNumber", "normalizeTransitionDelay", "formatTransitionDelayValue",
        "normalizeStringValue", "normalizeRecognitionImagePath", "recognitionPreviewFileName",
        "renderRecognitionPreviewCardState", "renderRecognitionPreviewPanel",
        "setRecognitionPreviewCardState", "recognitionPreviewImageMetrics",
        "offsetToPreviewPercent", "relativeOcrOverlayStyle", "clickTargetOverlayStyle",
        "ocrTargetRelativeFromLayout", "renderRelativeOcrPreviewOverlay",
        "splitOcrTargetText", "ocrTargetCountFromText", "ocrTargetCountFromContainer",
        "normalizeOcrTargetAction", "normalizeOcrTargetFailureAction", "ocrTargetMatchNeedsBlock",
        "ocrTargetLayoutsFromContainer", "renderOcrTargetRows",
        "renderOcrTargetOnlyPreview", "syncOcrActionPreviewGeometryFromMain",
        "updateRelativeOcrPreviewOverlay",
    )
    pieces = []
    for name in names:
        match = re.search(r"^function " + re.escape(name) + r"\(.*?^}", source, re.M | re.S)
        if not match:
            raise AssertionError(f"Missing production function: {name}")
        pieces.append(match.group())
    for name in ("escapeHtml", "OCR_TARGET_COLORS"):
        pieces.append(re.search(r"^const " + name + r" =.*?;\s*$", source, re.M | re.S).group())
    return "\n".join(pieces)


SCENARIO = r"""
const relative = {side: 'livre', width: 136, height: 27, offsetX: 0, offsetY: -21};
const click = {offsetX: 20, offsetY: 5};
const layouts = [{}, {offsetX: -39, offsetY: 2, width: 57, height: 23}];
const imageSource = window.fixtureImage || 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="159" height="74">' +
  '<rect width="159" height="74" fill="#efefef"/>' +
  '<text x="12" y="21" font-family="serif" font-size="12" font-weight="bold">Natureza de rendimento</text>' +
  '<text x="22" y="43" font-family="serif" font-size="12">Codigo</text>' +
  '<rect x="80" y="29" width="50" height="20" fill="white" stroke="#bbb"/>' +
  '<text x="91" y="43" font-family="serif" font-size="12">17099</text></svg>');
const card = document.querySelector('#fixture');
card.innerHTML = `<div hidden id="fields">${renderOcrTargetRows('data-tree-field', 'data-action', 'Natureza de\nCodigo', layouts)}</div>`;
for (const [name, value] of Object.entries({
  relativeOcrSide: relative.side, relativeOcrWidth: relative.width, relativeOcrHeight: relative.height,
  relativeOcrOffsetX: relative.offsetX, relativeOcrOffsetY: relative.offsetY,
  clickOffsetX: click.offsetX, clickOffsetY: click.offsetY,
})) {
  const input = document.createElement('input');
  input.type = 'hidden'; input.dataset.treeField = name; input.value = value; card.append(input);
}
card.insertAdjacentHTML('beforeend', `<section id="main-preview"><h3>Busca</h3>${renderRecognitionPreviewPanel('fixture', {
  overlay: renderRelativeOcrPreviewOverlay(relative, click, 2, layouts),
})}</section><section id="actions-preview"><h3>Acoes por OCR</h3>${[0, 1].map(index => `
  <section class="ocr-target-action-row" data-ocr-target-action-row data-ocr-target-action-index="${index}">
    <strong>OCR ${index + 1}: ${index ? 'Codigo' : 'Natureza de rendimento'}</strong>
    <div class="ocr-target-action-preview">${renderRecognitionPreviewPanel('fixture', {
      overlay: renderOcrTargetOnlyPreview(relative, click, layouts, index),
    })}</div>
  </section>`).join('')}</section>`);
card.querySelectorAll('[data-recognition-preview-card]').forEach(preview =>
  setRecognitionPreviewCardState(preview, {status: 'ready', imagePath: 'fixture', src: imageSource}));
const result = {checks: [], errors: [], measurements: []};
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const near = (actual, expected, message) => assert(Math.abs(actual - expected) < 0.6,
  `${message}: ${actual.toFixed(3)} != ${expected.toFixed(3)}`);
const pause = () => new Promise(resolve => setTimeout(resolve, 250));
function measure(preview) {
  const image = preview.querySelector('img').getBoundingClientRect();
  return [...preview.querySelectorAll('[data-relative-ocr-target]')].map(target => {
    const rect = target.getBoundingClientRect();
    return {index: Number(target.dataset.ocrTargetIndex),
      x: ((rect.left + rect.width / 2 - image.left) / image.width - 0.5) * 159,
      y: ((rect.top + rect.height / 2 - image.top) / image.height - 0.5) * 74,
      width: rect.width / image.width * 159, height: rect.height / image.height * 74,
      color: getComputedStyle(target).borderTopColor};
  });
}
function checkActions(label, expected) {
  const measurements = [];
  card.querySelectorAll('[data-ocr-target-action-row]').forEach((row, index) => {
    const bounds = measure(row);
    assert(bounds.length === 1 && bounds[0].index === index, `${label}: one guide per OCR`);
    for (const key of ['x', 'y', 'width', 'height']) near(bounds[0][key], expected[index][key], `${label} OCR ${index + 1} ${key}`);
    assert(row.querySelectorAll('[data-click-target-point]').length === 1, `${label}: click marker`);
    const image = row.querySelector('img').getBoundingClientRect();
    const marker = row.querySelector('[data-click-target-point]').getBoundingClientRect();
    near(((marker.left + marker.width / 2 - image.left) / image.width - 0.5) * 159, 20, `${label}: click X`);
    near(((marker.top + marker.height / 2 - image.top) / image.height - 0.5) * 74, 5, `${label}: click Y`);
    measurements.push(bounds[0]);
  });
  assert(measurements[0].color !== measurements[1].color, `${label}: distinct colors`);
  result.measurements.push({label, targets: measurements}); result.checks.push(label);
}
(async () => {
  try {
    await Promise.all([...card.querySelectorAll('img')].map(img => img.decode()));
    updateRelativeOcrPreviewOverlay(card);
    await pause();
    const expected = [{x: 0, y: -21, width: 136, height: 27}, {x: -39, y: 2, width: 57, height: 23}];
    checkActions('loaded image', expected);
    const main = measure(document.querySelector('#main-preview'));
    result.measurements.push({label: 'Busca', targets: main});
    for (const [index, target] of main.entries()) for (const key of ['x', 'y', 'width', 'height'])
      near(target[key], expected[index][key], `Busca OCR ${index + 1} ${key}`);
    assert(main[0].color !== main[1].color, 'Busca: each OCR keeps its own color');
    document.querySelector('#main-preview').hidden = true;
    card.style.transform = 'scale(0.65)';
    document.querySelector('#actions-preview').style.width = '150px';
    updateRelativeOcrPreviewOverlay(card);
    await pause();
    checkActions('hidden Busca and resized card with zoom', expected);
    card.querySelector('[data-tree-field="relativeOcrWidth"]').value = 120;
    card.querySelector('[data-tree-field="relativeOcrOffsetY"]').value = -18;
    card.querySelectorAll('[data-ocr-target-width]')[1].value = 60;
    updateRelativeOcrPreviewOverlay(card);
    await pause();
    checkActions('edited guides', [{x: 0, y: -18, width: 120, height: 27}, {x: -39, y: 2, width: 60, height: 23}]);
    card.querySelector('[data-tree-field="relativeOcrWidth"]').value = 136;
    card.querySelector('[data-tree-field="relativeOcrOffsetY"]').value = -21;
    card.querySelectorAll('[data-ocr-target-width]')[1].value = 57;
    card.style.transform = ''; document.querySelector('#main-preview').hidden = false;
    document.querySelector('#actions-preview').style.width = '';
    updateRelativeOcrPreviewOverlay(card);
    await pause();
  } catch (error) { result.errors.push(error.stack || String(error)); }
  document.querySelector('#result').textContent = JSON.stringify(result);
})();
"""


class OcrPreviewBrowserTest(unittest.TestCase):
    def test_guides_match_reference_after_load_resize_and_edit(self):
        browser = browser_path()
        if not browser:
            self.skipTest("Install Chrome/Edge or set FLOWDETECT_TEST_BROWSER")
        with tempfile.TemporaryDirectory(prefix="flowdetect-preview-") as temporary:
            artifacts = Path(os.environ.get("FLOWDETECT_PREVIEW_ARTIFACT_DIR", temporary))
            artifacts.mkdir(parents=True, exist_ok=True)
            fixture = artifacts / "preview.html"
            fixture.write_text(
                '<!doctype html><meta charset="utf-8"><style>' + (WEB / "style.css").read_text(encoding="utf-8-sig") +
                '\n*,*::before,*::after{transition:none!important;animation:none!important}'
                'body{margin:24px;overflow:auto;background:#07111f} #fixture{display:flex;align-items:flex-start;gap:30px;width:700px;'
                'max-height:none;height:auto;position:relative;overflow:visible;transform-origin:top left;padding:20px}'
                '#main-preview,#actions-preview{width:290px;flex-shrink:0} #actions-preview{display:grid;gap:14px}'
                '#main-preview[hidden]{display:none} h3{margin:0 0 12px} #result{display:none}</style>'
                '<div class="command-tree-card is-inline-expanded" id="fixture"></div><pre id="result"></pre><script>' +
                'window.onerror = message => {document.querySelector("#result").textContent = JSON.stringify({errors:[message]});};\n' +
                preview_functions() + '\n' + SCENARIO + '</script>', encoding="utf-8")
            completed = subprocess.run([
                browser, "--headless", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
                f"--user-data-dir={Path(temporary) / 'profile'}", "--window-size=900,650",
                "--virtual-time-budget=4000", "--dump-dom", f"--screenshot={artifacts / 'preview.png'}", fixture.as_uri(),
            ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=40,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            dom = completed.stdout.decode("utf-8", errors="replace")
            match = re.search(r'<pre id="result">(.*?)</pre>', dom, re.S)
            self.assertTrue(match and match.group(1), completed.stderr.decode(errors="replace")[-2000:])
            result = json.loads(html.unescape(match.group(1)))
            (artifacts / "result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
            self.assertEqual(result["errors"], [], "\n".join(result["errors"]))
            self.assertEqual(len(result["checks"]), 3)


if __name__ == "__main__":
    unittest.main()

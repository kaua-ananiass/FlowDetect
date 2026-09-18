"""Real-browser checks for creation and layout animations at map zoom levels."""

import html
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import unittest

from test_ocr_preview import WEB, browser_path


def animation_functions():
    source = (WEB / "main.js").read_text(encoding="utf-8-sig")
    functions = []
    for name in (
        "normalizeCommandMapZoom", "captureCommandMapCardPositions", "animateCommandMapLayoutShift",
    ):
        match = re.search(r"^function " + re.escape(name) + r"\(.*?^}", source, re.M | re.S)
        if not match:
            raise AssertionError(f"Missing production function: {name}")
        functions.append(match.group())
    return "\n".join(functions)


SCENARIO = r"""
const commandMapList = document.querySelector('#map');
const state = {commandMapZoom: 1};
const bursts = [];
const scheduleCommandConnectorLayoutBurst = duration => bursts.push(duration);
// Flush animation setup explicitly; Chromium still calculates transforms and
// runs production CSS/WAAPI animations, without depending on headless RAF cadence.
const frames = [];
window.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
const flushFrames = () => { while (frames.length) frames.shift()(performance.now()); };
const result = {checks: [], errors: [], measurements: []};
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const near = (actual, expected, tolerance, message) => assert(Math.abs(actual - expected) <= tolerance,
  `${message}: ${actual} != ${expected}`);
const pause = () => new Promise(resolve => setTimeout(resolve, 30));
const bounds = element => {
  const rect = element.getBoundingClientRect();
  return {x: rect.left, y: rect.top, width: rect.width, height: rect.height,
    centerX: rect.left + rect.width / 2, centerY: rect.top + rect.height / 2};
};
(async () => {
  try {
    const oldSlot = document.querySelector('#existing-slot');
    const oldCard = document.querySelector('#existing-card');
    const newSlot = document.querySelector('#created-slot');
    const newCard = document.querySelector('#created-card');
    for (const zoom of [0.4, 1, 1.8]) {
      state.commandMapZoom = zoom;
      commandMapList.style.setProperty('--command-map-zoom', zoom);
      oldSlot.style.left = '100px'; oldSlot.style.top = '80px';
      newCard.classList.remove('is-newly-created');
      newCard.getBoundingClientRect();
      const finalBounds = bounds(newCard);
      newCard.classList.add('is-newly-created');
      const pop = newCard.getAnimations().find(animation => animation.animationName === 'commandCardCreatedIn');
      assert(pop, `zoom ${zoom}: production pop animation exists`);
      pop.pause(); pop.currentTime = 0;
      const startBounds = bounds(newCard);
      near(startBounds.centerX, finalBounds.centerX, 0.7, `zoom ${zoom}: pop stays at new block X`);
      near(startBounds.centerY - finalBounds.centerY, 6 * zoom, 0.7, `zoom ${zoom}: pop has only local Y offset`);
      near(startBounds.width / finalBounds.width, 0.96, 0.005, `zoom ${zoom}: subtle starting scale`);
      assert(Number(getComputedStyle(newSlot).zIndex) > Number(getComputedStyle(oldSlot).zIndex),
        `zoom ${zoom}: new block appears above ordinary blocks`);
      const editorSlot = document.querySelector('#editor-slot');
      assert(Number(getComputedStyle(editorSlot).zIndex) > Number(getComputedStyle(oldSlot).zIndex),
        `zoom ${zoom}: creation panel appears above ordinary blocks`);
      pop.finish(); await pause();
      const poppedBounds = bounds(newCard);
      near(poppedBounds.x, finalBounds.x, 0.7, `zoom ${zoom}: final pop X`);
      near(poppedBounds.y, finalBounds.y, 0.7, `zoom ${zoom}: final pop Y`);
      newCard.classList.remove('is-newly-created');
      assert(getComputedStyle(newCard).transform === 'none', `zoom ${zoom}: pop leaves no transform`);
      result.checks.push(`pop at ${zoom}`);

      const snapshot = captureCommandMapCardPositions();
      const initial = bounds(oldCard);
      oldSlot.style.left = '660px'; oldSlot.style.top = '110px';
      const destination = bounds(oldCard);
      animateCommandMapLayoutShift(snapshot, {mode: 'slide'});
      flushFrames();
      const shift = oldCard.__commandMapShiftAnimation;
      assert(shift, `zoom ${zoom}: existing block gets layout animation`);
      shift.pause(); shift.currentTime = 0;
      const shiftedStart = bounds(oldCard);
      // Compare centers because the production slide starts at scale(.996).
      near(shiftedStart.centerX, initial.centerX, 0.8, `zoom ${zoom}: initial shift X preserves screen position`);
      near(shiftedStart.centerY, initial.centerY, 0.8, `zoom ${zoom}: initial shift Y preserves screen position`);
      shift.finish(); await pause();
      const shiftedEnd = bounds(oldCard);
      near(shiftedEnd.x, destination.x, 0.8, `zoom ${zoom}: shift ends at new X`);
      near(shiftedEnd.y, destination.y, 0.8, `zoom ${zoom}: shift ends at new Y`);
      assert(oldCard.style.transform === '' && oldCard.__commandMapShiftAnimation === null,
        `zoom ${zoom}: shift cleans temporary state`);
      assert(getComputedStyle(oldCard).transform === 'matrix(1, 0, 0, 1, 0, 0)'
        || getComputedStyle(oldCard).transform === 'none', `zoom ${zoom}: no residual shift`);
      result.measurements.push({zoom, startBounds, finalBounds, initial, shiftedStart, destination, shiftedEnd});
      result.checks.push(`layout shift at ${zoom}`);
    }
    assert(bursts.length === 3 && bursts.every(duration => duration >= 360),
      'connector layout stays scheduled throughout all three shifts');
  } catch (error) { result.errors.push(error.stack || String(error)); }
  document.querySelector('#result').textContent = JSON.stringify(result);
})();
"""


class CommandMapInsertionBrowserTest(unittest.TestCase):
    def test_pop_and_layout_shift_keep_correct_position_at_every_zoom(self):
        browser = browser_path()
        if not browser:
            self.skipTest("Install Chrome/Edge or set FLOWDETECT_TEST_BROWSER")
        with tempfile.TemporaryDirectory(prefix="flowdetect-insertion-") as temporary:
            artifacts = Path(os.environ.get("FLOWDETECT_INSERTION_ARTIFACT_DIR", temporary))
            artifacts.mkdir(parents=True, exist_ok=True)
            fixture = artifacts / "insertion.html"
            fixture.write_text(
                '<!doctype html><meta charset="utf-8"><style>'
                + (WEB / "style.css").read_text(encoding="utf-8-sig")
                + '\nbody{margin:0;background:#07111f} #map{height:700px;width:1500px;'
                '--command-map-stage-lift:0px;padding:0;overflow:visible}'
                '.command-map-tree{padding:0;gap:0} .command-map-tree-stage{width:2200px;height:700px}'
                '.command-flow-segment{padding:0;margin:0;transform:none!important}'
                '.command-tree-card{width:200px!important;height:120px!important;min-height:0!important;'
                'padding:10px!important;box-sizing:border-box;transition:none!important}'
                '#result{display:none}</style>'
                '<div class="command-map-list is-tree-view" id="map"><div class="command-map-tree">'
                '<div class="command-map-tree-stage">'
                '<div class="command-map-tree-node-slot" id="existing-slot" style="left:100px;top:80px">'
                '<div class="command-flow-segment" data-client-key="existing">'
                '<article class="command-tree-card" id="existing-card">Existing</article></div></div>'
                '<div class="command-map-tree-node-slot" id="created-slot" style="left:1200px;top:80px">'
                '<div class="command-flow-segment" data-client-key="new">'
                '<article class="command-tree-card" id="created-card">New block</article></div></div>'
                '<div class="command-map-tree-node-slot" id="editor-slot" style="left:1550px;top:80px">'
                '<div class="insert-card-panel">Create block</div></div>'
                '</div></div></div><pre id="result"></pre><script>'
                'window.onerror=message=>{document.querySelector("#result").textContent='
                'JSON.stringify({errors:[message]});};\n'
                + animation_functions() + '\n' + SCENARIO + '</script>', encoding="utf-8")
            completed = subprocess.run([
                browser, "--headless", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
                f"--user-data-dir={Path(temporary) / 'profile'}", "--window-size=1500,800",
                "--virtual-time-budget=4000", "--dump-dom", fixture.as_uri(),
            ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=40,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            dom = completed.stdout.decode("utf-8", errors="replace")
            match = re.search(r'<pre id="result">(.*?)</pre>', dom, re.S)
            self.assertTrue(match and match.group(1), completed.stderr.decode(errors="replace")[-2000:])
            result = json.loads(html.unescape(match.group(1)))
            (artifacts / "result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
            self.assertEqual(result["errors"], [], "\n".join(result["errors"]))
            self.assertEqual(len(result["checks"]), 6)


if __name__ == "__main__":
    unittest.main()

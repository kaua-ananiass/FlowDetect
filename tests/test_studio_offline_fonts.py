import html
from pathlib import Path
import re
import subprocess
import tempfile
import unittest

from tests.test_ocr_preview import browser_path


WEB = Path(__file__).resolve().parents[1] / "tauri_gerador" / "web"
FONTS = (
    ("Montserrat", "montserrat-latin.woff2", 700),
    ("Plus Jakarta Sans", "plus-jakarta-sans-latin.woff2", 600),
    ("Cormorant Garamond", "cormorant-garamond-latin.woff2", 700),
)


class StudioOfflineFontsTest(unittest.TestCase):
    def test_studio_pages_use_packaged_fonts(self):
        stylesheet = (WEB / "vendor/fonts/fonts.css").read_text(encoding="utf-8")
        for family, filename, _ in FONTS:
            self.assertIn(f'font-family: "{family}"', stylesheet)
            self.assertIn(filename, stylesheet)
            self.assertTrue((WEB / "vendor/fonts" / filename).is_file())

        for page in ("index.html", "design-system.html"):
            source = (WEB / page).read_text(encoding="utf-8")
            self.assertIn('./vendor/fonts/fonts.css', source)
            self.assertNotIn('fonts.googleapis.com', source)
            self.assertNotIn('fonts.gstatic.com', source)

    def test_all_families_load_without_network(self):
        browser = browser_path()
        if not browser:
            self.skipTest("Chrome/Edge unavailable")

        stylesheet_url = (WEB / "vendor/fonts/fonts.css").as_uri()
        fixture_html = f'''<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="{stylesheet_url}"><pre id="result">waiting</pre>
<script>
Promise.all([
  document.fonts.load('700 18px "Montserrat"'),
  document.fonts.load('600 18px "Plus Jakarta Sans"'),
  document.fonts.load('700 18px "Cormorant Garamond"')
]).then(groups => {{
  document.querySelector('#result').textContent = JSON.stringify(groups.map(group =>
    group.length > 0 && group.every(face => face.status === 'loaded')));
}}).catch(error => {{ document.querySelector('#result').textContent = String(error); }});
</script>'''
        with tempfile.TemporaryDirectory(prefix="flowdetect-offline-fonts-") as temporary:
            fixture = Path(temporary) / "fonts.html"
            fixture.write_text(fixture_html, encoding="utf-8")
            completed = subprocess.run([
                browser, "--headless", "--disable-gpu", "--no-first-run",
                "--no-default-browser-check", "--disable-background-networking",
                "--host-resolver-rules=MAP * ~NOTFOUND", "--virtual-time-budget=3000",
                f'--user-data-dir={Path(temporary) / "profile"}',
                "--dump-dom", fixture.as_uri(),
            ], capture_output=True, timeout=30,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            output = completed.stdout.decode("utf-8", errors="replace")
            result = re.search(r'<pre id="result">(.*?)</pre>', output, re.S)
            self.assertIsNotNone(result, completed.stderr.decode(errors="replace")[-1000:])
            self.assertEqual(html.unescape(result.group(1)), "[true,true,true]")

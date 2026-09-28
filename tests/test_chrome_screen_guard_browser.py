"""Exercise screen settings and waiting controls in a real browser."""
import html
import json
from pathlib import Path
import re
import subprocess
import tempfile
import unittest
from tests.test_ocr_preview import browser_path

ROOT = Path(__file__).resolve().parents[1] / "flowdetect_chrome"
STUB = r"""
const db={flowdetectChromeAutomations:[{id:'test',schema:'flowdetect_chrome_automation',version:3,
  automation:{nome:'Teste'},steps:[{type:'ocr_text',text:'Empresa'}]}]};
const listeners=[];
let ready=false;
let started=0;
window.chrome={storage:{local:{get:async key=>({[key]:db[key]}),set:async items=>{
  Object.assign(db,items);for(const callback of listeners) callback(Object.fromEntries(
    Object.entries(items).map(([key,value])=>[key,{newValue:value}])),'local');
}},onChanged:{addListener:fn=>listeners.push(fn)}},
runtime:{sendMessage:async message=>{
  if(message.type==='flowdetect-screen-ready') return {ok:true,ready,reason:ready?'Tela da automacao identificada.':'Aguardando tela da automacao.'};
  if(message.type==='flowdetect-start') started++;
  return {ok:true,version:'0.2.45',activeRunIds:[]};
}},
tabs:{query:async()=>[{id:42,url:'https://site.test/page?id=1'}]}};
"""
SCENARIO = r"""
(async()=>{
  const checks=[];const errors=[];
  const pause=()=>new Promise(resolve=>setTimeout(resolve,30));
  const check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name)};
  try{
    await pause();
    check('settings initially collapsed',!document.querySelector('details').open);
    document.querySelector('.screen-guard-current').click();await pause();
    check('current tab fills normalized URL',document.querySelector('.screen-guard-url').value==='https://site.test/page');
    document.querySelector('.screen-guard-text').value=' Empresa ';
    document.querySelector('.screen-guard-form').requestSubmit();await pause();
    check('saved per automation and rendered',db.flowdetectChromeAutomations[0].screen_guard.text==='Empresa' &&
      document.querySelector('.screen-guard-state').textContent==='Ativa');
    check('wrong tab blocks before any execution',document.querySelector('.run-automation').disabled && started===0 &&
      document.querySelector('.execution').hidden && !document.querySelector('.screen-guard-hint').hidden);
    ready=true;refreshScreenGuards();await pause();
    check('correct tab releases execute',!document.querySelector('.run-automation').disabled);
    ready=false;refreshScreenGuards();
    check('tab change immediately disables execute',document.querySelector('.run-automation').disabled);
    await pause();
    updateRun({automationId:'test',id:'waiting',status:'waiting_screen',currentStep:0,totalSteps:1,logs:[]});
    check('waiting blocks execution and permits stop',document.querySelector('.run-automation').disabled &&
      !document.querySelector('.stop-button').hidden && document.querySelector('fieldset').disabled);
    check('waiting message shown with zero progress',document.querySelector('.execution-summary').textContent==='Aguardando tela da automacao' &&
      document.querySelector('.execution-percent').textContent==='0%');
    updateRun({automationId:'test',status:'stopped',logs:[]});
    ready=true;refreshScreenGuards();await pause();
    check('stopped execution can be configured again',!document.querySelector('.run-automation').disabled &&
      !document.querySelector('fieldset').disabled);
  }catch(error){errors.push(String(error.stack||error))}
  document.querySelector('#result').textContent=JSON.stringify({checks,errors});
})();
"""

class ChromeScreenGuardBrowserTest(unittest.TestCase):
    def test_settings_and_waiting_controls(self):
        browser = browser_path()
        if not browser:
            self.skipTest("Chrome/Edge unavailable")
        page = (ROOT / "sidepanel.html").read_text(encoding="utf-8")
        page = re.sub(r'<script src="[^"]+"></script>', '', page)
        page = page.replace('</body>', '<pre id="result"></pre><script>' + STUB +
                            (ROOT / "sidepanel.js").read_text(encoding="utf-8") + SCENARIO + '</script></body>')
        with tempfile.TemporaryDirectory(prefix="flowdetect-screen-guard-") as temporary:
            fixture = Path(temporary) / "panel.html"
            fixture.write_text(page, encoding="utf-8")
            completed = subprocess.run([browser, '--headless', '--disable-gpu', '--no-first-run',
                '--no-default-browser-check', f'--user-data-dir={Path(temporary) / "profile"}',
                '--virtual-time-budget=4000', '--dump-dom', fixture.as_uri()],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=40,
                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            match = re.search(r'<pre id="result">(.*?)</pre>', completed.stdout.decode('utf-8', errors='replace'), re.S)
            self.assertTrue(match and match.group(1), completed.stderr.decode(errors='replace')[-2000:])
            result = json.loads(html.unescape(match.group(1)))
            self.assertEqual(result['errors'], [])
            self.assertEqual(len(result['checks']), 9)

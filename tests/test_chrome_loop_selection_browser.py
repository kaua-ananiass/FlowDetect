import html
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import unittest
from tests.test_ocr_preview import browser_path


ROOT = Path(__file__).resolve().parents[1] / "flowdetect_chrome"
STUB = r"""
const db={flowdetectChromeAutomations:[{id:'loop-test',schema:'flowdetect_chrome_automation',version:3,
  automation:{nome:'Empresas'},steps:[{type:'data_source',name:'CNPJ',
    values:['11.111.111/0001-11','22.222.222/0001-22','33.333.333/0001-33','44.444.444/0001-44'],
    rows:[{CNPJ:'11.111.111/0001-11',Empresa:'Primeira'},
      {CNPJ:'22.222.222/0001-22',Empresa:'Segunda'},
      {CNPJ:'33.333.333/0001-33',Empresa:'Terceira'},
      {CNPJ:'44.444.444/0001-44',Empresa:'Quarta'}]}]}]};
const listeners=[];let started=null;let confirmed=false;
window.confirm=()=>{confirmed=true;return true};
window.chrome={storage:{local:{get:async key=>({[key]:db[key]}),set:async items=>{
  Object.assign(db,items);for(const callback of listeners) callback(Object.fromEntries(
    Object.entries(items).map(([key,value])=>[key,{newValue:value}])),'local');
},remove:async()=>{}},onChanged:{addListener:fn=>listeners.push(fn)}},
runtime:{sendMessage:async message=>{
  if(message.type==='flowdetect-runtime-info') return {ok:true,version:'0.2.58',activeRunIds:[]};
  if(message.type==='flowdetect-screen-ready') return {ok:true,ready:true};
  if(message.type==='flowdetect-start') {started=message;return {ok:true}};
  return {ok:true};
}},tabs:{query:async()=>[{id:42,url:'https://site.test/',status:'complete'}]}};
"""
SCENARIO = r"""
(async()=>{
  const checks=[];const errors=[];
  const pause=()=>new Promise(resolve=>setTimeout(resolve,40));
  const check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name)};
  try{
    await pause();
    let editor=document.querySelector('.loop-edit-settings');
    check('loop editor visible',editor && !editor.hidden);
    editor.open=true;
    const list=document.querySelector('.automation-list');
    list.scrollTop=list.scrollHeight;
    await pause();
    const bottom=list.getBoundingClientRect().bottom;
    const metrics={scrollHeight:list.scrollHeight,clientHeight:list.clientHeight,scrollTop:list.scrollTop,
      bottom,footer:editor.querySelector('.loop-edit-footer').getBoundingClientRect().bottom,
      run:document.querySelector('.run-automation').getBoundingClientRect().bottom};
    check('loop footer and run button reachable by scrolling '+JSON.stringify(metrics),
      list.scrollHeight>list.clientHeight &&
      editor.querySelector('.loop-edit-footer').getBoundingClientRect().bottom<=bottom &&
      document.querySelector('.run-automation').getBoundingClientRect().bottom<=bottom);
    list.scrollTop=0;
    for(let index=0;index<4;index++) editor.querySelector('.loop-edit-row input:checked').click();
    check('no companies selected blocks execution',document.querySelector('.run-automation').disabled &&
      editor.querySelector('.loop-edit-count').textContent==='0/4 ativas');
    editor.querySelector('.loop-include-all').click();
    check('include all restores execution',!document.querySelector('.run-automation').disabled &&
      editor.querySelector('.loop-edit-count').textContent==='4/4 ativas');
    const search=editor.querySelector('.loop-edit-search');
    search.value='333';search.dispatchEvent(new Event('input',{bubbles:true}));
    check('search narrows to one company',editor.querySelectorAll('.loop-edit-row').length===1);
    editor.querySelector('.loop-edit-row input').click();
    check('count and start list reflect exclusion',editor.querySelector('.loop-edit-count').textContent==='3/4 ativas' &&
      document.querySelectorAll('.loop-start-choice option').length===3);
    check('excluded row is visibly marked',editor.querySelector('.loop-edit-row').classList.contains('is-excluded'));
    editor.querySelector('.loop-save-exclusions').click();
    renderAutomations();
    editor=document.querySelector('.loop-edit-settings');
    check('unsaved choices survive a popup refresh',editor.querySelector('.loop-edit-count').textContent==='3/4 ativas' &&
      editor.querySelector('.loop-save-exclusions').checked);
    document.querySelector('.run-automation').click();await pause();
    check('user confirms skipped row',confirmed);
    check('worker receives aligned selected values and rows',started &&
      started.automation.steps[0].values.join(',')==='11.111.111/0001-11,22.222.222/0001-22,44.444.444/0001-44' &&
      started.automation.steps[0].rows.map(row=>row.Empresa).join(',')==='Primeira,Segunda,Quarta');
    check('worker receives original row indexes and skip log',started.loopIncludedIndices.join(',')==='0,1,3' &&
      started.loopExcludedRows[0].company==='Terceira');
    check('original automation stays intact and exclusions are saved',db.flowdetectChromeAutomations[0].steps[0].values.length===4 &&
      db.flowdetectChromeAutomations[0].ui.loopExcludedKeys.length===1);
    updateRun({automationId:'loop-test',status:'completed',currentStep:1,totalSteps:1,logs:[]});await pause();
    editor=document.querySelector('.loop-edit-settings');editor.open=true;
    editor.querySelector('.loop-include-all').click();
    editor.querySelector('.loop-save-exclusions').click();
    const again=editor.querySelector('.loop-edit-search');
    again.value='222';again.dispatchEvent(new Event('input',{bubbles:true}));
    editor.querySelector('.loop-edit-row input').click();
    document.querySelector('.run-automation').click();await pause();
    check('one-time exclusion is not saved',db.flowdetectChromeAutomations[0].ui.loopExcludedKeys.length===0);
    check('second run still skips the selected CNPJ',started.automation.steps[0].values.length===3 &&
      !started.automation.steps[0].values.includes('22.222.222/0001-22'));
  }catch(error){errors.push(String(error.stack||error))}
  document.querySelector('#result').textContent=JSON.stringify({checks,errors});
})();
"""
VISUAL_SCENARIO = r"""
(async()=>{
  await new Promise(resolve=>setTimeout(resolve,80));
  const editor=document.querySelector('.loop-edit-settings');editor.open=true;
  const search=editor.querySelector('.loop-edit-search');
  search.value='333';search.dispatchEvent(new Event('input',{bubbles:true}));
  editor.querySelector('.loop-edit-row input').click();
  search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));
  document.querySelector('.automation-list').scrollTop=10000;
})();
"""


class ChromeLoopSelectionBrowserTest(unittest.TestCase):
    def test_excluding_a_cnpj_before_running(self):
        browser = browser_path()
        if not browser:
            self.skipTest("Chrome/Edge unavailable")
        page = (ROOT / "sidepanel.html").read_text(encoding="utf-8")
        page = page.replace('<link rel="stylesheet" href="sidepanel.css">',
                            '<style>' + (ROOT / "sidepanel.css").read_text(encoding="utf-8") + '</style>')
        page = re.sub(r'<script src="[^"]+"></script>', '', page)
        page = page.replace('</body>', '<pre id="result"></pre><script>' + STUB +
                            (ROOT / "sidepanel.js").read_text(encoding="utf-8") + SCENARIO + '</script></body>')
        with tempfile.TemporaryDirectory(prefix="flowdetect-loop-selection-") as temporary:
            fixture = Path(temporary) / "panel.html"
            fixture.write_text(page, encoding="utf-8")
            completed = subprocess.run([browser, '--headless', '--disable-gpu', '--no-first-run',
                '--no-default-browser-check', f'--user-data-dir={Path(temporary) / "profile"}',
                '--window-size=380,500', '--virtual-time-budget=4000', '--dump-dom', fixture.as_uri()],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=40,
                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            match = re.search(r'<pre id="result">(.*?)</pre>', completed.stdout.decode('utf-8', errors='replace'), re.S)
            self.assertTrue(match and match.group(1), completed.stderr.decode(errors='replace')[-2000:])
            result = json.loads(html.unescape(match.group(1)))
            self.assertEqual(result['errors'], [])
            self.assertEqual(len(result['checks']), 14)
            screenshot = os.environ.get("FLOWDETECT_LOOP_SCREENSHOT")
            if screenshot:
                fixture.write_text(page.replace(SCENARIO, VISUAL_SCENARIO), encoding="utf-8")
                subprocess.run([browser, '--headless', '--disable-gpu', '--no-first-run',
                    '--no-default-browser-check', f'--user-data-dir={Path(temporary) / "visual-profile"}',
                    '--window-size=380,660', '--virtual-time-budget=4000', f'--screenshot={screenshot}',
                    fixture.as_uri()], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=40,
                    creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0), check=True)

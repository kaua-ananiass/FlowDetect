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
    values:['00.000.805/0000-00','00.000.806/0000-00','00.000.807/0000-00','00.000.808/0000-00'],
    rows:[{CNPJ:'00.000.805/0000-00',Empresa:'Primeira'},
      {CNPJ:'00.000.806/0000-00',Empresa:'Segunda'},
      {CNPJ:'00.000.807/0000-00',Empresa:'Terceira'},
      {CNPJ:'00.000.808/0000-00',Empresa:'Quarta'}]}]}]};
const listeners=[];let started=null;let confirmed=false;let openedFolderPage=null;
window.confirm=()=>{confirmed=true;return true};
window.chrome={storage:{local:{get:async key=>({[key]:db[key]}),set:async items=>{
  Object.assign(db,items);for(const callback of listeners) callback(Object.fromEntries(
    Object.entries(items).map(([key,value])=>[key,{newValue:value}])),'local');
},remove:async()=>{}},onChanged:{addListener:fn=>listeners.push(fn)}},
runtime:{getURL:path=>'chrome-extension://test/'+path,sendMessage:async message=>{
  if(message.type==='flowdetect-runtime-info') return {ok:true,version:'0.2.58',activeRunIds:[]};
  if(message.type==='flowdetect-screen-ready') return {ok:true,ready:true};
  if(message.type==='flowdetect-start') {started=message;return {ok:true}};
  return {ok:true};
}},tabs:{query:async()=>[{id:42,url:'https://site.test/',status:'complete'}],
  create:async options=>{openedFolderPage=options.url;return {id:99}}}};
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
    check('start chooser names the company instead of showing only CNPJ',
      document.querySelector('.loop-start-choice option')?.textContent.includes('Primeira'));
    check('company leads each row and CNPJ remains visible',
      editor.querySelector('.loop-edit-row strong')?.textContent==='Primeira' &&
      editor.querySelector('.loop-edit-row small')?.textContent.includes('CNPJ 00.000.805/0000-00'));
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
    search.value='Terceira';search.dispatchEvent(new Event('input',{bubbles:true}));
    check('search finds company names',editor.querySelectorAll('.loop-edit-row').length===1);
    search.value='333';search.dispatchEvent(new Event('input',{bubbles:true}));
    check('search narrows to one company',editor.querySelectorAll('.loop-edit-row').length===1);
    editor.querySelector('.loop-exclude-filtered').click();
    check('bulk exclusion affects only search matches',editor.querySelector('.loop-edit-count').textContent==='3/4 ativas' &&
      editor.querySelector('.loop-edit-row').classList.contains('is-excluded'));
    editor.querySelector('.loop-include-filtered').click();
    check('bulk inclusion restores search matches',editor.querySelector('.loop-edit-count').textContent==='4/4 ativas' &&
      !editor.querySelector('.loop-edit-row').classList.contains('is-excluded'));
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
      started.automation.steps[0].values.join(',')==='00.000.805/0000-00,00.000.806/0000-00,00.000.808/0000-00' &&
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
      !started.automation.steps[0].values.includes('00.000.806/0000-00'));
    updateRun({automationId:'loop-test',status:'completed',currentStep:1,totalSteps:1,logs:[]});await pause();
    const downloads=document.querySelector('.download-settings');downloads.open=true;
    downloads.querySelector('.download-run-with-folder').click();await pause();
    const pending=Object.entries(db).find(([key])=>key.startsWith('flowdetectPendingFolderRun:'))?.[1];
    check('folder run opens the extension picker with aligned loop data '+JSON.stringify({openedFolderPage,pending}),
      openedFolderPage?.includes('download-launch.html?id=') && pending?.tabId===42 &&
      pending.automation.steps[0].values.length===4 &&
      pending.automation.steps[0].rows[0].Empresa==='Primeira');
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

LIVE_SETUP = r"""
db.flowdetectChromeAutomations=[{id:'fgts',schema:'flowdetect_chrome_automation',version:3,
  automation:{nome:'FGTS_GUIAS'},steps:[
    {type:'ocr_text',source_order:8,sequence:'pagina_3',text:'Competência de Apuração\n09/2026'},
    {type:'key_sequence',source_order:10,sequence:'pagina_3',keys:['ENTER']}
  ]}];
db.flowdetectChromeLastRun={id:'run-live',automationId:'fgts',automationName:'FGTS_GUIAS',
  status:'running',currentStep:2,totalSteps:18,currentIndex:1,lastBlockIndex:1,logs:[],
  recentSteps:[
    {serial:1,index:0,state:'routed',ocrChecks:[
      {text:'Competência de Apuração',state:'found'},
      {text:'09/2026',state:'not_found'}],route:'Indo para B10',
      message:'OCR 2 nao encontrou o texto: 09/2026.'},
    {serial:2,index:1,state:'running',message:'Executando o bloco de destino.'}
  ]};
"""

LIVE_SCENARIO = r"""
(async()=>{
  await new Promise(resolve=>setTimeout(resolve,120));
  const list=document.querySelector('.live-steps-list');
  const text=list?.innerText||'';
  const checks={
    focused:document.body.classList.contains('run-focused'),
    found:text.includes('OCR 1/2 · Encontrado: Competência de Apuração'),
    absent:text.includes('OCR 2/2 · Não encontrado: 09/2026'),
    route:text.includes('Indo para B10') && text.includes('Redirecionado'),
    visible:!!list && getComputedStyle(list).display!=='none',
    noHorizontalOverflow:document.documentElement.scrollWidth<=innerWidth+1
  };
  document.querySelector('#result').textContent=JSON.stringify(checks);
})();
"""


class ChromeLoopSelectionBrowserTest(unittest.TestCase):
    def test_live_panel_shows_ocr_result_and_destination(self):
        browser = browser_path()
        if not browser:
            self.skipTest("Chrome/Edge unavailable")
        page = (ROOT / "sidepanel.html").read_text(encoding="utf-8")
        page = page.replace('<link rel="stylesheet" href="sidepanel.css">',
                            '<style>' + (ROOT / "sidepanel.css").read_text(encoding="utf-8") + '</style>')
        page = re.sub(r'<script src="[^"]+"></script>', '', page)
        page = page.replace('</body>', '<pre id="result"></pre><script>' + STUB + LIVE_SETUP +
                            (ROOT / "sidepanel.js").read_text(encoding="utf-8") + LIVE_SCENARIO +
                            '</script></body>')
        with tempfile.TemporaryDirectory(prefix="flowdetect-live-panel-") as temporary:
            fixture = Path(temporary) / "panel.html"
            fixture.write_text(page, encoding="utf-8")
            completed = subprocess.run([browser, '--headless', '--disable-gpu', '--no-first-run',
                '--no-default-browser-check', f'--user-data-dir={Path(temporary) / "profile"}',
                '--window-size=380,660', '--virtual-time-budget=4000', '--dump-dom', fixture.as_uri()],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=40,
                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            match = re.search(r'<pre id="result">(.*?)</pre>', completed.stdout.decode('utf-8', errors='replace'), re.S)
            self.assertTrue(match and match.group(1), completed.stderr.decode(errors='replace')[-2000:])
            result = json.loads(html.unescape(match.group(1)))
            self.assertTrue(all(result.values()), result)

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
            self.assertEqual(len(result['checks']), 20)
            screenshot = os.environ.get("FLOWDETECT_LOOP_SCREENSHOT")
            if screenshot:
                fixture.write_text(page.replace(SCENARIO, VISUAL_SCENARIO), encoding="utf-8")
                subprocess.run([browser, '--headless', '--disable-gpu', '--no-first-run',
                    '--no-default-browser-check', f'--user-data-dir={Path(temporary) / "visual-profile"}',
                    '--window-size=380,660', '--virtual-time-budget=4000', f'--screenshot={screenshot}',
                    fixture.as_uri()], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=40,
                    creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0), check=True)

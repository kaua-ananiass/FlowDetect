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
ROUTE_ID = "11111111-1111-4111-8111-111111111111"
STUB = r"""
const local={['flowdetectPendingFolderRun:11111111-1111-4111-8111-111111111111']:{
  automation:{automation:{nome:'Guias FGTS'},steps:[{type:'data_source',values:['123'],rows:[{Empresa:'Exemplo'}]}]},
  tabId:42,startRow:1,loopIncludedIndices:[0],loopExcludedRows:[]}};
const folders={};let startedMessage=null;let activeTab=null;
const stage={name:'FlowDetect-Temporario',queryPermission:async()=> 'granted',isSameEntry:async()=>false,
  kind:'directory',
  getFileHandle:async()=>({getFile:async()=>({text:async()=> 'FlowDetect: pasta temporaria para guias da extensao.\n'})})};
const target={name:'Guias Outubro',queryPermission:async()=> 'granted'};let picks=[stage,target];
if(window.__preauthorized){folders.stage=stage;picks=[target]}
window.FlowDetectDownloadFolders={get:async key=>folders[key],put:async(key,value)=>{folders[key]=value}};
Object.defineProperty(window,'showDirectoryPicker',{configurable:true,value:async()=>picks.shift()});
window.chrome={storage:{local:{get:async key=>({[key]:local[key]}),set:async items=>Object.assign(local,items),
  remove:async key=>{delete local[key]}},onChanged:{addListener:()=>{}}},
  runtime:{sendMessage:async message=>{
    if(message.type==='flowdetect-runtime-info')return {ok:true,capabilities:['download_destination']};
    if(message.type==='flowdetect-start'){startedMessage=message;return {ok:true,run:{status:'completed'}}}
  }},tabs:{get:async()=>({id:42,windowId:5}),update:async(id)=>{activeTab=id}},
  downloads:{download:async()=>91,search:async()=>[{id:91,state:'complete'}]},
  windows:{update:async()=>{}}};
"""
SCENARIO = r"""
(async()=>{
  const checks=[];const errors=[];const pause=()=>new Promise(resolve=>setTimeout(resolve,40));
  const check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name)};
  try{
    await pause();
    check('shows automation name',document.querySelector('#automationName').textContent==='Guias FGTS');
    check('only one primary action is visible',document.querySelectorAll('button.primary').length===1);
    document.querySelector('#chooseFolder').click();await pause();
    check('one-time permission changes the same button to destination',
      document.querySelector('#chooseFolder').textContent.includes('Escolher pasta'));
    document.querySelector('#chooseFolder').click();await pause();
    check('choosing destination starts automatically',document.querySelector('#runStatus').textContent.includes('concluída'));
    check('original tab and selected destination are sent to worker',activeTab===42 && startedMessage?.tabId===42 &&
      /^[0-9a-f-]{36}$/i.test(startedMessage.downloadRouteId) &&
      folders[`destination:${startedMessage.downloadRouteId}`]?.name==='Guias Outubro');
    check('pending request is consumed after completion',
      !local['flowdetectPendingFolderRun:11111111-1111-4111-8111-111111111111']);
  }catch(error){errors.push(String(error.stack||error))}
  document.querySelector('#result').textContent=JSON.stringify({checks,errors});
})();
"""
VISUAL_SCENARIO = r"""
(async()=>{
  await new Promise(resolve=>setTimeout(resolve,60));
})();
"""
PREAUTHORIZED_SCENARIO = r"""
(async()=>{
  const checks=[];const errors=[];const pause=()=>new Promise(resolve=>setTimeout(resolve,40));
  const check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name)};
  try{
    await pause();
    check('authorized user sees one folder action',
      document.querySelector('#chooseFolder').textContent.includes('Escolher pasta') &&
      !document.querySelector('#chooseFolder').disabled);
    document.querySelector('#chooseFolder').click();await pause();
    check('one folder choice starts the automation',startedMessage?.tabId===42 && picks.length===0);
    check('destination is selected for this run',
      folders[`destination:${startedMessage.downloadRouteId}`]?.name==='Guias Outubro');
    check('run request was consumed',!local['flowdetectPendingFolderRun:11111111-1111-4111-8111-111111111111']);
  }catch(error){errors.push(String(error.stack||error))}
  document.querySelector('#result').textContent=JSON.stringify({checks,errors});
})();
"""


class DownloadLaunchBrowserTest(unittest.TestCase):
    def test_extension_page_chooses_folder_and_starts_original_tab(self):
        browser = browser_path()
        if not browser:
            self.skipTest("Chrome/Edge unavailable")
        page = (ROOT / "download-launch.html").read_text(encoding="utf-8")
        page = page.replace('<link rel="stylesheet" href="download-launch.css">',
                            '<style>' + (ROOT / "download-launch.css").read_text(encoding="utf-8") + '</style>')
        page = re.sub(r'<script src="[^"]+"></script>', '', page)
        page = page.replace('</body>', '<pre id="result"></pre><script>' + STUB +
                            (ROOT / "download-launch.js").read_text(encoding="utf-8") + SCENARIO + '</script></body>')
        with tempfile.TemporaryDirectory(prefix="flowdetect-download-launch-") as temporary:
            fixture = Path(temporary) / "launch.html"
            fixture.write_text(page, encoding="utf-8")
            completed = subprocess.run([browser, '--headless', '--disable-gpu', '--no-first-run',
                '--no-default-browser-check', f'--user-data-dir={Path(temporary) / "profile"}',
                '--window-size=900,820', '--virtual-time-budget=4000', '--dump-dom',
                fixture.as_uri() + '?id=' + ROUTE_ID], stdout=subprocess.PIPE,
                stderr=subprocess.PIPE, timeout=40,
                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            match = re.search(r'<pre id="result">(.*?)</pre>', completed.stdout.decode('utf-8', errors='replace'), re.S)
            self.assertTrue(match and match.group(1), completed.stdout.decode(errors='replace')[-4000:]
                            + completed.stderr.decode(errors='replace')[-2000:])
            result = json.loads(html.unescape(match.group(1)))
            self.assertEqual(result['errors'], [])
            self.assertEqual(len(result['checks']), 6)
            fixture.write_text(page.replace('const local=', 'window.__preauthorized=true; const local=', 1)
                               .replace(SCENARIO, PREAUTHORIZED_SCENARIO), encoding="utf-8")
            subsequent = subprocess.run([browser, '--headless', '--disable-gpu', '--no-first-run',
                '--no-default-browser-check', f'--user-data-dir={Path(temporary) / "subsequent-profile"}',
                '--window-size=900,820', '--virtual-time-budget=4000', '--dump-dom',
                fixture.as_uri() + '?id=' + ROUTE_ID], stdout=subprocess.PIPE,
                stderr=subprocess.PIPE, timeout=40,
                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            next_match = re.search(r'<pre id="result">(.*?)</pre>', subsequent.stdout.decode('utf-8', errors='replace'), re.S)
            self.assertTrue(next_match and next_match.group(1), subsequent.stdout.decode(errors='replace')[-4000:])
            next_result = json.loads(html.unescape(next_match.group(1)))
            self.assertEqual(next_result['errors'], [])
            self.assertEqual(len(next_result['checks']), 4)
            screenshot = os.environ.get("FLOWDETECT_DOWNLOAD_LAUNCH_SCREENSHOT")
            if screenshot:
                fixture.write_text(page.replace(SCENARIO, VISUAL_SCENARIO), encoding="utf-8")
                subprocess.run([browser, '--headless', '--disable-gpu', '--no-first-run',
                    '--no-default-browser-check', f'--user-data-dir={Path(temporary) / "visual-profile"}',
                    '--window-size=900,820', '--virtual-time-budget=4000', f'--screenshot={screenshot}',
                    fixture.as_uri() + '?id=' + ROUTE_ID], stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE, timeout=40,
                    creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0), check=True)

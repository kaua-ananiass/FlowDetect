"""Check the execution carousel in a real Chromium popup document."""

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
const tinyPng='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=';
const automation={id:'carousel',schema:'flowdetect_chrome_automation',version:3,
  automation:{nome:'Teste de fluxo'},steps:[
    {type:'ocr_text',source_order:1,sequence:'principal',text:'Pesquisar'},
    {type:'visual_match',source_order:4,sequence:'principal',image:{data_url:tinyPng}},
    {type:'focused_text',source_order:7,sequence:'pagina_2',text:'Empresa ficticia'}]};
const run={automationId:'carousel',id:'run-1',status:'running',currentIndex:0,currentStep:1,totalSteps:3,logs:[]};
const db={flowdetectChromeAutomations:[automation],flowdetectChromeLastRun:run};
window.chrome={storage:{local:{get:async key=>({[key]:db[key]}),set:async items=>Object.assign(db,items)},
  onChanged:{addListener(){}}},runtime:{sendMessage:async message=>message.type==='flowdetect-screen-ready'
  ? {ok:true,ready:true} : {ok:true,version:'0.2.52',activeRunIds:['run-1']}},
  tabs:{query:async()=>[{id:42,url:'https://site.test/'}]}};
"""
SCENARIO = r"""
(async()=>{
  const checks=[],errors=[];
  const check=(name,condition)=>{if(!condition)throw Error(name);checks.push(name)};
  const pause=()=>new Promise(resolve=>setTimeout(resolve,40));
  try{
    await pause();
    const carousel=document.querySelector('.block-carousel');
    check('progress is above the block carousel',Boolean(carousel &&
      document.querySelector('.execution-progress').compareDocumentPosition(carousel)&Node.DOCUMENT_POSITION_FOLLOWING));
    check('running popup shows only the compact execution card',document.body.classList.contains('run-focused')
      && getComputedStyle(document.querySelector('.popup-toolbar')).display==='none'
      && getComputedStyle(document.querySelector('.automation-card-top')).display==='none'
      && getComputedStyle(carousel).display!=='none'
      && !document.querySelector('.stop-button').hidden);
    check('starts on the current OCR block',document.querySelector('.block-carousel-title').textContent==='Reconhecimento OCR'
      && document.querySelector('.block-carousel-count').textContent==='1 / 3');
    check('an older run still shows its current stage',document.querySelector('.live-step').textContent.includes('Reconhecimento OCR'));
    check('text-only block has an honest image placeholder',!document.querySelector('.block-carousel-placeholder').hidden
      && document.querySelector('.block-carousel-image').hidden);
    check('history is collapsed but available',!document.querySelector('.run-log-details').open);
    document.querySelector('.run-log-details summary').click();await pause();
    updateRun({...run,currentIndex:0,currentStep:1,logs:[{level:'info',message:'Bloco em andamento'}]});
    check('expanded history survives live updates',document.querySelector('.run-log-details').open
      && document.querySelector('.run-log').textContent.includes('Bloco em andamento'));
    updateRun({...run,currentIndex:1,currentStep:2});
    check('auto-advances to the visual block and its image',document.querySelector('.block-carousel-count').textContent==='2 / 3'
      && document.querySelector('.block-carousel-image').src===tinyPng
      && !document.querySelector('.block-carousel-image').hidden);
    check('block change uses both sides of the flip',document.querySelector('.block-carousel-slide.flip-in')
      && document.querySelector('.block-carousel-slide.flip-out'));
    updateRun({...run,currentIndex:1,currentStep:2,logs:[{level:'info',message:'Executando reconhecimento'}]});
    check('a live log update does not cancel the flip',document.querySelector('.block-carousel-slide.flip-in')
      && document.querySelector('.block-carousel-slide.flip-out'));
    updateRun({...run,currentIndex:1,currentStep:2,recentSteps:[
      {serial:1,index:0,state:'done'},{serial:2,index:1,state:'running'}]});
    check('live stages appear directly below the card',document.querySelector('.block-carousel').nextElementSibling.classList.contains('live-steps')
      && document.querySelectorAll('.live-step').length===2
      && document.querySelector('.live-step').textContent.includes('Reconhecimento visual'));
    document.querySelector('.block-carousel-prev').click();
    check('manual review can move back',document.querySelector('.block-carousel-count').textContent==='1 / 3'
      && !document.querySelector('.block-carousel-follow').disabled);
    updateRun({...run,currentIndex:2,currentStep:3});
    check('manual review stays on selected card',document.querySelector('.block-carousel-count').textContent==='1 / 3');
    document.querySelector('.block-carousel-follow').click();
    check('follow resumes the live block',document.querySelector('.block-carousel-count').textContent==='3 / 3'
      && document.querySelector('.block-carousel-follow').disabled);
    updateRun({...run,currentIndex:2,currentStep:3,recentSteps:[
      {serial:1,index:0,state:'done'},{serial:2,index:1,state:'done'},{serial:3,index:2,state:'running'}]});
    check('three live stages fit below the compact card',document.querySelectorAll('.live-step').length===3
      && document.querySelector('.live-steps').getBoundingClientRect().bottom
         <= document.querySelector('.automation-list').getBoundingClientRect().bottom + 1);
    updateRun({...run,currentIndex:2,currentStep:3,status:'completed'});
    check('completion remains on the last block',document.querySelector('.block-carousel-state').textContent==='Concluído'
      && document.querySelector('.execution-percent').textContent==='100%');
    updateRun({...run,id:'run-2',currentIndex:1,currentStep:2});
    const failedRun={...run,id:'run-2',currentIndex:2,currentStep:3,
      blockFailure:{serial:1,index:1,nextIndex:2,message:'Nao encontrou o alvo'}};
    updateRun(failedRun);
    check('a failed block shakes red before following its route',document.querySelector('.block-carousel-count').textContent==='2 / 3'
      && document.querySelector('.block-carousel-slide.failure-shake')
      && getComputedStyle(document.querySelector('.block-carousel-slide')).borderTopColor.includes('255, 99, 117'));
    await new Promise(resolve=>setTimeout(resolve,700));
    check('after the error the carousel flips to the configured destination',document.querySelector('.block-carousel-count').textContent==='3 / 3'
      && document.querySelector('.block-carousel-slide.flip-in'));
    updateRun({...failedRun,status:'stopped'});
    check('stopping keeps the compact card instead of returning to the menu',document.body.classList.contains('run-focused')
      && getComputedStyle(document.querySelector('.popup-toolbar')).display==='none'
      && document.querySelector('.stop-button').hidden
      && !document.querySelector('.block-carousel-manager').hidden);
    document.querySelector('.block-carousel-manager').click();
    check('the menu returns only on request',!document.body.classList.contains('run-focused')
      && getComputedStyle(document.querySelector('.popup-toolbar')).display!=='none'
      && document.querySelector('.execution').hidden);
    const delayedRun={...run,id:'run-3',currentIndex:1,currentStep:2};
    updateRun(delayedRun);
    updateRun({...delayedRun,blockFailure:{serial:1,index:1,nextIndex:2,message:'Nao encontrou o alvo'}});
    await new Promise(resolve=>setTimeout(resolve,700));
    check('a delayed route shows its destination without bouncing back',document.querySelector('.block-carousel-count').textContent==='3 / 3'
      && document.querySelector('.block-carousel-state').textContent==='Próximo bloco');
    updateRun({...delayedRun,currentIndex:2,currentStep:3,blockFailure:{serial:1,index:1,nextIndex:2,message:'Nao encontrou o alvo'}});
    check('the delayed destination becomes the live block',document.querySelector('.block-carousel-count').textContent==='3 / 3'
      && document.querySelector('.block-carousel-state').textContent==='Executando');
  }catch(error){errors.push(String(error.stack||error))}
  document.querySelector('#result').textContent=JSON.stringify({checks,errors});
})();
"""


class ChromeBlockCarouselBrowserTest(unittest.TestCase):
    def test_carousel_follows_steps_and_shows_images(self):
        browser = browser_path()
        if not browser:
            self.skipTest("Chrome/Edge unavailable")
        page = (ROOT / "sidepanel.html").read_text(encoding="utf-8")
        page = re.sub(r'<script src="[^"]+"></script>', '', page)
        page = page.replace('<link rel="stylesheet" href="sidepanel.css">',
                            '<style>' + (ROOT / "sidepanel.css").read_text(encoding="utf-8") + '</style>')
        page = page.replace('</body>', '<pre id="result"></pre><script>' + STUB +
                            (ROOT / "sidepanel.js").read_text(encoding="utf-8") + SCENARIO + '</script></body>')
        with tempfile.TemporaryDirectory(prefix="flowdetect-carousel-") as temporary:
            fixture = Path(temporary) / "panel.html"
            fixture.write_text(page, encoding="utf-8")
            completed = subprocess.run([browser, '--headless', '--disable-gpu', '--no-first-run',
                '--no-default-browser-check', f'--user-data-dir={Path(temporary) / "profile"}',
                '--window-size=420,720', '--virtual-time-budget=3000', '--dump-dom', fixture.as_uri()],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=40,
                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            match = re.search(r'<pre id="result">(.*?)</pre>', completed.stdout.decode('utf-8', errors='replace'), re.S)
            self.assertTrue(match and match.group(1), completed.stderr.decode(errors='replace')[-2000:])
            result = json.loads(html.unescape(match.group(1)))
            self.assertEqual(result['errors'], [], '\n'.join(result['errors']))
            self.assertEqual(len(result['checks']), 22)


if __name__ == "__main__":
    unittest.main()

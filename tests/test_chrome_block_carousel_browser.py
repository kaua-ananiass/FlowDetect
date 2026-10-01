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
globalThis.FlowDetectExecutionReport={download:()=> 'relatorio-teste.pdf'};
window.chrome={storage:{local:{get:async key=>({[key]:db[key]}),set:async items=>Object.assign(db,items)},
  onChanged:{addListener(){}}},runtime:{sendMessage:async message=>message.type==='flowdetect-screen-ready'
  ? {ok:true,ready:true} : {ok:true,version:'0.2.54',activeRunIds:['run-1']}},
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
    check('OCR search shows an honest animated progress bar',
      !document.querySelector('.block-carousel-ocr-progress').hidden
      && document.querySelector('.block-carousel-ocr-progress').dataset.state==='searching'
      && getComputedStyle(document.querySelector('.block-carousel-ocr-fill')).animationName==='block-ocr-search');
    check('an older run still shows its current stage',document.querySelector('.live-step').textContent.includes('Reconhecimento OCR'));
    check('text-only block has an honest image placeholder',!document.querySelector('.block-carousel-placeholder').hidden
      && document.querySelector('.block-carousel-image').hidden);
    check('history is collapsed but available',!document.querySelector('.run-log-details').open);
    document.querySelector('.run-log-details summary').click();await pause();
    updateRun({...run,currentIndex:0,currentStep:1,logs:[{level:'info',message:'Bloco em andamento'}]});
    check('expanded history survives live updates',document.querySelector('.run-log-details').open
      && document.querySelector('.run-log').textContent.includes('Bloco em andamento'));
    updateRun({...run,currentIndex:0,currentStep:1,
      blockSuccess:{serial:1,index:0,at:Date.now()}});
    check('OCR match turns the current card green immediately',
      document.querySelector('.block-carousel-count').textContent==='1 / 3'
      && document.querySelector('.block-carousel-slide.success-shake')
      && document.querySelector('.block-carousel-ocr-progress').dataset.state==='success'
      && getComputedStyle(document.querySelector('.block-carousel-slide')).borderTopColor.includes('74, 224, 152'));
    updateRun({...run,currentIndex:1,currentStep:2,
      blockSuccess:{serial:1,index:0,at:Date.now()}});
    check('the next block appears immediately with the OCR result badge',document.querySelector('.block-carousel-count').textContent==='2 / 3'
      && document.querySelector('.block-carousel-image').src===tinyPng
      && !document.querySelector('.block-carousel-image').hidden
      && document.querySelector('.block-carousel-feedback').textContent.includes('B01 · Encontrado'));
    check('block change uses a single visible flip face',document.querySelector('.block-carousel-slide.flip-in')
      && document.querySelectorAll('.block-carousel-slide').length===1);
    updateRun({...run,currentIndex:1,currentStep:2,logs:[{level:'info',message:'Executando reconhecimento'}]});
    check('a live log update does not cancel the flip',document.querySelector('.block-carousel-slide.flip-in')
      && document.querySelectorAll('.block-carousel-slide').length===1);
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
    check('finished compact panel visibly offers the PDF report',!document.querySelector('.report-button').hidden
      && getComputedStyle(document.querySelector('.report-button')).display!=='none'
      && document.querySelector('.report-button').getBoundingClientRect().bottom
         <= document.querySelector('.automation-list').getBoundingClientRect().bottom + 1);
    document.querySelector('.report-button').click();await pause();
    check('generating the report saves its result without leaving the run',db.flowdetectChromeLastRun.reportFilename==='relatorio-teste.pdf'
      && document.body.classList.contains('run-focused')
      && document.querySelector('.report-button').textContent.includes('novo relatório'));
    document.querySelector('.block-carousel-manager').click();
    check('a completed run remains accessible from the automation list',
      !document.querySelector('.resume-run-button').hidden
      && document.querySelector('.resume-run-button').textContent.includes('100%'));
    document.querySelector('.resume-run-button').click();
    check('returning to the completed run keeps its report and progress',
      document.body.classList.contains('run-focused')
      && document.querySelector('.execution-percent').textContent==='100%'
      && document.querySelector('.report-button').textContent.includes('novo relatório'));
    const rapidRun={...run,id:'run-rapid',currentIndex:0,currentStep:1};
    updateRun(rapidRun);
    updateRun({...rapidRun,currentIndex:1,currentStep:2});
    updateRun({...rapidRun,currentIndex:2,currentStep:3});
    check('rapid steps immediately show the latest card without stacking faces',
      document.querySelector('.block-carousel-count').textContent==='3 / 3'
      && document.querySelectorAll('.block-carousel-slide').length===1);
    updateRun({...rapidRun,currentIndex:2,currentStep:3,logs:[{level:'info',message:'Próximo teste'}]});
    check('log updates during a fast transition keep one current face',
      document.querySelector('.block-carousel-count').textContent==='3 / 3'
      && document.querySelectorAll('.block-carousel-slide').length===1);
    await new Promise(resolve=>setTimeout(resolve,350));
    check('fast updates stay on the newest block after the flip',
      document.querySelector('.block-carousel-count').textContent==='3 / 3'
      && document.querySelectorAll('.block-carousel-slide').length===1);
    automationsCache=[{...automation,steps:[automation.steps[0],
      {...automation.steps[1],type:'ocr_text',text:'Próximo texto'},automation.steps[2]]}];
    const rapidOcr={...run,id:'run-rapid-ocr',currentIndex:0,currentStep:1};
    updateRun(rapidOcr);
    updateRun({...rapidOcr,currentIndex:2,currentStep:3,
      blockSuccess:{serial:1,index:1,at:Date.now()}});
    check('a fast OCR result never pulls the card back to a finished block',
      document.querySelector('.block-carousel-count').textContent==='3 / 3'
      && document.querySelector('.block-carousel-feedback').textContent.includes('B04 · Encontrado'));
    await new Promise(resolve=>setTimeout(resolve,500));
    check('feedback fades while the carousel stays on the live block',
      document.querySelector('.block-carousel-count').textContent==='3 / 3'
      && document.querySelector('.block-carousel-feedback').hidden);
    const queuedOcr={...run,id:'run-queued-ocr',currentIndex:0,currentStep:1};
    updateRun(queuedOcr);
    updateRun({...queuedOcr,currentIndex:1,currentStep:2,
      blockSuccess:{serial:1,index:0,at:Date.now()}});
    updateRun({...queuedOcr,currentIndex:2,currentStep:3,
      blockSuccess:{serial:2,index:1,at:Date.now()+1}});
    check('back-to-back OCR results show the latest result and live card at once',
      document.querySelector('.block-carousel-count').textContent==='3 / 3'
      && document.querySelector('.block-carousel-feedback').textContent.includes('B04 · Encontrado')
      && document.querySelectorAll('.block-carousel-slide').length===1);
    check('rapid OCR updates do not leave a queued animation',
      document.querySelector('.block-carousel-count').textContent==='3 / 3'
      && document.querySelectorAll('.block-carousel-slide.flip-out').length===0);
    automationsCache=[automation];
    updateRun({...run,id:'run-2',currentIndex:1,currentStep:2});
    const failedRun={...run,id:'run-2',currentIndex:1,currentStep:2,
      blockFailure:{serial:1,index:1,nextIndex:2,message:'Nao encontrou o alvo'}};
    updateRun(failedRun);
    check('the active failed block shakes red immediately',document.querySelector('.block-carousel-count').textContent==='2 / 3'
      && document.querySelector('.block-carousel-slide.failure-shake')
      && getComputedStyle(document.querySelector('.block-carousel-slide')).borderTopColor.includes('255, 99, 117'));
    updateRun({...failedRun,currentIndex:2,currentStep:3});
    check('the failure route appears as soon as execution advances',document.querySelector('.block-carousel-count').textContent==='3 / 3'
      && document.querySelector('.block-carousel-feedback').dataset.tone==='failed');
    updateRun({...failedRun,currentIndex:2,currentStep:3,status:'stopped'});
    check('stopping keeps the compact card instead of returning to the menu',document.body.classList.contains('run-focused')
      && getComputedStyle(document.querySelector('.popup-toolbar')).display==='none'
      && document.querySelector('.stop-button').hidden
      && !document.querySelector('.block-carousel-manager').hidden
      && !document.querySelector('.report-button').hidden);
    const stoppedProgress=document.querySelector('.execution-percent').textContent;
    const stoppedBlock=document.querySelector('.block-carousel-count').textContent;
    document.querySelector('.block-carousel-manager').click();
    check('the menu returns only on request',!document.body.classList.contains('run-focused')
      && getComputedStyle(document.querySelector('.popup-toolbar')).display!=='none'
      && document.querySelector('.execution').hidden);
    check('the automation menu offers a way back to the saved execution',
      !document.querySelector('.resume-run-button').hidden
      && document.querySelector('.resume-run-button').textContent.includes('Ver última execução'));
    document.querySelector('.resume-run-button').click();
    check('returning restores the same stopped card and progress',document.body.classList.contains('run-focused')
      && document.querySelector('.block-carousel-count').textContent===stoppedBlock
      && document.querySelector('.execution-percent').textContent===stoppedProgress
      && !document.querySelector('.report-button').hidden);
    const delayedRun={...run,id:'run-3',currentIndex:1,currentStep:2};
    updateRun(delayedRun);
    updateRun({...delayedRun,blockFailure:{serial:1,index:1,nextIndex:2,message:'Nao encontrou o alvo'}});
    await new Promise(resolve=>setTimeout(resolve,500));
    check('a delayed route stays on the executing block rather than predicting its destination',
      document.querySelector('.block-carousel-count').textContent==='2 / 3');
    updateRun({...delayedRun,currentIndex:2,currentStep:3,blockFailure:{serial:1,index:1,nextIndex:2,message:'Nao encontrou o alvo'}});
    check('the delayed destination appears exactly when it becomes the live block',document.querySelector('.block-carousel-count').textContent==='3 / 3'
      && document.querySelector('.block-carousel-state').textContent==='Executando');
    updateRun({...run,id:'run-ocr-failure',currentIndex:0,currentStep:1});
    updateRun({...run,id:'run-ocr-failure',currentIndex:0,currentStep:1,
      blockFailure:{serial:1,index:0,nextIndex:1,message:'Texto não encontrado',at:Date.now()}});
    check('OCR miss fills its progress bar red during the failure shake',
      document.querySelector('.block-carousel-slide.failure-shake')
      && document.querySelector('.block-carousel-ocr-progress').dataset.state==='failed'
      && getComputedStyle(document.querySelector('.block-carousel-ocr-fill')).width
         ===getComputedStyle(document.querySelector('.block-carousel-ocr-track')).width);
    updateRun({...run,id:'run-ocr-failure',currentIndex:1,currentStep:2,
      blockFailure:{serial:1,index:0,nextIndex:1,message:'Texto não encontrado',at:Date.now()}});
    check('OCR failure stays visible as a compact badge on the next card',
      document.querySelector('.block-carousel-count').textContent==='2 / 3'
      && document.querySelector('.block-carousel-feedback').dataset.tone==='failed');
    const activityAutomation={...automation,id:'activity',steps:[
      {type:'data_source',source_order:2,sequence:'principal',name:'CNPJ',values:['111','222']},
      {type:'report_result',source_order:7,sequence:'pagina_2',status:'Não encontrado',tone:'danger',result:'Resultado de {{empresa}}'}]};
    automationsCache=[activityAutomation];
    const activityRun={automationId:'activity',id:'run-activity',status:'running',currentIndex:0,currentStep:1,
      totalSteps:2,logs:[],spreadsheetLoop:{sourceIndex:0,row:1,total:2,rowData:{Empresa:'Empresa teste'}}};
    updateRun(activityRun);
    check('spreadsheet preview shows the current row in a compact typing card',
      !document.querySelector('.block-carousel-activity').hidden
      && document.querySelector('.block-carousel-placeholder').hidden
      && document.querySelector('.block-carousel-activity-value').textContent==='222'
      && document.querySelector('.block-carousel-activity-message').textContent==='Digitando na página'
      && document.querySelector('.block-carousel-activity').getBoundingClientRect().right
         <=document.querySelector('.block-carousel-preview').getBoundingClientRect().right);
    updateRun({...activityRun,currentIndex:1,currentStep:2});
    check('PDF preview shows saving state and its configured status',
      document.querySelector('.block-carousel-activity').dataset.tone==='danger'
      && document.querySelector('.block-carousel-activity-value').textContent==='Não encontrado'
      && document.querySelector('.block-carousel-activity-message').textContent==='Salvando no relatório');
    updateRun({...activityRun,currentIndex:1,currentStep:2,status:'stopped'});
    check('stopped PDF card shows the result without a false saving animation',
      !document.querySelector('.block-carousel-activity').classList.contains('is-animating')
      && document.querySelector('.block-carousel-activity-message').textContent==='Resultado de Empresa teste');
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
                '--window-size=420,720', '--virtual-time-budget=3500', '--dump-dom', fixture.as_uri()],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=40,
                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            match = re.search(r'<pre id="result">(.*?)</pre>', completed.stdout.decode('utf-8', errors='replace'), re.S)
            self.assertTrue(match and match.group(1), completed.stderr.decode(errors='replace')[-2000:])
            result = json.loads(html.unescape(match.group(1)))
            self.assertEqual(result['errors'], [], '\n'.join(result['errors']))
        self.assertEqual(len(result['checks']), 42)


if __name__ == "__main__":
    unittest.main()

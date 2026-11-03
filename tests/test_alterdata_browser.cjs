const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

test('Alterdata workspace: navigation, task drafts, parameters and execution handoff', async () => {
  const web = path.resolve(__dirname, '../tauri_gerador/web');
  const html = await fs.readFile(path.join(web, 'index.html'), 'utf8');
  const panel = html.slice(html.indexOf('<section id="alterdataPanel"'), html.indexOf('<section id="integrationsPanel"'));
  const server = http.createServer(async(req,res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if(url.pathname === '/task-test') {
        res.setHeader('Content-Type','text/html');
        res.end(`<link rel="stylesheet" href="/alterdata.css">${panel}<script type="module">
          import {initAlterdata, resolveAlterdataTexts} from '/alterdata.js';
          window.calls=[]; window.fail=false;
          window.ui=initAlterdata({listAgents:()=>[{id:'agent-1',name:'PC dedicado'}],listFlows:()=>[{id:'flow-1',name:'Férias Alterdata'}],openEditor:()=>{},openAgent:()=>{},execute:async(r,required)=>{
            if(window.fail)throw Error('Agente ocupado');
            const events=required.map((key,index)=>({order:index+1,text:'{{'+key+'}}'}));
            const texts=resolveAlterdataTexts(events,r.values,required);window.calls.push({r,texts});
          }});
          window.resolveTexts=resolveAlterdataTexts;
        </script>`); return;
      }
      const filename=path.resolve(web,'.'+url.pathname.replace(/\/$/,'/index.html'));
      if(!filename.startsWith(web+path.sep)){res.writeHead(403).end();return;}
      res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript'})[path.extname(filename)]||'application/octet-stream');
      res.end(await fs.readFile(filename));
    }catch{res.writeHead(404).end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/');
    await page.addStyleTag({content:'#loginOverlay{display:none!important}.builder-shell{visibility:visible!important;pointer-events:auto!important;filter:none!important}'});
    await page.locator('#alterdataTabButton').click();
    assert.equal(await page.locator('.workspace-panel.is-active').count(),1);
    assert.equal(await page.locator('#alterdataPanel').isVisible(),true);
    assert.equal(await page.locator('.alterdata-template').count(),4);
    if(process.env.FLOWDETECT_TEST_SCREENSHOT_DIR){
      await fs.mkdir(process.env.FLOWDETECT_TEST_SCREENSHOT_DIR,{recursive:true});
      await page.screenshot({path:path.join(process.env.FLOWDETECT_TEST_SCREENSHOT_DIR,'alterdata-workspace.png')});
    }
    await page.locator('#launcherTabButton').click();
    assert.equal(await page.locator('#alterdataPanel').isVisible(),false);
    await page.goto(base+'/task-test');
    await page.waitForFunction(()=>window.ui);
    await page.locator('[name="empresa.codigo"]').fill('330');
    await page.locator('[name="funcionario.codigo"]').fill('27');
    await page.locator('[name="ferias.inicio"]').fill('2026-11-10');
    await page.locator('[name="ferias.dias"]').fill('20');
    await page.locator('#alterdataSave').click();
    assert.equal(await page.locator('.alterdata-request').count(),1);
    assert.equal(await page.evaluate(()=>calls.length),0);
    await page.reload();await page.waitForFunction(()=>window.ui);
    await page.locator('.alterdata-request button').first().click();
    assert.equal(await page.locator('[name="empresa.codigo"]').inputValue(),'330');
    await page.locator('#alterdataAgent').selectOption('agent-1');
    await page.locator('#alterdataFlow').selectOption('flow-1');
    await page.locator('#alterdataExecute').click();
    assert.match(await page.locator('#alterdataFeedback').textContent(),/confirme a validação/);
    await page.locator('#alterdataReviewed').check();
    await page.locator('#alterdataExecute').click();
    await page.waitForFunction(()=>calls.length===1);
    assert.deepEqual(await page.evaluate(()=>calls[0].texts),{'1':'330','2':'27','3':'10/11/2026','4':'20'});
    assert.equal(await page.locator('#alterdataWatch').isVisible(),true);
    const rejects=await page.evaluate(()=>{
      const failures=[];
      for(const events of [[],[{order:1,text:'{{desconhecida}}'}],[{order:1,text:'{{empresa.codigo'}]]){
        try{resolveTexts(events,{'empresa.codigo':'330'},['empresa.codigo']);failures.push(false);}catch{failures.push(true);}
      }
      return failures;
    });
    assert.deepEqual(rejects,[true,true,true]);
    await page.evaluate(()=>window.fail=true);
    await page.locator('#alterdataExecute').click();
    await page.waitForFunction(()=>document.querySelector('#alterdataFeedback').textContent==='Agente ocupado');
    assert.equal(await page.evaluate(()=>calls.length),1);
    assert.equal(await page.locator('#alterdataExecute').isEnabled(),true);
    await page.locator('[data-type="rescisao"]').click();
    assert.equal(await page.locator('#alterdataReviewed').isChecked(),false);
    assert.equal(await page.locator('[name="rescisao.motivo"]').count(),1);
    assert.deepEqual(errors,[]);
  }finally{await browser?.close();await new Promise(r=>server.close(r));}
});

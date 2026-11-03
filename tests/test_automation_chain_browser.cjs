const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');

test('chain tree links reviewed blocks, saves drafts and controls agent execution without clicking Chrome',async()=>{
  const web=path.resolve(__dirname,'../tauri_gerador/web');
  const html=await fs.readFile(path.join(web,'index.html'),'utf8');
  const panel=html.slice(html.indexOf('<section id="chainPanel"'),html.indexOf('<section id="alterdataPanel"'));
  const server=http.createServer(async(req,res)=>{
    const url=new URL(req.url,'http://localhost');
    try{
      if(url.pathname==='/studio'){
        res.setHeader('Content-Type','text/html');res.end(html);
      }else if(url.pathname==='/'){
        res.setHeader('Content-Type','text/html');
        res.end(`<meta charset="utf-8"><link rel="stylesheet" href="/vendor/fonts/fonts.css"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/automation-chain.css">${panel}<script type="module">
          import {initAutomationChain} from '/automation-chain.js';
          document.querySelector('#chainPanel').classList.add('is-active');
          window.calls=[];window.remote={status:'idle'};window.running=false;
          window.app=initAutomationChain({listAgents:()=>[{id:'agent1',name:'PC dedicado',address:'agent.test:18452'}],openAgent:()=>{window.watched=true;},invoke:async(command,args)=>{
            window.calls.push({command,...args});
            if(command==='remote_agent_list_automations')return {items:[{id:'desktop',nome:'Gerar documento no Alterdata'},{id:'web',nome:'Conferir no portal'}]};
            const request=args.request;
            if(request.action==='status')return {ok:true,active:window.running,chrome:{connected:true},chain:window.remote};
            if(request.action==='pages')return {ok:true,pages:[{id:'page1',name:'Página 1',tabId:12,tabTitle:'Portal do cliente'}]};
            if(request.action==='preview')return {fingerprint:'a'.repeat(64),active_automation:{nome:request.id==='desktop'?'Gerar documento no Alterdata':'Conferir no portal'},events:[{order:1,type:'texto_livre',title:'Empresa',text:'{{empresa}}',sequence:'principal',details:{editavel_execucao:true}},{order:2,type:'procurar_texto_ocr',title:'Conferir resultado',sequence:'principal',details:{ao_sucesso:'ir_para_bloco',bloco_sucesso:3}}]};
            if(request.action==='start'){window.running=true;window.remote={status:'running',current:0,stages:structuredClone(request.stages)};return {ok:true};}
            if(request.action==='stop'){window.running=false;window.remote.status='stopped';return {ok:true};}
            if(request.action==='release'){window.running=false;window.remote.status='stopped';return {ok:true};}
            return {ok:true};
          }});
        </script>`);
      }else{res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'application/octet-stream');res.end(await fs.readFile(path.join(web,decodeURIComponent(url.pathname))));}
    }catch(_){res.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1080}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/studio`);
    await page.addStyleTag({content:'#loginOverlay{display:none!important}.builder-shell{visibility:visible!important;pointer-events:auto!important;filter:none!important}'});
    await page.locator('#chainTabButton').click();
    assert.equal(await page.locator('#chainPanel').isVisible(),true);
    assert.equal(await page.locator('.workspace-panel.is-active').count(),1);
    await page.locator('#launcherTabButton').click();
    assert.equal(await page.locator('#chainPanel').isVisible(),false);
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.locator('#chainAgent').selectOption('agent1');
    await page.locator('#chainConnect').click();
    await page.locator('#chainLibrary option[value=desktop]').waitFor({state:'attached'});
    await page.locator('#chainLibrary').selectOption('desktop');await page.locator('#chainAdd').click();
    await page.locator('.chain-stage').waitFor();
    assert.equal(await page.locator('.chain-blocks li').count(),2);
    await page.getByLabel('Entrada do processo 1').selectOption('2');
    assert.match(await page.locator('.chain-blocks .is-entry').textContent(),/Conferir resultado/);
    await page.locator('#chainLibrary').selectOption('web');await page.locator('#chainEngine').selectOption('chrome');await page.locator('#chainAdd').click();
    await page.waitForFunction(()=>document.querySelectorAll('.chain-stage').length===2);
    await page.locator('.chain-stage').nth(1).getByLabel('Página no Chrome do agente').selectOption('page1');
    await page.locator('#chainName').fill('Alterdata → Portal');await page.locator('#chainName').press('Tab');
    await page.locator('.chain-variables summary').click();
    await page.locator('#chainVariables').fill('{"empresa":"330","arquivo":"C:\\\\Saidas\\\\documento.pdf"}');
    await page.locator('#chainSave').click();
    assert.equal(await page.evaluate(()=>calls.filter(call=>call.request?.action==='start').length),0);
    await page.locator('#chainStart').click();
    await page.waitForFunction(()=>document.querySelector('#chainFeedback').textContent.includes('Revise'));
    await page.locator('#chainReviewed').check();await page.locator('#chainStart').click();
    await page.waitForFunction(()=>document.querySelector('#chainRunStatus').textContent==='Executando');
    const sent=await page.evaluate(()=>calls.find(call=>call.request?.action==='start'));
    assert.equal(sent.address,'agent.test:18452');assert.equal(sent.request.stages[0].engine,'desktop');assert.equal(sent.request.stages[0].entryOrder,2);assert.equal(sent.request.stages[1].engine,'chrome');assert.equal(sent.request.stages[1].pageId,'page1');assert.equal(sent.request.variables.empresa,'330');
    assert.equal(await page.locator('#chainAdd').isDisabled(),true);
    await page.evaluate(()=>{remote.stages[0].status='completed';remote.current=1;});
    await page.locator('#chainRefresh').click();await page.waitForFunction(()=>document.querySelector('#chainRunStages').textContent.includes('Concluído'));
    await page.locator('#chainStop').click();await page.waitForFunction(()=>document.querySelector('#chainRunStatus').textContent==='Interrompido');
    await page.reload();await page.waitForFunction(()=>document.querySelectorAll('.chain-stage').length===2);
    assert.equal(await page.locator('#chainName').inputValue(),'Alterdata → Portal');
    await page.locator('#chainConnect').click();
    await page.evaluate(()=>{remote={status:'needs_attention',error:'Sem confirmação do Chrome',stages:[]};running=true;});
    await page.locator('#chainRefresh').click();await page.locator('#chainRelease').waitFor();
    assert.equal(await page.locator('#chainStart').isDisabled(),true);
    await page.locator('#chainRelease').click();await page.waitForFunction(()=>document.querySelector('#chainRunStatus').textContent==='Interrompido');
    if(process.env.FLOWDETECT_TEST_SCREENSHOT_DIR){
      await fs.mkdir(process.env.FLOWDETECT_TEST_SCREENSHOT_DIR,{recursive:true});
      await page.locator('.chain-stage details').first().evaluate(el=>el.open=true);
      await page.screenshot({path:path.join(process.env.FLOWDETECT_TEST_SCREENSHOT_DIR,'automation-chain.png'),fullPage:true});
    }
    for(const width of [1000,650,390]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
    assert.deepEqual(errors,[]);
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});

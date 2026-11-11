const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const path=require('node:path');const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
test('table monitor names each stage, exposes the actual failure and lets the user revisit a failed block',async()=>{
 const root=path.resolve(__dirname,'../flowdetect_chrome'),source=await fs.readFile(path.join(root,'sidepanel.js'),'utf8'),html=await fs.readFile(path.join(root,'sidepanel.html'),'utf8');
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage({viewport:{width:440,height:800}});await page.route('**/*',r=>r.abort());await page.setContent(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''));await page.addStyleTag({path:path.join(root,'sidepanel.css')});
  const functions=source.slice(source.indexOf('function blockPreviewImage('),source.indexOf('function normalizedSpreadsheetColumn('));
  await page.addScriptTag({content:'const carouselStates=new Map();window.renderAutomations=()=>window.renderCalls++;window.renderCalls=0;'+functions});
  await page.evaluate(()=>{
   const template=document.querySelector('#automationTemplate');const box=template.content.querySelector('.block-carousel').cloneNode(true),live=template.content.querySelector('.live-steps').cloneNode(true);
   document.body.innerHTML='<main class="assisted-content" style="width:400px;height:690px;margin:10px"></main>';document.querySelector('main').append(box,live);
   window.automation={id:'demo',steps:[{type:'table_read',source_order:3,table:{mode:'click',match_column:'Número da Guia',action:{label:'Detalhar guia'}}},{type:'table_read',source_order:4,table:{mode:'list',accumulate:true,columns:['Nome']}}]};
   window.run={id:'run',status:'running',currentIndex:1,currentStep:2,spreadsheetLoop:{row:0,total:16,rowData:{'Número da Guia':'GUIA-001'}},recentSteps:[{index:0,state:'failed',message:'B03 · Abrir guia · Guia GUIA-001: O botão mudou; mapeie novamente.'},{index:1,state:'running'}]};
   renderBlockCarousel(box,automation,run);renderLiveSteps(live,automation,run);
  });
  await assert.equal(await page.locator('.block-carousel-title').textContent(),'Capturar tabela do detalhe');
  assert.ok(await page.locator('.block-carousel-error').isVisible());assert.match(await page.locator('.block-carousel-error').textContent(),/O botão mudou/);
  assert.ok(await page.locator('.block-carousel-placeholder').isHidden());assert.match(await page.locator('.block-carousel-activity-count').textContent(),/1 de 16/);
  await page.getByRole('button',{name:'Ver motivo da falha'}).click();assert.equal(await page.evaluate(()=>renderCalls),1);
  await page.evaluate(()=>renderBlockCarousel(document.querySelector('.block-carousel'),automation,run));
  assert.equal(await page.locator('.block-carousel-title').textContent(),'Abrir detalhe da guia');assert.equal(await page.locator('.block-carousel-state').textContent(),'Falhou');assert.match(await page.locator('.block-carousel-error').textContent(),/GUIA-001/);
  await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}html,body{min-height:0!important;height:auto!important;overflow:auto!important}'});await page.evaluate(()=>window.scrollTo(0,0));
  const errorBounds=await page.locator('.block-carousel-error').boundingBox();assert.ok(errorBounds.y>=0,JSON.stringify(errorBounds));
  await fs.mkdir(path.resolve(root,'../output/table-block'),{recursive:true});await page.screenshot({path:path.resolve(root,'../output/table-block/table-failure-monitor.png'),fullPage:true});
 }finally{await browser.close();}
});

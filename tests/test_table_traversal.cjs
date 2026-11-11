const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const path=require('node:path');const vm=require('node:vm');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
test('generated traversal discovers unknown guide IDs, captures every detail, returns and accumulates across companies',async()=>{
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage();await page.route('https://portal.test/**',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:'<main></main>'}));await page.goto('https://portal.test/');
  await page.evaluate(()=>{
   window.company='Empresa A';window.opened=[];window.returnedGuides=[];window.chrome={runtime:{onMessage:{addListener(){}},sendMessage:async()=>({allowed:true})}};
   window.renderList=()=>{document.querySelector('main').innerHTML='<table id="list"><thead><tr><th>Guia</th><th>Ações</th></tr></thead><tbody>'+['G-123','G-456'].map(id=>`<tr><td>${id}</td><td><button aria-label="Detalhar">Olho</button></td></tr>`).join('')+'</tbody></table>';
    for(const row of document.querySelectorAll('tbody tr'))row.querySelector('button').onclick=()=>{const key=row.cells[0].textContent;opened.push(company+':'+key);setTimeout(()=>{document.querySelector('main').innerHTML='<table id="detail"><thead><tr><th>Trabalhador</th><th>Valor</th></tr></thead><tbody>'+['Pessoa 1','Pessoa 2'].map(n=>`<tr><td>${n}</td><td>123,45</td></tr>`).join('')+'</tbody></table><button aria-label="Fechar detalhe">Fechar</button>';document.querySelector('[aria-label="Fechar detalhe"]').onclick=()=>{returnedGuides.push(company+':'+key);renderList();};},30);};};renderList();
  });
  await page.addScriptTag({path:path.resolve(__dirname,'../flowdetect_chrome/table-reader.js')});
  const mapped=await page.evaluate(()=>FlowDetectTables.describe(document.querySelector('table')));
  const source=await fs.readFile(path.resolve(__dirname,'../flowdetect_chrome/service_worker.js'),'utf8');const downloads=[];
  const workbook=await import('data:text/javascript;base64,'+Buffer.from(await fs.readFile(path.resolve(__dirname,'../flowdetect_chrome/table-workbook.js'),'utf8')).toString('base64'));
  const inputClient=await page.context().newCDPSession(page);
  const run={id:'run',tabId:1,variables:{empresa:'Empresa A'},currentStep:0,recentSteps:[],requestedStartRow:1};
  const context=vm.createContext({setInterval,clearInterval,setTimeout,tableWorkbookDataUrl:workbook.tableWorkbookDataUrl,crypto:require('node:crypto').webcrypto,sleep:ms=>new Promise(r=>setTimeout(r,Math.min(ms,5))),spreadsheetRowData:(s,r)=>s.rows[r],spreadsheetColumnValue:(r,c)=>r[c]||'',spreadsheetStartRow:()=>1,addLog:async()=>{},persistRun:async()=>{},beginReportRow:()=>{},finalizeReportRow:()=>{},chrome:{debugger:{attach:async()=>{},detach:async()=>{},sendCommand:async(_target,method,params)=>inputClient.send(method,params)},scripting:{executeScript:async request=>request.func?[{frameId:0,result:await page.evaluate(request.func,request.args[0])}]:[]},downloads:{download:async d=>downloads.push(d)},tabs:{sendMessage:async(_tab,m)=>page.evaluate(async m=>{
    try{const f=FlowDetectTables;if(m.type==='flowdetect-table-read')return {ok:true,...await f.read(m.config)};
     if(m.type==='flowdetect-table-click'){await f.waitReady(m.config);return {ok:true,...await f.clickRow(m.config,async()=>true)};}
     if(m.type==='flowdetect-table-return')return {ok:true,...await f.returnToList(m.config,async()=>true)};
     if(m.type==='flowdetect-table-preview'){const t=document.querySelector('table');if(!t)throw Error('loading');const d=f.describe(t);if(JSON.stringify(d.descriptor.headers)!==JSON.stringify(m.config.descriptor.headers))throw Error('not list '+JSON.stringify([d.descriptor.headers,m.config.descriptor.headers,opened,returnedGuides]));return {ok:true,...d};}
    }catch(e){return {ok:false,error:e.message};}
   },m)}}});
  vm.runInContext(source.slice(source.indexOf('function replaceVariables('),source.indexOf('function imageDataFromBitmap(')),context);
  vm.runInContext(source.slice(source.indexOf('async function executeStep('),source.indexOf('async function executeAutomation(')),context);
  context.chrome.tabs.sendMessage=async()=>{throw Error('A listener indicated an asynchronous response, but the message channel closed');};
  const parent=mapped.descriptor,detail={...parent,headers:['Trabalhador','Valor']};
  const t=table=>({type:'table_read',table});
  const steps=[t({descriptor:parent,columns:['Guia'],variable:'guias',key_column:'Guia',prepare_loop:true,allow_empty:true,all_pages:true,traversal_id:'walk',collection:'dados',company:'{{empresa}}'}),{type:'loop_start'},t({mode:'click',descriptor:parent,action:mapped.actions[0][0],match_column:'Guia',match_value:'{{Guia}}',wait_ready:true,traversal_id:'walk',company:'{{empresa}}'}),t({descriptor:detail,columns:detail.headers,variable:'dados',mode:'list',wait_ready:true,all_pages:true,accumulate:true,traversal_id:'walk'}),t({mode:'return',descriptor:parent,return_mode:'button',return_control:{signature:{tag:'button',aria:'Fechar detalhe',title:'',text:'Fechar',icons:''},origin:parent.origin,pathname:parent.pathname}}),{type:'loop_end'},t({mode:'export',variable:'dados',csv:true,xlsx:true})].map((s,i)=>({...s,source_order:i+1,sequence:'principal'}));
  for(const company of ['Empresa A','Empresa B']){run.variables.empresa=company;await page.evaluate(c=>window.company=c,company);await context.executeRange(run,steps,0,steps.length,context.loopPairs(steps),context.buildFlowIndexes(steps));if(company==='Empresa A')assert.equal(run.currentStep,run.totalSteps);}
  const portal=await page.evaluate(()=>({opened,returnedGuides,list:!!document.querySelector('#list')}));
  assert.deepEqual(portal.opened,['Empresa A:G-123','Empresa A:G-456','Empresa B:G-123','Empresa B:G-456']);assert.deepEqual(portal.returnedGuides,portal.opened);assert.ok(portal.list);
  const records=JSON.parse(run.variables.dados);assert.equal(records.length,8);assert.equal(records[0]['Número da Guia'],'G-123');assert.equal(records[0].Empresa,'Empresa A');assert.equal(records[4].Empresa,'Empresa B');assert.equal(run.tableCollections.dados.guides.length,4);assert.equal(downloads.length,6);assert.equal(downloads.filter(d=>d.filename.endsWith('.xlsx')).length,2);
  // Re-reading one guide replaces its group, rather than duplicating an earlier capture.
  await context.executeStep(run,steps[2]);await context.executeStep(run,steps[3]);assert.equal(Object.values(run.tableCollections.dados.groups).flat().length,8);
  await page.evaluate(()=>document.querySelector('main').innerHTML='<br-table><table id="list"><thead><tr><th>Guia</th><th>Ações</th></tr></thead><tbody></tbody></table><div class="indices">0-0 de 0 itens</div></br-table>');
  const emptyRun={id:'empty',tabId:1,variables:{empresa:'Sem guias'},currentStep:0,recentSteps:[],requestedStartRow:1};
  await context.executeRange(emptyRun,steps,0,steps.length,context.loopPairs(steps),context.buildFlowIndexes(steps));
  assert.equal(emptyRun.variables.dados,'[]');assert.equal(emptyRun.tableCollections.dados.guides.length,0);
  await page.evaluate(()=>renderList());
  const originalSend=context.chrome.scripting.executeScript;
  context.chrome.scripting.executeScript=async request=>request.args?.[0]?.type==='flowdetect-table-click'?[{frameId:0,result:{ok:false,error:'Botão mapeado não encontrado'}}]:originalSend(request);
  const failedRun={id:'failed',tabId:1,variables:{empresa:'Teste'},currentStep:0,recentSteps:[],requestedStartRow:1};
  const legacySteps=steps.map(s=>({...s,on_failure:{action:'continuar'}}));
  await assert.rejects(context.executeRange(failedRun,legacySteps,0,legacySteps.length,context.loopPairs(legacySteps),context.buildFlowIndexes(legacySteps)),/B03.*Abrir guia.*Botão/);
  assert.ok(!failedRun.recentSteps.some(s=>s.index===3));assert.match(failedRun.lastError,/G-123/);assert.equal(failedRun.totalSteps,8);
 }finally{await browser.close();}
});

const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const file=process.env.TABLE_READER_FILE||path.resolve(__dirname,'../flowdetect_chrome/table-reader.js');
test('table runtime captures list variable, prepares loop rows and clears stale values after errors',async()=>{
 const vm=require('node:vm');const source=await fs.readFile(path.resolve(__dirname,'../flowdetect_chrome/service_worker.js'),'utf8');
 let fail=false;const context=vm.createContext({setInterval,clearInterval,setTimeout,chrome:{scripting:{executeScript:async request=>request.func?[{frameId:0,result:fail?{ok:false,error:'Tabela ausente'}:{ok:true,columns:['Nome','Total'],rows:[{Nome:'Ana',Total:'10,00'}],row_count:1,value:'[{"Nome":"Ana","Total":"10,00"}]'}}]:[]}},replaceVariables:x=>x});
 vm.runInContext(source.slice(source.indexOf('async function executeStep('),source.indexOf('function loopPairs(')),context);
 const run={tabId:42,currentIndex:2,variables:{dados:'stale'},capturedVariables:{dados:'stale'}};
 const step={type:'table_read',table:{variable:'dados',mode:'list',prepare_loop:true}};
 await context.executeStep(run,step);assert.equal(run.dataSource.rows[0].Nome,'Ana');assert.equal(run.dataSource.values[0],'Ana');assert.equal(run.dataSource.index,2);assert.match(run.variables.dados,/10,00/);
 fail=true;await assert.rejects(context.executeStep(run,step),/Tabela ausente/);assert.ok(!Object.hasOwn(run.variables,'dados'));assert.ok(!Object.hasOwn(run.capturedVariables,'dados'));
});
test('row click runtime requires a live run, matching tab and one-use permission, and sends a click step without overwriting variables',async()=>{
 const vm=require('node:vm');const source=await fs.readFile(path.resolve(__dirname,'../flowdetect_chrome/service_worker.js'),'utf8');
 const run={id:'run1',tabId:42,variables:{saved:'keep'},pendingTableClick:'nonce'};
 const messages=[];const context=vm.createContext({setInterval,clearInterval,setTimeout,activeRuns:new Map([['run1',run]]),crypto:{randomUUID:()=> 'fresh'},replaceVariables:x=>x,chrome:{scripting:{executeScript:async request=>{if(!request.func)return [];messages.push(request.args[0]);return [{frameId:0,result:{ok:true,clicked:true,action:'Detalhes',key:'Guia',value:'001'}}];}}}});
 vm.runInContext(source.slice(source.indexOf('async function handleMessage('),source.indexOf('chrome.runtime.onMessage.addListener(')),context);
 const permit={type:'flowdetect-table-permit-click',runId:'run1',nonce:'nonce'};
 assert.equal((await context.handleMessage(permit,{tab:{id:43}})).allowed,false);
 assert.equal((await context.handleMessage(permit,{tab:{id:42}})).allowed,true);
 assert.equal((await context.handleMessage(permit,{tab:{id:42}})).allowed,false);
 run.cancelled=true;run.pendingTableClick='nonce';assert.equal((await context.handleMessage(permit,{tab:{id:42}})).allowed,false);run.cancelled=false;
 vm.runInContext(source.slice(source.indexOf('async function executeStep('),source.indexOf('function loopPairs(')),context);
 await context.executeStep(run,{type:'table_read',table:{mode:'click',match_column:'Guia',match_value:'001'}});
 assert.equal(messages[0].type,'flowdetect-table-click');assert.equal(messages[0].runId,'run1');assert.equal(messages[0].nonce,'fresh');assert.equal(run.variables.saved,'keep');assert.ok(!run.pendingTableClick);
 await assert.rejects(context.executeStep(run,{type:'table_read',table:{mode:'click',match_column:'Guia',match_value:'{{Guia}}'}}),/Criar percurso no mapa/);
 assert.equal(messages.length,1);
});
async function pageFor(html,fn){const browser=await chromium.launch({headless:true});try{const page=await browser.newPage();await page.route('https://example.test/**',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:html}));await page.goto('https://example.test/');await page.evaluate(()=>{window.chrome={runtime:{onMessage:{addListener:()=>{}}}};});await page.addScriptTag({path:file});await fn(page);}finally{await browser.close();}}
const native='<table><thead><tr><th>Nome</th><th>Total</th></tr></thead><tbody><tr><td>Ana</td><td>10,50</td></tr><tr><td>João</td><td>20,00</td></tr></tbody></table>';
test('FGTS ngx accessibility wrapper keeps body rows and both action buttons visible to mapping and execution',async()=>{
 const html=`<br-table><ngx-datatable><div class="visible"><div role="table">
 <datatable-header role="rowgroup"><div role="row"><datatable-header-cell role="columnheader">Número da Guia</datatable-header-cell><datatable-header-cell role="columnheader">Ações</datatable-header-cell></div></datatable-header>
 <datatable-body role="rowgroup"><datatable-scroller><datatable-row-wrapper><datatable-body-row role="row"><div class="datatable-row-center">
 <datatable-body-cell role="cell"><div>GUIA-001</div></datatable-body-cell><datatable-body-cell role="cell"><div class="row-actions">
 <button tooltip="Detalhar guia" type="button"><span class="sr-only">Detalhar guia</span><i aria-hidden="true" class="fas fa-eye"></i></button>
 <div dropdown><button type="button" aria-label="Abrir menu de opções de impressão"><span class="sr-only">Opções de impressão</span><i aria-hidden="true" class="fa fa-ellipsis-v"></i></button></div>
 </div></datatable-body-cell></div></datatable-body-row></datatable-row-wrapper></datatable-scroller></datatable-body>
 </div></div><datatable-footer><div class="indices">1-1 de 1 itens</div></datatable-footer></ngx-datatable></br-table>
 <style>ngx-datatable,datatable-header,datatable-header-cell,datatable-body,datatable-body-row,datatable-body-cell,datatable-row-wrapper,datatable-scroller{display:block}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden}</style>`;
 await pageFor(html,async page=>{
  const result=await page.evaluate(async()=>{
   window.clicked=[];document.querySelector('.row-actions').addEventListener('click',event=>{const b=event.target.closest('button');if(b)clicked.push(b.querySelector('i').className);});
   const d=FlowDetectTables.describe(document.querySelector('ngx-datatable'));
   const read=await FlowDetectTables.read({descriptor:d.descriptor,columns:['Número da Guia'],all_pages:true});
   await FlowDetectTables.clickRow({descriptor:d.descriptor,action:d.actions[0][0],match_column:'Número da Guia',match_value:'GUIA-001'},async()=>true);
   await FlowDetectTables.clickRow({descriptor:d.descriptor,action:d.actions[0][1],match_column:'Número da Guia',match_value:'GUIA-001'},async()=>true);
   return {d,read,clicked};
  });assert.equal(result.d.rows.length,1);assert.equal(result.d.actions[0].length,2);assert.equal(result.read.row_count,1);assert.deepEqual(result.clicked,['fas fa-eye','fa fa-ellipsis-v']);
 });
});

test('preview rejects a table that reports records before its rows are loaded',async()=>pageFor('<br-table>'+native.replace(/<tbody>.*?<\/tbody>/,'<tbody></tbody>')+'<div class="indices">1-2 de 2 itens</div></br-table>',async page=>{
 const error=await page.evaluate(()=>{try{FlowDetectTables.describe(document.querySelector('table'));}catch(e){return e.message;}});assert.match(error,/carregamento/);
}));
test('table schema follows headers across regenerated IDs and reads selected columns / one value',async()=>pageFor(native,async page=>{
 const r=await page.evaluate(async()=>{const d=FlowDetectTables.describe(document.querySelector('table'));document.querySelector('table').id='changed-angular-id';const c={descriptor:d.descriptor,columns:['Total'],mode:'list'};const all=await FlowDetectTables.read(c);const one=await FlowDetectTables.read({...c,mode:'value',match_column:'Nome',match_value:'Joao'});return {d,all,one};});
 assert.equal(r.all.row_count,2);assert.deepEqual(r.all.rows,[{Total:'10,50'},{Total:'20,00'}]);assert.equal(r.one.value,'20,00');assert.ok(!JSON.stringify(r.d.descriptor).includes('changed-angular-id'));
}));
test('ngx table excludes summary row and supports verified pagination without repeating / dropping rows',async()=>{
 const html='<br-table><ngx-datatable><datatable-header><datatable-header-cell>Nome</datatable-header-cell><datatable-header-cell>Total</datatable-header-cell></datatable-header><datatable-body><datatable-body-row><datatable-body-cell>Ana</datatable-body-cell><datatable-body-cell>10,00</datatable-body-cell></datatable-body-row><datatable-summary-row><datatable-body-row><datatable-body-cell>Total</datatable-body-cell><datatable-body-cell>30,00</datatable-body-cell></datatable-body-row></datatable-summary-row></datatable-body></ngx-datatable><div class="indices">1-1 de 2 itens</div><button aria-label="Página seguinte">Próxima</button></br-table><style>ngx-datatable,datatable-header,datatable-header-cell,datatable-body,datatable-body-row,datatable-body-cell,datatable-summary-row{display:block}</style>';
 await pageFor(html,async page=>{
  await page.evaluate(()=>document.querySelector('button').onclick=()=>{document.querySelector('datatable-body-row').innerHTML='<datatable-body-cell>João</datatable-body-cell><datatable-body-cell>20,00</datatable-body-cell>';document.querySelector('.indices').textContent='2-2 de 2 itens';document.querySelector('button').disabled=true;});
  const r=await page.evaluate(async()=>{const d=FlowDetectTables.describe(document.querySelector('ngx-datatable'));const result=await FlowDetectTables.read({descriptor:d.descriptor,columns:['Nome','Total'],all_pages:true});return {preview:d.rows,result};});
  assert.equal(r.preview.length,1);assert.equal(r.result.row_count,2);assert.deepEqual(r.result.rows.map(x=>x.Total),['10,00','20,00']);
 });
});
test('duplicate matches, wrong site and ambiguous row capture fail instead of returning guessed data',async()=>pageFor(native+native,async page=>{
 const r=await page.evaluate(async()=>{const d=FlowDetectTables.describe(document.querySelector('table'));const c={descriptor:d.descriptor,columns:['Total']};const errors=[];try{await FlowDetectTables.read(c);}catch(e){errors.push(e.message);}try{await FlowDetectTables.read({...c,descriptor:{...d.descriptor,origin:'https://wrong.test'}});}catch(e){errors.push(e.message);}document.querySelectorAll('table')[1].remove();try{await FlowDetectTables.read({...c,mode:'value',match_column:'Nome',match_value:'Missing'});}catch(e){errors.push(e.message);}return errors;});assert.equal(r.length,3);
}));
test('mapping picker intercepts the table click without activating row actions and removes overlays',async()=>pageFor(native,async page=>{
 await page.evaluate(()=>{window.clicked=0;document.querySelector('table').onclick=()=>clicked++;window.mapping=FlowDetectTables.pick();});await page.locator('td').first().click();
 const r=await page.evaluate(async()=>({result:await mapping,clicked,overlays:[...document.querySelectorAll('div')].filter(e=>e.textContent.includes('FlowDetect:')).length}));assert.equal(r.clicked,0);assert.deepEqual(r.result.columns,['Nome','Total']);assert.equal(r.overlays,0);
}));
test('return control mapping does not click and mapped close requires permission before returning',async()=>pageFor(native+'<button aria-label="Fechar detalhe">Voltar</button>',async page=>{
 await page.evaluate(()=>{window.returnClicks=0;document.querySelector('[aria-label="Fechar detalhe"]').onclick=()=>returnClicks++;window.selectedControl=FlowDetectTables.pick('control');});
 await page.locator('[aria-label="Fechar detalhe"]').click();
 const result=await page.evaluate(async()=>{const mapped=await selectedControl;const before=returnClicks;let stopped=false;try{await FlowDetectTables.returnToList({return_control:mapped.control},async()=>false);}catch{stopped=true;}await FlowDetectTables.returnToList({return_control:mapped.control},async()=>true);return {before,after:returnClicks,stopped};});
 assert.equal(result.before,0);assert.equal(result.after,1);assert.ok(result.stopped);
}));

test('row action chooses the eye by row key after reordering and refuses ambiguous, disabled or stopped clicks',async()=>{
 const html='<table><thead><tr><th>Guia</th><th>Ações</th></tr></thead><tbody>'+['001','002'].map(id=>`<tr><td>${id}</td><td><button class="eye"><i class="fas fa-eye"></i></button><button class="more"><i class="fas fa-ellipsis-v"></i></button></td></tr>`).join('')+'</tbody></table>';
 await pageFor(html,async page=>{
  const r=await page.evaluate(async()=>{
   window.clicks=[];document.querySelector('table').addEventListener('click',e=>{const b=e.target.closest('button');if(b)clicks.push([b.closest('tr').cells[0].textContent,b.className]);});
   const d=FlowDetectTables.describe(document.querySelector('table'));
   const c={descriptor:d.descriptor,mode:'click',action:d.actions[0][0],match_column:'Guia',match_value:'002'};
   document.querySelector('tbody').prepend(document.querySelector('tbody tr:last-child'));
   await FlowDetectTables.clickRow(c,async()=>true);
   const errors=[];
   document.querySelector('tbody tr .eye').disabled=true;
   try{await FlowDetectTables.clickRow(c,async()=>true);}catch(e){errors.push(e.message);}
   document.querySelector('tbody tr .eye').disabled=false;
   try{await FlowDetectTables.clickRow(c,async()=>false);}catch(e){errors.push(e.message);}
   document.querySelector('tbody tr td:last-child').append(document.querySelector('tbody tr .eye').cloneNode(true));
   try{await FlowDetectTables.clickRow(c,async()=>true);}catch(e){errors.push(e.message);}
   document.querySelector('tbody').append(document.querySelector('tbody tr').cloneNode(true));
   try{await FlowDetectTables.clickRow(c,async()=>true);}catch(e){errors.push(e.message);}
   return {clicks,errors,actions:d.actions[0]};
  });
  assert.deepEqual(r.clicks,[['002','eye']]);assert.equal(r.errors.length,4);assert.equal(r.actions.length,2);assert.equal(r.actions[0].label,'Ver detalhes');
 });
});

test('row action returns to first page, validates uniqueness across pages and clicks each requested key once',async()=>{
 const html='<br-table><table><thead><tr><th>Guia</th><th>Ações</th></tr></thead><tbody></tbody></table><div class="indices"></div><button aria-label="Página anterior">Anterior</button><button aria-label="Página seguinte">Próxima</button></br-table>';
 await pageFor(html,async page=>{
  const r=await page.evaluate(async()=>{
   window.clicks=[];let current=1;
   const render=()=>{document.querySelector('tbody').innerHTML=`<tr><td>00${current}</td><td><button aria-label="Detalhes">Olho</button></td></tr>`;document.querySelector('.indices').textContent=`${current}-${current} de 2 itens`;document.querySelector('[aria-label="Página anterior"]').disabled=current===1;document.querySelector('[aria-label="Página seguinte"]').disabled=current===2;document.querySelector('tbody button').onclick=()=>clicks.push(current);};
   document.querySelector('[aria-label="Página anterior"]').onclick=()=>{current--;render();};document.querySelector('[aria-label="Página seguinte"]').onclick=()=>{current++;render();};render();
   const d=FlowDetectTables.describe(document.querySelector('table'));
   current=2;render();
   for(const id of ['001','002'])await FlowDetectTables.clickRow({descriptor:d.descriptor,action:d.actions[0][0],match_column:'Guia',match_value:id},async()=>true);
   return clicks;
  });assert.deepEqual(r,[1,2]);
 });
});


test('Studio-sorted JSON signatures match row and return buttons without relaxing ambiguity checks',async()=>pageFor('<table><thead><tr><th>Guide</th><th>Actions</th></tr></thead><tbody><tr><td>001</td><td><button title="Detail"><i class="fa-eye"></i></button><button title="Menu"><i class="fa-ellipsis-v"></i></button></td></tr></tbody></table><button id="close" title="Close">Close</button>',async page=>{
 const result=await page.evaluate(async()=>{
  const sorted=o=>Object.fromEntries(Object.entries(o).sort(([a],[b])=>a.localeCompare(b)));
  const d=FlowDetectTables.describe(document.querySelector('table'));
  const action={...d.actions[0][0],signature:sorted(d.actions[0][0].signature)};
  window.clicked=[];document.querySelector('tbody button').onclick=()=>clicked.push('eye');document.querySelector('#close').onclick=()=>clicked.push('close');
  await FlowDetectTables.clickRow({descriptor:d.descriptor,action,match_column:'Guide',match_value:'001'},async()=>true);
  const control={signature:sorted({tag:'button',aria:'',title:'Close',text:'Close',icons:''}),origin:location.origin,pathname:location.pathname};
  await FlowDetectTables.returnToList({return_control:control},async()=>true);
  document.querySelector('tbody td:last-child').append(document.querySelector('tbody button').cloneNode(true));
  let refused=false;try{await FlowDetectTables.clickRow({descriptor:d.descriptor,action,match_column:'Guide',match_value:'001'},async()=>true);}catch{refused=true;}
  return {clicked,refused};
 });assert.deepEqual(result.clicked,['eye','close']);assert.equal(result.refused,true);
}));


test('complete detail capture resets a retained second page and still rejects a missing last page',async()=>pageFor('<br-table><table><thead><tr><th>Name</th><th>Total</th></tr></thead><tbody></tbody></table><div class="indices"></div><button id="btn-last-page">Previous</button><button id="btn-next-page">Next</button></br-table>',async page=>{
 const result=await page.evaluate(async()=>{
  let current=2;window.pageChanges=[];
  const render=()=>{document.querySelector('tbody').innerHTML=`<tr><td>Person ${current}</td><td>${current},00</td></tr>`;document.querySelector('.indices').textContent=`${current}-${current} de 2 itens`;document.querySelector('#btn-last-page').disabled=current===1;document.querySelector('#btn-next-page').disabled=current===2;};
  document.querySelector('#btn-last-page').onclick=()=>{pageChanges.push('previous');current--;render();};
  document.querySelector('#btn-next-page').onclick=()=>{pageChanges.push('next');current++;render();};render();
  const d=FlowDetectTables.describe(document.querySelector('table')).descriptor;
  const captured=await FlowDetectTables.read({descriptor:d,columns:d.headers,all_pages:true});
  current=1;render();document.querySelector('#btn-next-page').disabled=true;
  let error='';try{await FlowDetectTables.read({descriptor:d,columns:d.headers,all_pages:true});}catch(e){error=e.message;}
  return {captured,pageChanges,error};
 });assert.deepEqual(result.captured.rows.map(r=>r.Name),['Person 1','Person 2']);assert.deepEqual(result.pageChanges,['previous','next']);assert.match(result.error,/1 de 2/);
}));


test('detail capture ignores inactive tabs and transparent old dialogs, selects foreground dialog and refuses real duplicates',async()=>pageFor('<main></main>',async page=>{
 const result=await page.evaluate(async()=>{
  const table=value=>`<table><thead><tr><th>Name</th><th>Total</th></tr></thead><tbody><tr><td>${value}</td><td>1,00</td></tr></tbody></table>`;
  document.querySelector('main').innerHTML=table('background')+'<button role="tab" aria-controls="inactive" aria-selected="false">Old tab</button><section role="tabpanel" id="inactive">'+table('inactive')+'</section><div role="dialog" style="opacity:0">'+table('old dialog')+'</div><div role="dialog" id="active" style="position:fixed;inset:10px;background:white;z-index:10">'+table('current')+'<button title="Close">Close</button></div>';
  const descriptor=FlowDetectTables.describe(document.querySelector('#active table')).descriptor;
  const first=await FlowDetectTables.read({descriptor,columns:['Name'],all_pages:true});
  document.querySelector('#active').insertAdjacentHTML('beforeend',table('duplicate'));
  let refused=false;try{await FlowDetectTables.read({descriptor,columns:['Name']});}catch{refused=true;}
  document.querySelectorAll('#active table')[1].remove();
  document.querySelector('main').insertAdjacentHTML('beforeend','<div role="dialog" style="position:fixed;inset:10px;background:white;z-index:20">'+table('new foreground')+'</div>');
  const second=await FlowDetectTables.read({descriptor,columns:['Name'],all_pages:true});
  return {first:first.rows,second:second.rows,refused};
 });assert.deepEqual(result.first,[{Name:'current'}]);assert.deepEqual(result.second,[{Name:'new foreground'}]);assert.equal(result.refused,true);
}));


test('FGTS 11-column detail captures 16 rows while Angular replaces and temporarily duplicates its table',async()=>pageFor('<main></main><style>ngx-datatable,datatable-header,datatable-body,datatable-body-row,datatable-body-cell,datatable-summary-row{display:block}datatable-header-cell{display:inline-block}</style>',async page=>{
 const result=await page.evaluate(async()=>{
  const columns=['Coluna 1','Competencia de Apuracao','Competencia de Referencia','Vencimento','Nome Trabalhador','FGTS Mensal','FGTS Rescisorio','Indenizacao Compensatoria','FGTS Processo Trabalhista','Encargos FGTS','Total'];
  const render=n=>{
   const start=n===1?1:11,end=n===1?10:16;
   const row=i=>'<datatable-body-row role="row"><div>'+columns.map((c,j)=>`<datatable-body-cell role="cell">${j===4?'Person '+i:j===10?'155,61':''}</datatable-body-cell>`).join('')+'</div></datatable-body-row>';
   return `<br-table><ngx-datatable><div role="table"><datatable-header>${columns.map(c=>`<datatable-header-cell role="columnheader">${c==='Coluna 1'?'':c}</datatable-header-cell>`).join('')}</datatable-header><datatable-body>${Array.from({length:end-start+1},(_,i)=>row(start+i)).join('')}<datatable-summary-row>${row(999)}</datatable-summary-row></datatable-body></div><datatable-footer><div class="indices">${start}-${end} de 16 itens</div><button id="btn-last-page" ${n===1?'disabled':''}>Previous</button><button id="btn-next-page" ${n===2?'disabled':''}>Next</button></datatable-footer></ngx-datatable></br-table>`;
  };
  const main=document.querySelector('main');main.innerHTML=render(1);
  main.querySelector('#btn-next-page').onclick=()=>{
   main.innerHTML='';
   setTimeout(()=>{main.innerHTML=render(2)+render(2);},180);
   setTimeout(()=>{main.querySelector('br-table')?.remove();},400);
  };
  const descriptor=FlowDetectTables.describe(main.querySelector('ngx-datatable')).descriptor;
  return FlowDetectTables.read({descriptor,columns:descriptor.headers,all_pages:true,wait_ready:true});
 });assert.equal(result.row_count,16);assert.deepEqual(result.rows.map(r=>r['Nome Trabalhador']),Array.from({length:16},(_,i)=>'Person '+(i+1)));
}));


test('five consecutive details close only their captured dialog and wait for the fifth close button to enable',async()=>pageFor('<button aria-label="Close" id="background-close"></button><main></main>',async page=>{
 const result=await page.evaluate(async()=>{
  window.closedGuides=[];window.background=0;document.querySelector('#background-close').onclick=()=>background++;
  const descriptor={origin:location.origin,pathname:location.pathname,headers:['Worker','Amount']};
  const control={origin:location.origin,pathname:location.pathname,signature:{aria:'Close',icons:'',tag:'button',text:'',title:''}};
  for(let guide=1;guide<=5;guide++){
   document.querySelector('main').innerHTML=`<div role="dialog" style="position:fixed;inset:10px;background:white"><button aria-label="Close" ${guide===5?'disabled':''}></button><table><thead><tr><th>Worker</th><th>Amount</th></tr></thead><tbody><tr><td>Worker ${guide}</td><td>155,61</td></tr></tbody></table></div>`;
   const dialog=document.querySelector('[role="dialog"]'),button=dialog.querySelector('button');button.onclick=()=>{closedGuides.push(guide);dialog.remove();};
   await FlowDetectTables.read({descriptor,columns:descriptor.headers,accumulate:true});
   if(guide===5)setTimeout(()=>button.disabled=false,250);
   await FlowDetectTables.returnToList({return_control:control,wait_ready:true},async()=>true);
  }
  return {closed:closedGuides,background};
 });assert.deepEqual(result.closed,[1,2,3,4,5]);assert.equal(result.background,0);
}));

test('return refuses two close buttons in the captured dialog and does not click without permission',async()=>pageFor('<div role="dialog"><button aria-label="Close"></button><button aria-label="Close"></button><table><thead><tr><th>Worker</th></tr></thead><tbody><tr><td>Example</td></tr></tbody></table></div>',async page=>{
 const result=await page.evaluate(async()=>{
  const descriptor=FlowDetectTables.describe(document.querySelector('table')).descriptor;
  const control={origin:location.origin,pathname:location.pathname,signature:{tag:'button',aria:'Close',title:'',text:'',icons:''}};
  await FlowDetectTables.read({descriptor,columns:descriptor.headers,accumulate:true});
  window.clicks=0;document.querySelectorAll('button').forEach(b=>b.onclick=()=>clicks++);
  let duplicate='',stopped='';try{await FlowDetectTables.returnToList({return_control:control},async()=>true);}catch(e){duplicate=e.message;}
  document.querySelector('button').remove();
  try{await FlowDetectTables.returnToList({return_control:control},async()=>false);}catch(e){stopped=e.message;}
  return {duplicate,stopped,clicks};
 });assert.match(result.duplicate,/2/);assert.ok(result.stopped);assert.equal(result.clicks,0);
}));


test('return waits for delayed modal removal even while the guide list is visible behind it',async()=>pageFor('<main></main>',async page=>{
 const result=await page.evaluate(async()=>{
  document.querySelector('main').innerHTML='<table><thead><tr><th>Guide</th></tr></thead><tbody><tr><td>001</td></tr></tbody></table><div role="dialog"><button aria-label="Close"></button><table><thead><tr><th>Worker</th></tr></thead><tbody><tr><td>Example</td></tr></tbody></table></div>';
  const dialog=document.querySelector('[role="dialog"]'),descriptor=FlowDetectTables.describe(dialog.querySelector('table')).descriptor;
  document.querySelector('button').onclick=()=>setTimeout(()=>dialog.remove(),300);
  await FlowDetectTables.read({descriptor,columns:descriptor.headers,accumulate:true});
  await FlowDetectTables.returnToList({return_control:{origin:location.origin,pathname:location.pathname,signature:{tag:'button',aria:'Close',title:'',text:'',icons:''}}},async()=>true);
  return {closed:!dialog.isConnected,listPresent:!!document.querySelector('table')};
 });assert.equal(result.closed,true);assert.equal(result.listPresent,true);
}));

test('open detail blocks clicks through the background list and mismatched guide data is never captured',async()=>pageFor('<table id="guides"><thead><tr><th>Guide</th><th>Actions</th></tr></thead><tbody><tr><td>0126082857593920-4</td><td><button title="Detail"></button></td></tr></tbody></table><div role="dialog"><p>Numero da Guia 0126082757466353-3</p><table><thead><tr><th>Worker</th></tr></thead><tbody><tr><td>Example</td></tr></tbody></table></div>',async page=>{
 const result=await page.evaluate(async()=>{
  window.clicks=0;document.querySelector('button').onclick=()=>clicks++;
  const list=FlowDetectTables.describe(document.querySelector('#guides')),detail=FlowDetectTables.describe(document.querySelector('[role="dialog"] table'));
  let openError='',readError='';
  try{await FlowDetectTables.clickRow({descriptor:list.descriptor,action:list.actions[0][0],match_column:'Guide',match_value:'0126082857593920-4'},async()=>true);}catch(e){openError=e.message;}
  try{await FlowDetectTables.read({descriptor:detail.descriptor,columns:detail.columns,accumulate:true,expected_guide:'0126082857593920-4'});}catch(e){readError=e.message;}
  return {clicks,openError,readError};
 });assert.equal(result.clicks,0);assert.match(result.openError,/detalhe/);assert.match(result.readError,/0126082757466353-3/);assert.match(result.readError,/0126082857593920-4/);
}));

test('upgrading table runtime unregisters its previous message listener',async()=>pageFor(native,async page=>{
 await page.evaluate(()=>{window.removed=0;chrome.runtime.onMessage.removeListener=()=>removed++;FlowDetectTables.version='old';});
 await page.addScriptTag({path:file});
 assert.equal(await page.evaluate(()=>removed),1);
}));


test('table transport never retries a mutation if the injected result is lost',async()=>{
 const vm=require('node:vm'),source=await fs.readFile(path.resolve(__dirname,'../flowdetect_chrome/service_worker.js'),'utf8');
 let injected=0;const run={id:'one',tabId:42,variables:{}};
 const context=vm.createContext({setInterval,clearInterval,setTimeout,crypto:{randomUUID:()=> 'one-nonce'},replaceVariables:x=>x,chrome:{scripting:{executeScript:async request=>{if(request.func){injected++;return []; }return []; }},tabs:{sendMessage:async()=>{throw Error('Old messaging transport must not be used');}}}});
 vm.runInContext(source.slice(source.indexOf('async function executeStep('),source.indexOf('function loopPairs(')),context);
 await assert.rejects(context.executeStep(run,{type:'table_read',table:{mode:'click',match_column:'Guide',match_value:'001'}}),/Nenhum clique/);
 assert.equal(injected,1);assert.ok(!run.pendingTableClick);
 run.cancelled=true;
 await assert.rejects(context.executeStep(run,{type:'table_read',table:{mode:'click',match_column:'Guide',match_value:'001'}}));assert.equal(injected,1);
});


test('direct close authorization does not wait on a nested runtime message',async()=>{
 const vm=require('node:vm'),source=await fs.readFile(path.resolve(__dirname,'../flowdetect_chrome/service_worker.js'),'utf8');
 let nested=0,clicks=0;const run={id:'close-run',tabId:42,variables:{}};
 const context=vm.createContext({setInterval,clearInterval,setTimeout,crypto:{randomUUID:()=> 'close-once'},replaceVariables:x=>x,FlowDetectTables:{returnToList:async(_config,permit)=>{assert.equal(await permit(),true);assert.equal(await permit(),false);clicks++;return {returned:true};},waitReady:async()=>({}),describe:()=>({})},chrome:{runtime:{sendMessage:()=>{nested++;return new Promise(()=>{});}},scripting:{executeScript:async request=>request.func?[{frameId:0,result:await request.func(request.args[0])}]:[]}}});
 vm.runInContext(source.slice(source.indexOf('async function executeStep('),source.indexOf('function loopPairs(')),context);
 await context.executeStep(run,{type:'table_read',table:{mode:'return',return_mode:'button',descriptor:{}}});
 assert.equal(nested,0);assert.equal(clicks,1);assert.ok(!run.pendingTableClick);
});

test('stop aborts a hanging close and revoked authorization prevents a late click',async()=>{
 const vm=require('node:vm'),source=await fs.readFile(path.resolve(__dirname,'../flowdetect_chrome/service_worker.js'),'utf8');
 let release,clicks=0;const gate=new Promise(resolve=>release=resolve),run={id:'stop-close',tabId:42,variables:{}};
 const context=vm.createContext({setInterval,clearInterval,setTimeout,crypto:{randomUUID:()=> 'stop-once'},replaceVariables:x=>x,FlowDetectTables:{returnToList:async(_config,permit)=>{await gate;if(await permit())clicks++;return {returned:true};}},chrome:{scripting:{executeScript:async request=>request.func?[{frameId:0,result:await request.func(request.args[0])}]:[]}}});
 vm.runInContext(source.slice(source.indexOf('async function executeStep('),source.indexOf('function loopPairs(')),context);
 const pending=context.executeStep(run,{type:'table_read',table:{mode:'return',return_mode:'button'}});
 setTimeout(()=>run.cancelled=true,20);
 await assert.rejects(pending,/interrompida/);release();await new Promise(resolve=>setTimeout(resolve,30));
 assert.equal(clicks,0);assert.ok(!run.pendingTableClick);
});

test('hanging close has a worker deadline and cannot click after expiry',async()=>{
 const vm=require('node:vm'),source=await fs.readFile(path.resolve(__dirname,'../flowdetect_chrome/service_worker.js'),'utf8');
 let offset=0,release,clicks=0;const gate=new Promise(resolve=>release=resolve),run={id:'timeout-close',tabId:42,variables:{}};
 const context=vm.createContext({setInterval,clearInterval,setTimeout,Date:{now:()=>Date.now()+offset},crypto:{randomUUID:()=> 'expires'},replaceVariables:x=>x,FlowDetectTables:{returnToList:async(_config,permit)=>{await gate;if(await permit())clicks++;return {returned:true};}},chrome:{scripting:{executeScript:async request=>request.func?[{frameId:0,result:await request.func(request.args[0])}]:[]}}});
 vm.runInContext(source.slice(source.indexOf('async function executeStep('),source.indexOf('function loopPairs(')),context);
 const pending=context.executeStep(run,{type:'table_read',table:{mode:'return',return_mode:'button'}});
 setTimeout(()=>offset=21000,20);
 await assert.rejects(pending,/Tempo limite/);release();await new Promise(resolve=>setTimeout(resolve,30));assert.equal(clicks,0);
});


test('configure then execute in the same document cancels a leftover picker before closing the detail',async()=>pageFor('<div role="dialog"><button aria-label="Close"></button>'+native+'</div>',async page=>{
 const result=await page.evaluate(async()=>{
  const dialog=document.querySelector('[role="dialog"]'),button=dialog.querySelector('button'),descriptor=FlowDetectTables.describe(dialog.querySelector('table')).descriptor;
  window.closedGuides=0;button.onclick=()=>{closedGuides++;dialog.remove();};
  await FlowDetectTables.read({descriptor,columns:descriptor.headers,accumulate:true});
  const mapping=FlowDetectTables.pick('control').then(()=> 'selected',()=> 'cancelled');
  await FlowDetectTables.returnToList({return_control:{origin:location.origin,pathname:location.pathname,signature:{tag:'button',aria:'Close',title:'',text:'',icons:''}}},async()=>true);
  return {closedGuides,mapping:await mapping,dialogOpen:dialog.isConnected,overlays:[...document.querySelectorAll('div')].filter(e=>e.textContent.includes('FlowDetect:')).length};
 });assert.equal(result.closedGuides,1);assert.equal(result.mapping,'cancelled');assert.equal(result.dialogOpen,false);assert.equal(result.overlays,0);
}));

test('starting table execution clears the general element picker in the same page',async()=>pageFor(native,async page=>{
 const result=await page.evaluate(async()=>{
  window.stopped=0;globalThis.__flowDetectElementPickerStop=()=>stopped++;
  const descriptor=FlowDetectTables.describe(document.querySelector('table')).descriptor;
  const pending=FlowDetectTables.pick().then(()=> 'selected',()=> 'cancelled');
  const read=await FlowDetectTables.read({descriptor,columns:descriptor.headers});
  return {stopped,mapping:await pending,count:read.row_count};
 });assert.ok(result.stopped>0);assert.equal(result.mapping,'cancelled');assert.equal(result.count,2);
}));


test('return waits for the government scrim after its modal disappears and never opens a guide behind it',async()=>pageFor('<main></main>',async page=>{
 const result=await page.evaluate(async()=>{
  document.querySelector('main').innerHTML='<div class="br-scrim-util" style="position:fixed;inset:0;background:#0008;z-index:10"><div class="br-modal"><button aria-label="Close"></button><table><thead><tr><th>Worker</th></tr></thead><tbody><tr><td>Example</td></tr></tbody></table></div></div>';
  const mask=document.querySelector('.br-scrim-util'),dialog=mask.querySelector('.br-modal'),descriptor=FlowDetectTables.describe(dialog.querySelector('table')).descriptor;
  document.querySelector('button').onclick=()=>{dialog.remove();setTimeout(()=>mask.remove(),300);};
  await FlowDetectTables.read({descriptor,columns:descriptor.headers,accumulate:true});
  const phases=[];
  await FlowDetectTables.returnToList({return_control:{origin:location.origin,pathname:location.pathname,signature:{tag:'button',aria:'Close',title:'',text:'',icons:''}}},async()=>true,p=>phases.push(p));
  return {maskGone:!mask.isConnected,phases};
 });assert.equal(result.maskGone,true);assert.ok(result.phases.some(p=>p.includes('camada cinza')));
}));

test('orphan scrim blocks a click through the guide list even without a remaining dialog',async()=>pageFor('<table><thead><tr><th>Guide</th><th>Actions</th></tr></thead><tbody><tr><td>001</td><td><button title="Detail"></button></td></tr></tbody></table><div class="br-scrim-util" style="position:fixed;inset:0;background:#0008"></div>',async page=>{
 const result=await page.evaluate(async()=>{
  window.clicks=0;document.querySelector('button').onclick=()=>clicks++;
  const mapped=FlowDetectTables.describe(document.querySelector('table'));let error='';
  try{await FlowDetectTables.clickRow({descriptor:mapped.descriptor,action:mapped.actions[0][0],match_column:'Guide',match_value:'001'},async()=>true);}catch(e){error=e.message;}
  return {clicks,error};
 });assert.equal(result.clicks,0);assert.ok(result.error);
}));


test('ngx-bootstrap fade host remains blocking until removed even after its content becomes transparent',async()=>pageFor('<main></main>',async page=>{
 const result=await page.evaluate(async()=>{
  const main=document.querySelector('main');main.innerHTML='<div class="modal-backdrop" style="position:fixed;inset:0;background:#0008"></div><modal-container role="dialog" aria-modal="true" class="modal fade show" style="display:block"><div class="modal-dialog"><div class="modal-content"><button aria-label="Close"></button><table><thead><tr><th>Worker</th></tr></thead><tbody><tr><td>Example</td></tr></tbody></table></div></div></modal-container>';
  const host=main.querySelector('modal-container'),mask=main.querySelector('.modal-backdrop'),descriptor=FlowDetectTables.describe(host.querySelector('table')).descriptor;
  host.querySelector('button').onclick=()=>{host.classList.remove('show');host.style.opacity='0';setTimeout(()=>{host.remove();mask.remove();},350);};
  await FlowDetectTables.read({descriptor,columns:descriptor.headers,accumulate:true});
  const phases=[];await FlowDetectTables.returnToList({return_control:{origin:location.origin,pathname:location.pathname,signature:{tag:'button',aria:'Close',title:'',text:'',icons:''}}},async()=>true,p=>phases.push(p));
  return {hostGone:!host.isConnected,maskGone:!mask.isConnected,phases};
 });assert.equal(result.hostGone,true);assert.equal(result.maskGone,true);assert.ok(result.phases.some(p=>p.includes('transparente')));
}));

test('transparent modal-container with aria-modal still true cannot be bypassed to open the next guide',async()=>pageFor('<table><thead><tr><th>Guide</th><th>Actions</th></tr></thead><tbody><tr><td>001</td><td><button title="Detail"></button></td></tr></tbody></table><modal-container role="dialog" aria-modal="true" class="modal fade" style="display:block;opacity:0"><div class="modal-dialog"><div class="modal-content"></div></div></modal-container>',async page=>{
 const result=await page.evaluate(async()=>{
  window.clicks=0;document.querySelector('button').onclick=()=>clicks++;
  const mapped=FlowDetectTables.describe(document.querySelector('table'));let error='';
  try{await FlowDetectTables.clickRow({descriptor:mapped.descriptor,action:mapped.actions[0][0],match_column:'Guide',match_value:'001'},async()=>true);}catch(e){error=e.message;}
  return {clicks,error};
 });assert.equal(result.clicks,0);assert.ok(result.error);
}));


test('native close generates trusted mouse events with input lock enabled across a real isolated world',async()=>pageFor('<table id="list"><thead><tr><th>Guide</th></tr></thead><tbody><tr><td>001</td></tr></tbody></table><div class="modal-backdrop" style="position:fixed;inset:0;background:#0008;z-index:10"></div><modal-container role="dialog" aria-modal="true" class="modal fade show" style="display:block;position:fixed;inset:20px;z-index:11;background:white"><div class="modal-dialog"><div class="modal-content"><button aria-label="Close"></button><table id="detail"><thead><tr><th>Worker</th></tr></thead><tbody><tr><td>Example</td></tr></tbody></table></div></div></modal-container>',async page=>{
 await page.evaluate(()=>{
  window.mainClickCalls=0;window.mouseEvents=[];window.trustedEvents=[];let mouseDown=false;
  const nativeClick=HTMLElement.prototype.click;HTMLElement.prototype.click=function(){if(this.getAttribute('aria-label')==='Close')mainClickCalls++;return nativeClick.call(this);};
  const button=document.querySelector('button'),host=document.querySelector('modal-container'),mask=document.querySelector('.modal-backdrop');
  button.style.cssText='display:block;width:50px;height:50px';const centerCover=document.createElement('div');centerCover.style.cssText='position:absolute;left:15px;top:15px;width:20px;height:20px;z-index:50';host.append(centerCover);
  for(const type of ['pointerdown','mousedown','pointerup','mouseup','click'])button.addEventListener(type,event=>{mouseEvents.push(type);trustedEvents.push(event.isTrusted);if(type==='mousedown')mouseDown=true;});
  button.onclick=event=>{host.classList.remove('show');host.style.opacity='0';if(mouseDown&&event.isTrusted)setTimeout(()=>{host.remove();mask.remove();},100);};
 });
 const client=await page.context().newCDPSession(page),tree=await client.send('Page.getFrameTree');
 const {executionContextId}=await client.send('Page.createIsolatedWorld',{frameId:tree.frameTree.frame.id,worldName:'flowdetect-close-regression'});
 const evaluate=async expression=>{const r=await client.send('Runtime.evaluate',{expression,contextId:executionContextId,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 await evaluate('globalThis.chrome={runtime:{onMessage:{addListener(){},removeListener(){}},sendMessage:async()=>({locked:true,runId:"realm-close"})}}');
 await evaluate(await fs.readFile(path.resolve(__dirname,'../flowdetect_chrome/input-lock.js'),'utf8'));
 await evaluate(await fs.readFile(file,'utf8'));
 const descriptor={origin:'https://example.test',pathname:'/',headers:['Worker']};
 await evaluate('FlowDetectTables.read('+JSON.stringify({descriptor,columns:['Worker'],accumulate:true})+')');
 const vm=require('node:vm'),source=await fs.readFile(process.env.TABLE_WORKER_FILE||path.resolve(__dirname,'../flowdetect_chrome/service_worker.js'),'utf8');
 let mainInjections=0;const context=vm.createContext({setInterval,clearInterval,setTimeout,crypto:{randomUUID:()=> 'realm-close-once'},replaceVariables:x=>x,chrome:{debugger:{attach:async()=>{await page.evaluate(()=>{const r=document.querySelector('button').getBoundingClientRect(),cover=document.createElement('div');cover.style.cssText=`position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;z-index:9999`;document.body.append(cover);setTimeout(()=>cover.remove(),250);});},detach:async()=>{},sendCommand:async(_target,method,params)=>client.send(method,params)},scripting:{executeScript:async request=>{
  if(request.files){await evaluate(await fs.readFile(file,'utf8'));return [];}
  if(request.world==='MAIN'){mainInjections++;return [{frameId:0,result:await page.evaluate(request.func,request.args[0])}];}
  return [{frameId:0,result:await evaluate('('+request.func.toString()+')('+JSON.stringify(request.args[0])+')')}];
 }}}});
 vm.runInContext(source.slice(source.indexOf('async function executeStep('),source.indexOf('function loopPairs(')),context);
 await context.executeStep({id:'realm-close',tabId:1,variables:{}},{type:'table_read',table:{mode:'return',return_mode:'button',descriptor:{...descriptor,headers:['Guide']},return_control:{origin:descriptor.origin,pathname:'/',signature:{tag:'button',aria:'Close',title:'',text:'',icons:''}}}});
 const state=await page.evaluate(()=>({mainClickCalls,mouseEvents,trustedEvents,host:!!document.querySelector('modal-container'),mask:!!document.querySelector('.modal-backdrop')}));
 assert.ok(mainInjections>=2);assert.equal(state.mainClickCalls,0);assert.equal(state.trustedEvents.every(Boolean),true);assert.deepEqual(state.mouseEvents,['pointerdown','mousedown','pointerup','mouseup','click']);assert.equal(state.host,false);assert.equal(state.mask,false);
}));


test('native hit test accepts a free point inside the close button but refuses a fully covered target',async()=>pageFor('<button data-flowdetect-close-token="hit-test" style="position:fixed;left:50px;top:50px;width:50px;height:50px">Close</button><div class="test-cover" style="position:fixed;left:50px;top:50px;width:50px;height:50px;z-index:10"></div>',async page=>{
 const source=await fs.readFile(path.resolve(__dirname,'../flowdetect_chrome/service_worker.js'),'utf8');
 const start=source.indexOf('func:request=>{',source.indexOf('const prepared=await chrome.scripting.executeScript'))+5;
 const end=source.indexOf(',args:[status.clickRequest]',start),fn=source.slice(start,end);
 const request={token:'hit-test',origin:'https://example.test',pathname:'/',deadline:Date.now()+20000,signature:{tag:'button',aria:'',title:'',text:'Close',icons:''}};
 const inspect=()=>page.evaluate(({fn,request})=>(0,eval)('('+fn+')')(request),{fn,request});
 const blocked=await inspect();assert.equal(blocked.ok,false);assert.match(blocked.error,/test-cover/);
 await page.evaluate(()=>{document.querySelector('.test-cover').style.cssText='position:fixed;left:65px;top:65px;width:20px;height:20px;z-index:10';});
 const free=await inspect();assert.equal(free.ok,true);assert.equal(await page.evaluate(({x,y})=>document.elementFromPoint(x,y).tagName,free),'BUTTON');
}));

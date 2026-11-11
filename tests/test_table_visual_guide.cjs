const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const path=require('node:path');const vm=require('node:vm');const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../tauri_gerador/web');
test('mapping response delivered to Studio contains schema and fixed buttons, never row values',async()=>{
 const source=await fs.readFile(path.resolve(root,'../../flowdetect_chrome/service_worker.js'),'utf8');
 const context=vm.createContext({activeRuns:new Map(),chrome:{tabs:{query:async()=>[{id:1,url:'https://portal.test/'}],sendMessage:async()=>({ok:true,columns:['Guia','Ações'],descriptor:{headers:['Guia','Ações']},rows:[['PRIVATE-123','value']],actions:[[{column:'Ações',signature:{icons:'fa-eye'},label:'Detalhar'}],[{column:'Ações',signature:{icons:'fa-eye'},label:'Detalhar'}]]})},scripting:{executeScript:async()=>{}}}});
 vm.runInContext(source.slice(source.indexOf('async function runStudioTableMapping('),source.indexOf('async function handleStudioChainJob(')),context);
 const result=await context.runStudioTableMapping({});assert.equal(result.rows.length,0);assert.equal(result.actions[0].length,1);assert.ok(!JSON.stringify(result).includes('PRIVATE-123'));assert.equal(result.schema_only,true);
});
test('existing generated projects recover their detail and return mappings for the visual review',async()=>{
 const code=await fs.readFile(path.join(root,'table-guide.js'),'utf8');const guide=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 const origin='https://portal.test',parent={order:1,sequence:'principal',details:{table:{generated_traversal:'walk',key_column:'Guia',collection:'dados',descriptor:{headers:['Guia','Ações'],origin,pathname:'/'}}}};
 const events=[parent,{order:3,sequence:'principal',details:{table:{traversal_id:'walk',mode:'click',action:{column:'Ações',label:'Olho',signature:{icons:'fa-eye'}}}}},{order:4,sequence:'principal',details:{table:{traversal_id:'walk',accumulate:true,descriptor:{headers:['Nome','Total'],origin,pathname:'/'}}}},{order:5,sequence:'principal',details:{table:{mode:'return',return_mode:'button',return_control:{signature:{aria:'Fechar'}}}}}];
 const hydrated=guide.hydrateGuideConfig(parent,events);assert.equal(hydrated.traversal_options.detail_descriptor.headers.length,2);assert.equal(hydrated.traversal_options.return_control.signature.aria,'Fechar');assert.equal(hydrated.action.label,'Olho');assert.ok(!parent.details.table.traversal_options);
 const html=guide.renderTableGuide(parent,hydrated);assert.match(html,/update-traversal/);assert.ok(!html.includes('data-table-action="create-traversal"'));assert.ok(!html.includes('PRIVATE'));
});
test('four illustrated steps show fixed structure, map buttons and detail, autosave drafts and create the complete workflow',async()=>{
 const browser=await chromium.launch({headless:true});try{const page=await browser.newPage({viewport:{width:1280,height:1000}});
  await page.route('https://studio.test/**',async route=>{const file=new URL(route.request().url()).pathname.slice(1);return route.fulfill({contentType:file.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8',body:file?await fs.readFile(path.join(root,file),'utf8'):'<main></main>'});});await page.goto('https://studio.test/');await page.addStyleTag({path:path.join(root,'style.css')});await page.addStyleTag({path:path.join(root,'table-blocks.css')});
  await page.evaluate(async()=>{const m=await import('/table-blocks.js');window.calls=[];window.nextMap='parent';document.querySelector('main').style.cssText='width:188px;margin:24px auto';
   window.show=event=>document.querySelector('main').innerHTML='<article class="command-tree-card is-inline-expanded" data-type="chrome_tabela"><div class="command-tree-grid"><div class="tree-editor">'+m.renderTableEditor(event)+'</div></div></article>';
   show({order:1,details:{table:{variable:'guias',mode:'list'}}});
   m.initTableBlocks({invoke:async(command,args)=>{calls.push({command,args});if(command==='map_chrome_table'){
    if(args?.request?.pick_control)return {ok:true,control:{signature:{tag:'button',aria:'Fechar',text:'',title:'',icons:''},origin:'https://portal.test',pathname:'/'},label:'Fechar'};
    const cols=nextMap==='detail'?['Nome Trabalhador','FGTS Mensal','Total']:['Número da Guia','Tipo de Guia','Vencimento','Valor Total','Situação da Guia','Ações'];
    return {ok:true,descriptor:{headers:cols,origin:'https://portal.test',pathname:'/'},columns:cols,rows:[cols.map(()=> 'PRIVATE-CUSTOMER-999')],actions:nextMap==='detail'?[]:[[{column:'Ações',label:'Detalhar guia',signature:{tag:'button',aria:'',title:'',text:'Detalhar guia',icons:'fa-eye'}},{column:'Ações',label:'Mais opções',signature:{tag:'button',aria:'Mais',title:'',text:'',icons:'fa-ellipsis-v'}}]],pagination:{}};
   }
   const c=structuredClone(args.request.table);if(args.request.action==='table_traversal_create'){c.generated_traversal='walk';c.setup_pending=false;c.traversal_options=args.request.traversal;}
   return {events:[{order:1,type:'chrome_tabela',details:{table:c}}]};},applyRoadmap:p=>show(p.events[0])});});
  assert.equal(await page.locator('.guide-steps button').count(),4);assert.ok(await page.getByRole('button',{name:/Continuar/}).isDisabled());
  await page.locator('[data-table-action="map"]').click();assert.ok(!(await page.locator('body').textContent()).includes('PRIVATE-CUSTOMER-999'));
  assert.equal(await page.locator('.guide-schema th').count(),6);assert.ok(await page.locator('.guide-schema th.is-row-key').textContent().then(t=>t.includes('Número da Guia')));
  await fs.mkdir(path.resolve(root,'../../output/table-guide'),{recursive:true});await page.locator('article').screenshot({path:path.resolve(root,'../../output/table-guide/01-lista.png')});
  await page.getByRole('button',{name:/Continuar/}).click();await page.getByRole('button',{name:'Selecionar Detalhar guia',exact:true}).click();
  await page.evaluate(()=>window.nextMap='detail');await page.locator('[data-table-action="map-detail"]').click();assert.equal(await page.locator('.guide-detail-card .guide-schema th').count(),3);
  assert.ok(!(await page.locator('body').textContent()).includes('PRIVATE-CUSTOMER-999'));await page.locator('article').screenshot({path:path.resolve(root,'../../output/table-guide/02-detalhe.png')});
  await page.getByRole('button',{name:/Continuar/}).click();await page.locator('[data-table-action="map-return"]').click();await page.locator('article').screenshot({path:path.resolve(root,'../../output/table-guide/03-voltar.png')});
  await page.getByRole('button',{name:/Continuar/}).click();await page.getByText('Opções do resultado',{exact:true}).click();await page.locator('[data-traversal-field="company"]').fill('Empresa de teste');
  const beforeDemo=await page.evaluate(()=>calls.length);await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'Ver exemplo animado'}).click();assert.equal(await page.evaluate(()=>calls.length),beforeDemo);assert.equal(await page.locator('.guide-flow-drawing').getAttribute('data-demo-phase'),'3');
  await page.locator('.guide-result-options > summary').click();
  await page.locator('article').screenshot({path:path.resolve(root,'../../output/table-guide/04-revisao.png')});
  await page.locator('[data-table-action="create-traversal"]').click();
  const result=await page.evaluate(()=>calls.filter(c=>c.args?.request?.action==='table_traversal_create').at(-1).args.request);
  assert.equal(result.traversal.key_column,'Número da Guia');assert.equal(result.traversal.detail_descriptor.headers.length,3);assert.equal(result.traversal.return_control.signature.aria,'Fechar');assert.equal(result.traversal.company,'Empresa de teste');assert.ok(!JSON.stringify(result).includes('PRIVATE-CUSTOMER-999'));
  await page.setViewportSize({width:520,height:900});const rect=await page.locator('article').boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=520);
 }finally{await browser.close();}
});

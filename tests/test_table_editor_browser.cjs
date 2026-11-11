const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const path=require('node:path');const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
test('table editor maps a table, selects a column, saves schema only and exposes variable in library',async()=>{
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage();const root=path.resolve(__dirname,'../tauri_gerador/web');
  await page.route('https://studio.test/**',async route=>{const name=new URL(route.request().url()).pathname.slice(1);route.fulfill({contentType:name.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8',body:name?await fs.readFile(path.join(root,name),'utf8'):'<main></main>'});});
  await page.goto('https://studio.test/');
  await page.addStyleTag({path:path.join(root,'style.css')});
  await page.addStyleTag({path:path.join(root,'table-blocks.css')});
  await page.evaluate(async()=>{
   const module=await import('/table-blocks.js');const variables=await import('/ocr-variables.js');window.tableCalls=[];
   document.querySelector('main').style.cssText='width:188px;margin:36px auto';
   window.renderTableCard=event=>{module.useAdvancedEditor(event.order);document.querySelector('main').innerHTML='<article class="command-tree-card is-inline-expanded" data-type="chrome_tabela"><div class="command-tree-grid"><div class="tree-editor">'+module.renderAdvancedTableEditor(event)+'</div></div></article>';};
   renderTableCard({order:1,details:{table:{variable:'fgts_valor',mode:'value'}}});
   module.initTableBlocks({invoke:async(command,args)=>{
    tableCalls.push({command,args});if(command==='map_chrome_table'&&args?.request?.pick_control)return {ok:true,control:{signature:{tag:'button',aria:'Fechar',text:'',title:'',icons:''},origin:'https://portal.test',pathname:'/detalhe'},label:'Fechar'};
    if(command==='map_chrome_table')return window.fullPreview||{ok:true,columns:['Nome','Total'],descriptor:{headers:['Nome','Total'],origin:'https://portal.test',pathname:'/'},rows:[['Ana','175,97']],actions:[[{column:'Total',label:'Ver detalhes',signature:{tag:'button',aria:'Detalhes',title:'',text:'',icons:'fa-eye'},ordinal:0}]],pagination:{label:'1-1 de 1 itens'}};
    return {events:[{type:'chrome_tabela',order:1,details:{table:args.request.table}}]};
   },applyRoadmap:roadmap=>{window.saved=roadmap;window.library=variables.renderTextVariableLibrary(roadmap.events);renderTableCard(roadmap.events[0]);}});
  });
  await page.locator('[data-table-action="map"]').click();
  const dimensions=await page.evaluate(()=>{const card=document.querySelector('article'),editor=document.querySelector('[data-table-editor]'),field=document.querySelector('[data-table-field="mode"]'),button=document.querySelector('[data-table-action="map"]');return {width:card.getBoundingClientRect().width,outerScroll:card.scrollHeight-card.clientHeight,editorWidth:editor.getBoundingClientRect().width,fieldHeight:field.getBoundingClientRect().height,buttonFont:parseFloat(getComputedStyle(button).fontSize)};});
  assert.ok(dimensions.width>=740,JSON.stringify(dimensions));assert.ok(dimensions.outerScroll<3);assert.ok(dimensions.editorWidth<dimensions.width);assert.ok(dimensions.fieldHeight>=36);assert.ok(dimensions.buttonFont>=12);
  await fs.mkdir(path.resolve(root,'../../output/table-block'),{recursive:true});
  await page.locator('article').screenshot({path:path.resolve(root,'../../output/table-block/editor-clean.png')});
  await page.locator('[data-table-column="Nome"]').uncheck();
  await page.locator('[data-table-field="mode"]').selectOption('value');
  await page.locator('[data-table-field="match_column"]').selectOption('Nome');
  await page.locator('[data-table-field="match_value"]').fill('Ana');
  await page.locator('[data-table-action="save"]').click();await page.waitForFunction(()=>window.saved);
  const result=await page.evaluate(()=>({table:saved.events[0].details.table,library}));
  assert.deepEqual(result.table.columns,['Total']);assert.equal(result.table.variable,'fgts_valor');assert.equal(result.table.match_value,'Ana');assert.ok(!JSON.stringify(result.table).includes('175,97'));assert.match(result.library,/fgts_valor/);
  assert.equal(await page.locator('[data-table-preview] td').first().textContent(),'');assert.ok(!(await page.locator('[data-table-preview]').textContent()).includes('175,97'));
  await page.locator('[data-table-action="choose"]').click();
  assert.equal(await page.locator('[data-table-field="mode"]').inputValue(),'click');
  await page.locator('[data-table-action="save"]').click();
  const action=await page.evaluate(()=>({table:saved.events[0].details.table,library,calls:tableCalls.map(c=>c.command)}));
  assert.equal(action.table.action.signature.aria,'Detalhes');assert.equal(action.table.match_value,'Ana');assert.equal(action.table.mode,'click');assert.ok(!action.library.includes('data-insert-text-variable="fgts_valor"'));assert.ok(action.calls.every(c=>['map_chrome_table','map_paths_action'].includes(c)));
  await page.evaluate(()=>{
   const columns=['Número da Guia','Tipo de Guia','Vencimento da Guia','Data do Pagamento da Guia','Valor Total','Situação da Guia','Ações'];
   window.fullPreview={ok:true,columns,descriptor:{headers:columns,origin:'https://portal.test',pathname:'/'},rows:Array.from({length:5},(_,i)=>['GUIA-00'+i,'MENSAL','19/11/2026','', '1.234,56','Aguardando pagamento','']),actions:Array.from({length:5},()=>[{column:'Ações',label:'Ver detalhes',signature:{tag:'button',aria:'Detalhes',text:'',title:'',icons:'fa-eye'}},{column:'Ações',label:'Mais opções',signature:{tag:'button',aria:'Mais',text:'',title:'',icons:'fa-ellipsis-v'}}]),pagination:{label:'1-5 de 5 itens'}};
   renderTableCard({order:2,details:{table:{variable:'guias',mode:'list'}}});
  });
  await page.locator('[data-table-action="map"]').click();
  assert.equal(await page.locator('[data-table-columns] input').count(),7);
  assert.equal(await page.locator('[data-table-action="choose"]').count(),2);
  const actionBounds=await page.evaluate(()=>{const preview=document.querySelector('.guide-schema-scroll').getBoundingClientRect(),buttons=[...document.querySelector('tbody tr').querySelectorAll('[data-table-action="choose"]')].map(b=>({left:b.getBoundingClientRect().left,right:b.getBoundingClientRect().right}));return {right:preview.right,left:preview.left,buttons};});
  assert.ok(actionBounds.buttons.every(b=>b.left>=actionBounds.left&&b.right<=actionBounds.right),JSON.stringify(actionBounds));
  assert.ok(await page.locator('.table-field > span').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=12));
  await page.locator('article').screenshot({path:path.resolve(root,'../../output/table-block/editor-clean-list.png')});
  await page.setViewportSize({width:520,height:900});
  const narrow=await page.locator('article').evaluate(e=>({x:e.getBoundingClientRect().x,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width,scroll:e.scrollWidth-e.clientWidth}));
  assert.ok(narrow.x>=0&&narrow.right<=520&&narrow.width>=440&&narrow.scroll<3,JSON.stringify(narrow));
  await page.setViewportSize({width:1280,height:1000});
  await page.locator('[data-table-action="choose"]').first().click();
  await page.locator('.table-traversal-wizard > summary').click();
  await page.locator('[data-traversal-field="company"]').fill('{{empresa}}');
  await page.locator('[data-table-action="map-detail"]').click();
  await page.locator('[data-table-action="map-return"]').click();
  await page.locator('article').screenshot({path:path.resolve(root,'../../output/table-block/traversal-wizard.png')});
  await page.locator('[data-table-action="create-traversal"]').click();
  const request=await page.evaluate(()=>tableCalls.find(c=>c.args?.request?.action==='table_traversal_create').args.request);
  assert.equal(request.traversal.key_column,'Número da Guia');assert.equal(request.traversal.company,'{{empresa}}');assert.equal(request.traversal.return_control.signature.aria,'Fechar');assert.ok(request.traversal.detail_descriptor);assert.equal(request.traversal.xlsx,true);
 }finally{await browser.close();}
});

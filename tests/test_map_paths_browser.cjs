const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');

test('map imports an editable lower lane and draws a failure connection inside the same tree',async()=>{
  const web=path.resolve(__dirname,'../tauri_gerador/web');
  const server=http.createServer(async(req,res)=>{
    try{const pathname=new URL(req.url,'http://localhost').pathname;const file=path.join(web,pathname==='/'?'index.html':pathname);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(await fs.readFile(file));}catch(_){res.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{
      window.requests=[];
      const event=(order,sequence,text)=>({id:'id'+order,order,sequence,type:'texto_livre',title:'Texto livre',subtitle:text,text,delay:0,details:{ao_sucesso:'continuar'},keys:[]});
      window.fixture={events:[event(1,'principal','Principal'),event(2,'principal','Concluir')],sequences:['principal'],initial_sequence:'principal',summary:{total:2},sequence_settings:{},workbook:{workbooks:[]},map_paths:[]};
      fixture.events[0].type='procurar_texto_ocr';fixture.events[0].title='Reconhecimento OCR';fixture.events[0].details={texto_ocr:'Competência',ao_nao_encontrar:'parar',clicar:false};
      window.__TAURI__={core:{invoke:async(command,args)=>{
        requests.push({command,...args});
        if(command==='get_roadmap')return structuredClone(fixture);
        if(command==='get_workbook_meta')return {workbooks:[],sheets:[]};
        if(command==='list_saved_automations')return {items:[{id:'other',nome:'Recuperar no portal'}],active_id:'',categories:[]};
        if(command==='insert_text_block'){
          const index=fixture.events.findIndex(event=>event.order===args.targetOrder)+(args.position==='before'?0:1);
          const created=event(0,args.sequencia,args.text);created.id='created-section-block';
          fixture.events.splice(index,0,created);fixture.events.forEach((event,index)=>event.order=index+1);fixture.summary.total=fixture.events.length;
          return structuredClone(fixture);
        }
        if(command==='map_paths_action'){
          const request=args.request;
          if(request.action==='import'){
            fixture.map_paths.push({id:'path1',name:'Recuperar no portal',parent:'principal',entry_sequence:'path_web',sequences:['path_web'],engine:'chrome',page_id:'1'});
            fixture.events.push(event(3,'path_web','Abrir portal'),event(4,'path_web','Conferir cliente'));fixture.sequences.push('path_web');fixture.summary.total=4;
          }
          if(request.action==='connect'){
            const source=fixture.events.find(event=>event.order===request.source),suffix=request.route==='failure'?'nao_encontrar':'sucesso';
            source.details={...source.details,['ao_'+suffix]:request.targetBlock?'ir_para_bloco':'ir_para_sequencia',['sequencia_'+suffix]:request.sequence,['bloco_'+suffix]:request.targetBlock||''};
          }
          return structuredClone(fixture);
        }
        return {};
      }},event:{listen:async()=>()=>{}}};
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.addStyleTag({content:'#loginOverlay{display:none!important}.builder-shell{visibility:visible!important;pointer-events:auto!important;filter:none!important}'});
    await page.locator('#commandTabButton').click();
    assert.equal(await page.locator('#mapPathsButton').count(),0);
    await page.locator('[data-command-map-view=tree]').click();
    await page.locator('#mapPathsFit').click();
    await page.locator('.map-section-add').click();
    assert.equal(await page.locator('#mapSectionConnectPanel').isVisible(),false);
    await page.locator('#mapPathLibrary option[value=other]').waitFor({state:'attached'});
    await page.locator('#mapPathLibrary').selectOption('other');
    await page.locator('#mapPathEngine').selectOption('chrome');
    await page.locator('#mapPathImport').click();
    await page.waitForFunction(()=>document.querySelectorAll('.command-map-tree-node-slot').length===4);
    await page.waitForFunction(()=>!document.querySelector('#mapPathsDialog').open);
    assert.equal(await page.locator('.map-canvas-section').count(),2);
    assert.equal(await page.locator('#commandMapPageTabs [data-command-page]').count(),4);
    await page.locator('[data-map-section-action=connect]').first().click();
    assert.equal(await page.locator('#mapSectionCreatePanel').isVisible(),false);
    assert.equal(await page.locator('#mapPathSource option').count(),2);
    await page.locator('#mapPathSource').selectOption('1');
    await page.locator('#mapPathRoute').selectOption('failure');
    await page.locator('#mapPathTarget').selectOption('path_web');
    await page.locator('#mapPathConnect').click();
    await page.waitForFunction(()=>!document.querySelector('#mapPathsDialog').open);
    const positions=await page.locator('.command-map-tree-node-slot').evaluateAll(nodes=>nodes.map(node=>({order:Number(node.dataset.treeNodeOrder),x:parseFloat(node.style.left),y:parseFloat(node.style.top)})));
    assert.equal(positions[0].x,positions[2].x);
    assert.ok(positions[2].y>positions[0].y+700);
    assert.match(await page.locator('.map-path-lane-title').nth(1).textContent(),/Recuperar no portal/);
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('[data-tree-edge-source-order]')).some(el=>el.dataset.treeEdgeSourceOrder==='1'&&el.dataset.treeEdgeTargetOrder==='3'),null,{timeout:5000});
    const calls=await page.evaluate(()=>requests.filter(item=>item.command==='map_paths_action'));
    assert.equal(calls[0].request.engine,'chrome');assert.equal(calls[1].request.route,'failure');
    const sectionBounds=await page.locator('.map-canvas-section').evaluateAll(nodes=>nodes.map(node=>({top:parseFloat(node.style.top),bottom:parseFloat(node.style.top)+parseFloat(node.style.height)})));
    assert.ok(sectionBounds[1].top>sectionBounds[0].bottom);
    assert.ok(await page.locator('.map-section-add').evaluate(node=>parseFloat(node.style.top))>sectionBounds[1].bottom);
    await page.locator('[data-map-section-action=connect]').nth(1).click();
    assert.deepEqual(await page.locator('#mapPathSource option').evaluateAll(nodes=>nodes.map(node=>node.value)),['3','4']);
    await page.locator('#mapPathsClose').click();
    await page.locator('.command-tree-card[data-order="4"] [data-tree-action="insert-after"]').click();
    await page.locator('.insert-card-panel [data-insert-type="text"]').click();
    await page.locator('.insert-card-panel [data-insert-action="save"]').click();
    await page.waitForFunction(()=>document.querySelectorAll('.command-map-tree-node-slot').length===5);
    assert.equal(await page.locator('#commandMapPageTabs [data-command-page]').count(),4);
    assert.equal(await page.locator('#commandMapPageTabs [data-command-page="principal"]').getAttribute('aria-pressed'),'true');
    const inserted=await page.evaluate(()=>requests.find(request=>request.command==='insert_text_block'));
    assert.equal(inserted.sequencia,'path_web');
    const added=await page.locator('.command-map-tree-node-slot[data-tree-node-order="5"]').evaluate(node=>({y:parseFloat(node.style.top)}));
    assert.ok(added.y>positions[0].y+700);
    await page.locator('#mapPathsFit').click();
    await page.locator('[data-map-section-action=connect]').nth(1).click();
    await page.locator('#mapPathSource').selectOption('5');
    await page.locator('#mapPathRoute').selectOption('success');
    await page.locator('#mapPathTarget').selectOption('block:2');
    await page.locator('#mapPathConnect').click();
    await page.waitForFunction(()=>document.querySelector('[data-tree-edge-source-order="5"][data-tree-edge-target-order="2"]')?.dataset.treeEdgeDirection==='up');
    const geometry=await page.evaluate(()=>{
      const stage=document.querySelector('.command-map-tree-stage'),rect=stage.getBoundingClientRect(),zoom=rect.width/stage.offsetWidth;
      const source=document.querySelector('.command-tree-card[data-order="5"]').getBoundingClientRect(),target=document.querySelector('.command-tree-card[data-order="2"]').getBoundingClientRect();
      const curve=document.querySelector('path[id^="commandTreeStage_5_2_success_"]'),d=curve.getAttribute('d'),numbers=d.match(/-?\d+(?:\.\d+)?/g).map(Number);
      const label=document.querySelector('[data-tree-edge-source-order="5"][data-tree-edge-target-order="2"]');
      return {d,startY:numbers[1],endY:numbers.at(-1),sourceTop:(source.top-rect.top)/zoom,targetBottom:(target.bottom-rect.top)/zoom,labelY:parseFloat(label.style.top)};
    });
    assert.ok(Math.abs(geometry.startY-geometry.sourceTop)<1);
    assert.ok(Math.abs(geometry.endY-geometry.targetBottom)<1);
    assert.ok(geometry.labelY<geometry.sourceTop);
    assert.equal((geometry.d.match(/Q /g)||[]).length,2);
    if(process.env.FLOWDETECT_TEST_SCREENSHOT_DIR){await fs.mkdir(process.env.FLOWDETECT_TEST_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.FLOWDETECT_TEST_SCREENSHOT_DIR,'map-paths.png'),fullPage:true});}
    assert.deepEqual(errors,[]);
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});

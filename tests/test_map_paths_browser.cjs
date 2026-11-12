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
      localStorage.setItem('flowdetect_command_map_tree_layout_v1',JSON.stringify({principal:{'1':{x:72,y:176},'2':{x:632,y:176},'3':{x:72,y:400},'4':{x:632,y:400}}}));
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
          if(request.action==='delete'){
            fixture.events=fixture.events.filter(event=>event.sequence!==request.sequence);
            fixture.map_paths=fixture.map_paths.filter(path=>!path.sequences.includes(request.sequence));
            fixture.sequences=fixture.sequences.filter(sequence=>sequence!==request.sequence);
            fixture.summary.total=fixture.events.length;
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
    assert.equal(await page.locator('.map-view-controls').count(),0);
    await page.waitForFunction(()=>document.querySelector('.command-map-shell')?.dataset.commandMapView==='tree');
    const overlay=await page.evaluate(()=>{
      const header=document.querySelector('.command-map-header'),list=document.querySelector('#commandMapList'),r=header.getBoundingClientRect(),canvas=list.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+8,hit=document.elementFromPoint(x,y);
      const button=document.querySelector('#mapPathsFit'),b=button.getBoundingClientRect();
      return {canvasTop:canvas.top,headerTop:r.top,background:getComputedStyle(header).backgroundColor,passThrough:!header.contains(hit),buttonHit:document.elementFromPoint(b.left+b.width/2,b.top+b.height/2).closest('button')?.id,x,y};
    });
    assert.ok(overlay.canvasTop<=overlay.headerTop);
    assert.equal(overlay.background,'rgba(0, 0, 0, 0)');
    assert.equal(overlay.passThrough,true);
    assert.equal(overlay.buttonHit,'mapPathsFit');
    const panBefore=await page.locator('#commandMapList').evaluate(e=>e.style.getPropertyValue('--command-map-tree-pan-x'));
    await page.mouse.move(overlay.x,overlay.y);await page.mouse.down();await page.mouse.move(overlay.x+40,overlay.y+20,{steps:6});await page.mouse.up();
    const panAfter=await page.locator('#commandMapList').evaluate(e=>e.style.getPropertyValue('--command-map-tree-pan-x'));
    assert.notEqual(panAfter,panBefore);
    await page.locator('#mapPathsFit').click();
    await page.locator('.map-section-add').click();
    assert.equal(await page.locator('#mapSectionConnectPanel').isVisible(),false);
    await page.locator('#mapPathLibrary option[value=other]').waitFor({state:'attached'});
    await page.locator('#mapPathLibrary').selectOption('other');
    assert.equal(await page.locator('#mapPathChromePageField').isVisible(),false);
    assert.match(await page.locator('#mapPathEngineHelp').textContent(),/mouse e teclado/);
    await page.locator('#mapPathEngine').selectOption('chrome');
    assert.equal(await page.locator('#mapPathChromePageField').isVisible(),true);
    await page.locator('#mapPathEngine').selectOption('desktop');
    assert.equal(await page.locator('#mapPathChromePageField').isVisible(),false);
    await page.locator('#mapPathEngine').selectOption('chrome');
    await page.locator('#mapPathImport').click();
    await page.waitForFunction(()=>document.querySelectorAll('.command-map-tree-node-slot').length===4);
    await page.waitForFunction(()=>!document.querySelector('#mapPathsDialog').open);
    assert.equal(await page.locator('.map-canvas-section').count(),2);
    await page.waitForFunction(()=>{
      const sections=[...document.querySelectorAll('.map-canvas-section')];
      return sections.length===2 && parseFloat(sections[1].style.top)>=parseFloat(sections[0].style.top)+parseFloat(sections[0].style.height)+40;
    });
    await page.locator('.command-tree-card').first().evaluate(card=>card.style.minHeight='1300px');
    await page.evaluate(()=>window.dispatchEvent(new Event('resize')));
    await page.waitForFunction(()=>{
      const sections=[...document.querySelectorAll('.map-canvas-section')],card=document.querySelector('.command-tree-card');
      return sections[1].getBoundingClientRect().top>card.getBoundingClientRect().bottom;
    });

    assert.equal(await page.locator('#commandMapPageTabs [data-command-page]').count(),4);
    await page.locator('[data-map-section-action=connect]').first().click();
    assert.equal(await page.locator('#mapSectionCreatePanel').isVisible(),false);
    assert.equal(await page.locator('#mapPathSource option').count(),2);
    await page.locator('#mapPathSource').selectOption('1');
    await page.locator('#mapPathRoute').selectOption('failure');
    await page.locator('#mapPathTarget').selectOption('path_web');
    await page.locator('#mapPathConnect').click();
    await page.waitForFunction(()=>!document.querySelector('#mapPathsDialog').open);
    await page.waitForFunction(()=>document.querySelector('[data-tree-edge-source-order="1"][data-tree-edge-target-order="3"]')?.dataset.treeEdgeDirection==='down');
    const downward=await page.locator('path[id^="commandTreeStage_1_3_failure_"]').getAttribute('d');
    assert.match(downward,/^M .* L /);
    const primary=await page.locator('path[id^="commandTreeStage_1_2_success_"]').getAttribute('d');
    const coords=primary.match(/-?\d+(?:\.\d+)?/g).map(Number);
    const endpoints=await page.evaluate(()=>{
      const stage=document.querySelector('.command-map-tree-stage'),r=stage.getBoundingClientRect(),scale=r.width/stage.offsetWidth;
      return [1,2].map(order=>{const box=document.querySelector(`.command-tree-card[data-order="${order}"]`).getBoundingClientRect();return (box.top+box.height/2-r.top)/scale;});
    });
    assert.ok(Math.abs(coords[1]-endpoints[0])<2);
    assert.ok(Math.abs(coords.at(-1)-endpoints[1])<2);
    assert.equal((primary.match(/Q /g)||[]).length,0);
    const headerCollisions=await page.evaluate(()=>{
      const stage=document.querySelector('.command-map-tree-stage'),bounds=stage.getBoundingClientRect(),zoom=bounds.width/stage.offsetWidth;
      const headers=[...stage.querySelectorAll('.map-path-lane-title, .map-section-actions')].map(e=>{const r=e.getBoundingClientRect();return{left:(r.left-bounds.left)/zoom,right:(r.right-bounds.left)/zoom,top:(r.top-bounds.top)/zoom,bottom:(r.bottom-bounds.top)/zoom};});
      const paths=[...stage.querySelectorAll('path[data-obstacle-routed="true"]')];
      let collisions=0;
      for(const path of paths){const length=path.getTotalLength();for(let t=0;t<=length;t+=4){const p=path.getPointAtLength(t);if(headers.some(r=>p.x>r.left&&p.x<r.right&&p.y>r.top&&p.y<r.bottom))collisions++;}}
      return {collisions,routed:paths.length};
    });
    assert.ok(headerCollisions.routed>0);
    assert.equal(headerCollisions.collisions,0);
    const positions=await page.locator('.command-map-tree-node-slot').evaluateAll(nodes=>nodes.map(node=>({order:Number(node.dataset.treeNodeOrder),x:parseFloat(node.style.left),y:parseFloat(node.style.top)})));
    assert.equal(positions[0].x,positions[2].x);
    assert.ok(positions[2].y>positions[0].y+700);
    assert.match(await page.locator('.map-path-lane-title').nth(1).textContent(),/Recuperar no portal/);
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('[data-tree-edge-source-order]')).some(el=>el.dataset.treeEdgeSourceOrder==='1'&&el.dataset.treeEdgeTargetOrder==='3'),null,{timeout:5000});
    const calls=await page.evaluate(()=>requests.filter(item=>item.command==='map_paths_action'));
    assert.equal(calls[0].request.engine,'chrome');assert.equal(calls[1].request.route,'failure');
    const sectionBounds=await page.locator('.map-canvas-section').evaluateAll(nodes=>nodes.map(node=>({top:parseFloat(node.style.top),bottom:parseFloat(node.style.top)+parseFloat(node.style.height)})));
    assert.ok(sectionBounds[1].top>sectionBounds[0].bottom);
    await page.waitForFunction(()=>{const section=[...document.querySelectorAll('.map-canvas-section')].at(-1);return parseFloat(document.querySelector('.map-section-add').style.top)>parseFloat(section.style.top)+parseFloat(section.style.height);});
    await page.locator('[data-map-section-action=connect]').nth(1).click();
    assert.deepEqual(await page.locator('#mapPathSource option').evaluateAll(nodes=>nodes.map(node=>node.value)),['3','4']);
    await page.locator('#mapPathsClose').click();
    await page.locator('.command-tree-card[data-order="4"] [data-tree-action="insert-after"]').click();
    await page.locator('.command-map-tree-insert.is-after').waitFor({state:'visible'});
    const spacing=await page.locator('.command-map-tree-insert.is-after').evaluate(panel=>{
      const card=panel.parentElement.querySelector('.command-tree-card');
      const stage=panel.closest('.command-map-tree-stage');
      const scale=stage.getBoundingClientRect().width/stage.offsetWidth;
      return (panel.getBoundingClientRect().left-card.getBoundingClientRect().right)/scale;
    });
    assert.ok(spacing>=40,`New block should be separated from its origin, got ${spacing}px`);
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
    assert.ok((geometry.d.match(/Q /g)||[]).length>=2);
    await page.locator('[data-map-section-action=connect]').nth(1).click();
    await page.locator('#mapPathSource').selectOption('3');
    await page.locator('#mapPathRoute').selectOption('success');
    await page.locator('#mapPathTarget').selectOption('block:2');
    await page.locator('#mapPathConnect').click();
    await page.waitForFunction(()=>document.querySelectorAll('path[id^="commandTreeStage_3_2_success_"]').length===1);
    const incoming=await page.evaluate(()=>[...document.querySelectorAll('path[id^="commandTreeStage_"]')].filter(p=>/^commandTreeStage_(3|5)_2_success_/.test(p.id)).map(p=>{const values=p.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number);return values.slice(-2);}));
    assert.equal(incoming.length,2);
    assert.notEqual(incoming[0][0],incoming[1][0]);
    assert.equal(await page.locator('[data-tree-input-order="2"]').count(),0);
    const edgeLabel=page.locator('[data-tree-edge-source-order="5"][data-tree-edge-target-order="2"]');
    await page.locator('#mapPathsFit').click();
    const dragStart=await edgeLabel.locator('span').first().boundingBox();
    const positionBefore=await edgeLabel.evaluate(e=>({x:parseFloat(e.style.left),y:parseFloat(e.style.top),zoom:e.closest('.command-map-tree-stage').getBoundingClientRect().width/e.closest('.command-map-tree-stage').offsetWidth}));
    await page.mouse.move(dragStart.x+dragStart.width/2,dragStart.y+dragStart.height/2);
    await page.mouse.down();
    await page.mouse.move(dragStart.x+dragStart.width/2+40,dragStart.y+dragStart.height/2+20,{steps:12});
    await page.waitForTimeout(200);
    await page.mouse.up();
    await page.waitForTimeout(300);
    const moved=await edgeLabel.evaluate(e=>({x:parseFloat(e.style.left),y:parseFloat(e.style.top)}));
    assert.ok(Math.abs(moved.x-positionBefore.x-40/positionBefore.zoom)<4,JSON.stringify({moved,positionBefore}));
    assert.ok(Math.abs(moved.y-positionBefore.y-20/positionBefore.zoom)<4,JSON.stringify({moved,positionBefore}));
    await page.evaluate(()=>window.dispatchEvent(new Event('resize')));
    await page.waitForTimeout(250);
    const stable=await edgeLabel.evaluate(e=>({x:parseFloat(e.style.left),y:parseFloat(e.style.top)}));
    assert.deepEqual(stable,moved);
    const alignment=await edgeLabel.evaluate(label=>{
      const stage=label.closest('.command-map-tree-stage'),bounds=stage.getBoundingClientRect(),zoom=bounds.width/stage.offsetWidth,r=label.getBoundingClientRect();
      const center={x:(r.left+r.width/2-bounds.left)/zoom,y:(r.top+r.height/2-bounds.top)/zoom};
      const path=stage.querySelector('path[id^="commandTreeStage_5_2_success_"]');
      let distance=Infinity;for(let d=0;d<path.getTotalLength();d+=1){const p=path.getPointAtLength(d);distance=Math.min(distance,Math.hypot(p.x-center.x,p.y-center.y));}
      return distance;
    });
    assert.ok(alignment<1.5,`Label center missed by ${alignment}px`);

    assert.equal(await page.locator('[data-route-edit],.map-route-handle').count(),0);
    await page.locator('#mapReorganizeButton').click();
    await page.waitForFunction(()=>document.querySelector('[data-tree-edge-source-order="5"][data-tree-edge-target-order="2"]')?.dataset.treeEdgeDirection==='up');
    await page.locator('#mapPathsFit').click();
    await page.locator('[data-map-section-action=delete]').nth(1).click();
    assert.equal(await page.locator('#mapSectionDeletePanel').isVisible(),true);
    await page.locator('#mapPathDeleteCancel').click();
    assert.equal(await page.locator('.map-canvas-section').count(),2);
    await page.locator('[data-map-section-action=delete]').nth(1).click();
    await page.locator('#mapPathDelete').click();
    await page.waitForFunction(()=>document.querySelectorAll('.map-canvas-section').length===1);
    assert.equal(await page.locator('[data-tree-node-sequence="path_web"]').count(),0);
    assert.equal(await page.locator('.command-map-tree-node-slot').count(),2);
    if(process.env.FLOWDETECT_TEST_SCREENSHOT_DIR){await fs.mkdir(process.env.FLOWDETECT_TEST_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.FLOWDETECT_TEST_SCREENSHOT_DIR,'map-paths.png'),fullPage:true});}
    assert.deepEqual(errors,[]);
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});

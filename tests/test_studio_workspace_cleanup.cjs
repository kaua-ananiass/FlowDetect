const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const path=require('node:path');const http=require('node:http');const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
test('Studio opens chat and map without the retired catalog, Alterdata or chains',async()=>{
 const web=path.resolve(__dirname,'../tauri_gerador/web');
  const server=http.createServer(async(req,res)=>{try{const file=path.resolve(web,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!file.startsWith(web+path.sep)){res.writeHead(403).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');let body=await fs.readFile(file);if(path.basename(file)==='main.js')body=body.toString('utf8').replace('chatWorkspace=initChatGPT(', 'window.__guideTest={navigate:navigateChatGuidance,seed:applyPersistedRoadmap,zoom:setCommandMapZoom,assist:performAssistantOperation};chatWorkspace=initChatGPT(');res.end(body);}catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.addStyleTag({content:'#loginOverlay{display:none!important}.builder-shell{visibility:visible!important;pointer-events:auto!important;filter:none!important}'});
  await page.locator('#integrationsTabButton').click();await page.waitForSelector('#integrationsPanel.is-active .fdchat');
  assert.equal(await page.locator('#integrationsTabButton').textContent(),'Chat IA');
  assert.equal(await page.locator('.workspace-panel.is-active').count(),1);
  assert.equal(await page.locator('#integrationsPanel > section').count(),1);
  assert.equal(await page.locator('#alterdataTabButton,#chainTabButton,#alterdataPanel,#chainPanel,.integration-card,.integrations-shell').count(),0);
  assert.equal(await page.locator('#flowChatInput').isVisible(),true);
  await page.locator('#launcherTabButton').click();assert.equal(await page.locator('#integrationsPanel').isVisible(),false);
  await page.locator('#commandTabButton').click();assert.equal(await page.locator('#commandsPanel').isVisible(),true);
  await page.locator('#mapChatGPTButton').click();assert.equal(await page.locator('#flowChatInput').isVisible(),true);
  assert.equal(await page.locator('.workspace-panel.is-active').count(),1);
  assert.ok(!requests.some(url=>/\/(alterdata|automation-chain|integrations)\.(js|css)/.test(url)));
  await fs.mkdir(path.join(web,'../../output/chatgpt'),{recursive:true});await page.screenshot({path:path.join(web,'../../output/chatgpt/studio-clean-chat.png'),fullPage:true});
  await page.evaluate(async()=>{window.__guideTest.seed({initial_sequence:'principal',sequences:['principal'],summary:{total:1},sequence_settings:{},map_paths:[],workbook:{workbooks:[],sheets:[]},events:[{id:'reference-id',order:1,type:'clicar_imagem',title:'Configurar consulta',subtitle:'Capturar referência',sequence:'principal',text:'Consulta',delay:0,keys:[],details:{imagem:'',clicar:false,modo_reconhecimento:'imagem',ao_sucesso:'continuar'}}]});await window.__guideTest.navigate({tab:'commands',order:99,block_id:'reference-id',title:'Capturar o botão Consultar',reason:'No Chrome, abra a tela da guia. Capture o botão Consultar e configure o OCR neste editor.'});});
  await page.locator('.command-tree-card.is-inline-expanded[data-order="1"]').waitFor({state:'visible'});
  assert.equal(await page.locator('.fdchat-guidance-dock').isVisible(),true);assert.ok((await page.locator('.fdchat-guidance-dock').textContent()).includes('Capture o botão Consultar'));
  await page.locator('.fdchat-guidance-halo[data-target="recognition.capture"]').waitFor({state:'visible'});
  const halo=await page.locator('.fdchat-guidance-halo').boundingBox();const capture=await page.locator('.command-tree-card [data-recognition-tab-panel="visual"] button[data-tree-action="capture-image"]').first().boundingBox();assert.ok(halo.x<capture.x&&halo.y<capture.y&&halo.width>capture.width);
  await page.getByRole('button',{name:'Próximo passo',exact:true}).click();await page.getByRole('button',{name:'Próximo passo',exact:true}).click();
  await page.locator('.fdchat-guidance-halo[data-target="recognition.click_mode"]').waitFor({state:'visible'});assert.equal(await page.locator('.command-tree-card [data-recognition-tab-panel="behavior"]').isVisible(),true);
  assert.ok((await page.locator('.fdchat-guidance-dock').textContent()).includes('Só confirmar'));
  await page.evaluate(async()=>window.__guideTest.navigate({tab:'commands',block_id:'reference-id',focus:'recognition.test',title:'Procurar não executa o clique',reason:'Veja a diferença entre teste e execução.'}));
  await page.locator('.fdchat-guidance-halo[data-target="recognition.test"]').waitFor({state:'visible'});assert.ok((await page.locator('.fdchat-guidance-dock').textContent()).includes('NÃO clica'));
  await page.screenshot({path:path.join(web,'../../output/chatgpt/studio-guided-editor.png'),fullPage:true});
  await page.evaluate(async()=>{window.__guideTest.seed({initial_sequence:'principal',sequences:['principal'],summary:{total:1},sequence_settings:{},map_paths:[],workbook:{workbooks:[],sheets:[]},events:[{id:'ocr-id',order:1,type:'procurar_texto_ocr',title:'Leitura OCR',sequence:'principal',text:'Consulta',delay:0,keys:[],details:{texto:'Consultar',fonte_ocr:'chrome',clicar:false,ao_sucesso:'continuar'}}]});await window.__guideTest.navigate({tab:'commands',block_id:'ocr-id',title:'Configurar OCR',reason:'Escolha a origem da leitura.'});});
  await page.locator('.fdchat-guidance-halo[data-target="ocr.source"]').waitFor({state:'visible'});
  await page.getByRole('button',{name:'Próximo passo',exact:true}).click();await page.locator('.fdchat-guidance-halo[data-target="ocr.text"]').waitFor({state:'visible'});
  await page.getByRole('button',{name:'Próximo passo',exact:true}).click();await page.locator('.fdchat-guidance-halo[data-target="ocr.click_mode"]').waitFor({state:'visible'});
  assert.ok((await page.locator('.fdchat-guidance-dock').textContent()).includes('Apenas confirmar'));
  await page.getByRole('button',{name:'Voltar ao chat e conferir'}).click();assert.equal(await page.locator('#integrationsPanel').isVisible(),true);

  // The split view owns the exact same map and live controls, not a replica.
  await page.evaluate(()=>{window.originalMap=document.getElementById('commandsPanel');window.originalMapList=document.getElementById('commandMapList');});
  await page.evaluate(()=>window.__guideTest.zoom(.3));
  await page.getByRole('button',{name:'Mapa + conversa',exact:true}).click();
  await page.locator('.fdchat-map-host #commandsPanel').waitFor({state:'visible'});
  assert.equal(await page.locator('#commandMapList').evaluate(el=>Number(el.style.getPropertyValue('--command-map-zoom'))),1,'Teaching map opens at a readable scale instead of the full-flow thumbnail');
  await page.evaluate(async()=>window.__guideTest.navigate({tab:'commands',block_id:'ocr-id',focus:'ocr.text',title:'Texto a procurar',reason:'Vamos configurar este bloco junto da conversa.'}));
  await page.locator('.fdchat-guidance-dock.is-anchored').waitFor({state:'visible'});
  const bubble=page.locator('.fdchat-guidance-dock.is-anchored');
  async function assertBubbleNearControl(){
   await page.waitForTimeout(180); // Let the existing halo transition follow the new field.
   const box=await bubble.boundingBox(),field=await page.locator('.fdchat-guidance-halo').boundingBox(),area=await page.locator('.fdchat-map-host').boundingBox();
   assert.ok(box.x>=area.x&&box.x+box.width<=area.x+area.width+1);
   assert.ok(box.y>=area.y&&box.y+box.height<=area.y+area.height+1);
   const dx=Math.max(field.x-(box.x+box.width),box.x-(field.x+field.width),0),dy=Math.max(field.y-(box.y+box.height),box.y-(field.y+field.height),0);
   assert.ok(Math.hypot(dx,dy)<40,'Explanation stays beside the highlighted control');
   assert.equal(await page.locator('.fdchat .fdchat-guidance-dock').count(),0);
  }
  await assertBubbleNearControl();
  await page.evaluate(()=>{document.getElementById('commandMapList').scrollTop+=35;});
  await page.waitForTimeout(200);await assertBubbleNearControl();
  await page.getByRole('button',{name:'Próximo passo',exact:true}).click();
  await page.locator('.fdchat-guidance-halo[data-target="ocr.source"]').waitFor({state:'visible'});
  await assertBubbleNearControl();
  await page.getByRole('button',{name:'Anterior',exact:true}).click();
  await page.locator('.fdchat-guidance-halo[data-target="ocr.text"]').waitFor({state:'visible'});
  const splitSize=await page.locator('.fdchat-map-host .command-tree-card.is-inline-expanded').evaluate(el=>({width:getComputedStyle(el).width,maxHeight:getComputedStyle(el).maxHeight}));
  assert.ok(parseFloat(splitSize.width)<=324,'Chat uses the original compact block width');
  assert.equal(await page.locator('#flowChatInput').isVisible(),true);
  assert.equal(await page.locator('#integrationsPanel').isVisible(),true);
  assert.equal(await page.locator('#commandsPanel').count(),1);
  assert.ok(await page.evaluate(()=>document.getElementById('commandsPanel')===originalMap&&document.getElementById('commandMapList')===originalMapList));
  const realField=page.locator('.fdchat-map-host .command-tree-card input[data-ocr-target-field]:visible').first();
  await realField.fill('Texto alterado no editor real');
  await page.getByRole('button',{name:'Tirar dúvida deste bloco',exact:true}).click();
  assert.match(await page.locator('#flowChatInput').inputValue(),/bloco 1/);
  await page.locator('#flowChatInput').fill('Dúvida preservada enquanto configuro.');
  await page.screenshot({path:path.join(web,'../../output/chatgpt/studio-map-and-chat.png'),fullPage:true});
  const mapBounds=await page.locator('.fdchat-map-pane').boundingBox(),chatBounds=await page.locator('.fdchat-workspace>.fdchat').boundingBox();
  assert.ok(mapBounds.x+mapBounds.width<=chatBounds.x+1);assert.ok(chatBounds.width>=360);
  await page.locator('#commandTabButton').click();
  assert.equal(await page.locator('.fdchat-map-host #commandsPanel').count(),0);
  await page.locator('#commandsPanel .command-tree-card.is-inline-expanded').waitFor({state:'visible'});
  await page.waitForTimeout(150); // Tab change schedules the live map render after 35 ms.
  const originalSize=await page.locator('#commandsPanel .command-tree-card.is-inline-expanded').evaluate(el=>({width:getComputedStyle(el).width,maxHeight:getComputedStyle(el).maxHeight}));
  assert.deepEqual(splitSize,originalSize,'Original and chat map share the same editor dimensions');
  assert.ok(await page.evaluate(()=>document.getElementById('commandsPanel')===originalMap));
  await page.locator('#integrationsTabButton').click();await page.locator('.fdchat-map-host #commandsPanel').waitFor({state:'visible'});
  assert.equal(await realField.inputValue(),'Texto alterado no editor real');
  assert.equal(await page.locator('#flowChatInput').inputValue(),'Dúvida preservada enquanto configuro.');
  await page.getByRole('button',{name:'Voltar ao chat',exact:true}).click();
  assert.equal(await page.locator('.fdchat-map-host').count(),0);
  await page.locator('#commandTabButton').click();assert.equal(await page.locator('#commandsPanel').isVisible(),true);
  await page.evaluate(()=>{
   window.assistCommitCount=0;
   window.pendingAssistant=window.__guideTest.assist({kind:'keys',placement:{anchor_order:1,position:'after'}},async()=>{
    const panel=document.querySelector('.insert-card-panel');
    if(!panel?.querySelector('[data-insert-type="key"].is-active'))throw Error('Assistant did not select the real key type');
    if(!document.querySelector('.fd-assistant-cursor-name'))throw Error('Assistant cursor missing');
    window.assistCommitCount++;
    return {};
   });
  });
  await page.locator('.insert-card-panel').waitFor({state:'visible'});
  await page.mouse.move(12,200);await page.mouse.down();
  await page.evaluate(()=>window.__guideTest.zoom(.85,{suppressFocusCenter:true}));
  await page.mouse.move(60,260,{steps:6});
  assert.equal(await page.evaluate(()=>assistCommitCount),0,'Navigation must not trigger or cancel the pending creation');
  await page.mouse.up();await page.evaluate(()=>window.pendingAssistant);
  await page.evaluate(async()=>{
   window.__guideTest.seed({initial_sequence:'principal',sequences:['principal'],summary:{total:1},sequence_settings:{},map_paths:[],workbook:{workbooks:[],sheets:[]},events:[{id:'reference-id',order:1,type:'clicar_imagem',title:'Recognition',sequence:'principal',text:'Consulta',delay:0,keys:[],details:{imagem:'',clicar:false,modo_reconhecimento:'imagem',ao_sucesso:'continuar'}}]});
   await window.__guideTest.assist({kind:'reuse',block_id:'reference-id',source_order:1,configuration:{clicks:2}},async()=>{
    const selected=document.querySelector('.command-tree-card[data-order="1"] [data-recognition-set-field="clickOnFind"][data-recognition-set-value="double"]');
    if(!selected?.classList.contains('is-active'))throw Error('Assistant did not click the real recognition choice');
    window.assistCommitCount++;
    return {};
   });
  });
  assert.equal(await page.evaluate(()=>assistCommitCount),2);
  assert.equal(await page.locator('.fd-assistant-cursor,.insert-card-panel').count(),0);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
 for(const name of ['integrations.js','integrations.css','alterdata.js','alterdata.css','automation-chain.js','automation-chain.css'])await assert.rejects(fs.access(path.join(web,name)));
 await assert.rejects(fs.access(path.join(web,'../src-tauri/src/automation_chain.rs')));
});

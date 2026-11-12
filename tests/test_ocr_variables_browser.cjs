const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');

test('Chrome reads an unknown value beside an OCR anchor without clicking and rejects ambiguity',async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1000,height:700}});
    await page.setContent('<style>label{position:absolute;left:100px;top:200px;font:16px Arial}input{position:absolute;left:260px;top:190px;width:150px;height:32px}</style><label>Valor total</label><input value="R$ 61,36">');
    await page.evaluate(()=>{
      window.chrome={runtime:{onMessage:{addListener:f=>window.listener=f,removeListener:()=>{}},sendMessage:async()=>({})}};
      window.clicks=0;document.addEventListener('click',()=>window.clicks++);
    });
    await page.addScriptTag({path:path.join(root,'flowdetect_chrome/content.js')});
    const capture={enabled:true,name:'valor_nota',kind:'money',side:'right',width:260,height:50,gap:8};
    const read=()=>page.evaluate(c=>new Promise(resolve=>listener({type:'flowdetect-execute-step-v2',run_id:'test:1',step:{type:'ocr_text',text:'Valor total',click:false,timeout_ms:500,variable_capture:c}},null,resolve)),capture);
    const result=await read();
    assert.equal(result.ok,true,JSON.stringify(result));
    assert.deepEqual(result.capture,{name:'valor_nota',value:'61,36'});
    assert.equal(await page.evaluate(()=>clicks),0);
    await page.locator('input').fill('10,00 e 20,00');
    const ambiguous=await read();
    assert.equal(ambiguous.ok,false);assert.match(ambiguous.error,/único valor/);
    await page.locator('input').fill('');
    assert.equal((await read()).ok,false);
    await page.locator('input').fill('1.250,90');
    assert.equal((await read()).capture.value,'1250,90');
    const geometry=await page.evaluate(()=>{
      const range=document.createRange();range.selectNodeContents(document.querySelector('label'));
      const a=range.getBoundingClientRect(),r=document.querySelector('input').getBoundingClientRect();
      const normalize=b=>({x:b.left/1000,y:b.top/700,width:b.width/1000,height:b.height/700});
      return {anchor:normalize(a),region:normalize(r)};
    });
    Object.assign(capture,geometry);
    assert.equal((await read()).capture.value,'1250,90');
    await page.evaluate(()=>{document.querySelector('label').style.left='200px';document.querySelector('label').style.top='300px';document.querySelector('input').style.left='360px';document.querySelector('input').style.top='290px';});
    assert.equal((await read()).capture.value,'1250,90','visual region follows the OCR anchor');
    await page.evaluate(()=>{const label=document.createElement('label');label.textContent='Valor total';label.style.top='400px';document.body.append(label);});
    const repeated=await read();assert.equal(repeated.ok,true,JSON.stringify(repeated));
    const joint=await page.evaluate(c=>new Promise(resolve=>listener({type:'flowdetect-test-recognition-v1',texts:['Valor total','Ausente'],capture:c},null,resolve)),capture);
    assert.equal(joint.ok,false);
    assert.equal(joint.results[0].found,true);
    assert.equal(joint.results[1].found,false);
    assert.equal(joint.variable.found,true);
    assert.equal(joint.variable.value,'1250,90');
    assert.equal(await page.evaluate(()=>clicks),0);
  }finally{await browser.close();}
});

test('Studio configures capture inside OCR and lists automation variables without saving captured values',async()=>{
  const web=path.join(root,'tauri_gerador/web');
  const server=http.createServer(async(req,res)=>{
    try{const name=new URL(req.url,'http://localhost').pathname;const file=path.join(web,name==='/'?'index.html':name);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html'})[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      window.requests=[];
      window.fixture={events:[{id:'ocr1',order:1,type:'clicar_imagem',title:'Reconhecimento OCR',sequence:'principal',delay:0,details:{modo_reconhecimento:'texto_ocr',fonte_ocr:'chrome',texto_ocr_busca:'Valor total',imagem:'reference.png',clicar:false,leitura_relativa:{largura:120,altura:30,offset_x:-110,offset_y:-20},ocr_target_layouts:[{texto:'Valor total',action:'continuar'}]}}],sequences:['principal'],initial_sequence:'principal',summary:{total:1},sequence_settings:{},workbook:{workbooks:[]},map_paths:[]};
      fixture.events.push({id:'text2',order:2,type:'texto_livre',title:'Texto livre',sequence:'principal',text:'Total: preencher fim',command:'digitar_texto()',delay:0,details:{}});
      window.__TAURI__={core:{invoke:async(command,args)=>{
        requests.push({command,args});
        if(command==='get_roadmap')return structuredClone(fixture);
        if(command==='get_workbook_meta')return {workbooks:[],sheets:[]};
        if(command==='get_recognition_image_preview')return {src:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="500" height="200"><rect width="500" height="200" fill="white"/><text x="70" y="85" font-size="20">Valor total</text><text x="320" y="85" font-size="20">R$ 61,36</text></svg>')};
        if(command==='list_saved_automations')return {items:[],categories:[]};
        if(command==='chrome_extension_connection_status')return {connected:true};
        if(command==='test_chrome_extension_recognition')return {ok:true,results:[{text:'Valor total',found:true}],variable:{found:true,name:'valor_nota',value:'61,36'}};
        if(command==='test_screen_variable_capture')return {ok:true,results:[{text:'Valor total',found:true,markerShown:true}],variable:{found:true,name:'valor_nota',value:'84,67'}};
        if(command==='update_image_click_block'){
          fixture.events[0].details.ocr_target_layouts=JSON.parse(args.ocrTargetLayouts);
          return structuredClone(fixture);
        }
        return {};
      }},event:{listen:async()=>()=>{}}};
    });
    await page.goto('http://127.0.0.1:'+server.address().port);
    await page.addStyleTag({content:'#loginOverlay{display:none!important}.builder-shell{visibility:visible!important;pointer-events:auto!important;filter:none!important}'});
    await page.locator('#commandTabButton').click();
    const card=page.locator('.command-tree-card[data-order="1"]').first();
    await card.locator('[data-tree-action="open-card-details"]').click({force:true});
    await card.locator('[data-recognition-tab-target="variable"]').click({force:true});
    await card.locator('[data-capture="enabled"]').check({force:true});
    await card.locator('[data-capture="name"]').fill('valor_nota');
    await card.locator('[data-capture="name"]').dispatchEvent('change');
    assert.equal(await card.locator('[data-capture="side"]').count(),0);
    const visualPanel=card.locator('[data-recognition-tab-panel="variable"]');
    for (const point of await card.locator('[data-click-target-point]').all()) {
      assert.equal(await point.isVisible(),false,'confirm-only OCR must not show a click point');
    }
    const marker=visualPanel.locator('[data-variable-region]');
    await marker.waitFor({state:'visible'});
    const image=await visualPanel.locator('.recognition-preview-image').boundingBox();
    const before=await marker.boundingBox();
    await page.mouse.move(before.x+before.width/2,before.y+before.height/2);
    await page.mouse.down();
    await page.mouse.move(image.x+image.width*.7,image.y+image.height*.4,{steps:8});
    await page.mouse.up();
    const moved=JSON.parse(await card.locator('[data-capture-region]').inputValue());
    assert.ok(Math.abs((moved.x+moved.width/2)-.7)<.02,JSON.stringify(moved));
    const handle=await marker.locator('[data-variable-corner="se"]').boundingBox();
    await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();
    await page.mouse.move(image.x+image.width*.94,image.y+image.height*.72,{steps:8});await page.mouse.up();
    const resized=JSON.parse(await card.locator('[data-capture-region]').inputValue());
    assert.ok(resized.width>moved.width,JSON.stringify(resized));
    assert.ok(resized.height>moved.height);
    assert.equal(await page.locator('[data-copy-variable="valor_nota"]').count(),1);
    const variables=page.locator('#mapVariablesHost .map-variables');
    assert.equal(await variables.getAttribute('open'),null);
    await variables.locator('summary').click();
    assert.equal(await page.locator('[data-copy-variable="valor_nota"]').isVisible(),true);
    assert.equal(await variables.locator(':scope>small').count(),0);
    await variables.locator('summary').click();
    await card.locator('[data-variable-test="chrome"]').click({force:true});
    await page.waitForFunction(()=>document.querySelector('#ocrTestResult .is-found-variable')?.textContent.includes('61,36'));
    await page.locator('#ocrTestCloseButton').click();
    await card.locator('[data-tree-action="test-image-recognition"]').click({force:true});
    await page.locator('#ocrTestScreenButton').click();
    await page.waitForFunction(()=>document.querySelector('#ocrTestResult .is-found-variable')?.textContent.includes('84,67'));
    assert.equal(await page.locator('#ocrTestResult .is-found-ocr').count(),1);
    await page.screenshot({path:path.join(root,'output/ocr-variable-general/joint-test.png'),fullPage:true});
    await page.locator('#ocrTestCloseButton').click();
    const screenRequest=await page.evaluate(()=>requests.find(r=>r.command==='test_screen_variable_capture'));
    assert.equal(screenRequest.args.reference,'Valor total');
    assert.deepEqual(screenRequest.args.capture.region,resized);
    assert.equal(await card.locator('[data-variable-test="screen"]').isEnabled(),true);
    const value=await card.locator('[data-capture="name"]').inputValue();assert.equal(value,'valor_nota');
    await page.screenshot({path:path.join(root,'output/ocr-variables/editor.png'),fullPage:true});
    // Opening another tab and returning must preserve the unsaved definition.
    await card.locator('[data-recognition-tab-target="visual"]').click({force:true});
    await card.locator('[data-recognition-tab-target="variable"]').click({force:true});
    assert.equal(await card.locator('[data-capture="name"]').inputValue(),'valor_nota');
    await card.locator('[data-tree-action="save"]').click({force:true});
    await page.waitForFunction(()=>window.requests.some(r=>r.command==='update_image_click_block'));
    const saved=await page.evaluate(()=>requests.find(r=>r.command==='update_image_click_block').args);
    assert.equal(JSON.parse(saved.ocrTargetLayouts)[0].capture.name,'valor_nota');
    assert.equal(JSON.parse(saved.ocrTargetLayouts)[0].capture.enabled,true);
    assert.deepEqual(JSON.parse(saved.ocrTargetLayouts)[0].capture.region,resized);
    assert.ok(JSON.parse(saved.ocrTargetLayouts)[0].capture.anchor.width>0);
    const textCard=page.locator('.command-tree-card[data-order="2"]').first();
    await textCard.locator('[data-tree-action="open-card-details"]').click({force:true});
    const field=textCard.locator('[data-tree-field="text"]');
    await field.focus();
    await field.evaluate(el=>el.setSelectionRange(7,16));
    await textCard.locator('[data-insert-text-variable="valor_nota"]').click({force:true});
    assert.equal(await field.inputValue(),'Total: {{valor_nota}} fim');
    assert.equal(await field.evaluate(el=>el.selectionStart),21);
    // Another insertion follows the current cursor and keeps surrounding text.
    await textCard.locator('[data-insert-text-variable="valor_nota"]').click({force:true});
    assert.equal(await field.inputValue(),'Total: {{valor_nota}}{{valor_nota}} fim');
    await page.screenshot({path:path.join(root,'output/ocr-variable-general/text-library.png'),fullPage:true});
    assert.deepEqual(errors,[]);
  }finally{await browser.close();await new Promise(r=>server.close(r));}
});

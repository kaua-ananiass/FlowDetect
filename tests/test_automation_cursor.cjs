const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs/promises');
const vm=require('node:vm');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');

async function cursorWorker() {
 const source=await fs.readFile(path.join(root,'flowdetect_chrome/service_worker.js'),'utf8');
 const start=source.indexOf('async function handleMessage(message, sender) {');
 const end=source.indexOf("  if(message?.type==='flowdetect-table-permit-click')",start);
 const runs=new Map([['run',{tabId:42,status:'running',cancelled:false}]]);
 const context=vm.createContext({activeRuns:runs});
 vm.runInContext(source.slice(start,end)+'\n}',context);
 return {runs,request:(message,tabId=42,frameId=0)=>context.handleMessage(message,{tab:{id:tabId},frameId})};
}

test('cursor position belongs only to the active run and sender tab',async()=>{
 const worker=await cursorWorker();
 const position={x:700,y:420};
 await worker.request({type:'flowdetect-cursor-position',position});
 assert.equal((await worker.request({type:'flowdetect-cursor-position'})).position.x,700);
 assert.equal((await worker.request({type:'flowdetect-cursor-position'},99)).position,null);
 assert.equal((await worker.request({type:'flowdetect-cursor-position'},42,1)).position,null);
 await worker.request({type:'flowdetect-cursor-position',position:{x:Infinity,y:0}});
 assert.equal((await worker.request({type:'flowdetect-cursor-position'})).position.x,700);
 worker.runs.get('run').status='completed';
 assert.equal((await worker.request({type:'flowdetect-cursor-position'})).position,null);
});

test('reload and cross-origin navigation restore the position; search moves without input',async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const worker=await cursorWorker();
  const page=await browser.newPage({viewport:{width:1000,height:700}});
  await page.exposeFunction('__cursorWorker',message=>worker.request(message));
  await page.addInitScript(()=>{window.chrome={runtime:{sendMessage:message=>window.__cursorWorker(message),onMessage:{addListener:()=>{}}}};window.clicks=0;document.addEventListener('click',()=>clicks++);});
  await page.addInitScript({path:path.join(root,'flowdetect_chrome/automation-cursor.js')});
  await page.route('https://**.example/**',r=>r.fulfill({contentType:'text/html',body:'<button style="position:absolute;left:680px;top:400px;width:80px;height:40px">Alvo</button>'}));
  await page.goto('https://one.example/');
  await page.evaluate(()=>FlowDetectCursor.move(document.querySelector('button')));
  const read=()=>page.locator('[data-flowdetect-overlay="cursor"]').evaluate(e=>({x:Number(e.dataset.x),y:Number(e.dataset.y)}));
  const initial=await read();
  // Check reload coordinates independently of scan animation / machine load.
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const navigate of [()=>page.reload(),()=>page.goto('https://two.example/')]){
   await navigate();
   await page.evaluate(()=>FlowDetectCursor.analyzing());
   await page.locator('[data-flowdetect-overlay="cursor"]').waitFor({state:'visible'});
   const restored=await read();
   assert.ok(Math.hypot(restored.x-initial.x,restored.y-initial.y)<8,JSON.stringify({restored,initial}));
   await page.evaluate(()=>FlowDetectCursor.analyzing(false));
  }
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>FlowDetectCursor.analyzing());
  const from=await read();await page.waitForTimeout(750);const moved=await read();
  assert.ok(Math.hypot(moved.x-from.x,moved.y-from.y)>15,'analysis follows a visible scan path');
  assert.equal(await page.evaluate(()=>clicks),0);
  await page.evaluate(()=>FlowDetectCursor.analyzing(false));
  const frozen=await read();await page.waitForTimeout(300);
  assert.deepEqual(await read(),frozen,'idle cursor stays still');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>FlowDetectCursor.analyzing());
  const reduced=await read();await page.waitForTimeout(300);assert.deepEqual(await read(),reduced);
  await page.evaluate(()=>FlowDetectCursor.stop());
  assert.equal(await page.locator('[data-flowdetect-overlay="cursor"]').count(),0);
 } finally {await browser.close();}
});

test('real blocks show a passive cursor, preserve click counts and never click on confirm',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1000,height:700}});
  await page.setContent('<button id="target" style="margin:120px">Continuar</button><input id="field">');
  await page.evaluate(()=>{
   window.listeners=[];window.clicks=0;
   window.chrome={runtime:{onMessage:{addListener:f=>listeners.push(f),removeListener:()=>{}}}};
   document.querySelector('button').onclick=()=>clicks++;
  });
  await page.addScriptTag({path:path.join(root,'flowdetect_chrome/automation-cursor.js')});
  await page.addScriptTag({path:path.join(root,'flowdetect_chrome/content.js')});
  const run=step=>page.evaluate(step=>new Promise(resolve=>__flowDetectChromeRunnerListener({type:'flowdetect-execute-step-v2',step},null,resolve)),step);
  const step={selector:{method:'css',value:'#target'},timeout_ms:500,action:{type:'clicar'},clicks:2};
  assert.equal((await run(step)).ok,true);
  assert.equal(await page.evaluate(()=>clicks),2);
  const overlay=page.locator('[data-flowdetect-overlay="cursor"]');
  assert.equal(await overlay.count(),1);
  assert.equal(await overlay.evaluate(e=>getComputedStyle(e).pointerEvents),'none');
  assert.equal(await page.evaluate(()=>document.querySelector('button')===document.elementFromPoint(180,140)),true);
  assert.equal(await overlay.evaluate(e=>e.textContent),'','cursor text is isolated from OCR text scans');
  await page.evaluate(()=>FlowDetectCursor.stop());
  assert.equal((await run({...step,action:{type:'verificar_existe'}})).ok,true);
  assert.equal(await overlay.getAttribute('data-state'),'idle');
  assert.equal(await page.evaluate(()=>clicks),2);
  assert.equal((await run({selector:{method:'css',value:'#field'},action:{type:'preencher',value:'Teste'}})).ok,true);
  assert.equal(await page.locator('#field').inputValue(),'Teste');
  await page.locator('#field').focus();
  assert.equal((await run({type:'focused_text',text:' final'})).ok,true);
  assert.equal(await page.locator('#field').inputValue(),'Teste final');
  await page.locator('#field').focus();
  assert.equal((await run({type:'key_sequence',keys:['tab']})).ok,true);
  await page.evaluate(()=>FlowDetectCursor.stop());
  // Stop or a removed target during movement must never dispatch a click.
  await page.evaluate(()=>{
   window.pending=new Promise(resolve=>__flowDetectChromeRunnerListener({type:'flowdetect-execute-step-v2',step:{selector:{method:'css',value:'#target'},action:{type:'clicar'}}},null,resolve));
  });
  await page.waitForSelector('[data-flowdetect-overlay="cursor"][data-state="acting"]');
  await page.evaluate(()=>FlowDetectCursor.stop());
  assert.equal((await page.evaluate(()=>pending)).ok,false);
  assert.equal(await page.evaluate(()=>clicks),2);
  await page.evaluate(()=>{
   window.pending=FlowDetectCursor.move(document.querySelector('#target')).catch(e=>e.message);
   document.querySelector('#target').remove();
  });
  assert.match(await page.evaluate(()=>pending),/mudou/);
  assert.equal(await overlay.count(),0);
  // Native dialogs live above document z-index; the cursor must remain visible there.
  await page.evaluate(()=>{const d=document.createElement('dialog');d.innerHTML='<button>Fechar</button>';document.body.append(d);d.showModal();FlowDetectCursor.indicate(d.querySelector('button'));});
  assert.equal(await overlay.evaluate(e=>e.matches(':popover-open')),true);
  await page.screenshot({path:path.join(root,'output/automation-cursor.png')});
  await page.waitForTimeout(950);
  assert.equal(await overlay.count(),1,'cursor remains between blocks instead of blinking');
  await page.evaluate(()=>{window.previousCursor=document.querySelector('[data-flowdetect-overlay="cursor"]');});
  // Recognition hides the drawing briefly without deleting its position or node.
  await page.evaluate(()=>listeners.forEach(f=>f({type:'flowdetect-cursor-suspend'},null,()=>{})));
  assert.equal(await overlay.evaluate(e=>getComputedStyle(e).visibility),'hidden');
  await page.evaluate(()=>listeners.forEach(f=>f({type:'flowdetect-cursor-resume'},null,()=>{})));
  assert.equal(await overlay.evaluate(e=>getComputedStyle(e).visibility),'visible');
  await page.evaluate(()=>FlowDetectCursor.move(document.querySelector('dialog button'),'Teclado'));
  assert.equal(await overlay.evaluate(e=>e===window.previousCursor),true,'the next action reuses the same cursor');
  await page.evaluate(()=>listeners.forEach(f=>f({type:'flowdetect-cursor-stop'},null,()=>{})));
  assert.equal(await overlay.count(),0,'completion and stop remove the cursor');
 }finally{await browser.close();}
});

test('delayed recognition displays analysis without clicks and returns to idle',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();
  await page.setContent('<main></main>');
  await page.evaluate(()=>{window.chrome={runtime:{onMessage:{addListener:()=>{},removeListener:()=>{}}}};window.clicks=0;document.addEventListener('click',()=>clicks++);});
  await page.addScriptTag({path:path.join(root,'flowdetect_chrome/automation-cursor.js')});
  await page.addScriptTag({path:path.join(root,'flowdetect_chrome/content.js')});
  await page.evaluate(()=>{window.pending=new Promise(resolve=>__flowDetectChromeRunnerListener({type:'flowdetect-execute-step-v2',step:{selector:{method:'css',value:'#delayed'},timeout_ms:1500,action:{type:'verificar_existe'}}},null,resolve));});
  const cursor=page.locator('[data-flowdetect-overlay="cursor"]');
  await page.waitForSelector('[data-state="analyzing"]');
  assert.equal(await page.evaluate(()=>clicks),0);
  await page.screenshot({path:path.join(root,'output/automation-cursor-analyzing.png')});
  await page.evaluate(()=>{document.querySelector('main').innerHTML='<button id="delayed">Pronto</button>';});
  assert.equal((await page.evaluate(()=>pending)).ok,true);
  assert.equal(await cursor.getAttribute('data-state'),'idle');
  assert.equal(await page.evaluate(()=>clicks),0);
  const failed=await page.evaluate(()=>new Promise(resolve=>__flowDetectChromeRunnerListener({type:'flowdetect-execute-step-v2',step:{selector:{method:'css',value:'#missing'},timeout_ms:500,action:{type:'verificar_existe'}}},null,resolve)));
  assert.equal(failed.ok,false);
  assert.equal(await cursor.getAttribute('data-state'),'idle','failure ends the analysis animation');
 }finally{await browser.close();}
});

test('table eye button executes once with the cursor mounted',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();
  await page.route('https://example.test/**',r=>r.fulfill({contentType:'text/html',body:'<table><thead><tr><th>Guide</th><th>Actions</th></tr></thead><tbody><tr><td>001</td><td><button aria-label="Details">Eye</button></td></tr></tbody></table>'}));
  await page.goto('https://example.test/');
  await page.evaluate(()=>{window.clicks=0;window.chrome={runtime:{onMessage:{addListener:()=>{}}}};document.querySelector('button').onclick=()=>clicks++;});
  await page.addScriptTag({path:path.join(root,'flowdetect_chrome/automation-cursor.js')});
  await page.addScriptTag({path:path.join(root,'flowdetect_chrome/table-reader.js')});
  const result=await page.evaluate(async()=>{
   const mapped=FlowDetectTables.describe(document.querySelector('table'));
   return FlowDetectTables.clickRow({descriptor:mapped.descriptor,action:mapped.actions[0][0],match_column:'Guide',match_value:'001'},async()=>true);
  });
  assert.equal(result.clicked,true);
  assert.equal(await page.evaluate(()=>clicks),1);
  assert.equal(await page.locator('[data-flowdetect-overlay="cursor"]').count(),1);
 }finally{await browser.close();}
});

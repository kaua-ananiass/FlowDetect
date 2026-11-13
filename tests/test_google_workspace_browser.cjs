const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');

test('Google panel guides setup, imports workbook, surfaces errors and restores controls',async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1200,height:950}});
    await page.setContent('<div id="google"></div>');
    await page.addStyleTag({content:await fs.readFile(path.join(__dirname,'../tauri_gerador/web/style.css'),'utf8')});
    await page.addStyleTag({content:await fs.readFile(path.join(__dirname,'../tauri_gerador/web/google-workspace.css'),'utf8')});
    const code=await fs.readFile(path.join(__dirname,'../tauri_gerador/web/google-workspace.js'),'utf8');
    await page.addScriptTag({content:code.replace('export function','function')});
    await page.evaluate(()=>{
      window.calls=[];window.imports=[];
      initGoogleWorkspace({host:document.querySelector('#google'),pickFile:async()=> 'C:/client.json',
        onWorkbook:async(id)=>imports.push(id),invoke:async(command,{payload})=>{
          calls.push(payload);
          if(payload.action==='status')return {configured:false,connected:false};
          if(payload.action==='pull')return {workbook_id:'planilhas/Google-test.xlsx',title:'Empresas'};
          if(payload.action==='push')throw new Error('Conflito: outra alteração no Google.');
          return {configured:true,connected:true};
        }});
    });
    await page.locator('.google-connection > summary').click();
    await page.waitForFunction(()=>document.querySelector('.google-setup').open);
    assert.equal(await page.locator('.google-setup li').count(),5);
    await page.locator('[data-google="configure"]').click();
    await page.waitForFunction(()=>calls.some(c=>c.action==='configure'));
    assert.equal((await page.evaluate(()=>calls.find(c=>c.action==='configure'))).path,'C:/client.json');
    await page.locator('[data-google-url]').fill('https://docs.google.com/spreadsheets/d/example123456789/edit');
    page.on('dialog',d=>d.accept());
    await page.locator('[data-google="pull"]').click();
    await page.waitForFunction(()=>imports.length===1);
    assert.deepEqual(await page.evaluate(()=>imports),['planilhas/Google-test.xlsx']);
    await page.locator('[data-google="push"]').click();
    await page.waitForFunction(()=>document.querySelector('[data-google-status]').textContent.includes('Conflito'));
    assert.equal(await page.locator('[data-google="push"]').isEnabled(),true);
    await page.screenshot({path:path.join(__dirname,'../output/google-workspace-preview.png'),fullPage:true});
    await page.setViewportSize({width:620,height:1000});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  } finally {await browser.close();}
});

test('Studio imports Google workbook through the actual main.js callback and renders its preview', async()=>{
  const web=path.resolve(__dirname,'../tauri_gerador/web');
  const server=http.createServer(async(req,res)=>{
    try {
      const pathname=new URL(req.url,'http://localhost').pathname;
      const file=path.join(web,pathname==='/'?'index.html':pathname);
      res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');
      res.end(await fs.readFile(file));
    }catch{res.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1600,height:1100}});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      window.requests=[];window.imported=false;
      const id='planilhas/Google-fixture.xlsx';
      const workbook=()=>({default_workbook:imported?id:'',workbooks:imported?[{id,file_name:'Google-fixture.xlsx',sheets:[{name:'Dados',headers:['Empresa'],rows:1}]}]:[],sheets:[]});
      window.__TAURI__={core:{invoke:async(command,args)=>{
        requests.push({command,args});
        if(command==='google_workspace_action'){
          if(args.payload.action==='pull'){window.imported=true;return {workbook_id:id,title:'Empresas'};}
          return {configured:true,connected:true};
        }
        if(command==='get_workbook_meta')return workbook();
        if(command==='get_workbook_preview')return {workbook_id:id,sheet:'Dados',headers:['Empresa'],rows:Array.from({length:36},(_,index)=>({row_number:index+2,values:[index===0?'Empresa importada':`Empresa ${index+1}`]})),total_rows:36};
        if(command==='get_roadmap')return {events:[],sequences:['principal'],initial_sequence:'principal',summary:{total:0},sequence_settings:{},workbook:workbook(),map_paths:[]};
        if(command==='list_saved_automations')return {items:[],categories:[]};
        return {};
      }},event:{listen:async()=>()=>{}}};
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.addStyleTag({content:'#loginOverlay{display:none!important}.builder-shell{visibility:visible!important;pointer-events:auto!important;filter:none!important}'});
    await page.locator('#workbookTabButton').click();
    await page.locator('#googleWorkspacePanel .google-connection > summary').click();
    await page.locator('[data-google-url]').fill('https://docs.google.com/spreadsheets/d/example123456789/edit');
    page.on('dialog',d=>d.accept());
    await page.locator('[data-google="pull"]').click();
    await page.waitForFunction(()=>document.querySelector('[data-google-status]')?.textContent.includes('Planilha recebida'));
    assert.match(await page.locator('#workbookTableWrap').innerText(),/Empresa importada/);
    assert.equal(await page.locator('#workbookSheetSelect').inputValue(),'Dados');
    const tableCard=page.locator('.workbook-table-card');
    const sideCard=page.locator('.workbook-side-card');
    const tableBottom=await tableCard.evaluate(e=>e.getBoundingClientRect().bottom);
    const sideBottom=await sideCard.evaluate(e=>e.getBoundingClientRect().bottom);
    assert.ok(Math.abs(tableBottom-sideBottom)<2,'table fills the height beside its controls');
    await page.locator('#workbookTableWrap').evaluate(e=>{e.scrollTop=e.scrollHeight;});
    assert.equal(await page.locator('[data-workbook-cell][data-row-number="37"]').evaluate(e=>{
      const r=e.getBoundingClientRect(), wrap=e.closest('#workbookTableWrap').getBoundingClientRect();
      return r.top>=wrap.top&&r.bottom<=wrap.bottom+1;
    }),true,'last worksheet row is reachable inside the table');
    assert.ok(await page.evaluate(()=>requests.some(r=>r.command==='get_workbook_preview'&&r.args.workbook==='planilhas/Google-fixture.xlsx')));
    // Expanded Google setup must not squeeze the workbook into an unscrollable viewport.
    await page.setViewportSize({width:1280,height:720});
    await page.locator('.google-setup').evaluate(e=>{e.open=true;});
    const panel=page.locator('#workbookPanel');
    assert.ok(await panel.evaluate(e=>e.scrollHeight>e.clientHeight));
    const bounds=await panel.boundingBox();
    await page.mouse.move(bounds.x+bounds.width-35,bounds.y+150);
    await page.mouse.wheel(0,1400);
    await page.waitForFunction(()=>document.querySelector('#workbookPanel').scrollTop>100);
    await page.locator('#addWorkbookColumnButton').scrollIntoViewIfNeeded();
    assert.ok(await page.locator('#addWorkbookColumnButton').evaluate(e=>{
      const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;
    }));
    assert.ok(await page.locator('.workbook-table-card').evaluate(e=>e.getBoundingClientRect().height>=480));
    assert.deepEqual(errors,[]);
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});

test('automatic sync waits for execution, avoids overlapping requests and pauses on conflict',async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();
    await page.setContent('<div id="google"></div>');
    const code=await fs.readFile(path.join(__dirname,'../tauri_gerador/web/google-workspace.js'),'utf8');
    await page.addScriptTag({content:code.replace('export function','function')});
    await page.evaluate(()=>{
      window.running=true;window.syncCount=0;window.inFlight=0;window.maxFlight=0;window.previewCount=0;window.conflict=false;
      initGoogleWorkspace({host:document.querySelector('#google'),intervalMs:30,isRunning:()=>running,pickFile:async()=>null,
        onWorkbook:async()=>{previewCount++;},invoke:async(_,{payload})=>{
          if(payload.action!=='sync')return {configured:true,connected:true};
          syncCount++;inFlight++;maxFlight=Math.max(maxFlight,inFlight);
          await new Promise(r=>setTimeout(r,70));inFlight--;
          if(conflict)throw new Error('Conflito em A2');
          return {workbook_id:'sheet.xlsx',received_cells:1,updated_cells:0};
        }});
    });
    await page.locator('.google-connection > summary').click();
    await page.locator('[data-google-url]').fill('https://docs.google.com/spreadsheets/d/example123456789/edit');
    await page.locator('[data-google-auto]').click();
    await page.waitForFunction(()=>document.querySelector('[data-google-auto-status]').textContent.includes('término'));
    assert.equal(await page.evaluate(()=>syncCount),0);
    await page.evaluate(()=>{running=false;});
    await page.waitForFunction(()=>previewCount>=2);
    assert.equal(await page.evaluate(()=>maxFlight),1);
    await page.evaluate(()=>{conflict=true;});
    await page.waitForFunction(()=>document.querySelector('[data-google-auto-status]').textContent.includes('Conflito'));
    assert.equal(await page.locator('[data-google-auto]').getAttribute('aria-pressed'),'false');
    assert.equal(await page.locator('[data-google="pull"]').isEnabled(),true);
  }finally{await browser.close();}
});

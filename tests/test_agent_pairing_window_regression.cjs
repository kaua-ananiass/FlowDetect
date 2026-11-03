const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');

async function serve(web) {
  const root=path.resolve(web);
  const server=http.createServer(async(req,res)=>{
    try{
      const u=new URL(req.url,'http://localhost');
      const file=path.resolve(root,'.'+(u.pathname==='/'?'/index.html':decodeURIComponent(u.pathname)));
      if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
      res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream'));
      res.end(await fs.readFile(file));
    }catch{res.writeHead(404).end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  return {url:'http://127.0.0.1:'+server.address().port+'/',close:()=>new Promise(r=>server.close(r))};
}
const webRoot=process.env.FLOWDETECT_SOURCE_ROOT||path.resolve(__dirname,'..');

test('Agent full panel opens maximized and resizable, without compact strip',async()=>{
  const conf=JSON.parse(await fs.readFile(path.join(webRoot,'flowdetect_agent/src-tauri/tauri.conf.json'),'utf8'));
  const win=conf.app.windows[0];
  assert.ok(win.height>=600,'Agent must not be created at 86px height');
  assert.ok(win.width>=900 && win.resizable && win.decorations && !win.transparent);
  const rust=await fs.readFile(path.join(webRoot,'tauri_gerador/src-tauri/src/lib.rs'),'utf8');
  assert.match(rust,/fn restore_agent_main_window\(/);
  assert.match(rust,/window\.maximize\(\)/);
  const server=await serve(path.join(webRoot,'flowdetect_agent/web'));
  let browser;
  try{
    browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
    const page=await browser.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      window.__agentCalls=[];
      window.__agentEvents={};
      window.__TAURI__={
        core:{invoke:async(name,args)=>{
          window.__agentCalls.push({name,args});
          if(name==='get_agent_connection_info') return {address:'192.168.1.60:18452',agent_name:'Agent de teste',remote_server_ok:true,pairing:{code:'ABCD-EFGH-JKLM',expires_at:Date.now()/1000+600}};
          if(name==='get_agent_mouse_control_state')return {mouse_enabled:false};
          if(name==='get_agent_remote_snapshot')return {remote_connection:{connected:false}};
          if(name==='list_saved_automations')return {items:[]};
          return {};
        }},
        event:{listen:async(name,handler)=>{window.__agentEvents[name]=handler;return async()=>{};}},
        window:{getCurrentWindow:()=>({show:async()=>{},maximize:async()=>{},setFocus:async()=>{},hide:async()=>{}})}
      };
    });
    await page.goto(server.url);
    await page.waitForFunction(()=>typeof window.__agentEvents['agent-overlay-toggle-request']==='function');
    await page.evaluate(()=>window.__agentEvents['agent-overlay-toggle-request']({}));
    await page.waitForFunction(()=>window.__agentCalls.some(e=>e.name==='set_agent_compact_mode'&&e.args?.compact===false));
    assert.equal(await page.evaluate(()=>document.body.classList.contains('agent-service-mode')),false);
    assert.equal(await page.evaluate(()=>document.body.classList.contains('agent-compact-mode')),false);
    assert.equal(await page.locator('#agentPairCode').innerText(),'ABCD-EFGH-JKLM');
    assert.deepEqual(errors,[]);
  }finally{await browser?.close();await server.close();}
});

test('Studio explains a rejected pairing code and a red disconnected card',async()=>{
  const server=await serve(path.join(webRoot,'tauri_gerador/web'));
  let browser;
  try{
    browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
    const page=await browser.newPage({viewport:{width:1300,height:900}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      window.__TAURI__={core:{invoke:async(name,body)=>{
        if(name==='get_login_session')return {exists:false,session:null};
        if(name==='remote_agent_pair_by_code'){
          if(body.code!=='ABCD-EFGH-JKLM')throw Error('Código incorreto ou expirado');
          return {address:'192.168.1.60:18452',name:'Agent do teste',agent_id:'1234567890abcdef1234567890abcdef',pairing_protocol:1,agent_version:'3.0.5'};
        }
        if(name==='remote_agent_ping')throw Error('Agent indisponível: TCP 18452 bloqueado');
        if(name==='remote_agent_resolve_device')throw Error('Agent pareado não encontrado na rede privada');
        if(name==='list_hyperv_vms')return {items:[]};
        if(name==='list_saved_automations')return {items:[]};
        return {};
      }},event:{listen:async()=>()=>{}},dialog:{open:async()=>null,save:async()=>null}};
    });
    await page.goto(server.url);
    await page.addStyleTag({content:'#loginOverlay{display:none!important}.builder-shell{visibility:visible!important;pointer-events:auto!important;filter:none!important}'});
    await page.locator('#agentsTabButton').click();
    await page.locator('#agentsPhysicalTabButton').click();
    await page.locator('[data-agent-action="new"]').click();
    await page.locator('#agentNameInput').fill('PC teste físico');
    await page.locator('#agentPairCodeInput').fill('AAAA-BBBB-CCCC');
    await page.locator('[data-agent-action="create-save"]').click();
    await page.waitForFunction(()=>document.querySelector('[data-agent-pairing-error]')?.textContent.includes('Código incorreto'));
    assert.equal(await page.locator('[data-agent-pairing-error]').isVisible(),true);
    await page.locator('#agentPairCodeInput').fill('ABCD-EFGH-JKLM');
    await page.locator('[data-agent-action="create-save"]').click();
    const card=page.locator('.physical-agent-card').filter({hasText:'PC teste físico'});
    await card.waitFor();
    await page.waitForFunction(()=>document.querySelector('.physical-agent-card.has-error [role="alert"]')?.textContent.includes('rede privada'));
    assert.match(await card.locator('[role="alert"]').innerText(),/rede privada|indisponível|TCP 18452/i);
    assert.equal(await card.locator('[data-agent-action="connect"]').isEnabled(),true);
    assert.deepEqual(errors,[]);
  }finally{await browser?.close();await server.close();}
});
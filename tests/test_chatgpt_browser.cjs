const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const path=require('node:path');const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../tauri_gerador/web'),shots=path.resolve(root,'../../output/chatgpt');
test('A complete request creates text, empty recognition and key without intermediate tutorials; questions block all work',async()=>{
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}});await setup(page,true);
  await page.getByRole('button',{name:'Mapa + conversa',exact:true}).click();
  await page.getByRole('button',{name:'Fazer comigo',exact:true}).click();
  await page.evaluate(()=>{window.batchGuide=true;window.batchQuestions=true;});
  const send=async()=>{await page.locator('[data-ai=prompt]').fill('Crie texto começo, reconhecimento vazio e tecla P uma vez');await page.getByRole('button',{name:'Pedir orientação'}).click();};
  await send();await page.getByRole('button',{name:'Depois de qual bloco devo iniciar?'}).waitFor();
  assert.equal(await page.evaluate(()=>calls.filter(c=>c.payload.request.action==='ai_assist_apply').length),0);
  await page.evaluate(()=>window.batchQuestions=false);await send();
  await page.waitForFunction(()=>window.calls.filter(c=>c.payload.request.action==='ai_assist_apply').length===3);
  const steps=await page.evaluate(()=>calls.filter(c=>c.payload.request.action==='ai_assist_apply').map(c=>c.payload.request));
  assert.deepEqual(steps.map(r=>r.step.kind),['text','ocr','keys']);
  assert.equal(steps[0].step.text,'começo');assert.deepEqual(steps[2].step.keys,['p']);
  assert.deepEqual(steps.map(r=>r.revision),['guide-1','batch-revision-2','batch-revision-3']);
  assert.deepEqual(steps.slice(1).map(r=>r.step.placement.anchor_id),['batch-2','batch-3']);
  assert.equal(await page.evaluate(()=>window.navigationCount||0),0,'A completed field must not open a tutorial requesting the same value');
  assert.equal(await page.evaluate(()=>calls.some(c=>/execute|run_automation/.test(c.command))),false);
 }finally{await browser.close();}
});
async function setup(page,enableMap=false){
 await page.route('https://studio.test/**',async route=>{const name=new URL(route.request().url()).pathname.slice(1);await route.fulfill({contentType:name.endsWith('.js')?'text/javascript; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8',body:name?await fs.readFile(path.join(root,name)):'<html lang="pt-BR"><head><link rel="stylesheet" href="/chatgpt.css"><link rel="stylesheet" href="/chatgpt-react.css"></head><body style="background:#07121a;margin:24px;font-family:Arial"><main id="chatgptWorkspace"></main></body></html>'});});
 await page.goto('https://studio.test/');
 await page.evaluate(async enableMap=>{
  window.calls=[];window.missing=false;window.quota=false;
  window.__TAURI__={event:{listen:async(_,callback)=>{window.delta=callback;return()=>{window.delta=null}}}};
  const {initChatGPT}=await import('/chatgpt.js');
  window.guideContext={revision:'guide-1',blocks:[{source_order:1,block_id:'block-1',configured:false,missing:['Imagem de referência']}]};
  window.mapBridge={};
  if(enableMap){window.mapNode=document.createElement('section');window.mapNode.textContent='Live map';document.body.append(mapNode);window.mapBridge={mountMap:host=>{host.append(mapNode);window.mapMounted=true;return()=>{document.body.append(mapNode);window.mapMounted=false;}},getEditorContext:()=>({block_id:'block-1',order:1,workspace:window.mapMounted?'map-and-chat':'studio'})};}
  initChatGPT({...window.mapBridge,editorAction:async(action,id)=>{window.lastEditorAction={action,id}},navigate:async target=>{window.navigationCount=(window.navigationCount||0)+1;window.navigation=target},getAutomation:()=>window.automation||null,openAutomation:async id=>{window.automation={id,name:'Automation A'};window.linkedOpened=true;},beforeGenerate:async()=>{window.persisted=true},getPage:()=> 'principal',apply:r=>{window.applied=r},openMap:()=>{window.openedMap=true},invoke:async(command,payload)=>{
   calls.push({command,payload});const r=payload.request;
   if(r.action==='history_load')return JSON.parse(localStorage.getItem('mock-history')||'{"version":1,"revision":0,"activeId":"","threads":[]}');
   if(r.action==='history_save'){const data={...r.data,revision:r.data.revision+1};localStorage.setItem('mock-history',JSON.stringify(data));return {revision:data.revision};}
   if(r.action==='status')return {connected:false,sharing:false};
   if(r.action==='login'&&window.multiAccount){const id=r.new_account?'personal-client':r.account_id||'work-client';window.activeAccount=id;return {connected:true,sharing:true,client_id:id,email:id==='work-client'?'work@example.com':'personal@example.com',accounts:[{id:'work-client',label:'Conta 1 - Work',connected:true},{id:'personal-client',label:'Conta 2 - Pessoal',connected:true}]};}
   if(r.action==='select_account'){window.activeAccount=r.account_id;return {connected:true,sharing:true,client_id:r.account_id,email:r.account_id==='work-client'?'work@example.com':'personal@example.com',accounts:[{id:'work-client',label:'Conta 1 - Work',connected:true},{id:'personal-client',label:'Conta 2 - Pessoal',connected:true}]};}
   if(r.action==='login')return {connected:true,sharing:true,email:'usuario@example.com'};
   if(r.action==='models')return {models:[{slug:'model-test',display_name:'Modelo de teste',visibility:'list'}]};
   if(r.action==='guide'&&window.batchGuide)return {name:'Three blocks',message:'Vou criar os tres blocos.',revision:window.guideContext.revision,questions:window.batchQuestions?['Depois de qual bloco devo iniciar?']:[],steps:[
    {id:'start',kind:'text',title:'Texto inicial',description:'',instruction:'Digite o texto',text:'come\u00e7o',placement:{anchor_order:1,anchor_id:'block-1',position:'after'}},
    {id:'empty',kind:'ocr',title:'Reconhecimento vazio',description:'',instruction:'Capture uma imagem',placement:{anchor_step:'start',position:'after'}},
    {id:'press-p',kind:'keys',title:'Tecla P',description:'',instruction:'Configure a tecla',keys:['p'],placement:{anchor_step:'empty',position:'after'}}]};
   if(r.action==='ai_assist_apply'&&window.batchGuide){
    const number=window.guideContext.blocks.length+1,identity='batch-'+number;
    if(r.revision!==window.guideContext.revision)throw Error('Stale revision');
    window.guideContext={revision:'batch-revision-'+number,blocks:[...window.guideContext.blocks,{block_id:identity,source_order:number,title:r.step.title,configured:r.step.kind!=='ocr',missing:r.step.kind==='ocr'?['Imagem']:[]}]};
    return {roadmap:{events:window.guideContext.blocks.map(b=>({id:b.block_id,order:b.source_order}))},block_id:identity,context:window.guideContext,message:'Saved'};
   }
   if(r.action==='guide'&&window.autoGuide)return {name:'Digitar empresa',message:'Vamos configurar o texto neste bloco real.',revision:window.guideContext.revision,questions:[],steps:[{id:'empresa',kind:'text',title:'Digitar empresa',description:'Digitar no campo em foco.',instruction:'Revise o texto no editor do mapa.',text:window.guideText||'Empresa A',...(window.editGuide?{source_order:2,block_id:'block-2'}:window.noPlacement?{}:{placement:{anchor_order:1,anchor_id:'block-1',position:'after'}})}]};
   if(r.action==='guide')return {name:'Emitir guias com ajuda',message:'Vamos configurar juntos. Qual portal você utiliza?',revision:'guide-1',questions:['Qual portal você utiliza?'],steps:[{id:'referencia',kind:'reuse',source_order:1,block_id:'block-1',title:'Reconhecer consulta',description:'Localizar a consulta na página.',instruction:'No Chrome, abra a tela da guia. Capture o botão Consultar no editor do Studio.',configured:false,missing:['Imagem de referência']},{id:'empresa',kind:'text',title:'Digitar empresa',description:'Preencher o campo já focado.',instruction:'Revise o texto ou use uma variável da planilha.',text:'{{EMPRESA}}',placement:{anchor_order:1,anchor_id:'block-1',position:'after'}}],navigation:{tab:'commands',order:1,block_id:'block-1',reason:'Configure a referência do botão.'}};
   if(r.action==='ai_assist_apply'){window.assistantSaved=true;return {roadmap:{events:[{id:'block-2',order:2,type:'texto_livre',text:r.step.text}]},block_id:'block-2',context:{revision:'assist-2',blocks:[{block_id:'block-2',source_order:2,title:r.step.title,configured:true,missing:[]}]},undo_token:'undo-test',message:'Alteracao aplicada.'};}
   if(r.action==='ai_assist_undo'){window.assistantSaved=false;return {roadmap:{events:[]},context:{revision:'guide-1',blocks:[]},message:'Edicao desfeita.'};}
   if(r.action==='ai_guide_context')return window.guideContext;
   if(r.action==='ai_guide_create'){const block={source_order:2,block_id:'block-2',configured:true,missing:[],guide_id:r.guide_id,guide_step_id:r.step.id};window.guideContext={revision:'guide-2',blocks:[...window.guideContext.blocks,block]};return {block_id:block.block_id,roadmap:{events:[{id:block.block_id,order:2,type:'texto_livre',text:r.step.text}]},context:window.guideContext};}
   if(r.action==='ai_guide_update')return {block_id:r.block_id,roadmap:{events:[{id:r.block_id,order:2,type:'texto_livre',text:r.step.text}]},context:window.guideContext};
   if(['chat','generate'].includes(r.action)&&window.quota)throw Error('Limite autorizado atingido. subscription_sharing_usage_limit_exceeded');
   if(r.action==='chat'){
    if(window.hold)await new Promise(resolve=>window.release=resolve);
    window.delta?.({payload:{request_id:'unrelated',delta:'DO NOT DISPLAY'}});
    window.delta?.({payload:{request_id:r.request_id,delta:'Vamos organizar sua rotina. '}});
    return {message:window.answer||'Vamos organizar sua rotina.\n\n**Primeiro, precisamos de:**\n\n1. Portal utilizado.\n2. Empresas e competencia.\n\n<script>window.injected=true</script>'};
   }
   if(r.action==='generate')return {draft:{name:'Consulta de guias',summary:'Abrir cada guia e reunir os dados dos trabalhadores.',revision:'test',questions:window.missing?['Mapeie o botao de fechar.']:[]},preview:[{number:1,title:'Ler a lista de guias',type:'chrome_tabela',source_order:1,description:'Descobre as guias disponiveis na empresa.'},{number:2,title:'Abrir o detalhe de cada guia',type:'chrome_tabela',source_order:3,description:'Usa o botao de olho mapeado.'},{number:3,title:'Capturar os trabalhadores',type:'chrome_tabela',source_order:4,description:'Reune todas as paginas da tabela interna.'}],can_apply:!window.missing};
   if(r.action==='ai_apply')return {events:[{order:2}]};
   if(r.action==='usage')return {opened:true};
   if(r.action==='logout')return {connected:false,sharing:false,revoked:true};
  }});
 },enableMap);
 await page.getByRole('button',{name:'Continue with ChatGPT'}).click();
 await page.waitForFunction(()=>document.querySelector('.fdchat-brand i')?.dataset.connected==='true');
 await fs.mkdir(shots,{recursive:true});
}
test('React chat streams safely, preserves history, renders supplied orbs and supports keyboard',async()=>{
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));await setup(page);
  await page.screenshot({path:path.join(shots,'chat-welcome.png'),fullPage:true});
  assert.equal(await page.locator('.fdchat-welcome canvas').count(),1);
  await page.evaluate(()=>window.hold=true);
  await page.locator('[data-ai=prompt]').fill('Quero emitir guias por empresa.');await page.locator('[data-ai=prompt]').press('Enter');
  await page.waitForSelector('.fdchat-thinking canvas');
  assert.equal(await page.evaluate(()=>calls.filter(c=>c.payload.request.action==='chat').length),1);
  await page.screenshot({path:path.join(shots,'chat-thinking.png'),fullPage:true});
  await page.waitForFunction(()=>!!window.release);await page.evaluate(()=>{window.hold=false;window.release()});
  await page.waitForSelector('.fdchat-message-assistant[data-state=complete]');
  assert.equal(await page.locator('.fdchat-markdown ol li').count(),2);assert.equal(await page.locator('.fdchat-markdown script').count(),0);assert.equal(await page.evaluate(()=>window.injected),undefined);assert.ok(!(await page.locator('.fdchat-log').textContent()).includes('DO NOT DISPLAY'));
  await page.screenshot({path:path.join(shots,'chat-response.png'),fullPage:true});
  await page.locator('[data-ai=prompt]').fill('No portal FGTS');await page.locator('[data-ai=prompt]').press('Shift+Enter');
  assert.equal(await page.evaluate(()=>calls.filter(c=>c.payload.request.action==='chat').length),1);
  await page.locator('[data-ai=prompt]').press('Enter');await page.waitForFunction(()=>document.querySelectorAll('.fdchat-message-assistant[data-state=complete]').length===2);
  const last=await page.evaluate(()=>calls.filter(c=>c.payload.request.action==='chat').at(-1).payload.request);assert.equal(last.history.length,2);assert.equal(last.history[0].content,'Quero emitir guias por empresa.');assert.equal(last.history[1].role,'assistant');assert.equal(await page.evaluate(()=>window.applied),undefined);
  await page.getByRole('button',{name:'Nova conversa'}).click();assert.equal(await page.locator('.fdchat-message').count(),0);
  await page.locator('[data-ai=prompt]').fill('Nova pergunta');await page.locator('[data-ai=prompt]').press('Enter');await page.waitForFunction(()=>document.querySelectorAll('.fdchat-message-assistant[data-state=complete]').length===1);
  assert.equal(await page.evaluate(()=>calls.filter(c=>c.payload.request.action==='chat').at(-1).payload.request.history.length),0);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
test('Flow proposal is separate, requires apply, remains responsive, and handles quota without retries',async()=>{
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});await setup(page);
  await page.getByRole('button',{name:'Gerar proposta',exact:true}).click();await page.locator('[data-ai=prompt]').fill('Percorra as guias e capture os detalhes.');await page.getByRole('button',{name:'Gerar proposta de blocos'}).click();
  await page.waitForSelector('.fdchat-proposal');assert.equal(await page.locator('.fdchat-proposal ol li').count(),3);assert.equal(await page.evaluate(()=>window.applied),undefined);
  await page.screenshot({path:path.join(shots,'chat-flow-preview.png'),fullPage:true});
  await page.locator('[data-ai=apply]').click();await page.waitForFunction(()=>window.applied);assert.equal(await page.evaluate(()=>window.openedMap),undefined);await page.getByRole('button',{name:'Abrir no mapa'}).click();assert.ok(await page.evaluate(()=>window.openedMap));
  await page.evaluate(()=>window.missing=true);await page.locator('[data-ai=prompt]').fill('Ainda falta mapear o fechar.');await page.getByRole('button',{name:'Gerar proposta de blocos'}).click();await page.waitForSelector('.fdchat-questions');assert.equal(await page.locator('[data-ai=apply]').isDisabled(),true);
  await page.setViewportSize({width:600,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:path.join(shots,'chat-mobile.png'),fullPage:true});
  await page.evaluate(()=>{window.quota=true;window.calls=[]});await page.locator('[data-ai=prompt]').fill('Emita uma guia.');await page.locator('[data-ai=prompt]').press('Enter');await page.waitForSelector('.fdchat-error');assert.equal(await page.locator('[data-ai=prompt]').inputValue(),'Emita uma guia.');assert.equal(await page.evaluate(()=>calls.filter(c=>c.payload.request.action==='generate').length),1);await page.getByRole('button',{name:'Gerenciar uso no ChatGPT'}).click();assert.ok(await page.evaluate(()=>calls.some(c=>c.payload.request.action==='usage')));
 }finally{await browser.close();}
});

test('Separate chats preserve drafts, replies and proposals after reopening; rename, delete and undo work',async()=>{
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}});await setup(page);
  await page.locator('[data-ai=prompt]').fill('Automation A');await page.locator('[data-ai=prompt]').press('Enter');await page.waitForSelector('.fdchat-message-assistant[data-state=complete]');
  const first=await page.locator('.fdchat-thread[data-active=true]').getAttribute('data-chat-id');
  await page.locator('[data-ai=prompt]').fill('Draft for A');await page.getByRole('button',{name:'Nova conversa',exact:true}).click();
  await page.getByRole('button',{name:'Gerar proposta',exact:true}).click();await page.locator('[data-ai=prompt]').fill('Automation B');await page.locator('[data-ai=prompt]').press('Enter');await page.waitForSelector('.fdchat-proposal');
  const second=await page.locator('.fdchat-thread[data-active=true]').getAttribute('data-chat-id');
  await page.locator('[data-ai=prompt]').fill('Draft for B');
  await page.locator(`[data-chat-id="${first}"] .fdchat-thread-select`).click();assert.equal(await page.locator('[data-ai=prompt]').inputValue(),'Draft for A');assert.equal(await page.locator('.fdchat-proposal').count(),0);
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('mock-history')||'{}').threads?.some(t=>t.prompt==='Draft for A'));
  await setup(page);assert.equal(await page.locator('[data-ai=prompt]').inputValue(),'Draft for A');assert.equal(await page.locator('.fdchat-message-assistant').count(),1);
  await page.locator(`[data-chat-id="${second}"] .fdchat-thread-select`).click();assert.equal(await page.locator('[data-ai=prompt]').inputValue(),'Draft for B');assert.equal(await page.locator('.fdchat-proposal ol li').count(),3);
  await page.getByRole('button',{name:'Renomear Automation B'}).click();await page.getByRole('textbox',{name:'Nome da conversa'}).fill('Guias da empresa B');await page.getByRole('textbox',{name:'Nome da conversa'}).press('Enter');
  await page.getByRole('button',{name:'Excluir Guias da empresa B'}).click();assert.equal(await page.locator('.fdchat-thread').count(),1);await page.getByRole('button',{name:'Desfazer',exact:true}).click();assert.equal(await page.locator('.fdchat-thread').count(),2);
  await page.getByRole('textbox',{name:'Buscar conversas'}).fill('Guias da empresa B');assert.equal(await page.locator('.fdchat-thread').count(),1);
  await page.getByRole('textbox',{name:'Buscar conversas'}).fill('');await page.getByRole('button',{name:'Fechar prévia'}).click();
  const box=await page.locator('.fdchat').boundingBox();assert.ok(box.width>=1800);assert.equal(await page.locator('.fdchat').evaluate(el=>getComputedStyle(el).borderTopWidth),'0px');
  await page.screenshot({path:path.join(shots,'chat-history-wide.png'),fullPage:true});
 }finally{await browser.close();}
});

test('A reply in progress stays in its original conversation when switching chats',async()=>{
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});await setup(page);await page.evaluate(()=>window.hold=true);
  await page.locator('[data-ai=prompt]').fill('First automation');await page.locator('[data-ai=prompt]').press('Enter');await page.waitForFunction(()=>!!window.release);
  const first=await page.locator('.fdchat-thread[data-active=true]').getAttribute('data-chat-id');
  await page.getByRole('button',{name:'Nova conversa',exact:true}).click();await page.locator('[data-ai=prompt]').fill('Independent draft');
  await page.evaluate(()=>{window.hold=false;window.release();});await page.waitForFunction(()=>document.querySelector('.fdchat').dataset.busy==='false');
  assert.equal(await page.locator('[data-ai=prompt]').inputValue(),'Independent draft');assert.equal(await page.locator('.fdchat-message').count(),0);
  await page.locator(`[data-chat-id="${first}"] .fdchat-thread-select`).click();assert.equal(await page.locator('.fdchat-message-assistant[data-state=complete]').count(),1);
 }finally{await browser.close();}
});

test('Saved conversations require their linked automation before sending or applying blocks',async()=>{
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});await setup(page);
  await page.evaluate(()=>window.automation={id:'automation-a',name:'Automation A'});
  await page.getByRole('button',{name:'Gerar proposta',exact:true}).click();await page.locator('[data-ai=prompt]').fill('Build automation A');await page.locator('[data-ai=prompt]').press('Enter');await page.waitForSelector('.fdchat-proposal');
  assert.equal(await page.evaluate(()=>calls.find(c=>c.payload.request.action==='generate').payload.request.automation_id),'automation-a');
  await page.evaluate(()=>window.automation={id:'automation-b',name:'Automation B'});await page.locator('[data-ai=prompt]').fill('Continue A');await page.locator('[data-ai=prompt]').press('Enter');
  assert.equal(await page.evaluate(()=>calls.filter(c=>c.payload.request.action==='generate').length),1);
  await page.locator('[data-ai=apply]').click();assert.equal(await page.evaluate(()=>window.applied),undefined);
  await page.getByRole('button',{name:'Abrir automação',exact:false}).click();await page.waitForFunction(()=>window.linkedOpened);await page.locator('[data-ai=apply]').click();await page.waitForFunction(()=>window.applied);
 }finally{await browser.close();}
});

test('Guided creation asks questions, opens real configuration, saves edited block data and refreshes status',async()=>{
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage({viewport:{width:1600,height:1100},reducedMotion:'reduce'});await setup(page);
  await page.getByRole('button',{name:'Criar fluxo',exact:true}).click();await page.locator('[data-ai=prompt]').fill('Quero emitir guias, me ajude a configurar.');await page.getByRole('button',{name:'Pedir orientação'}).click();await page.waitForSelector('.fdchat-guide');
  assert.equal(await page.locator('.fdchat-guide-card').count(),2);assert.equal(await page.evaluate(()=>window.navigation?.block_id),undefined);
  await page.getByRole('button',{name:'Configurar bloco 1 no Studio'}).click();assert.equal(await page.evaluate(()=>window.navigation.block_id),'block-1');
  assert.ok((await page.locator('[data-guide-step=referencia]').textContent()).includes('Imagem de referência'));
  await page.getByRole('button',{name:'Qual portal você utiliza?',exact:true}).click();assert.ok((await page.locator('[data-ai=prompt]').inputValue()).includes('Minha resposta:'));
  await page.getByRole('textbox',{name:'Texto da etapa 2'}).fill('{{CNPJ}}');await page.locator('[data-guide-step=empresa]').getByRole('button',{name:'Criar bloco no Studio'}).click();
  await page.waitForFunction(()=>window.applied?.events?.[0]?.text==='{{CNPJ}}');assert.equal(await page.evaluate(()=>window.navigation.block_id),'block-2');
  await page.getByRole('textbox',{name:'Texto da etapa 2'}).fill('{{RAZAO_SOCIAL}}');await page.getByRole('button',{name:'Salvar alteração no bloco'}).click();await page.waitForFunction(()=>window.applied?.events?.[0]?.text==='{{RAZAO_SOCIAL}}');
  await page.evaluate(()=>{window.guideContext.blocks[0].configured=true;window.guideContext.blocks[0].missing=[];});await page.getByRole('button',{name:'Conferir configuração',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-guide-step=referencia] small[data-configured=true]'));
  assert.ok((await page.locator('[data-guide-step=referencia]').textContent()).includes('Revise e teste no editor'));
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('mock-history')||'{}').threads?.some(t=>t.guide?.steps[1]?.block_id==='block-2'));
  await setup(page);await page.waitForSelector('.fdchat-guide');assert.ok((await page.locator('[data-guide-step=empresa]').textContent()).includes('Configurar bloco 2'));
  await page.screenshot({path:path.join(shots,'chat-guided-creation.png'),fullPage:true});
 }finally{await browser.close();}
});

test('Studio navigation uses an allowlist and stable block identity with a return-to-chat instruction',async()=>{
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage();await setup(page);
  await page.evaluate(async()=>{const {createChatGuidance}=await import('/chat-guidance.js');window.route=[];window.go=createChatGuidance({getEvents:()=>[{id:'real-identity',order:7}],getEvent:()=>null,isRunning:()=>window.running,openTab:tab=>window.route.push(tab),openBlock:async order=>window.openBlock=order,onReturn:id=>window.returned=id});});
  await page.evaluate(()=>window.go({tab:'commands',order:1,block_id:'real-identity',reason:'Capture o botão Consultar no Chrome.',chat_id:'chat-a'}));
  assert.equal(await page.evaluate(()=>window.openBlock),7);assert.ok(await page.getByRole('complementary',{name:'Orientação do assistente'}).isVisible());
  await page.getByRole('button',{name:'Voltar ao chat e conferir'}).click();assert.equal(await page.evaluate(()=>window.returned),'chat-a');assert.equal(await page.evaluate(()=>window.route.at(-1)),'integrations');
  for(const target of [{tab:'shell'},{tab:'commands',block_id:'deleted',order:7}])assert.ok(await page.evaluate(async t=>{try{await window.go(t);return false}catch{return true}},target));
  await page.evaluate(()=>window.running=true);assert.ok(await page.evaluate(async()=>{try{await window.go({tab:'workbook'});return false}catch{return true}}));
 }finally{await browser.close();}
});


test('Map plus conversation creates one real step, sends the selected editor and updates instead of duplicating',async()=>{
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}});await setup(page,true);
  await page.getByRole('button',{name:'Mapa + conversa',exact:true}).click();
  assert.equal(await page.evaluate(()=>mapMounted),true);
  await page.evaluate(()=>window.autoGuide=true);
  await page.locator('[data-ai=prompt]').fill('Crie um bloco para digitar Empresa A');await page.getByRole('button',{name:'Pedir orienta\u00e7\u00e3o'}).click();
  await page.waitForFunction(()=>window.applied?.events?.[0]?.text==='Empresa A');
  assert.equal(await page.locator('.fdchat-guide-card').count(),0);
  assert.equal(await page.evaluate(()=>calls.find(c=>c.payload.request.action==='guide').payload.request.editor_context.block_id),'block-1');
  assert.equal(await page.evaluate(()=>calls.filter(c=>c.payload.request.action==='ai_guide_create').length),1);
  assert.equal(await page.evaluate(()=>calls.find(c=>c.payload.request.action==='ai_guide_create').payload.request.require_placement),true);
  assert.deepEqual(await page.evaluate(()=>calls.find(c=>c.payload.request.action==='ai_guide_create').payload.request.step.placement),{anchor_order:1,anchor_id:'block-1',position:'after'});
  assert.equal(await page.evaluate(()=>window.navigation.block_id),'block-2');
  await page.evaluate(()=>{window.editGuide=true;window.guideText='Empresa B';});
  await page.locator('[data-ai=prompt]').fill('Altere para Empresa B');await page.getByRole('button',{name:'Pedir orienta\u00e7\u00e3o'}).click();
  await page.waitForFunction(()=>window.applied?.events?.[0]?.text==='Empresa B');
  assert.equal(await page.evaluate(()=>calls.filter(c=>c.payload.request.action==='ai_guide_create').length),1);
  assert.equal(await page.evaluate(()=>calls.filter(c=>c.payload.request.action==='ai_guide_update').length),1);
  await page.locator('[data-ai=prompt]').fill('Minha d\u00favida');await page.getByRole('button',{name:'Voltar ao chat',exact:true}).click();
  assert.equal(await page.evaluate(()=>mapMounted),false);assert.equal(await page.locator('[data-ai=prompt]').inputValue(),'Minha d\u00favida');
 }finally{await browser.close();}
});

test('ChatGPT accounts can be added, selected and reconnected without reusing the other registration',async()=>{
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage();await setup(page);await page.evaluate(()=>window.multiAccount=true);
  await page.getByRole('button',{name:'Configura\u00e7\u00f5es do chat',exact:true}).click();
  await page.getByRole('button',{name:'Adicionar conta ChatGPT',exact:true}).click();
  await page.waitForFunction(()=>window.activeAccount==='personal-client');
  assert.equal(await page.evaluate(()=>calls.filter(c=>c.payload.request.action==='login').at(-1).payload.request.new_account),true);
  await page.getByRole('button',{name:'Configura\u00e7\u00f5es do chat',exact:true}).click();
  await page.getByRole('combobox',{name:'Conta ChatGPT',exact:true}).selectOption('work-client');
  await page.waitForFunction(()=>window.activeAccount==='work-client');
  await page.getByRole('button',{name:'Reconectar',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.fdchat').dataset.busy==='false');
  const request=await page.evaluate(()=>calls.filter(c=>c.payload.request.action==='login').at(-1).payload.request);
  assert.equal(request.new_account,false);assert.equal(request.account_id,'work-client');
  assert.equal(await page.locator('.fdchat-thread').count(),1);
 }finally{await browser.close();}
});


test('Assistant follows the interacted OCR block instead of stale expanded block and survives renumbering',async()=>{
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage();await setup(page);
  await page.evaluate(async()=>{
   const {createChatEditorContext}=await import('/chat-editor-context.js');
   window.editorEvents=[{id:'table',order:1,type:'chrome_tabela',title:'Ler tabela'},{id:'recognition',order:9,type:'clicar_imagem',title:'Reconhecimento OCR'}];
   const panel=document.createElement('section');panel.id='selection-fixture';panel.innerHTML='<article class="command-tree-card is-inline-expanded" data-order="1"><input></article><article class="command-tree-card" data-order="9"><button>Ver detalhes OCR</button></article>';document.body.append(panel);
   window.editor=createChatEditorContext({panel,getEvents:()=>editorEvents,getExpandedOrder:()=>1,getFocusedOrder:()=>1,isSplit:()=>true});
  });
  await page.locator('#selection-fixture [data-order="9"] button').click();
  assert.equal(await page.evaluate(()=>editor.read().block_id),'recognition');
  assert.equal(await page.evaluate(()=>editor.read().order),9);
  await page.locator('#flowChatInput').focus();assert.equal(await page.evaluate(()=>editor.read().type),'clicar_imagem');
  await page.evaluate(()=>{editorEvents[1].order=10;document.querySelector('#selection-fixture [data-order="9"]').dataset.order='10';});
  assert.equal(await page.evaluate(()=>editor.read().order),10);
  await page.evaluate(()=>{const newest={id:'newest',order:11,type:'tecla',title:'Tecla P'};editorEvents.push(newest);editor.created(newest);});
  assert.equal(await page.evaluate(()=>editor.read().block_id),'newest');
 }finally{await browser.close();}
});


test('Do with me applies a real editor transaction and offers undo without running the automation',async()=>{
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}});await setup(page,true);
  await page.getByRole('button',{name:'Mapa + conversa',exact:true}).click();
  await page.getByRole('button',{name:'Fazer comigo',exact:true}).click();
  await page.evaluate(()=>window.autoGuide=true);
  await page.locator('[data-ai=prompt]').fill('Crie e configure o texto Empresa A');await page.getByRole('button',{name:'Pedir orienta\u00e7\u00e3o'}).click();
  await page.waitForFunction(()=>window.assistantSaved===true);
  assert.equal(await page.evaluate(()=>calls.filter(c=>c.payload.request.action==='guide').at(-1).payload.request.assistant_mode),true);
  assert.equal(await page.evaluate(()=>calls.filter(c=>c.payload.request.action==='ai_assist_apply').length),1);
  await page.getByRole('button',{name:'Desfazer edi\u00e7\u00e3o',exact:true}).click();await page.waitForFunction(()=>window.assistantSaved===false);
  assert.equal(await page.evaluate(()=>calls.some(c=>/execute|run_automation/.test(c.command))),false);
 }finally{await browser.close();}
});

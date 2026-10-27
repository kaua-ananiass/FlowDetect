const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../flowdetect_chrome/service_worker.js'), 'utf8');
const fn = name => source.match(new RegExp(`^(?:async )?function ${name}\\(.*?^}`, 'ms'))[0];
const panelSource = fs.readFileSync(path.join(__dirname, '../flowdetect_chrome/sidepanel.js'), 'utf8');
const panelFn = name => panelSource.match(new RegExp(`^(?:async )?function ${name}\\(.*?^}`, 'ms'))[0];

test('panel starts legacy automations without checking or rewriting the retired initial-screen setting', async () => {
  const automation = {id:'legacy',screen_guard:{enabled:true,url:'invalid',text:''},steps:[{type:'ocr_text'}]};
  const messages = [];
  const ctx = vm.createContext({ ensureCurrentRuntime:async()=>true,getExecutionTargetTab:async()=>({id:42}),
    spreadsheetLoopInfo:()=>null,selectedPageId:'p1',startingPages:new Set(),companyPreviewRows:new Map(),
    renderExecutionPages:()=>{},renderAutomations:()=>{},
    chrome:{runtime:{sendMessage:async message=>{messages.push(message);return {ok:true};}}} });
  vm.runInContext(panelFn('runAutomation'),ctx);
  await ctx.runAutomation(automation);
  assert.equal(messages.length,1);
  assert.equal(messages[0].type,'flowdetect-start');
  assert.equal(messages[0].tabId,42);
  assert.equal(automation.screen_guard.enabled,true,'Do not rewrite user data to disable the removed feature');
});

test('extension restart releases stale waiting states without interrupting live executions', () => {
  const ctx = vm.createContext({ Date, Array });
  vm.runInContext(panelFn('reconcileStoredRun'), ctx);
  for (const status of ['running', 'waiting_screen']) {
    const run = { id: 'live', status };
    assert.equal(ctx.reconcileStoredRun(run, { activeRunIds: ['live'] }), run);
    assert.equal(ctx.reconcileStoredRun(run, null), run);
    assert.equal(ctx.reconcileStoredRun(run, { activeRunIds: [] }).status, 'stopped');
  }
});
function context(extra = {}) {
  const ctx = vm.createContext({ URL, Error, String, ...extra });
  vm.runInContext(['normalizeScreenGuard', 'screenUrlMatches', 'checkAutomationScreen'].map(fn).join('\n'), ctx);
  return ctx;
}

test('screen gate validates both settings and keeps old automations compatible', () => {
  const ctx = context();
  assert.equal(ctx.normalizeScreenGuard().enabled, false);
  assert.throws(() => ctx.normalizeScreenGuard({ enabled: true, url: 'chrome://settings', text: 'Empresa' }), /HTTP/);
  assert.throws(() => ctx.normalizeScreenGuard({ enabled: true, url: 'https://site.test/page', text: ' ' }), /texto/);
  const guard = ctx.normalizeScreenGuard({ enabled: true, url: 'https://site.test/page?id=1#/start', text: ' Empresa ' });
  assert.equal(guard.url, 'https://site.test/page#/start');
  assert.equal(guard.text, 'Empresa');
});

test('URL matching requires the same origin, path and SPA route while ignoring query parameters', () => {
  const ctx = context();
  assert.equal(ctx.screenUrlMatches('https://site.test/page?id=2#/start', 'https://site.test/page#/start'), true);
  for (const url of ['https://site.test.evil/page#/start', 'http://site.test/page#/start', 'https://site.test/other#/start', 'https://site.test/page#/other']) {
    assert.equal(ctx.screenUrlMatches(url, 'https://site.test/page#/start'), false);
  }
});


function readyContext({url='https://site.test/page', text=true, documentUrl=url, changed=false}={}) {
  let queries=0;
  const messages=[];
  const ctx=context({chrome:{tabs:{
    query:async()=>[{id:changed && ++queries>1 ? 99 : 42}],
    get:async id=>({id,url,status:'complete'}),
    sendMessage:async(id,message)=>{messages.push(message);return {ok:true,url:documentUrl,hasText:text}},
  }}});
  return {ctx,messages};
}
const guard={enabled:true,url:'https://site.test/page',text:'Empresa'};
test('wrong active URL blocks immediately without text lookup or waiting',async()=>{
  const {ctx,messages}=readyContext({url:'https://other.test/'});
  assert.equal((await ctx.checkAutomationScreen(guard)).ready,false);
  assert.equal(messages.length,0);
});
test('URL and text in the active tab release the button',async()=>{
  const {ctx,messages}=readyContext();
  const result=await ctx.checkAutomationScreen(guard);
  assert.equal(result.ready,true);
  assert.equal(result.tabId,42);
  assert.equal(messages[0].type,'flowdetect-screen-check-v2');
});
test('missing text or stale document URL keeps execution blocked',async()=>{
  for(const options of [{text:false},{documentUrl:'https://site.test/login'}]){
    const {ctx}=readyContext(options);
    assert.equal((await ctx.checkAutomationScreen(guard)).ready,false);
  }
});
test('switching tabs during validation cannot authorize the old tab',async()=>{
  const {ctx}=readyContext({changed:true});
  assert.equal((await ctx.checkAutomationScreen(guard)).ready,false);
  const stable=readyContext().ctx;
  assert.equal((await stable.checkAutomationScreen(guard,99)).ready,false);
});
test('worker ignores retired initial-screen metadata and reaches normal run creation',async()=>{
  let created=0;
  const ctx=context({activeRuns:new Map(),Number,
    checkAutomationScreen:async()=>({ready:false,reason:'Tela errada'}),
    clearDownloadRouteForTab:async()=>{},
    createRun:()=>{created++;throw Error('run creation reached')},
  });
  // Override the concrete checker to isolate execution ordering.
  ctx.checkAutomationScreen=async()=>{throw Error('Retired gate must not be called')};
  vm.runInContext(fn('executeAutomationOnPage'),ctx);
  await assert.rejects(ctx.executeAutomationOnPage({schema:'flowdetect_chrome_automation',version:3,steps:[{type:'ocr_text'}],screen_guard:{enabled:true,url:'invalid'}},42,1,null,[],null,{id:'page-1'}),/run creation reached/);
  assert.equal(created,1);
});

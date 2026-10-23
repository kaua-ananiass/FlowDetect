const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../flowdetect_chrome/service_worker.js'), 'utf8');
const fn = name => source.match(new RegExp(`^(?:async )?function ${name}\\(.*?^}`, 'ms'))[0];
const panelSource = fs.readFileSync(path.join(__dirname, '../flowdetect_chrome/sidepanel.js'), 'utf8');
const panelFn = name => panelSource.match(new RegExp(`^(?:async )?function ${name}\\(.*?^}`, 'ms'))[0];

test('screen settings are saved per automation and preserve other automations', async () => {
  const automation = { id: 'first', steps: [{ type: 'ocr_text' }] };
  let stored = [automation, { id: 'other' }];
  const ctx = vm.createContext({ URL, Error, String, getAutomations: async () => stored,
    setAutomations: async items => { stored = items; } });
  vm.runInContext(['screenGuardFromForm', 'saveScreenGuard'].map(panelFn).join('\n'), ctx);
  const fields = { '.screen-guard-enabled': { checked: true }, '.screen-guard-url': { value: 'https://site.test/page?id=2' },
    '.screen-guard-text': { value: ' Empresa ' } };
  await ctx.saveScreenGuard(automation, { querySelector: key => fields[key] });
  assert.equal(stored[0].screen_guard.url, 'https://site.test/page');
  assert.equal(stored[0].screen_guard.text, 'Empresa');
  assert.equal(stored[0].steps, automation.steps);
  assert.equal(stored[1].id, 'other');
  fields['.screen-guard-text'].value = '';
  await assert.rejects(ctx.saveScreenGuard(automation, { querySelector: key => fields[key] }), /texto/);
  assert.equal(stored[0].screen_guard.text, 'Empresa');
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
test('worker rejects the wrong screen before creating or capturing an execution',async()=>{
  let created=0;
  const ctx=context({activeRuns:new Map(),Number,
    checkAutomationScreen:async()=>({ready:false,reason:'Tela errada'}),
    createRun:()=>{created++;throw Error('must not create')},
  });
  // Override the concrete checker to isolate execution ordering.
  ctx.checkAutomationScreen=async()=>({ready:false,reason:'Tela errada'});
  vm.runInContext(fn('executeAutomationOnPage'),ctx);
  await assert.rejects(ctx.executeAutomationOnPage({schema:'flowdetect_chrome_automation',version:3,steps:[{type:'ocr_text'}],screen_guard:guard},42,1,null,[],null,{id:'page-1'}),/Tela errada/);
  assert.equal(created,0);
});

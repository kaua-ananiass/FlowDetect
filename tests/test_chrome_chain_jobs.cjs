const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../flowdetect_chrome/service_worker.js'),'utf8');
const fn=name=>source.match(new RegExp(`^(?:async )?function ${name}\\(.*?^}`, 'ms'))[0];
function runtime() {
  const pages=[{id:'p1',tabId:12,name:'Página 1'}],runs=new Map(),started=[], tabs=[];
  const context=vm.createContext({URL,structuredClone,Promise,Map,Number,String,
    activeRuns:runs,chainRuns:new Map(),getPages:async()=>pages,
    chrome:{tabs:{get:async()=>({id:12,windowId:1,url:'https://portal.test/empresa',title:'Portal'}),update:async(id)=>tabs.push(id)},windows:{update:async()=>{}}},
    executeAutomation:async(automation,tabId,_row,_included,_excluded,_route,pageId,onStarted)=>{
      const run={id:'run-1',status:'running',currentStep:0,totalSteps:2};runs.set(run.id,run);started.push({automation,tabId,pageId});onStarted(run);
      await new Promise(resolve=>{context.finish=()=>{run.status='completed';runs.delete(run.id);resolve();};});return run;
    },
  });
  vm.runInContext('let chainReservation="";\n'+fn('handleStudioChainJob')+'\n'+fn('handleMessage'),context);
  return {context,runs,started,tabs,pages};
}
const automation=()=>({schema:'flowdetect_chrome_automation',steps:[{source_order:1,type:'ocr_text'},{source_order:5,type:'focused_text'}],chain_variables:{empresa:'330'}});

test('agent starts Chrome by command and waits for the same run to finish',async()=>{
  const {context,started,tabs}=runtime();
  await context.handleStudioChainJob({type:'chain_reserve',chainId:'chain-1',stages:[{engine:'chrome',pageId:'p1',expectedUrl:'https://portal.test/empresa'}]});
  const reply=await context.handleStudioChainJob({type:'chain_start',chainId:'chain-1',automation:automation(),pageId:'p1',entryOrder:5,expectedUrl:'https://portal.test/empresa'});
  assert.equal(reply.runId,'run-1');assert.equal(started[0].tabId,12);assert.equal(started[0].pageId,'p1');assert.equal(started[0].automation.entry_order,5);assert.equal(started[0].automation.chain_variables.empresa,'330');assert.deepEqual(tabs,[12]);
  assert.equal((await context.handleStudioChainJob({type:'chain_status',runId:reply.runId})).run.status,'running');
  await assert.rejects(context.handleMessage({type:'flowdetect-start',automation:{},pageId:'p1',tabId:12}),/reservou/);
  await assert.rejects(context.handleStudioChainJob({type:'chain_release',chainId:'chain-1'}),/Pare/);
  context.finish();await new Promise(setImmediate);
  assert.equal((await context.handleStudioChainJob({type:'chain_status',runId:reply.runId})).run.status,'completed');
  assert.equal((await context.handleStudioChainJob({type:'chain_release',chainId:'chain-1'})).ok,true);
});

test('invalid tab, URL, entry and loop context fail before Chrome starts',async()=>{
  const {context,started,pages}=runtime();
  await assert.rejects(context.handleStudioChainJob({type:'chain_reserve',chainId:'a',stages:[{engine:'chrome',pageId:'p1',expectedUrl:'https://wrong.test/empresa'}]}),/URL esperada/);
  pages[0].tabId=null;
  await assert.rejects(context.handleStudioChainJob({type:'chain_reserve',chainId:'a',stages:[{engine:'chrome',pageId:'p1'}]}),/sem aba|não tem aba/);
  pages[0].tabId=12;
  await context.handleStudioChainJob({type:'chain_reserve',chainId:'a'});
  await assert.rejects(context.handleStudioChainJob({type:'chain_start',chainId:'other',automation:automation(),pageId:'p1'}),/reserva/);
  await assert.rejects(context.handleStudioChainJob({type:'chain_start',chainId:'a',automation:automation(),pageId:'p1',entryOrder:999}),/entrada/);
  const looped=automation();looped.steps[0].spreadsheet_loop={values:['330']};
  await assert.rejects(context.handleStudioChainJob({type:'chain_start',chainId:'a',automation:looped,pageId:'p1',entryOrder:5}),/loop/);
  assert.equal(started.length,0);
});

test('stop targets the exact chain run; lost executions require operator review',async()=>{
  const {context,runs}=runtime();
  runs.set('a',{id:'a',status:'running'});runs.set('b',{id:'b',status:'running'});
  await context.handleStudioChainJob({type:'chain_stop',runId:'b'});
  assert.equal(runs.get('a').cancelled,undefined);assert.equal(runs.get('b').cancelled,true);
  assert.equal((await context.handleStudioChainJob({type:'chain_status',runId:'lost'})).ok,false);
});

test('reservation rechecks competing executions after asynchronous tab inspection',async()=>{
  const {context,runs}=runtime();
  context.chrome.tabs.get=async()=>{runs.set('manual',{id:'manual',status:'running'});return {id:12,url:'https://portal.test/empresa'};};
  await assert.rejects(context.handleStudioChainJob({type:'chain_reserve',chainId:'a',stages:[{engine:'chrome',pageId:'p1'}]}),/durante a conferência/);
  runs.clear();
  await assert.rejects(context.handleStudioChainJob({type:'chain_start',chainId:'a',automation:automation(),pageId:'p1'}),/reserva/);
});

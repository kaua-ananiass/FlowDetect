const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(process.env.FLOWDETECT_STUDIO_WEB||path.join(__dirname,'..','tauri_gerador','web'),'main.js'),'utf8');
function fragment(start,end){
  const i=source.indexOf('function '+start+'(');
  const j=source.indexOf('function '+end+'(',i+1);
  assert.ok(i>=0&&j>i,'Cannot extract '+start);
  return source.slice(i,j);
}
const microtasks=async()=>new Promise(resolve=>setImmediate(resolve));
test('Remote HTTP mouse coalesces moves with only one in-flight command',async()=>{
  const frames=[];
  const inflight=[];
  const remote={pendingRemotePointerMove:null,remotePointerMoveFrame:null,httpPointerSending:false,connected:true,screenStreaming:true,address:'192.0.2.10:18452'};
  const context=vm.createContext({
    state:{remoteControl:remote},
    window:{requestAnimationFrame:cb=>{frames.push(cb);return frames.length}},
    invoke:(name,args)=>{inflight.push({name,args});return new Promise(resolve=>{inflight.at(-1).finish=resolve})},
    console
  });
  vm.runInContext(fragment('scheduleHttpRemotePointerMove','sendStudioRemoteControlEvent'),context);
  remote.pendingRemotePointerMove={kind:'mouse',event:'move',x:0.1,y:0.2};
  context.scheduleHttpRemotePointerMove();
  assert.equal(frames.length,1);
  frames.shift()();
  assert.equal(inflight.length,1);
  assert.equal(remote.httpPointerSending,true);
  for(let i=0;i<200;i++){
    remote.pendingRemotePointerMove={kind:'mouse',event:'move',x:i/200,y:0.8};
    context.scheduleHttpRemotePointerMove();
  }
  assert.equal(inflight.length,1,'no concurrent network mouse calls');
  inflight[0].finish({ok:true});
  await microtasks();
  assert.equal(frames.length,1);
  frames.shift()();
  assert.equal(inflight.length,2);
  assert.equal(inflight[1].args.event.x,199/200,'last mouse point wins');
  assert.equal(inflight[1].args.event.y,0.8);
  inflight[1].finish({ok:true});
  await microtasks();
  assert.equal(remote.httpPointerSending,false);
  assert.equal(remote.pendingRemotePointerMove,null);
});
test('Physical screen is WebRTC only and exposes an actionable failure',()=>{
  const start=fragment('startStudioControlScreenStream','startStudioControlPolling');
  assert.match(start,/startStudioControlWebRtc\(\)/);
  assert.match(start,/failStudioVideo\(error\)/);
  assert.doesNotMatch(source,/startPhysicalSnapshotStream|physicalRemoteScreenProfile|invoke\("remote_agent_screen_snapshot"/);
});

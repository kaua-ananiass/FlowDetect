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
test('Snapshot stream reuses unchanged frame and adapts compression profile',async()=>{
  const frames=[];
  const timers=[];
  const calls=[];
  let sourceChanges=0;
  const screenImage={hidden:true,set src(v){sourceChanges++;this._src=v;},get src(){return this._src}};
  const video={hidden:true};
  const status={textContent:''};
  const quality={value:'fast'};
  const remote={physicalAgentId:'agent-1',screenStreaming:true,screenGeneration:7,screenStreamTimer:null,screenSnapshotUrl:'',screenSnapshotHash:'',screenError:'',address:'192.0.2.10:18452'};
  let full=true;
  const context=vm.createContext({
    state:{remoteControl:remote},
    document:{getElementById:()=>quality},
    studioControlScreenImage:screenImage,
    studioControlScreenVideo:video,
    studioControlScreenStatus:status,
    performance:{now:()=>Date.now()},
    window:{setTimeout:(cb,ms)=>{timers.push({cb,ms});return timers.length;}},
    renderStudioControlScreenOnly:()=>{},
    releasePhysicalRemoteInput:()=>{},
    invoke:async(_name,args)=>{
      calls.push({...args});
      if(full){full=false;return {data:'AAAA',mime:'image/jpeg',frame_hash:'a'.repeat(64),capture_ms:27};}
      return {unchanged:true,frame_hash:'a'.repeat(64),capture_ms:8};
    }
  });
  vm.runInContext(fragment('physicalRemoteScreenProfile','stopStudioControlScreenStream'),context);
  context.startPhysicalSnapshotStream(7);
  await microtasks();
  assert.equal(calls.length,1);
  assert.equal(calls[0].width,960);
  assert.equal(calls[0].quality,43);
  assert.equal(sourceChanges,1);
  assert.equal(remote.screenSnapshotHash,'a'.repeat(64));
  assert.equal(timers.length,1);
  timers.shift().cb();
  await microtasks();
  assert.equal(calls.length,2);
  assert.equal(calls[1].previousHash,'a'.repeat(64));
  assert.equal(sourceChanges,1,'unchanged frames do not trigger DOM image replace');
  quality.value='balanced';
  remote.screenSnapshotHash='';
  timers.shift().cb();
  await microtasks();
  assert.equal(calls[2].width,1280);
  assert.equal(calls[2].quality,53);
  assert.equal(calls[2].previousHash,null);
  remote.screenStreaming=false;
});
test('Remote Agent physical screen avoids an unsupported WebRTC handshake',()=>{
  const start=fragment('startStudioControlScreenStream','startStudioControlPolling');
  assert.match(start,/if\s*\(remote\.physicalAgentId\)\s*\{\s*\/\/.*?Agent/s);
  assert.ok(start.indexOf('startPhysicalSnapshotStream(generation)')<start.indexOf('startStudioControlWebRtc()'));
});

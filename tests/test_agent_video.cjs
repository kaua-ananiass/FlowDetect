const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');

test('Agent sends real 1080p video over WebRTC, forwards input and releases it on disconnect',async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1920,height:1080}});
    await page.setContent('<button id="enable">Ativar</button><p id="status"></p><small id="studioControlRemoteInputStatus"></small><video id="received" tabindex="0" style="width:960px;height:540px" autoplay muted playsinline></video><canvas width="1920" height="1080"></canvas>');
    await page.addScriptTag({path:path.join(root,'flowdetect_agent/web/agent-video.js')});
    if(process.env.NATIVE_CAPTURE_URL)await page.addScriptTag({path:path.join(root,'flowdetect_agent/web/native-screen.js')});
    await page.evaluate(url=>{window.nativeCaptureUrl=url;},process.env.NATIVE_CAPTURE_URL || '');
    const studioSource=await fs.readFile(path.join(root,'tauri_gerador/web/main.js'),'utf8');
    const statsSource=await fs.readFile(path.join(root,'tauri_gerador/web/remote-video-stats.js'),'utf8');
    await page.addScriptTag({content:statsSource.replace('export function','function')});
    await page.addScriptTag({content:`
      const state={activeTab:'agent-screen',remoteControl:{connected:true,address:'loopback',screenAddress:'loopback',physicalAgentId:'test',screenStreaming:true,remoteInputEnabled:true,physicalHeldInputs:new Map()}};
      const studioControlScreenVideo=document.querySelector('video');
      const studioControlScreenImage=document.createElement('img');
      const studioControlScreenStatus=document.querySelector('#status');
      function invoke(command,args){return window.videoInvoke(command,args);}
      function startStudioControlPolling(){}
      function renderStudioControlScreenOnly(){}
      function failStudioVideo(){throw Error('Unexpected video failure');}
      ${studioSource.slice(studioSource.indexOf('function waitForIceGatheringComplete('),studioSource.indexOf('function remoteScreenPointFromEvent('))}
      ${studioSource.slice(studioSource.indexOf('function remoteScreenPointFromEvent('),studioSource.indexOf('function stopStudioControlScreenStream('))}
      ${studioSource.slice(studioSource.indexOf('studioControlScreenVideo?.addEventListener("mouseenter"'),studioSource.indexOf('studioControlSheetRefreshButton?.addEventListener('))}
      window.receiverState=state;
    `});
    const result=await page.evaluate(async()=>{
      const events=[];
      const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d',{alpha:false});
      let frame=0;
      const draw=setInterval(()=>{
        if(nativeCaptureUrl)return;
        ctx.fillStyle=frame%2?'#16374a':'#1d4559';ctx.fillRect(0,0,1920,1080);
        ctx.fillStyle='white';ctx.font='48px Arial';ctx.fillText(`FlowDetect 1080p · ${frame++}`,80,120);
        ctx.fillStyle='#36d5c5';ctx.fillRect((frame*15)%1700,400,180,180);
      },1000/60);
      const source=canvas.captureStream(60);
      const captured=source.getVideoTracks()[0];
      const realConstraints=captured.applyConstraints.bind(captured);
      const requested=[];captured.applyConstraints=async c=>{requested.push(c);return realConstraints(c);};
      let answer=null, signal={},inputMode='ok';
      window.videoInvoke=async(command,args)=>{
        if(command==='agent_unattended_status')return {enabled:true};
        if(command==='agent_native_frame')return (await fetch(nativeCaptureUrl)).arrayBuffer();
        if(command==='agent_webrtc_poll_offer')return signal;
        if(command==='agent_webrtc_set_answer'){answer=args.answer;return {};}
        if(command==='get_agent_mouse_control_state')return {mouse_enabled:true,keyboard_enabled:true};
        if(command==='agent_remote_control_event'){
          if(inputMode==='blocked')return {ok:false,ignored:true,reason:'input_disabled'};
          if(inputMode==='error')throw Error('Windows recusou o evento: execute o Agent como administrador.');
          events.push(args.event);return {ok:true};
        }
        if(command==='remote_agent_webrtc_offer'){signal={session_id:'loopback-test',offer:args.offer};return signal;}
        if(command==='remote_agent_webrtc_answer')return {...signal,answer};
        if(command==='remote_agent_webrtc_clear'){signal={};return {};}
        throw Error(command);
      };
      const native=nativeCaptureUrl?createNativeScreen(window.videoInvoke):null;
      const agent=createAgentVideo({button:document.querySelector('#enable'),status:document.querySelector('#status'),native,
        mediaDevices:{getDisplayMedia:async()=>source}, invoke:window.videoInvoke});
      await agent.enable();
      await startStudioControlWebRtc();
      const client=receiverState.remoteControl.webrtcPeer;
      const control=receiverState.remoteControl.webrtcControlChannel;
      const wait=async(predicate)=>{for(let i=0;i<100;i++){if(predicate())return;await new Promise(r=>setTimeout(r,50));}throw Error('Timed out waiting for WebRTC '+JSON.stringify({state:client.connectionState,ice:client.iceConnectionState,channel:control.readyState,width:document.querySelector('video').videoWidth,height:document.querySelector('video').videoHeight,settings:captured.getSettings(),status:document.querySelector('#status').textContent,answer}));};
      await wait(()=>control.readyState==='open' && document.querySelector('video').videoWidth===1920);
      const before=await client.getStats();
      await new Promise(r=>setTimeout(r,4000));
      const after=await client.getStats();
      let decoded;
      after.forEach(r=>{if(r.type==='inbound-rtp'&&r.kind==='video'){const prior=before.get(r.id);decoded={width:r.frameWidth,height:r.frameHeight,frames:r.framesDecoded,measuredFps:(r.framesDecoded-prior.framesDecoded)*1000/(r.timestamp-prior.timestamp)};}});
      const video=document.querySelector('video');const rect=video.getBoundingClientRect();
      video.dispatchEvent(new MouseEvent('mousedown',{clientX:rect.left+rect.width/2,clientY:rect.top+rect.height/2,button:0,bubbles:true}));
      video.dispatchEvent(new MouseEvent('mouseup',{clientX:rect.left+rect.width/2,clientY:rect.top+rect.height/2,button:0,bubbles:true}));
      video.dispatchEvent(new MouseEvent('mousemove',{clientX:rect.left+rect.width/3,clientY:rect.top+rect.height/3,bubbles:true}));
      if(document.activeElement!==video)throw Error('Remote video did not receive keyboard focus');
      window.dispatchEvent(new KeyboardEvent('keydown',{key:'a',code:'KeyA',bubbles:true,cancelable:true}));
      await wait(()=>events.some(e=>e.kind==='key'&&e.event==='down')&&events.some(e=>e.kind==='mouse'&&e.event==='down')&&events.some(e=>e.event==='move'));
      inputMode='blocked';sendStudioRemoteControlEvent({kind:'mouse',event:'move',x:.5,y:.5});
      await wait(()=>receiverState.remoteControl.inputFeedbackError?.includes('bloqueados'));
      const blockedFeedback=document.querySelector('#studioControlRemoteInputStatus').textContent;
      inputMode='error';sendStudioRemoteControlEvent({kind:'mouse',event:'move',x:.4,y:.4});
      await wait(()=>receiverState.remoteControl.inputFeedbackError?.includes('administrador'));
      const errorFeedback=document.querySelector('#studioControlRemoteInputStatus').textContent;
      inputMode='ok';
      signal={session_id:''};await agent.poll();
      await wait(()=>events.some(e=>e.event==='up'&&e.code==='KeyA'));
      const activeTrack=native?document.querySelector('video').srcObject.getVideoTracks()[0]:captured;
      const readyBeforeStop=activeTrack.readyState;
      const receiverStats=receiverState.remoteControl.screenVideoStatsText;
      stopStudioControlWebRtc();agent.dispose();native?.stop();clearInterval(draw);
      return {decoded,requested,events,readyBeforeStop,receiverStats,blockedFeedback,errorFeedback,stopped:native?'ended':captured.readyState};
    });
    assert.equal(result.decoded.width,1920);
    assert.equal(result.decoded.height,1080);
    assert.ok(result.events.some(e=>e.kind==='mouse'&&e.event==='down'&&Math.abs(e.x-.5)<.002&&Math.abs(e.y-.5)<.002),JSON.stringify(result.events));
    assert.match(result.blockedFeedback,/bloqueados/);
    assert.match(result.errorFeedback,/administrador/);
    // Rendering/scheduling varies in shared CI; report actual FPS, never fake 30.
    // Native capture smoke test includes the physical desktop's refresh rate
    // and a test-only localhost binary bridge. Record performance honestly;
    // the independent animated WebRTC transport test still requires 30 FPS.
    assert.ok(result.decoded.measuredFps>=(process.env.NATIVE_CAPTURE_URL?20:30),JSON.stringify(result));
    if(!process.env.NATIVE_CAPTURE_URL)assert.equal(result.requested[0].frameRate.max,60);
    assert.equal(result.readyBeforeStop,'live','clearing the session allows a new connection without asking again');
    assert.equal(result.stopped,'ended');
    assert.match(result.receiverStats,/1920.*1080.*FPS recebidos/);
    console.log('Measured 1080p loopback FPS:',result.decoded.measuredFps.toFixed(1));
    await fs.mkdir(path.join(root,'output/agent-video'),{recursive:true});
    await fs.writeFile(path.join(root,process.env.NATIVE_CAPTURE_URL?'output/native-agent/native-loopback.json':'output/agent-video/loopback.json'),JSON.stringify(result,null,2));
  }finally{await browser.close();}
});

test('Agent reports missing consent and rejects window capture without sending input',async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();await page.setContent('<button></button><p></p>');
    await page.addScriptTag({path:path.join(root,'flowdetect_agent/web/agent-video.js')});
    const result=await page.evaluate(async()=>{
      let rejected=false, stopped=false, inputs=0;const answers=[];
      const agent=createAgentVideo({button:document.querySelector('button'),status:document.querySelector('p'),
        invoke:async(command,args)=>{if(command==='agent_webrtc_poll_offer')return {session_id:'unauthorized',offer:{}};if(command==='agent_webrtc_set_answer')answers.push(args);if(command==='agent_remote_control_event')inputs++;},
        mediaDevices:{getDisplayMedia:async()=>({getVideoTracks:()=>[{getSettings:()=>({displaySurface:'window'}),stop:()=>{stopped=true;}}],getTracks:()=>[{stop:()=>{stopped=true;}}]})}});
      await agent.poll();try{await agent.enable();}catch{rejected=true;}agent.dispose();
      return {rejected,stopped,inputs,answers};
    });
    assert.equal(result.rejected,true);assert.equal(result.stopped,true);assert.equal(result.inputs,0);
    assert.equal(result.answers[0].answer.type,'error');
  }finally{await browser.close();}
});

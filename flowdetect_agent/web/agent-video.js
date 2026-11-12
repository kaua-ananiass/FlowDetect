/* LAN video sender. Media stays in WebView2/WebRTC, never in JSON/JPEG IPC. */
(() => {
  const PROFILES = {
    fast: {width:1920,height:1080,fps:60,bitrate:8000000},
    balanced: {width:1920,height:1080,fps:60,bitrate:12000000},
    sharp: {width:1920,height:1080,fps:60,bitrate:16000000},
  };
  function iceReady(peer) {
    if (peer.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise(resolve => {
      const finish = () => { clearTimeout(timer); peer.removeEventListener('icegatheringstatechange',check); resolve(); };
      const check = () => { if (peer.iceGatheringState === 'complete') finish(); };
      const timer = setTimeout(finish,4000);
      peer.addEventListener('icegatheringstatechange',check);
    });
  }
  window.createAgentVideo = function({invoke, button, status, mediaDevices=navigator.mediaDevices,native=null}) {
    let stream=null, peer=null, session='', generation=0, busy=false, acquiring=false, disposed=false, timer=null;
    let pointer=null, pointerBusy=false, reliable=Promise.resolve(), statsTimer=null, retries=0,controlChannel=null,lastFeedback='';
    const held=new Map();
    const show = message => { if(status) status.textContent=message; };
    function feedback(result={},error='') {
      const enabled=!result.ignored && result.mouse_enabled!==false;
      const message=error || (enabled?'':'Mouse e teclado bloqueados no Agent. Ative o controle no painel do Agent.');
      const payload=JSON.stringify({kind:'input-status',enabled:enabled&&!error,error:message});
      if(controlChannel?.readyState==='open' && payload!==lastFeedback){controlChannel.send(payload);lastFeedback=payload;}
      if(message)show(message);
    }
    async function applyInput(event){
      const result=await invoke('agent_remote_control_event',{event});
      feedback(result);
      return !result?.ignored;
    }
    const release = () => {
      for(const event of held.values()) invoke('agent_remote_control_event',{event:{...event,event:'up'}}).catch(()=>{});
      held.clear();pointer=null;
    };
    function disconnect() {
      native?.pause();
      generation++;release();session='';
      clearInterval(statsTimer);statsTimer=null;
      const old=peer;peer=null;old?.close();
      controlChannel=null;lastFeedback='';
    }
    function stop() {
      disconnect();const old=stream;stream=null;
      old?.getTracks().forEach(track=>track.stop());
      if(button){button.textContent='Ativar vídeo';button.setAttribute('aria-pressed','false');}
      show('Vídeo desligado · ative para conectar pelo Studio');
    }
    async function enable() {
      if(acquiring)return;
      if(!native && !mediaDevices?.getDisplayMedia)throw Error('Atualize o Microsoft Edge WebView2 para ativar vídeo.');
      acquiring=true;
      try {
        // Production uses the native provider; browser capture is retained only
        // for isolated transport tests and explicitly supplied legacy providers.
        const selected=native?await native.acquire():await mediaDevices.getDisplayMedia({audio:false,
          video:{displaySurface:'monitor',width:{ideal:1920,max:1920},height:{ideal:1080,max:1080},frameRate:{ideal:60,max:60}}});
        if(disposed){selected.getTracks().forEach(t=>t.stop());return;}
        const track=selected.getVideoTracks()[0];
        if(!track || (track.getSettings().displaySurface && track.getSettings().displaySurface!=='monitor')) {
          selected.getTracks().forEach(t=>t.stop());throw Error('Selecione a tela principal inteira, não uma janela.');
        }
        stop();stream=selected;track.contentHint='motion';
        track.addEventListener('ended',()=>{if(stream===selected)stop();},{once:true});
        if(button){button.textContent='Desativar vídeo';button.setAttribute('aria-pressed','true');}
        show(native?'Captura nativa pronta · acesso não assistido · 1080p / 60 FPS':'Vídeo pronto · tela principal · alvo 1080p / 60 FPS');
        void poll();
      } finally {acquiring=false;}
    }
    async function pointerTick() {
      if(pointerBusy || !pointer || !peer || peer.connectionState!=='connected')return;
      const event=pointer;pointer=null;pointerBusy=true;
      try{await applyInput(event);}catch(error){feedback({},String(error.message || error));}finally{pointerBusy=false;}
    }
    const pointerTimer=setInterval(pointerTick,16);
    function acceptChannel(channel, id) {
      if(!['flowdetect-control','flowdetect-pointer'].includes(channel.label)){channel.close();return;}
      if(channel.label==='flowdetect-control'){
        controlChannel=channel;
        const report=()=>{if(id===generation)invoke('get_agent_mouse_control_state').then(result=>feedback(result)).catch(error=>feedback({},String(error.message||error)));};
        channel.onopen=report;if(channel.readyState==='open')report();
      }
      channel.onmessage=message=>{
        if(id!==generation || peer?.connectionState!=='connected' || typeof message.data!=='string' || message.data.length>4096)return;
        let event;try{event=JSON.parse(message.data);}catch{return;}
        if(!['mouse','key'].includes(event?.kind))return;
        if(event.kind==='mouse' && event.event==='move'){pointer=event;return;}
        if(channel.label!=='flowdetect-control')return;
        if(retries>=64){disconnect();show('Fila de controle cheia. Reconecte a tela no Studio.');return;}
        const key=event.kind==='key'?`key:${event.code || event.key}`:`mouse:${event.button || 0}`;
        retries++;
        reliable=reliable.then(async()=>{
          if(id!==generation)return;
          const applied=await applyInput(event);
          if(event.event==='down') {
            if(applied && id===generation)held.set(key,event);
            else if(applied)await invoke('agent_remote_control_event',{event:{...event,event:'up'}});
          }
          if(event.event==='up')held.delete(key);
        }).catch(error=>feedback({},String(error.message || error))).finally(()=>{retries--;});
      };
      channel.onclose=()=>{if(id===generation)release();};
    }
    async function answer(signal) {
      disconnect();session=signal.session_id;
      const id=generation;
      const current=peer=new RTCPeerConnection({iceServers:[],bundlePolicy:'max-bundle'});
      current.ondatachannel=event=>acceptChannel(event.channel,id);
      current.onconnectionstatechange=()=>{
        if(peer!==current)return;
        if(['failed','closed','disconnected'].includes(current.connectionState))release();
      };
      await current.setRemoteDescription(signal.offer);
      if(id!==generation)return;
      const profile=PROFILES[signal.offer.profile] || PROFILES.balanced;
      const codecs=RTCRtpSender.getCapabilities?.('video')?.codecs || [];
      const transceiver=current.getTransceivers().find(t=>t.receiver.track.kind==='video');
      if(transceiver?.setCodecPreferences && codecs.some(c=>c.mimeType.toLowerCase()==='video/h264')) {
        transceiver.setCodecPreferences([...codecs.filter(c=>c.mimeType.toLowerCase()==='video/h264'),
          ...codecs.filter(c=>c.mimeType.toLowerCase()!=='video/h264')]);
      }
      const track=stream.getVideoTracks()[0];
      await native?.resume();
      if(!native)await track.applyConstraints({width:{ideal:profile.width,max:profile.width},height:{ideal:profile.height,max:profile.height},frameRate:{ideal:profile.fps,max:profile.fps}});
      if(id!==generation)return;
      const sender=current.addTrack(track,stream);
      const params=sender.getParameters();
      params.encodings=params.encodings?.length?params.encodings:[{}];
      params.encodings[0]={...params.encodings[0],maxBitrate:profile.bitrate,maxFramerate:profile.fps,scaleResolutionDownBy:1};
      params.degradationPreference='maintain-resolution';
      await sender.setParameters(params);
      const answer=await current.createAnswer();
      // Chromium otherwise starts at a few hundred kb/s and spends several
      // seconds upscaling from a blurry preview, even on a fast LAN.
      const videoPayloads=new Set([...answer.sdp.matchAll(/^a=rtpmap:(\d+) (?:H264|VP8|VP9|AV1)\//gm)].map(m=>m[1]));
      answer.sdp=answer.sdp.replace(/^a=fmtp:(\d+) (.+)$/gm,(line,payload)=>videoPayloads.has(payload)
        ? `${line};x-google-start-bitrate=${Math.round(profile.bitrate/2000)}` : line);
      await current.setLocalDescription(answer);
      await iceReady(current);
      if(id!==generation)return;
      await invoke('agent_webrtc_set_answer',{sessionId:session,answer:{type:current.localDescription.type,sdp:current.localDescription.sdp}});
      show('Conectando vídeo ao Studio…');
      statsTimer=setInterval(async()=>{
        if(peer!==current)return;
        try {
          const stats=await current.getStats();
          stats.forEach(report=>{
            if(report.type==='outbound-rtp' && report.kind==='video'){
              show(`WebRTC · ${report.frameWidth || track.getSettings().width} × ${report.frameHeight || track.getSettings().height} · ${Math.round(report.framesPerSecond || 0)} FPS enviados${report.qualityLimitationReason && report.qualityLimitationReason!=='none'?' · limite: '+report.qualityLimitationReason:''}`);
            }
          });
        }catch{}
      },1000);
    }
    async function poll() {
      if(busy || disposed)return;busy=true;
      try {
        const signal=await invoke('agent_webrtc_poll_offer');
        if(!signal?.session_id){if(peer)disconnect();return;}
        if(session===signal.session_id)return;
        if(!stream?.active){
          session=signal.session_id;
          await invoke('agent_webrtc_set_answer',{sessionId:session,answer:{type:'error',message:native?'No Agent, configure a senha de acesso não assistido e ative o vídeo nativo.':'No Agent, clique em Ativar vídeo e selecione a tela principal.'}});
          return;
        }
        await answer(signal);
      }catch(error){
        show(String(error.message || error));
        if(session)await invoke('agent_webrtc_set_answer',{sessionId:session,answer:{type:'error',message:String(error.message || error)}}).catch(()=>{});
        const old=peer;peer=null;old?.close();release();clearInterval(statsTimer);
      }finally{busy=false;}
    }
    button?.addEventListener('click',()=>{
      if(stream)stop();else enable().catch(error=>show(String(error.message || error)));
    });
    timer=setInterval(poll,500);
    const dispose=()=>{disposed=true;clearInterval(timer);clearInterval(pointerTimer);stop();};
    window.addEventListener('beforeunload',dispose,{once:true});
    return {enable,stop,poll,dispose};
  };
})();

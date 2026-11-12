/* Raw pixels stay on this PC via local Tauri binary IPC. WebRTC encodes video. */
window.createNativeScreen = function(invoke) {
  let stream=null,writer=null,running=false,version=0,timer=null,lastFrame=0n;
  function pause(){running=false;version++;clearTimeout(timer);timer=null;}
  async function resume(){
    if(running)return;running=true;const id=++version;
    async function frame(){
      if(!running || id!==version)return;
      const started=performance.now();
      try {
        const response=await invoke('agent_native_frame');
        if(!running || id!==version)return;
        const bytes=response instanceof ArrayBuffer?response:new Uint8Array(response).buffer;
        if(bytes.byteLength>=16){
          const view=new DataView(bytes),width=view.getUint32(0,true),height=view.getUint32(4,true);
          if(width<1 || height<1 || width>1920 || height>1080 || bytes.byteLength!==16+width*height*3/2)throw Error('Quadro nativo inválido');
          const sequence=view.getBigUint64(8,true);
          if(sequence===lastFrame){timer=setTimeout(frame,4);return;}
          lastFrame=sequence;
          if(writer){
            const videoFrame=new VideoFrame(new Uint8Array(bytes,16),{format:'NV12',codedWidth:width,codedHeight:height,timestamp:Math.round(performance.now()*1000)});
            try{await writer.write(videoFrame);}finally{videoFrame.close();}
          }
        }
        timer=setTimeout(frame,Math.max(0,1000/60-(performance.now()-started)));
      }catch(error){
        pause();stream?.getTracks().forEach(t=>t.stop());
        const output=document.getElementById('agentVideoStatus');if(output)output.textContent=String(error.message || error);
      }
    }
    void frame();
  }
  return {
    async acquire(){
      const status=await invoke('agent_unattended_status');
      if(!status?.enabled)throw Error('Configure uma senha e ative o acesso não assistido no Agent.');
      if(stream?.active)return stream;
      lastFrame=0n;
      if(!window.MediaStreamTrackGenerator || !window.VideoFrame)throw Error('Atualize o Microsoft Edge WebView2: captura nativa requer VideoFrame e MediaStreamTrackGenerator.');
      const track=new MediaStreamTrackGenerator({kind:'video'});writer=track.writable.getWriter();stream=new MediaStream([track]);
      stream.getVideoTracks()[0].addEventListener('ended',pause,{once:true});
      return stream;
    },resume,pause,
    stop(){pause();stream?.getTracks().forEach(t=>t.stop());writer?.abort().catch(()=>{});writer=null;stream=null;},
  };
};

export function startRemoteVideoStats(peer, video, onUpdate, {interval=1000}={}) {
  let previous=null, busy=false, stopped=false;
  const tick=async()=>{
    if(busy || stopped)return;busy=true;
    try {
      const reports=await peer.getStats();
      let inbound=null, rtt=null;
      reports.forEach(r=>{
        if(r.type==='inbound-rtp' && (r.kind==='video' || r.mediaType==='video'))inbound=r;
        if(r.type==='candidate-pair' && r.state==='succeeded' && r.nominated)rtt=r.currentRoundTripTime;
      });
      if(!inbound || stopped)return;
      const elapsed=previous?(inbound.timestamp-previous.timestamp)/1000:0;
      const fps=elapsed>0?Math.max(0,(inbound.framesDecoded-previous.framesDecoded)/elapsed):Number(inbound.framesPerSecond||0);
      const mbps=elapsed>0?Math.max(0,(inbound.bytesReceived-previous.bytesReceived)*8/elapsed/1e6):0;
      previous={timestamp:inbound.timestamp,framesDecoded:inbound.framesDecoded,bytesReceived:inbound.bytesReceived};
      onUpdate({width:inbound.frameWidth||video.videoWidth,height:inbound.frameHeight||video.videoHeight,
        fps:Math.round(fps*10)/10,mbps:Math.round(mbps*10)/10,rttMs:rtt==null?null:Math.round(rtt*1000),
        framesDropped:inbound.framesDropped||0});
    }catch{}finally{busy=false;}
  };
  const timer=setInterval(tick,interval);void tick();
  return ()=>{stopped=true;clearInterval(timer);};
}

/* Presentation only: targets and operations still belong to the block executor. */
(() => {
  if (globalThis.FlowDetectCursor) return;
  let host, pointer, caption, timer, x = innerWidth/2, y = innerHeight/2, generation = 0, suspended = false;
  let restored = false, scanFrame = 0, scan = null, lastSaved = 0, actionSet = false;
  const bound = (value, min, max) => Math.max(min, Math.min(Math.max(min, max), value));
  function paint() {
    if (pointer) { pointer.style.transform = `translate(${x}px,${y}px)`; pointer.classList.toggle('near-right',x>innerWidth-170); }
    if (host) { host.dataset.x = String(x); host.dataset.y = String(y); }
  }
  function savePosition(force = false) {
    if (!restored || (!force && performance.now()-lastSaved<250)) return;
    lastSaved = performance.now();
    try { Promise.resolve(chrome.runtime.sendMessage?.({type:'flowdetect-cursor-position',position:{x,y}})).catch(()=>{}); } catch (_) {}
  }
  // State belongs to the active run and tab in the extension, never to page storage.
  const ready = Promise.resolve().then(()=>chrome.runtime.sendMessage?.({type:'flowdetect-cursor-position'})).catch(()=>null).then(result=>{
    const position = result?.position;
    if (!actionSet && Number.isFinite(position?.x) && Number.isFinite(position?.y)) {
      x = bound(position.x,24,innerWidth-24); y = bound(position.y,40,innerHeight-32);
    }
    restored = true; paint();
    if (host) host.style.visibility = suspended ? 'hidden' : 'visible';
    if (scan) { scan.x=x; scan.y=y; scan.start=performance.now(); }
  });
  function endScan() { cancelAnimationFrame(scanFrame); scanFrame=0; scan=null; }
  function scanTick(now) {
    if (!scan || !host?.isConnected) return;
    if (!suspended && restored && !reduced()) {
      const elapsed=(now-scan.start)/1000;
      const phase=elapsed*Math.PI/3;
      const entry=Math.min(1,elapsed/.5);
      x=bound(scan.x+Math.sin(phase)*Math.min(150,innerWidth*.12)*entry,24,innerWidth-24);
      y=bound(scan.y+(1-Math.cos(phase))*Math.min(70,innerHeight*.08)*entry,40,innerHeight-32);
      paint(); savePosition();
    }
    scanFrame=requestAnimationFrame(scanTick);
  }
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function mount() {
    if (host?.isConnected) return;
    host = document.createElement('div');
    host.setAttribute('data-flowdetect-overlay', 'cursor');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'all:initial;position:fixed;inset:0;pointer-events:none!important;z-index:2147483647;border:0;padding:0;margin:0;background:transparent;overflow:visible;width:100%;height:100%;';
    const shadow = host.attachShadow({mode:'closed'});
    shadow.innerHTML = `<style>
      :host{pointer-events:none!important}*{box-sizing:border-box;pointer-events:none!important}
      .pointer{position:absolute;left:0;top:0;filter:drop-shadow(0 2px 4px #04191480);will-change:transform}
      b{position:absolute;left:12px;bottom:34px;padding:5px 10px;border-radius:7px;background:#86e6ce;color:#082d2a;font:600 12px/1.2 "Segoe UI",sans-serif;white-space:nowrap}
      small{position:absolute;left:14px;top:32px;padding:4px 8px;border-radius:6px;background:#092b31;color:#d9fff5;font:11px/1.4 "Segoe UI",sans-serif;white-space:nowrap;transition:opacity .25s}.idle small{opacity:.55}
      .near-right b,.near-right small{left:auto;right:4px}
      svg{display:block}.pulse{position:absolute;left:-12px;top:-12px;width:28px;height:28px;border:2px solid #8ef0d5;border-radius:50%;opacity:0}
      .click .pulse{animation:ripple .3s ease-out}@keyframes ripple{from{transform:scale(.4);opacity:1}to{transform:scale(1.8);opacity:0}}
      .loupe{display:none;position:absolute;left:26px;top:4px;color:#8ef0d5}.searching .loupe{display:block;animation:inspect 1.4s ease-in-out infinite}.searching small{opacity:1}
      @keyframes inspect{0%,100%{transform:translate(0,0) rotate(-8deg)}50%{transform:translate(3px,-2px) rotate(8deg)}}
      @media(prefers-reduced-motion:reduce){.click .pulse,.searching .loupe{animation:none}}
    </style><div class="pointer"><b>FlowDetect</b><svg width="25" height="30" viewBox="0 0 25 30"><path d="M3 2 L21 18 L12 19 L9 27 Z" fill="#8ef0d5" stroke="#073b35" stroke-width="2"/></svg><svg class="loupe" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></svg><small></small><i class="pulse"></i></div>`;
    pointer = shadow.querySelector('.pointer'); caption = shadow.querySelector('small');
    paint();
    host.style.visibility = suspended || !restored ? 'hidden' : 'visible';
    const dialogs = document.querySelectorAll('dialog:modal');
    (dialogs[dialogs.length-1] || document.documentElement).append(host);
    if (host.showPopover) {
      host.setAttribute('popover','manual');
      try { host.showPopover(); } catch (_) { host.removeAttribute('popover'); }
    }
  }
  function rest() {
    clearTimeout(timer);
    // Remain at the last destination until the next action or the end of the run.
    timer = setTimeout(() => { pointer?.classList.remove('click'); pointer?.classList.add('idle'); }, 650);
  }
  function analyzing(active = true) {
    if (!active && !host?.isConnected) return;
    mount(); clearTimeout(timer);
    pointer.classList.remove('click', 'idle');
    pointer.classList.toggle('searching', active);
    host.dataset.state = active ? 'analyzing' : 'idle';
    caption.textContent = active ? 'Analisando…' : 'Aguardando';
    if (active && !scan) { scan={x,y,start:performance.now()}; scanFrame=requestAnimationFrame(scanTick); }
    if (!active) { endScan(); savePosition(true); }
    if (!active) rest();
  }
  function indicate(element, label = 'Clique', point = null) {
    endScan();
    actionSet = true;
    mount(); clearTimeout(timer);
    const rect = element?.getBoundingClientRect();
    x = Number.isFinite(point?.x) ? point.x : rect ? rect.left + rect.width/2 : x;
    y = Number.isFinite(point?.y) ? point.y : rect ? rect.top + rect.height/2 : y;
    paint(); savePosition(true);
    caption.textContent = label;
    pointer.classList.remove('click', 'idle', 'searching'); host.dataset.state = 'acting';
    void pointer.offsetWidth;
    if (label === 'Clique') pointer.classList.add('click');
    rest();
  }
  async function move(element, label = 'Clique', point = null) {
    const initialGeneration=generation;
    await ready;
    if (initialGeneration!==generation) throw Error('Execução interrompida antes da ação.');
    endScan();
    if (!element?.isConnected) throw Error('O alvo mudou antes da ação.');
    mount(); clearTimeout(timer);
    const token = generation, fromX = x, fromY = y, start = performance.now();
    caption.textContent = label; pointer.classList.remove('click', 'idle', 'searching'); host.dataset.state = 'acting';
    const firstRect = element.getBoundingClientRect();
    const distance = Math.hypot((point?.x ?? firstRect.left + firstRect.width/2)-x, (point?.y ?? firstRect.top + firstRect.height/2)-y);
    const duration = reduced() || distance < 1 ? 0 : Math.min(420, Math.max(180, 160 + distance * .3));
    // A timer also progresses in an unfocused tab; requestAnimationFrame alone can stall.
    for (;;) {
      if (token !== generation) throw Error('Execução interrompida antes da ação.');
      if (!element.isConnected) { stop(); throw Error('O alvo mudou antes da ação.'); }
      const rect = element.getBoundingClientRect();
      const toX = Number.isFinite(point?.x) ? point.x : rect.left + rect.width/2;
      const toY = Number.isFinite(point?.y) ? point.y : rect.top + rect.height/2;
      const progress = duration ? Math.min(1,(performance.now()-start)/duration) : 1;
      // Minimum-jerk interpolation starts and stops gently, without an initial jump.
      const ease = progress**3 * (10 + progress * (-15 + 6*progress));
      x = fromX + (toX-fromX)*ease; y = fromY + (toY-fromY)*ease;
      paint();
      if (progress === 1) break;
      await new Promise(resolve=>setTimeout(resolve,16));
    }
    savePosition(true); rest();
  }
  function stop() { generation++; endScan(); clearTimeout(timer); host?.remove(); host = null; suspended = false; }
  globalThis.FlowDetectCursor = {move, indicate, stop, analyzing};
  addEventListener('pagehide', () => { savePosition(true); stop(); });
  chrome.runtime.onMessage.addListener((message, _sender, reply) => {
    if (message?.type === 'flowdetect-cursor-analysis') { analyzing(message.active !== false); reply({ok:true}); }
    if (message?.type === 'flowdetect-cursor-suspend' || message?.type === 'flowdetect-cursor-resume') {
      suspended = message.type === 'flowdetect-cursor-suspend';
      const visible = Boolean(host?.isConnected);
      if (host) host.style.visibility = suspended ? 'hidden' : 'visible';
      if (!suspended && scan) { scan.x=x; scan.y=y; scan.start=performance.now(); }
      reply({ok:true, visible});
    }
    if (message?.type === 'flowdetect-cursor-stop') {
      const visible = Boolean(host?.isConnected); stop(); reply({ok:true, visible});
    }
  });
})();

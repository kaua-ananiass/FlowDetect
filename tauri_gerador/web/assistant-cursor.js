// Visual pointer for local, allowlisted editor operations. Never accepts model coordinates.
export function createAssistantCursor({isSuspended=()=>false}={}){
 let node=null,x=80,y=100,cancelled=false,held=false,navigationUntil=0;
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,reduced()?0:ms));
 function start(){
  if(node)return;cancelled=false;node=document.createElement('div');node.className='fd-assistant-cursor';node.setAttribute('aria-hidden','true');
  node.innerHTML='<span class="fd-assistant-cursor-name">Assistente</span><svg width="25" height="30" viewBox="0 0 25 30"><path d="M3 2 L21 18 L12 19 L9 27 Z" fill="#8ef0d5" stroke="#073b35" stroke-width="2"/></svg><small></small>';
  document.body.append(node);document.addEventListener('keydown',escape);document.addEventListener('pointerdown',pointerDown,true);window.addEventListener('pointerup',pointerUp,true);window.addEventListener('pointercancel',pointerUp,true);document.addEventListener('wheel',wheel,{capture:true,passive:true});window.addEventListener('blur',pointerUp);
 }
 function pointerDown(event){if(event.isTrusted)held=true;}
 function pointerUp(){held=false;navigationUntil=Date.now()+160;}
 function wheel(event){if(event.isTrusted)navigationUntil=Date.now()+180;}
 function escape(event){if(event.key==='Escape')cancelled=true;}
 function check(){if(cancelled)throw Error('A ação do assistente foi interrompida. Confira o bloco antes de continuar.');}
 const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
 const available=element=>element?.isConnected&&element.getClientRects().length>0&&!element.disabled;
 async function resolveControl(resolve){
  let deadline=Date.now()+2000;
  for(;;){check();if(isSuspended()){deadline=Date.now()+2000;await frame();continue;}const element=resolve();if(available(element))return element;
   if(Date.now()>deadline&&!held&&Date.now()>navigationUntil)throw Error('O controle mudou ou não está disponível. Os blocos salvos foram mantidos.');
   await frame();
  }
 }
 async function act(resolve,label,operation=()=>{}){
  start();check();let element=await resolveControl(resolve);
  if(!held&&Date.now()>navigationUntil)element.scrollIntoView({block:'nearest',inline:'nearest',behavior:'auto'});
  node.querySelector('small').textContent=label+' · Esc para parar';
  let previous=null,stableSince=performance.now(),started=performance.now();
  // Re-resolve the DOM and destination every frame: pan, zoom and map renders
  // must never turn a visual pointer's old position into a click or cancellation.
  for(;;){
   check();element=await resolveControl(resolve);
   const rect=element.getBoundingClientRect(),nx=rect.left+rect.width/2,ny=rect.top+rect.height/2;
   const moving=!previous||Math.hypot(nx-previous.x,ny-previous.y)>1;
   const navigating=held||Date.now()<navigationUntil;
   if(moving||navigating)stableSince=performance.now();
   const ratio=reduced()?1:.35;x+=(nx-x)*ratio;y+=(ny-y)*ratio;
   node.style.transform=`translate(${x}px,${y}px)`;previous={x:nx,y:ny};
   if(!navigating&&performance.now()-stableSince>=(reduced()?0:140)&&performance.now()-started>=(reduced()?0:420)){
    x=nx;y=ny;node.style.transform=`translate(${x}px,${y}px)`;break;
   }
   await frame();
  }
  check();
  node.classList.add('is-clicking');element.classList.add('fd-assistant-target');
  try{return await operation(element);}finally{
   await pause(220);
   // A save may finish during a new drag. Do not replace the DOM underneath
   // pointer capture, and never discard a successful save's result here.
   while(held)await frame();
   element.classList.remove('fd-assistant-target');node?.classList.remove('is-clicking');
  }
 }
 function finish(){node?.remove();node=null;held=false;document.removeEventListener('keydown',escape);document.removeEventListener('pointerdown',pointerDown,true);window.removeEventListener('pointerup',pointerUp,true);window.removeEventListener('pointercancel',pointerUp,true);document.removeEventListener('wheel',wheel,true);window.removeEventListener('blur',pointerUp);}
 return {act,finish};
}

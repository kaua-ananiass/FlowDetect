import knowledge from './block-knowledge.js';

export function createChatGuidance({getEvent,getEvents,openTab,openBlock,isRunning,onReturn,getAnchorBoundary}) {
 let dispose=()=>{};
 return async function navigate(target) {
  if(isRunning())throw Error('Pare a execução antes de abrir a configuração guiada.');
  if(!target||!['commands','workbook','integrations','smart-recorder'].includes(target.tab))throw Error('Destino de orientação inválido.');
  let block=null;
  if(target.order!=null||target.block_id){
   block=target.block_id?getEvents().find(event=>event.id===target.block_id):getEvent(Number(target.order));
   if(!block)throw Error('O bloco indicado não existe mais. Volte ao chat e confira a configuração.');
   if(target.tab!=='commands')throw Error('Abra o mapa para configurar esse bloco.');
  }
  if(target.focus&&(!block||!knowledge.targets[target.focus]||(knowledge.targets[target.focus].types&&!knowledge.targets[target.focus].types.includes(block.type))))throw Error('O campo indicado não pertence a este bloco. Atualize a orientação.');
  dispose();openTab(target.tab);if(block)await openBlock(block.order);if(target.tab==='integrations')return;
  const dock=document.createElement('aside');dock.className='fdchat-guidance-dock';dock.setAttribute('aria-label','Orientação do assistente');
  const ring=document.createElement('div');ring.className='fdchat-guidance-halo';ring.hidden=true;ring.setAttribute('aria-hidden','true');
  const header=document.createElement('header'),title=document.createElement('strong'),close=document.createElement('button');
  title.textContent=target.title||'Vamos configurar esta etapa';close.textContent='×';close.setAttribute('aria-label','Ocultar orientação');header.append(title,close);
  const label=document.createElement('small'),stepTitle=document.createElement('h4'),text=document.createElement('p'),status=document.createElement('output'),goal=document.createElement('small');
  status.setAttribute('role','status');goal.className='fdchat-guidance-goal';goal.textContent=target.reason||'';
  const controls=document.createElement('div');controls.className='fdchat-guidance-controls';
  const previous=document.createElement('button'),next=document.createElement('button');previous.textContent='Anterior';next.textContent='Próximo passo';controls.append(previous,next);
  const back=document.createElement('button');back.className='fdchat-guidance-back';back.textContent='Voltar ao chat e conferir';
  const boundary=getAnchorBoundary?.()||(block?document.getElementById('commandMapList'):null);
  const pointer=document.createElementNS('http://www.w3.org/2000/svg','svg');pointer.classList.add('fdchat-guidance-pointer');pointer.setAttribute('aria-hidden','true');
  const line=document.createElementNS(pointer.namespaceURI,'path'),dot=document.createElementNS(pointer.namespaceURI,'circle');dot.setAttribute('r','3');pointer.append(line,dot);pointer.style.display='none';
  if(boundary)dock.classList.add('is-anchored');
  if(getAnchorBoundary?.())back.textContent='Conferir configuração';
  dock.append(header,label,stepTitle,text,status,goal,controls,back);document.body.append(pointer,ring,dock);
  const currentBlock=()=>block?.id?getEvents().find(event=>event.id===block.id):block;
  const card=()=>{const current=currentBlock();return current?document.querySelector(`.command-tree-card[data-order="${Number(current.order)}"]`):null;};
  const visible=el=>!!el&&el.getClientRects().length>0&&!el.closest('[hidden]')&&getComputedStyle(el).visibility!=='hidden'&&getComputedStyle(el).display!=='none';
  const applicable=key=>{const item=knowledge.targets[key];return item&&(!item.types||item.types.includes(block?.type));};
  let tour=block?(knowledge.blocks[block.type]?.tour||['block.editor']).filter(applicable):[];
  if(block?.type==='clicar_imagem'&&block.details?.modo_reconhecimento==='texto_ocr')tour=['recognition.capture','ocr.text',!['visual','elemento'].includes(block.details?.fonte_ocr)?'recognition.ocr_actions':'recognition.click_mode','recognition.variable','block.save','recognition.test'].filter(applicable);
  if(block?.type==='procurar_texto_ocr')tour=['ocr.source',block.details?.fonte_ocr==='visual'?'ocr.capture':block.details?.fonte_ocr==='elemento'?'ocr.element':'ocr.text','ocr.click_mode','block.save','ocr.test'];
  if(target.focus)tour=[target.focus,...tour.filter(key=>key!==target.focus)];
  let index=0,frame=0,closed=false;
  const findControl=()=>{const item=knowledge.targets[tour[index]],root=card();if(!item||!root)return null;let el=[...root.querySelectorAll(item.selector)].find(visible);return item.group&&el?el.closest('.recognition-choice-row')||el:el;};
  function placeDock(rect){
   if(!boundary)return;
   const bounds=boundary.getBoundingClientRect(),edge=12,gap=18;
   const area={left:Math.max(edge,bounds.left+edge),top:Math.max(edge,bounds.top+edge),right:Math.min(innerWidth-edge,bounds.right-edge),bottom:Math.min(innerHeight-edge,bounds.bottom-edge)};
   if(area.right<=area.left||area.bottom<=area.top){dock.hidden=true;pointer.style.display='none';return;}
   dock.hidden=false;dock.style.width=Math.min(300,area.right-area.left)+'px';dock.style.maxHeight=Math.max(120,area.bottom-area.top)+'px';
   const {width:w,height:h}=dock.getBoundingClientRect(),cx=(rect.left+rect.right)/2,cy=(rect.top+rect.bottom)/2;
   const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
   const x=clamp(cx-w/2,area.left,area.right-w),y=clamp(cy-h/2,area.top,area.bottom-h);
   const candidates=[{side:'right',x:rect.right+gap,y},{side:'left',x:rect.left-w-gap,y},{side:'bottom',x,y:rect.bottom+gap},{side:'top',x,y:rect.top-h-gap}];
   const fits=c=>c.x>=area.left&&c.y>=area.top&&c.x+w<=area.right&&c.y+h<=area.bottom;
   let chosen=candidates.find(fits);
   if(!chosen){
    // When space is tight, use the larger vertical gap and a scrollable bubble.
    const above=rect.top-area.top-gap,below=area.bottom-rect.bottom-gap,top=above>below;
    const room=Math.max(above,below);
    if(room>=100){dock.style.maxHeight=room+'px';const height=dock.getBoundingClientRect().height;chosen={side:top?'top':'bottom',x,y:top?rect.top-height-gap:rect.bottom+gap};}
    else{chosen={side:'bottom',x,y:clamp(rect.bottom+gap,area.top,area.bottom-h)};}
   }
   dock.dataset.side=chosen.side;Object.assign(dock.style,{left:chosen.x+'px',top:chosen.y+'px'});
   const box=dock.getBoundingClientRect();let start,end;
   if(chosen.side==='right'||chosen.side==='left'){
    const py=clamp(cy,box.top+14,box.bottom-14);start={x:chosen.side==='right'?box.left:box.right,y:py};end={x:chosen.side==='right'?rect.right+8:rect.left-8,y:clamp(py,rect.top,rect.bottom)};
   }else{
    const px=clamp(cx,box.left+14,box.right-14);start={x:px,y:chosen.side==='bottom'?box.top:box.bottom};end={x:clamp(px,rect.left,rect.right),y:chosen.side==='bottom'?rect.bottom+8:rect.top-8};
   }
   line.setAttribute('d',`M ${start.x} ${start.y} L ${end.x} ${end.y}`);dot.setAttribute('cx',end.x);dot.setAttribute('cy',end.y);pointer.style.display='block';
  }
  function position(){
   frame=0;if(closed)return;const root=card(),control=findControl();
   if(block&&!root){ring.hidden=true;pointer.style.display='none';dock.hidden=!!boundary;status.textContent='Este bloco não está visível. Volte ao chat e confira a configuração.';return;}
   if(!control){ring.hidden=true;pointer.style.display='none';status.textContent=tour.length?'Este controle não aparece no modo atual do bloco. Confira a configuração ou avance para o próximo campo.':'';if(root&&boundary)placeDock(root.getBoundingClientRect());pointer.style.display='none';return;}
   const rect=control.getBoundingClientRect(),padding=7,left=Math.max(5,rect.left-padding),top=Math.max(5,rect.top-padding),right=Math.min(innerWidth-5,rect.right+padding),bottom=Math.min(innerHeight-5,rect.bottom+padding);
   if(right<=left||bottom<=top){ring.hidden=true;status.textContent='Role o editor para ver o controle indicado.';return;}
   status.textContent='Use o controle destacado. O tutorial não clica nem salva por você.';ring.hidden=false;ring.dataset.target=tour[index];Object.assign(ring.style,{left:left+'px',top:top+'px',width:(right-left)+'px',height:(bottom-top)+'px'});
   if(boundary)placeDock(rect);
   else{const dockRect=dock.getBoundingClientRect();if(rect.right>dockRect.left&&rect.left<dockRect.right&&rect.bottom>dockRect.top&&rect.top<dockRect.bottom)dock.classList.toggle('is-on-left',rect.left>innerWidth/2);}
  }
  const schedule=()=>{if(!frame&&!closed)frame=requestAnimationFrame(position);};
  function showStep(){
   const item=knowledge.targets[tour[index]],root=card();
   // Internal tab navigation only: never fire Capture, Procurar, Save or a field change.
   if(item?.panel&&root){const tab=root.querySelector(`[data-recognition-tab-target="${item.panel}"]`);if(tab&&!tab.classList.contains('is-active'))tab.click();}
   label.textContent=block?`Bloco ${currentBlock()?.order||block.order} · Orientação ${index+1} de ${tour.length}`:'Assistente FlowDetect';stepTitle.textContent=item?.label||'Como configurar';text.textContent=item?.description||target.reason||'Configure esta etapa e volte ao chat para continuar.';
   previous.disabled=index===0;controls.hidden=!tour.length;next.textContent=index===tour.length-1?'Concluir orientação':'Próximo passo';
   const control=findControl();if(control)control.scrollIntoView({block:'nearest',inline:'nearest',behavior:'auto'});schedule();
  }
  previous.onclick=()=>{if(index>0){index--;showStep();}};
  const observer=new MutationObserver(records=>{if(records.some(record=>!dock.contains(record.target)&&record.target!==ring&&!ring.contains(record.target)&&record.target!==pointer&&!pointer.contains(record.target)))schedule();});
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden']});window.addEventListener('scroll',schedule,true);window.addEventListener('resize',schedule);
  next.onclick=()=>{if(index<tour.length-1){index++;showStep();}else{ring.hidden=true;pointer.style.display='none';stepTitle.textContent='Orientação concluída';text.textContent='Revise e salve suas alterações. Procurar só identifica; o clique configurado ocorre na execução da automação.';controls.hidden=true;observer.disconnect();closed=true;if(frame)cancelAnimationFrame(frame);}};
  const escape=event=>{if(event.key==='Escape'&&!event.defaultPrevented)dispose();};document.addEventListener('keydown',escape);
  const dismiss=()=>dispose();window.addEventListener('flow-chat-guide-dismiss',dismiss);
  dispose=()=>{closed=true;observer.disconnect();if(frame)cancelAnimationFrame(frame);window.removeEventListener('scroll',schedule,true);window.removeEventListener('resize',schedule);document.removeEventListener('keydown',escape);window.removeEventListener('flow-chat-guide-dismiss',dismiss);ring.remove();pointer.remove();dock.remove();};
  close.onclick=()=>dispose();back.onclick=()=>{dispose();openTab('integrations');onReturn(target.chat_id);};showStep();
 };
}

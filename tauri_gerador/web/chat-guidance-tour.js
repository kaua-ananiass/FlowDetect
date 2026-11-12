import knowledge from './block-knowledge.js';

export function createChatGuidance({getEvent,getEvents,openTab,openBlock,isRunning,onReturn}) {
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
  dock.append(header,label,stepTitle,text,status,goal,controls,back);document.body.append(ring,dock);
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
  function position(){
   frame=0;if(closed)return;const root=card(),control=findControl();
   if(block&&!root){ring.hidden=true;status.textContent='Este bloco não está visível. Volte ao chat e confira a configuração.';return;}
   if(!control){ring.hidden=true;status.textContent=tour.length?'Este controle não aparece no modo atual do bloco. Confira a configuração ou avance para o próximo campo.':'';return;}
   const rect=control.getBoundingClientRect(),padding=7,left=Math.max(5,rect.left-padding),top=Math.max(5,rect.top-padding),right=Math.min(innerWidth-5,rect.right+padding),bottom=Math.min(innerHeight-5,rect.bottom+padding);
   if(right<=left||bottom<=top){ring.hidden=true;status.textContent='Role o editor para ver o controle indicado.';return;}
   status.textContent='Use o controle destacado. O tutorial não clica nem salva por você.';ring.hidden=false;ring.dataset.target=tour[index];Object.assign(ring.style,{left:left+'px',top:top+'px',width:(right-left)+'px',height:(bottom-top)+'px'});
   const dockRect=dock.getBoundingClientRect();if(rect.right>dockRect.left&&rect.left<dockRect.right&&rect.bottom>dockRect.top&&rect.top<dockRect.bottom)dock.classList.toggle('is-on-left',rect.left>innerWidth/2);
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
  const observer=new MutationObserver(records=>{if(records.some(record=>!dock.contains(record.target)&&record.target!==ring&&!ring.contains(record.target)))schedule();});
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden']});window.addEventListener('scroll',schedule,true);window.addEventListener('resize',schedule);
  next.onclick=()=>{if(index<tour.length-1){index++;showStep();}else{ring.hidden=true;stepTitle.textContent='Orientação concluída';text.textContent='Revise e salve suas alterações. Procurar só identifica; o clique configurado ocorre na execução da automação.';controls.hidden=true;observer.disconnect();closed=true;if(frame)cancelAnimationFrame(frame);}};
  const escape=event=>{if(event.key==='Escape'&&!event.defaultPrevented)dispose();};document.addEventListener('keydown',escape);
  dispose=()=>{closed=true;observer.disconnect();if(frame)cancelAnimationFrame(frame);window.removeEventListener('scroll',schedule,true);window.removeEventListener('resize',schedule);document.removeEventListener('keydown',escape);ring.remove();dock.remove();};
  close.onclick=()=>dispose();back.onclick=()=>{dispose();openTab('integrations');onReturn(target.chat_id);};showStep();
 };
}

// Move the live map, never clone its DOM or create a second editor/state.
export function createChatMapWorkspace({panel,getTab,onLayout,onSelection,getSelection}) {
 let host=null,anchor=null,observer=null,frame=0,last='';
 const visible=()=>!!host&&getTab()==='integrations';
 const selection=()=>{
  frame=0;if(!visible())return;
  const card=panel.querySelector('.command-tree-card.is-inline-expanded')||panel.querySelector('.command-flow-segment.is-focused .command-tree-card');
  const next=getSelection?.()||{order:Number(card?.dataset.order)||null,type:card?.dataset.type||null};
  const key=JSON.stringify(next);if(key!==last){last=key;onSelection(next);}
 };
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(selection);};
 panel.addEventListener('flow-editor-selection-change',schedule);
 function sync(){
  if(!anchor)return;
  if(visible()){if(panel.parentNode!==host)host.append(panel);panel.classList.add('is-active');}
  else{anchor.parentNode?.insertBefore(panel,anchor);panel.classList.toggle('is-active',getTab()==='commands');}
  panel.classList.toggle('is-chat-map',visible());onLayout();schedule();
 }
 function unmount(){
  observer?.disconnect();observer=null;if(frame)cancelAnimationFrame(frame);frame=0;
  host=null;sync();anchor?.remove();anchor=null;last='';
 }
 return {
  isVisible:visible,sync,
  mount(element){
   if(host)throw Error('O mapa já está aberto em outra conversa.');
   anchor=document.createComment('FlowDetect: posição original do mapa');panel.before(anchor);host=element;
   observer=new MutationObserver(schedule);observer.observe(panel,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-order']});
   sync();return unmount;
  },
 };
}

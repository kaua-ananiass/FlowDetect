// Resolve against current events each time: order numbers can change on insert.
export function createChatEditorContext({panel,getEvents,getExpandedOrder,getFocusedOrder,isSplit}) {
 let lastId=null,lastKey=null;
 const fromCard=card=>{
  if(!card)return null;
  return getEvents().find(event=>Number(event.order)===Number(card.dataset.order))||null;
 };
 const remember=event=>{if(event){lastId=event.id||null;lastKey=event.clientKey||null;}};
 const interact=event=>{
  const card=event.target.closest?.('.command-tree-card');if(!card||!panel.contains(card))return;
  remember(fromCard(card));
  panel.dispatchEvent(new CustomEvent('flow-editor-selection-change'));
 };
 panel.addEventListener('pointerdown',interact,true);
 panel.addEventListener('focusin',interact,true);
 return {
  created:remember,
  read(){
   const events=getEvents();
   const activeCard=document.activeElement?.closest?.('.command-tree-card');
   const focused=activeCard&&panel.contains(activeCard)?fromCard(activeCard):null;
   const last=events.find(event=>lastId?event.id===lastId:lastKey&&event.clientKey===lastKey);
   const expanded=events.find(event=>Number(event.order)===Number(getExpandedOrder()));
   const selected=events.find(event=>Number(event.order)===Number(getFocusedOrder()));
   const event=focused||last||expanded||selected||events.at(-1);
   return {block_id:event?.id||null,order:event?.order||null,type:event?.type||null,
    title:event?.title||event?.details?.chatgpt_title||event?.text||null,
    selection_source:focused?'focused-field':last?'last-interaction':expanded?'expanded-editor':selected?'selected-block':'last-created',
    workspace:isSplit()?'map-and-chat':'studio'};
  },
 };
}

import type {Guide,GuideStep} from './guided-flow';

// Complete the requested editor work, using each saved revision and stable identity.
// Missing captured images are allowed: a requested empty recognition is still created.
export async function runAssistantBatch(plan:Guide,apply:(plan:Guide,step:GuideStep)=>Promise<Guide>,active:()=>boolean){
 if(plan.questions.length)return plan;
 if(plan.steps.some(step=>step.kind==='manual'||step.editor_action))throw Error('Este pedido precisa de uma ação sua. Esclareça todas as etapas antes de começar.');
 const seen=new Set<string>();
 for(const step of plan.steps){
  if(step.placement?.anchor_step&&!seen.has(step.placement.anchor_step))throw Error('Confira a ordem das etapas antes de começar. Nenhum bloco foi criado.');
  seen.add(step.id);
 }
 let current=plan;
 for(let index=0;index<plan.steps.length;index++){
  if(!active())throw Error('A criação parou porque você mudou de conversa. Os blocos já criados foram mantidos.');
  let step=current.steps[index];
  if(step.placement?.anchor_step){
   const anchor=current.steps.find(item=>item.id===step.placement!.anchor_step);
   if(!anchor?.block_id||!anchor.source_order)throw Error('A etapa anterior não foi salva. A criação parou.');
   step={...step,placement:{anchor_id:anchor.block_id,anchor_order:anchor.source_order,position:step.placement.position}};
  }else if(step.placement?.anchor_id){
   const anchor=current.steps.find(item=>item.block_id===step.placement!.anchor_id);
   if(anchor?.source_order)step={...step,placement:{...step.placement,anchor_order:anchor.source_order}};
  }
  current=await apply(current,step);
 }
 return current;
}

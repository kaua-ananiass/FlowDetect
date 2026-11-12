import {ArrowRight,Check,Image,Layers3,MousePointer2,RefreshCw,Table2,Type,ExternalLink,Keyboard} from 'lucide-react';
export type GuideStep={id:string;kind:'reuse'|'text'|'navigate'|'keys'|'ocr'|'table'|'manual';title:string;description:string;instruction:string;source_order?:number;block_id?:string;configured?:boolean;missing?:string[];text?:string;url?:string;keys?:string[];tab?:string;focus?:string;placement?:{anchor_order?:number;anchor_step?:string;anchor_id?:string;position:'before'|'after'};configuration?:Record<string,unknown>;editor_action?:'capture'|'test'|'map_table'};
export type Guide={name:string;message:string;revision:string;questions:string[];steps:GuideStep[];navigation?:{tab:string;order?:number;block_id?:string;reason:string;focus?:string}};
export type GuideNavigation={tab:string;order?:number;block_id?:string;reason:string;title?:string;focus?:string};
const labels={reuse:'Bloco do mapa',text:'Digitar texto',navigate:'Abrir página',keys:'Teclas',ocr:'Reconhecimento visual / OCR',table:'Tabela do Chrome',manual:'Preparação'};
const icons={reuse:Layers3,text:Type,navigate:ExternalLink,keys:Keyboard,ocr:Image,table:Table2,manual:MousePointer2};
export function GuidedFlow({plan,busy,onChange,onCreate,onSave,onOpen,onRefresh,onAsk}:{plan:Guide;busy:boolean;onChange:(plan:Guide)=>void;onCreate:(step:GuideStep)=>void;onSave:(step:GuideStep)=>void;onOpen:(step:GuideStep)=>void;onRefresh:()=>void;onAsk:(text:string)=>void}){
 const edit=(id:string,patch:Partial<GuideStep>)=>onChange({...plan,steps:plan.steps.map(step=>step.id===id?{...step,...patch}:step)});
 return <section className="fdchat-guide" aria-label="Criação guiada">
  <header><div><p className="fdchat-eyebrow">VAMOS CONSTRUIR JUNTOS</p><h3>{plan.name}</h3><p>Crie uma etapa, configure no editor real e volte para conferir.</p></div><button disabled={busy} onClick={onRefresh}><RefreshCw size={14}/>Conferir configuração</button></header>
  {!!plan.questions.length&&<div className="fdchat-guide-questions"><strong>Antes de continuar</strong>{plan.questions.map((q,i)=><button key={i} disabled={busy} onClick={()=>onAsk(q+'\nMinha resposta: ')}>{q}<ArrowRight size={14}/></button>)}<small>Responda no campo de mensagem abaixo.</small></div>}
  <ol>{plan.steps.map((step,index)=>{const Icon=icons[step.kind];const exists=!!step.source_order;return <li key={step.id} data-guide-step={step.id}>
   <div className="fdchat-guide-line"><span>{String(index+1).padStart(2,'0')}</span><i/></div>
   <article className="fdchat-guide-card"><div className="fdchat-guide-card-top"><Icon size={17}/><span>{labels[step.kind]}</span><small data-configured={step.configured}>{exists?step.configured?'Campos configurados':'Precisa configurar':'Ainda não criado'}</small></div>
    <label className="fdchat-guide-title">Nome da etapa<input aria-label={`Nome da etapa ${index+1}`} value={step.title} maxLength={120} disabled={busy||(exists&&!['text','navigate','keys'].includes(step.kind))} onChange={e=>edit(step.id,{title:e.target.value})}/></label>
    {step.description&&<p>{step.description}</p>}
    {step.kind==='text'&&<label>Texto para digitar<textarea aria-label={`Texto da etapa ${index+1}`} value={step.text||''} disabled={busy} onChange={e=>edit(step.id,{text:e.target.value})}/></label>}
    {step.kind==='navigate'&&<label>Endereço da página<input aria-label={`Endereço da etapa ${index+1}`} value={step.url||''} disabled={busy} onChange={e=>edit(step.id,{url:e.target.value})}/></label>}
    {step.kind==='keys'&&<label>Teclas (separadas por +)<input aria-label={`Teclas da etapa ${index+1}`} value={(step.keys||[]).join('+')} disabled={busy} onChange={e=>edit(step.id,{keys:e.target.value.split('+').map(s=>s.trim().toLowerCase())})}/></label>}
    <div className="fdchat-guide-instruction"><MousePointer2 size={14}/><p>{step.instruction}</p></div>
    {!!step.missing?.length&&<small className="fdchat-guide-missing">Falta: {step.missing.join(' · ')}</small>}
    <footer>{exists&&['text','navigate','keys'].includes(step.kind)&&<button disabled={busy} onClick={()=>onSave(step)}>Salvar alteração no bloco</button>}{exists?<button disabled={busy} onClick={()=>onOpen(step)}>Configurar bloco {step.source_order} no Studio <ArrowRight size={14}/></button>:step.kind==='manual'?<button disabled={busy} onClick={()=>onOpen(step)}>Mostrar onde fazer <ArrowRight size={14}/></button>:<button disabled={busy||!step.title.trim()} onClick={()=>onCreate(step)}>Criar bloco no Studio <ArrowRight size={14}/></button>}{exists&&step.configured&&<span><Check size={13}/>Revise e teste no editor</span>}</footer>
   </article></li>;})}</ol>
  {!!plan.steps.length&&<footer className="fdchat-guide-footer">Os blocos são salvos em uma seção separada. Campos preenchidos não significam que o fluxo foi testado. A execução é iniciada por você.</footer>}
 </section>;
}

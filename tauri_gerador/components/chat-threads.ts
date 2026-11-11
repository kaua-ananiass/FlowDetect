import {useEffect,useRef,useState} from 'react';
import type {Guide} from './guided-flow';
export type Automation={id:string;name:string};
export type History={role:'user'|'assistant';content:string};
export type Proposal={draft:{name:string;summary:string;questions?:string[];[key:string]:unknown};preview:{number:number;title:string;type:string;description:string;source_order?:number}[];can_apply:boolean};
export type Message={id:string;role:'user'|'assistant';text:string;status:'pending'|'complete'|'error';error?:string;proposal?:Proposal};
export type Thread={id:string;title:string;renamed:boolean;createdAt:number;updatedAt:number;automation:Automation|null;messages:Message[];prompt:string;mode:'chat'|'generate'|'guide';history:History[];proposal:Proposal|null;applied:Proposal|null;guide:Guide|null};
type State={activeId:string;threads:Thread[]};
type Bridge={invoke:(command:string,payload:unknown)=>Promise<any>;getAutomation?:()=>Automation|null};
export function emptyThread(automation:Automation|null=null):Thread{const now=Date.now();return{id:crypto.randomUUID(),title:'Nova conversa',renamed:false,createdAt:now,updatedAt:now,automation,messages:[],prompt:'',mode:'chat',history:[],proposal:null,applied:null,guide:null};}
function restore(raw:any):State{
 if(!raw||!Array.isArray(raw.threads)||raw.threads.length>100)throw Error('Formato do histórico não reconhecido. O arquivo salvo foi preservado.');
 const threads:Thread[]=raw.threads.map((t:any)=>{
  if(typeof t.id!=='string'||typeof t.title!=='string'||!Array.isArray(t.messages)||!Array.isArray(t.history))throw Error('Uma conversa não pôde ser lida. O histórico salvo foi preservado.');
  const thread:Thread={...emptyThread(),...t,messages:t.messages.map((m:Message)=>m.status==='pending'?{...m,status:'error',error:'Essa resposta foi interrompida ao fechar o Studio. Envie novamente para continuar.'}:m)};
  if(t.messages.some((m:Message)=>m.status==='pending')&&!thread.prompt)thread.prompt=[...t.messages].reverse().find((m:Message)=>m.role==='user')?.text||'';
  return thread;
 });
 if(!threads.length)threads.push(emptyThread());return {threads,activeId:threads.some(t=>t.id===raw.activeId)?raw.activeId:threads[0].id};
}
export function useChatThreads(bridge:Bridge){
 const [state,setState]=useState<State>(()=>{const t=emptyThread(bridge.getAutomation?.()||null);return{activeId:t.id,threads:[t]};});
 const [ready,setReady]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const revision=useRef(0),allowed=useRef(false),inFlight=useRef(false),queued=useRef<State|null>(null),stateRef=useRef(state);stateRef.current=state;
 async function flush(){
  if(!allowed.current||inFlight.current||!queued.current)return;
  inFlight.current=true;setSaving(true);
  try{while(queued.current){const next=queued.current;queued.current=null;const result=await bridge.invoke('chatgpt_action',{request:{action:'history_save',data:{version:1,revision:revision.current,...next}}});if(typeof result?.revision!=='number')throw Error('O Studio não confirmou o salvamento do histórico.');revision.current=result.revision;}setError('');}
  catch(e){setError(e instanceof Error?e.message:String(e));}
  finally{inFlight.current=false;setSaving(false);}
 }
 useEffect(()=>{let live=true;(async()=>{try{const data=await bridge.invoke('chatgpt_action',{request:{action:'history_load'}});if(!live)return;const next=restore(data);revision.current=Number(data.revision)||0;allowed.current=true;setState(next);}catch(e){if(live)setError((e instanceof Error?e.message:String(e))+' Novas alterações não substituirão o arquivo salvo.');}finally{if(live)setReady(true);}})();return()=>{live=false;};},[]);
 useEffect(()=>{if(!ready||!allowed.current)return;queued.current=state;setSaving(true);const timer=setTimeout(()=>void flush(),400);return()=>clearTimeout(timer);},[state,ready]);
 useEffect(()=>{const hide=()=>{if(document.visibilityState==='hidden')void flush();};document.addEventListener('visibilitychange',hide);return()=>document.removeEventListener('visibilitychange',hide);},[]);
 function update(id:string,patch:Partial<Thread>|((thread:Thread)=>Partial<Thread>)){
  setState(previous=>({...previous,threads:previous.threads.map(t=>t.id===id?{...t,...(typeof patch==='function'?patch(t):patch),updatedAt:Date.now()}:t)}));
 }
 function create(){if(stateRef.current.threads.length>=100){setError('Você chegou a 100 conversas. Exclua uma que não precisa mais para criar outra.');return;}const t=emptyThread(bridge.getAutomation?.()||null);setState(previous=>({activeId:t.id,threads:[t,...previous.threads]}));return t;}
 function select(id:string){setState(previous=>previous.threads.some(t=>t.id===id)?{...previous,activeId:id}:previous);}
 function remove(id:string){const removed=stateRef.current.threads.find(t=>t.id===id);if(!removed)return;setState(previous=>{const threads=previous.threads.filter(t=>t.id!==id);if(!threads.length)threads.push(emptyThread(bridge.getAutomation?.()||null));return {threads,activeId:previous.activeId===id?threads[0].id:previous.activeId};});return removed;}
 function undo(thread:Thread){setState(previous=>previous.threads.some(t=>t.id===thread.id)?previous:{activeId:thread.id,threads:[thread,...previous.threads]});}
 return{...state,active:state.threads.find(t=>t.id===state.activeId)!,ready,saving,error,update,create,select,remove,undo,flush};
}

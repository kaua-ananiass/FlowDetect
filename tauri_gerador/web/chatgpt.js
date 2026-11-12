import {mountFlowChat} from './chatgpt-react.js';
export function initChatGPT(bridge) {
 const element=document.getElementById('chatgptWorkspace');if(!element)return;
 return mountFlowChat(element,{...bridge,listenDelta:async handler=>{
  const listen=window.__TAURI__?.event?.listen;if(typeof listen!=='function')return()=>{};
  return listen('chatgpt-text-delta',event=>handler(event.payload));
 }});
}

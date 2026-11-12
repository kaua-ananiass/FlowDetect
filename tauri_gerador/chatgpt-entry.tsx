import {createRoot, type Root} from 'react-dom/client';
import {FlowChat, type ChatBridge} from './components/flow-chat';
const roots=new WeakMap<HTMLElement,Root>();
export function mountFlowChat(element:HTMLElement,bridge:ChatBridge) {
  let root=roots.get(element);
  if(!root){root=createRoot(element);roots.set(element,root);}
  const render=()=>root!.render(<FlowChat bridge={bridge}/>);
  render();return {refresh:render};
}

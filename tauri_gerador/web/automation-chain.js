const STORAGE = 'flowdetect.automationChains.v1';
const labels = { idle:'Aguardando', preparing:'Conferindo processos', running:'Executando', completed:'Concluído', failed:'Falhou', stopped:'Interrompido', needs_attention:'Precisa de conferência', interrupted:'Agente reiniciado' };
const el = (tag, text, className) => { const node=document.createElement(tag); if(text !== undefined)node.textContent=text; if(className)node.className=className; return node; };
const fresh = agentId => ({ id:crypto.randomUUID(), name:'Novo encadeamento', agentId, variables:'{}', stages:[] });

export function parseChainVariables(text) {
  const values=JSON.parse(text || '{}');
  if (!values || Array.isArray(values) || typeof values!=='object') throw new Error('As variáveis devem ser um objeto JSON.');
  if(Object.keys(values).length>50 || Object.entries(values).some(([key,value])=> !/^[\w.]{1,64}$/.test(key) || typeof value!=='string' || value.length>4096)) throw new Error('Use até 50 variáveis de texto, com nomes simples e valores de até 4096 caracteres.');
  return values;
}

export function initAutomationChain({listAgents, invoke, openAgent, storage=localStorage}) {
  const $=id=>document.getElementById(id);
  if(!$('chainPanel'))return {refresh(){}};
  let saved=[], draft=fresh(''), library=[], pages=[], busy=false, active=false, connectedAgent='', polling=false;
  const opened=new Set();
  const feedback=(text,error=false)=>{ $('chainFeedback').textContent=String(text||''); $('chainFeedback').dataset.error=String(error); };
  try { const data=JSON.parse(storage.getItem(STORAGE)||'{}'); saved=Array.isArray(data.items)?data.items:[]; draft=saved.find(item=>item.id===data.selected)||draft; } catch(_){ feedback('Não foi possível restaurar os encadeamentos salvos.',true); }
  const agents=()=>listAgents();
  const agent=()=>agents().find(item=>String(item.id)===String(draft.agentId));
  const call=async(action,values={})=> {
    const target=agent(); if(!target?.address)throw new Error('Selecione um agente cadastrado e pareado no Studio.');
    return invoke('remote_agent_chain',{address:target.address,request:{action,...values}});
  };
  const changed=()=>{ $('chainReviewed').checked=false; };
  function persist() {
    const item=structuredClone(draft), index=saved.findIndex(item=>item.id===draft.id);
    if(index>=0)saved[index]=item;else saved.push(item);
    storage.setItem(STORAGE,JSON.stringify({selected:draft.id,items:saved}));
    renderSaved();
  }
  function controls() {
    const locked=busy||active;
    for(const id of ['chainAgent','chainConnect','chainLibrary','chainEngine','chainAdd','chainPair','chainPairCode','chainName','chainVariables','chainReviewed','chainSave','chainNew']) $(id).disabled=locked;
    $('chainStart').disabled=locked||!draft.stages.length||connectedAgent!==draft.agentId;
    $('chainStop').disabled=!active;
    $('chainWatch').disabled=busy||!agent()?.address;
    $('chainRefresh').disabled=busy;
    for(const node of $('chainTree').querySelectorAll('input,select,button'))node.disabled=locked;
    for(const node of $('chainSaved').querySelectorAll('button'))node.disabled=locked;
  }
  async function work(action) {
    if(busy)return;
    busy=true;controls();
    try { await action(); } catch(error) {feedback(error?.message||error,true);} finally {busy=false;controls();}
  }
  function renderAgents() {
    $('chainAgent').replaceChildren(new Option('Selecione um agente',''),...agents().map(item=>new Option(item.name,String(item.id))));
    $('chainAgent').value=draft.agentId;
  }
  function renderSaved() {
    $('chainSaved').replaceChildren();
    if(!saved.length)$('chainSaved').append(el('p','Salve um encadeamento para reutilizá-lo.','chain-note'));
    for(const item of saved) {
      const row=el('div',undefined,'chain-saved-row'), load=el('button',item.name,'ghost-button'), remove=el('button','×','ghost-button');
      remove.setAttribute('aria-label',`Remover pedido salvo ${item.name}`);
      load.onclick=()=>{if(active||busy)return;draft=structuredClone(item);connectedAgent='';library=[];pages=[];changed();render();};
      remove.onclick=()=>{if(active||busy)return;try{saved=saved.filter(value=>value.id!==item.id);storage.setItem(STORAGE,JSON.stringify({selected:draft.id,items:saved}));renderSaved();}catch(error){feedback(error.message,true);}};
      row.append(load,remove);$('chainSaved').append(row);
    }
  }
  function field(label,node) { const wrapper=el('label',label);wrapper.append(node);return wrapper; }
  function renderTree() {
    $('chainTree').replaceChildren();
    if(!draft.stages.length)$('chainTree').append(el('li','Adicione o primeiro processo. Os seguintes serão executados em ordem.','chain-note'));
    draft.stages.forEach((stage,index)=>{
      const card=el('li',undefined,'chain-stage'), header=el('header'), number=el('span',String(index+1).padStart(2,'0'),'chain-stage-number');
      const title=el('div',undefined,'chain-stage-title');title.append(el('strong',stage.name),el('small',`${stage.engine==='chrome'?'Chrome':'Desktop'} · ${stage.events.length} blocos · versão ${stage.fingerprint.slice(0,8)}`));
      const tools=el('div',undefined,'chain-stage-tools');
      for(const [text,description,handler] of [ ['↑','Mover para cima',()=>{if(index>0)[draft.stages[index-1],draft.stages[index]]=[stage,draft.stages[index-1]];}], ['↓','Mover para baixo',()=>{if(index<draft.stages.length-1)[draft.stages[index+1],draft.stages[index]]=[stage,draft.stages[index+1]];}], ['×','Remover processo',()=>draft.stages.splice(index,1)] ]) {
        const button=el('button',text);button.type='button';button.setAttribute('aria-label',description);button.onclick=()=>{if(active||busy)return;handler();changed();renderTree();controls();};tools.append(button);
      }
      header.append(number,title,tools);card.append(header);
      const details=el('details');details.open=opened.has(stage.uid);details.ontoggle=()=>{if(details.open)opened.add(stage.uid);else opened.delete(stage.uid);};
      details.append(el('summary','Blocos vinculados e ponto de entrada'));
      const settings=el('div',undefined,'chain-stage-settings'), entry=el('select');entry.setAttribute('aria-label',`Entrada do processo ${index+1}`);
      entry.append(new Option('Começo da automação','0'),...stage.events.map(event=>new Option(`#${event.order} · ${event.title || event.name || event.type || 'Bloco'}`,String(event.order))));
      entry.value=String(stage.entryOrder||0);entry.onchange=()=>{stage.entryOrder=Number(entry.value);changed();renderTree();controls();};
      const timeout=el('input');timeout.type='number';timeout.min='30';timeout.max='86400';timeout.value=String(stage.timeoutSeconds||1800);timeout.onchange=()=>{stage.timeoutSeconds=Math.max(30,Math.min(86400,Number(timeout.value)||1800));changed();};
      settings.append(field('Iniciar em',entry),field('Limite em segundos',timeout));
      if(stage.engine==='chrome') {
        const page=el('select');page.append(new Option('Selecione a página Chrome',''),...pages.map(item=>new Option(`${item.name} · ${item.tabTitle||'Sem aba'}`,item.id)));
        if(stage.pageId&&!pages.some(item=>item.id===stage.pageId))page.append(new Option('Página salva · atualize o agente',stage.pageId));
        page.value=stage.pageId||'';page.onchange=()=>{stage.pageId=page.value;changed();};
        const url=el('input');url.type='url';url.value=stage.expectedUrl||'';url.placeholder='https://portal.exemplo.com/pagina';url.onchange=()=>{stage.expectedUrl=url.value.trim();changed();};
        settings.append(field('Página no Chrome do agente',page));const urlField=field('URL esperada · opcional (domínio e caminho)',url);urlField.classList.add('chain-stage-url');settings.append(urlField);
      }
      const blocks=el('ol',undefined,'chain-blocks');
      for(const event of stage.events) {
        const block=el('li',`#${event.order} · ${event.title||event.name||event.type||'Bloco'}`);
        if(Number(event.order)===stage.entryOrder)block.classList.add('is-entry');
        const description=event.text || event.details?.nome || event.details?.texto || '';
        block.append(el('small',`${event.sequence||'principal'} · ${event.type}${description?' · '+String(description).slice(0,250):''}`));blocks.append(block);
        const routes=event.details||{};
        for(const [key,title] of [['sucesso','Sucesso'],['falha','Falha'],['nao_encontrar','Não encontrado']]) {
          const action=routes['ao_'+key];
          if(action && action!=='continuar')block.append(el('small',`${title}: ${action}${routes['bloco_'+key]?' · bloco '+routes['bloco_'+key]:''}${routes['sequencia_'+key]?' · '+routes['sequencia_'+key]:''}`));
        }
      }
      details.append(settings,blocks);card.append(details);$('chainTree').append(card);
    });
  }
  function render() {
    renderAgents();$('chainName').value=draft.name;$('chainVariables').value=draft.variables||'{}';
    $('chainLibrary').replaceChildren(new Option('Selecione uma automação',''),...library.map(item=>new Option(item.nome||item.name||item.id,String(item.id))));
    renderTree();renderSaved();controls();
  }
  async function refreshStatus() {
    if(!agent()||polling)return;
    const selectedAgent=draft.agentId;
    polling=true;
    try {
      const reply=await call('status'), chain=reply.chain||{};
      if(selectedAgent!==draft.agentId)return;
      active=Boolean(reply.active);
      $('chainConnection').textContent=reply.chrome?.connected?'Chrome do agente conectado e pareado.':'Chrome do agente não conectado. Abra a extensão naquele PC e informe o código aqui.';
      $('chainRunStatus').textContent=labels[chain.status]||'Aguardando';
      $('chainRunMessage').textContent=chain.error||chain.releaseError||chain.message||'Nenhum encadeamento ativo.';
      $('chainRelease').hidden=!['needs_attention','interrupted'].includes(chain.status);
      $('chainRunStages').replaceChildren(...(chain.stages||[]).map((stage,index)=>{
        const status=stage.status==='completed'?'completed':index===chain.current?chain.status:'idle';
        return el('li',`${index+1}. ${stage.name||stage.id} · ${labels[status]||'Aguardando'}`,index===chain.current?'chain-run-current':'');
      }));
      controls();return reply;
    } finally {polling=false;}
  }
  async function connect() {
    if(!agent()?.address)throw new Error('Selecione um agente cadastrado e pareado no Studio.');
    await refreshStatus();
    const result=await invoke('remote_agent_list_automations',{address:agent().address});
    library=Array.isArray(result)?result:(result.items||result.automations||result.library||[]);
    if(!Array.isArray(library))throw new Error('A biblioteca do agente retornou um formato inválido.');
    connectedAgent=draft.agentId;
    try { const result=await call('pages'); pages=result.pages||[]; }catch(_){pages=[];}
    render();feedback('Biblioteca carregada. Adicione os processos na ordem desejada.');
  }
  $('chainAgent').onchange=()=>{
    if(active||busy)return;
    const chosen=$('chainAgent').value;
    try{if(draft.stages.length)persist();}catch(error){feedback(error.message,true);}
    draft=fresh(chosen);connectedAgent='';pages=[];library=[];changed();render();
  };
  $('chainConnect').onclick=()=>work(connect);
  $('chainRefresh').onclick=()=>work(async()=>{renderAgents();await refreshStatus();if(connectedAgent===draft.agentId){const result=await call('pages');pages=result.pages||[];renderTree();}});
  $('chainPair').onclick=()=>work(async()=>{const code=$('chainPairCode').value.trim();if(!/^\d{6}$/.test(code))throw new Error('Informe os seis números mostrados na extensão do agente.');await call('pair',{code});$('chainPairCode').value='';feedback('Pareamento solicitado. Aguarde alguns segundos e atualize o agente.');});
  $('chainAdd').onclick=()=>work(async()=>{
    if(connectedAgent!==draft.agentId)throw new Error('Carregue a biblioteca do agente primeiro.');
    const id=$('chainLibrary').value;if(!id)throw new Error('Selecione uma automação.');
    const preview=await call('preview',{id});
    if(!preview.fingerprint||!Array.isArray(preview.events)||!preview.events.length)throw new Error('A automação está vazia ou o agente precisa ser atualizado.');
    const stage={uid:crypto.randomUUID(),id,name:preview.active_automation?.nome||library.find(item=>String(item.id)===id)?.nome||id,engine:$('chainEngine').value,events:preview.events,fingerprint:preview.fingerprint,entryOrder:0,pageId:'',expectedUrl:'',timeoutSeconds:1800};
    draft.stages.push(stage);opened.add(stage.uid);changed();renderTree();feedback('Processo vinculado. Expanda para revisar os blocos.');
  });
  $('chainName').onchange=()=>{draft.name=$('chainName').value.trim()||'Novo encadeamento';changed();};
  $('chainNew').onclick=()=>{if(active||busy)return;try{if(draft.stages.length)persist();draft=fresh(draft.agentId);changed();render();}catch(error){feedback(error.message,true);}};
  $('chainVariables').oninput=()=>{draft.variables=$('chainVariables').value;changed();};
  $('chainSave').onclick=()=>{try{parseChainVariables(draft.variables);persist();feedback('Encadeamento salvo neste Studio.');}catch(error){feedback(error.message,true);}};
  $('chainStart').onclick=()=>work(async()=>{
    if(active)throw new Error('O agente já está reservado.');
    if(!$('chainReviewed').checked)throw new Error('Revise e confirme os processos antes de executar.');
    const variables=parseChainVariables(draft.variables);
    if(!draft.stages.length)throw new Error('Adicione pelo menos um processo.');
    if(draft.stages.some(stage=>stage.engine==='chrome'&&!stage.pageId))throw new Error('Selecione a página Chrome de todos os processos web.');
    persist();
    const stages=draft.stages.map(({events,uid,...stage})=>stage);
    await call('start',{name:draft.name,stages,variables});
    active=true;changed();feedback('Encadeamento iniciado no agente. O agente confirma cada processo antes de continuar.');await refreshStatus();
  });
  $('chainStop').onclick=()=>work(async()=>{await call('stop');feedback('Parada solicitada. Aguarde a confirmação do agente.');await refreshStatus();});
  $('chainRelease').onclick=()=>work(async()=>{await call('release');await refreshStatus();feedback('Reserva liberada após conferência. Nenhum processo foi reiniciado.');});
  $('chainWatch').onclick=()=>work(()=>openAgent(agent()));
  const timer=setInterval(()=>{if($('chainPanel').classList.contains('is-active')&&!busy)refreshStatus().catch(error=>feedback(`Sem confirmação do agente: ${error.message||error}. A execução não será repetida automaticamente.`,true));},3000);
  render();
  return { refresh(){renderAgents();controls();if(agent())refreshStatus().catch(error=>feedback(error.message||error,true));}, destroy(){clearInterval(timer);} };
}

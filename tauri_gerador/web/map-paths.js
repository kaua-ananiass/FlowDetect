export function initMapPaths({invoke,chooseFile,getRoadmap,getLibrary,getPage,beforeChange,apply}) {
  const $=id=>document.getElementById(id),dialog=$('mapPathsDialog');
  if(!dialog)return;
  let busy=false,sourceSequence='';
  const message=(text,error=false)=>{ $('mapPathFeedback').textContent=String(text||'');$('mapPathFeedback').dataset.error=String(error); };
  function syncExecutionFields(){
    const chrome=$('mapPathEngine').value==='chrome';
    $('mapPathChromePageField').hidden=!chrome;
    $('mapPathEngineHelp').textContent=chrome
      ? 'Executa na aba vinculada à extensão, no computador que roda a automação.'
      : 'Usa mouse e teclado nos programas do computador que roda a automação, como editores e sistemas internos.';
  }
  $('mapPathEngine').addEventListener('change',syncExecutionFields);
  syncExecutionFields();
  function refresh(){
    const roadmap=getRoadmap()||{},events=roadmap.events||[],paths=roadmap.map_paths||[];
    $('mapPathLibrary').replaceChildren(new Option('Selecione a automação',''),...getLibrary().map(item=>new Option(item.nome||item.name,item.id)));
    $('mapPathSource').replaceChildren(...events.filter(event=>!sourceSequence||event.sequence===sourceSequence).map(event=>new Option(`#${event.order} · ${event.title} · ${paths.find(path=>path.sequences.includes(event.sequence))?.name||event.sequence}`,event.order)));
    const sequences=[...new Set(events.map(event=>event.sequence))];
    $('mapPathTarget').replaceChildren(...sequences.map(sequence=>new Option('Início · '+(paths.find(path=>path.sequences.includes(sequence))?.name||sequence),sequence)),...events.map(event=>new Option(`#${event.order} · ${event.title} · ${paths.find(path=>path.sequences.includes(event.sequence))?.name||event.sequence}`,`block:${event.order}`)));
  }
  async function action(request){
    if(busy)return;
    busy=true;for(const button of dialog.querySelectorAll('button'))button.disabled=true;
    try{
      await beforeChange();
      const result=await invoke('map_paths_action',{request:{parent:getPage(),name:$('mapPathName').value.trim(),engine:$('mapPathEngine').value,pageId:$('mapPathChromePage').value,...request}});
      if(request.action==='delete'){
        dialog.close();
        const stage=$('commandMapList'),orders=new Set();
        const elements=[...stage.querySelectorAll('[data-tree-node-sequence]')].filter(node=>node.dataset.treeNodeSequence===request.sequence);
        elements.forEach(node=>orders.add(node.dataset.treeNodeOrder));
        elements.push(...[...stage.querySelectorAll('[data-map-section]')].filter(node=>node.dataset.mapSection===request.sequence));
        elements.push(...[...stage.querySelectorAll('[data-tree-edge-source-order]')].filter(node=>orders.has(node.dataset.treeEdgeSourceOrder)||orders.has(node.dataset.treeEdgeTargetOrder)));
        if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
          await Promise.all(elements.map(node=>node.animate([{opacity:1},{opacity:0,translate:'0 8px'}],{duration:180,easing:'cubic-bezier(.23,1,.32,1)',fill:'forwards'}).finished.catch(()=>{})));
        }
      }
      apply(result,request.action);refresh();message('Seções atualizadas.');dialog.close();
    }catch(error){message(error?.message||error,true);}finally{busy=false;for(const button of dialog.querySelectorAll('button'))button.disabled=false;}
  }
  function open(mode,sequence=''){
    if(busy)return;
    sourceSequence=mode==='connect'?sequence:'';
    refresh();syncExecutionFields();message('');
    $('mapSectionCreatePanel').hidden=mode!=='create';
    $('mapSectionConnectPanel').hidden=mode!=='connect';
    $('mapSectionDeletePanel').hidden=mode!=='delete';
    $('mapPathsTitle').textContent=mode==='delete'?'Apagar seção':mode==='connect'?'Conectar seções':'Nova seção';
    const count=(getRoadmap()?.events||[]).filter(event=>event.sequence===sequence).length;
    $('mapPathsIntro').textContent=mode==='delete'?`Os ${count} blocos desta seção serão removidos. As ligações que chegam nela serão encerradas. As outras seções serão mantidas.`:mode==='connect'?'Escolha um bloco desta seção e o destino da ligação.':'Adicione um caminho abaixo do atual e conecte os blocos para usá-lo.';
    if(mode==='delete')sourceSequence=sequence;
    if(mode!=='connect')$('mapPathName').value='';
    dialog.showModal();
  }
  document.getElementById('commandMapList')?.addEventListener('click',event=>{
    const button=event.target.closest('[data-map-section-action]');
    if(!button)return;
    event.preventDefault();event.stopPropagation();
    open(button.dataset.mapSectionAction,button.dataset.mapSectionSequence||'');
  });
  $('mapPathsClose').onclick=()=>dialog.close();
  $('mapPathDeleteCancel').onclick=()=>dialog.close();
  $('mapPathDelete').onclick=()=>action({action:'delete',sequence:sourceSequence});
  $('mapPathCreate').onclick=()=>action({action:'create'});
  $('mapPathImport').onclick=()=>{const id=$('mapPathLibrary').value;if(!id){message('Escolha uma automação da biblioteca.',true);return;}action({action:'import',id});};
  $('mapPathFile').onclick=async()=>{try{const file=await chooseFile();if(file)await action({action:'importFile',file});}catch(error){message(error?.message||error,true);}};
  $('mapPathConnect').onclick=()=>{const target=$('mapPathTarget').value;action({action:'connect',source:Number($('mapPathSource').value),route:$('mapPathRoute').value,sequence:target.startsWith('block:')?'':target,targetBlock:target.startsWith('block:')?Number(target.slice(6)):0});};
}

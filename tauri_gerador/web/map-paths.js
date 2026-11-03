export function initMapPaths({invoke,chooseFile,getRoadmap,getLibrary,getPage,beforeChange,apply}) {
  const $=id=>document.getElementById(id),dialog=$('mapPathsDialog');
  if(!dialog)return;
  let busy=false,sourceSequence='';
  const message=(text,error=false)=>{ $('mapPathFeedback').textContent=String(text||'');$('mapPathFeedback').dataset.error=String(error); };
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
      apply(result,request.action);refresh();message('Seções atualizadas.');dialog.close();
    }catch(error){message(error?.message||error,true);}finally{busy=false;for(const button of dialog.querySelectorAll('button'))button.disabled=false;}
  }
  function open(mode,sequence=''){
    if(busy)return;
    sourceSequence=mode==='connect'?sequence:'';
    refresh();message('');
    $('mapSectionCreatePanel').hidden=mode==='connect';
    $('mapSectionConnectPanel').hidden=mode!=='connect';
    $('mapPathsTitle').textContent=mode==='connect'?'Conectar seções':'Nova seção';
    $('mapPathsIntro').textContent=mode==='connect'?'Escolha um bloco desta seção e o destino da ligação.':'A nova seção aparece abaixo das existentes. Crie do zero ou importe uma automação.';
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
  $('mapPathCreate').onclick=()=>action({action:'create'});
  $('mapPathImport').onclick=()=>{const id=$('mapPathLibrary').value;if(!id){message('Escolha uma automação da biblioteca.',true);return;}action({action:'import',id});};
  $('mapPathFile').onclick=async()=>{try{const file=await chooseFile();if(file)await action({action:'importFile',file});}catch(error){message(error?.message||error,true);}};
  $('mapPathConnect').onclick=()=>{const target=$('mapPathTarget').value;action({action:'connect',source:Number($('mapPathSource').value),route:$('mapPathRoute').value,sequence:target.startsWith('block:')?'':target,targetBlock:target.startsWith('block:')?Number(target.slice(6)):0});};
}

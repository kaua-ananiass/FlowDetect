/* Read rendered tables only. No Angular internals, network interception or OCR. */
(() => {
  if(globalThis.FlowDetectTables?.version==='13')return;
  globalThis.__flowDetectTablePickerStop?.();
  const previousListener=globalThis.__flowDetectTableListener;
  if(previousListener)chrome.runtime.onMessage.removeListener(previousListener);
  let capturedDetail=null;
  async function cursorClick(button){
    await globalThis.FlowDetectCursor?.move(button,'Clique');
    if(!button.isConnected||!visible(button)||button.disabled)throw Error('O botão mudou antes do clique.');
    globalThis.FlowDetectCursor?.indicate(button,'Clique');
    button.click();
  }
  const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
  const text=e=>String(e?.innerText??e?.textContent??'').replace(/\s+/g,' ').trim();
  const visible=e=>{
    if(!e||!e.getClientRects().length||e.closest('[hidden],[inert],[aria-hidden="true"],dialog:not([open]),[role="tabpanel"][aria-expanded="false"]'))return false;
    for(let node=e;node;node=node.parentElement){const s=getComputedStyle(node);if(s.display==='none'||s.visibility==='hidden'||s.visibility==='collapse'||s.contentVisibility==='hidden'||Number(s.opacity)===0)return false;}
    const panel=e.closest('[role="tabpanel"]');
    if(panel?.id){const tabs=[...document.querySelectorAll('[role="tab"][aria-controls]')].filter(t=>t.getAttribute('aria-controls')===panel.id);if(tabs.length&&tabs.every(t=>t.getAttribute('aria-selected')==='false'))return false;}
    return true;
  };
  const dialogOf=e=>e.closest('modal-container,ngb-modal-window,dialog,[role="dialog"],[aria-modal="true"]')||e.closest('.br-modal,.modal-content');
  // ngx-bootstrap can leave a transparent .modal.fade host attached while its
  // closing timer is pending. Opacity zero does not release its focus trap.
  const dialogAttached=e=>!!e?.isConnected&&!e.closest('[hidden],[aria-hidden="true"]')&&getComputedStyle(e).display!=='none';
  const blockingModalHosts=()=>[...document.querySelectorAll('modal-container,ngb-modal-window,[role="dialog"][aria-modal="true"]')].filter(dialogAttached);
  const blockingMasks=()=>[...document.querySelectorAll('.br-scrim-util,br-scrim,.modal-backdrop,ngb-modal-backdrop,.cdk-overlay-backdrop,.p-dialog-mask')].filter(e=>{
    if(!visible(e)||getComputedStyle(e).pointerEvents==='none')return false;
    const r=e.getBoundingClientRect();return r.width>=innerWidth*.8&&r.height>=innerHeight*.8;
  });
  function activeTables(candidates){
    const modalCandidates=candidates.filter(e=>dialogOf(e));
    if(!modalCandidates.length)return candidates;
    const dialogs=[...new Set(modalCandidates.map(dialogOf))];
    // Use actual foreground hit-testing, not DOM order or a guessed table index.
    const foreground=dialogs.filter(dialog=>{const r=dialog.getBoundingClientRect(),x=Math.max(0,Math.min(innerWidth-1,r.left+r.width/2)),y=Math.max(0,Math.min(innerHeight-1,r.top+Math.min(r.height/2,100)));const top=document.elementFromPoint(x,y);return top&&dialog.contains(top);});
    if(foreground.length===1)return modalCandidates.filter(e=>dialogOf(e)===foreground[0]);
    return candidates;
  }
  const roots=()=>[...document.querySelectorAll('ngx-datatable,table,[role="table"],[role="grid"]')].filter(e=>visible(e)&&!e.parentElement?.closest('ngx-datatable,table,[role="table"],[role="grid"]'));
  // ngx-datatable wraps its rows in a second element with role=table.
  // That accessibility wrapper belongs to the same table, not a nested dataset.
  const owner=node=>node.closest('ngx-datatable,table')||node.closest('[role="table"],[role="grid"]');
  const scope=e=>e.closest('br-table')||e;
  function headers(e){
    const cells=e.matches('ngx-datatable')?e.querySelectorAll('datatable-header-cell'):e.querySelectorAll('thead th,[role="columnheader"]');
    const names=[...cells].map((c,i)=>text(c)||c.getAttribute('aria-label')||`Coluna ${i+1}`);
    if(!names.length)throw Error('A tabela precisa de cabeçalhos para mapear as colunas.');
    if(names.length>100 || new Set(names.map(norm)).size!==names.length)throw Error('Cabeçalhos repetidos ou tabela acima de 100 colunas. Ajuste o alvo.');
    return names;
  }
  function rowNodes(e){
    const nodes=e.matches('ngx-datatable')?[...e.querySelectorAll('datatable-body-row')].filter(r=>!r.closest('datatable-summary-row')):[...e.querySelectorAll('tbody tr,[role="row"]')].filter(r=>!r.querySelector('th,[role="columnheader"]'));
    return nodes.filter(r=>visible(r)&&owner(r)===e);
  }
  const rowCells=r=>[...r.querySelectorAll('datatable-body-cell,td,[role="cell"],[role="gridcell"]')].filter(c=>c.closest('datatable-body-row,tr,[role="row"]')===r);
  const buttons=cell=>[...cell.querySelectorAll('button,a[href],[role="button"]')].filter(b=>visible(b)&&!b.parentElement.closest('button,a[href],[role="button"]'));
  function buttonSignature(b){return {tag:b.tagName.toLowerCase(),aria:b.getAttribute('aria-label')||'',title:b.getAttribute('title')||'',text:text(b),icons:[...b.querySelectorAll('i,svg,[data-icon]')].map(i=>i.getAttribute('data-icon')||[...i.classList].filter(c=>/^(fa-|bi-|icon-)/.test(c)).sort().join(' ')).filter(Boolean).join('|')};}
  // Studio persists objects with sorted keys. Compare fields, never JSON key order.
  const sameButton=(actual,saved)=>!!saved&&['tag','aria','title','text','icons'].every(key=>actual[key]===(saved[key]??''));
  function rowActions(row,columns){return rowCells(row).flatMap((cell,index)=>buttons(cell).map((b,ordinal)=>({column:columns[index],ordinal,signature:buttonSignature(b),label:b.getAttribute('aria-label')||b.getAttribute('title')||text(b)||(/eye|visibility/.test(JSON.stringify(buttonSignature(b)))?'Ver detalhes':/ellipsis|more/.test(JSON.stringify(buttonSignature(b)))?'Mais opções':`Botão ${ordinal+1}`)})));}
  function rows(e,names){
    return rowNodes(e).map(r=>{
      const cells=rowCells(r);
      if(cells.length!==names.length)throw Error('A quantidade de células mudou. Mapeie novamente a tabela.');
      return cells.map(text);
    });
  }
  function pagination(e){
    const s=scope(e),label=text(s.querySelector('.indices,.page-count,[data-pagination-count]'));
    const m=label.match(/(\d+)\s*[-–]\s*(\d+)\s+de\s+(\d+)/i);
    const next=s.querySelector('button[aria-label="Página seguinte"],button[aria-label="Próxima página"],button[aria-label="Next page"],button#btn-next-page');
    const previous=s.querySelector('button[aria-label="Página anterior"],button[aria-label="Previous page"],button#btn-last-page');
    return {label,total:m?+m[3]:null,start:m?+m[1]:null,end:m?+m[2]:null,next,previous,hasPrevious:!!previous&&!previous.disabled&&previous.getAttribute('aria-disabled')!=='true',hasNext:!!next&&!next.disabled&&next.getAttribute('aria-disabled')!=='true'};
  }
  function describe(e){
    const columns=headers(e),p=pagination(e),data=rows(e,columns);
    if(!data.length&&p.total>0)throw Error('A tabela informa linhas, mas elas ainda não estão disponíveis para leitura. Aguarde o carregamento e atualize a prévia.');
    return {descriptor:{headers:columns,origin:location.origin,pathname:location.pathname},columns,rows:data.slice(0,20),actions:rowNodes(e).slice(0,20).map(r=>rowActions(r,columns)),pagination:{label:p.label,total:p.total,hasNext:p.hasNext}};
  }
  function locate(d){
    if(!d || d.origin!==location.origin || d.pathname!==location.pathname)throw Error('Abra a página onde esta tabela foi mapeada.');
    const available=roots(),expected=JSON.stringify(d.headers.map(norm));
    const found=activeTables(available.filter(e=>{try{return JSON.stringify(headers(e).map(norm))===expected;}catch{return false;}}));
    if(found.length!==1){
      // Diagnostics contain schema only, never employee rows or monetary values.
      const schemas=available.slice(0,6).map(e=>{try{return headers(e).join(' | ');}catch{return 'Cabeçalhos indisponíveis';}});
      throw Error((found.length?`Há ${found.length} tabelas ativas com os mesmos cabeçalhos.`:'Tabela mapeada não encontrada.')+` Esperadas ${d.headers.length} colunas: ${d.headers.join(' | ')}. Tabelas visíveis (${available.length}): ${schemas.join(' / ')||'nenhuma'}.`);
    }
    return found[0];
  }
  async function changePage(d,direction){
    const e=locate(d),p=pagination(e),button=direction==='previous'?p.previous:p.next;
    if(!button||button.disabled||button.getAttribute('aria-disabled')==='true')throw Error('Não foi possível navegar na paginação da tabela.');
    await cursorClick(button);await waitPageChange(d,p,direction);
  }
  async function waitPageChange(d,before,direction='next'){
    let stable=null,lastError='A tabela não confirmou a troca de página.';
    for(let i=0;i<80;i++){
      await new Promise(r=>setTimeout(r,100));
      try{
        const e=locate(d),p=pagination(e),part=rows(e,headers(e));
        if(e.querySelector('[aria-busy="true"]'))throw Error('A tabela ainda está carregando.');
        const moved=p.label!==before.label&&(direction==='previous'?p.start<before.start:p.start>before.start);
        if(!moved||!part.length||(p.total!==null&&p.end-p.start+1!==part.length)){stable=null;continue;}
        const snapshot=JSON.stringify([p.label,part]);
        if(snapshot===stable)return;
        stable=snapshot;
      }catch(error){stable=null;lastError=error.message;}
    }
    throw Error(`A tabela não confirmou uma página estável após a troca. ${lastError}`);
  }
  async function firstPage(d){
    for(let i=0;i<100;i++){const p=pagination(locate(d));if(p.total===0)return;if(!p.hasPrevious){if(p.start!==null&&p.start!==1)throw Error('Volte à primeira página da tabela.');return;}await changePage(d,'previous');}
    throw Error('Limite de páginas excedido.');
  }
  async function clickRow(config,permit=async()=>false){
    stopMapping();
    const d=config.descriptor,action=config.action;
    if(!action?.signature||!d?.headers?.includes(action.column))throw Error('Mapeie um botão da tabela.');
    const key=config.match_column,value=String(config.match_value??'').trim();
    if(!value||value.includes('{{')||!d.headers.includes(key))throw Error('Informe a coluna identificadora e o valor da linha.');
    // The list remains in the DOM behind the detail. Do not click through it.
    for(let i=0;;i++){
      const open=blockingMasks().length>0||blockingModalHosts().length>0||roots().some(t=>dialogOf(t)&&JSON.stringify(headers(t).map(norm))!==JSON.stringify(d.headers.map(norm)));
      if(!open)break;
      if(!config.wait_ready||i>=79)throw Error('Há um detalhe de guia aberto. Feche-o antes de abrir a próxima guia. Nenhum clique foi realizado.');
      await new Promise(r=>setTimeout(r,100));
    }
    // Snapshot and validate every key before changing the portal through a row action.
    await firstPage(d);
    const snapshot=await read({descriptor:d,columns:[key],mode:'list',all_pages:true});
    if(snapshot.rows.filter(r=>norm(r[key])===norm(value)).length!==1)throw Error('A ação exige uma única linha com esse identificador. Nenhum clique foi realizado.');
    await firstPage(d);
    for(let page=0;page<100;page++){
      const e=locate(d),columns=headers(e),index=columns.indexOf(key);
      const matches=rowNodes(e).filter(r=>norm(text(rowCells(r)[index]))===norm(value));
      if(matches.length>1)throw Error('Identificador duplicado. Nenhum clique foi realizado.');
      if(matches.length===1){
        const cell=rowCells(matches[0])[columns.indexOf(action.column)];
        const matchesButton=buttons(cell).filter(b=>sameButton(buttonSignature(b),action.signature));
        if(matchesButton.length!==1)throw Error('O botão mudou ou é ambíguo. Mapeie novamente. Nenhum clique foi realizado.');
        const b=matchesButton[0];if(b.disabled||b.getAttribute('aria-disabled')==='true')throw Error('O botão desta linha está desabilitado.');
        if(!await permit())throw Error('Execução interrompida. Nenhum clique foi realizado.');
        if(!b.isConnected||!visible(b)||b.disabled||b.getAttribute('aria-disabled')==='true'||norm(text(rowCells(matches[0])[index]))!==norm(value))throw Error('A linha mudou antes do clique.');
        capturedDetail=null;b.scrollIntoView({block:'center',inline:'nearest'});await cursorClick(b);
        return {clicked:true,key,value,action:action.label};
      }
      if(!pagination(e).hasNext)break;
      await changePage(d,'next');
    }
    throw Error('A linha mudou durante a busca. Nenhum clique foi realizado.');
  }
  let cancelPicker=null;
  function stopMapping(){
    cancelPicker?.();
    globalThis.__flowDetectElementPickerStop?.();
  }
  globalThis.__flowDetectTablePickerStop=stopMapping;
  function pick(kind='table'){
    cancelPicker?.();
    return new Promise((resolve,reject)=>{
      const box=document.createElement('div'),hint=document.createElement('div');
      box.style.cssText='position:fixed;z-index:2147483646;pointer-events:none;border:2px solid #22d3ee;background:#22d3ee18;border-radius:8px';
      hint.textContent=kind==='control'?'FlowDetect: selecione o botão para fechar ou voltar. Esc cancela.':'FlowDetect: clique na tabela inteira. Esc cancela.';
      hint.style.cssText='position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#102333;color:white;padding:14px;border-radius:12px;font:14px Segoe UI;pointer-events:none';
      document.documentElement.append(box,hint);
      let current=null;
      const move=event=>{const node=event.target?.closest?.(kind==='control'?'button,a[href],[role="button"]':'ngx-datatable,table,[role="table"],[role="grid"]');current=kind==='control'?node:roots().find(r=>r===node||r.contains(node))||null;if(current){const r=current.getBoundingClientRect();box.style.display='block';Object.assign(box.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});}else box.style.display='none';};
      const suppress=event=>{event.preventDefault();event.stopImmediatePropagation();};
      const finish=(error,result)=>{clearTimeout(timer);document.removeEventListener('pointermove',move,true);window.removeEventListener('click',click,true);window.removeEventListener('keydown',key,true);for(const name of ['pointerdown','pointerup','mousedown','mouseup'])window.removeEventListener(name,suppress,true);box.remove();hint.remove();cancelPicker=null;error?reject(Error(error)):resolve(result);};
      const click=event=>{suppress(event);move(event);if(current){try{finish(null,kind==='control'?{control:{signature:buttonSignature(current),origin:location.origin,pathname:location.pathname},label:current.getAttribute('aria-label')||current.getAttribute('title')||text(current)||'Fechar / voltar'}:describe(current));}catch(error){hint.textContent=error.message;}}};
      const key=event=>{if(event.key==='Escape'){suppress(event);finish('Mapeamento cancelado.');}};
      const timer=setTimeout(()=>finish('Tempo de mapeamento encerrado.'),40000);
      cancelPicker=()=>finish('Mapeamento cancelado.');
      document.addEventListener('pointermove',move,true);window.addEventListener('click',click,true);window.addEventListener('keydown',key,true);
      for(const name of ['pointerdown','pointerup','mousedown','mouseup'])window.addEventListener(name,suppress,true);
    });
  }
  async function waitReady(config){
    globalThis.FlowDetectCursor?.analyzing();
    try{return await waitReadyAnalyzing(config);}
    finally{globalThis.FlowDetectCursor?.analyzing(false);}
  }
  async function waitReadyAnalyzing(config){
    let error;
    for(let i=0;i<(config.wait_ready?75:1);i++){
      try{const e=locate(config.descriptor),p=pagination(e);if(e.querySelector('[aria-busy="true"]'))throw Error('A tabela ainda está carregando.');if(!rowNodes(e).length&&!(config.allow_empty&&p.total===0))throw Error('As linhas da tabela ainda estão carregando.');return e;}catch(e){error=e;}
      if(config.wait_ready)await new Promise(r=>setTimeout(r,200));
    }throw error;
  }
  async function returnToList(config,permit,progress=()=>{},dispatchClose=cursorClick){
    stopMapping();
    progress('Procurando o botão Fechar no detalhe capturado.');
    if(config.return_mode==='back'){
      if(!await permit())throw Error('Execução interrompida.');
      history.back();return {returned:true};
    }
    const d=config.return_control;
    if(!d?.signature||d.origin!==location.origin||d.pathname!==location.pathname)throw Error('Mapeie o botão de fechar ou voltar nesta tela.');
    let found=[],button=null,lastReason='';
    for(let attempt=0;attempt<(config.wait_ready?80:1);attempt++){
      found=[...document.querySelectorAll('button,a[href],[role="button"]')].filter(b=>visible(b)&&sameButton(buttonSignature(b),d.signature));
      const capturedDialog=capturedDetail?.isConnected&&visible(capturedDetail)?dialogOf(capturedDetail):null;
      found=capturedDialog?found.filter(b=>capturedDialog.contains(b)):activeTables(found);
      if(found.length===1&&!found[0].disabled&&found[0].getAttribute('aria-disabled')!=='true'){button=found[0];break;}
      lastReason=found.length===0?'Nenhum botão correspondente está visível no detalhe.':found.length>1?`${found.length} botões correspondentes estão visíveis no detalhe.`:'O botão está desabilitado.';
      if(config.wait_ready)await new Promise(r=>setTimeout(r,100));
    }
    if(!button)throw Error(`Não foi possível fechar o detalhe. ${lastReason}`);
    progress('Botão Fechar localizado; confirmando autorização.');
    if(!await permit())throw Error('Execução interrompida.');
    if(!button.isConnected||!visible(button)||button.disabled||button.getAttribute('aria-disabled')==='true')throw Error('O botão de voltar mudou antes do clique.');
    const closingDialog=dialogOf(button),closingTable=capturedDetail,closingMasks=blockingMasks();
    await dispatchClose(button);
    progress('Clique em Fechar enviado; aguardando a janela desaparecer.');
    // A background list preview is not proof that the detail finished closing.
    if(closingDialog||closingTable||closingMasks.length){
      let closed=false;
      for(let i=0;i<80;i++){
        const dialogGone=!closingDialog||!dialogAttached(closingDialog);
        const tableGone=!closingTable||!closingTable.isConnected||!visible(closingTable);
        const maskGone=!closingMasks.some(mask=>blockingMasks().includes(mask));
        if(dialogGone&&tableGone&&maskGone){closed=true;break;}
        if(!dialogGone&&!visible(closingDialog))progress('A janela ficou transparente; aguardando o portal liberar o contêiner modal e o foco.');
        if(dialogGone&&tableGone&&!maskGone)progress('O detalhe fechou; aguardando o portal remover a camada cinza.');
        await new Promise(r=>setTimeout(r,100));
      }
      if(!closed)throw Error('O portal não terminou o fechamento do detalhe ou da camada cinza. A próxima guia não será aberta.');
    }
    capturedDetail=null;progress('Janela do detalhe fechada.');return {returned:true};
  }
  async function read(config){
    stopMapping();
    if(config.accumulate)capturedDetail=null;
    const d=config.descriptor;let e=await waitReady(config);const columns=headers(e);
    const verifyGuide=table=>{
      if(!config.expected_guide)return;
      const dialog=dialogOf(table);if(!dialog)return;
      const numbers=[...new Set(text(dialog).match(/\b\d{12,20}-\d\b/g)||[])];
      if(numbers.length&&(numbers.length!==1||numbers[0]!==String(config.expected_guide)))throw Error(`O detalhe aberto é da guia ${numbers.join(', ')}, mas a execução aguarda ${config.expected_guide}. Nenhum dado deste detalhe foi salvo.`);
    };
    verifyGuide(e);
    const selected=config.columns||[];
    if(!selected.length||selected.some(c=>!columns.includes(c)))throw Error('Selecione ao menos uma coluna válida.');
    // Detail dialogs can retain the previous guide's pagination state.
    // A complete capture must explicitly reset it before collecting any rows.
    if(config.all_pages){await firstPage(d);e=locate(d);}
    const indexes=selected.map(c=>columns.indexOf(c));let all=[],seen=new Set();let expected=null,previousEnd=null;
    for(let page=0;page<100;page++){
      e=locate(d);verifyGuide(e);const p=pagination(e),part=rows(e,columns);
      if(!part.length){if(config.allow_empty&&p.total===0)break;throw Error('A tabela está vazia ou ainda carregando.');}
      if(expected===null)expected=p.total;
      if(p.total!==expected)throw Error('A quantidade de registros mudou durante a leitura. Tente novamente.');
      if(previousEnd!==null && p.start!==previousEnd+1)throw Error('A paginação pulou registros. Leitura interrompida.');
      const signature=JSON.stringify([p.label,part]);if(seen.has(signature))throw Error('A página se repetiu sem avançar.');seen.add(signature);
      if(expected!==null && p.end-p.start+1!==part.length)throw Error('Nem todas as linhas da página estão no HTML. Tabela virtualizada não pode ser capturada integralmente nesta versão.');
      all.push(...part);if(all.length>10000)throw Error('Limite de 10 mil linhas excedido.');
      if(!p.hasNext){if(expected!==null && (all.length!==expected || p.start!==all.length-part.length+1))throw Error(`Captura incompleta: ${all.length} de ${expected} registros; página ${p.label || 'não informada'}. O portal não disponibilizou todas as linhas ou a próxima página.`);break;}
      if(!config.all_pages)throw Error('Há outras páginas. Ative Ler todas as páginas ou volte a uma tabela completa.');
      if(p.start===null)throw Error('A paginação não informa contagem verificável.');
      previousEnd=p.end;await cursorClick(p.next);await waitPageChange(d,p);
      if(page===99)throw Error('Limite de 100 páginas excedido.');
    }
    if(config.mode==='value'){
      const col=columns.indexOf(config.match_column);if(col<0||!String(config.match_value||'').trim())throw Error('Informe a coluna e o texto para encontrar uma linha.');
      all=all.filter(r=>norm(r[col])===norm(config.match_value));
      if(all.length!==1 || selected.length!==1)throw Error('A captura de valor exige uma única linha e uma única coluna.');
    }
    const records=all.map(r=>Object.fromEntries(selected.map((c,i)=>[c,r[indexes[i]]])));
    if(config.accumulate)capturedDetail=e;
    return {columns:selected,rows:records,row_count:records.length,value:config.mode==='value'?records[0][selected[0]]:JSON.stringify(records)};
  }
  globalThis.FlowDetectTables={version:'13',describe,read,pick,clickRow,returnToList,waitReady,stopMapping};
  const tableMessageListener=(request,_sender,reply)=>{
    if(!['flowdetect-table-pick','flowdetect-table-read','flowdetect-table-preview','flowdetect-table-click','flowdetect-control-pick','flowdetect-table-return'].includes(request?.type))return;
    const permit=async()=>{
      const result=await chrome.runtime.sendMessage({type:'flowdetect-table-permit-click',runId:request.runId,nonce:request.nonce});return result?.allowed===true;
    };
    Promise.resolve().then(()=>request.type==='flowdetect-control-pick'?pick('control'):request.type==='flowdetect-table-pick'?pick():request.type==='flowdetect-table-preview'?describe(locate(request.config.descriptor)):request.type==='flowdetect-table-return'?returnToList(request.config,permit):request.type==='flowdetect-table-click'?waitReady(request.config).then(()=>clickRow(request.config,permit)):read(request.config)).then(data=>reply({ok:true,...data})).catch(error=>reply({ok:false,error:String(error.message||error)}));return true;
  };
  globalThis.__flowDetectTableListener=tableMessageListener;
  chrome.runtime.onMessage.addListener(tableMessageListener);
})();

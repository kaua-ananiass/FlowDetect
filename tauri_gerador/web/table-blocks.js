import { guideView, setGuideView, hydrateGuideConfig, renderTableGuide, schemaPreview } from './table-guide.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const actionKey=a=>JSON.stringify([a.column,a.signature]);
function previewHTML(c){ return schemaPreview(c); }
function readEditor(editor){
  const c=JSON.parse(editor.dataset.config);
  for(const field of editor.querySelectorAll('[data-table-field]'))c[field.dataset.tableField]=field.type==='checkbox'?field.checked:field.value;
  if(editor.querySelector('[data-table-columns]'))c.columns=[...editor.querySelectorAll('[data-table-column]:checked')].map(e=>e.dataset.tableColumn);
  const selected=editor.querySelector('[data-table-action-choice]')?.value;
  if(selected)c.action=JSON.parse(selected);
  for(const field of editor.querySelectorAll('[data-traversal-field]'))(c.traversal_options||={})[field.dataset.traversalField]=field.type==='checkbox'?field.checked:field.value;
  return c;
}
function traversalWizard(c){
  if(c.generated_traversal)return '<div class="table-traversal-created">Percurso criado no mapa. Edite os blocos de abrir, ler detalhe e voltar para ajustar cada etapa.</div>';
  const o=c.traversal_options||{},columns=c.descriptor?.headers||[];
  if(!columns.length)return '';
  const incomplete=!!(o.return_control||o.detail_descriptor)&&(!o.detail_descriptor||(o.return_mode!=='back'&&!o.return_control));
  return `<details class="table-traversal-wizard" ${incomplete?'open':''}><summary>Percorrer linhas desta tabela</summary><p>O Flow descobre as guias ao executar. Você só precisa mapear a estrutura uma vez.</p>
    <div class="table-setup-checklist"><span>${c.action?'✓':'○'} Botão de abrir</span><span>${o.detail_descriptor?'✓':'○'} Tabela do detalhe</span><span>${o.return_control||o.return_mode==='back'?'✓':'○'} Voltar à lista</span><span>○ Criar os blocos no mapa</span></div>
    <div class="table-row-fields"><label class="table-field"><span>1. Coluna que identifica cada guia</span><select data-traversal-field="key_column">${columns.map(h=>`<option ${o.key_column===h?'selected':''}>${esc(h)}</option>`).join('')}</select></label><label class="table-field"><span>Empresa / CNPJ (opcional)</span><input data-traversal-field="company" value="${esc(o.company||'')}" placeholder="Nome, CNPJ ou {{empresa}}"/></label></div>
    <p>Botão para abrir: <strong>${esc(c.action?.label||'Escolha o olho na prévia acima')}</strong></p>
    <div class="table-wizard-mapping"><div><strong>2. Tabela dentro do detalhe</strong><p>Abra uma guia manualmente no Chrome e selecione a tabela que deseja capturar.</p><small>${o.detail_descriptor?o.detail_descriptor.headers.length+' colunas mapeadas':'Ainda não mapeada'}</small></div><button type="button" data-table-action="map-detail">Mapear tabela do detalhe</button></div>
    <div class="table-wizard-mapping"><div><strong>3. Fechar o detalhe</strong><label class="table-field"><span>Como voltar à lista?</span><select data-traversal-field="return_mode"><option value="button">Clicar no botão de fechar / voltar</option><option value="back" ${o.return_mode==='back'?'selected':''}>Voltar do navegador</option></select></label><small>${esc(o.return_label||'Selecione o botão na tela do detalhe')}</small></div><button type="button" data-table-action="map-return">Mapear botão de voltar</button></div>
    <div class="table-row-fields"><label class="table-field"><span>Nome do resultado acumulado</span><input data-traversal-field="collection" value="${esc(o.collection||'detalhes_guias')}" maxlength="48"/></label><label class="table-column-choice"><input type="checkbox" data-traversal-field="xlsx" ${o.xlsx!==false?'checked':''}/><span>Baixar planilha Excel com Guias e Detalhamento</span></label></div>
    <small>Será criado: lista → loop → abrir guia → capturar detalhe → voltar → fim do loop → consolidar. Os números vêm da tabela, não precisam ser cadastrados.</small>
    <button type="button" class="table-primary-button" data-table-action="create-traversal">Criar percurso no mapa</button>
  </details>`;
}
function setupNotice(c){
  if(c.generated_traversal||c.traversal_id||c.mode!=='click'||!String(c.match_value||'').includes('{{'))return '';
  const o=c.traversal_options||{};
  return `<aside class="table-setup-notice" role="note"><strong>Este clique precisa da lista e do loop</strong><p>A variável <code>${esc(c.match_value)}</code> recebe o número da guia durante o loop. ${!o.detail_descriptor?'Falta mapear a tabela interna do detalhe. ':''}Use <b>Criar percurso no mapa</b> para gerar a leitura e a repetição. Salvar configuração guarda somente este bloco.</p><button type="button" data-table-action="complete-setup">Completar percurso</button></aside>`;
}
function replaceEditor(editor,c){
  const holder=document.createElement('div');holder.innerHTML=renderTableEditor({order:Number(editor.dataset.order),details:{table:c}});
  const next=holder.firstElementChild;editor.replaceWith(next);return next;
}
export function renderAdvancedTableEditor(event){
  const c=event.details?.table||{};const columns=c.descriptor?.headers||[];
  const clicking=c.mode==='click',single=c.mode==='value';
  const field=(name,label,value,placeholder='')=>`<label class="table-field"><span>${label}</span><input data-table-field="${name}" value="${esc(value||'')}" placeholder="${esc(placeholder)}" ${name==='variable'?'maxlength="48"':''}/></label>`;
  if(['return','export'].includes(c.mode))return `<section class="table-block-editor" data-table-editor data-order="${event.order}" data-config="${esc(JSON.stringify(c))}"><header class="table-editor-heading"><div><span class="table-eyebrow">PERCURSO DE TABELAS</span><h3>${c.mode==='return'?'Voltar à lista de guias':'Consolidar informações'}</h3><p>${c.mode==='return'?'Fecha o detalhe e aguarda a lista antes de seguir.':'Reúne os detalhes de todas as guias, sem substituir as anteriores.'}</p></div></header>${c.mode==='export'?`${field('variable','Variável com todos os detalhes',c.variable)}<label class="table-column-choice"><input type="checkbox" data-table-field="xlsx" ${c.xlsx?'checked':''}/><span>Baixar planilha Excel com duas abas</span></label><label class="table-column-choice"><input type="checkbox" data-table-field="csv" ${c.csv?'checked':''}/><span>Baixar Guias e Detalhamento em CSV</span></label>`:`<label class="table-field"><span>Como voltar?</span><select data-table-field="return_mode"><option value="button">Botão de fechar / voltar mapeado</option><option value="back" ${c.return_mode==='back'?'selected':''}>Voltar do navegador</option></select></label><button type="button" data-table-action="map-return">Mapear botão de voltar</button><small>${c.return_control?'Botão mapeado':'Selecione um botão ou use Voltar do navegador.'}</small>`}<footer class="table-editor-footer"><output role="status" data-table-status></output><button type="button" class="table-primary-button" data-table-action="save">Salvar configuração</button></footer></section>`;
  return `<section class="table-block-editor" data-table-editor data-order="${event.order}" data-config="${esc(JSON.stringify(c))}">
    <header class="table-editor-heading"><div><span class="table-eyebrow">CHROME · TABELAS</span><h3>Configure sua tabela</h3><p>Leia informações ou escolha um botão de cada linha.</p></div><div class="table-editor-toolbar"><button type="button" data-table-action="map">${columns.length?'Remapear':'Mapear tabela'}</button>${columns.length?'<button type="button" data-table-action="preview">Atualizar prévia</button>':''}</div></header>
    <section class="table-preview-panel"><div class="table-section-heading"><h4>Prévia da tabela</h4><span>${columns.length?columns.length+' colunas':'Não mapeada'}</span></div><div data-table-preview>${previewHTML(c)}</div></section>
    <label class="table-field table-mode-field"><span>O que este bloco deve fazer?</span><select data-table-field="mode"><option value="list">Ler uma lista de linhas</option><option value="value" ${single?'selected':''}>Ler um valor específico</option><option value="click" ${clicking?'selected':''}>Clicar em um botão da linha</option></select></label>
    ${setupNotice(c)}
    <div class="table-config-grid">
      <section class="table-config-panel" ${clicking?'hidden':''}><div class="table-section-heading"><h4>Colunas para capturar</h4><span>${single?'Escolha uma':'Escolha as colunas'}</span></div><div data-table-columns>${columns.length?columns.map(label=>`<label class="table-column-choice"><input type="checkbox" data-table-column="${esc(label)}" ${c.columns?.includes(label)?'checked':''}/><span>${esc(label)}</span></label>`).join(''):'<small>Mapeie a tabela para escolher as colunas.</small>'}</div></section>
      <section class="table-config-panel table-output-panel" ${clicking?'hidden':''}><div class="table-section-heading"><h4>Destino dos dados</h4></div>${field('variable','Nome da variável',c.variable||'tabela','Ex.: guias_fgts')}<small>Use no texto: <code>{{${esc(c.variable||'tabela')}}}</code></small><div class="table-output-options"><label class="table-column-choice"><input type="checkbox" data-table-field="all_pages" ${c.all_pages?'checked':''}/><span>Ler todas as páginas</span></label><label class="table-column-choice"><input type="checkbox" data-table-field="prepare_loop" ${c.prepare_loop?'checked':''}/><span>Usar cada linha em um loop</span></label><label class="table-column-choice"><input type="checkbox" data-table-field="csv" ${c.csv?'checked':''}/><span>Baixar também em CSV</span></label></div></section>
      <section class="table-config-panel table-line-panel" ${!clicking&&!single?'hidden':''}><div class="table-section-heading"><h4>${clicking?'Qual botão clicar?':'Qual linha ler?'}</h4></div><label class="table-field" ${!clicking?'hidden':''}><span>Botão selecionado</span><select data-table-action-choice><option value="">Escolha um botão na prévia</option>${(c.action_choices||[]).map(a=>`<option value="${esc(JSON.stringify(a))}" ${c.action&&actionKey(c.action)===actionKey(a)?'selected':''}>${esc(a.column)} · ${esc(a.label)}</option>`).join('')}</select></label><div class="table-row-fields"><label class="table-field"><span>Coluna que identifica a linha</span><select data-table-field="match_column">${columns.map(label=>`<option ${c.match_column===label?'selected':''}>${esc(label)}</option>`).join('')}</select></label>${field('match_value','Valor ou variável para encontrar',c.match_value,'{{Número da Guia}}')}</div><small>Exemplo: encontre a guia pelo número. O bloco só continua quando há uma única linha correspondente.</small></section>
    </div>
    <details class="table-loop-help"><summary>Como usar com todas as linhas?</summary><p>Leia a lista e inclua a coluna identificadora. Ative “Usar cada linha em um loop”. Depois: Início do loop → bloco de clique → etapas do detalhe → voltar à tabela → Fim do loop.</p><p>No bloco de clique, use <code>{{Número da Guia}}</code> como valor da linha. Cada passagem faz um clique.</p></details>
    ${traversalWizard(c)}
    <footer class="table-editor-footer"><output role="status" data-table-status></output><button type="button" data-table-action="save" class="table-primary-button">Salvar configuração</button></footer>
  </section>`;
}
export function renderTableEditor(event,events=[]){
  const c=hydrateGuideConfig(event,events);
  if(guideView(event.order).advanced)return renderAdvancedTableEditor({...event,details:{...event.details,table:c}}).replace(/(<section[^>]*>)/,'$1<button type="button" class="guide-back-link" data-table-action="show-guide">Voltar ao passo a passo visual</button>');
  return renderTableGuide(event,c);
}
export const useAdvancedEditor=order=>setGuideView(order,{advanced:true});
export function initTableBlocks({invoke,applyRoadmap}){
  const saveGuideDraft=async(editor,c)=>{
    if(!editor.classList.contains('table-guide')||c.generated_traversal||c.traversal_id||!c.descriptor)return;
    c.setup_pending=true;
    const result=await invoke('map_paths_action',{request:{action:'table_save',order:Number(editor.dataset.order),table:c}});applyRoadmap(result);
  };
  document.addEventListener('change',event=>{
    if(!event.target.matches('[data-table-field="mode"], [data-table-action-choice]'))return;
    const editor=event.target.closest('[data-table-editor]');if(!editor)return;
    const c=readEditor(editor);
    if(event.target.matches('[data-table-action-choice]')&&c.action){c.mode='click';c.match_column ||= c.descriptor.headers[0];c.match_value ||= '{{'+c.match_column+'}}';}
    replaceEditor(editor,c);
  });
  document.addEventListener('click',async event=>{
    const button=event.target.closest('[data-table-action], [data-tree-action="save"]');if(!button)return;
    const editor=button.closest('[data-table-editor]')||button.closest('[data-order]')?.querySelector('[data-table-editor]');if(!editor)return;
    event.preventDefault();event.stopImmediatePropagation();
    const status=editor.querySelector('[data-table-status]');button.disabled=true;
    try{
      if(button.dataset.tableAction==='demo'){
        const drawing=editor.querySelector('.guide-flow-drawing'),messages=['Abre o detalhe da primeira linha.','Lê todas as colunas da tabela interna.','Fecha o detalhe e volta à lista.','Vai para a próxima linha e repete.'];
        status.textContent='Demonstração visual. Nenhuma ação será executada no portal.';
        for(let phase=0;phase<messages.length;phase++){
          if(!drawing?.isConnected)break;
          drawing.dataset.demoPhase=String(phase);drawing.querySelector('figcaption').textContent=messages[phase];
          if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)await new Promise(resolve=>setTimeout(resolve,700));
        }
        status.textContent='Exemplo concluído. Ao executar, os dados serão lidos da empresa atual.';
      }else if(['show-guide','show-advanced','guide-step','set-key','use-history'].includes(button.dataset.tableAction)){
        const c=readEditor(editor),order=Number(editor.dataset.order),action=button.dataset.tableAction;
        if(action==='show-guide')setGuideView(order,{advanced:false});
        if(action==='show-advanced')setGuideView(order,{advanced:true});
        if(action==='guide-step')setGuideView(order,{step:Number(button.dataset.step)});
        if(action==='set-key'){(c.traversal_options||={}).key_column=button.dataset.column;c.match_column=button.dataset.column;c.match_value='{{'+button.dataset.column+'}}';}
        if(action==='use-history')(c.traversal_options||={}).return_mode='back';
        replaceEditor(editor,c);
        if(['guide-step','set-key','use-history'].includes(action))await saveGuideDraft(editor,c);
      }else if(button.dataset.tableAction==='complete-setup'){
        const wizard=editor.querySelector('.table-traversal-wizard');if(wizard){wizard.open=true;wizard.scrollIntoView({block:'nearest'});wizard.querySelector('[data-table-action="map-detail"]')?.focus({preventScroll:true});}
      }else if(['create-traversal','update-traversal'].includes(button.dataset.tableAction)){
        const c=readEditor(editor),o=c.traversal_options;
        if(!c.action||!o?.detail_descriptor||(o.return_mode!=='back'&&!o.return_control))throw Error('Escolha o botão de abrir, mapeie a tabela do detalhe e configure a volta.');
        status.textContent='Criando percurso no mapa...';
        const result=await invoke('map_paths_action',{request:{action:button.dataset.tableAction==='update-traversal'?'table_traversal_update':'table_traversal_create',order:Number(editor.dataset.order),table:c,traversal:o}});applyRoadmap(result);
      }else if(['map-detail','map-return'].includes(button.dataset.tableAction)){
        const c=readEditor(editor),control=button.dataset.tableAction==='map-return';
        status.textContent=control?'No Chrome, selecione o botão de fechar ou voltar.':'No Chrome, selecione a tabela interna do detalhe.';
        const result=await invoke('map_chrome_table',{request:control?{pick_control:true}:null});if(!result?.ok)throw Error(result?.error||'Mapeamento cancelado.');
        if(control&&c.mode==='return')c.return_control=result.control;
        else{const o=c.traversal_options||={};if(control){o.return_control=result.control;o.return_label=result.label;o.return_mode='button';}else o.detail_descriptor=result.descriptor;}
        const next=replaceEditor(editor,c);next.querySelector('.table-traversal-wizard')?.setAttribute('open','');next.querySelector('[data-table-status]').textContent='Mapeamento concluído. Configure as demais etapas e crie o percurso.';
        await saveGuideDraft(editor,c);
      }else if(button.dataset.tableAction==='choose'){
        const c=readEditor(editor);c.action=JSON.parse(button.dataset.button);c.mode='click';
        c.match_column ||= c.descriptor.headers[0];c.match_value ||= '{{'+c.match_column+'}}';
        const next=replaceEditor(editor,c);next.querySelector('[data-table-status]').textContent=`Ação selecionada: ${c.action.label}. Confira o identificador da linha e salve.`;
        await saveGuideDraft(editor,c);
      }else if(['map','preview'].includes(button.dataset.tableAction)){
        const c=readEditor(editor),refresh=button.dataset.tableAction==='preview';
        status.textContent='No Chrome, clique na tabela desejada. Esc cancela.';
        if(refresh)status.textContent='Atualizando a prévia da tabela aberta no Chrome...';
        const result=await invoke('map_chrome_table',{request:refresh?{descriptor:c.descriptor}:null});if(!result?.ok)throw Error(result?.error||'Tabela não selecionada.');
        c.descriptor=result.descriptor;if(!refresh)c.columns=result.columns.filter(x=>!/^Coluna \d+$|^Ações$/i.test(x));
        (c.traversal_options||={}).key_column ||= c.key_column||c.match_column||result.columns.find(h=>!/^Coluna \d+$|^Ações$/i.test(h))||result.columns[0];
        c.action_choices=[...new Map((result.actions||[]).flat().map(a=>[actionKey(a),a])).values()];
        if(c.action&&!c.action_choices.some(a=>actionKey(a)===actionKey(c.action)))delete c.action;

        const next=replaceEditor(editor,c);
        next.querySelector('[data-table-status]').textContent=`Estrutura reconhecida: ${result.columns.length} colunas. Os valores serão lidos somente ao executar.`;
        await saveGuideDraft(editor,c);
      }else{
        const c=readEditor(editor);
        if(!editor.classList.contains('table-guide'))delete c.setup_pending;
        if(!['return','export'].includes(c.mode)&&(!c.descriptor||(c.mode!=='click'&&!c.columns.length)))throw Error('Mapeie a tabela e selecione as colunas.');
        if(c.mode==='click'&&(!c.action||!c.match_value.trim()))throw Error('Escolha o botão na prévia e informe o identificador da linha.');
        if(c.mode==='value'&&(c.columns.length!==1||!c.match_value.trim()))throw Error('Selecione uma coluna e informe a busca da linha.');
        const result=await invoke('map_paths_action',{request:{action:'table_save',order:Number(editor.dataset.order),table:c}});applyRoadmap(result);status.textContent='Tabela salva.';
      }
    }catch(error){status.textContent=String(error.message||error);}finally{button.disabled=false;}
  },true);
}

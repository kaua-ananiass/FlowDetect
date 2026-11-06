// Capture definitions live inside the first OCR layout so they travel with the
// existing editor, ZIP import/export and recognition commands.
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function captureFromDetails(details = {}) {
  return details.ocr_target_layouts?.[0]?.capture || {};
}
export function readCapture(container, fallback = {}) {
  const editor = container?.querySelector('[data-variable-editor]');
  if (!editor) return fallback;
  const get = name => editor.querySelector(`[data-capture="${name}"]`);
  let region;
  try { region = JSON.parse(editor.querySelector('[data-capture-region]')?.value || 'null'); } catch {}
  const image = container.querySelector('.recognition-preview-image');
  const getOcr = field => Number(container.querySelector(`[data-tree-field="${field}"], [data-field="${field}"]`)?.value || 0);
  const nw = image?.naturalWidth, nh = image?.naturalHeight;
  const previous = JSON.parse(editor.dataset.captureInitial || '{}');
  const anchor = nw && nh ? {
    x: .5 + getOcr('relativeOcrOffsetX')/nw - (getOcr('relativeOcrWidth')||140)/nw/2,
    y: .5 + getOcr('relativeOcrOffsetY')/nh - (getOcr('relativeOcrHeight')||40)/nh/2,
    width: (getOcr('relativeOcrWidth')||140)/nw,
    height: (getOcr('relativeOcrHeight')||40)/nh,
  } : previous.anchor;
  return {
    enabled: get('enabled').checked,
    name: get('name').value.trim(),
    kind: get('kind').value,
    region: region || previous.region,
    anchor,
    reference: {width:getOcr('relativeOcrWidth')||140,height:getOcr('relativeOcrHeight')||40,offsetX:getOcr('relativeOcrOffsetX'),offsetY:getOcr('relativeOcrOffsetY')},
    // Preserve existing definitions until the user marks a visual region.
    ...(!region ? {side:previous.side,width:previous.width,height:previous.height,gap:previous.gap} : {}),
  };
}
export function renderCaptureEditor(details = {}, preview = '', standalone = false) {
  const c = captureFromDetails(details);
  const options = (values, selected) => values.map(([value,label]) => `<option value="${value}" ${value===selected?'selected':''}>${label}</option>`).join('');
  return `<section class="ocr-variable-editor" data-variable-editor data-capture-initial="${esc(JSON.stringify(c))}">
    ${standalone ? Object.entries({relativeOcrWidth:c.reference?.width||140,relativeOcrHeight:c.reference?.height||40,relativeOcrOffsetX:c.reference?.offsetX||0,relativeOcrOffsetY:c.reference?.offsetY||0,relativeOcrSide:'livre'}).map(([key,value])=>`<input data-tree-field="${key}" type="hidden" value="${esc(value)}">`).join('') : ''}
    <label class="ocr-variable-toggle"><input type="checkbox" data-capture="enabled" ${c.enabled?'checked':''}> Salvar uma informação</label>
    <p>Marque na imagem onde o valor aparece. Arraste a área Variável e ajuste pelos cantos.</p>
    <div class="ocr-variable-fields" ${c.enabled?'':'hidden'}>
      <div class="ocr-variable-grid ocr-variable-identity">
      <label>Nome da variável<input data-capture="name" value="${esc(c.name)}" placeholder="valor_nota" maxlength="48" pattern="[a-zA-Z_][a-zA-Z0-9_]*" autocomplete="off"></label>
      <label>Informação<select data-capture="kind">${options([['money','Dinheiro'],['number','Número'],['date','Data'],['text','Texto']],c.kind||'money')}</select></label>
      </div>
      <input data-capture-region type="hidden" value="${esc(JSON.stringify(c.region || null))}">
      <div class="variable-image-editor">${preview || '<small>Abra um bloco com imagem de referência para marcar a variável.</small>'}</div>
      <div class="recognition-simple-actions"><button class="tree-open-button" data-tree-action="capture-image" type="button">Tirar print</button><button class="tree-open-button" data-tree-action="select-image" type="button">Trocar imagem</button></div>
      <small data-variable-token>Use depois: {{${esc(c.name||'valor_nota')}}}</small>
      <div class="recognition-simple-actions"><button type="button" data-variable-test="screen" class="tree-open-button" title="Lê a tela deste computador com o OCR local">Testar tudo na tela</button><button type="button" data-variable-test="chrome" class="tree-open-button">Testar tudo no Chrome</button></div>
      <output data-variable-test-result role="status"></output>
      <small>Salve o bloco para aplicar. Leitura inválida segue a saída de falha.</small>
    </div>
  </section>`;
}

export function renderVariableOverlay(capture = {}) {
  if (!capture.enabled) return '';
  const r = capture.region || {x:.55,y:.55,width:.3,height:.2};
  return `<div data-variable-region data-recognition-drag-target="variable" class="recognition-variable-region" style="left:${r.x*100}%;top:${r.y*100}%;width:${r.width*100}%;height:${r.height*100}%"><span>Variável</span>${['nw','ne','sw','se'].map(corner=>`<i class="recognition-ocr-resize-handle is-${corner}" data-recognition-drag-target="variable-resize" data-variable-corner="${corner}"></i>`).join('')}</div>`;
}

export function syncVariableOverlays(container) {
  const capture = readCapture(container);
  for (const map of container.querySelectorAll('[data-recognition-preview-image-map]')) {
    if (map.closest('.ocr-target-action-preview')) continue;
    let box = map.querySelector('[data-variable-region]');
    if (!capture.enabled) { box?.remove(); continue; }
    if (!box) { map.insertAdjacentHTML('beforeend',renderVariableOverlay(capture)); box=map.querySelector('[data-variable-region]'); }
    const r=capture.region || {x:.55,y:.55,width:.3,height:.2};
    Object.assign(box.style,{left:r.x*100+'%',top:r.y*100+'%',width:r.width*100+'%',height:r.height*100+'%'});
  }
}

export function moveVariableRegion(container, target, clientX, clientY) {
  const map=target.closest('[data-recognition-preview-image-map]');
  const image=map?.querySelector('.recognition-preview-image');
  const bounds=image?.getBoundingClientRect();
  const hidden=container.querySelector('[data-capture-region]');
  if(!bounds?.width || !hidden) return;
  const x=Math.max(0,Math.min(1,(clientX-bounds.left)/bounds.width));
  const y=Math.max(0,Math.min(1,(clientY-bounds.top)/bounds.height));
  let r;try{r=JSON.parse(hidden.value)}catch{}
  r=r || {x:.55,y:.55,width:.3,height:.2};
  const minW=Math.min(.1,16/image.naturalWidth),minH=Math.min(.1,12/image.naturalHeight);
  if(target.dataset.recognitionDragTarget==='variable-resize') {
    const right=r.x+r.width,bottom=r.y+r.height,corner=target.dataset.variableCorner;
    if(corner.includes('w')){r.x=Math.max(0,Math.min(right-minW,x));r.width=right-r.x;}else r.width=Math.max(minW,Math.min(1-r.x,x-r.x));
    if(corner.includes('n')){r.y=Math.max(0,Math.min(bottom-minH,y));r.height=bottom-r.y;}else r.height=Math.max(minH,Math.min(1-r.y,y-r.y));
  }else{
    r.x=Math.max(0,Math.min(1-r.width,x-r.width/2));
    r.y=Math.max(0,Math.min(1-r.height,y-r.height/2));
  }
  hidden.value=JSON.stringify(r);
  syncVariableOverlays(container);
}
export function collectVariables(events = []) {
  const grouped = new Map();
  for (const event of events) {
    const c = captureFromDetails(event.details || event.detalhes || {});
    if (!c.enabled || !c.name) continue;
    const item = grouped.get(c.name) || {name:c.name,kind:c.kind,orders:[]};
    item.orders.push(event.order ?? event.ordem);
    grouped.set(c.name,item);
  }
  return [...grouped.values()];
}
export function renderVariablesPanel(events = []) {
  const variables = collectVariables(events);
  return `<details class="map-variables" ${variables.length?'open':''}><summary>Variáveis <span>${variables.length}</span></summary>
    <div class="map-variable-list">${variables.length ? variables.map(v => `<button type="button" data-copy-variable="${esc(v.name)}" title="Copiar para usar em um campo · Bloco ${esc(v.orders.join(', '))}"><b>{{${esc(v.name)}}}</b><small>${esc(({money:'Dinheiro',number:'Número',date:'Data',text:'Texto'})[v.kind]||'Texto')} · Bloco ${esc(v.orders.join(', '))}</small></button>`).join('') : '<p>Ative “Salvar uma informação” na aba Variável de um bloco OCR.</p>'}</div>
    ${variables.length?'<small>Definições da automação. Os valores são obtidos durante a execução. Clique para copiar.</small>':''}
  </details>`;
}

export function renderTextVariableLibrary(events = []) {
  const variables = collectVariables(events);
  return `<details class="text-variable-library" ${variables.length?'open':''}>
    <summary>Inserir vari\u00e1vel <span>${variables.length}</span></summary>
    <div class="text-variable-chips">${variables.map(v=>`<button type="button" data-insert-text-variable="${esc(v.name)}" title="Inserir valor capturado pelo OCR \u00b7 Bloco ${esc(v.orders.join(', '))}"><span>${esc(v.name)}</span><small>OCR ${esc(v.orders.join(', '))}</small></button>`).join('') || '<small>Configure uma vari\u00e1vel em um bloco OCR para usar aqui.</small>'}</div>
    ${variables.length?'<small>Clique para inserir no texto. O valor ser\u00e1 preenchido durante a execu\u00e7\u00e3o.</small>':''}
  </details>`;
}
export function insertTextVariable(field, name) {
  if (!field || !/^[A-Za-z_][A-Za-z0-9_]{0,47}$/.test(name)) return false;
  const token = `{{${name}}}`;
  const start = field.selectionStart ?? field.value.length;
  const end = field.selectionEnd ?? start;
  field.setRangeText(token, start, end, 'end');
  field.focus({preventScroll:true});
  field.dispatchEvent(new Event('input',{bubbles:true}));
  field.dispatchEvent(new Event('change',{bubbles:true}));
  return true;
}

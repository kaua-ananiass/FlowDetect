const common = [
  ['empresa.codigo', 'Código da empresa', 'text'],
  ['funcionario.codigo', 'Código / matrícula do funcionário', 'text'],
];
export const ALTERDATA_TASKS = [
  { id:'ferias', name:'Férias', description:'Prepare datas e dias para a rotina de férias.', fields:[...common, ['ferias.inicio','Início das férias','date'], ['ferias.dias','Quantidade de dias','number']] },
  { id:'admissao', name:'Admissão', description:'Organize o cadastro para o fluxo de contratação.', fields:[['empresa.codigo','Código da empresa','text'], ['funcionario.nome','Nome do funcionário','text'], ['admissao.data','Data de admissão','date'], ['admissao.funcao','Função','text']] },
  { id:'rescisao', name:'Rescisão', description:'Prepare os dados aprovados para a rotina de desligamento.', fields:[...common, ['rescisao.data','Data do desligamento','date'], ['rescisao.motivo','Motivo aprovado','text']] },
  { id:'experiencia', name:'Contrato de experiência', description:'Emita o documento com o fluxo configurado.', fields:[...common, ['experiencia.vencimento','Vencimento da experiência','date'], ['experiencia.prorrogacao','Prorrogação até (opcional)','date', false]] },
];
const KEY = 'flowdetect.alterdata.requests.v1';

export function resolveAlterdataTexts(events, values, requiredKeys) {
  const used = new Set();
  const overrides = {};
  for (const event of events) {
    const source = String(event.text ?? event.texto ?? '');
    if (!source.includes('{{')) continue;
    const text = source.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
      if (!Object.prototype.hasOwnProperty.call(values, key)) throw new Error(`Variável não reconhecida: ${key}`);
      used.add(key);
      const value = values[key];
      return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('/') : value;
    });
    if (text.includes('{{') || text.includes('}}')) throw new Error('Há uma variável incompleta no fluxo.');
    const order = String(event.order ?? event.ordem ?? '');
    if (!order || Object.hasOwn(overrides, order)) throw new Error('Os blocos variáveis precisam de identificadores únicos.');
    overrides[order] = text;
  }
  const missing = requiredKeys.filter(key => !used.has(key));
  if (missing.length) throw new Error(`Configure estes campos em blocos de texto editáveis do fluxo: ${missing.map(key => '{{' + key + '}}').join(', ')}`);
  for (const [key, value] of Object.entries(values)) {
    if (value && !used.has(key)) throw new Error(`O fluxo não utiliza o campo preenchido {{${key}}}.`);
  }
  return overrides;
}

export function initAlterdata({ listAgents, listFlows, execute, openEditor, openAgent, storage = localStorage }) {
  const panel = document.getElementById('alterdataPanel');
  if (!panel) return;
  const $ = id => document.getElementById(id);
  let selected = ALTERDATA_TASKS[0];
  let requests = [];
  let locked = false;
  const say = (message, error = false) => { $('alterdataFeedback').textContent = message; $('alterdataFeedback').dataset.error = String(error); };
  const node = (tag, text, cls) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (cls) el.className = cls; return el; };
  try { const saved = JSON.parse(storage.getItem(KEY) || '[]'); requests = Array.isArray(saved) ? saved.filter(r => ALTERDATA_TASKS.some(t => t.id === r.type) && r.values && typeof r.values === 'object') : []; }
  catch { say('Não foi possível ler os pedidos salvos.', true); }
  function options(id, items, empty) {
    const select = $(id), value = select.value;
    select.replaceChildren(new Option(empty, ''), ...items.map(i => new Option(i.name, i.id)));
    if (items.some(i => i.id === value)) select.value = value;
  }
  function refresh() {
    options('alterdataAgent', listAgents(), 'Selecione um agente');
    options('alterdataFlow', listFlows(), 'Selecione um fluxo');
  }
  function choose(type, values = {}) {
    selected = ALTERDATA_TASKS.find(t => t.id === type) || ALTERDATA_TASKS[0];
    $('alterdataTaskTitle').textContent = selected.name;
    $('alterdataReviewed').checked = false;
    $('alterdataFields').replaceChildren(...selected.fields.map(([key, label, type, required = true]) => {
      const wrapper = node('label', label), input = node('input');
      input.type = type; input.name = key; input.required = required; input.value = String(values[key] || '');
      if (type === 'number') { input.min = '1'; input.step = '1'; }
      wrapper.append(input); return wrapper;
    }));
    $('alterdataVariables').replaceChildren(...selected.fields.map(([key]) => node('code', '{{' + key + '}}')));
    for (const button of $('alterdataTemplates').children) button.setAttribute('aria-pressed', String(button.dataset.type === selected.id));
    say('');
  }
  function read(requireExecution = false) {
    const values = {};
    for (const [key, , , required = true] of selected.fields) {
      const input = $('alterdataForm').elements.namedItem(key);
      if (!input.checkValidity() || (required && !input.value.trim())) { input.reportValidity(); input.focus(); throw new Error('Preencha os dados do pedido.'); }
      values[key] = input.value.trim();
    }
    const agentId = $('alterdataAgent').value, flowId = $('alterdataFlow').value;
    if (requireExecution && (!agentId || !flowId)) throw new Error('Selecione o agente e o fluxo visual.');
    return { id:crypto.randomUUID(), type:selected.id, values, agentId, flowId, createdAt:new Date().toISOString(), status:'Preparado' };
  }
  function persist(next) { storage.setItem(KEY, JSON.stringify(next)); requests = next; renderRequests(); }
  function renderRequests() {
    $('alterdataRequestCount').textContent = String(requests.length);
    $('alterdataRequests').replaceChildren(...requests.map(request => {
      const task = ALTERDATA_TASKS.find(t => t.id === request.type);
      const card = node('article', undefined, 'alterdata-request');
      const actions = node('div', undefined, 'alterdata-request-actions');
      const load = node('button','Abrir','ghost-button'), remove = node('button','Remover','ghost-button');
      load.type = remove.type = 'button';
      load.addEventListener('click', () => { if (locked) return; refresh(); choose(request.type, request.values); $('alterdataAgent').value = request.agentId; $('alterdataFlow').value = request.flowId; });
      remove.addEventListener('click', () => { try { if (!locked) persist(requests.filter(r => r.id !== request.id)); } catch { say('Não foi possível remover o pedido.',true); } });
      actions.append(load,remove);
      card.append(node('strong',task.name),node('p',`Empresa ${request.values['empresa.codigo']} · ${request.values['funcionario.codigo'] || request.values['funcionario.nome'] || ''}`),node('p',request.status),actions);
      return card;
    }));
    if (!requests.length) $('alterdataRequests').append(node('p','Nenhum pedido preparado.','alterdata-muted'));
  }
  $('alterdataTemplates').replaceChildren(...ALTERDATA_TASKS.map(task => {
    const button = node('button',undefined,'alterdata-template'); button.type='button'; button.dataset.type=task.id;
    button.append(node('strong',task.name),node('span',task.description));
    button.addEventListener('click', () => { if (!locked) choose(task.id); }); return button;
  }));
  $('alterdataSave').addEventListener('click', () => { try { if (locked) return; const request=read(); persist([request,...requests]); say('Pedido salvo. Nenhuma execução foi iniciada.'); } catch(error) { say(error.message,true); } });
  $('alterdataForm').addEventListener('submit', async event => {
    event.preventDefault(); if (locked) return;
    let request;
    try {
      request=read(true);
      if (!$('alterdataReviewed').checked) throw new Error('Confira os dados e confirme a validação do fluxo antes de executar.');
      persist([request,...requests]); locked=true;
      $('alterdataForm').querySelectorAll('input,select,button').forEach(el => el.disabled=true);
      say('Preparando o fluxo e conectando ao agente…');
      await execute(request, selected.fields.filter(f=>f[3]!==false).map(f=>f[0]));
      request={...request,status:'Iniciado no agente'};
      persist(requests.map(r=>r.id===request.id?request:r));
      say('Execução iniciada. Acompanhe o resultado na Tela do Agent.');
      $('alterdataWatch').hidden = false;
    } catch(error) {
      if (request && requests.some(r=>r.id===request.id)) {
        try { persist(requests.map(r=>r.id===request.id?{...r,status:'Verificar agente antes de tentar novamente'}:r)); } catch { /* Preserve original failure. */ }
      }
      say(String(error.message || error),true);
    } finally {
      if (locked) $('alterdataForm').querySelectorAll('input,select,button').forEach(el => el.disabled=false);
      locked=false;
    }
  });
  $('alterdataRefresh').addEventListener('click',()=>{ if (!locked) refresh(); });
  $('alterdataOpenEditor').addEventListener('click',openEditor);
  $('alterdataWatch').addEventListener('click', () => openAgent?.());
  refresh(); choose(selected.id); renderRequests();
  return { refresh };
}

export function initGoogleWorkspace({host, invoke, pickFile, onWorkbook, isRunning = () => false, intervalMs = 5000}) {
  if (!host) return;
  host.innerHTML = `
    <details class="google-connection">
      <summary><span>Google Sheets e Drive</span><small data-google-badge>Conectar conta</small></summary>
      <div class="google-content">
        <header><div><h3>Sua planilha e seus arquivos na nuvem</h3>
          <p>Traga dados para os blocos de planilha e envie os arquivos gerados ao Drive.</p></div>
          <div class="google-actions"><button type="button" data-google="connect" class="primary-button">Conectar Google</button>
          <button type="button" data-google="disconnect" class="ghost-button">Desconectar</button></div></header>
        <details class="google-setup"><summary>Primeira conexão? Configure o Google Cloud</summary>
          <ol><li>No Google Cloud, crie um projeto chamado FlowDetect.</li>
          <li>Ative as APIs <b>Google Sheets API</b> e <b>Google Drive API</b>.</li>
          <li>Em Google Auth Platform, configure o nome do app e o e-mail de suporte. Em Público-alvo, selecione Externo e adicione seu e-mail como usuário de teste.</li>
          <li>Em Acesso a dados, adicione <code>spreadsheets</code> e <code>drive.file</code>.</li>
          <li>Em Clientes, crie um ID OAuth do tipo <b>App para computador</b>. Baixe o JSON e importe abaixo.</li></ol>
          <p>Sheets permite ler e editar suas planilhas. Drive fica limitado aos arquivos usados por este app. A autorização acontece no navegador; o Studio não recebe sua senha.</p>
          <button type="button" data-google="configure" class="soft-button">Importar JSON do Google Cloud</button>
        </details>
        <div class="google-tools">
          <section><h4>1 · Google Sheets</h4><label>Link da planilha<input data-google-url type="url" placeholder="https://docs.google.com/spreadsheets/d/…" /></label>
          <p>Use os blocos de planilha com a cópia local. Você pode sincronizar manualmente ou ativar a atualização automática.</p>
          <div class="google-actions"><button type="button" data-google="pull" class="soft-button">Trazer planilha</button>
          <button type="button" data-google="push" class="ghost-button">Enviar resultados</button></div>
          <div class="google-auto"><button type="button" data-google-auto aria-pressed="false" class="ghost-button">Ativar sincronização automática</button>
          <small data-google-auto-status role="status" aria-live="polite">Verifica a cada 5 segundos. Durante a execução, aguarda o término para sincronizar.</small></div>
          <small>São enviados apenas os valores alterados. Formatação, gráficos e validações ficam no Google.</small></section>
          <section><h4>2 · Google Drive</h4><p>Escolha um PDF, relatório, planilha ou outro arquivo para salvar na pasta <b>FlowDetect</b> da conta conectada.</p>
          <button type="button" data-google="upload" class="soft-button">Escolher arquivo e enviar</button>
          <small>Cada envio cria um arquivo novo. Os arquivos locais são preservados.</small>
          <a data-google-result hidden target="_blank" rel="noopener noreferrer">Abrir arquivo no Drive ↗</a></section>
        </div>
        <p data-google-status role="status" aria-live="polite"></p>
      </div>
    </details>`;
  let busy = false;
  let auto = false, timer = null, generation = 0;
  const autoButton = host.querySelector('[data-google-auto]');
  const autoStatus = host.querySelector('[data-google-auto-status]');
  const urlInput = host.querySelector('[data-google-url]');
  function stopAuto(message = 'Sincronização automática pausada.') {
    auto = false; generation++;
    clearTimeout(timer);
    autoButton.textContent = 'Ativar sincronização automática';
    autoButton.setAttribute('aria-pressed', 'false');
    autoStatus.textContent = message;
  }
  async function tick() {
    if (!auto || !host.isConnected) return;
    const version = generation;
    if (busy || isRunning()) {
      autoStatus.textContent = isRunning() ? 'Aguardando o término da execução. A lista do loop permanece fixa.' : 'Aguardando a operação atual…';
    } else {
      busy = true;
      host.querySelectorAll('[data-google]').forEach(b => {b.disabled = true;});
      try {
        const result = await invoke('google_workspace_action', {payload: {action: 'sync', url: urlInput.value.trim()}});
        if (version !== generation) return;
        if (result.paused) {
          autoStatus.textContent = 'Aguardando o término da execução.';
        } else {
          if (result.received_cells || result.updated_cells) await onWorkbook(result.workbook_id, {automatic: true});
          autoStatus.textContent = `Atualizado às ${new Date().toLocaleTimeString('pt-BR')}: ${result.received_cells || 0} célula(s) recebida(s), ${result.updated_cells || 0} enviada(s).`;
        }
      } catch (error) {
        stopAuto(`Sincronização pausada: ${String(error)}`);
      } finally {
        busy = false;
        host.querySelectorAll('[data-google]').forEach(b => {b.disabled = false;});
      }
    }
    if (auto && version === generation) timer = setTimeout(tick, intervalMs);
  }
  autoButton.addEventListener('click', () => {
    if (auto) {stopAuto(); return;}
    if (busy) return;
    if (!urlInput.value.trim()) {autoStatus.textContent = 'Cole o link e traga a planilha primeiro.'; return;}
    auto = true; generation++;
    autoButton.textContent = 'Pausar sincronização automática';
    autoButton.setAttribute('aria-pressed', 'true');
    autoStatus.textContent = 'Sincronizando…';
    tick();
  });
  urlInput.addEventListener('input', () => {if (auto) stopAuto('Link alterado. Ative novamente para sincronizar a planilha escolhida.');});
  window.addEventListener('pagehide', () => stopAuto());
  const status = host.querySelector('[data-google-status]');
  const badge = host.querySelector('[data-google-badge]');
  function renderState(value) {
    badge.textContent = value.connected ? 'Conta conectada' : value.configured ? 'Pronto para conectar' : 'Configuração inicial';
    host.querySelector('[data-google="disconnect"]').hidden = !value.connected;
    host.querySelector('[data-google="connect"]').textContent = value.connected ? 'Trocar conta Google' : 'Conectar Google';
    if (!value.configured) host.querySelector('.google-setup').open = true;
  }
  async function refresh() {
    renderState(await invoke('google_workspace_action', {payload: {action: 'status'}}));
  }
  host.querySelector('details').addEventListener('toggle', () => {
    if (host.querySelector('details').open && !busy) refresh().catch(e => {status.textContent = String(e);});
  });
  host.addEventListener('click', async event => {
    const button = event.target.closest('[data-google]');
    if (!button || busy) return;
    const action = button.dataset.google;
    if (auto) stopAuto();
    const payload = {action};
    if (action === 'configure' || action === 'upload') {
      try {
        payload.path = await pickFile({multiple: false, directory: false,
          title: action === 'configure' ? 'JSON OAuth do Google Cloud' : 'Arquivo para salvar no Drive',
          ...(action === 'configure' ? {filters: [{name: 'JSON OAuth', extensions: ['json']}]} : {})});
      } catch (error) {status.textContent = String(error); return;}
      if (!payload.path) return;
    }
    if (action === 'pull' || action === 'push') {
      payload.url = host.querySelector('[data-google-url]').value.trim();
      if (!payload.url) {status.textContent = 'Cole o link da planilha primeiro.'; return;}
      if (action === 'pull' && !window.confirm('Trazer os dados atuais do Google? Se você já trouxe esta planilha antes, a cópia local será substituída. Envie os resultados locais antes, se precisar preservá-los.')) return;
      if (action === 'push' && !window.confirm('Enviar para o Google os valores alterados na cópia local desta planilha?')) return;
    }
    if (action === 'disconnect' && !window.confirm('Desconectar esta conta neste computador? Os arquivos já enviados serão preservados.')) return;
    busy = true;
    host.querySelectorAll('button').forEach(b => {b.disabled = true;});
    status.dataset.error = 'false';
    status.textContent = action === 'connect' ? 'Continue no navegador. Aguardando sua autorização (até 3 minutos)…' : 'Processando…';
    try {
      const result = await invoke('google_workspace_action', {payload});
      if (action === 'pull') await onWorkbook(result.workbook_id);
      const messages = {configure: 'Configuração importada. Agora clique em Conectar Google.', connect: 'Conta Google conectada.', disconnect: 'Conta desconectada deste computador.',
        pull: `Planilha recebida: ${result.title || ''}. Agora você pode usá-la nos blocos.`,
        push: `${result.updated_cells ?? 0} célula(s) enviada(s) ao Google Sheets.`, upload: 'Arquivo salvo na pasta FlowDetect do Drive.'};
      status.textContent = messages[action];
      const link = host.querySelector('[data-google-result]');
      link.hidden = true;
      if (action === 'upload' && /^https:\/\/drive\.google\.com\//.test(result.webViewLink || '')) {link.href = result.webViewLink; link.hidden = false;}
      await refresh();
    } catch (error) {
      status.dataset.error = 'true';
      status.textContent = String(error);
    } finally {
      busy = false;
      host.querySelectorAll('button').forEach(b => {b.disabled = false;});
    }
  });
}

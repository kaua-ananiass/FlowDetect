(() => {
  const picker = $("#company-picker");
  const pickerInput = $("#company-picker-input");
  const modal = $("#company-modal");
  const modalContent = $("#company-modal-content");
  const confirmation = $("#save-confirmation");
  const storageKey = "flowdetect-sittax-training-company-data-v1";
  const selectedSuggestions = new Set();
  const SUPPLIERS = [
    { cnpj: "90.000.201/0000-00", name: "Oficina do Vale Insumos Ltda" },
    { cnpj: "90.000.202/0000-00", name: "Nuvem Clara Materiais Ltda" },
    { cnpj: "90.000.203/0000-00", name: "Ponte do Sol Serviços ME" },
    { cnpj: "90.000.204/0000-00", name: "Estrela Nova Tecnologia Ltda" },
    { cnpj: "90.000.205/0000-00", name: "Jardim de Cedro Suprimentos Ltda" },
    { cnpj: "90.000.206/0000-00", name: "Brisa do Campo Consultoria Ltda" }
  ];
  const TAB_NAMES = {
    dados: "Dados da Empresa", certificados: "Certificados", ecac: "Dados do E-CAC",
    faturamento: "Faturamento", mensagens: "Mensagens", locacao: "Locação/Outras",
    sugestoes: "Sugestão Tipo Nota", anexo: "Configuração de Anexo", servicos: "Códigos de Serviço"
  };
  let currentCompany = null;
  let selectedCompanyId = "";
  let activeTab = "dados";
  let suggestionSubtab = "geral";
  let pendingSave = null;

  function emptyState() { return { suggestions: {}, fields: {} }; }
  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (parsed && typeof parsed === "object") {
        return {
          suggestions: parsed.suggestions && typeof parsed.suggestions === "object" ? parsed.suggestions : {},
          fields: parsed.fields && typeof parsed.fields === "object" ? parsed.fields : {}
        };
      }
    } catch (_) { /* O treino também funciona quando o armazenamento não está disponível. */ }
    return emptyState();
  }
  let saved = loadState();
  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify(saved)); }
    catch (_) { /* Mantém o estado apenas até recarregar a página. */ }
  }
  function chooseCompany(company) {
    selectedCompanyId = company.id;
    pickerInput.value = company.cnpj + " - " + company.company;
  }
  function resolveCompany() {
    const query = cleanName(pickerInput.value.trim());
    if (!query) return null;
    const chosen = companies.find(company => company.id === selectedCompanyId);
    if (chosen && query.includes(cleanName(chosen.cnpj))) return chosen;
    const digits = query.replace(/\D/g, "");
    const matches = companies.filter(company => (digits.length >= 8 && company.cnpj.replace(/\D/g, "").includes(digits))
      || cleanName(company.company).includes(query));
    return matches.length === 1 ? matches[0] : null;
  }
  function getSuggestions(company) {
    const index = companies.findIndex(item => item.id === company.id);
    if (index < 0 || index % 4 === 1) return [];
    const count = index % 3 === 0 ? 3 : 2;
    return Array.from({ length: count }, (_, number) => {
      const supplier = SUPPLIERS[(index + number) % SUPPLIERS.length];
      return {
        id: company.id + "-nota-" + (number + 1),
        note: "NF-" + String(20260000 + (index + 1) * 10 + number + 1),
        cnpj: supplier.cnpj,
        supplier: supplier.name,
        type: (index + number) % 3 === 0 ? "Serviço" : "Produto"
      };
    });
  }
  function savedSuggestionIds(company) {
    const ids = saved.suggestions[company.id];
    return Array.isArray(ids) ? ids : [];
  }
  function renderSuggestionTable() {
    const suggestions = getSuggestions(currentCompany);
    const storedIds = savedSuggestionIds(currentCompany);
    return '<div class="suggestion-actions"><span id="selected-suggestion-count">0 selecionadas</span><button class="orange-button" id="save-suggestions" type="button">Salvar sugestões</button></div>' +
      '<div class="suggestion-table-wrap"><table class="suggestion-table" aria-label="Sugestões de notas fiscais fictícias"><thead><tr>' +
      '<th><input id="select-all-suggestions" type="checkbox" aria-label="Selecionar todas as sugestões" ' + (suggestions.length ? '' : 'disabled') + '></th>' +
      '<th>CNPJ do fornecedor</th><th>Nome do fornecedor</th><th>Tipo</th></tr></thead><tbody>' +
      (suggestions.length ? suggestions.map(note =>
        '<tr data-note-id="' + note.id + '"><td><input class="suggestion-check" type="checkbox" data-note-id="' + note.id + '" aria-label="Selecionar ' + note.note + '" ' + (selectedSuggestions.has(note.id) ? 'checked' : '') + '></td>' +
        '<td>' + note.cnpj + '</td><td>' + escapeHtml(note.supplier) + (storedIds.includes(note.id) ? '<span class="saved-mark">Salva</span>' : '') +
        '<span class="note-meta">Nota fictícia ' + note.note + '</span></td><td>' + note.type + '</td></tr>').join("")
        : '<tr><td class="no-record" colspan="4">Nenhum registro encontrado.</td></tr>') +
      '</tbody></table></div><strong class="record-total">Total de registros: ' + suggestions.length + '</strong>';
  }
  function renderSuggestions() {
    const general = suggestionSubtab === "geral";
    let content = '<div class="suggestion-subtabs">' +
      '<button type="button" data-suggestion-tab="geral" class="' + (general ? 'selected' : '') + '" aria-pressed="' + general + '">Geral</button>' +
      '<button type="button" data-suggestion-tab="sugestao" class="' + (!general ? 'selected' : '') + '" aria-pressed="' + !general + '">Sugestão</button></div>';
    if (general) {
      const count = getSuggestions(currentCompany).length;
      content += '<div class="general-overview"><h3>Resumo das sugestões</h3><div class="overview-grid">' +
        '<div class="overview-item"><small>Empresa</small><strong>' + escapeHtml(currentCompany.company) + '</strong></div>' +
        '<div class="overview-item"><small>CNPJ fictício</small><strong>' + currentCompany.cnpj + '</strong></div>' +
        '<div class="overview-item"><small>Notas sugeridas</small><strong>' + count + '</strong></div>' +
        '<div class="overview-item"><small>Notas salvas neste navegador</small><strong>' + savedSuggestionIds(currentCompany).length + '</strong></div>' +
        '</div><button class="orange-button" type="button" data-suggestion-tab="sugestao">Ver sugestões</button></div>';
    } else {
      content += renderSuggestionTable();
    }
    modalContent.innerHTML = content;
    syncNoteSelection();
  }
  function field(key, label, value, options, readOnly, multiline) {
    const stored = saved.fields[currentCompany.id]?.[activeTab]?.[key];
    const actual = stored === undefined ? value : stored;
    const escaped = escapeHtml(actual ?? "");
    if (options) {
      return '<label>' + label + '<select data-company-field="' + key + '">' + options.map(option =>
        '<option value="' + escapeHtml(option) + '" ' + (option === actual ? 'selected' : '') + '>' + escapeHtml(option) + '</option>').join("") + '</select></label>';
    }
    if (multiline) return '<label>' + label + '<textarea data-company-field="' + key + '">' + escaped + '</textarea></label>';
    return '<label>' + label + '<input data-company-field="' + key + '" value="' + escaped + '" ' + (readOnly ? 'readonly class="read-only-field"' : '') + '></label>';
  }
  function renderOtherTab() {
    const company = currentCompany;
    let fields = "";
    switch (activeTab) {
      case "dados":
        fields = field("razao", "Razão social", company.company, null, true) +
          field("cnpj", "CNPJ fictício", company.cnpj, null, true) +
          field("fantasia", "Nome fantasia", company.company.replace(/ Ltda| ME/g, "")) +
          field("regime", "Regime", company.regime === "MEI" ? "MEI" : "Simples Nacional", ["Simples Nacional", "MEI"]);
        break;
      case "certificados":
        fields = field("situacao", "Situação do certificado", "A1 ativo", ["A1 ativo", "A3 ativo", "Sem certificado"]) +
          field("validade", "Validade de treino", "31/12/2026");
        break;
      case "ecac":
        fields = field("procuracao", "Procuração", "Ativa", ["Ativa", "Pendente", "Não cadastrada"]) +
          field("acesso", "Acesso de treino", "Liberado", ["Liberado", "Bloqueado"]);
        break;
      case "faturamento":
        fields = field("produtos", "Produtos (R$)", company.products.toFixed(2)) +
          field("servicos", "Serviços (R$)", company.services.toFixed(2));
        break;
      case "mensagens":
        fields = field("status", "Situação", "Sem mensagens", ["Sem mensagens", "Pendente", "Respondida"]) +
          field("mensagem", "Mensagem interna de treino", "", null, false, true);
        break;
      case "locacao":
        fields = field("locacao", "Receita de locação", "Não informada", ["Não informada", "Sim", "Não"]) +
          field("observacao", "Observações", "", null, false, true);
        break;
      case "anexo":
        fields = field("anexo", "Anexo tributário", company.annex, ["Anexo I", "Anexo II", "Anexo III", "Anexo IV", "Anexo V", "MEI"]) +
          field("fator", "Fator R de treino", "Não calculado", ["Não calculado", "Aplicável", "Não aplicável"]);
        break;
      case "servicos":
        fields = field("codigo", "Código de serviço", "0107") +
          field("descricao", "Descrição", "Serviços de treino");
        break;
    }
    modalContent.innerHTML = '<div class="other-panel"><h3>' + TAB_NAMES[activeTab] + '</h3>' +
      '<p>Dados fictícios para testar a navegação e o salvamento local.</p>' +
      '<div class="field-grid">' + fields + '</div><button class="orange-button" type="button" data-save-company-tab="' + activeTab + '">Salvar dados de treino</button></div>';
  }
  function renderCompanyPanel() {
    if (!currentCompany) return;
    $("#company-modal-title").textContent = "Dados da Empresa - " + currentCompany.company.toUpperCase();
    modal.querySelectorAll("[data-company-tab]").forEach(button => {
      const active = button.dataset.companyTab === activeTab;
      button.classList.toggle("selected", active);
      button.setAttribute("aria-pressed", String(active));
    });
    if (activeTab === "sugestoes") renderSuggestions();
    else renderOtherTab();
  }
  function syncNoteSelection() {
    const all = $("#select-all-suggestions");
    if (!all || !currentCompany || activeTab !== "sugestoes" || suggestionSubtab !== "sugestao") return;
    const notes = getSuggestions(currentCompany);
    all.checked = notes.length > 0 && notes.every(note => selectedSuggestions.has(note.id));
    all.indeterminate = !all.checked && notes.some(note => selectedSuggestions.has(note.id));
    const count = $("#selected-suggestion-count");
    if (count) count.textContent = selectedSuggestions.size + " selecionada" + (selectedSuggestions.size === 1 ? "" : "s");
  }
  function openCompany(company) {
    if (!company) return;
    currentCompany = company;
    chooseCompany(company);
    selectedSuggestions.clear();
    activeTab = "dados";
    suggestionSubtab = "geral";
    renderCompanyPanel();
    if (!modal.open) modal.showModal();
  }
  window.openCompanyTraining = openCompany;
  window.resetCompanyTraining = () => {
    saved = emptyState();
    try { localStorage.removeItem(storageKey); } catch (_) { /* Sem armazenamento disponível. */ }
    selectedSuggestions.clear();
    selectedCompanyId = "";
    currentCompany = null;
    pickerInput.value = "";
    if (confirmation.open) confirmation.close();
    if (modal.open) modal.close();
  };
  function askConfirmation(message, onConfirm) {
    pendingSave = onConfirm;
    $("#save-confirmation-message").textContent = message;
    confirmation.showModal();
  }
  pickerInput.addEventListener("input", () => { selectedCompanyId = ""; });
  $("#clear-company-picker").addEventListener("click", () => {
    selectedCompanyId = "";
    pickerInput.value = "";
    pickerInput.dispatchEvent(new Event("input", { bubbles: true }));
    pickerInput.focus();
  });
  picker.addEventListener("click", event => {
    if (event.target === picker || event.target.classList.contains("pill-icon")) pickerInput.focus();
  });
  pickerInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchCompany();
    }
  });
  function searchCompany() {
    const company = resolveCompany();
    if (company) openCompany(company);
    else { pickerInput.focus(); notify("Digite o CNPJ completo ou um nome que identifique uma empresa fictícia."); }
  }
  $("#open-company-details").addEventListener("click", searchCompany);
  $("#close-company-modal").addEventListener("click", () => modal.close());
  modal.addEventListener("click", event => {
    if (event.target !== modal) return;
    const bounds = modal.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) modal.close();
  });
  modal.addEventListener("close", () => selectedSuggestions.clear());
  modal.addEventListener("click", event => {
    const topTab = event.target.closest("[data-company-tab]");
    if (topTab) {
      activeTab = topTab.dataset.companyTab;
      if (activeTab === "sugestoes") suggestionSubtab = "geral";
      renderCompanyPanel();
      return;
    }
    const subtab = event.target.closest("[data-suggestion-tab]");
    if (subtab) { suggestionSubtab = subtab.dataset.suggestionTab; renderCompanyPanel(); return; }
    if (event.target.closest("#save-suggestions")) {
      if (!selectedSuggestions.size) { notify("Selecione ao menos uma nota fictícia antes de salvar."); return; }
      const company = currentCompany;
      const ids = [...selectedSuggestions];
      askConfirmation("Salvar " + ids.length + " sugestão(ões) de notas fictícias para " + company.company + "? Os dados ficam somente neste navegador.", () => {
        saved.suggestions[company.id] = [...new Set([...savedSuggestionIds(company), ...ids])];
        persist();
        selectedSuggestions.clear();
        renderCompanyPanel();
        notify(ids.length + " sugestão(ões) de treino salva(s).");
      });
      return;
    }
    const saveTab = event.target.closest("[data-save-company-tab]");
    if (saveTab) {
      const company = currentCompany;
      const tab = activeTab;
      const values = {};
      modalContent.querySelectorAll("[data-company-field]").forEach(input => {
        if (!input.readOnly) values[input.dataset.companyField] = input.value;
      });
      askConfirmation("Salvar os dados fictícios de " + TAB_NAMES[tab] + " para " + company.company + " neste navegador?", () => {
        if (!saved.fields[company.id]) saved.fields[company.id] = {};
        saved.fields[company.id][tab] = values;
        persist();
        notify("Dados de treino salvos para " + company.company + ".");
      });
    }
  });
  modal.addEventListener("change", event => {
    if (!currentCompany) return;
    if (event.target.id === "select-all-suggestions") {
      getSuggestions(currentCompany).forEach(note => {
        if (event.target.checked) selectedSuggestions.add(note.id);
        else selectedSuggestions.delete(note.id);
      });
      modalContent.querySelectorAll(".suggestion-check").forEach(input => { input.checked = event.target.checked; });
      syncNoteSelection();
    }
    if (event.target.matches(".suggestion-check")) {
      if (event.target.checked) selectedSuggestions.add(event.target.dataset.noteId);
      else selectedSuggestions.delete(event.target.dataset.noteId);
      syncNoteSelection();
    }
  });
  $("#cancel-save").addEventListener("click", () => { pendingSave = null; confirmation.close(); });
  $("#confirm-save").addEventListener("click", () => {
    const action = pendingSave;
    pendingSave = null;
    confirmation.close();
    if (action) action();
  });
  confirmation.addEventListener("close", () => { pendingSave = null; });
})();

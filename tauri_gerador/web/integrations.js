// Catalog only: no credentials, network requests or connector execution here.
export const INTEGRATIONS = Object.freeze([
  {
    id: "alterdata", name: "Alterdata", initials: "AL", category: "Fiscal, Contábil e DP", color: "#65dec9",
    description: "Conferência fiscal e automações complementares, aproveitando os XMLs que vocês já recebem.",
    capabilities: ["Analisar itens e valores de PIS/COFINS informados nos XMLs existentes", "Conferir resultados com relatórios exportados do Alterdata", "Vincular empresas aos fluxos pelo CNPJ"],
    requirements: "Identificar onde a integração atual disponibiliza os XMLs e quais relatórios o Alterdata exporta. O download e a importação das notas continuam nos programas já utilizados. As análises devem passar por revisão do responsável fiscal.",
    next: "Mapear os arquivos e relatórios existentes para começar pela leitura e conferência, sem reimportar notas nem escrever no banco do Alterdata.",
  },
  {
    id: "nibo", name: "Nibo", initials: "NI", category: "Atendimento", color: "#70b8ff",
    description: "Relacionar pedidos dos clientes às empresas e às automações do FlowDetect.",
    capabilities: ["Planejar uma fila de solicitações por empresa", "Associar atendimentos a CNPJ e competência", "Acompanhar resultados antes da entrega ao cliente"],
    requirements: "Confirmar uma interface suportada para o módulo Atendimento. O exportador de conversas separado não equivale a um conector instalado no FlowDetect.",
    next: "Validar os recursos disponíveis no Nibo antes de implementar leitura de pedidos ou envio de documentos.",
  },
  {
    id: "microsoft365", name: "Microsoft 365", initials: "MS", category: "E-mail e arquivos", color: "#b9a0ff",
    description: "Outlook, OneDrive e SharePoint para relatórios, anexos e documentos da equipe.",
    capabilities: ["Enviar resumos de execução pelo Outlook", "Organizar arquivos no OneDrive ou SharePoint", "Ler anexos autorizados para iniciar uma rotina"],
    requirements: "Registrar o aplicativo no Microsoft Entra e configurar OAuth com permissões mínimas. Algumas permissões podem exigir aprovação do administrador.",
    next: "Começar por relatórios de execução enviados ao destinatário aprovado, usando Microsoft Graph.",
  },
  {
    id: "google", name: "Google Drive / Sheets", initials: "GO", category: "Planilhas e arquivos", color: "#8bddac",
    description: "Planilhas compartilhadas como entrada dos fluxos e controle de resultados.",
    capabilities: ["Ler empresas selecionadas em uma planilha", "Atualizar o resultado de cada execução", "Organizar documentos em pastas autorizadas"],
    requirements: "Configurar um projeto Google Cloud, habilitar as APIs e autorizar somente as planilhas e os arquivos necessários.",
    next: "Implementar leitura de uma planilha e atualização do resultado, se a equipe utilizar Google Workspace.",
  },
]);

const STORAGE_KEY = "flowdetect.integration-priorities.v1";
const normalize = value => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function initIntegrations(root = document, storage) {
  const grid = root.getElementById("integrationsGrid");
  if (!grid || grid.dataset.initialized) return;
  grid.dataset.initialized = "true";
  const feedback = root.getElementById("integrationsFeedback");
  let selected = new Set();
  try {
    storage ??= window.localStorage;
    const saved = JSON.parse(storage.getItem(STORAGE_KEY) || "[]");
    if (Array.isArray(saved)) selected = new Set(saved.filter(id => INTEGRATIONS.some(item => item.id === id)));
  } catch {
    feedback.textContent = "Não foi possível ler sua lista local. Você ainda pode explorar o catálogo.";
  }
  const search = root.getElementById("integrationsSearch");
  const filter = root.getElementById("integrationsFilter");
  const details = root.getElementById("integrationDetails");
  const element = (tag, className, text) => {
    const node = root.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  function showDetails(item) {
    details.replaceChildren();
    const close = element("button", "ghost-button", "Fechar detalhes");
    close.type = "button";
    close.addEventListener("click", () => {
      details.hidden = true;
      grid.querySelector(`[data-detail-id="${item.id}"]`)?.focus();
    });
    const title = element("h2", "", item.name);
    title.id = "integrationDetailTitle";
    const list = element("ul", "");
    item.capabilities.forEach(text => list.append(element("li", "", text)));
    details.append(close, title, element("p", "integration-status", "Planejado · Sem conexão ativa"),
      element("h3", "", "Possibilidades a implementar"), list,
      element("h3", "", "Antes de conectar"), element("p", "", item.requirements),
      element("h3", "", "Próximo passo"), element("p", "", item.next),
      element("p", "integrations-notice", "Não informe senhas ou tokens aqui. A autenticação será implementada no conector específico."));
    details.hidden = false;
    details.focus();
    details.scrollIntoView({ block: "nearest" });
  }
  function render() {
    const query = normalize(search.value.trim());
    const items = INTEGRATIONS.filter(item =>
      (filter.value !== "selected" || selected.has(item.id)) &&
      normalize([item.name, item.category, item.description, ...item.capabilities].join(" ")).includes(query));
    grid.replaceChildren();
    for (const item of items) {
      const card = element("article", "integration-card");
      card.style.setProperty("--integration-accent", item.color);
      const header = element("div", "integration-card-head");
      const icon = element("span", "integration-monogram", item.initials);
      icon.setAttribute("aria-hidden", "true");
      header.append(icon, element("span", "integration-status", "Planejado"));
      const actions = element("div", "integration-card-actions");
      const detail = element("button", "ghost-button", "Ver detalhes");
      detail.type = "button";
      detail.dataset.detailId = item.id;
      detail.setAttribute("aria-label", `Ver detalhes de ${item.name}`);
      detail.addEventListener("click", () => showDetails(item));
      const prioritize = element("button", "soft-button", selected.has(item.id) ? "Na minha lista" : "Adicionar à lista");
      prioritize.type = "button";
      prioritize.setAttribute("aria-pressed", String(selected.has(item.id)));
      prioritize.setAttribute("aria-label", `Priorizar ${item.name}`);
      prioritize.addEventListener("click", () => {
        const next = new Set(selected);
        next.has(item.id) ? next.delete(item.id) : next.add(item.id);
        try {
          storage.setItem(STORAGE_KEY, JSON.stringify([...next]));
          selected = next;
          render();
          grid.querySelector(`[aria-label="Priorizar ${item.name}"]`)?.focus();
          feedback.textContent = `${item.name}: ${selected.has(item.id) ? "adicionado à" : "removido da"} sua lista. Nenhuma conta foi conectada.`;
        } catch {
          feedback.textContent = "Não foi possível salvar sua escolha neste computador. A lista não foi alterada.";
        }
      });
      actions.append(detail, prioritize);
      card.append(header, element("p", "integration-category", item.category), element("h2", "", item.name), element("p", "integration-description", item.description), actions);
      grid.append(card);
    }
    root.getElementById("integrationsEmpty").hidden = items.length !== 0;
    root.getElementById("integrationsSummary").textContent = `${INTEGRATIONS.length} programas · ${selected.size} na sua lista`;
  }
  search.addEventListener("input", render);
  filter.addEventListener("change", render);
  render();
}

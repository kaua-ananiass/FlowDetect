const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

const statusText = document.getElementById("statusText");
const automationTitle = document.getElementById("automationTitle");
const automationLead = document.getElementById("automationLead");
const percentText = document.getElementById("percentText");
const progressFill = document.getElementById("progressFill");
const badge = document.getElementById("badge");
const delayInput = document.getElementById("delay");
const loopStartInput = document.getElementById("loopStart");
const loopStartHint = document.getElementById("loopStartHint");
const configSummaryText = document.getElementById("configSummaryText");
const startButton = document.getElementById("startButton");
const configButton = document.getElementById("configButton");
const dataButton = document.getElementById("dataButton");
const configModal = document.getElementById("configModal");
const closeConfigModal = document.getElementById("closeConfigModal");
const dataModal = document.getElementById("dataModal");
const closeDataModal = document.getElementById("closeDataModal");
const dataMetaText = document.getElementById("dataMetaText");
const dataValueInput = document.getElementById("dataValueInput");
const dataCompanyInput = document.getElementById("dataCompanyInput");
const addDataButton = document.getElementById("addDataButton");
const dataList = document.getElementById("dataList");
const loopTabButton = document.getElementById("loopTabButton");
const textTabButton = document.getElementById("textTabButton");
const loopTabPanel = document.getElementById("loopTabPanel");
const textTabPanel = document.getElementById("textTabPanel");
const textMetaText = document.getElementById("textMetaText");
const textList = document.getElementById("textList");

let running = false;
let loopDataState = null;
let textInputsState = null;

function applyAutomationConfig(config) {
  const name = String(config?.name || "").trim();
  if (!name) {
    return;
  }
  document.title = name;
  automationTitle.textContent = name;
  automationLead.textContent = "Painel simples para iniciar, configurar e editar a automacao.";
}

function setRunningState(active) {
  running = active;
  startButton.disabled = active;
  configButton.disabled = active;
  dataButton.disabled = active;
  badge.textContent = active ? "running" : "standby";
}

function openDataModal() {
  dataModal.hidden = false;
}

function closeDataPanel() {
  dataModal.hidden = true;
}

function openConfigModal() {
  updateLoopStartHint();
  configModal.hidden = false;
}

function closeConfigPanel() {
  configModal.hidden = true;
}

function setActiveDataTab(tabName) {
  const loopActive = tabName === "loop";
  loopTabButton.classList.toggle("is-active", loopActive);
  textTabButton.classList.toggle("is-active", !loopActive);
  loopTabPanel.hidden = !loopActive;
  textTabPanel.hidden = loopActive;
}

async function refreshLoopData(action) {
  try {
    const payload = await action();
    loopDataState = payload;
    renderLoopData();
  } catch (error) {
    statusText.textContent = String(error);
  }
}

function buildDataCard(row) {
  const item = document.createElement("div");
  item.className = "data-card";

  const top = document.createElement("div");
  top.className = "data-card-top";

  const value = document.createElement("strong");
  value.className = "row-value";
  value.textContent = row.value;
  top.appendChild(value);

  const rowLabel = document.createElement("span");
  rowLabel.className = "data-row-label";
  rowLabel.textContent = `Linha ${row.row_number}`;
  top.appendChild(rowLabel);
  item.appendChild(top);

  const company = document.createElement("p");
  company.className = "data-company";
  company.textContent = row.company || "Empresa nao informada";
  item.appendChild(company);

  const actions = document.createElement("div");
  actions.className = "data-card-actions";

  const moveUpButton = document.createElement("button");
  moveUpButton.className = "soft-button";
  moveUpButton.textContent = "Subir";
  moveUpButton.addEventListener("click", () =>
    refreshLoopData(() =>
      invoke("move_loop_data_row", {
        rowNumber: row.row_number,
        direction: "subir",
      }),
    ),
  );
  actions.appendChild(moveUpButton);

  const moveDownButton = document.createElement("button");
  moveDownButton.className = "soft-button";
  moveDownButton.textContent = "Descer";
  moveDownButton.addEventListener("click", () =>
    refreshLoopData(() =>
      invoke("move_loop_data_row", {
        rowNumber: row.row_number,
        direction: "descer",
      }),
    ),
  );
  actions.appendChild(moveDownButton);

  const removeButton = document.createElement("button");
  removeButton.className = "danger-button";
  removeButton.textContent = "Excluir";
  removeButton.addEventListener("click", () =>
    refreshLoopData(() => invoke("remove_loop_data_row", { rowNumber: row.row_number })),
  );
  actions.appendChild(removeButton);

  item.appendChild(actions);
  return item;
}

function renderLoopData() {
  const payload = loopDataState;
  dataList.innerHTML = "";

  if (!payload) {
    dataMetaText.textContent = "Nenhum dado carregado.";
    updateLoopStartHint();
    return;
  }

  dataMetaText.textContent = `${payload.sheet} - ${payload.column} - ${payload.rows.length} itens`;

  if (!payload.rows.length) {
    const empty = document.createElement("div");
    empty.className = "empty-data";
    empty.textContent = "Nenhum item disponivel para o loop.";
    dataList.appendChild(empty);
    return;
  }

  for (const row of payload.rows) {
    dataList.appendChild(buildDataCard(row));
  }

  updateLoopStartHint();
}

function updateLoopStartHint() {
  const payload = loopDataState;
  if (!payload?.rows?.length) {
    const text = "Nenhum loop de planilha encontrado para calcular a linha inicial.";
    loopStartHint.textContent = text;
    configSummaryText.textContent = text;
    return;
  }

  const requestedLine = Number(loopStartInput.value.replace(",", "."));
  if (!Number.isInteger(requestedLine) || requestedLine < 1) {
    const text = "Informe uma linha inicial valida da planilha.";
    loopStartHint.textContent = text;
    configSummaryText.textContent = text;
    return;
  }

  const resolvedRow = payload.rows.find((row) => Number(row.row_number) >= requestedLine);
  if (!resolvedRow) {
    const lastRow = payload.rows[payload.rows.length - 1];
    const text = `A linha ${requestedLine} nao existe nesse loop. Ultima linha disponivel: ${lastRow.row_number}.`;
    loopStartHint.textContent = text;
    configSummaryText.textContent = text;
    return;
  }

  const company = resolvedRow.company ? ` | ${resolvedRow.company}` : "";
  const text =
    `A execucao vai iniciar na linha ${resolvedRow.row_number}: ${resolvedRow.value}${company}.`;
  loopStartHint.textContent = text;
  configSummaryText.textContent = text;
}

function buildTextCard(item) {
  const card = document.createElement("div");
  card.className = "text-card";

  const header = document.createElement("div");
  header.className = "text-card-top";

  const title = document.createElement("strong");
  title.textContent = `Texto do evento ${item.order}`;
  header.appendChild(title);

  const preview = document.createElement("span");
  preview.textContent = item.preview || "Sem resumo";
  header.appendChild(preview);
  card.appendChild(header);

  const textarea = document.createElement("textarea");
  textarea.className = "text-editor";
  textarea.value = item.text || "";
  card.appendChild(textarea);

  const saveButton = document.createElement("button");
  saveButton.className = "soft-button";
  saveButton.textContent = "Salvar texto";
  saveButton.addEventListener("click", async () => {
    try {
      const payload = await invoke("update_text_input", {
        order: item.order,
        text: textarea.value,
      });
      textInputsState = payload;
      renderTextInputs();
    } catch (error) {
      statusText.textContent = String(error);
    }
  });
  card.appendChild(saveButton);

  return card;
}

function renderTextInputs() {
  const payload = textInputsState;
  textList.innerHTML = "";

  if (!payload) {
    textMetaText.textContent = "Nenhum texto carregado.";
    return;
  }

  textMetaText.textContent = `${payload.items.length} textos livres disponiveis para edicao.`;

  if (!payload.items.length) {
    const empty = document.createElement("div");
    empty.className = "empty-data";
    empty.textContent = "Nenhum texto livre encontrado no roteiro.";
    textList.appendChild(empty);
    return;
  }

  for (const item of payload.items) {
    textList.appendChild(buildTextCard(item));
  }
}

async function loadLoopData() {
  const payload = await invoke("get_loop_data");
  loopDataState = payload;
  renderLoopData();
}

async function loadTextInputs() {
  const payload = await invoke("get_text_inputs");
  textInputsState = payload;
  renderTextInputs();
}

async function boot() {
  await invoke("get_runtime_root");
  try {
    const config = await invoke("get_automation_config");
    applyAutomationConfig(config);
  } catch (_error) {
  }

  try {
    await loadLoopData();
  } catch (error) {
    statusText.textContent = String(error);
    updateLoopStartHint();
  }

  await listen("automation-progress", (event) => {
    const payload = event.payload;
    percentText.textContent = `${Math.round(payload.percent)}%`;
    progressFill.style.width = `${Math.max(0, Math.min(100, payload.percent))}%`;
    statusText.textContent = `Executando ${payload.current}/${payload.total}`;
  });

  await listen("automation-finished", (event) => {
    const payload = event.payload;
    setRunningState(false);
    if (payload.success) {
      badge.textContent = "done";
      percentText.textContent = "100%";
      progressFill.style.width = "100%";
      statusText.textContent = "Concluida";
    } else {
      badge.textContent = "stopped";
      statusText.textContent = "Interrompida";
    }
  });
}

startButton.addEventListener("click", async () => {
  const delay = Number(delayInput.value.replace(",", "."));
  if (Number.isNaN(delay) || delay < 0) {
    statusText.textContent = "Atraso invalido.";
    return;
  }

  const loopStart = Number(loopStartInput.value.replace(",", "."));
  if (!Number.isInteger(loopStart) || loopStart < 1) {
    statusText.textContent = "Linha inicial invalida.";
    return;
  }

  try {
    await invoke("start_automation", {
      mode: "loop",
      delay,
      loopStart,
    });
    setRunningState(true);
    badge.textContent = "running";
    statusText.textContent = "Preparando...";
    percentText.textContent = "0%";
    progressFill.style.width = "0%";
  } catch (error) {
    statusText.textContent = String(error);
  }
});

configButton.addEventListener("click", () => {
  openConfigModal();
});

loopStartInput.addEventListener("input", () => {
  updateLoopStartHint();
});

delayInput.addEventListener("input", () => {
  configSummaryText.textContent = `A automacao vai esperar ${delayInput.value || 0}s antes de iniciar.`;
});

dataButton.addEventListener("click", async () => {
  try {
    await loadLoopData();
    await loadTextInputs();
    setActiveDataTab("loop");
    openDataModal();
  } catch (error) {
    statusText.textContent = String(error);
  }
});

loopTabButton.addEventListener("click", () => setActiveDataTab("loop"));
textTabButton.addEventListener("click", () => setActiveDataTab("text"));

closeDataModal.addEventListener("click", closeDataPanel);
closeConfigModal.addEventListener("click", closeConfigPanel);

dataModal.addEventListener("click", (event) => {
  if (event.target?.dataset?.closeModal === "true") {
    closeDataPanel();
  }
});

configModal.addEventListener("click", (event) => {
  if (event.target?.dataset?.closeConfig === "true") {
    closeConfigPanel();
  }
});

addDataButton.addEventListener("click", async () => {
  const value = dataValueInput.value.trim();
  const company = dataCompanyInput.value.trim();

  if (!value) {
    statusText.textContent = "Informe um valor para adicionar ao loop.";
    return;
  }

  try {
    const payload = await invoke("add_loop_data_value", { value, company });
    loopDataState = payload;
    dataValueInput.value = "";
    dataCompanyInput.value = "";
    renderLoopData();
  } catch (error) {
    statusText.textContent = String(error);
  }
});

boot().catch((error) => {
  statusText.textContent = `Falha ao iniciar UI: ${String(error)}`;
});

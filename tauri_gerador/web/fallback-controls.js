if (window.__GENERATOR_MAIN_READY) {
  console.info("Fallback de controles desativado: interface principal carregada.");
} else {
function fallbackSetText(id, value) {
  const node = document.getElementById(id);
  if (node) {
    node.textContent = value;
  }
}

function fallbackParseNumber(value, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function fallbackIsAssistActive() {
  return document.getElementById("assistPanel")?.classList.contains("is-active");
}

function fallbackEnableTestButtons() {
  [
    "testOnceButton",
    "testAutomationButton",
    "stopTestButton",
    "assistQuickButton",
    "assistLoopButton",
    "assistStopButton",
  ].forEach((id) => {
    const button = document.getElementById(id);
    if (button) {
      button.disabled = false;
      button.style.pointerEvents = "auto";
    }
  });
}

function fallbackMarkClick(button, label) {
  if (!button) {
    return;
  }
  button.dataset.clicked = "1";
  button.textContent = label;
  setTimeout(() => {
    if (button.dataset.clicked === "1") {
      delete button.dataset.clicked;
      if (button.id === "testOnceButton" || button.id === "assistQuickButton") {
        button.textContent = "Testar uma vez";
      } else {
        button.textContent = "Testar com loop";
      }
    }
  }, 1200);
}

function fallbackRunOnce(button, handler, event) {
  event.preventDefault();
  event.stopPropagation();
  if (button?.dataset.launching === "1") {
    return;
  }
  if (button) {
    button.dataset.launching = "1";
    setTimeout(() => {
      delete button.dataset.launching;
    }, 900);
  }
  handler(button);
}

async function fallbackLaunchQuickTest(button = null) {
  const input = fallbackIsAssistActive()
    ? document.getElementById("assistDelayInput")
    : document.getElementById("testDelayInput");
  const delay = Math.max(0, fallbackParseNumber(input?.value, 0));
  fallbackMarkClick(button, "Abrindo teste...");
  fallbackSetText("messageBar", `Fallback: iniciando teste simples com atraso de ${delay}s...`);
  fallbackSetText("builderStatus", "Executando teste");
  fallbackEnableStopButtons(true);
  try {
    const result = await window.__TAURI__.core.invoke("launch_quick_test", { delay });
    fallbackSetText("messageBar", result);
    fallbackSetText("builderStatus", "Pronto");
    fallbackSetText("assistStatusText", "Executando");
    fallbackSetText("assistDetailText", result);
  } catch (error) {
    fallbackSetText("messageBar", String(error));
    fallbackSetText("builderStatus", "Erro");
    fallbackSetText("assistStatusText", "Erro");
    fallbackSetText("assistDetailText", String(error));
    fallbackEnableStopButtons(false);
  }
}

async function fallbackLaunchLoopTest(button = null) {
  const assist = fallbackIsAssistActive();
  const delayInput = assist
    ? document.getElementById("assistDelayInput")
    : document.getElementById("testDelayInput");
  const loopInput = assist
    ? document.getElementById("assistLoopStartInput")
    : document.getElementById("testLoopStartInput");
  const delay = Math.max(0, fallbackParseNumber(delayInput?.value, 0));
  const loopStart = Math.max(1, Math.trunc(fallbackParseNumber(loopInput?.value, 1)));
  fallbackMarkClick(button, "Abrindo loop...");
  fallbackSetText("messageBar", `Fallback: iniciando teste com loop na linha ${loopStart}...`);
  fallbackSetText("builderStatus", "Executando teste");
  fallbackEnableStopButtons(true);
  try {
    const result = await window.__TAURI__.core.invoke("launch_test_automation", {
      delay,
      loopStart,
    });
    fallbackSetText("messageBar", result);
    fallbackSetText("builderStatus", "Pronto");
    fallbackSetText("assistStatusText", "Executando");
    fallbackSetText("assistDetailText", result);
  } catch (error) {
    fallbackSetText("messageBar", String(error));
    fallbackSetText("builderStatus", "Erro");
    fallbackSetText("assistStatusText", "Erro");
    fallbackSetText("assistDetailText", String(error));
    fallbackEnableStopButtons(false);
  }
}

function fallbackEnableStopButtons(active) {
  ["stopTestButton", "assistStopButton"].forEach((id) => {
    const button = document.getElementById(id);
    if (button) {
      button.disabled = !active;
      button.style.pointerEvents = active ? "auto" : "none";
    }
  });
}

async function fallbackStopTest(button = null) {
  fallbackMarkClick(button, "Parando...");
  fallbackSetText("messageBar", "Fallback: solicitando parada da automacao...");
  try {
    const result = await window.__TAURI__.core.invoke("stop_test_execution");
    fallbackSetText("messageBar", result);
    fallbackSetText("builderStatus", "Pronto");
    fallbackSetText("assistStatusText", "Interrompido");
    fallbackSetText("assistDetailText", "Parada solicitada pelo launcher.");
    fallbackEnableStopButtons(false);
  } catch (error) {
    fallbackSetText("messageBar", String(error));
    fallbackSetText("builderStatus", "Erro");
    fallbackSetText("assistStatusText", "Erro");
    fallbackSetText("assistDetailText", String(error));
  }
}

window.handleQuickTestClick = () => fallbackLaunchQuickTest();
window.handleLoopTestClick = () => fallbackLaunchLoopTest();
window.handleStopTestClick = () => fallbackStopTest();

document.addEventListener("DOMContentLoaded", () => {
  fallbackEnableTestButtons();
  fallbackEnableStopButtons(false);

  const bindings = [
    ["testOnceButton", fallbackLaunchQuickTest],
    ["assistQuickButton", fallbackLaunchQuickTest],
    ["testAutomationButton", fallbackLaunchLoopTest],
    ["assistLoopButton", fallbackLaunchLoopTest],
    ["stopTestButton", fallbackStopTest],
    ["assistStopButton", fallbackStopTest],
  ];

  bindings.forEach(([id, handler]) => {
    const button = document.getElementById(id);
    if (!button) {
      return;
    }
    const run = (event) => fallbackRunOnce(button, handler, event);
    button.onclick = run;
    button.addEventListener("pointerdown", run);
    button.addEventListener("click", run);
  });
});
}

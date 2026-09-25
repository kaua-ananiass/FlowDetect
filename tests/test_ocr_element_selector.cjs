const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "../tauri_gerador/web/main.js"), "utf8");
const implementation = source.match(/^function normalizeOcrElementSelector\(.*?^}/ms);
assert.ok(implementation, "Production selector validator");
const valueImplementation = source.match(/^function ocrElementValue\(.*?^}/ms);
assert.ok(valueImplementation, "Production element field reader");
const fieldImplementation = source.match(/^function readOcrElementField\(.*?^}/ms);
assert.ok(fieldImplementation, "Production visible/compact field reader");
const captureImplementation = source.match(/^async function captureOcrElementIntoContainer\(.*?^}/ms);
assert.ok(captureImplementation, "Production click-to-capture flow");

function validator() {
  const context = vm.createContext({
    document: {
      createDocumentFragment: () => ({
        querySelector(selector) {
          if (selector.includes("[invalid")) throw new Error("Invalid CSS");
          return null;
        },
      }),
    },
    DOMParser: class {
      parseFromString() {
        return { body: {
          children: [{}],
          firstElementChild: {
            tagName: "BUTTON",
            getAttribute(name) {
              if (name === "data-test-id") return "headerEmpresaIcone";
              return name === "aria-label" ? "Abrir dados da empresa" : null;
            },
          },
        } };
      }
    },
  });
  vm.runInContext(`${implementation[0]}\n${valueImplementation[0]}\n${fieldImplementation[0]}`, context);
  return context;
}

test("accepts a scoped CSS selector copied from Chrome", () => {
  assert.equal(validator().normalizeOcrElementSelector(" tr[data-cnpj='123'] button.expandir "), "tr[data-cnpj='123'] button.expandir");
});

test("extracts an identifiable element from copied HTML", () => {
  assert.equal(validator().normalizeOcrElementSelector('<button data-test-id="headerEmpresaIcone" aria-label="Abrir dados da empresa"></button>'), 'button[data-test-id="headerEmpresaIcone"]');
});

test("rejects empty, generic and malformed selectors", () => {
  const normalize = validator().normalizeOcrElementSelector;
  assert.throws(() => normalize(""), /Capturar na pagina/);
  assert.throws(() => normalize("button"), /generico/);
  assert.throws(() => normalize("button[invalid"), /CSS valido/);
});

test("prefers the pasted element field when saving the whole map", () => {
  const read = validator().ocrElementValue;
  assert.equal(read({ ocrText: "", ocrElement: '<button data-test-id="headerEmpresaIcone"></button>' }), '<button data-test-id="headerEmpresaIcone"></button>');
});

test("saving a closed card recovers its validated selector from the hidden field", () => {
  const read = validator().readOcrElementField;
  const selector = 'input[data-test-id="tabelaPadraoPaginadaInputCheckSemItens"]';
  const get = (name) => name === "ocrText" ? { value: selector } : null;
  assert.equal(read(get), selector);
  assert.equal(validator().normalizeOcrElementSelector(read(get)), selector);
});

test("click-to-capture fills a unique selector and marks the map draft", async () => {
  const { normalizeOcrElementSelector } = validator();
  const input = { value: "", dispatchEvent() {} };
  const button = { textContent: "Capturar na pagina", disabled: false };
  const container = {
    querySelector: () => input,
    classList: { contains: (name) => name === "command-tree-card" },
  };
  const calls = [];
  let draftSynced = false;
  const context = vm.createContext({
    Event: class { constructor(type) { this.type = type; } },
    state: {},
    normalizeOcrElementSelector,
    chromeAnalysisFromCapturedElement: () => ({
      html_original: '<button data-test-id="headerEmpresaIcone"></button>',
      elemento: { css_selector: "button.header-select-action-btn" },
    }),
    nearestOpenUrlForChromeContainer: () => "",
    chromeWebFriendlyError: (value) => String(value?.message || value),
    syncCommandMapDraftFromCard: () => { draftSynced = true; },
    setBusy() {}, setMessage() {},
    async invoke(command, payload) {
      calls.push({ command, payload });
      if (command === "chrome_web_capture_element") return { ok: true, element: {} };
      if (command === "chrome_web_test_element") return { ok: true };
      throw new Error(`Unexpected ${command}`);
    },
  });
  vm.runInContext(captureImplementation[0], context);

  const selector = await context.captureOcrElementIntoContainer(container, "data-tree-field", button);
  assert.equal(selector, 'button[data-test-id="headerEmpresaIcone"]');
  assert.equal(input.value, selector);
  assert.equal(calls[1].payload.details.require_unique, true);
  assert.equal(draftSynced, true);
  assert.equal(button.disabled, false);
});

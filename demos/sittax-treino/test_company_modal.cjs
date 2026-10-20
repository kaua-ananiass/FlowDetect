const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "painel-contador", "company-modal.js"), "utf8");
new vm.Script(source);
const companies = Array.from({ length: 40 }, (_, index) => ({
  id: "empresa-" + (index + 101),
  company: "Empresa Fictícia " + (index + 101),
  cnpj: "00.000." + (index + 101) + "/0000-00",
  regime: "Simples",
  annex: "Anexo I",
  products: 100,
  services: 200
}));
const elements = new Map();
let fields = [];
class FakeElement {
  constructor() {
    this.events = {};
    this.value = "";
    this.hidden = true;
    this.open = false;
    this.checked = false;
    this.innerHTML = "";
    this.textContent = "";
    this.classList = { toggle() {} };
  }
  addEventListener(type, handler) { (this.events[type] ||= []).push(handler); }
  trigger(type, event = {}) { (this.events[type] || []).forEach(handler => handler(event)); }
  setAttribute() {}
  focus() { this.focused = true; this.trigger("focus"); }
  dispatchEvent(event) { this.trigger(event.type, event); return true; }
  showModal() { this.open = true; }
  close() { this.open = false; this.trigger("close"); }
  querySelector() { return null; }
  querySelectorAll(selector) {
    if (selector === "[data-company-tab]") {
      return ["dados", "certificados", "ecac", "faturamento", "mensagens", "locacao", "sugestoes", "anexo", "servicos"]
        .map(companyTab => ({ dataset: { companyTab }, classList: { toggle() {} }, setAttribute() {} }));
    }
    if (selector === "[data-company-field]") return fields;
    return [];
  }
}
function element(selector) {
  if (!elements.has(selector)) elements.set(selector, new FakeElement());
  return elements.get(selector);
}
const saved = new Map();
const localStorage = {
  getItem(key) { return saved.get(key) || null; },
  setItem(key, value) { saved.set(key, value); },
  removeItem(key) { saved.delete(key); }
};
const document = { querySelector: element, addEventListener() {} };
const window = {};
const notifications = [];
const cleanName = value => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const escapeHtml = value => String(value).replace(/[&<>"']/g, character =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const context = vm.createContext({
  document, window, companies, cleanName, escapeHtml, localStorage, $: element, Event,
  notify(message) { notifications.push(message); }
});
vm.runInContext(source, context);

const html = fs.readFileSync(path.join(__dirname, "painel-contador", "index.html"), "utf8");
assert.ok(!html.includes('id="company-picker-toggle"'));
assert.ok(!html.includes('id="company-options"'));
element("#company-picker-input").value = companies[0].cnpj;
element("#company-picker-input").trigger("input");
element("#open-company-details").trigger("click");
assert.equal(element("#company-modal").open, true);
assert.ok(element("#company-modal-content").innerHTML.includes("Nome fantasia"));
element("#close-company-modal").trigger("click");
assert.equal(element("#company-modal").open, false);
assert.ok(element("#company-picker-input").value.includes(companies[0].cnpj));
element("#clear-company-picker").trigger("click");
assert.equal(element("#company-picker-input").value, "");
assert.equal(element("#company-picker-input").focused, true);
element("#open-company-details").trigger("click");
assert.equal(element("#company-modal").open, false);
window.openCompanyTraining(companies[0]);
function switchTab(companyTab) {
  element("#company-modal").trigger("click", {
    target: { closest: selector => selector === "[data-company-tab]" ? { dataset: { companyTab } } : null }
  });
}
function switchSuggestionTab(suggestionTab) {
  element("#company-modal").trigger("click", {
    target: { closest: selector => selector === "[data-suggestion-tab]" ? { dataset: { suggestionTab } } : null }
  });
}
switchTab("sugestoes");
assert.ok(element("#company-modal-content").innerHTML.includes("Resumo das sugestões"));
assert.ok(!element("#company-modal-content").innerHTML.includes("Nota fictícia NF-20260011"));
switchSuggestionTab("sugestao");
assert.ok(element("#company-modal-content").innerHTML.includes("Nota fictícia NF-20260011"));
assert.ok(element("#company-modal-content").innerHTML.includes("Total de registros: 3"));
element("#company-modal").trigger("change", { target: { id: "select-all-suggestions", checked: true, matches: () => false } });
const saveClick = { target: { closest: selector => selector === "#save-suggestions" ? {} : null } };
element("#company-modal").trigger("click", saveClick);
assert.equal(element("#save-confirmation").open, true);
element("#confirm-save").trigger("click");
assert.equal(element("#save-confirmation").open, false);
assert.ok(element("#company-modal-content").innerHTML.includes("Salva"));
assert.equal(JSON.parse([...saved.values()][0]).suggestions["empresa-101"].length, 3);

window.openCompanyTraining(companies[1]);
assert.ok(element("#company-modal-content").innerHTML.includes("Nome fantasia"));
switchTab("sugestoes");
assert.ok(element("#company-modal-content").innerHTML.includes("Resumo das sugestões"));
switchSuggestionTab("sugestao");
assert.ok(element("#company-modal-content").innerHTML.includes("Nenhum registro encontrado."));
assert.ok(element("#company-modal-content").innerHTML.includes("Total de registros: 0"));
switchTab("certificados");
assert.ok(element("#company-modal-content").innerHTML.includes("Situação do certificado"));
switchTab("sugestoes");
assert.ok(element("#company-modal-content").innerHTML.includes("Resumo das sugestões"));
switchTab("certificados");
fields = [{ dataset: { companyField: "situacao" }, value: "A3 ativo", readOnly: false }];
element("#company-modal").trigger("click", {
  target: { closest: selector => selector === "[data-save-company-tab]" ? {} : null }
});
assert.equal(element("#save-confirmation").open, true);
element("#confirm-save").trigger("click");
assert.equal(JSON.parse([...saved.values()][0]).fields["empresa-102"].certificados.situacao, "A3 ativo");
window.resetCompanyTraining();
assert.equal(saved.size, 0);
assert.equal(element("#company-modal").open, false);
assert.equal(element("#company-picker-input").value, "");
console.log("Ficha da empresa: busca, notas, vazio, confirmação e salvamento local OK.");

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const html = fs.readFileSync(path.join(__dirname, "painel-contador", "index.html"), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, "A página precisa conter o script interativo.");
new vm.Script(script);
for (const id of ["company-search", "company-rows", "issue-strip", "status-tabs", "filter-panel", "batch-menu"]) {
  if (id === "status-tabs") {
    assert.ok(html.includes('class="status-tabs"'));
  } else {
    assert.ok(html.includes(`id="${id}"`), `Controle ausente: ${id}`);
  }
}

const elements = new Map();
function element(selector) {
  if (!elements.has(selector)) {
    elements.set(selector, {
      value: selector === "#regime-filter" ? "todos" : selector === "#sort-order" ? "original" : selector === "#transmitter-filter" ? "Todos" : "",
      hidden: false,
      checked: false,
      innerHTML: "",
      textContent: "",
      classList: { toggle() {} },
      addEventListener() {},
      setAttribute() {},
    });
  }
  return elements.get(selector);
}
element("#competence").value = "ago/2026";
const document = {
  querySelector: element,
  querySelectorAll: () => [],
  addEventListener() {},
};
const registeredTools = [];
document.modelContext = { registerTool(tool) { registeredTools.push(tool); } };
const context = vm.createContext({
  document,
  window: { addEventListener() {} },
  Intl,
  TextEncoder,
  AbortController,
  setTimeout: () => 1,
  clearTimeout() {},
});
vm.runInContext(`${script}\nthis.demo = { companies, filteredCompanies, pdfBytes };`, context);

assert.equal(context.demo.companies.length, 40);
assert.equal(context.demo.companies.filter(company => company.status === "transmitida").length, 30);
assert.equal(context.demo.companies.filter(company => company.status === "pendente").length, 10);
assert.ok(context.demo.companies.every(company => company.cnpj.includes("/0000-00")));
assert.equal(context.demo.filteredCompanies().length, 30);
element("#company-search").value = "Aurora";
assert.equal(context.demo.filteredCompanies().length, 1);
element("#company-search").value = "empresa inexistente";
assert.equal(context.demo.filteredCompanies().length, 0);
element("#company-search").value = "00.000.101";
assert.equal(context.demo.filteredCompanies().length, 1);
const pdf = context.demo.pdfBytes(context.demo.companies[0], "das");
assert.ok(Buffer.from(pdf).toString("ascii").startsWith("%PDF-1.4"));
assert.ok(Buffer.from(pdf).toString("ascii").includes("SEM VALIDADE FISCAL"));
assert.deepEqual(registeredTools.map(tool => tool.name), ["filter_training_companies", "restore_training_companies"]);
const filterTool = registeredTools[0];
const restoreTool = registeredTools[1];
assert.equal(filterTool.execute({ query: "Aurora" }).count, 1);
assert.equal(element("#company-search").value, "Aurora");
assert.throws(() => filterTool.execute({ query: 123 }));
assert.equal(element("#company-search").value, "Aurora");
assert.equal(restoreTool.execute({}).count, 40);
assert.equal(element("#company-search").value, "");
console.log("Página de treino: JavaScript, dados fictícios, busca, PDF e ações opcionais OK.");

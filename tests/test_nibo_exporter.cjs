const assert = require("node:assert/strict");
const { test } = require("node:test");
const { parseCsv, escapeHtml, isOpeningEvent, chooseEntries, dateFromBrazilianText,
  exportMetadata, exportBasename, sessionFolderName, makeControl, controlCounts,
  renderControlCsv, controlFromCsv, renderHtml } = require("../scripts/nibo_exportar_conversas.js");

test("lê IDs do CSV do Nibo sem perder vírgulas e quebras dentro de aspas", () => {
  const rows = parseCsv('ID,Assunto,Cliente\r\n260921-002,"Certificado, renovação","Empresa\nExemplo"\r\n260916-008,Outro,Cliente B\r\n');
  assert.deepEqual(rows.map((row) => row.id), ["260921-002", "260916-008"]);
  assert.equal(rows[0].record.Assunto, "Certificado, renovação");
  assert.equal(rows[0].record.Cliente, "Empresa\nExemplo");
});

test("aceita CSV com ponto e vírgula e ignora IDs repetidos ou inválidos", () => {
  const rows = parseCsv('ID;Assunto\n260921-002;Primeiro\n260921-002;Duplicado\nABC;Inválido\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].record.Assunto, "Primeiro");
});

test("HTML exportado escapa o texto das mensagens e informa mídia ausente", () => {
  const html = renderHtml({
    id: "260921-002", exportedAt: "2026-10-05T10:00:00Z", complete: false,
    messages: [{ direction: "incoming", header: "Cliente", content: '<script>alert("x")</script>', footer: "10:00",
      media: [{ kind: "audio" }] }]
  });
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes('<script>alert("x")</script>'));
  assert.ok(html.includes("Mídia não baixada"));
  assert.equal(escapeHtml('A&B"'), "A&amp;B&quot;");
});

test("histórico só é completo quando o evento de abertura foi encontrado", () => {
  assert.equal(isOpeningEvent({ direction: "event", content: "Atendimento criado\nCliente em 26/05/2026" }), true);
  assert.equal(isOpeningEvent({ direction: "incoming", content: "Atendimento criado" }), false);
  assert.equal(isOpeningEvent({ direction: "event", content: "Atendimento concluído" }), false);
  const html = renderHtml({ id: "260526-007", exportedAt: "2026-10-05", messages: [],
    historyComplete: false, mediaComplete: true, complete: false });
  assert.match(html, /Histórico: INCOMPLETO/);
});

test("permite testar um ID específico do CSV sem repetir os anteriores", () => {
  const entries = [{ id: "260921-002" }, { id: "260526-007" }];
  assert.deepEqual(chooseEntries(entries, 1, "260526-007"), [entries[1]]);
  assert.deepEqual(chooseEntries(entries, 1, ""), [entries[0]]);
  assert.throws(() => chooseEntries(entries, 2, "999999-999"), /fora do CSV/);
});

test("nome e cabeçalho mostram cliente, responsável e data da abertura", () => {
  const record = { Cliente: "São José & Filhos / ME", Responsável: "João Silva", "Atualizado em": "22/06/2026 15:31" };
  const messages = [{ direction: "event", content: "Atendimento criado em 26/05/2026 17:24" }];
  const metadata = exportMetadata(record, messages);
  assert.deepEqual(metadata, { clienteEmpresa: record.Cliente, responsavel: record.Responsável,
    data: "2026-05-26", origemData: "abertura" });
  assert.equal(exportBasename("260526-007", metadata), "2026-05-26__Sao_Jose_Filhos_ME__Joao_Silva__260526-007");
  const html = renderHtml({ id: "260526-007", record, metadata, messages: [], exportedAt: "2026-10-05", complete: true });
  assert.match(html, /São José &amp; Filhos \/ ME/);
  assert.match(html, /João Silva/);
  assert.match(html, /Data \(abertura\): 2026-05-26/);
});

test("sem abertura, data vem identificada como última atualização do CSV", () => {
  assert.equal(dateFromBrazilianText("31/02/2026"), null);
  const metadata = exportMetadata({ Cliente: "Prospect", "Atualizado em": "22/06/2026 15:31" }, []);
  assert.equal(metadata.data, "2026-06-22");
  assert.equal(metadata.origemData, "última atualização do CSV");
});

test("a mesma planilha usa a mesma sessão e controle retoma os IDs pendentes", async () => {
  const entries = [{ id: "260921-002", record: { Cliente: "Empresa A" } },
    { id: "260526-007", record: { Cliente: "=HYPERLINK(\"url\")" } }];
  const folder = await sessionFolderName("CSV de teste", entries.length);
  assert.equal(folder, await sessionFolderName("CSV de teste", entries.length));
  assert.notEqual(folder, await sessionFolderName("CSV alterado", entries.length));
  const control = makeControl(entries, "atendimentos.csv", folder);
  control.items["260921-002"] = { status: "OK", attempts: 1, files: { html: "a.html", json: "a.json" } };
  assert.equal(makeControl(entries, "atendimentos.csv", folder, control), control);
  assert.deepEqual(controlCounts(control), { OK: 1, INCOMPLETO: 0, ERRO: 0, PENDENTE: 1, EM_ANDAMENTO: 0 });
  const csv = renderControlCsv(entries, control);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /"260921-002";"OK";"1"/);
  assert.match(csv, /"'=HYPERLINK/);
  const recovered = controlFromCsv(entries, csv, "atendimentos.csv", folder);
  assert.equal(recovered.items["260921-002"].status, "OK");
  assert.equal(recovered.items["260921-002"].files.html, "a.html");
  assert.equal(recovered.items["260526-007"].status, "PENDENTE");
  assert.throws(() => controlFromCsv(entries.slice(0, 1), csv, "atendimentos.csv", folder), /não correspondem/);
  assert.throws(() => makeControl(entries.slice(0, 1), "atendimentos.csv", folder, control), /não corresponde/);
});

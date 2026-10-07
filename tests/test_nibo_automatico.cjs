const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const core = import("../scripts/nibo_automatico_core.mjs");

test("seleciona só atendimentos atualizados na semana e não repete completos", async () => {
  const { selectWeeklyEntries, weekBounds, renderSourceCsv, parseSourceCsv } = await core;
  const now = new Date(2026, 9, 7, 10);
  assert.equal(weekBounds(now).start.getDate(), 30);
  assert.equal(weekBounds(now, new Date(2026, 9, 5, 9)).start.getDate(), 5);
  const entries = [
    { id: "261005-001", record: { ID: "261005-001", "Atualizado em": "05/10/2026 09:00", Cliente: "A" } },
    { id: "261006-002", record: { ID: "261006-002", "Atualizado em": "06/10/2026 12:00", Cliente: "B" } },
    { id: "260929-003", record: { ID: "260929-003", "Atualizado em": "29/09/2026 15:00", Cliente: "C" } },
    { id: "261007-004", record: { ID: "261007-004", "Atualizado em": "sem data", Cliente: "D" } }
  ];
  const completed = new Map([["261005-001", { stamp: "05/10/2026 09:00" }]]);
  const result = selectWeeklyEntries(entries, completed, now);
  assert.deepEqual(result.selected.map(({ id }) => id), ["261006-002"]);
  assert.deepEqual(result.summary, { outsidePeriod: 1, missingDate: 1, alreadyComplete: 1 });
  assert.deepEqual(parseSourceCsv(renderSourceCsv(result.selected)).map(({ id }) => id), ["261006-002"]);
  const updated = selectWeeklyEntries(entries, new Map([["261005-001", { stamp: "05/10/2026 08:00" }]]), now);
  assert.ok(updated.selected.some(({ id }) => id === "261005-001"));
});

test("último relatório concluído define início da busca; falhas não avançam o período", async () => {
  const { lastSuccessfulRun } = await core;
  const destination = await fs.mkdtemp(path.join(os.tmpdir(), "nibo-last-run-"));
  try {
    const reports = path.join(destination, "relatorios_nibo");
    await fs.mkdir(reports);
    await fs.writeFile(path.join(reports, "execucao_1.json"), JSON.stringify({ status: "CONCLUIDO", finishedAt: "2026-10-01T12:00:00Z" }));
    await fs.writeFile(path.join(reports, "execucao_2.json"), JSON.stringify({ status: "PENDENCIAS", finishedAt: "2026-10-05T12:00:00Z" }));
    assert.equal((await lastSuccessfulRun(destination)).toISOString(), "2026-10-01T12:00:00.000Z");
  } finally { await fs.rm(destination, { recursive: true, force: true }); }
});

test("índice só considera arquivos completos e existentes", async () => {
  const { completedIndex } = await core;
  const destination = await fs.mkdtemp(path.join(os.tmpdir(), "nibo-weekly-"));
  try {
    const batch = path.join(destination, "Nibo_Conversas_teste");
    await fs.mkdir(batch);
    await fs.writeFile(path.join(batch, "controle.json"), JSON.stringify({ items: {
      "261005-001": { status: "OK", complete: true, files: { json: "a.json", html: "a.html" } },
      "261005-002": { status: "OK", complete: false, files: { json: "b.json", html: "b.html" } },
      "261005-003": { status: "OK", complete: true, files: { json: "missing.json", html: "missing.html" } }
    } }));
    await fs.writeFile(path.join(batch, "a.json"), JSON.stringify({ exportedAt: "2026-10-07T10:00:00Z",
      record: { "Atualizado em": "05/10/2026 09:00" } }));
    await fs.writeFile(path.join(batch, "a.html"), "<html>Conversa</html>");
    await fs.writeFile(path.join(batch, "b.json"), "{}");
    await fs.writeFile(path.join(batch, "b.html"), "<html></html>");
    const index = await completedIndex(destination);
    assert.deepEqual([...index.keys()], ["261005-001"]);
    assert.equal(index.get("261005-001").stamp, "05/10/2026 09:00");
  } finally { await fs.rm(destination, { recursive: true, force: true }); }
});

test("ponte de arquivos mantém leitura/gravação dentro do destino", async () => {
  const { createFileBridge } = await core;
  const destination = await fs.mkdtemp(path.join(os.tmpdir(), "nibo-bridge-"));
  try {
    const bridge = await createFileBridge(destination);
    await bridge({ action: "directory", parts: ["Nibo_Conversas_teste"], create: true });
    await bridge({ action: "write", parts: ["Nibo_Conversas_teste", "controle.json"],
      encoding: "utf8", content: '{"ok":true}' });
    const data = await bridge({ action: "read", parts: ["Nibo_Conversas_teste", "controle.json"] });
    assert.equal(data.text, '{"ok":true}');
    assert.equal(data.size, 11);
    assert.equal((await bridge({ action: "file", parts: ["Nibo_Conversas_teste", "ausente.json"] })).error, "NotFoundError");
    await assert.rejects(bridge({ action: "write", parts: ["..", "fora.json"], content: "x" }), /Nibo_Conversas/);
    await assert.rejects(bridge({ action: "read", parts: ["segredo.json"] }), /Nibo_Conversas/);
  } finally { await fs.rm(destination, { recursive: true, force: true }); }
});

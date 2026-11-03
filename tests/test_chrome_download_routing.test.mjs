import assert from "node:assert/strict";
import { test } from "node:test";

const session = {};
const local = {};
let determining;
let changed;
let removed = [];
const downloads = [{ id: 42, tabId: 7, filename: "C:\\Downloads\\FlowDetect-Temporario\\11111111-1111-4111-8111-111111111111\\guia.pdf" }];
globalThis.chrome = {
  downloads: {
    onDeterminingFilename: { addListener: (listener) => { determining = listener; } },
    onChanged: { addListener: (listener) => { changed = listener; } },
    download: async () => 90,
    search: async ({ id }) => downloads.filter((item) => item.id === id),
    removeFile: async (id) => { removed.push(id); },
  },
  storage: {
    session: {
      get: async (key) => ({ [key]: session[key] }),
      set: async (items) => Object.assign(session, items),
      remove: async (key) => { delete session[key]; },
    },
    local: { set: async (items) => Object.assign(local, items) },
  },
};

const routing = await import("../flowdetect_chrome/download-routing.js");
const routeId = "11111111-1111-4111-8111-111111111111";
const bytes = new TextEncoder().encode("conteudo da guia");
let savedBytes = [];
let savedName = "";
const stage = {
  kind: "directory", name: routing.STAGE_FOLDER,
  queryPermission: async () => "granted",
  isSameEntry: async () => false,
  getFileHandle: async (name) => {
    assert.equal(name, routing.STAGE_MARKER);
    return { getFile: async () => ({ text: async () => routing.STAGE_CONTENT }) };
  },
  getDirectoryHandle: async (name) => {
    assert.equal(name, routeId);
    return { getFileHandle: async (filename) => {
      assert.equal(filename, "guia.pdf");
      return { getFile: async () => ({
        size: bytes.length,
        stream: () => new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } }),
      }) };
    } };
  },
};
const destination = {
  kind: "directory", name: "Guias da semana",
  queryPermission: async () => "granted",
  getFileHandle: async (name, options) => {
    if (!options?.create) throw new DOMException("not found", "NotFoundError");
    savedName = name;
    return {
      createWritable: async () => new WritableStream({
        write(chunk) { savedBytes.push(...chunk); },
      }),
      getFile: async () => ({ size: savedBytes.length }),
    };
  },
};
globalThis.FlowDetectDownloadFolders = {
  get: async (key) => key === "stage" ? stage : key === `destination:${routeId}` ? destination : null,
};

test("sends only this run's tab downloads to its chosen folder", async () => {
  await routing.activateDownloadRoute(routeId, 7, "run-1");
  const unrelated = await new Promise((resolve) => {
    determining({ id: 41, tabId: 8, filename: "outro.pdf" }, resolve);
  });
  assert.equal(unrelated, undefined);
  const suggestion = await new Promise((resolve) => {
    determining({ id: 42, tabId: 7, filename: "guia.pdf" }, resolve);
  });
  assert.equal(suggestion.filename, `FlowDetect-Temporario/${routeId}/guia.pdf`);
  changed({ id: 42, state: { current: "complete" } });
  for (let attempt = 0; attempt < 40 && local.flowdetectDownloadStatus?.status !== "saved"; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(local.flowdetectDownloadStatus?.status, "saved");
  assert.equal(savedName, "guia.pdf");
  assert.deepEqual(savedBytes, [...bytes]);
  assert.deepEqual(removed, [42]);
  assert.equal(session["flowdetectRoutedDownload:42"], undefined);
});

test("keeps failed copies in the temporary folder", async () => {
  removed = [];
  const broken = { ...destination, getFileHandle: async () => { throw new Error("rede indisponivel"); } };
  globalThis.FlowDetectDownloadFolders.get = async (key) => key === "stage" ? stage : key === `destination:${routeId}` ? broken : null;
  const suggestion = await new Promise((resolve) => {
    determining({ id: 42, tabId: 7, filename: "guia.pdf" }, resolve);
  });
  assert.ok(suggestion.filename.endsWith("guia.pdf"));
  changed({ id: 42, state: { current: "complete" } });
  for (let attempt = 0; attempt < 40 && local.flowdetectDownloadStatus?.status !== "error"; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(local.flowdetectDownloadStatus?.status, "error");
  assert.match(local.flowdetectDownloadStatus.detail, /original não foi apagado/);
  assert.deepEqual(removed, []);
});

test("a later normal run cannot inherit the previous destination", async () => {
  await routing.deactivateDownloadRoute("run-1");
  assert.ok(session["flowdetectActiveDownloadRoute:tab:7"].acceptUntil > Date.now());
  await routing.clearDownloadRouteForTab(7);
  const suggestion = await new Promise((resolve) => {
    determining({ id: 43, tabId: 7, filename: "nova-guia.pdf" }, resolve);
  });
  assert.equal(suggestion, undefined);
  assert.equal(session["flowdetectRoutedDownload:43"], undefined);
});

test("simultaneous tabs keep distinct destinations and stopping one does not stop routing the other", async () => {
  const secondRoute = '22222222-2222-4222-8222-222222222222';
  globalThis.FlowDetectDownloadFolders.get = async key => key === 'stage' ? stage : destination;
  await Promise.all([routing.activateDownloadRoute(routeId, 7, 'run-a'), routing.activateDownloadRoute(secondRoute, 8, 'run-b')]);
  const suggest = (id, tabId) => new Promise(resolve => determining({ id, tabId, filename: 'guia.pdf' }, resolve));
  const [a, b] = await Promise.all([suggest(71, 7), suggest(81, 8)]);
  assert.equal(a.filename, `FlowDetect-Temporario/${routeId}/guia.pdf`);
  assert.equal(b.filename, `FlowDetect-Temporario/${secondRoute}/guia.pdf`);
  await routing.deactivateDownloadRoute('run-a');
  await routing.clearDownloadRouteForTab(7);
  assert.equal(await suggest(72, 7), undefined);
  assert.equal((await suggest(82, 8)).filename, b.filename);
  assert.equal(session['flowdetectActiveDownloadRoute:tab:8'].active, true);
  assert.equal(local[`flowdetectDownloadStatus:${routeId}`].routeId, routeId);
  assert.equal(local[`flowdetectDownloadStatus:${secondRoute}`].routeId, secondRoute);
});

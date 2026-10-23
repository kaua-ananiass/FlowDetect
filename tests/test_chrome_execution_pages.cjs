const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const worker = fs.readFileSync(path.join(__dirname, '../flowdetect_chrome/service_worker.js'), 'utf8');
const panel = fs.readFileSync(path.join(__dirname, '../flowdetect_chrome/sidepanel.js'), 'utf8');
const fn = (source, name) => source.match(new RegExp(`^(?:async )?function ${name}\\(.*?^}`, 'ms'))[0];
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test('two different pages run concurrently; duplicate tab/page and third run are refused', async () => {
  const pages = [1, 2, 3].map(id => ({ id: `p${id}`, tabId: id }));
  const gates = new Map(pages.map(p => [p.tabId, deferred()]));
  const entered = [];
  const ctx = vm.createContext({
    getPages: async () => pages, reservedTabs: new Set(), reservedPages: new Set(),
    executeAutomationOnPage: async (_, tabId) => { entered.push(tabId); await gates.get(tabId).promise; return tabId; },
  });
  vm.runInContext(fn(worker, 'executeAutomation'), ctx);
  const start = (tab, id = `p${tab}`) => ctx.executeAutomation({}, tab, 1, null, [], null, id);
  const first = start(1), second = start(2);
  await new Promise(setImmediate);
  assert.deepEqual(entered, [1, 2]);
  await assert.rejects(start(1), /Já existe/);
  await assert.rejects(start(3), /Duas execuções/);
  await assert.rejects(start(3, 'p1'), /não corresponde/);
  gates.get(1).resolve(); await first;
  assert.equal(ctx.reservedTabs.has(2), true);
  const third = start(3); await new Promise(setImmediate);
  assert.deepEqual(entered, [1, 2, 3]);
  gates.get(2).resolve(); gates.get(3).resolve(); await Promise.all([second, third]);
  assert.equal(ctx.reservedTabs.size, 0); assert.equal(ctx.reservedPages.size, 0);
});

test('failed preflight releases the page and tab reservations', async () => {
  const ctx = vm.createContext({ getPages: async () => [{ id: 'p1', tabId: 1 }],
    reservedTabs: new Set(), reservedPages: new Set(), executeAutomationOnPage: async () => { throw Error('Tela errada'); } });
  vm.runInContext(fn(worker, 'executeAutomation'), ctx);
  await assert.rejects(ctx.executeAutomation({}, 1, 1, null, [], null, 'p1'), /Tela errada/);
  assert.equal(ctx.reservedTabs.size, 0); assert.equal(ctx.reservedPages.size, 0);
});

test('stop affects only the addressed execution, not another tab', async () => {
  const a = { id: 'r1', pageId: 'p1' }, b = { id: 'r2', pageId: 'p2' };
  const ctx = vm.createContext({ activeRuns: new Map([['r1', a], ['r2', b]]), addLog: async () => {} });
  vm.runInContext(fn(worker, 'handleMessage'), ctx);
  assert.equal((await ctx.handleMessage({ type: 'flowdetect-stop', runId: 'r1', pageId: 'p2' })).stopped, false);
  assert.equal((await ctx.handleMessage({ type: 'flowdetect-stop' })).stopped, false);
  assert.equal((await ctx.handleMessage({ type: 'flowdetect-stop', runId: 'r1', pageId: 'p1' })).stopped, true);
  assert.equal(a.cancelled, true); assert.equal(b.cancelled, undefined);
});

test('active pages cannot be rebound and restarted workers preserve completed history', async () => {
  const storage = {
    'flowdetectChromeExecutionPages': [{ id: 'p1', tabId: 1 }, { id: 'p2', tabId: 2 }],
    'flowdetectChromePageRun:p1': { id: 'r1', pageId: 'p1', status: 'running' },
    'flowdetectChromePageRun:p2': { id: 'r2', pageId: 'p2', status: 'completed', logs: ['saved'] },
  };
  const ctx = vm.createContext({ PAGE_RUN_PREFIX: 'flowdetectChromePageRun:', PAGES_KEY: 'flowdetectChromeExecutionPages',
    getPages: async () => [{ id: 'p1', tabId: 1 }, { id: 'p2', tabId: 2 }],
    ensureAutomationPageOwnership: async () => [],
    activeRuns: new Map(), reservedPages: new Set(['p1']), reservedTabs: new Set([1]),
    chrome: { storage: { local: { get: async key => ({ [key]: storage[key] }), set: async values => Object.assign(storage, values) } } },
  });
  vm.runInContext(fn(worker, 'handleMessage'), ctx);
  await assert.rejects(ctx.handleMessage({ type: 'flowdetect-page-bind', pageId: 'p1', tabId: 3 }), /Pare a execução/);
  let state = await ctx.handleMessage({ type: 'flowdetect-pages' });
  assert.equal(state.runs.p1.status, 'running');
  ctx.reservedPages.clear(); ctx.reservedTabs.clear();
  state = await ctx.handleMessage({ type: 'flowdetect-pages' });
  assert.equal(state.runs.p1.status, 'stopped');
  assert.equal(state.runs.p2.status, 'completed');
  assert.deepEqual(state.runs.p2.logs, ['saved']);
});

test('run persistence uses independent page keys', async () => {
  const storage = {};
  const ctx = vm.createContext({ PAGE_RUN_PREFIX: 'page:', updateSpreadsheetProgress: () => {}, updateProgressBadge: async () => {},
    chrome: { storage: { local: { set: async values => Object.assign(storage, values) } } } });
  vm.runInContext(fn(worker, 'persistRun'), ctx);
  await Promise.all([ctx.persistRun({ id: 'r1', pageId: 'p1', logs: ['first'] }), ctx.persistRun({ id: 'r2', pageId: 'p2', logs: ['second'] })]);
  assert.equal(storage['page:p1'].id, 'r1'); assert.equal(storage['page:p2'].id, 'r2');
});

test('receiving another page progress never switches the selected execution', () => {
  let renders = 0;
  const ctx = vm.createContext({ selectedPageId: 'p1', currentRun: { id: 'r1', pageId: 'p1', status: 'running' },
    pageRuns: new Map(), renderExecutionPages: () => {}, renderAutomations: () => { renders++; },
    refreshDownloadActivity: () => {}, hasFinishedRun: () => false });
  vm.runInContext(fn(panel, 'updateRun'), ctx);
  ctx.updateRun({ id: 'r2', pageId: 'p2', status: 'completed' });
  assert.equal(ctx.currentRun.id, 'r1'); assert.equal(renders, 0);
  assert.equal(ctx.pageRuns.get('p2').status, 'completed');
  ctx.updateRun({ id: 'r1', pageId: 'p1', status: 'running', currentStep: 3 });
  assert.equal(ctx.currentRun.currentStep, 3); assert.equal(renders, 1);
});

test('page creation and deletion are serialized, preserve colors and reject duplicate tab bindings', async () => {
  const storage = {};
  let serial = 0;
  const source = fs.readFileSync(path.join(__dirname, '../flowdetect_chrome/execution-pages.js'), 'utf8').replace(/^export /gm, '');
  const ctx = vm.createContext({ crypto: { randomUUID: () => `p${++serial}` },
    chrome: { tabs: { get: async id => ({ id, title: `Site ${id}`, url: id === 0 ? 'chrome://extensions' : 'https://site.test' }) },
      storage: { local: { get: async key => ({ [key]: structuredClone(storage[key]) }), set: async value => Object.assign(storage, structuredClone(value)) } } } });
  vm.runInContext(source, ctx);
  const [first, second] = await Promise.all([ctx.createPage(null), ctx.createPage(null)]);
  assert.notEqual(first.id, second.id);
  assert.equal(first.slot, 1);
  assert.equal(second.slot, 2);
  assert.equal(first.color, '#12b5cb');
  assert.equal(second.color, '#8b5cf6');
  assert.equal((await ctx.getPages()).length, 2);
  await ctx.bindPage(first.id, 1);
  await ctx.bindPage(second.id, 2);
  await assert.rejects(ctx.bindPage(first.id, 2), /outra página/);
  await assert.rejects(ctx.createPage(0), /Abra uma aba/);
  await assert.rejects(ctx.createPage(2), /já está vinculada/);
  const deleted = await ctx.deletePage(first.id);
  assert.equal(deleted.id, first.id);
  assert.equal((await ctx.getPages()).length, 1);
  const next = await ctx.createPage(null);
  assert.equal(next.slot, 1);
  assert.equal(next.color, '#12b5cb');
});

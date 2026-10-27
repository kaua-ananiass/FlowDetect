const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'flowdetect_chrome', 'service_worker.js'), 'utf8');
const extensionDir = path.join(__dirname, '..', 'flowdetect_chrome');
const studioBridge = fs.readFileSync(path.join(__dirname, '..', 'tauri_gerador', 'src-tauri', 'src', 'chrome_test_bridge.rs'), 'utf8');

test('Studio and extension require the same bridge version', () => {
  const manifestVersion = JSON.parse(fs.readFileSync(path.join(extensionDir, 'manifest.json'), 'utf8')).version;
  const content = fs.readFileSync(path.join(extensionDir, 'content.js'), 'utf8');
  const sidepanel = fs.readFileSync(path.join(extensionDir, 'sidepanel.js'), 'utf8');
  assert.equal(source.match(/const RUNTIME_VERSION = "([^"]+)"/)[1], manifestVersion);
  assert.equal(source.match(/const CONTENT_RUNTIME_VERSION = "([^"]+)"/)[1], manifestVersion);
  assert.equal(content.match(/const CONTENT_RUNTIME_VERSION = "([^"]+)"/)[1], manifestVersion);
  assert.equal(sidepanel.match(/const REQUIRED_RUNTIME_VERSION = "([^"]+)"/)[1], manifestVersion);
  assert.equal(studioBridge.match(/const EXTENSION_VERSION: &str = "([^"]+)"/)[1], manifestVersion);
});
const begin = source.indexOf('async function importStudioAutomation(job)');
const end = source.indexOf('\nfunction startStudioTestBridge()', begin);
assert.ok(begin >= 0 && end > begin, 'importador do Studio deve existir no service worker');
const importer = source.slice(begin, end);
const pairBegin = source.indexOf('function newPairCode()');
const pairEnd = source.indexOf('\nasync function runStudioRecognitionTest(job)', pairBegin);
assert.ok(pairBegin >= 0 && pairEnd > pairBegin, 'gerador de codigo deve existir');
const pairFunctions = source.slice(pairBegin, pairEnd);

function makeImporter(initial = []) {
  let stored = initial;
  const context = {
    AUTOMATIONS_KEY: 'flowdetectChromeAutomations',
    chosenAutomationPageId: async () => 'page-1',
    crypto: { randomUUID: () => 'new-unique-id' },
    chrome: { storage: { local: {
      get: async () => ({ flowdetectChromeAutomations: stored }),
      set: async (value) => { stored = value.flowdetectChromeAutomations; },
    } } },
  };
  const run = vm.runInNewContext(`${importer}\nimportStudioAutomation`, context);
  return { run, get stored() { return stored; } };
}

test('Studio transfer imports a new copy without replacing existing automations', async () => {
  const bridge = makeImporter([{ id: 'existing-id', automation: { nome: 'Existente' } }]);
  const result = await bridge.run({ id: 'transfer-1', automation: {
    schema: 'flowdetect_chrome_automation', version: 3,
    automation: { nome: 'Nova' }, steps: [{ type: 'ocr_text' }],
  } });
  assert.equal(result.ok, true);
  assert.equal(result.steps, 1);
  assert.equal(bridge.stored.length, 2);
  assert.equal(bridge.stored[0].id, 'existing-id');
  assert.equal(bridge.stored[1].id, 'new-unique-id');
  assert.equal(bridge.stored[1].studioTransferId, 'transfer-1');
  await bridge.run({ id: 'transfer-1', automation: {
    schema: 'flowdetect_chrome_automation', version: 3,
    automation: { nome: 'Nova' }, steps: [{ type: 'ocr_text' }],
  } });
  assert.equal(bridge.stored.length, 2, 'retry must not create a duplicate');
});

test('Studio transfer rejects malformed payload without changing storage', async () => {
  const bridge = makeImporter([]);
  const result = await bridge.run({ automation: { schema: 'invalid', version: 3, steps: [] } });
  assert.equal(result.ok, false);
  assert.equal(bridge.stored.length, 0);
});

test('extension keeps a six-digit code, including leading zero, until regenerated', async () => {
  let stored = {};
  const context = {
    PAIR_CODE_KEY: 'flowdetectStudioPairCode',
    pairCodePromise: null,
    studioConnection: { paired: false, phase: 'offline' },
    Uint32Array,
    crypto: { getRandomValues: (bytes) => { bytes[0] = 42; return bytes; } },
    chrome: { storage: { local: {
      get: async () => stored,
      set: async (value) => { stored = { ...stored, ...value }; },
    } } },
  };
  const get = vm.runInNewContext(`${pairFunctions}\ngetPairCode`, context);
  assert.equal(await get(), '000042');
  assert.equal(await get(), '000042');
  assert.equal(stored.flowdetectStudioPairCode, '000042');
});

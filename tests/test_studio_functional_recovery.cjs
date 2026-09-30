const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { test } = require("node:test");

const web = path.resolve(__dirname, "../tauri_gerador/web");
const main = fs.readFileSync(path.join(web, "main.js"), "utf8");
const index = fs.readFileSync(path.join(web, "index.html"), "utf8");
const browser = [process.env.FLOWDETECT_TEST_BROWSER,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find(file => file && fs.existsSync(file));

test("Studio removes standalone Mouse/Chrome blocks but preserves OCR and remote control", () => {
  assert.doesNotMatch(index, /id="(?:addMouseButton|captureMouseButton|addChromeHtmlButton)"/);
  assert.doesNotMatch(main, /data-insert-type="(?:mouse|chrome)"/);
  assert.doesNotMatch(main, /invoke\("(?:capture_mouse_click|(?:add|insert|update)_(?:mouse|chrome_html)_block)"/);
  assert.match(main, /invoke\("chrome_web_capture_element"/);
  assert.match(main, /invoke\("chrome_web_test_element"/);
  assert.match(main, /invoke\("chrome_web_open_site"/);
  assert.match(index, /studio-control-input-toggle/);
  assert.doesNotMatch(index, /design-system-theme\.css|design-system\.js/);
});

test("Studio loads with the original styles and preserves expanded and compact OCR waits", {
  skip: !browser && "Install Chrome/Edge or set FLOWDETECT_TEST_BROWSER", timeout: 35000,
}, async () => {
  const errors = [], pending = new Map();
  let child, socket, id = 0;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "flowdetect-studio-functional-"));
  const exported = ["renderOcrTargetRows", "renderOcrTargetActionRows", "ocrTargetLayoutsFromContainer",
    "syncOcrTargetActionRows", "setCommandCardOcrRouteDelay", "syncOcrTargetActionControlToSource",
    "applyOcrTargetActionChoice", "relativeOcrInvokeArgs", "renderCommandMapTreeDelayControl", "createInsertPanelState",
    "insertValuesFromPanel", "state"];
  // Instrument only the served copy; the production module exposes no test API.
  const instrumented = main.replace(/\nboot\(\);\r?\n}\s*$/,
    `\nwindow.__functionalQA = {${exported.join(",")}};\nboot();\n}`);
  assert.notEqual(instrumented, main);
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const file = path.resolve(web, "." + (pathname === "/" ? "/index.html" : pathname));
    if (!file.startsWith(web + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404); res.end(); return;
    }
    const type = {".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".svg": "image/svg+xml"};
    res.setHeader("Content-Type", (type[path.extname(file)] || "application/octet-stream") + "; charset=utf-8");
    res.end(file === path.join(web, "main.js") ? instrumented : fs.readFileSync(file));
  });
  try {
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    child = spawn(browser, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
      "--disable-background-networking", "--remote-debugging-port=0", "--remote-debugging-address=127.0.0.1",
      "--user-data-dir=" + profile, "about:blank"], {windowsHide: true, stdio: ["ignore", "ignore", "pipe"]});
    const endpoint = await new Promise((resolve, reject) => {
      let stderr = "";
      const timer = setTimeout(() => reject(new Error("Browser startup timeout")), 10000);
      child.once("error", error => {clearTimeout(timer); reject(error);});
      child.stderr.on("data", data => {
        stderr += data;
        const match = stderr.match(/DevTools listening on (ws:\/\/\S+)/);
        if (match) {clearTimeout(timer); resolve(match[1]);}
      });
    });
    socket = new WebSocket(endpoint);
    await new Promise((resolve, reject) => {socket.onopen = resolve; socket.onerror = reject;});
    socket.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails);
      const request = pending.get(message.id);
      if (request) {
        pending.delete(message.id);
        message.error ? request.reject(new Error(JSON.stringify(message.error))) : request.resolve(message.result);
      }
    };
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const requestId = ++id;
      const timer = setTimeout(() => {pending.delete(requestId); reject(new Error("CDP timeout: " + method));}, 10000);
      pending.set(requestId, {resolve: value => {clearTimeout(timer); resolve(value);},
        reject: error => {clearTimeout(timer); reject(error);}});
      socket.send(JSON.stringify({id: requestId, method, params, ...(sessionId ? {sessionId} : {})}));
    });
    const {targetId} = await send("Target.createTarget", {url: "about:blank"});
    const {sessionId} = await send("Target.attachToTarget", {targetId, flatten: true});
    const cdp = (method, params) => send(method, params, sessionId);
    await cdp("Runtime.enable"); await cdp("Page.enable");
    await cdp("Page.addScriptToEvaluateOnNewDocument", {source: `
      window.__TAURI__ = {core: {invoke: async () => {throw new Error('Native bridge disabled in regression test');}},
        event: {listen: async () => () => {}}};`});
    await cdp("Page.navigate", {url: `http://127.0.0.1:${server.address().port}/`});
    const evaluate = async expression => {
      const response = await cdp("Runtime.evaluate", {expression, returnByValue: true, awaitPromise: true});
      assert.equal(response.exceptionDetails, undefined, JSON.stringify(response.exceptionDetails));
      return response.result.value;
    };
    const deadline = Date.now() + 10000;
    while (!await evaluate("Boolean(window.__functionalQA) && document.readyState === 'complete'")) {
      assert.ok(Date.now() < deadline, "Studio failed to initialize: " + JSON.stringify(errors));
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const result = await evaluate(`(() => {
      const qa = window.__functionalQA, checks = [];
      const check = (name, ok) => {if (!ok) throw new Error(name); checks.push(name);};
      check('original stylesheet loaded', [...document.styleSheets].some(s => s.href?.endsWith('/style.css')));
      check('obsolete composers absent', !document.querySelector('#addMouseButton, #addChromeHtmlButton'));
      const layout = {texto:'Empresa',offsetX:4,offsetY:8,width:140,height:40,action:'confirmar_ir_para_bloco',
        block:'7',clicks:1,failureAction:'ir_para_bloco',failureBlock:'9',successDelay:1.5,failureDelay:2.4};
      const card = document.createElement('div');
      card.className = 'command-tree-card'; card.dataset.order = '3';
      card.innerHTML = qa.renderOcrTargetRows('data-tree-field','data-tree-action','Empresa',[layout])
        + qa.renderOcrTargetActionRows({texto_ocr_busca:'Empresa',ocr_target_layouts:[layout]})
        + '<input data-ocr-target-layouts type="hidden" />';
      card.querySelector('[data-ocr-target-layouts]').value = JSON.stringify([layout]);
      document.body.append(card); qa.syncOcrTargetActionRows(card);
      let saved = qa.ocrTargetLayoutsFromContainer(card)[0];
      check('expanded card preserves both waits', saved.successDelay===1.5 && saved.failureDelay===2.4);
      const control = card.querySelector('[data-ocr-target-action-control="successDelay"]');
      control.value = '3.5'; qa.syncOcrTargetActionControlToSource(control);
      saved = qa.ocrTargetLayoutsFromContainer(card)[0];
      check('expanded edit updates only selected wait', saved.successDelay===3.5 && saved.failureDelay===2.4);
      check('route label edits expanded source and control', qa.setCommandCardOcrRouteDelay(card,0,'failure',4.2)
        && qa.ocrTargetLayoutsFromContainer(card)[0].failureDelay===4.2
        && card.querySelector('[data-ocr-target-action-control="failureDelay"]').value==='4.2');
      const payload = qa.relativeOcrInvokeArgs({ocrTargetLayouts:qa.ocrTargetLayoutsFromContainer(card)});
      const serialized = JSON.parse(payload.ocrTargetLayouts)[0];
      check('native payload includes waits and geometry', serialized.successDelay===3.5 && serialized.failureDelay===4.2
        && serialized.offsetX===4 && serialized.width===140);
      const oneClick = card.querySelector('[data-ocr-target-action-choice="clickChoice"][data-ocr-target-action-value="single"]');
      qa.applyOcrTargetActionChoice(oneClick);
      check('explicit one-click choice persists in the saved target',
        qa.ocrTargetLayoutsFromContainer(card)[0].action==='clicar_ir_para_bloco');
      card.innerHTML = '<input data-ocr-target-layouts type="hidden" />';
      card.querySelector('input').value = JSON.stringify([serialized]);
      qa.setCommandCardOcrRouteDelay(card,0,'success',6);
      saved = qa.ocrTargetLayoutsFromContainer(card)[0];
      check('compact edit preserves other fields', saved.successDelay===6 && saved.failureDelay===4.2
        && saved.texto==='Empresa' && saved.block==='7' && saved.offsetY===8);
      check('invalid target leaves layout intact', !qa.setCommandCardOcrRouteDelay(card,2,'success',10)
        && qa.ocrTargetLayoutsFromContainer(card).length===1);
      qa.setCommandCardOcrRouteDelay(card,0,'success',-10);
      check('negative delay is clamped', qa.ocrTargetLayoutsFromContainer(card)[0].successDelay===0);
      const originalInsertPanel = qa.state.insertPanel;
      qa.state.insertPanel = {...qa.createInsertPanelState(1,'after'),type:'image',
        recognitionMode:'texto_ocr',ocrTargetLayouts:[{action:'clicar',clicks:1}]};
      const compactCreate = document.createElement('div');
      compactCreate.className = 'insert-card-panel is-compact-create';
      compactCreate.dataset.targetOrder = '1';
      const created = qa.insertValuesFromPanel(compactCreate);
      check('compact creation retains one-click OCR rule', created.ocrTargetLayouts[0]?.action==='clicar');
      check('native creation payload retains one-click OCR rule',
        JSON.parse(qa.relativeOcrInvokeArgs(created).ocrTargetLayouts)[0]?.action==='clicar');
      qa.state.insertPanel = originalInsertPanel;
      card.remove(); return checks;
    })()`);
    assert.equal(result.length, 12);
    assert.deepEqual(errors, []);
  } finally {
    if (socket) socket.close();
    if (child && child.exitCode === null) {
      child.kill();
      await new Promise(resolve => {child.once("exit", resolve); setTimeout(resolve, 2500).unref();});
    }
    for (const request of pending.values()) request.reject(new Error("Browser test finished"));
    await new Promise(resolve => server.close(resolve));
    // Only our resolved, uniquely named temporary profile can be removed.
    assert.equal(path.dirname(profile), path.resolve(os.tmpdir()));
    assert.ok(path.basename(profile).startsWith("flowdetect-studio-functional-"));
    fs.rmSync(profile, {recursive: true, force: true, maxRetries: 3, retryDelay: 100});
  }
});

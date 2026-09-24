const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "../flowdetect_chrome/service_worker.js"), "utf8");
const manifest = require("../flowdetect_chrome/manifest.json");

function runner(names, extra = {}) {
  const functions = names.map((name) => {
    const match = source.match(new RegExp(`^(?:async )?function ${name}\\(.*?^}`, "ms"));
    assert.ok(match, `Production function ${name}`);
    return match[0];
  }).join("\n");
  const context = vm.createContext({ Map, Date, Error, Math, Number, String, ...extra });
  vm.runInContext("let creatingCaptureDocument = null;", context);
  vm.runInContext(functions, context);
  return context;
}

test("Chrome capture is bound to the automation tab, not the currently visible tab", async () => {
  const calls = [];
  const context = runner(["ensureCaptureDocument", "startTabCapture"], {
    chrome: {
      runtime: {
        getURL: (name) => `chrome-extension://test/${name}`,
        getContexts: async () => [],
        sendMessage: async (message) => { calls.push(message); return { ok: true }; },
      },
      offscreen: { createDocument: async (options) => calls.push(options) },
      tabCapture: {
        getMediaStreamId: async (options) => {
          calls.push(options);
          return "stream-for-tab-42";
        },
      },
    },
  });
  const run = { id: "run-1", tabId: 42 };

  await context.startTabCapture(run);

  assert.equal(run.captureMode, "tab");
  assert.equal(calls[0].url, "capture-offscreen.html");
  assert.equal(calls[1].targetTabId, 42);
  assert.equal(calls[2].streamId, "stream-for-tab-42");
  assert.equal(calls[2].runId, "run-1");
  assert.ok(manifest.permissions.includes("tabCapture"));
  assert.ok(manifest.permissions.includes("offscreen"));
});

test("visual recognition uses the bound stream without capturing another active tab", async () => {
  const messages = [];
  let bitmapClosed = false;
  const context = runner(["captureImage"], {
    chrome: {
      runtime: { sendMessage: async (message) => {
        messages.push(message);
        return { ok: true, dataUrl: "data:image/png;base64,AAAA", width: 1920, height: 1080 };
      } },
      tabs: { captureVisibleTab: () => { throw new Error("Wrong capture path"); } },
    },
    bitmapFromCapture: async () => ({ width: 980, height: 551, close: () => { bitmapClosed = true; } }),
    imageDataFromBitmap: () => ({ width: 980, height: 551 }),
  });

  const frame = await context.captureImage({ id: "run-2", tabId: 42, captureMode: "tab" });

  assert.equal(messages[0].type, "flowdetect-capture-frame");
  assert.equal(messages[0].runId, "run-2");
  assert.equal(frame.originalWidth, 1920);
  assert.equal(frame.scale, 980 / 1920);
  assert.equal(bitmapClosed, true);
});

test("fallback waits for the automation tab and never matches the other tab's screenshot", async () => {
  const logs = [];
  let queries = 0;
  let captures = 0;
  const context = runner(["activeTabForWindow", "captureUnavailable", "waitForActiveTargetTab", "captureImage"], {
    chrome: { tabs: {
      get: async () => ({ id: 42, windowId: 7 }),
      query: async () => [{ id: ++queries === 1 ? 99 : 42 }],
      captureVisibleTab: async () => { captures += 1; return "target-frame"; },
    } },
    sleep: async () => {},
    addLog: async (_run, message) => logs.push(message),
    bitmapFromCapture: async () => ({ width: 900, height: 600 }),
    imageDataFromBitmap: () => ({ width: 900, height: 600 }),
  });

  const run = { tabId: 42, captureMode: "visible" };
  await context.captureImage(run);

  assert.equal(captures, 1);
  assert.match(logs[0], /Aguardando a imagem/);
  assert.match(logs[1], /retomando o reconhecimento/);
  assert.equal(run.captureWaiting, undefined);
});

test("an unavailable capture cannot follow an OCR or visual failure route", async () => {
  let failuresFollowed = 0;
  const unavailable = new Error("Target tab unavailable");
  unavailable.flowdetectCaptureUnavailable = true;
  const context = runner(["executeRange"], {
    persistRun: async () => {},
    addLog: async () => {},
    executeStep: async () => { throw unavailable; },
    flowContinues: () => { failuresFollowed += 1; return true; },
  });
  const steps = [{ type: "visual_match", on_failure: { action: "continuar" } }];

  await assert.rejects(
    context.executeRange({ currentStep: 0 }, steps, 0, 1, new Map(), { nextByIndex: new Map([[0, null]]) }),
    /Target tab unavailable/,
  );
  assert.equal(failuresFollowed, 0);
});

test("offscreen capture consumes the chosen stream and returns a scaled frame", async () => {
  const offscreenSource = fs.readFileSync(path.join(__dirname, "../flowdetect_chrome/capture-offscreen.js"), "utf8");
  const calls = [];
  let listener;
  const track = {
    readyState: "live",
    addEventListener: () => {},
    stop: () => calls.push("stopped"),
  };
  const stream = {
    getVideoTracks: () => [track],
    getTracks: () => [track],
  };
  const video = {
    readyState: 4,
    videoWidth: 1920,
    videoHeight: 1080,
    play: async () => {},
    pause: () => {},
    addEventListener: () => {},
  };
  const canvas = {
    getContext: () => ({ drawImage: () => {} }),
    toDataURL: () => "data:image/png;base64,AAAA",
  };
  const context = vm.createContext({
    Map,
    Promise,
    Error,
    Math,
    String,
    HTMLMediaElement: { HAVE_CURRENT_DATA: 2 },
    setTimeout: () => 0,
    navigator: { mediaDevices: { getUserMedia: async (options) => {
      calls.push(options);
      return stream;
    } } },
    document: { createElement: (tag) => tag === "video" ? video : canvas },
    chrome: { runtime: { onMessage: { addListener: (callback) => { listener = callback; } } } },
  });
  vm.runInContext(offscreenSource, context);
  const send = (message) => new Promise((resolve) => listener({ target: "flowdetect-offscreen", ...message }, {}, resolve));

  assert.equal((await send({ type: "flowdetect-capture-start", runId: "r1", streamId: "tab-42" })).ok, true);
  const frame = await send({ type: "flowdetect-capture-frame", runId: "r1" });
  assert.equal(calls[0].video.mandatory.chromeMediaSourceId, "tab-42");
  assert.equal(canvas.width, 980);
  assert.equal(frame.width, 1920);
  assert.equal(frame.dataUrl, "data:image/png;base64,AAAA");
  await send({ type: "flowdetect-capture-stop", runId: "r1" });
  assert.ok(calls.includes("stopped"));
});

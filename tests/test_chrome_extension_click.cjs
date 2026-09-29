const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "../flowdetect_chrome/content.js"), "utf8");
function productionFunction(name) {
  const found = source.match(new RegExp(`^  (?:async )?function ${name}\\(.*?^  }`, "ms"));
  assert.ok(found, `Production function ${name}`);
  return found[0];
}
const names = ["isVisible", "focusableTarget", "isClickReady", "waitForClickableTarget", "checkboxControl", "clickTarget"];
const functions = names.map(productionFunction).join("\n");

test("OCR click ignores a hidden menu and presses the option at the recognized point", () => {
  class Element {
    constructor({ parent = null, rect = { left: 0, top: 0, width: 20, height: 20 }, style = {}, ariaHidden = "false", role = "" } = {}) {
      this.parentElement = parent;
      this.rect = rect;
      this.style = { display: "block", visibility: "visible", opacity: "1", ...style };
      this.ariaHidden = ariaHidden;
      this.role = role;
      this.events = [];
      this.clicks = 0;
    }
    getAttribute(name) {
      if (name === "aria-hidden") return this.ariaHidden;
      if (name === "role") return this.role || null;
      return null;
    }
    getBoundingClientRect() { return this.rect; }
    closest(selector) {
      for (let current = this; current; current = current.parentElement) {
        if (current.role && selector.includes(`[role='${current.role}']`)) return current;
      }
      return null;
    }
    focus() { this.events.push("focus"); }
    dispatchEvent(event) { this.events.push(event.type); return true; }
    click() { this.clicks += 1; }
  }

  class PointerEvent { constructor(type) { this.type = type; } }
  class MouseEvent { constructor(type) { this.type = type; } }

  const hiddenParent = new Element({ style: { display: "none" } });
  const hiddenText = new Element({ parent: hiddenParent });
  const option = new Element({ role: "option", rect: { left: 80, top: 40, width: 100, height: 30 } });
  const textAtPoint = new Element({ parent: option });
  let point = null;
  const context = vm.createContext({
    Element,
    PointerEvent,
    MouseEvent,
    Number,
    Math,
    Error,
    window: {},
    document: {
      elementFromPoint(x, y) {
        point = { x, y };
        return textAtPoint;
      },
    },
    getComputedStyle(element) { return element.style; },
  });
  vm.runInContext(functions, context);

  assert.equal(context.isVisible(hiddenText), false);
  context.clickTarget(hiddenText, 1, { x: 105, y: 55 });
  assert.deepEqual(point, { x: 105, y: 55 });
  assert.equal(option.clicks, 1);
  assert.deepEqual(option.events.filter((type) => type !== "focus"), ["pointerdown", "mousedown", "pointerup", "mouseup"]);
});


test("click waits for a temporarily disabled target before continuing", async () => {
  class Element {
    constructor() {
      this.parentElement = null;
      this.disabled = true;
      this.className = "";
      this.style = { display: "block", visibility: "visible", opacity: "1", pointerEvents: "auto" };
    }
    getAttribute(name) { return name === "aria-hidden" ? "false" : null; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 30 }; }
    closest() { return this; }
  }

  let now = 0;
  const wrapper = new Element();
  wrapper.disabled = false;
  wrapper.className = "is-disabled";
  wrapper.style.pointerEvents = "none";
  const button = new Element();
  button.parentElement = wrapper;
  const context = vm.createContext({
    Element,
    Number,
    Math,
    Date: { now: () => now },
    Error,
    document: {},
    getComputedStyle: (element) => element.style,
    sleep: async (milliseconds) => { now += milliseconds; button.disabled = false; },
  });
  vm.runInContext(functions, context);

  const ready = await context.waitForClickableTarget(button, null, 1000);

  assert.equal(ready, button);
  assert.equal(now, 140);
  assert.equal(context.isClickReady(button), true);
  assert.equal(context.isClickReady(wrapper), true);
});

test("OCR waits for a delayed static banner instead of failing on the first check", async () => {
  let now = 0;
  let checks = 0;
  const waitFunction = productionFunction("waitForTextTarget");
  const context = vm.createContext({
    Date: { now: () => now },
    Math,
    Number,
    Error,
    findTextTarget: () => {
      checks += 1;
      return checks === 2 ? { element: {} } : null;
    },
    sleep: async (milliseconds) => { now += milliseconds; },
  });
  vm.runInContext(waitFunction, context);

  const target = await context.waitForTextTarget("Nao ha debitos", 1000, 1, 0);

  assert.deepEqual(target, { element: {} });
  assert.equal(checks, 2);
});

test("OCR anchors the click to the matched text instead of the whole row", () => {
  const node = { nodeValue: "50.317.977/0001-05 - SCRITA SOLUCOES LTDA" };
  const spans = [];
  const context = vm.createContext({
    String, RegExp, NodeFilter: { SHOW_TEXT: 4 },
    document: {
      createTreeWalker: () => ({ nextNode: (() => { let seen = false; return () => seen ? null : (seen = true, node); })() }),
      createRange: () => ({
        setStart(_node, index) { spans[0] = index; },
        setEnd(_node, index) { spans[1] = index; },
        getClientRects: () => [{ left: 120, top: 40, width: 190, height: 20 }],
      }),
    },
  });
  vm.runInContext(productionFunction("textRectWithinElement"), context);
  const rect = context.textRectWithinElement({}, "50.317.977/0001-05 - SCRITA  SOLU");
  assert.equal(rect.left, 120);
  assert.equal(spans[0], 0);
  assert.equal(node.nodeValue.slice(...spans), "50.317.977/0001-05 - SCRITA SOLU");
});

test("a marker near a small icon clicks the icon instead of the wide field", () => {
  const icon = { getBoundingClientRect: () => ({ left: 310, top: 37, width: 24, height: 24 }) };
  const field = { getBoundingClientRect: () => ({ left: 305, top: 30, width: 245, height: 38 }) };
  const context = vm.createContext({
    document: { querySelectorAll: () => [field, icon] },
    isVisible: () => true,
    Math,
  });
  vm.runInContext(productionFunction("checkboxControl") + "\n" + productionFunction("preciseClickTarget"), context);
  const chosen = context.preciseClickTarget({ x: 337, y: 54 });
  assert.equal(chosen.element, icon);
  assert.equal(chosen.point.x, 322);
  assert.equal(chosen.point.y, 49);
});

test("a snapped icon remains the click target even when the field overlaps its point", () => {
  const icon = { clicks: 0, focus() {}, dispatchEvent() {}, click() { this.clicks += 1; }, getBoundingClientRect: () => ({ left: 310, top: 37, width: 24, height: 24 }) };
  const field = { clicks: 0, focus() {}, dispatchEvent() {}, click() { this.clicks += 1; }, getBoundingClientRect: () => ({ left: 305, top: 30, width: 245, height: 38 }) };
  const context = vm.createContext({
    document: { elementFromPoint: () => field },
    focusableTarget: (element) => element,
    isVisible: () => true,
    isClickReady: () => true,
    MouseEvent: class { constructor(type) { this.type = type; } },
    window: {}, globalThis: {}, Number, Math, Error,
  });
  vm.runInContext(productionFunction("checkboxControl") + "\n" + productionFunction("clickTarget"), context);
  context.clickTarget(icon, 1, { x: 322, y: 49 }, true);
  assert.equal(icon.clicks, 1);
  assert.equal(field.clicks, 0);
});

test("a checkbox marker never snaps to a neighboring checkbox outside its bounds", () => {
  const box = (top) => ({
    matches: () => true,
    getBoundingClientRect: () => ({ left: 40, top, width: 20, height: 20 }),
  });
  const header = box(40);
  const row = box(80);
  const context = vm.createContext({
    document: { querySelectorAll: () => [header, row] },
    isVisible: () => true, Math,
  });
  vm.runInContext(productionFunction("checkboxControl") + "\n" + productionFunction("preciseClickTarget"), context);
  assert.equal(context.preciseClickTarget({ x: 50, y: 90 }).element, row);
  assert.equal(context.preciseClickTarget({ x: 50, y: 70 }), null);
});

test("content runner uses a versioned message channel after an extension update", () => {
  assert.match(source, /CONTENT_RUNTIME_VERSION = "0\.2\.\d+"/);
  assert.match(source, /flowdetect-execute-step-v2/);
  assert.match(source, /__flowDetectChromeRunnerListener/);
});


test("OCR confirmation accepts text rendered by a non-interactive alert", () => {
  class Element {
    constructor(text) {
      this.innerText = text;
      this.textContent = text;
    }
    getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 80 }; }
  }

  const findTextFunction = productionFunction("findTextTarget");
  const banner = new Element("Nao ha debitos de interesse para o empregador.");
  const context = vm.createContext({
    Element,
    String,
    document: {
      body: banner,
      documentElement: banner,
      querySelectorAll: () => [],
    },
    normalize: (value) => String(value).toLowerCase(),
    textMatches: (value, expected) => String(value).toLowerCase().includes(expected),
    isVisible: () => true,
    findStaticTextTarget: () => null,
    findRenderedTextTarget: () => null,
  });
  vm.runInContext(findTextFunction, context);

  const target = context.findTextTarget("Nao ha debitos", { allowDocumentText: true });

  assert.equal(target.documentText, true);
  assert.equal(target.element, banner);
});

test("content runner can be reinjected into the same tab", () => {
  const version = source.match(/CONTENT_RUNTIME_VERSION = "([^"]+)"/)[1];
  const context = vm.createContext({});
  vm.runInContext(`globalThis.__flowDetectChromeRunnerVersion = "${version}";`, context);

  assert.doesNotThrow(() => vm.runInContext(source, context));
  assert.doesNotThrow(() => vm.runInContext(source, context));
});

const workerSource = fs.readFileSync(path.join(__dirname, "../flowdetect_chrome/service_worker.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "../flowdetect_chrome/manifest.json"), "utf8"));

test("service worker uses the persistent content runner instead of reinjecting it", () => {
  assert.doesNotMatch(workerSource, /chrome\.scripting\.executeScript/);
  assert.deepEqual(manifest.content_scripts, [{
    matches: ["http://*/*", "https://*/*"],
    js: ["content.js"],
    run_at: "document_idle",
  }]);
});

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
const names = ["isVisible", "focusableTarget", "clickTarget"];
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
      return this;
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

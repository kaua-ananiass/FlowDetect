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

test("spreadsheet sequence types every row and sends its action between rows", async () => {
  class Element {
    constructor() { this.events = []; this.isContentEditable = false; }
    dispatchEvent(event) { this.events.push(event.type); return true; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 20, height: 20 }; }
  }
  class HTMLInputElement extends Element {
    constructor() { super(); this._value = ""; }
    get value() { return this._value; }
    set value(value) { this._value = value; }
  }
  class HTMLTextAreaElement extends HTMLInputElement {}
  class Event { constructor(type) { this.type = type; } }
  class InputEvent extends Event {}
  class KeyboardEvent extends Event {}

  const field = new HTMLInputElement();
  const keyNames = source.match(/^  const KEY_NAMES = .*;$/m);
  assert.ok(keyNames, "Production key map");
  const keyName = source.match(/^  function keyName\(.*$/m);
  assert.ok(keyName, "Production key name helper");
  const spreadsheetFunctions = [
    productionFunction("setNativeValue"),
    productionFunction("setContentEditableValue"),
    keyNames[0],
    keyName[0],
    productionFunction("dispatchKeySequence"),
    productionFunction("executeSpreadsheetSequence"),
  ].join("\n");
  const context = vm.createContext({
    Element,
    HTMLInputElement,
    HTMLTextAreaElement,
    Event,
    InputEvent,
    KeyboardEvent,
    Number,
    Math,
    String,
    Error,
    document: { activeElement: field, body: new Element(), documentElement: new Element() },
    highlight: () => {},
    sleep: async () => {},
  });
  vm.runInContext(spreadsheetFunctions, context);

  const message = await context.executeSpreadsheetSequence({
    name: "CNPJ",
    values: ["03943209000187", "51708970000187"],
    after_keys: ["enter"],
    interval_ms: 0,
  });

  assert.equal(field.value, "0394320900018751708970000187");
  assert.equal(field.events.filter((type) => type === "input").length, 2);
  assert.deepEqual(field.events.filter((type) => type === "keydown"), ["keydown"]);
  assert.match(message, /2 valor\(es\) digitado/);
});

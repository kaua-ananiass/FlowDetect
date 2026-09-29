const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "../tauri_gerador/web/main.js"), "utf8");
const names = [
  "normalizeTransitionDelay",
  "formatTransitionDelayValue",
  "normalizeOcrTargetAction",
  "normalizeOcrTargetFailureAction",
  "resolveCommandMapTreeTarget",
  "getCommandMapTreeBranchTargetKey",
  "mergeCommandMapTreeBranchLabels",
  "mergeCommandMapTreeBranchDelays",
  "dedupeCommandMapTreeBranches",
  "getCommandMapOcrActionBranches",
];
const functions = names.map((name) => {
  const match = source.match(new RegExp(`^function ${name}\\(.*?^}`, "ms"));
  assert.ok(match, `Missing production function ${name}`);
  return match[0];
}).join("\n");

function setup() {
  const events = [
    { order: 8, type: "clicar_imagem", details: { modo_reconhecimento: "texto_ocr" } },
    { order: 9, type: "texto_livre", details: {} },
    { order: 10, type: "texto_livre", details: {} },
  ];
  const context = vm.createContext({
    OCR_TARGET_COLORS: ["azul", "roxo", "verde"],
    parseNumber: (value, fallback = 0) => {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    },
    getCommandMapEventByOrder: (order) => events.find((event) => Number(event.order) === Number(order)) || null,
    getCommandMapEventSequenceByOrder: () => "principal",
    getCommandMapPageLabel: () => "Pagina 1",
  });
  vm.runInContext(functions, context);
  return { context, events };
}

test("an OCR failure jump becomes a red failure branch to the selected block", () => {
  const { context, events } = setup();
  const sourceEvent = {
    ...events[0],
    details: {
      modo_reconhecimento: "texto_ocr",
      ocr_target_layouts: [{
        texto: "Sem debitos",
        action: "continuar",
        failureAction: "ir_para_bloco",
        failureBlock: "10",
      }],
    },
  };
  const branches = context.getCommandMapOcrActionBranches(sourceEvent, 0, [sourceEvent, ...events.slice(1)], {
    orderToEvent: new Map([[9, events[1]], [10, events[2]]]),
    orderToIndex: new Map([[9, 1], [10, 2]]),
  });

  assert.equal(branches.length, 1);
  assert.equal(branches[0].kind, "failure");
  assert.equal(branches[0].targetOrder, 10);
  assert.equal(branches[0].label, "OCR 1 nao achou");
});

test("a failure route is not merged into a normal route with the same target", () => {
  const { context, events } = setup();
  const branches = context.dedupeCommandMapTreeBranches([
    { kind: "success", label: "Depois", targetEvent: events[1], targetOrder: 9 },
    { kind: "failure", label: "Se nao achar", targetEvent: events[1], targetOrder: 9 },
  ]);

  assert.equal(branches.length, 2);
  assert.deepEqual(
    Array.from(branches, (branch) => branch.kind).sort(),
    ["failure", "success"],
  );
});


test("cross-page OCR route exposes its independent delay beside the destination",()=>{
  const {context,events}=setup();
  const sourceEvent={...events[0],details:{modo_reconhecimento:'texto_ocr',ocr_target_layouts:[
    {action:'confirmar_ir_para_bloco',block:'16',successDelay:1.5,failureAction:'ir_para_bloco',failureBlock:'17',failureDelay:2.4}]}};
  const branches=context.getCommandMapOcrActionBranches(sourceEvent,0,[sourceEvent],{orderToEvent:new Map(),orderToIndex:new Map()});
  assert.equal(branches[0].editableDelay,'ocr');
  assert.equal(branches[0].hideDelay,false);
  assert.equal(branches[0].delay,1.5);
  assert.equal(branches[1].delay,2.4);
});

test("editing a compact OCR card preserves its target layout and independent waits",()=>{
  const fn=source.match(/^function setCommandCardOcrRouteDelay\(.*?^}/ms)[0];
  const context=vm.createContext({ocrTargetRowByIndex:()=>null,formatTransitionDelayValue:String});
  vm.runInContext(fn,context);
  const hidden={value:JSON.stringify([{texto:'Empresa',block:'7',successDelay:0,failureDelay:0}])};
  const card={querySelector:()=>hidden};
  assert.equal(context.setCommandCardOcrRouteDelay(card,0,'success',1.5),true);
  assert.equal(context.setCommandCardOcrRouteDelay(card,0,'failure',2),true);
  const layout=JSON.parse(hidden.value)[0];
  assert.deepEqual(layout,{texto:'Empresa',block:'7',successDelay:1.5,failureDelay:2});
});


test("the OCR destination label renders an editable seconds field",()=>{
  const fn=source.match(/^function renderCommandMapTreeDelayControl\(.*?^}/ms)[0];
  const context=vm.createContext({escapeHtml:String,formatTransitionDelayValue:String});
  vm.runInContext(fn,context);
  const markup=context.renderCommandMapTreeDelayControl({editableDelay:'ocr',sourceOrder:8,ocrIndex:1,kind:'ocr_action',delay:1.5});
  assert.match(markup,/data-ocr-route-index="1"/);
  assert.match(markup,/value="1.5"/);
  assert.match(markup,/<strong>s<\/strong>/);
});

test("OCR failures to the same destination retain separately editable waits", () => {
  const {context, events} = setup();
  const branches = context.dedupeCommandMapTreeBranches([
    {kind: "failure", ocrIndex: 0, label: "OCR 1", targetEvent: events[1], targetOrder: 9, delay: 1, editableDelay: "ocr"},
    {kind: "failure", ocrIndex: 1, label: "OCR 2", targetEvent: events[1], targetOrder: 9, delay: 2, editableDelay: "ocr"},
    {kind: "failure", label: "Se nao achar", targetEvent: events[1], targetOrder: 9, delay: 3, editableDelay: "route"},
  ]);
  assert.equal(branches.length, 3);
  assert.deepEqual(Array.from(branches, branch => branch.delay), [1, 2, 3]);
  assert.equal(branches[1].editableDelay, "ocr");
});

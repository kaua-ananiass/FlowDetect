const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "../tauri_gerador/web/main.js"), "utf8");
const names = [
  "resolveCommandMapParentPage", "getCommandMapCanvasEvents",
  "commandMapTreeLayoutPageKey", "getCommandMapTreeManualPositions",
  "getCommandMapTreeStageConstants", "getCommandMapTreeCardLayoutWidth",
  "getCommandMapTreeInsertPreview", "buildCommandMapTreeStageLayout",
  "captureCommandMapTreeInsertion", "placeCreatedCommandMapTreeNode",
  "applyChatRoadmap",
];
const functions = names.map(name => {
  const match = source.match(new RegExp(`^function ${name}\\(.*?^}`, "ms"));
  assert.ok(match, `Missing production function ${name}`);
  return match[0];
}).join("\n");
const plain = value => JSON.parse(JSON.stringify(value));
const event = (order, sequence = "principal") => ({
  order, sequence, type: "sequencia_planilha", clientKey: `existing-${order}`, title: "Loop",
});

function setup(events, layouts = {}, sequence = "principal") {
  let nextKey = 0;
  const state = {
    roadmap: { events }, commandMapPageSequence: sequence, commandMapTreeLayouts: layouts,
    expandedTreeCardOrder: null, insertPanel: null,
    commandMapZoom: 0.4, commandMapTreePanOffset: { x: -870, y: 120 },
  };
  const context = vm.createContext({
    state,chatEditorContext:null,
    normalizeSequenceName: value => String(value || 'principal').trim(),
    getCommandMapEvents: (page = state.commandMapPageSequence) => state.roadmap.events.filter(e => e.sequence === page),
    getCommandMapPageDefinition: sequence => ({ sequence }),
    isLoopMarkerType: () => false,
    buildCommandMapTreeBranches: () => [],
    nextCommandMapClientKey: () => `created-${++nextKey}`,
    persistCommandMapTreeLayouts: () => {},
    captureCommandMapCardPositions: () => ({}),
    applyRoadmap: (roadmap,options) => {state.roadmap=roadmap;state.lastApplyOptions=options;},
  });
  vm.runInContext(functions, context);
  return context;
}

function insert(context, targetOrder, position = "after") {
  context.state.insertPanel = { targetOrder, position };
  const insertion = context.captureCommandMapTreeInsertion(targetOrder, position);
  const old = context.state.roadmap.events;
  const index = targetOrder > 0
    ? old.findIndex(e => e.order === targetOrder) + (position === "before" ? 0 : 1)
    : old.length;
  const returned = [...old];
  returned.splice(index, 0, event(0, context.state.commandMapPageSequence));
  // Backend responses renumber orders and do not contain client keys.
  const roadmap = { events: returned.map(({ clientKey, ...e }, i) => ({ ...e, order: i + 1 })) };
  const result = context.placeCreatedCommandMapTreeNode(roadmap, insertion);
  context.state.insertPanel = null;
  context.state.roadmap = result;
  return { insertion, result, positions: context.state.commandMapTreeLayouts[context.state.commandMapPageSequence] };
}

test('independent paths occupy separate rows and restart their horizontal position',()=>{
  const context=setup([event(1),event(2),event(3,'recuperacao'),event(4,'recuperacao')]);
  const layout=context.buildCommandMapTreeStageLayout(context.state.roadmap.events,{sequence:'principal'});
  const [a,b,c,d]=layout.nodes;
  assert.equal(a.x,c.x);
  assert.equal(b.x,d.x);
  assert.ok(c.y>a.y+700);
  assert.ok(layout.height>d.y+600);
});

test('a save returning after page navigation keeps the anchor layout and the current page',()=>{
 const original=[{...event(1),id:'anchor'},{...event(2,'pagina_2'),id:'other'}];
 const context=setup(original,{principal:{1:{x:1800,y:250}},pagina_2:{2:{x:400,y:180}}},'pagina_2');
 context.applyChatRoadmap({events:[original[0],{...event(2),id:'new'}, {...original[1],order:3}]},{anchor_id:'anchor',anchor_order:1,position:'after'});
 assert.deepEqual(plain(context.state.commandMapTreeLayouts.principal[2]),{x:2360,y:250});
 assert.equal(context.state.commandMapPageSequence,'pagina_2');
 assert.equal(context.state.lastApplyOptions.preserveCommandMapSequence,'pagina_2');
 assert.equal(context.state.lastApplyOptions.resetCommandMapNavigation,undefined);
 assert.deepEqual(plain(context.state.commandMapTreeLayouts.pagina_2[3]),{x:400,y:180});
 assert.equal(context.state.roadmap.events.length,3);
});

test('opening New block only shifts following blocks in the same section',()=>{
  const context=setup([event(1),event(2),event(3,'recuperacao'),event(4,'recuperacao')]);
  const before=plain(context.buildCommandMapTreeStageLayout(context.state.roadmap.events,{sequence:'principal'}));
  context.state.insertPanel={targetOrder:1,position:'after'};
  const opened=plain(context.buildCommandMapTreeStageLayout(context.state.roadmap.events,{sequence:'principal'}));
  assert.equal(opened.nodes[0].x,before.nodes[0].x);
  assert.ok(opened.nodes[1].x>before.nodes[1].x);
  for(const index of [2,3]){
    assert.equal(opened.nodes[index].x,before.nodes[index].x);
    assert.equal(opened.nodes[index].y,before.nodes[index].y);
  }
  assert.deepEqual(plain(context.state.commandMapTreeLayouts),{});
  context.state.insertPanel=null;
  assert.deepEqual(plain(context.buildCommandMapTreeStageLayout(context.state.roadmap.events,{sequence:'principal'})).nodes,before.nodes);
});

test("appending places the new card ahead of its manually moved origin, ignoring a stale order", () => {
  const context = setup([1, 2, 3, 4, 5].map(n => event(n)), {
    principal: { 5: { x: 3200, y: 240 }, 6: { x: 320, y: 176 } },
  });
  const { positions } = insert(context, 5);
  assert.deepEqual(plain(positions[5]), { x: 3200, y: 240 });
  assert.deepEqual(plain(positions[6]), { x: 3760, y: 240 });
});

test("inserting in the middle preserves earlier nodes and opens room for the following ones", () => {
  const context = setup([1, 2, 3].map(n => event(n)), {
    principal: { 1: { x: 2400, y: 220 }, 2: { x: 2960, y: 250 }, 3: { x: 3520, y: 260 } },
  });
  const { positions, result } = insert(context, 1);
  assert.deepEqual(plain(positions[1]), { x: 2400, y: 220 });
  assert.deepEqual(plain(positions[2]), { x: 2960, y: 220 });
  assert.deepEqual(plain(positions[3]), { x: 3520, y: 250 });
  assert.deepEqual(plain(positions[4]), { x: 4080, y: 260 });
  assert.deepEqual(plain(result.events.map(e => e.clientKey)), ["existing-1", "created-1", "existing-2", "existing-3"]);
});

test("before inserts at the requested position and shifts the original forward", () => {
  const context = setup([event(1), event(2)]);
  const { positions } = insert(context, 1, "before");
  assert.equal(positions[1].x, 72);
  assert.equal(positions[2].x, 632);
  assert.equal(positions[3].x, 1192);
});

test("existing free space avoids unnecessary movement of following cards", () => {
  const context = setup([event(1), event(2)], {
    principal: { 1: { x: 300, y: 220 }, 2: { x: 3000, y: 240 } },
  });
  const { positions } = insert(context, 1);
  assert.equal(positions[2].x, 860);
  assert.equal(positions[3].x, 3000);
});

test("global renumbering preserves other pages and remaps their connectors", () => {
  const context = setup([event(1), event(2), event(3, "pagina_2"), event(4, "pagina_2")], {
    pagina_2: {
      3: { x: 800, y: 210 }, 4: { x: 1600, y: 210 }, 9: { x: 100, y: 100 },
      "edge:3:block:4:success:-1": { x: 1200, y: 320 },
      "edge:4:terminal:fim:success:0": { x: 1900, y: 640 },
    },
  });
  insert(context, 1);
  assert.deepEqual(plain(context.state.commandMapTreeLayouts.pagina_2), {
    4: { x: 800, y: 210 }, 5: { x: 1600, y: 210 },
    "edge:4:block:5:success:-1": { x: 1200, y: 320 },
    "edge:5:terminal:fim:success:0": { x: 1900, y: 640 },
  });
});

test("the first card on an empty page is the newly appended global order", () => {
  const context = setup([event(1), event(2)], { pagina_2: { 3: { x: 9900, y: 500 } } }, "pagina_2");
  const { insertion, positions, result } = insert(context, 0);
  assert.equal(insertion.createdOrder, 3);
  assert.deepEqual(plain(positions[3]), { x: 72, y: 176 });
  assert.equal(result.events[2].sequence, "pagina_2");
});

test("creation does not change zoom or pan and never persists the temporary panel shift", () => {
  const context = setup([event(1), event(2)]);
  context.state.insertPanel = { targetOrder: 1, position: "after" };
  const preview = context.buildCommandMapTreeStageLayout(context.state.roadmap.events, { sequence: "principal" });
  assert.equal(preview.nodes[1].x, 1192);
  const { insertion, positions } = insert(context, 1);
  assert.equal(insertion.layout.nodes[1].x, 632);
  assert.equal(positions[3].x, 1192);
  assert.equal(context.state.commandMapZoom, 0.4);
  assert.deepEqual(context.state.commandMapTreePanOffset, { x: -870, y: 120 });
});

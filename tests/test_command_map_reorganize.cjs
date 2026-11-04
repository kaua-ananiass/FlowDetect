const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "../tauri_gerador/web/main.js"), "utf8");
const names = ["commandMapTreeLayoutPageKey", "clearCommandMapTreeManualPositions", "reorganizeCommandMapTree"];
const functions = names.map((name) => {
  const found = source.match(new RegExp(`^function ${name}\\(.*?^}`, "ms"));
  assert.ok(found, `Missing production function ${name}`);
  return found[0];
}).join("\n");

function runner(layouts) {
  const calls = { persist: 0, render: null, pan: 0, message: null };
  const state = {
    commandMapPageSequence: "pagina_2",
    commandMapTreeLayouts: layouts,
    commandMapTreePanOffset: { x: 410, y: -80 },
    commandMapTreePanUserMoved: true,
    commandMapFocusOrder: 9,
  };
  const context = vm.createContext({
    state,
    Object,
    String,
    persistCommandMapTreeLayouts: () => { calls.persist += 1; },
    applyCommandMapTreePanOffset: () => { calls.pan += 1; },
    renderCommandMap: (options) => { calls.render = options; },
    getCommandMapPageDefinition: (sequence) => ({ label: sequence === "pagina_2" ? "Pagina 2" : "Principal" }),
    setMessage: (text, variant) => { calls.message = { text, variant }; },
  });
  vm.runInContext(functions, context);
  return { context, state, calls };
}

test("reorganize removes only the current page manual positions and resets the map view", () => {
  const { context, state, calls } = runner({
    principal: { 1: { x: 200, y: 170 } },
    pagina_2: {
      4: { x: 1900, y: 640 },
      "edge:4:block:5:success:-1": { x: 1210, y: 330 },
    },
  });

  context.reorganizeCommandMapTree();

  assert.deepEqual(JSON.parse(JSON.stringify(state.commandMapTreeLayouts)), {
    principal: { 1: { x: 200, y: 170 } },
  });
  assert.deepEqual(JSON.parse(JSON.stringify(state.commandMapTreePanOffset)), { x: 0, y: 0 });
  assert.equal(state.commandMapTreePanUserMoved, false);
  assert.equal(state.commandMapFocusOrder, null);
  assert.equal(calls.persist, 1);
  assert.equal(calls.pan, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(calls.render)), {
    preserveScroll: false,
    suppressFocusScroll: true,
    quietUpdate: true,
  });
  assert.deepEqual(calls.message, { text: "Pagina 2: blocos e ligações reorganizados.", variant: "success" });
});

test("reorganize keeps a page without manual positions in automatic layout", () => {
  const { context, calls } = runner({ principal: { 1: { x: 200, y: 170 } } });

  context.reorganizeCommandMapTree();

  assert.equal(calls.persist, 0);
  assert.deepEqual(calls.message, { text: "Pagina 2: blocos e ligações reorganizados.", variant: "success" });
});

const routingFunctions = ['reserveCommandMapConnectionLane','commandMapSectionReturnPath'].map(name=>source.match(new RegExp(`^function ${name}\\(.*?^}`, 'ms'))[0]).join('\n');
test('connection lanes separate overlapping spans and reuse independent spans',()=>{
  const context=vm.createContext({Math});vm.runInContext(routingFunctions,context);
  const used=[];
  assert.equal(context.reserveCommandMapConnectionLane(used,100,400,600),600);
  assert.equal(context.reserveCommandMapConnectionLane(used,200,500,600),656);
  assert.equal(context.reserveCommandMapConnectionLane(used,700,900,600),600);
  assert.equal(context.reserveCommandMapConnectionLane(used,200,400,600,-1),544);
});
test('cross-section routes use bottom-to-top downward and top-to-bottom upward',()=>{
  const context=vm.createContext({Math});vm.runInContext(routingFunctions,context);
  const upper={left:100,right:300,centerX:200,top:100,bottom:400};
  const lower={left:600,right:800,centerX:700,top:900,bottom:1200};
  const down=context.commandMapSectionReturnPath(upper,lower,650).d;
  const up=context.commandMapSectionReturnPath(lower,upper,650).d;
  assert.match(down,/^M [0-9]+ 400 /);assert.match(down,/ 900$/);
  assert.match(up,/^M [0-9]+ 900 /);assert.match(up,/ 400$/);
  assert.equal((down.match(/Q /g)||[]).length,2);
});

test('routes around intervening cards while keeping the requested manual waypoint',()=>{
  const fn=source.match(/^function routeCommandMapAroundCards\(.*?^}/ms)[0];
  const context=vm.createContext({Math,Map,Set});vm.runInContext(fn,context);
  const obstacles=[{left:100,right:300,top:150,bottom:450},{left:400,right:650,top:300,bottom:650},{left:100,right:300,top:750,bottom:1000}];
  const waypoint={x:700,y:720};
  const points=context.routeCommandMapAroundCards({x:200,y:100},{x:200,y:1100},obstacles,waypoint);
  assert.ok(points);assert.ok(points.some(p=>p.x===waypoint.x&&p.y===waypoint.y));
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];assert.ok(a.x===b.x||a.y===b.y);
    for(const r of obstacles){
      const collision=a.x===b.x?a.x>r.left&&a.x<r.right&&Math.max(a.y,b.y)>r.top&&Math.min(a.y,b.y)<r.bottom:a.y>r.top&&a.y<r.bottom&&Math.max(a.x,b.x)>r.left&&Math.min(a.x,b.x)<r.right;
      assert.equal(collision,false,JSON.stringify({a,b,r}));
    }
  }
});

test('obsolete section dragging positions reset only affected pages on startup',()=>{
 const storage={value:JSON.stringify({principal:{'1':{x:900,y:400},'section:principal':{x:850,y:260}},pagina_2:{'2':{x:200,y:300}}})};
 const context=vm.createContext({COMMAND_MAP_TREE_LAYOUT_STORAGE_KEY:'layout',window:{localStorage:{getItem:()=>storage.value,setItem:(_key,value)=>storage.value=value}},JSON,Object,Array});
 vm.runInContext(source.match(/^function loadCommandMapTreeLayouts\(.*?^}/ms)[0],context);
 const result=JSON.parse(JSON.stringify(context.loadCommandMapTreeLayouts()));
 assert.deepEqual(result,{pagina_2:{'2':{x:200,y:300}}});assert.deepEqual(JSON.parse(storage.value),result);
 assert.ok(!source.includes('function startCommandMapSectionDrag('));
});

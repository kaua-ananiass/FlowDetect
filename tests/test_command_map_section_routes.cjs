const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../tauri_gerador/web/main.js'),'utf8');
const context=vm.createContext({});
vm.runInContext(source.match(/^function commandMapSectionReturnPath\(.*?^}/ms)[0],context);
const rect=(left,top)=>({left,right:left+188,top,bottom:top+420,centerX:left+94});
test('upward section routes start at the top and use rounded bends toward the upper block bottom',()=>{
  for(const [from,to] of [[700,100],[100,700]]){
    const result=context.commandMapSectionReturnPath(rect(from,1026),rect(to,176),820,0);
    assert.ok(result.d.startsWith(`M ${result.startX} 1026 `));
    assert.ok(result.d.endsWith(`L ${result.endX} 596`));
    assert.equal((result.d.match(/Q /g)||[]).length,2);
    const values=result.d.match(/-?\d+(?:\.\d+)?/g).map(Number);
    assert.ok(values.filter((_,i)=>i%2===1).every(y=>y<=1026&&y>=596));
  }
});
test('aligned section returns remain vertical and different OCR ports stay separate',()=>{
  const a=context.commandMapSectionReturnPath(rect(100,1026),rect(100,176),820,0);
  const b=context.commandMapSectionReturnPath(rect(100,1026),rect(100,176),820,1);
  assert.equal(a.d,`M ${a.startX} 1026 L ${a.endX} 596`);
  assert.notEqual(a.startX,b.startX);
});

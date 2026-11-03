const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../tauri_gerador/web/main.js'),'utf8');
const names=['resolveCommandMapParentPage','getCommandMapCanvasEvents','getCommandMapPageDefinitions','getCommandMapPageDefinition','getCommandMapPageLabel','getCommandMapRouteDestinations','ensureCommandMapPageSelection','resolveNearestCommandMapFocus','currentSequenceName'];
function setup(){
  const state={commandMapPageSequence:'principal',roadmap:{sequences:['principal','pagina_2','secao_1','secao_2','secao_aninhada','extra_legitima'],events:[{order:1,sequence:'principal'},{order:2,sequence:'secao_1'},{order:3,sequence:'pagina_2'},{order:4,sequence:'secao_2'},{order:5,sequence:'secao_aninhada'}],map_paths:[{name:'Recuperação',parent:'principal',sequences:['secao_1']},{name:'Outra seção',parent:'pagina_2',sequences:['secao_2']},{name:'Aninhada',parent:'secao_1',sequences:['secao_aninhada']}]}};
  const context=vm.createContext({state,normalizeSequenceName:value=>String(value||'principal').trim(),COMMAND_PAGE_DEFINITIONS:['principal','pagina_2','pagina_3','pagina_4'].map((sequence,index)=>({sequence,label:`Página ${index+1}`})),activeCommandMapPageSequenceLock:()=>'',syncSequenceContextInput:()=>{},sequenceContextInput:{value:'principal'}});
  vm.runInContext(names.map(name=>source.match(new RegExp(`^function ${name}\\(.*?^}`,'ms'))[0]).join('\n'),context);
  return {state,context};
}
test('sections stay inside their parent pages while genuine extra pages remain available',()=>{
  const {context}=setup();
  assert.deepEqual(Array.from(context.getCommandMapPageDefinitions(),page=>page.sequence),['principal','pagina_2','pagina_3','pagina_4','extra_legitima']);
  assert.equal(context.getCommandMapPageDefinition('secao_1').sequence,'principal');
  assert.equal(context.getCommandMapPageDefinition('secao_2').sequence,'pagina_2');
  assert.deepEqual(Array.from(context.getCommandMapCanvasEvents('principal'),event=>event.order),[1,2,5]);
  assert.equal(context.getCommandMapRouteDestinations().find(item=>item.sequence==='secao_1').label,'Página 1 / Recuperação');
});
test('restoring an old section tab returns to its parent and insertion keeps the section execution sequence',()=>{
  const {state,context}=setup();
  state.commandMapPageSequence='secao_1';context.ensureCommandMapPageSelection();
  assert.equal(state.commandMapPageSequence,'principal');
  state.insertPanel={targetOrder:2};
  assert.equal(context.currentSequenceName(),'secao_1');
  assert.equal(context.resolveNearestCommandMapFocus(state.roadmap,2),2);
});

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../flowdetect_chrome/service_worker.js'),'utf8');
function runner(extra={}) {
  const names=['replaceVariables','executeStep','executePageStep','setSpreadsheetRowVariables'];
  const functions=names.map(name=>source.match(new RegExp('^(?:async )?function '+name+'\\(.*?^}', 'ms'))[0]).join('\n');
  const context=vm.createContext({console,addLog:async()=>{},sleep:async()=>{},aguardarTransicaoDaPagina:async()=>{},spreadsheetRowData:()=>({}),spreadsheetColumnValue:()=>'',...extra});
  vm.runInContext(functions,context);return context;
}
test('captured value fills the next Chrome field and is cleared before another row',async()=>{
  const sent=[];
  const c=runner({sendToPage:async(_id,message)=>{
    sent.push(message.step);
    return message.step.type==='ocr_text'?{ok:true,message:'capturado',capture:{name:'valor_nota',value:'61,36'}}:{ok:true,message:'preenchido'};
  }});
  const capture={type:'ocr_text',text:'Valor total',variable_capture:{enabled:true,name:'valor_nota'}};
  const run={id:'run',tabId:1,variables:{},automationSnapshot:{steps:[capture]}};
  await c.executeStep(run,capture);
  await c.executeStep(run,{type:'focused_text',text:'{{valor_nota}}'});
  assert.equal(sent.at(-1).text,'61,36');
  assert.equal(run.capturedVariables.valor_nota,'61,36');
  c.setSpreadsheetRowVariables(run,{values:['outra empresa']},0);
  assert.equal(run.variables.valor_nota,undefined);
  await assert.rejects(()=>c.executeStep(run,{type:'focused_text',text:'{{valor_nota}}'}),/capturada/);
});
test('failed recapture cannot reuse the prior value or click the next field',async()=>{
  const c=runner({sendToPage:async()=>({ok:false,error:'Leitura ambigua'})});
  const step={type:'ocr_text',variable_capture:{enabled:true,name:'valor_nota'}};
  const run={id:'run',variables:{valor_nota:'100,00'},capturedVariables:{valor_nota:'100,00'},automationSnapshot:{steps:[step]}};
  await assert.rejects(()=>c.executeStep(run,step),/ambigua/);
  assert.equal(run.variables.valor_nota,undefined);
  assert.equal(run.capturedVariables.valor_nota,undefined);
});

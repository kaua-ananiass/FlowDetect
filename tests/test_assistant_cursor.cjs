const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');

test('Assistant uses the current control once and stops on Escape or a stale target',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();
  const source=await fs.readFile(path.join(__dirname,'../tauri_gerador/web/assistant-cursor.js'),'utf8');
  const css=await fs.readFile(path.join(__dirname,'../tauri_gerador/web/style.css'),'utf8');
  await page.setContent('<button id="target" style="margin:150px">Create</button>');
  await page.addStyleTag({content:css});
  await page.evaluate(async source=>{const module=await import('data:text/javascript;base64,'+btoa(unescape(encodeURIComponent(source))));window.pointer=module.createAssistantCursor();window.count=0;},source);
  await page.evaluate(()=>{window.pending=pointer.act(()=>document.getElementById('target'),'Create',el=>{el.click();window.count++;});});
  await page.waitForSelector('.fd-assistant-cursor');
  assert.equal(await page.locator('.fd-assistant-cursor-name').textContent(),'Assistente');
  assert.equal(await page.locator('.fd-assistant-cursor').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
  await page.evaluate(async()=>{await pending;pointer.finish();});
  assert.equal(await page.evaluate(()=>count),1);
  await page.evaluate(()=>{window.pending=pointer.act(()=>document.getElementById('target'),'Create',el=>{window.lastClicked=el.id;window.count++;}).catch(error=>error.message);});
  await page.mouse.move(10,10);await page.mouse.down();
  await page.evaluate(()=>{const old=document.getElementById('target');const replacement=old.cloneNode(true);replacement.style.marginLeft='350px';old.replaceWith(replacement);});
  await page.mouse.move(110,90,{steps:8});await page.mouse.wheel(0,90);
  assert.equal(await page.evaluate(()=>count),1,'Dragging the map pauses the click instead of cancelling or firing it');
  await page.mouse.up();
  assert.equal(await page.evaluate(async()=>{const result=await pending;pointer.finish();return result;}),undefined);
  assert.equal(await page.evaluate(()=>count),2,'The operation resumes exactly once on the remounted control');
  await page.evaluate(()=>{window.pending=pointer.act(()=>document.getElementById('target'),'Create',()=>count++).catch(error=>error.message);});
  await page.keyboard.press('Escape');
  assert.match(await page.evaluate(async()=>{const error=await pending;pointer.finish();return error;}),/interrompida/);
  assert.equal(await page.evaluate(()=>count),2);
  await page.evaluate(()=>{window.pending=pointer.act(()=>document.getElementById('target'),'Create',()=>count++).catch(error=>error.message);document.getElementById('target').remove();});
  assert.match(await page.evaluate(async()=>{const error=await pending;pointer.finish();return error;}),/mudou|disponível/);
  assert.equal(await page.evaluate(()=>count),2);
  assert.equal(await page.locator('.fd-assistant-cursor,.fd-assistant-target').count(),0);
 }finally{await browser.close();}
});

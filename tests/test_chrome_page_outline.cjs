const { test } = require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');

test('linked tab receives page color and deleting the binding removes the overlay',async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  try{
    const page=await browser.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('data:text/html,<html><body><h1>Sistema ERP</h1></body></html>');
    await page.evaluate(()=>{
      window.__listeners=[];
      window.chrome={
        runtime:{
          onMessage:{addListener(fn){window.__listeners.push(fn)}},
          sendMessage:async()=>({ok:true,page:{id:'p1',name:'Página 1',color:'#12b5cb'}})
        }
      };
    });
    await page.addScriptTag({path:path.resolve(__dirname,'../flowdetect_chrome/page-outline.js')});
    await page.waitForFunction(()=>!!document.querySelector('#__flowdetect_page_outline_host'));
    const before=await page.evaluate(()=>{
      const host=document.querySelector('#__flowdetect_page_outline_host');
      return {color:host.style.getPropertyValue('--fd-color'),pointerEvents:getComputedStyle(host).pointerEvents,
        position:getComputedStyle(host).position,tag:host.__flowdetectTag?.textContent,ariaHidden:host.getAttribute('aria-hidden')};
    });
    assert.equal(before.color,'#12b5cb');
    assert.equal(before.pointerEvents,'none');
    assert.equal(before.position,'fixed');
    assert.match(before.tag,/Página 1/);
    assert.equal(before.ariaHidden,'true');
    await page.evaluate(()=>window.__listeners[0]({type:'flowdetect-page-outline-update',page:{id:'p2',name:'Página 2',color:'#8b5cf6'}},null,()=>{}));
    assert.equal(await page.locator('#__flowdetect_page_outline_host').evaluate(el=>el.style.getPropertyValue('--fd-color')),'#8b5cf6');
    await page.evaluate(()=>window.__listeners[0]({type:'flowdetect-page-outline-update',page:null},null,()=>{}));
    assert.equal(await page.locator('#__flowdetect_page_outline_host').count(),0);
    await page.evaluate(()=>window.__listeners[0]({type:'flowdetect-page-outline-update',page:{id:'invalid',name:'Página',color:'red;position:static'}},null,()=>{}));
    assert.equal(await page.locator('#__flowdetect_page_outline_host').count(),0,'reject arbitrary colors');
    assert.deepEqual(errors,[]);
  }finally{await browser.close()}
});
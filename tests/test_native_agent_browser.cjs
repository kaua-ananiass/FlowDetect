const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');

test('Native source uses binary IPC without browser permission and pauses capture on disconnect',async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();
    await page.setContent('<p id="agentVideoStatus"></p>');
    await page.addScriptTag({path:path.join(root,'flowdetect_agent/web/native-screen.js')});
    const result=await page.evaluate(async()=>{
      let frames=0,allowed=true;const calls=[];
      const native=createNativeScreen(async(command)=>{
        calls.push(command);
        if(command==='agent_unattended_status')return {enabled:allowed};
        frames++;const data=new ArrayBuffer(16+32*24*3/2),view=new DataView(data);
        view.setUint32(0,32,true);view.setUint32(4,24,true);view.setBigUint64(8,BigInt(frames),true);new Uint8Array(data,16).fill(255);return data;
      });
      const stream=await native.acquire();
      const idle=frames;
      await native.resume();await new Promise(r=>setTimeout(r,150));native.pause();
      const paused=frames;await new Promise(r=>setTimeout(r,80));
      const unchanged=frames===paused;
      native.stop();allowed=false;
      let denied=false;try{await native.acquire();}catch{denied=true;}
      return {idle,paused,unchanged,denied,track:stream.getVideoTracks()[0].readyState,calls};
    });
    assert.equal(result.idle,0);
    assert.ok(result.paused>0);
    assert.equal(result.unchanged,true);
    assert.equal(result.denied,true);
    assert.equal(result.track,'ended');
    assert.ok(result.calls.includes('agent_native_frame'));
  }finally{await browser.close();}
});

test('Agent configures password without persisting plaintext and resumes native video after restart',async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();
    await page.setContent('<form id="agentUnattendedForm"><input id="agentAccessPassword" type="password"><input id="agentAccessPasswordConfirm" type="password"><button>Save</button></form><p id="agentUnattendedStatus"></p><button id="agentUnattendedDisable">Disable</button>');
    await page.addScriptTag({path:path.join(root,'flowdetect_agent/web/unattended.js')});
    await page.evaluate(()=>{
      window.calls=[];window.enables=0;window.stops=0;
      initUnattended({invoke:async(command,args)=>{calls.push({command,args});return {enabled:command==='agent_unattended_status'?true:args.enabled};},
        video:{enable:async()=>{enables++;},stop:()=>{stops++;}},native:{stop:()=>{}}});
    });
    await page.waitForFunction(()=>enables===1);
    await page.locator('#agentAccessPassword').fill('Secure example password 123!');
    await page.locator('#agentAccessPasswordConfirm').fill('Secure example password 123!');
    await page.locator('form button').click();
    await page.waitForFunction(()=>enables===2);
    assert.equal(await page.locator('#agentAccessPassword').inputValue(),'');
    assert.equal(await page.locator('#agentAccessPasswordConfirm').inputValue(),'');
    await page.locator('#agentUnattendedDisable').click();
    await page.waitForFunction(()=>calls.some(c=>c.command==='agent_unattended_configure'&&c.args.enabled===false));
    assert.ok(await page.evaluate(()=>stops>=2));
    assert.equal(await page.evaluate(()=>document.body.innerHTML.includes('Secure example password')),false);
  }finally{await browser.close();}
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');

test('compact popup keeps pages legible and never clips action buttons',async()=>{
  const root=path.resolve(__dirname,'../flowdetect_chrome');
  const server=http.createServer(async(req,res)=>{
    try{
      const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
      if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
      res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[path.extname(file)]||'application/octet-stream');
      res.end(await fs.readFile(file));
    }catch{res.writeHead(404).end()}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  let browser;
  try{
    browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
    const page=await browser.newPage({viewport:{width:390,height:600}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      const pages=[
        {id:'one',name:'Página 1',slot:1,color:'#12b5cb',tabId:12,tabTitle:'Portal Nibo - relatório contábil, fiscal, automações e lançamentos completos - empresa muito longa'},
        {id:'two',name:'Página 2',slot:2,color:'#8b5cf6',tabId:22,tabTitle:'ERP / Cliente - Importação de notas fiscais de vários fornecedores e datas extremamente longas'}
      ];

      const names=['FGTS_GUIAS','NF Entrada - Notas fiscais','Conciliação de boletos','Importação e validação fiscal'];
      const automations=names.map((name,i)=>({
        id:'automation-'+i,pageId:'one',schema:'flowdetect_chrome_automation',version:3,
        automation:{nome:name,descricao:'Automação para executar nesta aba do navegador.',source:'FlowDetect Studio'},
        steps:Array.from({length:i===0?18:4},(_,index)=>({type:'focused_text',source_order:index+1,text:'Teste'}))
      }));
      window.chrome={
        storage:{
          local:{get:async key=>({[key]:key==='flowdetectChromeAutomations'?automations:null}),set:async()=>{}},
          session:{get:async()=>({}),set:async()=>{}},
          onChanged:{addListener:()=>{}},
        },
        runtime:{sendMessage:async message=>{
          if(message.type==='flowdetect-pages')return {ok:true,pages,runs:{}};
          if(message.type==='flowdetect-studio-connection')return {studioFound:false,connected:false};
          return {ok:true,version:'0.2.65'};
        }},
        tabs:{query:async()=>[{id:12,title:pages[0].tabTitle,url:'https://example.test',windowId:1}],get:async id=>({id,url:'https://example.test',title:pages.find(p=>p.tabId===id)?.tabTitle,windowId:1}),onActivated:{addListener:()=>{}},onUpdated:{addListener:()=>{}}},
        windows:{onFocusChanged:{addListener:()=>{}},update:async()=>{}}
      };
    });
    await page.goto('http://127.0.0.1:'+server.address().port+'/sidepanel.html');
    await page.locator('.execution-page-card').nth(1).waitFor();
    const pageLayout = await page.evaluate(() => {
      const heading = document.querySelector('.execution-pages-heading').getBoundingClientRect();
      const tabs = document.querySelector('#executionPageTabs').getBoundingClientRect();
      const target = document.querySelector('.execution-page-target').getBoundingClientRect();
      return { headingBottom: heading.bottom, tabsTop: tabs.top, tabsBottom: tabs.bottom, targetTop: target.top,
        numbers: [...document.querySelectorAll('.execution-page-number')].map(el => el.textContent),
        selectedLabel: document.querySelector('.execution-page-select[aria-selected="true"]').getAttribute('aria-label') };
    });
    assert.ok(pageLayout.tabsTop >= pageLayout.headingBottom, 'Page numbers belong below the heading');
    assert.ok(pageLayout.targetTop >= pageLayout.tabsBottom, 'Linked site belongs below page numbers');
    assert.deepEqual(pageLayout.numbers, ['1', '2']);
    assert.match(pageLayout.selectedLabel, /Página 1, Pronta/);
    assert.equal(await page.locator('.execution-page-state').first().isVisible(), false);
    const themes = await page.evaluate(() => {
      const original = selectedPageId;
      const result = executionPages.slice(0, 2).map(p => {
        selectExecutionPage(p.id);
        return {
          accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
          workspace: getComputedStyle(document.querySelector('.workspace-tab.is-active')).backgroundImage,
          importBorder: getComputedStyle(document.querySelector('.import-automation')).borderColor,
        };
      });
      selectExecutionPage(original);
      return result;
    });
    assert.notEqual(themes[0].accent, themes[1].accent);
    assert.notEqual(themes[0].workspace, themes[1].workspace);
    assert.notEqual(themes[0].importBorder, themes[1].importBorder);
    const switching = await page.evaluate(() => {
      const sharedLayout = () => ['.popup-toolbar','.popup-tools','.studio-pair-bar','#mapElementButton','#workspaceTabs']
        .map(selector => {
          const el = document.querySelector(selector), rect = el.getBoundingClientRect();
          return { selector, top: rect.top, left: rect.left, width: rect.width, height: rect.height, display: getComputedStyle(el).display };
        });
      window.sharedBeforeSwitch = sharedLayout();
      setWorkspaceView('assisted');
      window.sharedDuringSwitch = sharedLayout();
      const first = workspaceAnimations[0];
      const duration = first.effect.getTiming().duration;
      setWorkspaceView('automations');
      window.sharedAfterSwitch = sharedLayout();
      const second = workspaceAnimations[0];
      renderAutomations();
      return { duration, cancelled: first.playState === 'idle', count: workspaceAnimations.length,
        preserved: second === workspaceAnimations[0],
        automationsVisible: !document.querySelector('#automationList').hidden,
        assistedHidden: document.querySelector('#assistedView').hidden };
    });
    assert.deepEqual(switching, { duration: 180, cancelled: true, count: 2, preserved: true,
      automationsVisible: true, assistedHidden: true });
    const shared = await page.evaluate(() => ({ before: sharedBeforeSwitch, during: sharedDuringSwitch, after: sharedAfterSwitch }));
    assert.deepEqual(shared.during, shared.before, 'Shared header and navigation must not hide or move in assisted view');
    assert.deepEqual(shared.after, shared.before, 'Returning to automations must not move shared controls');
    await page.waitForTimeout(200);
    const selectedStyle = await page.locator('.execution-page-card.is-selected').evaluate(el => ({
      radius: getComputedStyle(el).borderRadius,
      background: getComputedStyle(el).backgroundImage,
      text: getComputedStyle(el.querySelector('.execution-page-number')).color,
    }));
    assert.equal(selectedStyle.radius, '50%');
    assert.match(selectedStyle.background, /linear-gradient/);
    assert.equal(selectedStyle.text, 'rgb(239, 253, 255)');

    await page.locator('.automation-flip-tile').nth(3).waitFor();
    const gallery=await page.locator('.automation-flip-tile').evaluateAll(tiles=>tiles.map(tile=>{
      const rect=tile.getBoundingClientRect();return {x:rect.left,y:rect.top,width:rect.width,height:rect.height};
    }));
    assert.equal(gallery.length,4,'Four compact automation cards');
    assert.ok(gallery.every(item=>item.width>=100&&item.width<=125&&item.height<=155),JSON.stringify(gallery));
    assert.ok(Math.abs(gallery[0].y-gallery[1].y)<2&&Math.abs(gallery[1].y-gallery[2].y)<2,JSON.stringify(gallery));
    assert.ok(gallery[3].y>gallery[0].y+50,JSON.stringify(gallery));
    if(process.env.FLOWDETECT_TEST_SCREENSHOT_DIR){
      await fs.mkdir(process.env.FLOWDETECT_TEST_SCREENSHOT_DIR,{recursive:true});
      await page.screenshot({path:path.join(process.env.FLOWDETECT_TEST_SCREENSHOT_DIR,'flip-gallery-390.png')});
    }
    assert.equal(await page.locator('.automation-tile-action').first().textContent(),'▶ Executar');
    assert.equal(await page.locator('.automation-tile-percent').first().textContent(),'0%');
    await page.locator('.automation-tile-open').first().click();
    await page.locator('.automation-flip-detail').waitFor();
    assert.equal(await page.locator('.automation-flip-detail .automation-name').textContent(),'FGTS_GUIAS');
    assert.equal(await page.locator('.automation-flip-detail .step-count').textContent(),'18 blocos');
    assert.equal(await page.locator('.automation-flip-detail .run-automation').isVisible(),true);
    assert.equal(await page.locator('.automation-flip-detail .download-settings').count(),1);
    // The full editor must expand inside its own tile, never in a detached card at the bottom.
    const inPlace=await page.locator('.automation-flip-detail').evaluate(card=>{
      const parent=card.closest('.automation-flip-item');
      const tiles=[...document.querySelectorAll('.automation-list > .automation-flip-item')];
      return {parentId:parent?.dataset.automationId,position:tiles.indexOf(parent),
        expanded:parent?.classList.contains('is-expanded'),
        gridColumn:getComputedStyle(parent).gridColumn,
        animation:getComputedStyle(parent).animationName,
        nestedDetails:parent?.querySelectorAll('.automation-flip-detail').length,
        detached:document.querySelectorAll('.automation-list > .automation-flip-detail').length};
    });
    assert.equal(inPlace.parentId,'automation-0');
    assert.equal(inPlace.position,0,'The card itself expands in its original grid position');
    assert.equal(inPlace.expanded,true);
    assert.equal(inPlace.nestedDetails,1);
    assert.equal(inPlace.detached,0,'No second card may be rendered');
    assert.equal(inPlace.animation,'none','The expansion must not rotate/flip anymore');
    assert.equal(await page.locator('.automation-flip-detail .execution').count(),0,
      'Assisted execution must never appear inside the expanded configuration card');
    const configSize=await page.locator('.automation-flip-item.is-expanded').evaluate(el=>el.getBoundingClientRect().height);
    assert.ok(configSize<=275,'Expanded configuration should fit without scrolling: '+configSize);
    assert.equal(await page.locator('.automation-flip-detail .run-automation').isVisible(),true);
    await page.waitForTimeout(420); // Wait for card flip to settle before screenshot.
    if(process.env.FLOWDETECT_TEST_SCREENSHOT_DIR){
      await page.screenshot({path:path.join(process.env.FLOWDETECT_TEST_SCREENSHOT_DIR,'flip-expanded-390.png')});
    }
    // Settings use the available width, with content-led height and no scrolling.
    await page.evaluate(() => {
      const items = structuredClone(automationsCache);
      items[0].steps[0] = {type:'data_source',name:'CNPJ',source_order:1,
        values:Array.from({length:33},(_,i)=>String(i)),
        rows:Array.from({length:33},(_,i)=>({CNPJ:String(i),Empresa:`Empresa ${i+1}`}))};
      for(let i=1;i<8;i++) items[0].steps[i]={type:'ocr_text',editable_ocr:true,text:`Texto ${i}`,source_order:i+1};
      renderAutomations(items);
    });
    await page.locator('.automation-configure').click();
    const checkInlineFit = async () => {
      await page.waitForTimeout(50);
      const fit = await page.evaluate(() => {
        const card = document.querySelector('.automation-flip-detail');
        const box = card.getBoundingClientRect();
        const list = document.querySelector('#automationList');
        const visible = [...card.querySelectorAll('input,select,button')].filter(el=>el.getClientRects().length);
        return {width:box.width,height:box.height,bottom:box.bottom, scroll:card.scrollHeight,client:card.clientHeight,
          listScroll:list.scrollHeight,listHeight:list.clientHeight,
          clipped:visible.filter(el=>{const r=el.getBoundingClientRect();return r.bottom>box.bottom||r.right>box.right||r.left<box.left;}).map(el=>el.className)};
      });
      assert.ok(fit.width>=340 && fit.width<=374 && fit.bottom<=600,JSON.stringify(fit));
      assert.ok(fit.scroll<=fit.client+1 && fit.listScroll<=fit.listHeight+1,JSON.stringify(fit));
      assert.deepEqual(fit.clipped,[],JSON.stringify(fit));
    };
    assert.equal(await page.locator('.screen-guard-settings').count(),0);
    for(const section of ['loop-edit-settings','ocr-edit-settings','download-settings']) {
      await page.locator('.card-settings-choice').selectOption(section);
      await checkInlineFit();
      if(process.env.FLOWDETECT_TEST_SCREENSHOT_DIR) await page.screenshot({animations:'disabled',path:path.join(process.env.FLOWDETECT_TEST_SCREENSHOT_DIR,`inline-${section}.png`)});
    }
    await page.locator('.card-settings-choice').selectOption('loop-edit-settings');
    assert.equal(await page.locator('.loop-edit-row').count(),2);
    await page.locator('.loop-edit-settings .card-settings-pager button').last().click();
    assert.match(await page.locator('.loop-edit-list').textContent(),/Empresa 3/);
    await page.locator('.loop-edit-row input').first().uncheck();
    assert.match(await page.locator('.loop-edit-count').textContent(),/32\/33/);
    await page.locator('.loop-edit-search').fill('Empresa 33');
    assert.equal(await page.locator('.loop-edit-row').count(),1);
    await checkInlineFit();
    await page.locator('.loop-selection-actions').selectOption('exclude');
    assert.match(await page.locator('.loop-edit-count').textContent(),/31\/33/);
    await page.locator('.loop-selection-actions').selectOption('include');
    assert.match(await page.locator('.loop-edit-count').textContent(),/32\/33/);
    await page.locator('.loop-selection-actions').selectOption('all');
    assert.match(await page.locator('.loop-edit-count').textContent(),/33\/33/);
    assert.equal(await page.locator('.loop-selection-actions').inputValue(),'');
    await page.locator('.loop-save-exclusions').check();
    await page.locator('.card-settings-choice').selectOption('ocr-edit-settings');
    await page.locator('.ocr-edit-fields input:visible').first().fill('Edição preservada');
    await page.locator('.ocr-edit-settings .card-settings-pager button').last().click();
    assert.equal(await page.locator('.ocr-edit-fields input:visible').first().inputValue(),'Texto 3');
    await page.locator('.ocr-edit-settings .card-settings-pager button').first().click();
    assert.equal(await page.locator('.ocr-edit-fields input:visible').first().inputValue(),'Edição preservada');
    await page.locator('.automation-configure').click();
    await checkInlineFit();
    if(process.env.FLOWDETECT_TEST_SCREENSHOT_DIR) await page.screenshot({animations:'disabled',path:path.join(process.env.FLOWDETECT_TEST_SCREENSHOT_DIR,'square-home-companies.png')});
    await page.locator('.automation-configure').click();
    await page.locator('.card-settings-choice').selectOption('ocr-edit-settings');
    await page.locator('.ocr-edit-settings .card-settings-pager button').last().click();
    await page.locator('.ocr-edit-settings .card-settings-pager button').last().click();
    await page.locator('.ocr-edit-fields input:visible').first().fill('');
    await page.locator('.automation-configure').click();
    await page.locator('.run-automation').click();
    assert.equal(await page.locator('.card-settings-choice').inputValue(),'ocr-edit-settings');
    assert.equal(await page.locator('.ocr-edit-error').isVisible(),true);
    assert.equal(await page.locator('.ocr-edit-fields input:visible').first().inputValue(),'');
    await checkInlineFit();
    await page.locator('.ocr-edit-fields input:visible').first().fill('Texto corrigido');
    await page.locator('.automation-configure').click();
    await page.locator('.automation-flip-close').click();
    await page.waitForFunction(()=>document.querySelectorAll('.automation-flip-detail').length===0);
    assert.equal(await page.locator('.automation-flip-item.is-expanded').count(),0);
    assert.equal(await page.locator('.automation-flip-tile').count(),4);
    await page.locator('.execution-page-select').nth(1).click();
    assert.equal(await page.locator('.automation-flip-tile').count(),0,'No leaks to Page 2');
    await page.locator('.execution-page-select').first().click();
    assert.equal(await page.locator('.automation-flip-tile').count(),4,'Page 1 preserved');
    await page.locator('#workspaceAssisted').click();
    assert.equal(await page.locator('#automationList').isVisible(),false);
    assert.equal(await page.locator('#assistedContent .assisted-empty').count(),1);
    assert.equal(await page.locator('#assistedPageSelect option').count(),2);
    if(process.env.FLOWDETECT_TEST_SCREENSHOT_DIR) {
      await page.screenshot({path:path.join(process.env.FLOWDETECT_TEST_SCREENSHOT_DIR,'assisted-empty.png')});
    }
    await page.locator('#workspaceAutomations').click();
    assert.equal(await page.locator('#automationList').isVisible(),true);

    for(const width of [390,410,460]){
      await page.setViewportSize({width,height:600});
      const m=await page.evaluate(()=>{
        const selectors=['.app-shell','.execution-pages','.execution-pages-heading','#addExecutionPage','#executionPageTabs','.execution-page-card','.execution-page-select','.execution-page-delete','.execution-page-target','#executionPageTarget','.execution-page-actions','#bindExecutionPage','#openExecutionPage','.execution-pages-note'];
        const all=selectors.flatMap(selector=>[...document.querySelectorAll(selector)]);
        const errors=all.filter(element=>{
          if(element.closest('[hidden]')||getComputedStyle(element).display==='none')return false;
          const b=element.getBoundingClientRect();
          return b.width>1 && (b.left< -1||b.right>innerWidth+1);
        }).map(x=>x.className||x.id);
        const cards=[...document.querySelectorAll('.execution-page-card')].map(c=>{
          const b=c.getBoundingClientRect();return {width:b.width,color:getComputedStyle(c).getPropertyValue('--page-accent').trim(),height:b.height};
        });
        return {scrollWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,
          viewport:innerWidth,errors,cards,
          scrollable:getComputedStyle(document.querySelector('.automation-list')).overflowY,
          targetOverflow:getComputedStyle(document.querySelector('#executionPageTarget')).overflowWrap};
      });
      console.log('LAYOUT',JSON.stringify(m));
      assert.equal(m.errors.length,0,'Components overflow: '+JSON.stringify(m));
      assert.ok(m.scrollWidth<=width && m.bodyWidth<=width+1,JSON.stringify(m));
      assert.deepEqual(m.cards.map(c=>c.color),['#12b5cb','#8b5cf6']);
      assert.ok(m.cards.every(c=>c.width===34 && c.height===34),JSON.stringify(m));
      const areas=await page.evaluate(()=>({switcher:document.querySelector('.execution-pages').getBoundingClientRect().height,automation:document.querySelector('.automation-list').getBoundingClientRect().height}));
      assert.ok(areas.switcher<=140,'Three-row page selector must remain compact: '+JSON.stringify(areas));
      assert.ok(areas.automation>=230,'Automation workspace must be larger than page selector: '+JSON.stringify(areas));
      assert.equal(m.scrollable,'auto');
      if(process.env.FLOWDETECT_TEST_SCREENSHOT_DIR){
        await fs.mkdir(process.env.FLOWDETECT_TEST_SCREENSHOT_DIR,{recursive:true});
        await page.screenshot({animations:'disabled',path:path.join(process.env.FLOWDETECT_TEST_SCREENSHOT_DIR,'popup-'+width+'.png')});
      }
    }
    // Twelve numeric tabs remain reachable without widening the popup.
    await page.evaluate(() => {
      for (let slot = 3; slot <= 12; slot++) executionPages.push({ id: `extra-${slot}`, name: `Página ${slot}`, slot, tabId: null });
      renderExecutionPages();
    });
    await page.locator('.execution-page-select').last().click();
    assert.equal(await page.locator('.execution-page-select[aria-selected="true"] .execution-page-number').textContent(), '12');
    assert.ok(await page.locator('#executionPageTabs').evaluate(el => el.scrollWidth > el.clientWidth && el.scrollLeft > 0));
    await page.locator('.execution-page-delete').last().focus();
    await page.waitForFunction(() => getComputedStyle(document.activeElement).opacity === '1');
    assert.equal(await page.locator('.execution-page-delete').last().getAttribute('aria-label'), 'Excluir Página 12');
    await page.evaluate(() => {
      pageRuns.set('extra-12', { id: 'motion-test', pageId: 'extra-12', status: 'running' });
      renderExecutionPages();
      document.querySelector('.execution-page-card.is-selected .execution-page-select').focus();
    });
    await page.waitForTimeout(180);
    const motion = await page.evaluate(() => {
      const nav = document.querySelector('#executionPageTabs');
      const card = nav.querySelector('.is-selected');
      const focus = document.activeElement;
      const scroll = nav.scrollLeft;
      const orbit = card.getAnimations({ subtree: true }).find(a => a.animationName === 'execution-page-orbit');
      for (let i = 0; i < 8; i++) renderExecutionPages();
      return { sameNode: card === nav.querySelector('.is-selected'), sameFocus: focus === document.activeElement,
        sameScroll: scroll === nav.scrollLeft, orbit: Boolean(orbit),
        sameAnimation: card.getAnimations({ subtree: true }).includes(orbit),
        runningAnimation: getComputedStyle(card, '::after').animationName };
    });
    assert.deepEqual(motion, { sameNode: true, sameFocus: true, sameScroll: true, orbit: true,
      sameAnimation: true, runningAnimation: 'execution-page-orbit' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.evaluate(() => { setWorkspaceView('assisted'); return workspaceAnimations.length; }), 0);
    await page.evaluate(() => setWorkspaceView('automations'));
    assert.equal(await page.locator('.execution-page-card.is-selected').evaluate(el => getComputedStyle(el, '::after').animationName), 'none');
    assert.equal(await page.locator('.execution-page-card.is-selected .execution-page-state').evaluate(el => getComputedStyle(el).animationName), 'none');
    // Initialization without animation must preserve the shared header too.
    await page.evaluate(() => {
      window.headerBeforeReopen = document.querySelector('.popup-fixed-header').getBoundingClientRect().toJSON();
      setWorkspaceView('assisted', false);
      renderAutomations();
    });
    const fixedHeader = await page.evaluate(() => ({
      before: window.headerBeforeReopen,
      after: document.querySelector('.popup-fixed-header').getBoundingClientRect().toJSON(),
      visible: ['.popup-tools','.studio-pair-bar','#mapElementButton'].every(selector => getComputedStyle(document.querySelector(selector)).display !== 'none'),
      animated: document.querySelector('.popup-fixed-header').getAnimations().length,
    }));
    assert.deepEqual(fixedHeader.after, fixedHeader.before);
    assert.equal(fixedHeader.visible, true);
    assert.equal(fixedHeader.animated, 0);
    assert.deepEqual(errors,[]);
  }finally{await browser?.close();await new Promise(r=>server.close(r))}
});

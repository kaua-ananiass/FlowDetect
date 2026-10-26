const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

test('execution pages: distinct tabs, independent runs, deletion and responsive popup', async () => {
  const root = path.resolve(__dirname, '../flowdetect_chrome');
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      const file = path.resolve(root, '.' + pathname);
      if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
      res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[path.extname(file)] || 'application/octet-stream');
      res.end(await fs.readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({headless:true, ...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {})});
    const page = await browser.newPage({viewport:{width:390,height:600}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const pagesKey = 'flowdetectChromeExecutionPages', runPrefix = 'flowdetectChromePageRun:';
      const automation = {
        id:'demo', schema:'flowdetect_chrome_automation', version:3,
        screen_guard:{enabled:true,url:'https://old-start-screen.invalid/',text:'Legacy gate'},
        automation:{nome:'Automação de teste'}, steps:[
          {type:'ocr_text',text:'Pesquisar',source_order:1,sequence:'principal',preview_image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9T1hFbAAAAAASUVORK5CYII='},
          {type:'focused_text',text:'Teste',source_order:2,sequence:'principal'}]
      };
      const db = JSON.parse(sessionStorage.getItem('test-db') || 'null') || {
        flowdetectChromeAutomations:[automation],
        [pagesKey]:[{id:'p1',name:'Página 1',slot:1,color:'#12b5cb',tabId:null,tabTitle:''}]
      };
      const session = JSON.parse(sessionStorage.getItem('test-session') || '{}');
      const listeners = [];
      const pending = {};
      window.activeTestTab = 11;
      window.messages = [];
      window.confirm = () => true;
      window.alert = text => { throw Error(text); };
      const save = () => { sessionStorage.setItem('test-db', JSON.stringify(db)); sessionStorage.setItem('test-session', JSON.stringify(session)); };
      const publish = async values => {
        Object.assign(db, structuredClone(values)); save();
        for(const callback of listeners) callback(Object.fromEntries(Object.entries(values).map(([key,newValue]) => [key,{newValue}])), 'local');
      };
      const tab = id => ({
        id, windowId:1,
        title:id===11 ? 'Portal Nibo / Empresa X - Relatórios fiscais muito detalhados com nome grande' : `ERP do Cliente - Site ${id}`,
        url:`https://example.test/${id}`
      });
      window.finishRun = async (pageId,status='completed') => {
        const run = {...db[runPrefix+pageId],status,currentStep:2,logs:[{message:`${pageId} terminou`}]};
        await publish({[runPrefix+pageId]:run});
        pending[pageId]?.({ok:true,run});
      };
      window.progressRun = async (pageId,percent) => {
        const key=runPrefix+pageId;
        const run={...db[key],progressPercent:percent,currentStep:Math.floor(percent/50)};
        await publish({[key]:run});
      };
      window.chrome = {
        storage:{
          local:{
            get:async key => ({[key]:db[key]}),
            set:publish,
            remove:async key => { delete db[key]; save(); }
          },
          session:{
            get:async key => ({[key]:session[key]}),
            set:async values => {Object.assign(session,values);save();}
          },
          onChanged:{addListener:listener => listeners.push(listener)}
        },
        tabs:{
          create:async options => { window.createdTab = options; },
          query:async () => [tab(activeTestTab)],
          get:async id => tab(id),
          update:async id => {activeTestTab=id;return tab(id);}
        },
        windows:{update:async()=>{}},
        runtime:{getURL:pathname => new URL(pathname, location.href).href, sendMessage:async message => {
          messages.push(message);
          if(message.type==='flowdetect-pages') return {
            ok:true,pages:db[pagesKey],
            runs:Object.fromEntries(db[pagesKey].filter(p=>db[runPrefix+p.id]).map(p=>[p.id,db[runPrefix+p.id]]))
          };
          if(message.type==='flowdetect-page-create'){
            const used=new Set(db[pagesKey].map(p=>p.slot));
            let slot=1;while(used.has(slot))slot++;
            const colors=['#12b5cb','#8b5cf6','#4ade80','#f59e0b'];
            const item={id:`p${Math.random()}`,name:`Página ${slot}`,slot,color:colors[(slot-1)%4],tabId:null,tabTitle:''};
            db[pagesKey].push(item);
            await publish({[pagesKey]:db[pagesKey]});
            return {ok:true,page:item};
          }
          if(message.type==='flowdetect-page-bind'){
            const item=db[pagesKey].find(p=>p.id===message.pageId);
            if(!item)return {ok:false,error:'Página não encontrada'};
            if(db[pagesKey].some(p=>p.id!==item.id&&p.tabId===message.tabId)) return {ok:false,error:'Esta aba já pertence a outra página'};
            item.tabId=message.tabId;item.tabTitle=tab(message.tabId).title;
            await publish({[pagesKey]:db[pagesKey]});return {ok:true,page:item};
          }
          if(message.type==='flowdetect-page-delete'){
            db[pagesKey]=db[pagesKey].filter(p=>p.id!==message.pageId);
            delete db[runPrefix+message.pageId];
            await publish({[pagesKey]:db[pagesKey]});
            return {ok:true,pageId:message.pageId};
          }
          if(message.type==='flowdetect-start'){
            const run={id:`r-${message.pageId}`,pageId:message.pageId,
              automationId:message.automation.id,automationSnapshot:message.automation,
              status:'running',currentStep:0,currentIndex:0,totalSteps:2,
              logs:[{message:`Executando ${message.pageId}`}]};
            await publish({[runPrefix+message.pageId]:run});
            return new Promise(resolve=>{pending[message.pageId]=resolve;});
          }
          if(message.type==='flowdetect-stop'){
            await finishRun(message.pageId,'stopped');return {ok:true};
          }
          return {ok:true,ready:true,version:'0.2.65'};
        }}
      };
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/sidepanel.html`);
    const selected = () => page.locator('#executionPageTabs .execution-page-select[aria-current="page"]');
    await selected().waitFor();
    await page.locator('#bindExecutionPage').click();
    await page.waitForFunction(() => document.querySelector('#executionPageTarget')?.textContent.includes('Portal Nibo'));
    assert.equal(await page.locator('.execution-page-card.is-linked').count(),1);
    await page.locator('.automation-flip-tile').first().click();
    await page.locator('.automation-flip-detail .run-automation').click();
    await page.waitForFunction(() => document.querySelectorAll('.execution-page-card.is-running').length===1);
    assert.equal(await page.locator('#workspaceAutomations').getAttribute('aria-selected'),'true');
    assert.equal(await page.locator('.automation-flip-detail .execution').count(),0,'Execution UI must not be inside settings');
    assert.equal(await page.locator('.assisted-view:not([hidden])').count(),0);
    await page.evaluate(() => { activeTestTab = 22; });
    await page.locator('#addExecutionPage').click();
    await page.waitForFunction(() => document.querySelectorAll('.execution-page-card').length===2);
    assert.match(await selected().textContent(),/Pág\. 2/);
    assert.equal(await page.locator('.automation-flip-detail .execution').count(),0);
    // The imported item from Page 1 must not leak into Page 2.
    assert.equal(await page.locator('.automation-card').count(),0);
    assert.equal(await page.locator('.automation-import-card').count(),1);
    await page.locator('#importInput').setInputFiles({
      name: 'fluxo-pagina-2.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({
        schema:'flowdetect_chrome_automation',version:3,
        automation:{nome:'Fluxo Exclusivo Página 2',descricao:'Esta automação fica somente na segunda página.'},
        steps:[{type:'ocr_text',text:'Pesquisar',source_order:1,sequence:'principal'},
          {type:'focused_text',text:'Teste',source_order:2,sequence:'principal'}]
      }))
    });
    await page.waitForFunction(()=>document.querySelector('.automation-tile-name')?.textContent==='Fluxo Exclusivo Página 2');
    assert.equal(await page.locator('.automation-flip-tile').count(),1);
    assert.equal(await page.locator('.automation-flip-detail').count(),0);
    const pageTwoAutomation = await page.locator('.automation-flip-tile').evaluate((card)=>
      ({owner:card.dataset.pageId,accent:getComputedStyle(card).getPropertyValue('--automation-card-accent').trim()}));
    assert.equal(pageTwoAutomation.accent,'#8b5cf6');
    assert.ok(pageTwoAutomation.owner.startsWith('p'));
    await page.locator('#bindExecutionPage').click();
    await page.waitForFunction(() => document.querySelectorAll('.execution-page-card.is-linked').length===2);
    const cards=page.locator('.execution-page-card');
    assert.equal(await cards.nth(0).evaluate(el=>getComputedStyle(el).getPropertyValue('--page-accent').trim()),'#12b5cb');
    assert.equal(await cards.nth(1).evaluate(el=>getComputedStyle(el).getPropertyValue('--page-accent').trim()),'#8b5cf6');
    const pageTwoId=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('test-db')).flowdetectChromeExecutionPages[1].id);
    assert.equal(await page.locator('.automation-tile-percent').first().textContent(),'0%');
    // Direct run from the mini-card must NOT expand it or switch to full-screen execution.
    await page.locator('.automation-tile-action').first().click();
    await page.waitForFunction(() => [...document.querySelectorAll('.execution-page-state')].filter(el=>el.textContent.includes('Executando')).length===2);
    assert.equal(await page.locator('.automation-flip-detail').count(),0);
    assert.equal(await page.locator('.automation-tile-action.is-stop').count(),1);
    await page.evaluate(id=>progressRun(id,47),pageTwoId);
    await page.waitForFunction(()=>document.querySelector('.automation-tile-percent')?.textContent==='47%');
    assert.equal(await page.locator('.automation-tile-progress').first().getAttribute('aria-valuenow'),'47');
    await page.locator('#workspaceAssisted').click();
    await page.waitForFunction(()=>document.querySelector('#assistedContent .execution-percent')?.textContent==='47%');
    assert.equal(await page.locator('#assistedView').isVisible(),true);
    assert.equal(await page.locator('#automationList').isVisible(),false);
    assert.equal(await page.locator('#assistedContent .block-carousel-preview').count(),1);
    assert.equal(await page.locator('#assistedPageSelect option').count(),2);
    if(process.env.FLOWDETECT_TEST_SCREENSHOT_DIR) {
      await fs.mkdir(process.env.FLOWDETECT_TEST_SCREENSHOT_DIR,{recursive:true});
      await page.screenshot({path:path.join(process.env.FLOWDETECT_TEST_SCREENSHOT_DIR,'assisted-page-two.png')});
    }
    await page.locator('#assistedPageSelect').selectOption('p1');
    assert.match(await page.locator('.assisted-run-title strong').textContent(),/Automação de teste/);
    await page.locator('#assistedPageSelect').selectOption(pageTwoId);
    assert.equal(await page.locator('#assistedContent .execution-percent').textContent(),'47%');
    await page.locator('#workspaceAutomations').click();
    assert.equal(await page.locator('.automation-tile-percent').first().textContent(),'47%');
    // Stopping Page 2 in its mini-card does not stop Page 1.
    await page.locator('.automation-tile-action.is-stop').click();
    await page.waitForFunction(()=>document.querySelector('.automation-tile-status')?.textContent==='Parada');
    assert.match(await page.locator('.execution-page-select').first().textContent(),/Pág\. 1/);
    assert.equal(await page.locator('.execution-page-card.is-running').count(),1);
    await page.locator('.automation-tile-action:not(:disabled)').first().click();
    await page.waitForFunction(()=>document.querySelector('.automation-tile-action.is-stop')!==null);
    assert.equal(await page.locator('.automation-flip-detail').count(),0);
    await page.locator('.execution-page-select').first().click();
    assert.equal(await page.locator('.automation-name').first().textContent(),'Automação de teste');
    assert.equal(await page.locator('.automation-flip-detail .execution').count(),0);
    assert.equal(await page.locator('.automation-name').filter({hasText:'Fluxo Exclusivo Página 2'}).count(),0);
    await page.locator('#workspaceAssisted').click();
    assert.match(await page.locator('#assistedContent .run-log').textContent(),/Executando p1/);
    assert.equal(await page.locator('#assistedPageSelect').inputValue(),'p1');
    assert.equal(await page.locator('#assistedContent .block-carousel').count(),1);
    await page.locator('#assistedContent .block-carousel-image').waitFor({state:'visible'});
    // Regression: failed OCR + 33-company selector must leave live rows visible at 390x600.
    await page.evaluate(() => {
      window.compactOriginalRun = pageRuns.get('p1');
      const original = window.compactOriginalRun;
      const snapshot = structuredClone(original.automationSnapshot);
      snapshot.steps.push({ type: 'data_source', name: 'CNPJ',
        values: Array.from({ length: 33 }, (_, i) => String(i)),
        rows: Array.from({ length: 33 }, (_, i) => ({ CNPJ: String(i), Empresa: `Empresa de teste ${i + 1}` })) });
      updateRun({ ...original, status: 'failed', automationSnapshot: snapshot,
        recentSteps: [
          { serial: 1, index: 1, state: 'done', message: 'Etapa concluída.' },
          { serial: 2, index: 1, state: 'done', message: 'Etapa concluída.' },
          { serial: 3, index: 0, state: 'failed', message: 'OCR não encontrou o texto esperado. Recarregue a página do site após atualizar a extensão FlowDetect. Mensagem longa para verificar o resumo sem esconder os controles.' }
        ] });
    });
    await page.waitForTimeout(220);
    const compact = await page.evaluate(() => {
      const live = document.querySelector('#assistedContent .live-steps');
      const row = live.querySelector('.live-step');
      const box = live.getBoundingClientRect(), rowBox = row.getBoundingClientRect();
      const panel = document.querySelector('#assistedContent').getBoundingClientRect();
      const controls = document.querySelector('#assistedContent .block-carousel-controls').getBoundingClientRect();
      const report = document.querySelector('#assistedContent .report-button').getBoundingClientRect();
      return { liveTop: box.top, rowBottom: rowBox.bottom, panelBottom: panel.bottom,
        viewport: innerHeight, companyCount: document.querySelector('#assistedContent .execution-company-choice').options.length,
        reportInControls: report.top >= controls.top && report.bottom <= controls.bottom + 1 };
    });
    assert.ok(compact.companyCount >= 33, JSON.stringify(compact));
    assert.ok(compact.liveTop > 0 && compact.rowBottom <= Math.min(compact.viewport, compact.panelBottom), JSON.stringify(compact));
    assert.equal(compact.reportInControls, true);
    const assertNoMonitorScroll = async () => {
      const layout = await page.evaluate(() => {
        const nodes = ['.app-shell', '#assistedView', '#assistedContent', '.assisted-execution',
          '#assistedContent .block-carousel-stage', '#assistedContent .live-steps-list'];
        const overflow = nodes.map(s => document.querySelector(s)).filter(el => el.scrollHeight > el.clientHeight + 1)
          .map(el => ({ name: el.className, height: el.clientHeight, scroll: el.scrollHeight }));
        const history = document.querySelector('#assistedContent summary').getBoundingClientRect();
        const live = [...document.querySelectorAll('#assistedContent .live-step')].map(el => el.getBoundingClientRect().bottom);
        return { overflow, historyBottom: history.bottom, lastLiveBottom: Math.max(...live), historyTop: history.top };
      });
      assert.deepEqual(layout.overflow, [], JSON.stringify(layout));
      assert.ok(layout.historyBottom <= 600 && layout.lastLiveBottom <= layout.historyTop, JSON.stringify(layout));
    };
    await assertNoMonitorScroll();
    await page.locator('#assistedContent summary').click();
    assert.equal(await page.locator('#assistedContent details').evaluate(el => el.open), false);
    assert.match(await page.evaluate(() => createdTab.url), /run-details\.html\?page=p1$/);
    const detailsPage = await browser.newPage();
    detailsPage.on('pageerror', error => errors.push(error.message));
    const savedRun = await page.evaluate(() => structuredClone(pageRuns.get('p1')));
    savedRun.logs = [{ level: 'error', message: '<img src=x onerror=alert(1)> Texto integral do registro.' }];
    await detailsPage.addInitScript(run => {
      window.chrome = { storage: { local: { get: async key => ({ [key]: key.endsWith(':p1') ? run : undefined }) } } };
    }, savedRun);
    await detailsPage.goto(await page.evaluate(() => createdTab.url));
    await detailsPage.waitForFunction(() => document.querySelector('#steps .step'));
    assert.match(await detailsPage.locator('#steps').textContent(), /Mensagem longa para verificar o resumo/);
    assert.match(await detailsPage.locator('#logs').textContent(), /<img src=x/);
    assert.equal(await detailsPage.locator('#logs img').count(), 0);
    await detailsPage.goto(`http://127.0.0.1:${server.address().port}/run-details.html?page=missing`);
    await detailsPage.waitForFunction(() => document.querySelector('#status').textContent.includes('Nenhuma execução salva'));
    await detailsPage.close();
    if(process.env.FLOWDETECT_TEST_SCREENSHOT_DIR) {
      await page.screenshot({animations:'disabled',path:path.join(process.env.FLOWDETECT_TEST_SCREENSHOT_DIR,'assisted-failed-33-companies.png')});
    }
    await page.evaluate(() => {
      const run = structuredClone(pageRuns.get('p1'));
      run.status = 'running'; run.currentStep = 3; run.currentIndex = 0;
      Object.assign(run.recentSteps.at(-1), { state: 'running', message: '', ocrChecks: [
        { text: 'Competência de Apuração', state: 'found' }, { text: '09/2026', state: 'checking' }
      ] });
      updateRun(run);
    });
    await assertNoMonitorScroll();
    assert.equal(await page.locator('#assistedContent .block-carousel-ocr-progress').isVisible(), true);
    assert.equal(await page.locator('#assistedContent .stop-button').isVisible(), true);
    await page.evaluate(() => updateRun(window.compactOriginalRun));
    await assertNoMonitorScroll();
    if(process.env.FLOWDETECT_TEST_SCREENSHOT_DIR) {
      await page.screenshot({path:path.join(process.env.FLOWDETECT_TEST_SCREENSHOT_DIR,'assisted-page-one.png')});
    }
    if(process.env.FLOWDETECT_ACTIVE_RUN_SCREENSHOT) await page.screenshot({path:process.env.FLOWDETECT_ACTIVE_RUN_SCREENSHOT});
    const secondId=await page.evaluate(()=>document.querySelectorAll('.execution-page-card')[1].querySelector('.execution-page-select').textContent);
    await page.evaluate(()=>finishRun(messages.find(m=>m.type==='flowdetect-page-create') ? JSON.parse(sessionStorage.getItem('test-db')).flowdetectChromeExecutionPages[1].id : 'p2'));
    assert.equal(await page.locator('.execution-page-card.is-running').count(),1);
    await page.locator('.assisted-content .stop-button').click();
    await page.locator('#workspaceAutomations').click();
    assert.equal(await page.evaluate(()=>messages.find(m=>m.type==='flowdetect-stop' && m.pageId==='p1').runId),'r-p1');
    await page.locator('.execution-page-select').nth(1).click();
    await page.waitForFunction(()=>document.querySelector('.execution-page-card.is-selected .execution-page-state')?.textContent.includes('Concluída'));
    assert.equal(await page.locator('.automation-tile-name').first().textContent(),'Fluxo Exclusivo Página 2');
    assert.equal(await page.locator('.automation-tile-percent').first().textContent(),'100%');
    await page.reload();
    await page.waitForFunction(()=>document.querySelector('#executionPageTabs .execution-page-select[aria-current="page"]')?.textContent.includes('Pág. 2'));
    assert.equal(await page.locator('.automation-tile-name').first().textContent(),'Fluxo Exclusivo Página 2');
    assert.equal(await page.locator('.automation-tile-percent').first().textContent(),'100%');
    await page.locator('.execution-page-select').first().click();
    assert.match(await page.locator('.execution-page-card.is-selected .execution-page-state').textContent(),/Interrompida/);
    await page.locator('#openExecutionPage').click();
    assert.equal(await page.evaluate(()=>activeTestTab),11);
    await page.locator('.execution-page-card').nth(1).hover();
    await page.locator('.execution-page-delete').nth(1).click();
    await page.waitForFunction(()=>document.querySelectorAll('.execution-page-card').length===1);
    assert.equal(await page.evaluate(()=>Object.keys(JSON.parse(sessionStorage.getItem('test-db'))).filter(k=>k.startsWith('flowdetectChromePageRun:')).length),1);
    await page.setViewportSize({width:390,height:600});
    const metrics=await page.evaluate(()=>{
      const selectors=['.execution-pages','#executionPageTabs','.execution-page-card','.execution-page-target','#executionPageTarget','#addExecutionPage'];
      const nodes=selectors.flatMap(selector=>[...document.querySelectorAll(selector)]);
      const bad=nodes.filter(el=>{const rect=el.getBoundingClientRect();return rect.left < -1 || rect.right > innerWidth+1;}).map(el=>el.className||el.id);
      return {bad,bodyWidth:document.body.scrollWidth,viewport:innerWidth,shellHeight:document.querySelector('.app-shell').clientHeight,scrollHeight:document.querySelector('.app-shell').scrollHeight};
    });
    assert.equal(metrics.bad.length,0,JSON.stringify(metrics));
    assert.ok(metrics.bodyWidth<=390&&metrics.shellHeight===600,JSON.stringify(metrics));
    const pageSwitcherHeight = await page.locator('.execution-pages').evaluate(el=>el.getBoundingClientRect().height);
    assert.ok(pageSwitcherHeight<=140,'Page bar is too tall: '+pageSwitcherHeight);
    const sharedHeaderBefore = await page.locator('.popup-fixed-header').boundingBox();
    await page.locator('#workspaceAssisted').click();
    await page.reload();
    await page.waitForFunction(() => document.querySelector('.app-shell').dataset.workspace === 'assisted');
    assert.deepEqual(await page.locator('.popup-fixed-header').boundingBox(), sharedHeaderBefore);
    for (const selector of ['.popup-tools', '.studio-pair-bar', '.element-picker-toolbar', '#workspaceTabs']) {
      assert.equal(await page.locator(selector).isVisible(), true, `Shared control hidden after reopening: ${selector}`);
    }
    await page.locator('#workspaceAutomations').click();
    assert.deepEqual(await page.locator('.popup-fixed-header').boundingBox(), sharedHeaderBefore);
    // Deleting a completed/stopped automation must not resurrect it from the saved snapshot.
    await page.locator('.automation-tile-open').first().click();
    const tabBeforeSettings = await page.evaluate(() => window.createdTab?.url);
    await page.locator('.automation-configure').click();
    assert.equal(await page.evaluate(() => window.createdTab?.url), tabBeforeSettings, 'Settings never opens another tab');
    assert.equal(await page.locator('.screen-guard-form').count(),0);
    assert.equal(await page.locator('.card-settings-choice option[value="screen-guard-settings"]').count(),0);
    await page.locator('.card-settings-choice').selectOption('download-settings');
    const startsBeforeDownloads = await page.evaluate(() => messages.filter(m => m.type === 'flowdetect-start').length);
    await page.locator('.download-open-settings').click();
    assert.equal(await page.evaluate(() => window.createdTab.url),'chrome://settings/downloads');
    assert.equal(await page.evaluate(() => messages.filter(m => m.type === 'flowdetect-start').length), startsBeforeDownloads);
    assert.equal(await page.evaluate(() => messages.some(m => m.type === 'flowdetect-screen-ready')),false);
    assert.equal(await page.evaluate(() => Object.keys(JSON.parse(sessionStorage.getItem('test-db'))).some(k=>k.startsWith('flowdetectPendingFolderRun:'))),false);
    await page.locator('.automation-configure').click();
    await page.locator('.delete-automation').click();
    assert.equal(await page.locator('.automation-delete-confirm').isVisible(), true);
    await page.locator('.automation-delete-confirm button').first().click();
    assert.equal(await page.locator('.automation-delete-confirm').isVisible(), false);
    assert.equal(await page.locator('.automation-flip-item').count(), 1);
    await page.evaluate(() => {
      window.runBeforeDeleteCheck = structuredClone(pageRuns.get('p1'));
      updateRun({ ...window.runBeforeDeleteCheck, status: 'running' });
    });
    await page.locator('.delete-automation').click();
    await page.locator('.confirm-delete-automation').click();
    assert.match(await page.locator('.automation-delete-confirm').textContent(), /Pare as execuções/);
    assert.equal(await page.locator('.automation-flip-item').count(), 1);
    await page.evaluate(() => updateRun(window.runBeforeDeleteCheck));
    // Even when native confirm is unavailable, the in-panel confirmation works.
    await page.evaluate(() => { window.confirm = () => false; });
    await page.locator('.delete-automation').click();
    const fit = await page.locator('#automationList').evaluate(el => ({ h: el.clientHeight, sh: el.scrollHeight }));
    assert.ok(fit.sh <= fit.h + 1, JSON.stringify(fit));
    await page.locator('.confirm-delete-automation').click();
    await page.waitForFunction(() => document.querySelectorAll('.automation-flip-item').length === 0);
    assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('test-db')).flowdetectChromeAutomations.some(a => a.id === 'demo')), false);
    await page.reload();
    await page.locator('.automation-import-card').waitFor();
    assert.equal(await page.locator('.automation-flip-item').count(), 0);
    await page.locator('#workspaceAssisted').click();
    assert.equal(await page.locator('#assistedContent .block-carousel').count(), 1, 'Deleting library item preserves run history');
    assert.deepEqual(errors,[]);
    if(process.env.FLOWDETECT_TEST_SCREENSHOT)await page.screenshot({path:process.env.FLOWDETECT_TEST_SCREENSHOT});
  }finally{await browser?.close();await new Promise(r=>server.close(r));}
});

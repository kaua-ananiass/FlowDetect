const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { test } = require("node:test");

const web = path.resolve(__dirname, "../tauri_gerador/web");
const main = fs.readFileSync(path.join(web, "main.js"), "utf8");
const index = fs.readFileSync(path.join(web, "index.html"), "utf8");
const browser = [process.env.FLOWDETECT_TEST_BROWSER,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find(file => file && fs.existsSync(file));

const vm = require("node:vm");
const captureContext = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(web,"flow-capture.js"),"utf8"),captureContext);
const capture = captureContext.FlowDetectFlowCapture;
test("original captures use natural map bounds rather than viewport zoom",()=>{
  assert.deepEqual(JSON.parse(JSON.stringify(capture.mapDimensions({offsetWidth:2800,scrollWidth:3500,offsetHeight:820,scrollHeight:1100}))),{width:3500,height:1100});
});
test("PNG uses 3x quality and bounded large-canvas memory",()=>{
  assert.deepEqual(JSON.parse(JSON.stringify(capture.pngDimensions(3000,1000))),{width:9000,height:3000,scale:3});
  for(const [w,h] of [[40000,1000],[1500,80000],[10000,10000]]){
    const size=capture.pngDimensions(w,h);assert.ok(size.width<=16384&&size.height<=16384&&size.width*size.height<=48000000);
  }
  assert.throws(()=>capture.pngDimensions(0,1),/Dimensões/);
});
test("capture implementation clones the actual DOM and never replaces its cards",()=>{
  const source=fs.readFileSync(path.join(web,"flow-capture.js"),"utf8");
  assert.match(source,/htmlToImage.toSvg\(root/);
  assert.doesNotMatch(source,/function (layout|nodeSvg|fieldsForEvent|buildSvg)/);
  assert.match(index,/vendor\/html-to-image-1\.11\.13\.js/);
});

test("Original flow capture preserves the actual cards, curves and manual layout", {
  skip: !browser && "Install Chrome/Edge or set FLOWDETECT_TEST_BROWSER", timeout: 90000,
}, async () => {
  const errors = [], pending = new Map();
  let child, socket, id = 0;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "flowdetect-studio-functional-"));
  const exported = ["captureEntireFlow","captureOriginalFlowPage","saveFlowCapture","flowCaptureState","state","renderCommandMap","setWorkspaceTab","setCommandMapZoom"];
  // Instrument only the served copy; the production module exposes no test API.
  const instrumented = main.replace(/\nboot\(\);\r?\n}\s*$/,
    `\nwindow.__functionalQA = {${exported.join(",")}};\nboot();\n}`);
  assert.notEqual(instrumented, main);
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const file = path.resolve(web, "." + (pathname === "/" ? "/index.html" : pathname));
    if (!file.startsWith(web + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404); res.end(); return;
    }
    const type = {".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".svg": "image/svg+xml"};
    res.setHeader("Content-Type", (type[path.extname(file)] || "application/octet-stream") + "; charset=utf-8");
    res.end(file === path.join(web, "main.js") ? instrumented : fs.readFileSync(file));
  });
  try {
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    child = spawn(browser, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
      "--disable-background-networking", "--remote-debugging-port=0", "--remote-debugging-address=127.0.0.1",
      "--user-data-dir=" + profile, "about:blank"], {windowsHide: true, stdio: ["ignore", "ignore", "pipe"]});
    const endpoint = await new Promise((resolve, reject) => {
      let stderr = "";
      const timer = setTimeout(() => reject(new Error("Browser startup timeout")), 10000);
      child.once("error", error => {clearTimeout(timer); reject(error);});
      child.stderr.on("data", data => {
        stderr += data;
        const match = stderr.match(/DevTools listening on (ws:\/\/\S+)/);
        if (match) {clearTimeout(timer); resolve(match[1]);}
      });
    });
    socket = new WebSocket(endpoint);
    await new Promise((resolve, reject) => {socket.onopen = resolve; socket.onerror = reject;});
    socket.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails);
      const request = pending.get(message.id);
      if (request) {
        pending.delete(message.id);
        message.error ? request.reject(new Error(JSON.stringify(message.error))) : request.resolve(message.result);
      }
    };
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const requestId = ++id;
      const timer = setTimeout(() => {pending.delete(requestId); reject(new Error("CDP timeout: " + method));}, 30000);
      pending.set(requestId, {resolve: value => {clearTimeout(timer); resolve(value);},
        reject: error => {clearTimeout(timer); reject(error);}});
      socket.send(JSON.stringify({id: requestId, method, params, ...(sessionId ? {sessionId} : {})}));
    });
    const {targetId} = await send("Target.createTarget", {url: "about:blank"});
    const {sessionId} = await send("Target.attachToTarget", {targetId, flatten: true});
    const cdp = (method, params) => send(method, params, sessionId);
    await cdp("Runtime.enable"); await cdp("Page.enable");
    await cdp("Emulation.setDeviceMetricsOverride", {width:1600,height:1000,deviceScaleFactor:1,mobile:false});
    await cdp("Network.enable"); await cdp("Network.setBlockedURLs", {urls:["*fonts.googleapis.com*","*fonts.gstatic.com*"]});
    await cdp("Page.addScriptToEvaluateOnNewDocument", {source: `
      window.__TAURI__ = {core: {invoke: async (command,payload) => {
        if(command==='get_recognition_image_preview')return {src:window.__captureImage};
        if(command==='save_flow_capture'){window.__captureWrites.push({command,...payload});return {path:payload.filePath};}
        throw new Error('Native bridge disabled in regression test');
      }}, dialog:{save:async options=>window.__cancelCapture?null:'C:/capture.'+options.filters[0].extensions[0]},
        event: {listen: async () => () => {}}};`});
    await cdp("Page.navigate", {url: `http://127.0.0.1:${server.address().port}/`});
    const evaluate = async expression => {
      const response = await cdp("Runtime.evaluate", {expression, returnByValue: true, awaitPromise: true});
      assert.equal(response.exceptionDetails, undefined, JSON.stringify(response.exceptionDetails));
      return response.result.value;
    };
    const deadline = Date.now() + 10000;
    while (!await evaluate("Boolean(window.__functionalQA) && document.readyState === 'complete'")) {
      assert.ok(Date.now() < deadline, "Studio failed to initialize: " + JSON.stringify(errors));
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    await evaluate(`(async () => {
      const qa = window.__functionalQA;
      const originalToSvg=htmlToImage.toSvg;
      htmlToImage.toSvg=(root,options)=>{
        window.__capturedSourcePaths=[...root.querySelectorAll('.command-map-tree-link-path')].map(path=>path.getAttribute('d'));
        return originalToSvg(root,options).then(url=>{window.__rawCaptureSvg=decodeURIComponent(url.slice(url.indexOf(',')+1));return url;});
      };
      document.querySelector('#loginOverlay').style.display='none';
      document.body.classList.remove('is-auth-locked');
      for(const [family,file,weight] of [['Plus Jakarta Sans','plus-jakarta-sans-latin.woff2','400 800'],['Montserrat','montserrat-latin.woff2','500 900']]){
        const face=new FontFace(family,'url(./vendor/fonts/'+file+')',{weight});
        document.fonts.add(await face.load());
      }
      const image=document.createElement('canvas');image.width=160;image.height=70;
      const ctx=image.getContext('2d');ctx.fillStyle='#e600d8';ctx.fillRect(0,0,160,70);
      window.__captureImage=image.toDataURL('image/png');window.__captureWrites=[];window.__cancelCapture=true;
      const events=[
        {order:1,type:'clicar_imagem',title:'Reconhecimento OCR',sequence:'principal',details:{imagem:'imagens/teste.png',modo_reconhecimento:'texto_ocr',texto_ocr_busca:'Empresa',salvar_ocr_em:'valor_lido',ocr_target_layouts:[{texto:'Empresa',action:'continuar',failureAction:'continuar'}]}},
        {order:2,type:'sequencia_planilha',title:'Loop da planilha',sequence:'principal',details:{arquivo:'planilhas/empresas.xlsx',aba:'Empresas',coluna:'CNPJ',valores:['00.000.101/0000-00','00.000.102/0000-00']}},
        {order:3,type:'clicar_imagem',title:'Reconhecimento OCR',sequence:'principal',details:{imagem:'imagens/teste.png',modo_reconhecimento:'texto_ocr',texto_ocr_busca:'Pesquisar'}},
        {order:4,type:'clicar_imagem',title:'Reconhecimento OCR',sequence:'principal',details:{imagem:'imagens/teste.png',modo_reconhecimento:'texto_ocr',texto_ocr_busca:'Sugestão Tipo Nota'}},
        {order:5,type:'clicar_imagem',title:'Reconhecimento OCR',sequence:'principal',details:{imagem:'imagens/teste.png',modo_reconhecimento:'texto_ocr',texto_ocr_busca:'Sugestão',ocr_target_layouts:[{texto:'Sugestão',action:'clicar_ir_para_bloco',block:6,successDelay:1,failureAction:'ir_para_bloco',failureBlock:4,failureDelay:.5}]}},
        {order:6,type:'resultado_relatorio',title:'Resultado do relatório',sequence:'pagina_2',details:{status:'Concluído',resultado:'Sugestões salvas',coluna_relatorio:'B'}},
      ].map(event=>({...event,clientKey:'capture-'+event.order,delay:.3,description:'Processo de demonstração',command:'teste'}));
      qa.state.roadmap={events,sequences:['principal','pagina_2'],sequence_settings:{}};
      qa.state.commandMapPageSequence='principal';qa.state.commandMapViewMode='tree';
      qa.state.commandMapZoom=.45;qa.state.commandMapRequestedZoom=.45;qa.state.commandMapTreePanOffset={x:-380,y:-65};
      qa.state.commandMapTreeLayouts={principal:{1:{x:72,y:110},2:{x:520,y:50},3:{x:1000,y:140},4:{x:1500,y:170},5:{x:1980,y:160}},pagina_2:{6:{x:600,y:140}}};
      qa.state.commandMapSave.dirty=true;qa.state.commandMapDrafts={};
      qa.setWorkspaceTab('commands');qa.renderCommandMap({skipAutoFit:true,suppressFocusScroll:true,quietUpdate:true});
      document.querySelector('#flowCaptureScope').value='current';
      window.__captureMapBefore=JSON.stringify({layouts:qa.state.commandMapTreeLayouts,zoom:qa.state.commandMapZoom,pan:qa.state.commandMapTreePanOffset,page:qa.state.commandMapPageSequence});
      return true;
    })()`);
    await evaluate("new Promise(resolve=>setTimeout(resolve,800))");
    const initialViewportState=await evaluate("({zoom:window.__functionalQA.state.commandMapZoom,pan:window.__functionalQA.state.commandMapTreePanOffset,layouts:window.__functionalQA.state.commandMapTreeLayouts})");
    for (const [width,height] of [[1600,1000],[1360,800],[1280,1000],[1100,1000],[1100,700],[900,700],[700,700]]) {
      await cdp("Emulation.setDeviceMetricsOverride", {width,height,deviceScaleFactor:1,mobile:false});
      await evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
      const spacing=await evaluate(`(() => {
        const utility=document.querySelector('.command-map-utility-row').getBoundingClientRect();
        const save=document.querySelector('.command-map-save-stack').getBoundingClientRect();
        return {gap:save.top-utility.bottom,saveHeight:save.height};
      })()`);
      assert.ok(spacing.saveHeight>0&&spacing.gap>=0&&spacing.gap<=24,
        `Save map should stay directly below navigation at ${width}x${height}px: ${JSON.stringify(spacing)}`);
      const layout=await evaluate(`(() => {
        const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
        const tabs=rect('.workspace-tabs'),header=rect('.command-map-header');
        return {viewport:innerWidth,document:document.documentElement.scrollWidth,tabs,header,
          copy:rect('.command-map-copy'),utility:rect('.command-map-utility-row'),side:rect('.command-map-side-stack'),
          save:rect('.command-map-save-stack'),list:rect('.command-map-list'),
          clippedTabs:[...document.querySelector('.workspace-tabs').children].filter(el=>{
            const r=el.getBoundingClientRect();return r.width&& (r.left<tabs.left-1||r.right>tabs.right+1);
          }).map(el=>el.id)};
      })()`);
      assert.ok(layout.document<=layout.viewport+1&&layout.clippedTabs.length===0,
        `Workspace tabs must fit at ${width}x${height}px: ${JSON.stringify(layout)}`);
      assert.ok(layout.list.height>=200&&layout.copy.left>=layout.header.left-1&&
        layout.copy.right<=layout.header.right+1&&layout.side.right<=layout.header.right+1,
        `Map controls must remain inside the window at ${width}x${height}px: ${JSON.stringify(layout)}`);
      if (width>980) {
        assert.ok(Math.abs(layout.copy.top-layout.utility.top)<=1&&Math.abs(layout.copy.top-layout.side.top)<=1,
          `Map buttons should share the title row in window mode at ${width}x${height}px: ${JSON.stringify(layout)}`);
      } else {
        assert.ok(layout.copy.bottom<=layout.utility.top&&layout.copy.bottom<=layout.side.top,
          `Map title should precede controls at ${width}x${height}px: ${JSON.stringify(layout)}`);
      }
    }
    await cdp("Emulation.setDeviceMetricsOverride", {width:1600,height:1000,deviceScaleFactor:1,mobile:false});
    await evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
    const resizedState=await evaluate("({zoom:window.__functionalQA.state.commandMapZoom,pan:window.__functionalQA.state.commandMapTreePanOffset,layouts:window.__functionalQA.state.commandMapTreeLayouts})");
    assert.deepEqual(resizedState,initialViewportState,"Resizing must preserve zoom, pan and manual card positions");
    const result = await evaluate(`(async () => {
      const qa=window.__functionalQA,checks=[];
      const check=(name,ok)=>{if(!ok)throw new Error(name);checks.push(name)};
      const sideActions=document.querySelector('.command-map-side-actions');
      const captureButton=document.querySelector('#mapCaptureButton');
      const reorganizeButton=document.querySelector('#mapReorganizeButton');
      const viewControls=document.querySelector('.map-zoom-controls');
      const captureRect=captureButton.getBoundingClientRect();
      const reorganizeRect=reorganizeButton.getBoundingClientRect();
      const viewRect=viewControls.getBoundingClientRect();
      check('capture and reorganize buttons align together below the page controls',
        sideActions.contains(captureButton)&&sideActions.contains(reorganizeButton)&&
        captureRect.top>=viewRect.bottom&&Math.abs(captureRect.top-reorganizeRect.top)<1&&
        captureRect.right<reorganizeRect.left&&captureRect.width>0&&reorganizeRect.width>0);
      window.__captureMapBefore=JSON.stringify({layouts:qa.state.commandMapTreeLayouts,zoom:qa.state.commandMapZoom,pan:qa.state.commandMapTreePanOffset,page:qa.state.commandMapPageSequence});
      const originalMarkers=[...document.querySelectorAll('#commandMapList .command-tree-card [data-relative-ocr-target]')].map(marker=>{
        const style=getComputedStyle(marker);
        return {order:marker.closest('[data-tree-node-order]').dataset.treeNodeOrder,index:marker.dataset.ocrTargetIndex,width:parseFloat(style.width),height:parseFloat(style.height)};
      });
      await qa.captureEntireFlow();
      const dialog=document.querySelector('#flowCaptureDialog');
      const root=document.querySelector('#commandMapList .command-map-tree');
      check('button captures only the current original page by default',dialog.open&&qa.flowCaptureState.diagram.nodeCount===5&&qa.flowCaptureState.diagram.pageCount===1);
      const parse=svg=>new DOMParser().parseFromString(svg,'image/svg+xml');
      const captured=parse(qa.flowCaptureState.diagram.svg);
      const fontEvidence={faces:[...document.fonts].filter(face=>face.status==='loaded').map(face=>face.family),hasFace:qa.flowCaptureState.diagram.svg.includes('@font-face'),hasFamily:qa.flowCaptureState.diagram.svg.includes('Plus Jakarta Sans'),hasData:/data:[^'\"]+;base64,/.test(qa.flowCaptureState.diagram.svg),svgStart:qa.flowCaptureState.diagram.svg.slice(0,300)};
      check('loaded editor fonts are embedded in the exported SVG: '+JSON.stringify(fontEvidence),fontEvidence.hasFace&&fontEvidence.hasFamily&&fontEvidence.hasData);
      const actualPaths=window.__capturedSourcePaths;
      const savedPaths=[...captured.querySelectorAll('.command-map-tree-link-path')].map(p=>p.getAttribute('d'));
      check('all curved and branch paths are copied verbatim',JSON.stringify(actualPaths)===JSON.stringify(savedPaths)&&actualPaths.length>=5);
      check('original cards and all their editor buttons remain in the image',captured.querySelectorAll('.command-tree-card').length===5&&captured.querySelectorAll('[data-tree-action="save"]').length===5&&captured.querySelectorAll('[data-tree-action="capture-image"]').length===4);
      const position=captured.querySelector('[data-tree-node-order="2"]').style;
      check('manually arranged card positions are unchanged',Math.abs(parseFloat(position.left)-520)<.1&&Math.abs(parseFloat(position.top)-50)<.1);
      check('OCR markers and route-delay fields are preserved',!!captured.querySelector('[data-relative-ocr-target]')&&!!captured.querySelector('[data-jump-delay]'));
      const delay=captured.querySelector('.command-map-tree-edge-label [data-jump-delay]');
      check('OCR delay renders as single-line text instead of a broken native input',delay.tagName.toLowerCase()==='span'&&/^[0-9]+(?:,[0-9]+)?$/.test(delay.textContent)&&delay.style.whiteSpace==='nowrap');
      const failureDelay=captured.querySelector('.command-map-tree-edge-label [data-jump-delay][data-route-kind="failure"]');
      check('fractional failure delay retains its comma and one-line format',failureDelay?.tagName.toLowerCase()==='span'&&failureDelay.textContent==='0,5'&&failureDelay.style.whiteSpace==='nowrap');
      const capturedMarkers=[...captured.querySelectorAll('.command-tree-card [data-relative-ocr-target]')].map(marker=>({order:marker.closest('[data-tree-node-order]').getAttribute('data-tree-node-order'),index:marker.dataset.ocrTargetIndex,width:parseFloat(marker.style.width),height:parseFloat(marker.style.height)}));
      check('OCR target dimensions match every original settled preview: '+JSON.stringify({originalMarkers,capturedMarkers}),originalMarkers.length===capturedMarkers.length&&originalMarkers.every((marker,index)=>marker.order===capturedMarkers[index].order&&marker.index===capturedMarkers[index].index&&Math.abs(marker.width-capturedMarkers[index].width)<.15&&Math.abs(marker.height-capturedMarkers[index].height)<.15));
      check('no presentation cards, new routes or legend are synthesized',!captured.querySelector('[data-capture-node]')&&!qa.flowCaptureState.diagram.svg.includes('Sucesso / próximo'));
      const before=JSON.stringify({layouts:qa.state.commandMapTreeLayouts,zoom:qa.state.commandMapZoom,pan:qa.state.commandMapTreePanOffset,page:qa.state.commandMapPageSequence});
      check('capturing does not change pan, zoom, active page or manual positions',before===window.__captureMapBefore);
      await qa.saveFlowCapture('png');check('cancel does not write a file',window.__captureWrites.length===0);
      window.__cancelCapture=false;
      await qa.saveFlowCapture('svg');
      const svgWrite=window.__captureWrites[0];
      check('native SVG uses the existing save command',svgWrite.command==='save_flow_capture'&&svgWrite.fileFormat==='svg');
      await qa.saveFlowCapture('png');
      const pngWrite=window.__captureWrites[1];
      check('PNG export completes without a tainted canvas',pngWrite.fileFormat==='png'&&pngWrite.dataBase64.startsWith('iVBORw0KGgo'));
      const png=new Image();await new Promise((resolve,reject)=>{png.onload=resolve;png.onerror=reject;png.src='data:image/png;base64,'+pngWrite.dataBase64});
      const dims=FlowDetectFlowCapture.pngDimensions(qa.flowCaptureState.diagram.width,qa.flowCaptureState.diagram.height);
      check('PNG is the entire unzoomed map in 3x quality',dims.scale===3&&png.width===dims.width&&png.height===dims.height&&png.width>8000);
      const preview=root.querySelector('.recognition-preview-image'),rect=preview.getBoundingClientRect(),rootRect=root.getBoundingClientRect(),zoom=rootRect.width/root.offsetWidth;
      const x=(rect.left-rootRect.left+rect.width*.15)/zoom,y=(rect.top-rootRect.top+rect.height*.15)/zoom;
      const canvas=document.createElement('canvas');canvas.width=png.width;canvas.height=png.height;
      const context=canvas.getContext('2d');context.drawImage(png,0,0);
      const pixel=context.getImageData(Math.floor(x*dims.scale),Math.floor(y*dims.scale),1,1).data;
      check('original recognition images survive export',pixel[0]>185&&pixel[1]<35&&pixel[2]>170);
      window.__originalCapturePng=pngWrite.dataBase64;window.__originalCaptureDimensions={width:png.width,height:png.height};
      canvas.width=1;canvas.height=1;
      document.querySelector('#flowCaptureScope').value='all';await qa.captureEntireFlow();
      const all=parse(qa.flowCaptureState.diagram.svg);
      check('all-pages option uses the original renderer for every page',qa.flowCaptureState.diagram.pageCount===2&&all.querySelectorAll('.command-tree-card').length===6);
      check('other-page manual positions are retained without page switching',all.querySelector('[data-tree-node-order="6"]').style.left==='600px'&&qa.state.commandMapPageSequence==='principal');
      check('offscreen capture hosts are removed after completion',document.querySelectorAll('#commandsPanel .command-map-shell').length===1);
      const allPng=await FlowDetectFlowCapture.renderPng(qa.flowCaptureState.diagram,1);
      check('combined original pages also render to PNG',allPng.blob.type==='image/png'&&allPng.blob.size>10000);
      const closed=new Promise(resolve=>dialog.addEventListener('close',resolve,{once:true}));
      dialog.close();await Promise.race([closed,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Dialog close event timeout')),1500))]);
      check('close releases capture snapshot',!qa.flowCaptureState.diagram);
      const zoomTarget=root.querySelector('.command-tree-card[data-order="5"]');
      const mapRect=document.querySelector('#commandMapList').getBoundingClientRect();
      const targetRect=zoomTarget.getBoundingClientRect();
      const anchor={x:targetRect.left+targetRect.width/2,y:targetRect.top+targetRect.height/2};
      qa.setCommandMapZoom(.65,{preservePoint:{x:anchor.x-mapRect.left,y:anchor.y-mapRect.top},suppressFocusCenter:true});
      const zoomedRect=zoomTarget.getBoundingClientRect();
      check('tree zoom keeps the chosen card under the pointer',
        Math.abs(zoomedRect.left+zoomedRect.width/2-anchor.x)<1.5
        &&Math.abs(zoomedRect.top+zoomedRect.height/2-anchor.y)<1.5);
      return checks;
    })()`);
    assert.equal(result.length, 23);
    if (process.env.FLOWDETECT_CAPTURE_ARTIFACT_DIR) {
      const artifacts = path.resolve(process.env.FLOWDETECT_CAPTURE_ARTIFACT_DIR);
      fs.mkdirSync(artifacts, {recursive:true});
      fs.writeFileSync(path.join(artifacts, "original-flow.png"), Buffer.from(await evaluate("window.__originalCapturePng"), "base64"));
      const screenshot = await cdp("Page.captureScreenshot", {format:"png"});
      fs.writeFileSync(path.join(artifacts, "studio-preview.png"), Buffer.from(screenshot.data, "base64"));
    }
    await evaluate("window.__functionalQA.setWorkspaceTab('assist')");
    for (const [width,height] of [[1600,1000],[1360,800],[1100,700],[900,700]]) {
      await cdp("Emulation.setDeviceMetricsOverride", {width,height,deviceScaleFactor:1,mobile:false});
      await evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
      const layout=await evaluate(`(() => {
        const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
        const panel=document.querySelector('#assistPanel');
        return {panelScrollHeight:panel.scrollHeight,panelHeight:panel.clientHeight,
          shell:rect('.assist-shell'),body:rect('.assist-body'),map:rect('.assist-map-list'),
          side:rect('.assist-side-stack'),dock:rect('.assist-control-dock'),log:rect('.assist-log-panel')};
      })()`);
      assert.ok(layout.map.height>=240&&layout.side.bottom<=layout.shell.bottom+1&&
        layout.dock.bottom<=layout.side.bottom+1&&layout.log.bottom<=layout.side.bottom+1,
        `Assisted controls must stay inside their panel at ${width}x${height}px: ${JSON.stringify(layout)}`);
      if (width>980) {
        assert.ok(layout.map.right<=layout.side.left+1&&Math.abs(layout.map.top-layout.side.top)<=1,
          `Assisted flow and controls must remain side by side at ${width}x${height}px: ${JSON.stringify(layout)}`);
        assert.ok(layout.dock.bottom<=layout.log.top+1,
          `Assisted controls must not cover the log at ${width}x${height}px: ${JSON.stringify(layout)}`);
      } else {
        assert.ok(layout.map.bottom<=layout.side.top+1&&layout.dock.right<=layout.log.left+1,
          `Narrow assisted layout must not overlap at ${width}x${height}px: ${JSON.stringify(layout)}`);
      }
      assert.ok(layout.panelScrollHeight>=layout.panelHeight,
        `Assisted panel should scroll instead of clipping at ${width}x${height}px: ${JSON.stringify(layout)}`);
      if (process.env.FLOWDETECT_CAPTURE_ARTIFACT_DIR && width===1360 && height===800) {
        const screenshot=await cdp("Page.captureScreenshot", {format:"png"});
        fs.writeFileSync(path.join(path.resolve(process.env.FLOWDETECT_CAPTURE_ARTIFACT_DIR), "assist-window.png"), Buffer.from(screenshot.data,"base64"));
      }
    }
    assert.deepEqual(errors, []);
  } finally {
    if (socket) socket.close();
    if (child && child.exitCode === null) {
      child.kill();
      await new Promise(resolve => {child.once("exit", resolve); setTimeout(resolve, 2500).unref();});
    }
    for (const request of pending.values()) request.reject(new Error("Browser test finished"));
    await new Promise(resolve => server.close(resolve));
    // Only our resolved, uniquely named temporary profile can be removed.
    assert.equal(path.dirname(profile), path.resolve(os.tmpdir()));
    assert.ok(path.basename(profile).startsWith("flowdetect-studio-functional-"));
    fs.rmSync(profile, {recursive: true, force: true, maxRetries: 3, retryDelay: 100});
  }
});

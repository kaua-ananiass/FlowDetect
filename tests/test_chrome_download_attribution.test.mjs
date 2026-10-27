import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const session = {};
const local = {};
let filenameListener;
let headersListener;
const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

globalThis.chrome = {
  webRequest: {onHeadersReceived:{addListener(fn){headersListener=fn;}}},
  downloads:{
    onDeterminingFilename:{addListener(fn){filenameListener=fn;}},
    onChanged:{addListener(){}},
    search:async()=>[],
    removeFile:async()=>{},
  },
  storage:{
    session:{
      get:async key=>({[key]:session[key]}),
      set:async values=>Object.assign(session,values),
      remove:async key=>{delete session[key]}
    },
    local:{set:async values=>Object.assign(local,values)}
  }
};

const scriptDir=path.dirname(fileURLToPath(import.meta.url));
const routing = await import("../flowdetect_chrome/download-routing.js");

const stage={
  kind:"directory",name:routing.STAGE_FOLDER,
  queryPermission:async()=>"granted",
  isSameEntry:async()=>false,
  getFileHandle:async name=>({getFile:async()=>({text:async()=>routing.STAGE_CONTENT})}),
};
const dest={kind:"directory",name:"Guias de teste",queryPermission:async()=>"granted"};
globalThis.FlowDetectDownloadFolders={get:async key=>key==="stage"?stage:dest};
const suggestion=item=>new Promise(resolve=>{
  assert.equal(filenameListener(item,resolve),true);
});
const markAttachment=(url,tabId)=>{
  headersListener({url,tabId,responseHeaders:[
    {name:"Content-Disposition",value:'attachment; filename="guia.pdf"'}
  ]});
};

test("manifest declares only the nonblocking webRequest permission needed to identify source tabs",()=>{
  const manifest=JSON.parse(fs.readFileSync(path.resolve(scriptDir,"../flowdetect_chrome/manifest.json"),"utf8"));
  assert.ok(manifest.permissions.includes("webRequest"));
  assert.ok(!manifest.permissions.includes("webRequestBlocking"));
  assert.equal(typeof headersListener,"function");
});

test("Chrome DownloadItem without tabId goes only to the originating page's folder",async()=>{
  await routing.activateDownloadRoute(UUID_A,7,"run-a");
  await routing.activateDownloadRoute(UUID_B,8,"run-b");
  const urlA="https://example.test/a/guia-a.pdf";
  const urlB="https://example.test/b/guia-b.pdf";
  markAttachment(urlA,7);
  markAttachment(urlB,8);
  const a=await suggestion({id:71,url:urlA,finalUrl:urlA,filename:"guia-a.pdf"});
  const b=await suggestion({id:81,url:urlB,finalUrl:urlB,filename:"guia-b.pdf"});
  assert.equal(a.filename,"FlowDetect-Temporario/"+UUID_A+"/guia-a.pdf");
  assert.equal(b.filename,"FlowDetect-Temporario/"+UUID_B+"/guia-b.pdf");
  assert.equal(session["flowdetectRoutedDownload:71"].runId,"run-a");
  assert.equal(session["flowdetectRoutedDownload:81"].runId,"run-b");
  markAttachment("https://example.test/unbound.pdf",99);
  assert.equal(await suggestion({id:99,url:"https://example.test/unbound.pdf",filename:"unbound.pdf"}),undefined);
});

test("same downloaded URL in two tabs is ambiguous and cannot silently mix downloads",async()=>{
  const same="https://example.test/reports/export?id=123";
  markAttachment(same,7);
  markAttachment(same,8);
  assert.equal(await suggestion({id:91,url:same,filename:"guia.pdf"}),undefined);
  assert.equal(session["flowdetectRoutedDownload:91"],undefined);
  assert.match(local["flowdetectDownloadStatus:"+UUID_A].detail,/Duas abas/);
  assert.match(local["flowdetectDownloadStatus:"+UUID_B].detail,/pasta padrão/);
});

test("a generated blob URL can be attributed by the tab's content script hint",async()=>{
  const blob="blob:https://example.test/unique-random-guid";
  assert.equal(routing.noteDownloadSource(7,blob),true);
  assert.equal(routing.noteDownloadSource(undefined,blob),false);
  assert.equal(routing.matchingDownloadOrigin({id:101,url:blob}).tabId,7);
  const result=await suggestion({id:101,url:blob,filename:"guia.pdf"});
  assert.equal(result.filename,"FlowDetect-Temporario/"+UUID_A+"/guia.pdf");
});

test("a download without tab provenance is never routed by guesswork",async()=>{
  const result=await suggestion({id:123,url:"https://example.test/not-observed",filename:"untracked.pdf"});
  assert.equal(result,undefined);
  assert.equal(session["flowdetectRoutedDownload:123"],undefined);
});

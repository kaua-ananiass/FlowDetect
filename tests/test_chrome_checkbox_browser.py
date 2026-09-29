"""Real Chrome/Edge regression for OCR clicks on native and custom checkboxes."""
import html
import json
from pathlib import Path
import re
import subprocess
import tempfile
import unittest

from tests.test_ocr_preview import browser_path

ROOT = Path(__file__).resolve().parents[1]
SCENARIO = r"""
(async () => {
  const result={checks:[],errors:[]};
  const check=(name,ok)=>{if(!ok)throw Error(name);result.checks.push(name)};
  const run=step=>new Promise(resolve=>window.__flowDetectChromeRunnerListener(
    {type:'flowdetect-execute-step-v2',step},null,resolve));
  const setup=()=>{
    document.querySelector('#fixture').innerHTML=`<table><tr><td><label><input id="all" type="checkbox"></label></td>
      <td><span id="header">CNPJ do fornecedor</span></td></tr></table>`;
    window.changes=0;window.clickEvents=0;window.downEvents=0;
    document.querySelector('input').addEventListener('change',()=>changes++);
    document.querySelector('table').addEventListener('click',()=>clickEvents++);
    for(const event of ['pointerdown','mousedown','pointerup','mouseup'])
      document.querySelector('table').addEventListener(event,()=>downEvents++);
  };
  const ocr=(clicks=1)=>{
    const text=document.querySelector('#header').getBoundingClientRect();
    const box=document.querySelector('label').getBoundingClientRect();
    return {type:'ocr_text',text:'CNPJ do fornecedor',click:true,clicks,timeout_ms:800,
      click_anchor:{from_text_left:box.left+box.width/2-text.left,from_text_top:box.top+box.height/2-text.top}};
  };
  try {
    setup();
    let screen=await new Promise(resolve=>window.__flowDetectChromeRunnerListener(
      {type:'flowdetect-screen-check-v2',text:'CNPJ do fornecedor'},null,resolve));
    check('screen check recognizes rendered text without clicking',screen.ok && screen.hasText && clickEvents===0);
    screen=await new Promise(resolve=>window.__flowDetectChromeRunnerListener(
      {type:'flowdetect-screen-check-v2',text:'Tela inexistente'},null,resolve));
    check('screen check rejects missing text without clicking',screen.ok && !screen.hasText && clickEvents===0);
    let reply=await run(ocr());
    check('hidden checkbox activated once without label forwarding or down/up events',
      reply.ok && document.querySelector('#all').checked && changes===1 && clickEvents===1 && downEvents===0);
    setup();
    const paddedStep=ocr();
    paddedStep.click_anchor.from_text_left+=15;
    reply=await run(paddedStep);
    check('OCR area padding resolves only the checkbox in the same cell',
      reply.ok && document.querySelector('#all').checked && changes===1 && clickEvents===1 && downEvents===0);
    setup();
    document.querySelector('table').insertAdjacentHTML('beforeend',
      '<tr><td><label id="rowLabel"><input id="row" type="checkbox"></label></td><td>Fornecedor</td></tr>');
    const rowRect=document.querySelector('#rowLabel').getBoundingClientRect();
    const headerRect=document.querySelector('#header').getBoundingClientRect();
    const rowStep=ocr();
    rowStep.click_anchor={from_text_left:rowRect.left+rowRect.width/2-headerRect.left,
      from_text_top:rowRect.top+rowRect.height/2-headerRect.top};
    reply=await run(rowStep);
    check('row marker selects only that row and leaves select-all untouched',
      reply.ok && document.querySelector('#row').checked && !document.querySelector('#all').checked && clickEvents===1 && downEvents===0);
    setup();
    document.querySelector('label').outerHTML=`<div id="component" style="width:22px;height:22px;position:relative">
      <input id="all" type="checkbox" style="position:absolute;pointer-events:none">
      <div id="box" style="position:absolute;inset:0;border:1px solid gray"></div></div>`;
    document.querySelector('#box').addEventListener('click',event=>{
      if(event.clientX>0 && event.clientY>0) document.querySelector('#all').checked=!document.querySelector('#all').checked;
    });
    const proxyRect=document.querySelector('#box').getBoundingClientRect();
    const textRect=document.querySelector('#header').getBoundingClientRect();
    const proxyStep={type:'ocr_text',text:'CNPJ do fornecedor',click:true,clicks:1,timeout_ms:800,
      click_anchor:{from_text_left:proxyRect.left+proxyRect.width/2-textRect.left,
        from_text_top:proxyRect.top+proxyRect.height/2-textRect.top}};
    reply=await run(proxyStep);
    check('div proxy receives one click and verifies sibling hidden input',
      reply.ok && document.querySelector('#all').checked && clickEvents===1 && downEvents===0
      && reply.message.includes('confirmada: marcada'));
    document.querySelector('#all').checked=false;
    document.querySelector('#box').replaceWith(document.querySelector('#box').cloneNode());
    reply=await run(proxyStep);
    check('inactive div proxy never reports checkbox selection success',!reply.ok && reply.error.includes('nao confirmou'));
    setup();
    document.querySelector('#all').addEventListener('click',e=>e.preventDefault());
    reply=await run(ocr());
    check('cancelled click does not report success',!reply.ok && reply.error.includes('nao confirmou') && !document.querySelector('#all').checked);
    setup();
    reply=await run(ocr(2));
    check('two clicks toggle unchecked box exactly twice',reply.ok && !document.querySelector('#all').checked && changes===2 && clickEvents===2 && downEvents===0);
    setup();
    document.querySelector('#all').checked=true;
    const states=[];
    document.querySelector('#all').addEventListener('change',event=>states.push(event.target.checked));
    reply=await run(ocr(2));
    check('two clicks uncheck then recheck selected box',reply.ok && document.querySelector('#all').checked && changes===2 && clickEvents===2 && JSON.stringify(states)==='[false,true]');
    setup();
    document.querySelector('label').outerHTML=`<div style="width:22px;height:22px;position:relative">
      <input id="all" type="checkbox" style="position:absolute;pointer-events:none">
      <div id="box" style="position:absolute;inset:0;border:1px solid gray"></div></div>`;
    document.querySelector('#all').checked=true;
    const asyncStates=[];
    document.querySelector('#box').addEventListener('click',()=>setTimeout(()=>{
      const control=document.querySelector('#all');control.checked=!control.checked;asyncStates.push(control.checked);
    },200));
    reply=await run({...proxyStep,clicks:2});
    check('two clicks wait for each asynchronous custom checkbox toggle',reply.ok && document.querySelector('#all').checked && clickEvents===2 && JSON.stringify(asyncStates)==='[false,true]');
    setup();
    const label=document.querySelector('label');
    label.innerHTML='<span role="checkbox" aria-checked="false" style="display:block;width:22px;height:22px">□</span>';
    label.firstChild.addEventListener('click',e=>e.currentTarget.setAttribute('aria-checked','true'));
    reply=await run(ocr());
    check('custom aria checkbox verified',reply.ok && document.querySelector('[role="checkbox"]').getAttribute('aria-checked')==='true');
    setup();
    document.querySelector('#all').checked=true;
    reply=await run({selector:{method:'css',value:'label'},action:{type:'marcar_checkbox'},timeout_ms:800});
    check('ensure checked preserves existing selection',reply.ok && document.querySelector('#all').checked && changes===0);
  } catch(error) {result.errors.push(String(error.stack||error))}
  document.querySelector('#result').textContent=JSON.stringify(result);
})();
"""


class ChromeCheckboxBrowserTest(unittest.TestCase):
    def test_ocr_checkbox_clicks_and_confirmation(self):
        browser = browser_path()
        if not browser:
            self.skipTest("Install Chrome/Edge or set FLOWDETECT_TEST_BROWSER")
        source = (ROOT / "flowdetect_chrome/content.js").read_text(encoding="utf-8")
        with tempfile.TemporaryDirectory(prefix="flowdetect-checkbox-") as temporary:
            fixture = Path(temporary) / "checkbox.html"
            fixture.write_text(
                '<!doctype html><meta charset="utf-8"><style>td{padding:20px}'
                'label{display:block;width:22px;height:22px;border:1px solid gray}'
                'input{opacity:0;width:22px;height:22px;margin:0}</style>'
                '<div id="fixture"></div><pre id="result"></pre><script>'
                'window.chrome={runtime:{onMessage:{addListener(){},removeListener(){}}}};\n'
                + source + '\n' + SCENARIO + '</script>', encoding="utf-8")
            completed = subprocess.run([
                browser, "--headless", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
                f"--user-data-dir={Path(temporary) / 'profile'}", "--window-size=900,650",
                "--virtual-time-budget=8000", "--dump-dom", fixture.as_uri(),
            ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=40,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            dom = completed.stdout.decode("utf-8", errors="replace")
            match = re.search(r'<pre id="result">(.*?)</pre>', dom, re.S)
            self.assertTrue(match and match.group(1), completed.stderr.decode(errors="replace")[-2000:])
            result = json.loads(html.unescape(match.group(1)))
            self.assertEqual(result["errors"], [], "\n".join(result["errors"]))
            self.assertEqual(len(result["checks"]), 13)


if __name__ == "__main__":
    unittest.main()

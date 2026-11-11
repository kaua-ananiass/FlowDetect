const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');const {spawnSync}=require('node:child_process');
test('table workbook is a valid two-sheet OOXML archive preserving leading zero IDs, escaped text and non-formula values',async()=>{
 const code=await fs.readFile(path.resolve(__dirname,'../flowdetect_chrome/table-workbook.js'),'utf8');const mod=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 const bytes=mod.tableWorkbookBytes([{Empresa:'Empresa & Filhos',Guia:'00123',Total:'1.234,56'}],[{Empresa:'Empresa & Filhos',Guia:'00123',Nome:'Pessoa <Teste>',Observacao:'=1+1'}]);
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'flowdetect-xlsx-'));const file=path.join(dir,'dados.xlsx');try{await fs.writeFile(file,bytes);
 const script=`import sys,zipfile,xml.etree.ElementTree as E
with zipfile.ZipFile(sys.argv[1]) as z:
 assert z.testzip() is None
 for n in z.namelist(): E.fromstring(z.read(n))
 ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
 sheets=E.fromstring(z.read('xl/workbook.xml')).find('s:sheets',ns)
 assert [s.attrib['name'] for s in sheets]==['Guias','Detalhamento']
 first=E.fromstring(z.read('xl/worksheets/sheet1.xml'))
 second=E.fromstring(z.read('xl/worksheets/sheet2.xml'))
 values=lambda r:[e.text for e in r.findall('.//s:t',ns)]
 assert '00123' in values(first) and 'Empresa & Filhos' in values(first)
 assert '=1+1' in values(second) and 'Pessoa <Teste>' in values(second)
 assert not second.findall('.//s:f',ns)
 assert first.find('.//s:pane',ns).attrib['state']=='frozen'
 assert first.find('s:autoFilter',ns) is not None
`;
 const result=spawnSync('python',['-c',script,file],{encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);
 assert.ok(mod.tableWorkbookDataUrl([],[]).startsWith('data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,'));
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});

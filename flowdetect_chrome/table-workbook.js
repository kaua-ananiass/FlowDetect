// Small, dependency-free OOXML writer. Values remain text to preserve IDs and Brazilian formatting.
const xml=value=>String(value??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const encoder=new TextEncoder();
function crc32(bytes){let n=0xffffffff;for(const b of bytes){n^=b;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);}return (n^0xffffffff)>>>0;}
function zip(files){
 const chunks=[],central=[];let offset=0,size=0;
 const make=(length,fields)=>{const bytes=new Uint8Array(length),view=new DataView(bytes.buffer);for(const [at,n,width] of fields)width===4?view.setUint32(at,n,true):view.setUint16(at,n,true);return bytes;};
 for(const [name,text] of files){const path=encoder.encode(name),data=encoder.encode(text),crc=crc32(data);
  const local=make(30,[[0,0x04034b50,4],[4,20,2],[6,0x800,2],[12,33,2],[14,crc,4],[18,data.length,4],[22,data.length,4],[26,path.length,2]]);
  const record=make(46,[[0,0x02014b50,4],[4,20,2],[6,20,2],[8,0x800,2],[14,33,2],[16,crc,4],[20,data.length,4],[24,data.length,4],[28,path.length,2],[42,offset,4]]);
  chunks.push(local,path,data);central.push(record,path);offset+=local.length+path.length+data.length;size+=record.length+path.length;
 }
 chunks.push(...central,make(22,[[0,0x06054b50,4],[8,files.length,2],[10,files.length,2],[12,size,4],[16,offset,4]]));
 const result=new Uint8Array(chunks.reduce((n,b)=>n+b.length,0));let at=0;for(const b of chunks){result.set(b,at);at+=b.length;}return result;
}
const colName=index=>{let s='';for(let n=index+1;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
function sheet(rows,fallback){
 const columns=[...new Set(rows.flatMap(row=>Object.keys(row)))];if(!columns.length)columns.push(...fallback);
 if(columns.length>250||rows.length>10000)throw Error('A planilha excedeu o limite de linhas ou colunas.');
 const grid=[columns,...rows.map(row=>columns.map(c=>row[c]))];
 const range=`A1:${colName(columns.length-1)}${grid.length}`;
 return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="${range}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>${columns.map((c,i)=>`<col min="${i+1}" max="${i+1}" width="${Math.min(42,Math.max(16,String(c).length+3))}" customWidth="1"/>`).join('')}</cols><sheetData>${grid.map((row,i)=>`<row r="${i+1}" ht="${i===0?30:22}" customHeight="1">${row.map((value,j)=>`<c r="${colName(j)}${i+1}" s="${i===0?1:i%2?2:3}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`).join('')}</row>`).join('')}</sheetData><autoFilter ref="${range}"/></worksheet>`;
}
export function tableWorkbookBytes(guides,details){
 const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
 const files=[
  ['[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'+['workbook','worksheets/sheet1','worksheets/sheet2','styles'].map(n=>`<Override PartName="/xl/${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.${n==='workbook'?'sheet.main':n==='styles'?'styles':'worksheet'}+xml"/>`).join('')+'</Types>'],
  ['_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
  ['xl/workbook.xml',`<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Guias" sheetId="1" r:id="rId1"/><sheet name="Detalhamento" sheetId="2" r:id="rId2"/></sheets></workbook>`],
  ['xl/_rels/workbook.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+['worksheets/sheet1.xml','worksheets/sheet2.xml','styles.xml'].map((p,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${i===2?'styles':'worksheet'}" Target="${p}"/>`).join('')+'</Relationships>'],
  ['xl/styles.xml',`<styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/><color rgb="FF183449"/></font><font><b/><sz val="11"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF123449"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAF5F8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="49" fontId="0" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`],
  ['xl/worksheets/sheet1.xml',sheet(guides,['Empresa','Número da Guia'])],['xl/worksheets/sheet2.xml',sheet(details,['Empresa','Número da Guia'])]
 ];const bytes=zip(files);if(bytes.length>20000000)throw Error('A planilha excedeu 20 MB.');return bytes;
}
export function tableWorkbookDataUrl(guides,details){const bytes=tableWorkbookBytes(guides,details);let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,'+btoa(binary);}

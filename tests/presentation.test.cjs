const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const code=html.slice(html.indexOf('function hl('),html.indexOf('// ---------- state ----------'));
const excerpt=html.slice(html.indexOf('function searchExcerpt('),html.indexOf('function renderSearch('));
const context=vm.createContext({esc:s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))});vm.runInContext(code+'\n'+excerpt,context);
test('Table wrappers remain balanced when followed by lists, headings and paragraphs',()=>{
 for(const next of ['• A','# Heading','Paragraph']){
  const output=context.fmt('| A | B\n| C | D\n'+next,[],[],false);
  assert.equal((output.match(/<table>/g)||[]).length,1);assert.equal((output.match(/<div/g)||[]).length,(output.match(/<\/div>/g)||[]).length);
  assert.match(output,/<\/table><\/div><\/div>/);assert.ok(output.includes('tabindex="0"'));assert.ok(output.includes('A'));assert.ok(output.includes('D'));
 }
});
test('Search previews are bounded and centred near matching text',()=>{
 const text='background '.repeat(100)+'sepsis '+'following '.repeat(100);const result=context.searchExcerpt(text,['sepsis']);
 assert.ok(result.length<=324);assert.ok(result.includes('sepsis'));assert.ok(result.startsWith('… '));assert.ok(result.endsWith(' …'));
 assert.equal(context.searchExcerpt('Short text',[]),'Short text');
});

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const adult=JSON.parse(fs.readFileSync(path.join(root,'ak_index.json')));
const child=JSON.parse(fs.readFileSync(path.join(root,'barn/data.json')));
function key(d){
 const u=new URL(d.url,'https://akutkompassen.se/barn/');
 const ref=u.searchParams.get('reference');
 if(ref)return ref.toLowerCase();
 return decodeURIComponent(u.hostname+u.pathname).normalize('NFC').toLowerCase().replace(/\/$/,'');
}
test('Each catalogue has unique IDs, source documents and valid categories',()=>{
 for(const catalogue of [adult,child]){
  assert.equal(new Set(catalogue.docs.map(d=>d.id)).size,catalogue.docs.length);
  assert.equal(new Set(catalogue.docs.map(key)).size,catalogue.docs.length);
  for(const d of catalogue.docs)assert.ok(catalogue.areas[d.a||d.area]);
 }
});
test('Child-only guidelines are in Barn exactly once and absent from Vuxen',()=>{
 for(const id of ['GL02','GL27','GL29','GL31','GL50','GL71','GL72']){
  assert.ok(!adult.docs.some(d=>d.id===id));
  assert.equal(child.docs.filter(d=>d.id===id).length,1);
 }
 assert.ok(!adult.docs.some(d=>d.id==='GL88'));
 assert.equal(child.docs.filter(d=>d.url.includes('Procedursedering-och-smartlindring-inom-barnakutsjukvard')).length,1);
 assert.equal(child.docs.find(d=>d.id==='swepem-13').date,'2026-02-19');
 assert.ok(!adult.docs.some(d=>/paediatric|pediatric|for children|in children|– children|under (5|16)s|barnakutsjukvård/i.test(d.t)));
});
test('Cross-catalogue overlap is limited to documented adult-and-child resources',()=>{
 const childUrls=new Set(child.docs.map(key));
 assert.deepEqual(adult.docs.filter(d=>childUrls.has(key(d))).map(d=>d.id).sort(),['21087','GL87']);
});

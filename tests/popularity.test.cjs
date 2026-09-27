const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
const docs=[{id:'a',title:'Alfa',area:'lung'},{id:'b',title:'Beta',area:'lung'},{id:'c',title:'Gamma',area:'neuro'}];
function setup({excluded=false,endpoint='https://counter.example',counts={},now='2026-09-27T00:00:00Z'}={}){const calls=[];const state=new Map(excluded?[['ak.popularity.exclude','1']]:[]);const context={Date:class extends Date{static now(){return Date.parse(now);}},AK_POPULARITY_ENDPOINT:endpoint,localStorage:{getItem:k=>state.get(k)||null},document:{addEventListener(){}},location:{hostname:'akutkompassen.se'},AbortSignal,crypto:globalThis.crypto,fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({counts})};}};vm.runInNewContext(fs.readFileSync('popularity.js','utf8'),context);return {p:context.AkPopularity.create('adult',docs,()=>{}),calls,state};}
test('No fabricated badge, including empty or unavailable counters',async()=>{const {p}=setup();await p.load();assert.equal(p.badge(docs[0]),'');assert.match(p.status(),/Inga registrerade/);});
test('Global counts sort across visitors and categories, ties resolve consistently',async()=>{const {p}=setup({counts:{'adult:a':2,'adult:b':7,'adult:c':3}});await p.load();assert.deepEqual([...docs].sort(p.compare).map(x=>x.id),['b','c','a']);assert.equal(p.badge(docs[0]),'');assert.match(p.badge(docs[1]),/POPULÄR!/);assert.match(p.badge(docs[2]),/POPULÄR!/);const tie=setup({counts:{'adult:a':2,'adult:b':2}}).p;await tie.load();assert.ok(tie.badge(docs[0]));assert.equal(tie.badge(docs[1]),'');});
test('Owner exclusion sends no click but still reads shared rankings',async()=>{const {p,calls}=setup({excluded:true});await p.load();p.record('a');assert.equal(calls.length,1);assert.match(calls[0].url,/counts$/);});
test('Counts only document opens, throttles repeats, sends no search or visitor identity',()=>{const {p,calls}=setup();p.record('a');p.record('a');assert.equal(calls.length,1);const body=JSON.parse(calls[0].options.body);assert.deepEqual(Object.keys(body).sort(),['document','event']);assert.equal(body.document,'adult:a');assert.equal(calls[0].options.referrerPolicy,'no-referrer');});
test('Unconfigured deployment sends no requests',async()=>{const {p,calls}=setup({endpoint:''});await p.load();p.record('a');assert.equal(calls.length,0);});

test('New badges use publication dates within a year, including the anniversary',()=>{
 const {p}=setup({endpoint:''});
 for(const date of ['2026-09-27','2026-01-01','2025-12-01','2025-09-27'])assert.match(p.badge({...docs[0],date}),/>NY!</);
 for(const date of [undefined,'2025-09-26','2025-01-01','2026-09-28','2026-02-30','invalid'])assert.equal(p.badge({...docs[0],date}), '');
 assert.equal(p.badge({...docs[0],addedOn:'2026-09-27',checked:'2026-09-27',verified:'2026-09-27'}),'');
 assert.match(p.badge({...docs[0],yr:'2026'}),/>NY!</);
 assert.equal(p.badge({...docs[0],yr:'2025'}),'');
 assert.equal(p.badge({...docs[0],yr:'2027'}),'');
 assert.equal(p.badge({...docs[0],publishedOn:'2025-01-01',yr:'2026'}),'');
 assert.match(p.badge({...docs[0],publishedOn:'2025-11-10',yr:'2025'}),/>NY!</);
 const later=setup({now:'2027-01-02T00:00:00Z'}).p;
 assert.equal(later.badge({...docs[0],date:'2026-01-01'}),'');
 assert.match(later.badge({...docs[0],date:'2026-01-02'}),/>NY!</);
});
test('New and popular badges coexist, independent of tracking exclusion',async()=>{
 const {p}=setup({excluded:true,counts:{'adult:a':5}});await p.load();
 const badge=p.badge({...docs[0],publishedOn:'2026-09-25'});
 assert.match(badge,/>NY!</);assert.match(badge,/>POPULÄR!</);
 assert.match(p.status(),/POPULÄR!/);assert.doesNotMatch(p.status(),/gul cirkel/);
});

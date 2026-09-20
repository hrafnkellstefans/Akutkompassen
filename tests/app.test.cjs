const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const data=JSON.parse(fs.readFileSync(path.join(root,'ak_index.json'),'utf8'));
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
async function boot({failArea,failIndex=false,storage={},index=data}={}){
  const errors=[],opened=[];let failed=failArea;
  const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
  const dom=new JSDOM(html,{url:'https://example.org/Akutkompassen/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
    w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
    w.open=(...args)=>opened.push(args);w.requestIdleCallback=f=>w.setTimeout(f,0);
    for(const [key,value] of Object.entries(storage))w.localStorage.setItem('ak.'+key,JSON.stringify(value));
    w.fetch=async url=>{
      const name=url.split('?')[0];
      if((failIndex&&name==='ak_index.json')||name===failed)throw Error('Offline');
      return {ok:true,json:async()=>name==='ak_index.json'?JSON.parse(JSON.stringify(index)):JSON.parse(fs.readFileSync(path.join(root,name),'utf8'))};
    };
  }});
  await tick();await tick();await tick();
  return {dom,w:dom.window,d:dom.window.document,errors,opened,recover(){failed=null;}};
}
async function query(app,value){app.d.getElementById('q').value=value;app.d.getElementById('q').dispatchEvent(new app.w.Event('input'));await new Promise(r=>setTimeout(r,180));}

test('quoted guideline titles are found and title-only results open on click and Enter',async()=>{
 const a=await boot();try{
  await query(a,'"Adult Advanced Life Support"');
  assert.match(a.d.getElementById('main').textContent,/ERC 2025/);
  const result=a.d.querySelector('.hit.tonly');assert.ok(result);result.click();
  result.dispatchEvent(new a.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  assert.equal(a.opened.length,2);assert.match(a.opened[0][0],/resuscitationjournal/);assert.equal(a.errors.length,0);
  await query(a,'ERC "phrase that does not exist"');assert.equal(a.d.querySelectorAll('.doc').length,0);
 }finally{a.w.close();}
});
test('PM titles remain searchable after their body text has loaded',async()=>{
 const index=JSON.parse(JSON.stringify(data));index.docs.find(d=>d.id==='8474').t='Unique Review Title';
 const a=await boot({index});try{await query(a,'"Unique Review Title"');assert.ok(a.d.querySelector('.hit.tonly'));a.d.querySelector('[data-act=open]').click();assert.equal(a.d.getElementById('reader').hidden,false);assert.equal(a.errors.length,0);}finally{a.w.close();}
});
test('reader moves and traps focus, blocks search shortcut, and restores focus',async()=>{
 const a=await boot();try{
  a.d.querySelector('[data-area="TRA"]').click();const trigger=a.d.querySelector('[data-act=open]');trigger.focus();trigger.click();
  assert.equal(a.d.activeElement.id,'rclose');assert.equal(a.d.querySelector('header').inert,true);
  assert.equal(a.d.querySelector('[role=dialog]').getAttribute('aria-labelledby'),'rtitle');
  a.d.dispatchEvent(new a.w.KeyboardEvent('keydown',{key:'/',bubbles:true}));assert.equal(a.d.activeElement.id,'rclose');
  a.d.dispatchEvent(new a.w.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));
  assert.equal(a.d.activeElement,a.d.querySelector('#pnav button:last-child'));
  a.d.dispatchEvent(new a.w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));assert.equal(a.d.activeElement.id,'rclose');
  a.d.dispatchEvent(new a.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.equal(a.d.getElementById('reader').hidden,true);assert.equal(a.d.querySelector('header').inert,false);assert.equal(a.d.activeElement,trigger);
 }finally{a.w.close();}
});
test('four-calendar-year PM boundary and explicit expiry have distinct warnings',async()=>{
 const index=JSON.parse(JSON.stringify(data));const current=new Date().getFullYear();
 index.docs.find(d=>d.id==='9109').yr=String(current-4);
 index.docs.find(d=>d.id==='8474').yr=String(current-3);
 const a=await boot({index});try{
  await query(a,'"Kompartmentsyndrom"');assert.match(a.d.querySelector('[data-fav="9109"]').closest('.doc').querySelector('.meta').textContent,/Äldre PM/);
  await query(a,'"Traumamanual Region Uppsala"');assert.doesNotMatch(a.d.querySelector('[data-fav="8474"]').closest('.doc').querySelector('.meta').textContent,/Äldre PM/);
  const expired=index.docs.find(d=>d.id==='10383');await query(a,'"'+expired.t+'"');assert.match(a.d.querySelector('[data-fav="10383"]').closest('.doc').querySelector('.meta').textContent,/Utgången giltighet/);
 }finally{a.w.close();}
});
test('failed area loading is visible and a retry restores search coverage',async()=>{
 const a=await boot({failArea:'ak_TRA.json'});try{
  assert.match(a.d.getElementById('ldst').textContent,/ofullständig/);assert.equal(a.d.getElementById('retry-load').hidden,false);
  a.recover();a.d.getElementById('retry-load').click();await tick();await tick();
  assert.equal(a.d.getElementById('ldst').hidden,true);assert.equal(a.d.getElementById('retry-load').hidden,true);
  await query(a,'tranexamsyra');assert.ok(a.d.querySelectorAll('.hit[data-i]').length>0);
 }finally{a.w.close();}
});
test('index failures offer a useful retry and malformed saved state does not crash startup',async()=>{
 const a=await boot({failIndex:true});assert.match(a.d.querySelector('[role=alert]').textContent,/Försök igen/);a.w.close();
 const b=await boot({storage:{favs:{bad:1},recent:null}});assert.equal(b.d.querySelector('[role=alert]'),null);assert.ok(b.d.querySelector('.acard'));b.w.close();
});
test('saved and recent documents respect the PM/guideline filter',async()=>{
 const a=await boot({storage:{favs:['8474','GL01'],recent:['8474','GL01']}});try{
  a.d.querySelector('[data-k=gl]').click();
  assert.equal(a.d.querySelector('[data-k=gl]').getAttribute('aria-pressed'),'true');
  assert.equal(a.d.querySelector('[data-open="8474"]'),null);assert.ok(a.d.querySelector('[data-open="GL01"]'));
  assert.match(a.d.getElementById('stat').textContent,/0 PM · 76 riktlinjer/);
 }finally{a.w.close();}
});
test('index and all text shards are consistent, source URLs are HTTPS, release versions agree',()=>{
 assert.equal(new Set(data.docs.map(d=>d.id)).size,data.docs.length);
 assert.equal(data.docs.filter(d=>d.kind==='pm').length,132);assert.equal(data.docs.filter(d=>d.kind==='gl').length,76);
 for(const d of data.docs)assert.equal(new URL(d.url).protocol,'https:');
 for(const [area,file] of Object.entries(data.shards)){
  const shard=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
  assert.deepEqual(Object.keys(shard.docs).sort(),data.docs.filter(d=>d.a===area&&d.txt).map(d=>d.id).sort());
  for(const [id,chunks] of Object.entries(shard.docs)){
   const d=data.docs.find(d=>d.id===id);assert.ok(chunks.length);
   for(const [pg,text] of chunks){assert.ok(pg>=1&&pg<=d.np);assert.equal(typeof text,'string');}
  }
 }
 assert.equal(html.match(/data-v="([^"]+)"/)[1],data.v);
 assert.ok(fs.readFileSync(path.join(root,'sw.js'),'utf8').includes("const VERSION = '"+data.v+"'"));
});

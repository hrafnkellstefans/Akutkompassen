const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
async function app(t,child=false,hash='',saved=[]){
 const html=fs.readFileSync(path.join(root,child?'barn/index.html':'index.html'),'utf8');
 const dom=new JSDOM(html,{url:'https://akutkompassen.se/'+(child?'barn/':'')+hash,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;w.scrollTo=()=>{};w.matchMedia=()=>({matches:false});w.requestIdleCallback=()=>{};
 w.CSS={escape:x=>x};w.localStorage.setItem(child?'ak.barn.saved':'ak.favs',JSON.stringify(saved));
 w.AkPopularity={create:()=>({compare:()=>0,badge:()=>'',status:()=>'',load:()=>{},whenReady:()=>Promise.resolve(),record:()=>{}})};
 w.fetch=async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(root,child?'barn':'',String(url).split('?')[0]),'utf8'))});
 w.eval(fs.readFileSync(path.join(root,'search-terms.js'),'utf8'));
 if(child)w.eval(fs.readFileSync(path.join(root,'barn/app.js'),'utf8'));
 else for(const s of w.document.querySelectorAll('script:not([src])'))if(s.type!=='application/json'&&s.type!=='application/ld+json')w.eval(s.textContent);
 await new Promise(r=>setTimeout(r,30));t.after(()=>w.close());return w;
}
test('Adult advanced references are opt-in, URL-restored, and still available in saved documents',async t=>{
 const w=await app(t,false,'#q=ARDS');const q=s=>w.document.querySelector(s);
 assert.equal(q('[data-doc="GL119"]'),null);
 q('[data-f="advanced"]').click();assert.ok(q('[data-doc="GL119"]'));assert.ok(w.location.hash.includes('fordjupning=1'));
 q('#reset').click();assert.equal(q('[data-f="advanced"]').getAttribute('aria-pressed'),'false');
 const restored=await app(t,false,'#q=ARDS&fordjupning=1');assert.ok(restored.document.querySelector('[data-doc="GL119"]'));
 const saved=await app(t,false,'#sparade=1',['GL119']);assert.ok(saved.document.querySelector('[data-doc="GL119"]'));
});
test('Child sepsis search groups supporting material but preserves its links and saved items',async t=>{
 const w=await app(t,true,'#q=sepsis');const d=w.document;
 assert.ok(d.querySelector('[data-doc="blf-inf-23"]'));
 for(const id of ['blf-inf-22','blf-inf-24','blf-inf-25','blf-inf-26']){assert.equal(d.querySelector(`[data-doc="${id}"]`),null);assert.ok(d.querySelector(`a[data-count-open="${id}"]`));}
 const phoenix=await app(t,true,'#q=Phoenix');assert.ok(phoenix.document.querySelector('[data-doc="blf-inf-23"]'));
 const saved=await app(t,true,'#sparade=1',['blf-inf-24']);assert.ok(saved.document.querySelector('[data-doc="blf-inf-24"]'));
});
test('Child advanced references are opt-in and reset restores the core list',async t=>{
 const w=await app(t,true,'#q=PFAPA');const d=w.document;
 assert.equal(d.querySelector('[data-doc="blf-reuma-pfapa"]'),null);d.querySelector('#advanced').click();assert.ok(d.querySelector('[data-doc="blf-reuma-pfapa"]'));
 assert.ok(w.location.hash.includes('fordjupning=1'));d.querySelector('#reset').click();assert.equal(d.querySelector('#advanced').getAttribute('aria-pressed'),'false');
});

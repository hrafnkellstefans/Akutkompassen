/* Shared aggregate counts only. No per-browser popularity ranking. */
(function(root){
 'use strict';
 const EXCLUDE='ak.popularity.exclude';
 const CACHE='ak.popularity.counts.v1',CACHE_MAX_AGE=14*864e5;
 const get=(key)=>{try{return localStorage.getItem(key);}catch{return null;}};
 const set=(key,value)=>{try{localStorage.setItem(key,value);}catch{}};
 const validCounts=c=>!!c&&typeof c==='object'&&!Array.isArray(c);
 // Last successful snapshot, so the first render is already in popularity order
 // and the list never has to reshuffle under the reader's eyes.
 function cached(){try{const v=JSON.parse(get(CACHE)||'null');return v&&validCounts(v.counts)&&Date.now()-v.t<CACHE_MAX_AGE?v.counts:null;}catch{return null;}}
 const count=(counts,id)=>Number.isSafeInteger(counts[id])&&counts[id]>0?counts[id]:0;
 function create(section,docs,refresh){
  // `refresh` is no longer called when counts arrive: re-sorting a rendered list
  // caused large layout shifts (CLS). New counts apply on the next render.
  const snapshot=cached();
  let counts=snapshot||{},ready=!!snapshot,lastFetch=0;const cooldown=new Map();
  let markReady;const readyPromise=new Promise(r=>{markReady=r;});if(ready)markReady();
  const key=d=>section+':'+d.id;
  const endpoint=String(root.AK_POPULARITY_ENDPOINT||'').replace(/\/$/,'');
  const excluded=()=>get(EXCLUDE)==='1';
  const compare=(a,b)=>count(counts,key(b))-count(counts,key(a))||(a.title||a.t).localeCompare(b.title||b.t,'sv')||String(a.id).localeCompare(String(b.id));
  function leader(d){if(!ready||!count(counts,key(d)))return false;return !docs.some(x=>(x.area||x.a)===(d.area||d.a)&&compare(x,d)<0);}
  function isNew(d){
   // Source publication/approval date only; never the date added or link-checked.
   const value=String(d.publishedOn||d.date||d.yr||'');
   const now=new Date(Date.now()),today=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
   const cutoff=new Date(today);cutoff.setUTCFullYear(cutoff.getUTCFullYear()-1);
   // A year alone cannot establish that a previous-year document is recent.
   if(/^\d{4}$/.test(value))return Number(value)===now.getUTCFullYear();
   if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
   const published=Date.parse(value+'T00:00:00Z');
   return Number.isFinite(published)&&new Date(published).toISOString().slice(0,10)===value&&published>=cutoff.getTime()&&published<=today;
  }
  function badge(d){
   const labels=[];
   if(isNew(d))labels.push('<span class="document-badge badge-new" title="Publicerad eller godkänd under de senaste 12 månaderna">NY!</span>');
   if(leader(d))labels.push('<span class="document-badge badge-popular" title="Mest öppnad i området · alla besökare">POPULÄR!</span>');
   return labels.length?'<span class="document-badges">'+labels.join('')+'</span>':'';
  }
  // Resolves when counts are available (cache or network) or after `ms`, whichever is first.
  function whenReady(ms){return Promise.race([readyPromise,new Promise(r=>setTimeout(r,ms))]);}
  async function load(){
   if(!endpoint){markReady();return;}if(Date.now()-lastFetch<60000)return;lastFetch=Date.now();
   try{const r=await fetch(endpoint+'/counts',{credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error();const payload=await r.json();if(!validCounts(payload.counts))throw Error();counts=payload.counts;ready=true;set(CACHE,JSON.stringify({t:Date.now(),counts}));}catch{/* Keep site usable and retain last successful aggregate snapshot. */}finally{markReady();}
  }
  function record(id){
   if(!endpoint||excluded()||!['akutkompassen.se','www.akutkompassen.se'].includes(location.hostname))return;
   const now=Date.now(),document=section+':'+id;if(now-(cooldown.get(document)||0)<30000)return;cooldown.set(document,now);
   // No search text, URL, persistent visitor ID or user profile is sent.
   fetch(endpoint+'/click',{method:'POST',credentials:'omit',referrerPolicy:'no-referrer',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({document,event:crypto.randomUUID()})}).catch(()=>{});
  }
  function status(){return !endpoint?'Popularitetsstatistik är ännu inte aktiverad.':!ready?'Popularitetsstatistik kunde inte hämtas. Visar A–Ö.':Object.keys(counts).some(k=>k.startsWith(section+':')&&count(counts,k))?'Mest öppnade först · POPULÄR! = mest öppnad i området':'Inga registrerade öppningar ännu. Visar A–Ö.';}
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')load();});
  return {compare,badge,record,load,whenReady,status,excluded};
 }
 root.AkPopularity={create,EXCLUDE};
})(globalThis);

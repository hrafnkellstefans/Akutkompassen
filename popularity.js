/* Shared aggregate counts only. No per-browser popularity ranking. */
(function(root){
 'use strict';
 const EXCLUDE='ak.popularity.exclude';
 const get=(key)=>{try{return localStorage.getItem(key);}catch{return null;}};
 const count=(counts,id)=>Number.isSafeInteger(counts[id])&&counts[id]>0?counts[id]:0;
 function create(section,docs,refresh){
  let counts={},ready=false,lastFetch=0;const cooldown=new Map();
  const key=d=>section+':'+d.id;
  const endpoint=String(root.AK_POPULARITY_ENDPOINT||'').replace(/\/$/,'');
  const excluded=()=>get(EXCLUDE)==='1';
  const compare=(a,b)=>count(counts,key(b))-count(counts,key(a))||(a.title||a.t).localeCompare(b.title||b.t,'sv')||String(a.id).localeCompare(String(b.id));
  function leader(d){if(!ready||!count(counts,key(d)))return false;return !docs.some(x=>(x.area||x.a)===(d.area||d.a)&&compare(x,d)<0);}
  function badge(d){return leader(d)?'<span class="popular-dot" role="img" aria-label="Mest öppnad i området" title="Mest öppnad i området · alla besökare"></span>':'';}
  async function load(){
   if(!endpoint||Date.now()-lastFetch<60000)return;lastFetch=Date.now();
   try{const r=await fetch(endpoint+'/counts',{credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error();const payload=await r.json();if(!payload.counts||typeof payload.counts!=='object'||Array.isArray(payload.counts))throw Error();counts=payload.counts;ready=true;refresh();}catch{/* Keep site usable and retain last successful aggregate snapshot. */}
  }
  function record(id){
   if(!endpoint||excluded()||!['akutkompassen.se','www.akutkompassen.se'].includes(location.hostname))return;
   const now=Date.now(),document=section+':'+id;if(now-(cooldown.get(document)||0)<30000)return;cooldown.set(document,now);
   // No search text, URL, persistent visitor ID or user profile is sent.
   fetch(endpoint+'/click',{method:'POST',credentials:'omit',referrerPolicy:'no-referrer',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({document,event:crypto.randomUUID()})}).catch(()=>{});
  }
  function status(){return !endpoint?'Popularitetsstatistik är ännu inte aktiverad.':!ready?'Popularitetsstatistik kunde inte hämtas. Visar A–Ö.':Object.keys(counts).some(k=>k.startsWith(section+':')&&count(counts,k))?'Mest öppnade först · gul cirkel = mest öppnad i området':'Inga registrerade öppningar ännu. Visar A–Ö.';}
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')load();});
  return {compare,badge,record,load,status,excluded};
 }
 root.AkPopularity={create,EXCLUDE};
})(globalThis);

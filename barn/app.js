'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normal=s=>String(s).toLocaleLowerCase('sv').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const STOP=new Set('och i att det som en pa ar av for med till den har de inte om ett vid kan eller sa ska fran man men efter sig vara alla nar dar samt aven dessa detta denna hos under over mot ut in upp ner per'.split(' '));
const colors={lung:'#178b9a',akut:'#b6532f',luft:'#178b9a',inf:'#c28012',neuro:'#7963b6',buk:'#4d8772',vatska:'#2289b6',met:'#a35c91',trauma:'#cc7850',smarta:'#96679b',hjarta:'#b55669',tox:'#738643',neo:'#388782',trygg:'#6181b4'};
const labels={uppsala:'Lokalt PM · Akademiska',karolinska:'Externt PM · Karolinska',nationellt:'Nationellt & övrigt'};
let popularity;let data,source='all',area='all',onlySaved=false,saved=new Set();
try{const v=JSON.parse(localStorage.getItem('ak.barn.saved')||'[]');if(Array.isArray(v))saved=new Set(v.filter(x=>typeof x==='string'));}catch{}

// ---------- search (no DOM; tests load this part) ----------
function termsOf(query){return normal(query).split(' ').filter(t=>t.length>1&&!STOP.has(t));}
// Words of three letters or fewer (dos, hus, itp) must start a word; longer ones may sit inside a compound (kramp in feberkramp).
function hit(hay,t){if(t.length<=3)return (' '+hay).includes(' '+t);if(hay.includes(t))return true;if(t.length>=6&&hay.includes(t.slice(0,-2)))return true;if(t.length>=7&&hay.includes(t.slice(0,-3)))return true;return false;}
const synonymsOf=t=>typeof AkTerms!=='undefined'?AkTerms.synonyms(t).map(normal):[];
const variants=t=>[t,...synonymsOf(t)];
function hayOf(d){return d._hay||(d._hay=normal([d.title,d.publisher,data.areas[d.area],d.scope,...(d.keywords||[])].join(' ')));}
const termHit=(d,t)=>variants(t).some(v=>hit(hayOf(d),v));
function termScore(d,v){const title=normal(d.title),kw=normal((d.keywords||[]).join(' '));let s=0;if(title.split(' ').includes(v))s+=6;else if(hit(title,v))s+=4;if(hit(kw,v))s+=2;return s;}
function scoreDoc(d,terms){
 let s=0;
 for(const t of terms){let best=0;variants(t).forEach((v,i)=>{best=Math.max(best,termScore(d,v)*(i?0.8:1));});s+=best;}
 // Title starting with the first search word itself (not just a longer compound such as Feberkramp for feber).
 if(terms.length&&normal(d.title).split(' ')[0]===terms[0])s+=3;
 return s;
}
let VOCAB=null;const VFREQ=new Map();
function vocab(docs){
 if(!VOCAB){for(const d of docs)for(const w of hayOf(d).split(' '))if(w.length>2)VFREQ.set(w,(VFREQ.get(w)||0)+1);
  if(typeof AkTerms!=='undefined')AkTerms.words().forEach(w=>{if(!VFREQ.has(w))VFREQ.set(w,0);});VOCAB=[...VFREQ.keys()];}
 return VOCAB;
}
// Every word must match. If nothing does, a word found nowhere is treated as a typo and replaced by
// the closest known word; if still nothing, documents with any of the words are shown, best first.
function searchDocs(docs,query){
 let terms=termsOf(query);const out={terms,fixed:[],partial:false,docs:[]};
 if(!terms.length)return out;
 let found=docs.filter(d=>terms.every(t=>termHit(d,t)));
 if(!found.length&&typeof AkTerms!=='undefined'){
  terms=terms.map(t=>{
   if(t.length<4||docs.some(d=>termHit(d,t)))return t;
   const f=AkTerms.closest(t,vocab(docs),w=>VFREQ.get(w)||0);
   if(f){out.fixed.push([t,f]);return f;}return t;
  });
  out.terms=terms;
  if(out.fixed.length)found=docs.filter(d=>terms.every(t=>termHit(d,t)));
 }
 if(!found.length&&terms.length>1){
  // Rarer words say more: a document with "adrenalin" ranks above one that only has "dos".
  const w=new Map(terms.map(t=>[t,Math.log(1+docs.length/Math.max(1,docs.filter(d=>termHit(d,t)).length))]));
  const n=new Map();for(const d of docs){const k=terms.reduce((s,t)=>s+(termHit(d,t)?w.get(t):0),0);if(k)n.set(d,k);}
  found=[...n.keys()];out.matched=n;out.partial=found.length>0;
 }
 out.docs=found;return out;
}
// Order: most informative query words matched (only when no document has them all), then best score, then the library order
// (local PM first, national, international; most opened first once counts are large enough).
function ranked(res,compare){
 const score=new Map(res.docs.map(d=>[d,scoreDoc(d,res.terms)])),n=d=>res.matched?res.matched.get(d)||0:0;
 return res.docs.slice().sort((x,y)=>n(y)-n(x)||score.get(y)-score.get(x)||compare(x,y));
}

// ---------- page ----------
const HOME_LIMIT=24;let visibleLimit=HOME_LIMIT,pendingPush=false,applying=false;
function reset(){visibleLimit=HOME_LIMIT;const was=location.hash;source='all';area='all';onlySaved=false;$('q').value='';pendingPush=!!was;render();}
function applyQuery(query){source='all';area='all';onlySaved=false;$('q').value=query;pendingPush={search:1};render();window.scrollTo(0,0);if(!matchMedia('(pointer:coarse)').matches)$('q').focus();}
function dateLabel(d){return d.date?`Dokumentdatum ${esc(d.date)}`:d.year?`År ${esc(d.year)}`:'Datum: se original';}
function render(){
 $('popularity-status').textContent=popularity.status();
 const q=$('q').value.trim();const stopOnly=!!q&&!termsOf(q).length;
 document.body.classList.toggle('searching',!!q);
 const pool=data.docs.filter(d=>(source==='all'||d.source===source)&&(!onlySaved||saved.has(d.id)));
 const res=q&&!stopOnly?searchDocs(pool,q):{terms:[],fixed:[],partial:false,docs:stopOnly?[]:pool};
 const base=res.docs;
 const shown=ranked(res,popularity.compare).filter(d=>area==='all'||d.area===area);
 const limited=!q&&!onlySaved&&area==='all'&&source==='all'&&shown.length>visibleLimit;const visible=limited?shown.slice(0,visibleLimit):shown;
 const nSaved=data.docs.filter(d=>saved.has(d.id)).length;$('saved-count').textContent=nSaved||'';
 $('areas').innerHTML=[['all','Alla områden'],...Object.entries(data.areas)].map(([id,t])=>{const n=id==='all'?base.length:base.filter(d=>d.area===id).length;return `<button class="area ${area===id?'active':''}" data-area="${id}" aria-pressed="${area===id}" style="--accent:${colors[id]||'#163c53'}"><span class="area-dot" aria-hidden="true"></span><span>${esc(t)}</span><span class="n">${n}</span></button>`;}).join('');
 document.querySelectorAll('[data-source]').forEach(b=>{if(b.tagName==='BUTTON')b.setAttribute('aria-pressed',source===b.dataset.source);});
 $('saved').setAttribute('aria-pressed',onlySaved);
 $('context').textContent=onlySaved?'DINA SPARADE':q?'SÖKRESULTAT':area==='all'?'HELA BIBLIOTEKET':'KLINISKT OMRÅDE';
 $('results-heading').textContent=area==='all'?(q?'Sök i biblioteket':'PM & riktlinjer'):data.areas[area];
 $('count').textContent=`${shown.length} dokument${q?' för ”'+q+'”':''} · ${source==='all'?'alla källor':source==='uppsala'?'Akademiska':source==='karolinska'?'Karolinska':'nationellt & övrigt'}`;
 const hint=$('search-hint');
 const fixedMsg=res.fixed.length?`Inga träffar för ${res.fixed.map(([w])=>`<b>${esc(w)}</b>`).join(', ')} – visar ${res.fixed.map(([,f])=>`<b>${esc(f)}</b>`).join(', ')}.`:'';
 const partialMsg=res.partial?'Inget dokument innehåller alla orden – visar dokument med något av dem.':'';
 hint.innerHTML=[fixedMsg,partialMsg].filter(Boolean).join(' ');hint.hidden=!hint.innerHTML;
 $('results').innerHTML=shown.length?visible.map(d=>{const yr=Number((d.date||'').slice(0,4)||d.year||0);const old=yr&&yr<=2021;const format=d.format||'';return `<article class="card" data-doc="${esc(d.id)}" data-source="${d.source}" style="--accent:${d.source==='uppsala'?'#007c78':d.source==='karolinska'?'#67486e':'#165bab'}"><div class="card-top"><div class="card-labels"><span class="source-badge">${labels[d.source]||'Källa'}</span>${popularity.badge(d)}</div><button class="save" data-save="${esc(d.id)}" aria-pressed="${saved.has(d.id)}" aria-label="${saved.has(d.id)?'Ta bort sparad':'Spara'}: ${esc(d.title)}">${saved.has(d.id)?'★':'☆'}</button></div><h3><a data-count-open="${esc(d.id)}" href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">${esc(d.title)}</a></h3><p class="publisher">${esc(d.publisher)}</p>${d.scope?`<p class="scope">${esc(d.scope)}</p>`:''}<div class="card-meta"><span class="topic">${esc(data.areas[d.area]||d.area)}</span><span>${dateLabel(d)}</span>${d.checked?`<span>Länk kontrollerad ${esc(d.checked)}</span>`:''}${old?'<span class="old">Äldre dokument · kontrollera giltighet</span>':''}${d.archive?'<span class="old">Bibliotekskopia · giltighet ej verifierad</span>':''}</div><div class="card-bottom"><a data-count-open="${esc(d.id)}" href="${esc(d.url)}" target="_blank" rel="noopener noreferrer" aria-label="Öppna ${esc(d.title)} i ny flik">${format==='Dokumentsamling'?'Öppna samlingen':d.archive?'Sparad PDF':format.includes('PDF')?'Öppna PDF':format.includes('Dokument')?'Öppna dokument':'Till riktlinjen'} ↗</a></div></article>`;}).join('')+(limited?`<button class="show-all" id="show-all">Visa ${Math.min(HOME_LIMIT,shown.length-visibleLimit)} fler · ${visibleLimit} av ${shown.length}</button>`:''):`<div class="empty"><h3>${stopOnly?'Inga sökbara ord':onlySaved?'Inga sparade dokument i detta urval':'Inga träffar'}</h3><p>${stopOnly?'Småord som “och”, “vid” och “för” ignoreras. Prova ett mer specifikt ord.':onlySaved?'Spara ett dokument med stjärnan på kortet.':'Prova ett annat sökord, eller ta bort käll- och områdesfilter.'}</p><button id="empty-reset">Visa hela biblioteket</button></div>`;
 document.querySelectorAll('[data-area]').forEach(b=>b.onclick=()=>{area=b.dataset.area;pendingPush=true;render();const f=document.querySelector(`[data-area="${CSS.escape(area)}"]`);if(f)f.focus();});
 document.querySelectorAll('[data-save]').forEach(b=>b.onclick=()=>{const id=b.dataset.save;saved.has(id)?saved.delete(id):saved.add(id);try{localStorage.setItem('ak.barn.saved',JSON.stringify([...saved]));}catch{}render();const target=document.querySelector(`[data-save="${CSS.escape(id)}"]`);if(target)target.focus();else $('saved').focus();});
 if($('empty-reset'))$('empty-reset').onclick=reset;if($('show-all'))$('show-all').onclick=()=>{visibleLimit+=HOME_LIMIT;render();};
 if(!applying)writeUrl(pendingPush);pendingPush=false;
}
// ---------- address bar: Back works and searches can be shared as links ----------
function stateHash(){const p=new URLSearchParams();const q=$('q').value.trim();if(q)p.set('q',q);if(area!=='all')p.set('omrade',area);if(source!=='all')p.set('kalla',source);if(onlySaved)p.set('sparade','1');const s=p.toString();return s?'#'+s:'';}
function writeUrl(push){
 const url=location.pathname+location.search+stateHash();
 try{if(push)history.pushState(Object.assign({ak:1},typeof push==='object'?push:{}),'',url);else if(url!==location.pathname+location.search+location.hash)history.replaceState(Object.assign({},history.state||{ak:1}),'',url);}catch{}
}
function applyUrl(){
 const p=new URLSearchParams(location.hash.slice(1));
 $('q').value=p.get('q')||'';area=data.areas[p.get('omrade')]?p.get('omrade'):'all';source=['uppsala','karolinska','nationellt'].includes(p.get('kalla'))?p.get('kalla'):'all';onlySaved=p.get('sparade')==='1';
 applying=true;render();applying=false;
}
(async()=>{try{const r=await fetch('./data.json?v=ak-v10s43-snabbguider');if(!r.ok)throw new Error('data');data=await r.json();if(!Array.isArray(data.docs))throw new Error('format');{const ids=new Set(data.docs.map(d=>d.id));const keep=[...saved].filter(id=>ids.has(id));if(keep.length!==saved.size){saved=new Set(keep);try{localStorage.setItem('ak.barn.saved',JSON.stringify(keep));}catch{}}}popularity=AkPopularity.create('barn',data.docs,render);
 let timer;$('q').oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>{const v=$('q').value.trim();if(!v&&history.state&&history.state.search){history.back();return;}if(!location.hash.includes('q=')&&v)pendingPush={search:1};render();},120);};
 $('reset').onclick=reset;$('saved').onclick=()=>{onlySaved=!onlySaved;render();};document.querySelectorAll('button[data-source]').forEach(b=>b.onclick=()=>{source=b.dataset.source;render();});document.querySelectorAll('[data-query]').forEach(b=>b.onclick=()=>applyQuery(b.dataset.query));
 document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();$('q').focus();}if(e.key==='Escape'&&document.activeElement===$('q')){$('q').value='';render();}});
 window.addEventListener('popstate',applyUrl);
 try{history.replaceState(Object.assign({ak:1},history.state||{}),'',location.href);}catch{}
 popularity.load();popularity.whenReady(600).then(applyUrl);const countOpen=e=>{if(e.type==='auxclick'&&e.button!==1)return;const link=e.target.closest('a[data-count-open]');if(link)popularity.record(link.dataset.countOpen);};document.addEventListener('click',countOpen);document.addEventListener('auxclick',countOpen);}catch(e){$('count').textContent='Biblioteket kunde inte hämtas';$('results').innerHTML='<div class="empty"><h3>Kunde inte ladda riktlinjerna</h3><p>Kontrollera anslutningen och försök igen.</p><button id="retry">Försök igen</button></div>';$('retry').onclick=()=>location.reload();}})();
if('serviceWorker' in navigator)navigator.serviceWorker.register('../sw.js').catch(()=>{});

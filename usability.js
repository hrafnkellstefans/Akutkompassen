/* Shared presentation controls; document data and clinical text remain unchanged. */
(()=>{
 const panel=document.querySelector('.search-panel'),areas=document.getElementById('areas');
 const toggle=document.createElement('button');toggle.className='area-menu-toggle';toggle.type='button';toggle.setAttribute('aria-controls','areas');toggle.setAttribute('aria-expanded','false');
 areas.before(toggle);
 toggle.onclick=()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));areas.classList.toggle('expanded',open);};
 areas.addEventListener('click',()=>{toggle.setAttribute('aria-expanded','false');areas.classList.remove('expanded');if(getComputedStyle(toggle).display!=='none')toggle.focus({preventScroll:true});});
 const sentinel=document.createElement('div');sentinel.className='search-sentinel';panel.before(sentinel);
 new IntersectionObserver(([entry])=>panel.classList.toggle('is-stuck',!entry.isIntersecting),{threshold:0}).observe(sentinel);
 const q=document.getElementById('q');let clear=document.getElementById('clr');
 if(!clear){clear=document.createElement('button');clear.className='app-search-clear';clear.type='button';clear.setAttribute('aria-label','Rensa sökning');clear.textContent='×';q.after(clear);clear.onclick=()=>{q.value='';q.dispatchEvent(new Event('input',{bubbles:true}));q.focus();};}
 q.addEventListener('input',()=>q.closest('.searchbox').classList.toggle('has',!!q.value));
 function sync(){
  const chosen=areas.querySelector('.on,.active');const label=(chosen?chosen.querySelector('span:not(.area-dot)').textContent:'Alla områden')+' ▾';if(toggle.textContent!==label)toggle.textContent=label;
  const results=document.getElementById('main')||document.getElementById('results');
  const empty=results.querySelector('.empty');const status=document.getElementById('popularity-status');status.hidden=!!empty||!!q.value.trim();
  if(empty&&!empty.querySelector('button')){const reset=document.createElement('button');reset.textContent='Visa hela biblioteket';reset.onclick=()=>document.getElementById('reset').click();empty.appendChild(reset);}
  if(q.value==='')q.closest('.searchbox').classList.remove('has');
 }
 let frame;new MutationObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(sync);}).observe(document.querySelector('.workspace'),{childList:true,subtree:true});sync();
 const body=document.getElementById('pbody');
 if(body){
  const measured=new WeakSet();const resize=new ResizeObserver(entries=>{for(const {target} of entries){const overflow=target.scrollWidth>target.clientWidth+2;target.previousElementSibling.hidden=!overflow;target.classList.toggle('overflows',overflow);}});
  new MutationObserver(()=>body.querySelectorAll('.table-scroll').forEach(el=>{if(!measured.has(el)){measured.add(el);resize.observe(el);}})).observe(body,{childList:true,subtree:true});
 }
})();

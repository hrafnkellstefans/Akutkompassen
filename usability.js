/* Shared presentation controls; document data and clinical text remain unchanged. */
(()=>{
 const areas=document.getElementById('areas');
 const toggle=document.createElement('button');toggle.className='area-menu-toggle';toggle.type='button';toggle.setAttribute('aria-controls','areas');toggle.setAttribute('aria-expanded','false');
 areas.before(toggle);
 toggle.onclick=()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));areas.classList.toggle('expanded',open);};
 areas.addEventListener('click',()=>{toggle.setAttribute('aria-expanded','false');areas.classList.remove('expanded');if(getComputedStyle(toggle).display!=='none')toggle.focus({preventScroll:true});});
 // CSS sticky positioning keeps the search panel in place without resizing the page.
 const q=document.getElementById('q');let clear=document.getElementById('clr');
 if(!clear){clear=document.createElement('button');clear.className='app-search-clear';clear.type='button';clear.setAttribute('aria-label','Rensa sökning');clear.textContent='×';q.after(clear);clear.onclick=()=>{q.value='';q.dispatchEvent(new Event('input',{bubbles:true}));q.focus();};}
 q.addEventListener('input',()=>q.closest('.searchbox').classList.toggle('has',!!q.value));
 function sync(){
  const chosen=areas.querySelector('.on,.active');const label=(chosen?chosen.querySelector('span:not(.area-dot)').textContent:'Alla områden')+' ▾';if(toggle.textContent!==label)toggle.textContent=label;
  const results=document.getElementById('main')||document.getElementById('results');
  const empty=results.querySelector('.empty');const status=document.getElementById('popularity-status');status.hidden=!!empty||!!q.value.trim()||!status.textContent.trim();
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

/* One-time tip on phones: save the site as an app (iPhone: Dela → Lägg till på hemskärmen; Android: install prompt). */
(()=>{
 let done=false;try{done=localStorage.getItem('ak.install')==='done';}catch{done=true;}
 if(done||matchMedia('(display-mode: standalone)').matches||navigator.standalone||!matchMedia('(max-width:760px)').matches)return;
 const head=document.querySelector('.results-head');if(!head)return;
 const box=document.createElement('div');box.className='install-hint';
 const close=()=>{box.remove();try{localStorage.setItem('ak.install','done');}catch{}};
 const show=html=>{box.innerHTML=html+'<button type="button" class="install-x" aria-label="Stäng tipset">×</button>';box.querySelector('.install-x').onclick=close;if(!box.isConnected)head.after(box);};
 const ua=navigator.userAgent;
 if(/iPhone|iPod/.test(ua)&&/Safari/.test(ua)&&!/CriOS|FxiOS|EdgiOS/.test(ua))show('<span>Spara som app: tryck på <b>Dela</b> och välj <b>Lägg till på hemskärmen</b>.</span>');
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();show('<span>Spara Akutkompassen som app på telefonen.</span><button type="button" class="install-go">Installera</button>');box.querySelector('.install-go').onclick=async()=>{e.prompt();try{await e.userChoice;}catch{}close();};});
})();
/* Feedback link, shown once an address is set in popularity-config.js (AK_FEEDBACK_URL). */
(()=>{
 const url=String(window.AK_FEEDBACK_URL||'');if(!/^(https:|mailto:)/.test(url))return;
 const footer=document.querySelector('footer');if(!footer)return;
 const p=document.createElement('p');p.className='feedback';const a=document.createElement('a');a.href=url;a.textContent='Saknas något? Tipsa om PM eller riktlinjer';if(url.startsWith('https:')){a.target='_blank';a.rel='noopener';}
 p.appendChild(a);footer.prepend(p);
})();

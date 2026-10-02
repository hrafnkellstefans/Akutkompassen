const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const code=html.slice(html.indexOf('let pendingRefresh='),html.indexOf('async function prefetchAll'));
function harness(y){
 let refreshes=0,timer;const elements=new Map(),listeners=[];
 const window={scrollY:y,scrollTo(){this.scrollY=0;},addEventListener(type,fn){listeners.push({type,fn});}};
 const context=vm.createContext({window,state:{q:'sepsis'},prefetchDone:false,
  $:id=>elements.get(id),
  document:{createElement:()=>({remove(){elements.delete(this.id);}}),body:{appendChild(el){elements.set(el.id,el);}}},
  setTimeout(fn){timer=fn;return 1;},update(){refreshes++;}});
 vm.runInContext(code,context);
 return {window,elements,listeners,refresh:()=>context.refreshSearchSoon(),flush:()=>{if(timer)timer();},count:()=>refreshes};
}
test('Background search results wait for explicit refresh at any nonzero scroll position',()=>{
 for(const y of [1,90,159,160,161,500]){
  const h=harness(y);h.refresh();h.flush();assert.equal(h.count(),0);
  assert.ok(h.elements.has('refresh-pill'));
  h.window.scrollY=0;for(const l of h.listeners.filter(l=>l.type==='scroll'))l.fn();
  assert.equal(h.count(),0,'scrolling back must not rebuild results');
  h.elements.get('refresh-pill').onclick();assert.equal(h.count(),1);
 }
});
test('A delayed refresh rechecks whether the user started scrolling',()=>{
 const top=harness(0);top.refresh();top.flush();assert.equal(top.count(),1);
 const moving=harness(0);moving.refresh();moving.window.scrollY=25;moving.flush();
 assert.equal(moving.count(),0);assert.ok(moving.elements.has('refresh-pill'));
});

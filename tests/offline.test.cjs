const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const data=JSON.parse(fs.readFileSync(path.join(root,'ak_index.json'),'utf8'));
const scope='https://example.org/Akutkompassen/';
function worker({offline=false,failInstall=false}={}){
 const handlers={},deleted=[],network=[],puts=[],precached=[];
 const cache=new Map();let claimed=false;
 const context={URL,Request:class{constructor(url,options){this.url=new URL(url,scope).href;Object.assign(this,options);}},
  self:{registration:{scope},location:{origin:'https://example.org'},clients:{claim:async()=>{claimed=true;}},addEventListener:(type,f)=>handlers[type]=f},
  caches:{open:async()=>({addAll:async requests=>{
   if(failInstall)throw Error('offline during install');
   for(const request of requests){precached.push(request);cache.set(request.url,{ok:true,url:request.url});}
  },match:async url=>cache.get(url),put:(...args)=>puts.push(args)}),keys:async()=>['ak-v10s2c',data.v,'other-app-cache'],delete:async key=>deleted.push(key)},
  fetch:async request=>{network.push(request);if(offline)throw Error('offline');return {ok:false,status:404};}
 };
 vm.runInNewContext(source,context);
 return {cache,deleted,network,puts,precached,async install(){let work;handlers.install({waitUntil:p=>work=p});await work;},async activate(){let work;handlers.activate({waitUntil:p=>work=p});await work;},async get(file){let work;handlers.fetch({request:{method:'GET',url:new URL(file,scope).href},respondWith:p=>work=p});return work?await work:undefined;},claimed:()=>claimed};
}
test('complete install precaches every shard and serves versioned JSON offline',async()=>{
 const w=worker({offline:true});await w.install();
 for(const file of Object.values(data.shards))assert.equal((await w.get(file+'?v='+data.v)).url,scope+file);
 assert.equal((await w.get('ak_index.json?v='+data.v)).url,scope+'ak_index.json');
 assert.equal((await w.get('./')).url,scope);assert.equal(w.network.length,0);
 for(const request of w.precached)assert.equal(request.cache,'reload');
});
test('activation only deletes this app’s older caches',async()=>{
 const w=worker();await w.activate();assert.deepEqual(w.deleted,['ak-v10s2c']);assert.equal(w.claimed(),true);
});
test('other versions and unrelated resources are not intercepted',async()=>{
 const w=worker();await w.install();
 assert.equal(await w.get('ak_index.json?v=another-release'),undefined);
 assert.equal(await w.get('/other-app/index.html'),undefined);
 assert.equal(await w.get('https://publisher.example/document.pdf'),undefined);
 assert.equal(await w.get('missing.json'),undefined);
});
test('missing assets never fall back to HTML or cache error responses',async()=>{
 const w=worker();await w.install();w.cache.delete(scope+'ak_TRA.json');
 const result=await w.get('ak_TRA.json?v='+data.v);assert.equal(result.status,404);assert.equal(w.puts.length,0);
 const offline=worker({offline:true});await offline.install();offline.cache.delete(scope+'ak_TRA.json');
 await assert.rejects(offline.get('ak_TRA.json?v='+data.v),/offline/);
});
test('failed complete-release install rejects without activating or deleting older caches',async()=>{
 const w=worker({failInstall:true});await assert.rejects(w.install(),/offline during install/);
 assert.equal(w.claimed(),false);assert.deepEqual(w.deleted,[]);
});

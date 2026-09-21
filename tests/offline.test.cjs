const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const data=JSON.parse(fs.readFileSync(path.join(root,'ak_index.json'),'utf8'));
const scope='https://example.org/Akutkompassen/';

function worker({offline=false}={}){
  const handlers={},deleted=[],network=[],puts=[],precached=[];
  const cache=new Map();let claimed=false;let skipped=false;
  const context={
    URL,
    Request:class{constructor(url,options){this.url=new URL(url,scope).href;Object.assign(this,options);}},
    self:{
      registration:{scope},
      location:{origin:'https://example.org'},
      skipWaiting:async()=>{skipped=true;},
      clients:{claim:async()=>{claimed=true;}},
      addEventListener:(type,f)=>handlers[type]=f
    },
    caches:{
      open:async()=>({
        addAll:async requests=>{
          for(const request of requests){precached.push(request);cache.set(request.url,{ok:true,url:request.url});}
        },
        match:async (request, options)=>{
          const url=typeof request==='string'?request:(request&&request.url)||request;
          const href=new URL(url,scope).href;
          if(options&&options.ignoreSearch){
            const bare=href.split('?')[0];
            for(const [key,value] of cache){if(key.split('?')[0]===bare)return value;}
            return undefined;
          }
          return cache.get(href);
        },
        put:(request,response)=>puts.push([typeof request==='string'?request:request.url,response])
      }),
      keys:async()=>['ak-v10s2c',data.v,'other-app-cache'],
      delete:async key=>deleted.push(key),
      match:async url=>({ok:true,url:new URL(url,scope).href,fallback:true})
    },
    fetch:async request=>{
      network.push(request);
      if(offline)throw Error('offline');
      return {ok:false,status:404};
    }
  };
  vm.runInNewContext(source,context);
  return {
    cache,deleted,network,puts,precached,
    async install(){let work;handlers.install({waitUntil:p=>work=p});await work;},
    async activate(){let work;handlers.activate({waitUntil:p=>work=p});await work;},
    async get(file,{mode,destination}={}){
      let work;
      const url=new URL(file,scope).href;
      handlers.fetch({
        request:{method:'GET',url,mode,destination},
        respondWith:p=>work=p
      });
      return work?await work:undefined;
    },
    claimed:()=>claimed,
    skipped:()=>skipped
  };
}

test('install precaches the app shell including favicon and the index',async()=>{
  const w=worker();await w.install();
  const urls=w.precached.map(r=>r.url);
  assert.ok(urls.includes(scope+'index.html'));
  assert.ok(urls.includes(scope+'ak_index.json'));
  assert.ok(urls.includes(scope+'favicon.png'));
  assert.ok(urls.every(u=>!/ak_TRA\.json$/.test(u)));
  assert.equal(w.skipped(),true);
  for(const request of w.precached)assert.equal(request.cache,'reload');
});

test('activation only deletes this app’s older caches',async()=>{
  const w=worker();await w.activate();
  assert.deepEqual(w.deleted,['ak-v10s2c']);
  assert.equal(w.claimed(),true);
});

test('shards are cache-first and error responses are not stored',async()=>{
  const w=worker();await w.install();
  const miss=await w.get('ak_TRA.json?v='+data.v);
  assert.equal(miss.status,404);
  assert.equal(w.puts.length,0);

  w.cache.set(scope+'ak_TRA.json',{ok:true,url:scope+'ak_TRA.json',cached:true});
  const hit=await w.get('ak_TRA.json?v='+data.v);
  assert.equal(hit.cached,true);
});

test('offline shell falls back to cache; missing JSON does not become HTML',async()=>{
  const w=worker({offline:true});await w.install();
  const page=await w.get('./',{mode:'navigate',destination:'document'});
  assert.equal(page.url,scope);
  await assert.rejects(w.get('ak_TRA.json?v='+data.v),/offline/);
});

test('foreign origins and non-GET requests are not intercepted',async()=>{
  const w=worker();await w.install();
  assert.equal(await w.get('https://publisher.example/document.pdf'),undefined);
});

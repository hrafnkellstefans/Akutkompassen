import documentIds from './documents.json' with {type:'json'};
const allowed=new Set(documentIds);
const origins=new Set(['https://akutkompassen.se','https://www.akutkompassen.se']);
export default {
 async fetch(request,env){
  const origin=request.headers.get('Origin'),url=new URL(request.url);
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
  if(origin&&!origins.has(origin))return new Response('{}',{status:403,headers});
  if(origin)headers['Access-Control-Allow-Origin']=origin;
  const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'86400'}});
  try{
   if(request.method==='GET'&&url.pathname==='/counts'){
    const {results}=await env.DB.prepare('SELECT document_id, opens FROM counts').all();
    return reply({counts:Object.fromEntries(results.filter(r=>allowed.has(r.document_id)).map(r=>[r.document_id,r.opens]))});
   }
   if(request.method!=='POST'||url.pathname!=='/click')return reply({},404);
   if(!origin)return reply({},403);
   if(Number(request.headers.get('Content-Length')||0)>1024)return reply({},413);
   if(!request.headers.get('Content-Type')?.startsWith('application/json'))return reply({},415);
   const limited=await env.CLICK_LIMITER.limit({key:request.headers.get('CF-Connecting-IP')||'unknown'});
   if(!limited.success)return reply({},429);
   const text=await request.text();if(text.length>1024)return reply({},413);
   let payload;try{payload=JSON.parse(text);}catch{return reply({},400);}
   if(!payload||!allowed.has(payload.document)||typeof payload.event!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.event)||Object.keys(payload).some(k=>!['document','event'].includes(k)))return reply({},400);
   await env.DB.prepare('INSERT INTO events (event_id, document_id, created_at) VALUES (?, ?, ?) ON CONFLICT(event_id) DO NOTHING').bind(payload.event,payload.document,Math.floor(Date.now()/1000)).run();
   return reply({ok:true});
  }catch{return reply({error:'Unavailable'},503);}
 },
 async scheduled(event,env){await env.DB.prepare('DELETE FROM events WHERE created_at < ?').bind(Math.floor(Date.now()/1000)-86400).run();}
};

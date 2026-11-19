import {createServer} from 'node:http';
import {once} from 'node:events';
export function createHttpServer(app,{origin,trustProxy=false}){
 const server=createServer(async(req,res)=>{
  const controller=new AbortController();res.on('close',()=>controller.abort());
  try{
   const max=22*1024*1024;let total=0;const chunks=[];
   for await(const chunk of req){total+=chunk.length;if(total>max){res.writeHead(413,{'content-type':'application/json'});res.end('{"error":"La solicitud supera 22 MB."}');return}chunks.push(chunk)}
   const headers=new Headers();for(const [name,value]of Object.entries(req.headers))if(value!==undefined)headers.set(name,Array.isArray(value)?value.join(', '):value);
   const request=new Request(new URL(req.url,origin),{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks),signal:controller.signal});
   const ip=trustProxy?String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',')[0].trim():req.socket.remoteAddress;
   const result=await app.fetch(request,{ip});
   res.statusCode=result.status;for(const [key,value]of result.headers)res.setHeader(key,value);
   res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','SAMEORIGIN');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
   if(req.method==='HEAD'){res.end();return}
   if(result.body){const reader=result.body.getReader();try{while(!controller.signal.aborted){const {value,done}=await reader.read();if(done)break;if(!res.write(Buffer.from(value)))await once(res,'drain',{signal:controller.signal})}}finally{await reader.cancel().catch(()=>{})}}
   res.end();
  }catch(error){if(controller.signal.aborted)return;if(!res.headersSent){res.writeHead(500,{'content-type':'application/json'});res.end('{"error":"No se pudo completar la solicitud."}')}else res.destroy()}
 });
 server.requestTimeout=60000;server.headersTimeout=15000;return server;
}

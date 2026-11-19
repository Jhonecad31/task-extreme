import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createApplication} from '../vps/application.mjs';
import {createHttpServer} from '../vps/http-server.mjs';
import {hashPassword} from '../vps/passwords.mjs';
const directory=mkdtempSync(join(tmpdir(),'task-http-')),config={origin:'http://localhost:3000',production:false,adminEmail:'root@example.test',dbPath:join(directory,'app.sqlite')},app=await createApplication(config),password='Clave-verificacion-HTTP-123';
app.DB.sql.prepare('INSERT INTO vps_credentials VALUES (?,?,0,?)').run('user-0',await hashPassword(password),Date.now());
const server=createHttpServer(app,{origin:config.origin});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;let cookie='';
async function call(path,method='GET',body){const headers={origin:config.origin};if(cookie)headers.cookie=cookie;if(body&&!(body instanceof FormData))headers['content-type']='application/json';const r=await fetch(base+path,{method,headers,body:body?body instanceof FormData?body:JSON.stringify(body):undefined});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return r}
const abort=new AbortController();
try{
 let r=await call('/api/auth/login','POST',{email:config.adminEmail,password});assert.equal(r.status,200);let current=await (await call('/api/state')).json();const state=current.state;
 state.companies.push({id:'company',name:'Empresa de prueba',createdBy:'user-0'});state.workspaces.push({id:'workspace',name:'Operaciones',companyId:'company',projects:['Proyecto'],projectCreators:{Proyecto:'user-0'},createdBy:'user-0'});state.tasks.push({id:10,title:'Actividad HTTP',workspaceId:'workspace',project:'Proyecto',createdBy:'user-0',assigneeIds:['user-0'],owner:'Administrador principal',parentId:null,status:'Pendiente',priority:'Media',start:'2027-01-01',end:'2027-01-02',notes:[]});r=await call('/api/state','POST',current);assert.equal(r.status,200);current=await r.json();
 const form=new FormData();form.set('taskId','10');form.set('file',new File(['Contenido persistente'],'documento.txt',{type:'text/plain'}));r=await call('/api/files','POST',form);assert.equal(r.status,201);const file=await r.json();r=await call('/api/updates','POST',{taskId:10,text:'Comentario HTTP',files:[file]});assert.equal(r.status,201);r=await call('/api/files/'+file.id);assert.equal(r.status,200);assert.equal(await r.text(),'Contenido persistente');
 const stream=await fetch(base+'/api/live',{headers:{cookie},signal:abort.signal});assert.equal(stream.status,200);assert(stream.headers.get('content-type').includes('text/event-stream'));const reader=stream.body.getReader(),decoder=new TextDecoder();assert(decoder.decode((await reader.read()).value).includes('event: changed'));
 current.state.tasks[0].status='Completada';r=await call('/api/state','POST',current);assert.equal(r.status,200);const revision=(await r.json()).revision;let changed=false;for(let i=0;i<3;i++){const text=decoder.decode((await reader.read()).value);if(text.includes('"revision":'+revision)){changed=true;break}}assert(changed);abort.abort();await reader.cancel().catch(()=>{});
 r=await call('/api/auth/logout','POST');assert.equal(r.status,200);assert.equal((await call('/api/files/'+file.id)).status,401);
 await new Promise(resolve=>server.close(resolve));
 const secure=await createApplication({...config,origin:'https://task.example.test',production:true});try{const login=await secure.fetch(new Request('https://task.example.test/api/auth/login',{method:'POST',headers:{origin:'https://task.example.test','content-type':'application/json'},body:JSON.stringify({email:config.adminEmail,password})}));assert.equal(login.status,200);assert(login.headers.get('set-cookie').startsWith('__Host-task_extreme='));assert(login.headers.get('set-cookie').includes('; Secure'))}finally{secure.close()}
 console.log('PASS: real HTTP email login, multipart attachment persistence/download, comment posting, SSE state-change notification, file protection after logout, and Secure production cookies.');
}finally{abort.abort();if(server.listening)await new Promise(resolve=>server.close(resolve));app.close();rmSync(directory,{recursive:true,force:true})}

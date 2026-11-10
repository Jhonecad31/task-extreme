import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApplication} from '../vps/application.mjs';
import {hashPassword} from '../vps/passwords.mjs';
import {createHttpServer} from '../vps/http-server.mjs';
import {loadState,auditRecord} from '../dist/server/index.js';
const directory=mkdtempSync(join(tmpdir(),'task-vps-')),config={origin:'http://localhost:3000',adminEmail:'admin@example.test',dbPath:join(directory,'app.sqlite'),production:false},password='Inicial-de-prueba-123';
let app=await createApplication(config);let cookie='';
async function call(path,method='GET',body,extra={}){const headers={origin:config.origin,...extra};if(cookie)headers.cookie=cookie;if(body!==undefined&&!(body instanceof FormData))headers['content-type']='application/json';const r=await app.fetch(new Request(config.origin+path,{method,headers,body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body)}),{ip:'test'});const set=r.headers.get('set-cookie');if(set)cookie=set.split(';')[0];return {status:r.status,headers:r.headers,body:r.headers.get('content-type')?.includes('application/json')?await r.json():await r.text()}}
try{
 assert.equal((await call('/api/state')).status,401);
 assert.equal((await call('/api/state','GET',undefined,{'oai-authenticated-user-id':'root','oai-authenticated-user-email':'admin@example.test'})).status,401);
 assert.equal((await call('/api/auth/register','POST',{email:'hack@example.test',password})).status,401);
 assert.equal((await call('/api/auth/login','POST',{email:config.adminEmail,password})).status,401);
 const admin=(await loadState(app.env)).data.users[0];
 await app.DB.batch([app.DB.prepare('INSERT INTO vps_credentials VALUES (?,?,0,?)').bind(admin.id,await hashPassword(password),Date.now()),...app.auditStatements(auditRecord(admin,'CREAR_ACCESO','Acceso','Administrador inicial',admin.id))]);
 assert.equal((await call('/api/auth/login','POST',{email:config.adminEmail,password},{origin:'https://evil.test'})).status,403);
 const login=await call('/api/auth/login','POST',{email:'ADMIN@example.test',password});assert.equal(login.status,200);assert(login.headers.get('set-cookie').includes('HttpOnly'));assert(login.headers.get('set-cookie').includes('SameSite=Lax'));const adminCookie=cookie;
 let current=(await call('/api/state')).body;assert.equal(current.state.users.length,1);assert.equal(current.state.tasks.length,0);assert.equal(current.state.companies.length,0);
 current.state.users.push({id:'agent',name:'Agente Nuevo',email:'agente@example.test',role:'agent',createdBy:admin.id,grants:{},agentAssignments:[]});current.state.users.push({id:'manager',name:'Gerente Nuevo',email:'gerente@example.test',role:'manager',createdBy:admin.id,grants:{},agentAssignments:[]});
 let r=await call('/api/state','POST',current);assert.equal(r.status,200);
 assert.equal((await call('/api/auth/accounts/agent/password','POST',{password:'corta'})).status,400);
 assert.equal((await call('/api/auth/accounts/agent/password','POST',{password})).status,200);
 assert.equal((await call('/api/auth/accounts/manager/password','POST',{password})).status,200);
 assert(!(await call('/api/auth/accounts')).body.users.some(u=>u.password_hash));
 cookie='';r=await call('/api/auth/login','POST',{email:'agente@example.test',password});assert.equal(r.status,200);assert(r.body.mustChange);assert.equal(r.body.redirect,'/cambiar-contrasena');const temporaryCookie=cookie;
 assert.equal((await call('/api/state')).status,428);assert.equal((await call('/espacios')).headers.get('location'),config.origin+'/cambiar-contrasena');
 assert.equal((await call('/api/auth/password','POST',{currentPassword:'incorrecta',newPassword:'Otra-clave-segura-123'})).status,401);
 assert.equal((await call('/api/auth/password','POST',{currentPassword:password,newPassword:'Otra-clave-segura-123'})).status,200);
 const agentCookie=cookie;assert.equal((await call('/api/state')).status,200);assert.equal((await call('/api/auth/accounts')).status,403);assert.equal((await call('/api/auth/accounts/manager/password','POST',{password})).status,403);
 current=(await call('/api/state')).body;current.state.users.push({id:'intruso',name:'Intruso',role:'agent',grants:{},email:'intruso@example.test'});assert.equal((await call('/api/state','POST',current)).status,403);
 cookie=temporaryCookie;assert.equal((await call('/api/state')).status,401);
 cookie=adminCookie;await call('/api/auth/accounts/agent/password','POST',{password});cookie=agentCookie;assert.equal((await call('/api/state')).status,401);
 cookie='';await call('/api/auth/login','POST',{email:'gerente@example.test',password});await call('/api/auth/password','POST',{currentPassword:password,newPassword:'Gerente-nueva-clave-123'});assert.equal((await call('/api/auth/accounts')).status,403);assert.equal((await call('/api/auth/accounts/agent/password','POST',{password})).status,403);
 // Email changes in profiles become login identifiers while credentials remain tied to user IDs.
 cookie=adminCookie;current=(await call('/api/state')).body;current.state.users.find(u=>u.id==='agent').email='nuevo@example.test';assert.equal((await call('/api/state','POST',current)).status,200);
 cookie='';assert.equal((await call('/api/auth/login','POST',{email:'agente@example.test',password})).status,401);assert.equal((await call('/api/auth/login','POST',{email:'nuevo@example.test',password})).status,200);
 await call('/api/auth/password','POST',{currentPassword:password,newPassword:'Agente-segundo-cambio-123'});const activeAgentCookie=cookie;
 cookie=adminCookie;current=(await call('/api/state')).body;const user=current.state.users.find(u=>u.id==='agent');current.state.users=current.state.users.filter(u=>u.id!==user.id);current.state.trash.push({id:'trash-agent',type:'user',label:user.name,deletedBy:admin.id,deletedByName:admin.name,deletedAt:new Date().toISOString(),payload:{users:[user]}});assert.equal((await call('/api/state','POST',current)).status,200);cookie=activeAgentCookie;assert.equal((await call('/api/state')).status,401);assert(!app.DB.sql.prepare('SELECT user_id FROM vps_credentials WHERE user_id=?').get('agent'));
 cookie=adminCookie;const audit=(await call('/api/audit')).body.entries;assert(audit.some(e=>e.action==='RESTABLECER_ACCESO'));assert(audit.some(e=>e.action==='CAMBIAR_CONTRASENA'));assert(!JSON.stringify(audit).includes('scrypt$'));assert(!JSON.stringify(audit).includes(password));
 const logins=app.DB.sql.prepare("SELECT COUNT(*) n FROM taskextreme_audit WHERE action='INICIAR_SESION'").get().n;assert(logins>=4);
 const sessionRows=app.DB.sql.prepare('SELECT token_hash FROM vps_sessions').all();assert(sessionRows.every(row=>row.token_hash!==cookie.split('=')[1]));
 app.close();app=await createApplication(config);assert.equal((await call('/api/state')).status,200);assert.equal((await call('/api/auth/logout','POST')).status,200);assert.equal((await call('/api/state')).status,401);
 cookie='';for(let i=0;i<8;i++)assert.equal((await call('/api/auth/login','POST',{email:'nadie@example.test',password})).status,401);assert.equal((await call('/api/auth/login','POST',{email:'nadie@example.test',password})).status,429);
 // Real HTTP adapter, not only in-process calls.
 const server=createHttpServer(app,{origin:config.origin});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 try{const health=await fetch(base+'/healthz');assert.equal(health.status,200);const page=await fetch(base+'/login');assert.equal(page.status,200);const html=await page.text();assert(html.includes('name="email"'));assert(html.includes('name="password"'));assert(!html.includes('signin-with-chatgpt'));assert.equal((await fetch(base+'/api/state',{headers:{'oai-authenticated-user-id':'vps:user-0','oai-authenticated-user-email':config.adminEmail}})).status,401);assert.equal((await fetch(base+'/theme.js')).status,200)}finally{await new Promise(resolve=>server.close(resolve))}
 assert.throws(()=>app.DB.sql.exec('DELETE FROM taskextreme_audit'),/no puede eliminarse/);
 console.log('PASS: manual email/password, no public registration, principal-only account provisioning, forced initial password change, role restrictions, hashed credentials/sessions, CSRF, rate limits, logout/reset/deletion revocation, profile email changes, persistent DB, immutable audit without secrets, and real HTTP serving.');
}finally{app.close();rmSync(directory,{recursive:true,force:true})}

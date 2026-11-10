import {createHash,randomBytes} from 'node:crypto';
import {openDatabase} from './database.mjs';
import {hashPassword as rawHashPassword,verifyPassword as rawVerifyPassword,validPassword} from './passwords.mjs';
import core,{loadState,appendAudit,auditRecord} from '../dist/server/index.js';
const digest=value=>createHash('sha256').update(value).digest('hex');
const response=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
const error=(status,message)=>Object.assign(Error(message),{status});
const emailKey=value=>String(value||'').trim().toLowerCase();
export async function createApplication(config){
 const origin=new URL(config.origin).origin,production=config.production??true;
 if(production&&!origin.startsWith('https://'))throw Error('APP_ORIGIN debe usar HTTPS en producción.');
 if(!config.adminEmail||!/^\S+@\S+\.\S+$/.test(config.adminEmail))throw Error('Configura INITIAL_ADMIN_EMAIL con un correo válido.');
 const DB=openDatabase(config.dbPath),sql=DB.sql,env={DB,INITIAL_ADMIN_EMAIL:emailKey(config.adminEmail)},context={waitUntil(promise){promise.catch(()=>{})}};
 try{await loadState(env)}catch(e){DB.close();throw e}
 const sessionHours=Number(config.sessionHours||12);if(!Number.isFinite(sessionHours)||sessionHours<1||sessionHours>168){DB.close();throw Error('SESSION_HOURS debe estar entre 1 y 168.');}
 let passwordJobs=0;async function passwordWork(action){if(passwordJobs>=4)throw error(429,'El servicio está ocupado. Reintenta en unos segundos.');passwordJobs++;try{return await action()}finally{passwordJobs--}}
 const hashPassword=value=>passwordWork(()=>rawHashPassword(value)),verifyPassword=(value,hash)=>passwordWork(()=>rawVerifyPassword(value,hash));
 const cookieName=production?'__Host-task_extreme':'task_extreme',dummyHash=await hashPassword(randomBytes(24).toString('hex'));
 const cookie=(token,seconds)=>`${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${production?'; Secure':''}`;
 const audit=(actor,action,concept,entity=actor?.id||'auth')=>auditRecord(actor,action,'Acceso',concept,entity);
 function sessionFrom(request,state){
  const raw=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  if(!raw||!/^[a-f0-9]{64}$/.test(raw))return null;
  const row=sql.prepare('SELECT s.*,c.must_change FROM vps_sessions s JOIN vps_credentials c ON s.user_id=c.user_id WHERE s.token_hash=? AND s.expires_at>?').get(digest(raw),Date.now());
  const user=row&&state.users.find(u=>u.id===row.user_id);return user?{...row,user}:null;
 }
 function newSessionStatement(userId){const token=randomBytes(32).toString('hex'),seconds=sessionHours*3600;return {token,seconds,statement:DB.prepare('INSERT INTO vps_sessions(token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)').bind(digest(token),userId,Date.now()+seconds*1000,Date.now())}}
 function checkOrigin(request){if(request.headers.get('origin')!==origin)throw error(403,'Origen de solicitud no válido.');}
 async function bodyJson(request){if(!request.headers.get('content-type')?.startsWith('application/json'))throw error(415,'Envía los datos como JSON.');try{const text=await request.text();if(text.length>4096)throw error(413,'Solicitud demasiado grande.');return JSON.parse(text)}catch(e){if(e.status)throw e;throw error(400,'Solicitud no válida.')}}
 function limits(ip,email){return ['ip:'+digest(ip),'account:'+digest(email)]}
 function blocked(keys){return keys.some((key,index)=>{const r=sql.prepare('SELECT * FROM vps_login_limits WHERE key=?').get(key);return r&&r.reset_at>Date.now()&&r.failures>=(index===0?30:8)})}
 function failureStatements(keys){const now=Date.now();return keys.map(key=>DB.prepare('INSERT INTO vps_login_limits(key,failures,reset_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET failures=CASE WHEN reset_at<=? THEN 1 ELSE failures+1 END,reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END').bind(key,now+15*60000,now,now))}
 async function login(request,ip,state){
  const input=await bodyJson(request),email=emailKey(input.email),password=input.password,keys=limits(ip,email);
  if(blocked(keys))throw error(429,'Demasiados intentos. Espera 15 minutos antes de reintentar.');
  const user=state.users.find(u=>email&&emailKey(u.email)===email),credential=user&&sql.prepare('SELECT * FROM vps_credentials WHERE user_id=?').get(user.id);
  // Unknown accounts perform the same password work; never reveal account existence.
  const valid=await verifyPassword(password,credential?.password_hash||dummyHash);
  if(!credential||!valid){await DB.batch([...failureStatements(keys),...authAuditStatements(audit(null,'ACCESO_DENEGADO','Intento de inicio de sesión rechazado'))]);throw error(401,'Correo o contraseña incorrectos.');}
  // A reset or deletion while scrypt was running must invalidate the attempt.
  const latest=(await loadState(env)).data,current=latest.users.find(u=>u.id===user.id),fresh=sql.prepare('SELECT * FROM vps_credentials WHERE user_id=?').get(user.id);
  if(!current||emailKey(current.email)!==email||fresh?.password_hash!==credential.password_hash)throw error(401,'Correo o contraseña incorrectos.');
  const session=newSessionStatement(user.id);
  await DB.batch([DB.prepare('DELETE FROM vps_sessions WHERE expires_at<=?').bind(Date.now()),DB.prepare('DELETE FROM vps_login_limits WHERE key=?').bind(keys[1]),session.statement,...authAuditStatements(audit(current,'INICIAR_SESION','Inicio de sesión por correo y contraseña'))]);
  return response({ok:true,mustChange:!!fresh.must_change,redirect:fresh.must_change?'/cambiar-contrasena':'/espacios'},200,{'set-cookie':cookie(session.token,session.seconds)});
 }
 // Audits and credential/session changes commit together through the same SQLite transaction.
 function authAuditStatements(entry){return [DB.prepare(`INSERT INTO taskextreme_audit(request_id,actor_id,actor_name,actor_role,action,section,concept,entity_id,company_id,company_name,workspace_id,workspace_name,occurred_at,changes,search_text) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(entry.requestId,entry.actorId,entry.actorName,entry.actorRole,entry.action,entry.section,entry.concept,entry.entityId,entry.companyId,entry.companyName,entry.workspaceId,entry.workspaceName,entry.occurredAt,JSON.stringify([]),entry.searchText)]}
 async function handle(request,{ip='unknown'}={}){
  const url=new URL(request.url),path=url.pathname,method=request.method;
  try{
   if(path==='/healthz')return response({ok:true});
   if(!['GET','HEAD'].includes(method))checkOrigin(request);
   const current=await loadState(env),session=sessionFrom(request,current.data),actor=session?.user;
   if(path==='/api/auth/login'&&method==='POST')return await login(request,ip,current.data);
   if(path==='/api/auth/logout'&&method==='POST'){
    if(session)await DB.batch([DB.prepare('DELETE FROM vps_sessions WHERE token_hash=?').bind(session.token_hash),...authAuditStatements(audit(actor,'CERRAR_SESION','Cierre de sesión'))]);
    return response({ok:true},200,{'set-cookie':cookie('',0)});
   }
   if(path==='/api/auth/me'&&method==='GET'){if(!session)throw error(401,'Inicia sesión para continuar.');return response({user:{id:actor.id,name:actor.name,email:actor.email,role:actor.role},mustChange:!!session.must_change})}
   if(path==='/api/auth/password'&&method==='POST'){
    if(!session)throw error(401,'Inicia sesión para continuar.');
    const input=await bodyJson(request),stored=sql.prepare('SELECT * FROM vps_credentials WHERE user_id=?').get(actor.id),keys=limits(ip,'password:'+actor.id);
    if(blocked(keys))throw error(429,'Demasiados intentos. Espera 15 minutos.');
    if(!await verifyPassword(input.currentPassword,stored.password_hash)){await DB.batch([...failureStatements(keys),...authAuditStatements(audit(actor,'ACCESO_DENEGADO','Cambio de contraseña rechazado'))]);throw error(401,'La contraseña actual es incorrecta.');}
    if(!validPassword(input.newPassword))throw error(400,'La contraseña debe tener de 12 a 128 caracteres.');
    if(input.newPassword===input.currentPassword)throw error(400,'Elige una contraseña diferente.');
    const nextHash=await hashPassword(input.newPassword);
    if(sql.prepare('SELECT password_hash FROM vps_credentials WHERE user_id=?').get(actor.id)?.password_hash!==stored.password_hash||!sessionFrom(request,(await loadState(env)).data))throw error(401,'La sesión cambió. Inicia sesión de nuevo.');
    const nextSession=newSessionStatement(actor.id);
    await DB.batch([DB.prepare('UPDATE vps_credentials SET password_hash=?,must_change=0,updated_at=? WHERE user_id=?').bind(nextHash,Date.now(),actor.id),DB.prepare('DELETE FROM vps_sessions WHERE user_id=?').bind(actor.id),DB.prepare('DELETE FROM vps_login_limits WHERE key=?').bind(keys[1]),nextSession.statement,...authAuditStatements(audit(actor,'CAMBIAR_CONTRASENA','Cambio de contraseña personal'))]);
    return response({ok:true,redirect:'/espacios'},200,{'set-cookie':cookie(nextSession.token,nextSession.seconds)});
   }
   if(path.startsWith('/api/auth/')){
    if(!session)throw error(401,'Inicia sesión para continuar.');
    if(session.must_change)throw error(428,'Cambia tu contraseña para continuar.');
    if(actor.role!=='principal')throw error(403,'Solo el administrador principal puede administrar accesos.');
    if(path==='/api/auth/accounts'&&method==='GET')return response({users:current.data.users.map(u=>({id:u.id,name:u.name,email:u.email||'',role:u.role,enabled:!!sql.prepare('SELECT user_id FROM vps_credentials WHERE user_id=?').get(u.id)}))});
    const match=path.match(/^\/api\/auth\/accounts\/([^/]+)\/password$/);
    if(match&&method==='POST'){
     const id=decodeURIComponent(match[1]),target=current.data.users.find(u=>u.id===id);if(!target)throw error(404,'Usuario no encontrado.');
     if(id===actor.id)throw error(400,'Usa Cambiar mi contraseña para modificar tu propio acceso.');
     if(!/^\S+@\S+\.\S+$/.test(target.email||''))throw error(400,'Registra primero un correo válido en el perfil del usuario.');
     const input=await bodyJson(request);if(!validPassword(input.password))throw error(400,'La contraseña debe tener de 12 a 128 caracteres.');const hash=await hashPassword(input.password);
     const latest=(await loadState(env)).data,principal=latest.users.find(u=>u.id===actor.id),validTarget=latest.users.find(u=>u.id===id);
     if(principal?.role!=='principal'||!validTarget||!sessionFrom(request,latest))throw error(403,'El acceso cambió. Recarga la página.');
     await DB.batch([DB.prepare('INSERT INTO vps_credentials(user_id,password_hash,must_change,updated_at) VALUES (?,?,1,?) ON CONFLICT(user_id) DO UPDATE SET password_hash=excluded.password_hash,must_change=1,updated_at=excluded.updated_at').bind(id,hash,Date.now()),DB.prepare('DELETE FROM vps_sessions WHERE user_id=?').bind(id),...authAuditStatements(audit(actor,'RESTABLECER_ACCESO','Habilitar / restablecer acceso de '+validTarget.name,id))]);
     return response({ok:true,mustChange:true});
    }
    throw error(404,'Ruta no encontrada.');
   }
   if(path.startsWith('/api/')||['/espacios','/espacios/','/index.html','/cambiar-contrasena'].includes(path)){
    if(!session){if(path.startsWith('/api/'))throw error(401,'Inicia sesión con tu correo y contraseña.');return Response.redirect(origin+'/login',302)}
    if(session.must_change&&path!=='/cambiar-contrasena'){if(path.startsWith('/api/'))throw error(428,'Cambia tu contraseña para continuar.');return Response.redirect(origin+'/cambiar-contrasena',302)}
   }
   if(path==='/login'&&session)return Response.redirect(origin+(session.must_change?'/cambiar-contrasena':'/espacios'),302);
   if(path==='/cambiar-contrasena')return core.fetch(new Request(origin+'/password.html'),env,context);
   if(path==='/salir')return core.fetch(new Request(origin+'/logout.html'),env,context);
   if(path.includes('signin-with-chatgpt')||path.includes('signout-with-chatgpt'))return Response.redirect(origin+'/login',302);
   const headers=new Headers(request.headers);
   // Never accept externally supplied identity headers, even through a reverse proxy.
   for(const name of [...headers.keys()])if(name.startsWith('oai-')||name.startsWith('x-auth-'))headers.delete(name);
   if(actor){headers.set('oai-authenticated-user-id','vps:'+actor.id);headers.set('oai-authenticated-user-email',actor.email||'')}
   const forwarded=new Request(origin+url.pathname+url.search,{method,headers,body:['GET','HEAD'].includes(method)?undefined:request.body,duplex:'half',signal:request.signal});
   const result=await core.fetch(forwarded,env,context);
   if(path==='/api/state'&&method==='POST'&&result.ok){const state=(await loadState(env)).data,ids=new Set(state.users.map(u=>u.id));for(const row of sql.prepare('SELECT user_id FROM vps_credentials').all())if(!ids.has(row.user_id))sql.prepare('DELETE FROM vps_credentials WHERE user_id=?').run(row.user_id)}
   return result;
  }catch(e){if(!e.status)console.error('Error de aplicación:',e.name);return response({error:e.status?e.message:'No se pudo completar la solicitud.'},e.status||500)}
 }
 return {fetch:handle,DB,env,close:()=>DB.close(),auditStatements:authAuditStatements};
}

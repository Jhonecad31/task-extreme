import {configuration} from './config.mjs';
import {createApplication} from './application.mjs';
import {hashPassword} from './passwords.mjs';
import {ask} from './prompt.mjs';
import {loadState,auditRecord} from '../dist/server/index.js';
process.umask(0o077);
let app;try{
 const mode=process.argv[2];if(!['init','reset'].includes(mode))throw Error('Usa npm run init-admin o npm run reset-admin.');
 app=await createApplication(configuration());const {data,revision}=await loadState(app.env),admin=data.users.find(u=>u.id===data.primaryAdminId);
 const existing=app.DB.sql.prepare('SELECT user_id FROM vps_credentials WHERE user_id=?').get(admin.id);
 if(mode==='init'&&existing)throw Error('El administrador ya está configurado. Para recuperación usa npm run reset-admin.');
 if(mode==='reset'&&!existing)throw Error('Primero ejecuta npm run init-admin.');
 console.log(mode==='init'?'Configurar administrador principal único.':'Recuperación local del administrador principal; revoca todas sus sesiones.');
 const email=(await ask(`Correo [${admin.email}]: `)).trim().toLowerCase()||admin.email;
 if(!/^\S+@\S+\.\S+$/.test(email)||data.users.some(u=>u.id!==admin.id&&u.email?.toLowerCase()===email))throw Error('Correo no válido o ya usado.');
 const name=(await ask(`Nombre [${admin.name}]: `)).trim()||admin.name;
 if(name.length>70||data.users.some(u=>u.id!==admin.id&&u.name.toLowerCase()===name.toLowerCase()))throw Error('Nombre no válido o duplicado.');
 const password=await ask('Contraseña (12–128 caracteres; no se muestra): ',{hidden:true});if(password!==await ask('Repetir contraseña: ',{hidden:true}))throw Error('Las contraseñas no coinciden.');
 const hash=await hashPassword(password);admin.email=email;admin.name=name;if(mode==='init')data.importWindowOpen=true;
 const entry=auditRecord(admin,mode==='init'?'CREAR_ACCESO':'RECUPERAR_ACCESO','Acceso',mode==='init'?'Alta del administrador principal por terminal':'Recuperación del administrador principal por terminal',admin.id);
 const before=app.DB.sql.prepare("SELECT revision FROM nexo_state WHERE id='main'").get();if(before.revision!==revision)throw Error('Los registros cambiaron durante la configuración. Reintenta.');
 await app.DB.batch([app.DB.prepare("UPDATE nexo_state SET payload=?,revision=revision+1 WHERE id='main'").bind(JSON.stringify(data)),app.DB.prepare('INSERT INTO vps_credentials VALUES (?,?,0,?) ON CONFLICT(user_id) DO UPDATE SET password_hash=excluded.password_hash,must_change=0,updated_at=excluded.updated_at').bind(admin.id,hash,Date.now()),app.DB.prepare('DELETE FROM vps_sessions WHERE user_id=?').bind(admin.id),...app.auditStatements(entry)]);
 console.log('Acceso del administrador guardado. Ya puedes iniciar sesión con tu correo y contraseña.');
}catch(error){console.error(error.message);process.exitCode=1}finally{app?.close()}

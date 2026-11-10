// Offline operation: stop the app before invoking this command.
import {DatabaseSync,backup} from 'node:sqlite';
import {copyFileSync,chmodSync,renameSync,rmSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
process.umask(0o077);
const source=process.argv[2],target=resolve(process.env.DB_PATH||'./data/task-extreme.sqlite'),backupDir=resolve(process.env.BACKUP_DIR||'./backups');
if(!source||process.argv[3]!=='--confirm-offline')throw Error('Detén la aplicación y usa: node vps/restore.mjs /ruta/respaldo.sqlite --confirm-offline');
if(resolve(source)===target)throw Error('El respaldo no puede ser la base de datos activa.');
const candidate=new DatabaseSync(resolve(source),{readOnly:true});
try{if(candidate.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('El respaldo está dañado.');for(const name of ['nexo_state','nexo_updates','nexo_files','taskextreme_audit','vps_credentials'])if(!candidate.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name))throw Error('El respaldo no contiene Task Extreme VPS completo.')}finally{candidate.close()}
mkdirSync(dirname(target),{recursive:true,mode:0o700});mkdirSync(backupDir,{recursive:true,mode:0o700});
if(existsSync(target)){const previous=new DatabaseSync(target);try{await backup(previous,resolve(backupDir,'antes-de-restaurar-'+Date.now()+'.sqlite'))}finally{previous.close()}}
const stage=target+'.restoring';copyFileSync(resolve(source),stage);chmodSync(stage,0o600);for(const suffix of ['-wal','-shm'])rmSync(target+suffix,{force:true});renameSync(stage,target);
console.log('Base restaurada. Reinicia Task Extreme. Las cuentas y contraseñas corresponden al respaldo restaurado.');

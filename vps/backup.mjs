import {backup} from 'node:sqlite';
import {mkdirSync,chmodSync} from 'node:fs';
import {resolve} from 'node:path';
import {openDatabase} from './database.mjs';
process.umask(0o077);
const source=process.env.DB_PATH||'./data/task-extreme.sqlite',directory=process.env.BACKUP_DIR||'./backups';mkdirSync(directory,{recursive:true,mode:0o700});
const target=resolve(directory,`task-extreme-${new Date().toISOString().replace(/[:.]/g,'-')}.sqlite`),db=openDatabase(source);
try{await backup(db.sql,target);chmodSync(target,0o600);console.log('Respaldo completo: '+target)}finally{db.close()}

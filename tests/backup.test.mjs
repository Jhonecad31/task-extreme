import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createApplication} from '../vps/application.mjs';
import {hashPassword} from '../vps/passwords.mjs';
const directory=mkdtempSync(join(tmpdir(),'task-backup-')),dbPath=join(directory,'data/app.sqlite'),backups=join(directory,'backups'),env={...process.env,DB_PATH:dbPath,BACKUP_DIR:backups},config={dbPath,adminEmail:'root@example.test',origin:'http://localhost:3000',production:false};
let app=await createApplication(config);
try{
 app.DB.sql.prepare('INSERT INTO vps_credentials VALUES (?,?,0,?)').run('user-0',await hashPassword('Una-clave-de-test-123'),Date.now());
 app.DB.sql.prepare('INSERT INTO nexo_files VALUES (?,?,?,?,?,?)').run('photo','test-task','user-0','foto.png','image/png',3);app.DB.sql.prepare('INSERT INTO nexo_filechunks VALUES (?,?,?)').run('photo',0,'YWJj');
 execFileSync(process.execPath,['vps/backup.mjs'],{env});const filename=readdirSync(backups).find(n=>n.endsWith('.sqlite')),source=join(backups,filename);
 app.DB.sql.prepare('DELETE FROM nexo_filechunks WHERE file_id=?').run('photo');app.close();app=null;
 execFileSync(process.execPath,['vps/restore.mjs',source,'--confirm-offline'],{env});
 app=await createApplication(config);assert.equal(app.DB.sql.prepare('SELECT payload FROM nexo_filechunks WHERE file_id=?').get('photo').payload,'YWJj');assert(app.DB.sql.prepare('SELECT password_hash FROM vps_credentials WHERE user_id=?').get('user-0').password_hash.startsWith('scrypt$'));assert(app.DB.sql.prepare('SELECT COUNT(*) n FROM taskextreme_audit').get().n>0);assert(readdirSync(backups).some(n=>n.startsWith('antes-de-restaurar')));
 console.log('PASS: consistent live SQLite backup and offline restoration preserve files, credentials and immutable audit; pre-restoration backup is retained.');
}finally{app?.close();rmSync(directory,{recursive:true,force:true})}

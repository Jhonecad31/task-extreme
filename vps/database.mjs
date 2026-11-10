import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync,readdirSync,chmodSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
export function openDatabase(filename){
 if(filename!==':memory:')mkdirSync(dirname(resolve(filename)),{recursive:true,mode:0o700});
 const sql=new DatabaseSync(filename);sql.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL;');
 if(filename!==':memory:')chmodSync(filename,0o600);
 sql.exec('CREATE TABLE IF NOT EXISTS vps_migrations(name TEXT PRIMARY KEY,applied_at TEXT NOT NULL)');
 for(const name of readdirSync(new URL('../drizzle/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort()){
  if(sql.prepare('SELECT name FROM vps_migrations WHERE name=?').get(name))continue;
  sql.exec('BEGIN IMMEDIATE');try{sql.exec(readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8'));sql.prepare('INSERT INTO vps_migrations VALUES (?,?)').run(name,new Date().toISOString());sql.exec('COMMIT')}catch(error){sql.exec('ROLLBACK');throw error}
 }
 const DB={sql,prepare(query){let args=[];const stmt={bind(...values){args=values;return stmt},async first(){return sql.prepare(query).get(...args)||null},async all(){return {results:sql.prepare(query).all(...args)}},execute(){const r=sql.prepare(query).run(...args);return {meta:{changes:r.changes,last_row_id:Number(r.lastInsertRowid)}}},async run(){return stmt.execute()}};return stmt},async batch(statements){
  // No await inside the transaction: concurrent requests cannot interleave writes.
  sql.exec('BEGIN IMMEDIATE');try{const results=statements.map(s=>s.execute());sql.exec('COMMIT');return results}catch(error){sql.exec('ROLLBACK');throw error}
 },close(){sql.close()}};return DB;
}

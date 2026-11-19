import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
const assets={};for(const name of readdirSync('web')){const type={js:'text/javascript; charset=utf-8',html:'text/html; charset=utf-8',css:'text/css; charset=utf-8'}[name.split('.').at(-1)];if(type)assets['/'+name]={body:readFileSync('web/'+name,'utf8'),type}}
const seed=JSON.parse(readFileSync('worker/seed.json','utf8'));
const code='const ASSETS='+JSON.stringify(assets)+';\nconst SEED='+JSON.stringify(seed)+';\nconst LOGIN_HTML='+JSON.stringify(assets['/login.html'].body)+';\n'+['roles.mjs','team-policy.mjs','audit.mjs','server.mjs'].map(n=>readFileSync('worker/'+n,'utf8')).join('\n')+'\nexport {loadState,appendAudit,auditRecord,validateGraph};\n';
mkdirSync('dist/server',{recursive:true});writeFileSync('dist/server/index.js',code);console.log('Compilado Task Extreme para Node/VPS.');

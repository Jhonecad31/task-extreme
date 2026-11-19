const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
// Load the actual application using the shared minimal DOM adapter.
const source=fs.readFileSync('scripts/test-client.cjs','utf8').split('setImmediate(()=>{const html=')[0];
const suite=new vm.Script(source+';globalThis.testApp={c,element,nodes};');
const sandbox={require,console,queueMicrotask,structuredClone,URL,URLSearchParams,Blob,FormData};vm.createContext(sandbox);suite.runInContext(sandbox);
const {c,element}=sandbox.testApp,run=code=>vm.runInContext(code,c);
setImmediate(async()=>{try{
run(`currentUserId='user-0';data.companies=[{id:'co',name:'Empresa Águila'},{id:'secret',name:'Empresa Oculta'}];data.workspaces=[{id:'ws',companyId:'co',name:'Diseño general',projects:['Lanzamiento']},{id:'private',companyId:'secret',name:'Espacio secreto',projects:['Confidencial']}];companyId='co';workspaceId='ws';data.users.find(u=>u.id==='user-1').job='Diseñador';data.tasks=[{id:101,title:'Revisión del catálogo',workspaceId:'ws',project:'Lanzamiento',status:'En curso',priority:'Alta',assigneeIds:['user-1'],createdBy:'user-1',notes:[{text:'Nota técnica del boceto'}]},{id:102,title:'Subtarea del logotipo',parentId:101,workspaceId:'ws',project:'Lanzamiento',status:'Pendiente',assigneeIds:['user-1'],createdBy:'user-1',notes:[]},{id:103,title:'Tarea secreta',workspaceId:'private',project:'Confidencial',status:'Pendiente',createdBy:'user-3',assigneeIds:['user-3'],notes:[]}];data.groups=[];data.accessScope={companyIds:['co'],workspaceIds:['ws'],visibleUserIds:['user-0','user-1'],managedAgentsByWorkspace:{},manageProjects:[]};data.users.find(u=>u.id==='user-1').grants={co:{all:true}};data.users.find(u=>u.id==='user-3').grants={secret:{all:true}};`);
assert(run("globalSearchRecords('revision catalog').some(r=>r.id===101)"));
assert(run("globalSearchRecords('paulo').some(r=>r.id===101)"));
assert(run("globalSearchRecords('logoti').some(r=>r.id===102)"));
assert(run("globalSearchRecords('aguila').some(r=>r.kind==='company')"));
assert(run("globalSearchRecords('diseno').some(r=>r.kind==='workspace')"));
assert(run("globalSearchRecords('lanzam').some(r=>r.kind==='project')"));
assert(run("globalSearchRecords('nota tecnica').some(r=>r.kind==='comment')"));
assert(run("globalSearchRecords('archivo',[{id:1,taskId:101,text:'',files:[{name:'archivo.pdf'}]}]).some(r=>r.kind==='comment')"));
assert.equal(run("globalSearchRecords('secreta').length"),0);
assert.equal(run("globalSearchRecords('oculta').length"),0);
assert.equal(run("globalSearchRecords('confidencial',[{id:2,taskId:103,text:'Confidencial'}]).length"),0);
run("currentUserId='user-1';data.accessScope.visibleUserIds=['user-0','user-1'];");
assert.equal(run("globalSearchRecords('cristi').length"),0);
assert(run("globalSearchRecords('paulo').some(r=>r.kind==='user')"));
// All rendered user data is escaped.
run("data.tasks[0].title='<img src=x onerror=alert(1)>';paintGlobalSearch(globalSearchRecords('img')); ");
assert(element('#global-search-results').innerHTML.includes('&lt;img'));
run("enterGlobalSpace(data.workspaces[0],'Lanzamiento')");assert.equal(run('personalHomeOpen'),false);assert.equal(run('nav'),'Lanzamiento');
run("paintGlobalSearch(globalSearchRecords('logotipo'));closeGlobalSearch()");assert.equal(element('#global-search-results').hidden,true);
// Async results from a closed query must not reopen the panel.
let resolveUpdates;c.allUpdateRecords=()=>new Promise(resolve=>{resolveUpdates=resolve});run("allUpdateRecords=globalThis.allUpdateRecords;globalSearchInput.value='logotipo'");const pending=run('refreshGlobalSearch()');run('closeGlobalSearch()');resolveUpdates([]);await pending;assert.equal(element('#global-search-results').hidden,true);
console.log('PASS: fragment/accent search across authorized tasks, subtasks, people, companies, workspaces, projects, notes and files; hidden-scope exclusion, escaped content, navigation and stale-request cancellation.');
// Test the real early theme script with actual handlers and storage.
const handlers={},clicks={},root={dataset:{}},button={setAttribute(k,v){this[k]=v}},saved=new Map([['task-extreme-theme','dark']]);
const tc={document:{documentElement:root,getElementById:()=>button,addEventListener:(k,f)=>handlers[k]=f},window:{addEventListener:(k,f)=>handlers[k]=f},localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)}};
button.addEventListener=(k,f)=>clicks[k]=f;vm.runInNewContext(fs.readFileSync('web/theme.js','utf8'),tc);assert.equal(root.dataset.theme,'dark');handlers.DOMContentLoaded();assert.equal(button['aria-pressed'],'true');clicks.click();assert.equal(root.dataset.theme,'light');assert.equal(saved.get('task-extreme-theme'),'light');assert.equal(button['aria-label'],'Activar modo noche');handlers.storage({key:'task-extreme-theme',newValue:'dark'});assert.equal(root.dataset.theme,'dark');
const css=fs.readFileSync('web/style.css','utf8');assert(css.includes('--surface:#1d2023'));assert(css.includes('--surface:#fff'));assert(css.includes('dialog{background:var(--surface)'));
console.log('PASS: early saved theme, one-button toggle, accessible labels, persistence, cross-tab changes and light/dark surface tokens.');
}catch(e){console.error(e);process.exitCode=1}});

// Search only the authorized snapshot and the server-filtered updates endpoint.
const globalSearchInput=$('#global-search-input'),globalSearchPanel=$('#global-search-results');
let globalSearchTimer,globalSearchSequence=0,globalSearchMatches=[],globalSearchLimit=35;
const searchNormalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
function searchContains(query,...values){const text=searchNormalize(values.flat(Infinity).filter(v=>v!=null).join(' '));return searchNormalize(query).trim().split(/\s+/).every(word=>text.includes(word))}
function globalSearchRecords(query,updates=[]){
 if(!query.trim())return [];
 const rows=[],spaces=data.workspaces.filter(canSeeWorkspace),spaceIds=new Set(spaces.map(w=>w.id)),companies=data.companies.filter(c=>canSeeCompany(c.id)),companyIds=new Set(companies.map(c=>c.id));
 const context=w=>[companies.find(c=>c.id===w?.companyId)?.name,w?.name].filter(Boolean).join(' · ');
 const tasks=data.tasks.filter(t=>spaceIds.has(t.workspaceId)&&taskVisible(t)),taskIds=new Set(tasks.map(t=>t.id));
 for(const t of tasks){const w=spaces.find(w=>w.id===t.workspaceId),people=assignedNames(t);if(searchContains(query,t.title,t.id,t.project,t.status,t.priority,people,context(w),Object.values(t.customFields||{})))rows.push({kind:'task',id:t.id,title:t.title,detail:`${t.parentId?'Subtarea':'Tarea'} · ${context(w)} · ${t.status}`,icon:t.parentId?'↳':'✓'});
  for(const [i,note] of (t.notes||[]).entries())if(searchContains(query,note.text))rows.push({kind:'comment',id:t.id,key:'note-'+i,title:note.text,detail:`Anotación · ${t.title} · ${context(w)}`,icon:'☷'});
 }
 for(const u of data.users.filter(u=>u.id===currentUserId||clientPeerVisible(currentUser(),u))){if(searchContains(query,u.name,u.email,u.job,roleLabel(u.role)))rows.push({kind:'user',id:u.id,title:u.name,detail:`Persona · ${u.job||roleLabel(u.role)}`,icon:'◉'})}
 for(const c of companies)if(searchContains(query,c.name))rows.push({kind:'company',id:c.id,title:c.name,detail:'Empresa · Ver espacios de trabajo',icon:'▦'});
 for(const w of spaces){if(searchContains(query,w.name))rows.push({kind:'workspace',id:w.id,title:w.name,detail:`Espacio de trabajo · ${companies.find(c=>c.id===w.companyId)?.name||''}`,icon:'◫'});for(const project of w.projects||[])if(searchContains(query,project))rows.push({kind:'project',id:w.id,project,title:project,detail:`Proyecto · ${context(w)}`,icon:'▥'})}
 for(const update of updates){if(update.deletedAt||!taskIds.has(update.taskId))continue;const t=tasks.find(t=>t.id===update.taskId),names=(update.files||[]).map(f=>f.name);if(searchContains(query,update.text,names))rows.push({kind:'comment',id:t.id,key:update.id,title:update.text||names.join(', '),detail:`Comentario / adjunto · ${t.title}`,icon:'☷'})}
 return rows;
}
function closeGlobalSearch(){clearTimeout(globalSearchTimer);globalSearchSequence++;globalSearchPanel.hidden=true;globalSearchInput.setAttribute('aria-expanded','false')}
function paintGlobalSearch(rows,message=''){
 globalSearchMatches=rows;globalSearchPanel.hidden=false;globalSearchInput.setAttribute('aria-expanded','true');
 globalSearchPanel.innerHTML=`<p class="global-search-meta" role="status">${rows.length?`${rows.length} resultados · Solo información autorizada`:message||'No encontramos coincidencias. Prueba con otro fragmento.'}</p>`+rows.slice(0,globalSearchLimit).map((row,i)=>`<button class="global-result" data-global-result="${i}"><span class="global-result-icon" aria-hidden="true">${row.icon}</span><span class="global-result-text"><b>${esc(String(row.title).slice(0,180))}</b><small>${esc(row.detail)}</small></span></button>`).join('')+(rows.length>globalSearchLimit?'<button class="updates-link" data-global-more>Mostrar más resultados</button>':'');
}
async function refreshGlobalSearch(){
 const query=globalSearchInput.value.trim(),sequence=++globalSearchSequence;
 if(!query){closeGlobalSearch();return}
 paintGlobalSearch(globalSearchRecords(query),'Buscando comentarios y adjuntos…');
 try{const updates=await allUpdateRecords();if(sequence===globalSearchSequence&&globalSearchInput.value.trim()===query)paintGlobalSearch(globalSearchRecords(query,updates))}
 catch{if(sequence===globalSearchSequence){const rows=globalSearchRecords(query);paintGlobalSearch(rows,'No hay coincidencias en los datos disponibles.');globalSearchPanel.insertAdjacentHTML('beforeend','<p class="global-search-meta" role="status">No se pudieron consultar los comentarios. Vuelve a escribir para reintentar.</p>')}}
}
function enterGlobalSpace(space,project){
 if(!space||!canSeeWorkspace(space))return false;companyId=space.companyId;workspaceId=space.id;nav=project||'Resumen';$('#search').value='';$('#person').value='';hidePersonalHome();closeDashboard();render();return true;
}
function openGlobalResult(row){
 if(!row)return;
 if(row.kind==='task'||row.kind==='comment'){const task=data.tasks.find(t=>t.id===row.id);if(!task||!taskVisible(task)){toast('Esta actividad ya no está disponible.');return}enterGlobalSpace(data.workspaces.find(w=>w.id===task.workspaceId),task.project);enterTaskContext(task.id,row.kind==='comment')}
 else if(row.kind==='workspace'||row.kind==='project'){const w=data.workspaces.find(w=>w.id===row.id);if(row.kind==='project'&&!w?.projects?.includes(row.project))return;enterGlobalSpace(w,row.project)}
 else if(row.kind==='company'){if(!canSeeCompany(row.id))return;homeFilter=row.id;roleTaskPage=0;openPersonalHome()}
 else if(row.kind==='user'){
  const u=data.users.find(u=>u.id===row.id);if(!u||!(u.id===currentUserId||clientPeerVisible(currentUser(),u)))return;
  const dialog=document.createElement('dialog');dialog.className='search-person-dialog';dialog.dataset.searchUser=u.id;dialog.innerHTML=`<div class="sectionhead"><h2>Persona del equipo</h2><button class="close" aria-label="Cerrar">×</button></div><div class="search-person-card">${avatar(u.name)}<div><h3>${esc(u.name)}</h3><p>${esc(u.job||roleLabel(u.role))}</p></div></div><p class="muted">Actividades visibles relacionadas con esta persona.</p><div>${data.tasks.filter(t=>taskVisible(t)&&(t.createdBy===u.id||t.assigneeIds?.includes(u.id))).map(t=>`<button class="global-result" data-search-person-task="${t.id}">${esc(t.title)} ↗</button>`).join('')||'<p class="muted">Sin actividades visibles.</p>'}</div>`;document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.addEventListener('click',e=>{const b=e.target.closest('[data-search-person-task]');if(b){dialog.close();openGlobalResult({kind:'task',id:Number(b.dataset.searchPersonTask)})}});dialog.showModal();
 }
 closeGlobalSearch();globalSearchInput.value='';
}
globalSearchInput.addEventListener('input',()=>{clearTimeout(globalSearchTimer);globalSearchSequence++;globalSearchLimit=35;if(!globalSearchInput.value.trim()){closeGlobalSearch();return}globalSearchTimer=setTimeout(refreshGlobalSearch,180)});
globalSearchInput.addEventListener('focus',()=>{if(globalSearchInput.value.trim())refreshGlobalSearch()});
globalSearchInput.addEventListener('keydown',event=>{if(event.key==='Escape'){closeGlobalSearch();event.stopPropagation()}if(event.key==='ArrowDown'){event.preventDefault();globalSearchPanel.querySelector('button')?.focus()}if(event.key==='Enter'&&globalSearchMatches.length&&!globalSearchPanel.hidden){event.preventDefault();openGlobalResult(globalSearchMatches[0])}});
globalSearchPanel.addEventListener('keydown',event=>{if(event.key==='Escape'){globalSearchInput.focus();closeGlobalSearch();return}const buttons=[...globalSearchPanel.querySelectorAll('button')],index=buttons.indexOf(document.activeElement);if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();buttons[(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus()}});
globalSearchPanel.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;if(button.dataset.globalResult!==undefined)openGlobalResult(globalSearchMatches[Number(button.dataset.globalResult)]);if(button.hasAttribute('data-global-more')){globalSearchLimit+=35;paintGlobalSearch(globalSearchMatches)}});
document.addEventListener('click',event=>{if(!event.target.closest('.global-search'))closeGlobalSearch()});
document.addEventListener('keydown',event=>{if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.target.matches('input,textarea,select,[contenteditable="true"]')){event.preventDefault();globalSearchInput.focus()}});

function refreshGlobalSearchScope(){
 document.querySelectorAll('.search-person-dialog[open]').forEach(dialog=>{const user=data.users.find(u=>u.id===dialog.dataset.searchUser);if(!user||!(user.id===currentUserId||clientPeerVisible(currentUser(),user)))dialog.close()});
 if(!globalSearchPanel.hidden)refreshGlobalSearch();
}

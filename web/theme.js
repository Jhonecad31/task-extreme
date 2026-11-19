// Apply before painting; preferences are independent from shared task data.
(function(){
  const key='task-extreme-theme';
  function apply(theme){
    const dark=theme==='dark';document.documentElement.dataset.theme=dark?'dark':'light';
    const button=document.getElementById('theme-toggle');
    if(button){button.textContent=dark?'☀':'☾';button.setAttribute('aria-pressed',String(dark));button.setAttribute('aria-label',dark?'Activar modo claro':'Activar modo noche');button.title=dark?'Activar modo claro':'Activar modo noche'}
  }
  let theme='light';try{theme=localStorage.getItem(key)||'light'}catch{}apply(theme);
  document.addEventListener('DOMContentLoaded',()=>{apply(document.documentElement.dataset.theme);const button=document.getElementById('theme-toggle');if(button)button.addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';apply(next);try{localStorage.setItem(key,next)}catch{}})});
  window.addEventListener('storage',event=>{if(event.key===key)apply(event.newValue)});
})();

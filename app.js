const modal=document.getElementById('authModal');
const openers=[document.getElementById('joinBtn'),document.getElementById('joinBtn2'),document.getElementById('loginBtn')];
const close=()=>modal.classList.add('hidden');
openers.forEach(btn=>btn&&btn.addEventListener('click',()=>modal.classList.remove('hidden')));
document.getElementById('closeModal')?.addEventListener('click',close);
document.getElementById('modalOk')?.addEventListener('click',close);
modal?.addEventListener('click',e=>{if(e.target===modal)close()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});

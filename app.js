const modal=document.getElementById('authModal');
const profileModal=document.getElementById('profileModal');
const close=()=>modal?.classList.add('hidden');
[document.getElementById('joinBtn'),document.getElementById('joinBtn2'),document.getElementById('loginBtn')].forEach(btn=>btn?.addEventListener('click',()=>modal?.classList.remove('hidden')));
document.getElementById('closeModal')?.addEventListener('click',close);
document.getElementById('modalOk')?.addEventListener('click',close);
modal?.addEventListener('click',e=>{if(e.target===modal)close()});
document.getElementById('closeProfile')?.addEventListener('click',()=>profileModal.classList.add('hidden'));
profileModal?.addEventListener('click',e=>{if(e.target===profileModal)profileModal.classList.add('hidden')});

document.querySelectorAll('.person-card').forEach(card=>{
  const name=card.dataset.name;
  card.querySelector('.view-profile')?.addEventListener('click',()=>{
    document.getElementById('modalAvatar').textContent=name[0];
    document.getElementById('profileName').textContent=name;
    document.getElementById('profileMeta').textContent=card.dataset.age+' سنة · 📍 '+card.dataset.wilaya;
    document.getElementById('profileBio').textContent=card.dataset.bio;
    profileModal.classList.remove('hidden');
  });
  card.querySelector('.like')?.addEventListener('click',e=>{
    e.currentTarget.classList.toggle('active');
    e.currentTarget.textContent=e.currentTarget.classList.contains('active')?'♥ تم الإعجاب':'♡ إعجاب';
  });
  card.querySelector('.friend')?.addEventListener('click',e=>{
    e.currentTarget.classList.toggle('active');
    e.currentTarget.textContent=e.currentTarget.classList.contains('active')?'✓ تمت الإضافة':'🤝 إضافة صديق';
  });
  card.querySelector('.chat')?.addEventListener('click',()=>{
    modal.classList.remove('hidden');
    document.getElementById('modalTitle').textContent='المراسلة';
  });
});
document.getElementById('modalLike')?.addEventListener('click',e=>{e.textContent=e.textContent.includes('♡')?'♥ تم الإعجاب':'♡ إعجاب'});
document.getElementById('modalFriend')?.addEventListener('click',e=>{e.textContent=e.textContent.includes('إضافة')?'✓ تمت الإضافة':'🤝 إضافة صديق'});
document.getElementById('modalChat')?.addEventListener('click',()=>{profileModal.classList.add('hidden');modal.classList.remove('hidden');document.getElementById('modalTitle').textContent='المراسلة'});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){close();profileModal?.classList.add('hidden')}});
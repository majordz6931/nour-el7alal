import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL='https://fnkvlmrzzxptncrqpyyz.supabase.co';
const SUPABASE_KEY='sb_publishable_hwffg3R4YzXTMnDu8-ZMDQ_1NuLnAfY';
const AUTH_FUNCTION=`${SUPABASE_URL}/functions/v1/username-auth`;
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY);

const WILAYAS=[
'أدرار','الشلف','الأغواط','أم البواقي','باتنة','بجاية','بسكرة','بشار','البليدة','البويرة',
'تمنراست','تبسة','تلمسان','تيارت','تيزي وزو','الجزائر','الجلفة','جيجل','سطيف','سعيدة',
'سكيكدة','سيدي بلعباس','عنابة','قالمة','قسنطينة','المدية','مستغانم','المسيلة','معسكر','ورقلة',
'وهران','البيض','إليزي','برج بوعريريج','بومرداس','الطارف','تندوف','تيسمسيلت','الوادي','خنشلة',
'سوق أهراس','تيبازة','ميلة','عين الدفلى','النعامة','عين تموشنت','غليزان','تيميمون','برج باجي مختار',
'أولاد جلال','بني عباس','إن صالح','إن قزام','توقرت','جانت','المغير','المنيعة',
'آفلو','بريكة','قصر الشلالة','مسعد','عين وسارة','بوسعادة','الأبيض سيدي الشيخ','القنطرة','بئر العاتر',
'قصر البخاري','العريشة'
];

let mode='login', currentUser=null, selectedUser=null, messageChannel=null, selectedBlocked=false;
const $=id=>document.getElementById(id);

function fillWilayas(select, selected=''){
  select.innerHTML='<option value="">اختر الولاية</option>'+WILAYAS.map(w=>`<option value="${escAttr(w)}">${esc(w)}</option>`).join('');
  if(selected) select.value=selected;
}
fillWilayas($('wilaya'));
fillWilayas($('pWilaya'));

function setMaxDob(){
  const d=new Date();
  d.setFullYear(d.getFullYear()-18);
  $('dateOfBirth').max=d.toISOString().slice(0,10);
  $('pDateOfBirth').max=d.toISOString().slice(0,10);
}
setMaxDob();

document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{
  mode=b.dataset.tab;
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));
  $('signupFields').classList.toggle('hidden',mode!=='signup');
  $('password').autocomplete=mode==='login'?'current-password':'new-password';
  $('authSubmit').textContent=mode==='login'?'تسجيل الدخول':'إنشاء الحساب';
  $('authMsg').textContent='';
  $('dateOfBirth').required=mode==='signup';
  $('wilaya').required=mode==='signup';
  $('avatar').required=mode==='signup';
});

$('avatar').onchange=()=>{
  const file=$('avatar').files[0];
  previewFile(file,$('avatarPreview'));
};
$('pAvatar').onchange=()=>{
  const file=$('pAvatar').files[0];
  previewFile(file,$('profileAvatarPreview'));
};

$('authForm').onsubmit=async e=>{
  e.preventDefault();
  $('authMsg').textContent='جاري التنفيذ...';

  const username=$('username').value.trim().toLowerCase();
  const password=$('password').value;

  if(mode==='signup'){
    const date_of_birth=$('dateOfBirth').value;
    const wilaya=$('wilaya').value;
    const gender=$('gender').value;
    const seeking=$('seeking').value;
    const avatar=$('avatar').files[0];

    if(!/^[a-z0-9_.-]{3,24}$/.test(username)){
      $('authMsg').textContent='اسم المستخدم: 3 إلى 24 حرفًا، حروف إنجليزية صغيرة أو أرقام أو _ . -';
      return;
    }
    if(!isAdult(date_of_birth)){ $('authMsg').textContent='يجب أن يكون عمرك 18 سنة أو أكثر'; return; }
    if(!wilaya){ $('authMsg').textContent='اختر الولاية'; return; }
    if(!['male','female'].includes(gender)){ $('authMsg').textContent='اختر الجنس'; return; }
    if(!['male','female'].includes(seeking)){ $('authMsg').textContent='حدد من تبحث عنه للزواج'; return; }
    if(!avatar){ $('authMsg').textContent='صورة البروفيل مطلوبة'; return; }
    if(!validImage(avatar)){ $('authMsg').textContent='الصورة يجب أن تكون JPG أو PNG أو WEBP وأقل من 5MB'; return; }

    const result=await usernameAuth('signup',{username,password,date_of_birth,wilaya,gender,seeking});
    if(result.error){ $('authMsg').textContent=result.error; return; }
    const sessionResult=await supabase.auth.setSession(result.session);
    if(sessionResult.error){ $('authMsg').textContent=sessionResult.error.message; return; }
    const upload=await uploadAvatar(avatar);
    if(upload.error){
      $('authMsg').textContent='تم إنشاء الحساب، لكن تعذر رفع الصورة. يمكنك رفعها من الملف الشخصي.';
    }else{
      await saveProfile({avatar_url:upload.url});
    }
    $('authMsg').textContent='تم إنشاء الحساب بنجاح ✓';
    return;
  }

  const result=await usernameAuth('login',{username,password});
  if(result.error){ $('authMsg').textContent=result.error; return; }
  const sessionResult=await supabase.auth.setSession(result.session);
  if(sessionResult.error){ $('authMsg').textContent=sessionResult.error.message; return; }
};

$('logoutBtn').onclick=async()=>{
  await supabase.auth.signOut({scope:'local'});
  location.reload();
};

$('profileForm').onsubmit=async e=>{
  e.preventDefault();
  if(!currentUser)return;
  $('profileMsg').textContent='جاري الحفظ...';

  const dob=$('pDateOfBirth').value;
  const wilaya=$('pWilaya').value;
  if(!isAdult(dob)){ $('profileMsg').textContent='يجب أن يكون العمر 18 سنة أو أكثر'; return; }
  if(!wilaya){ $('profileMsg').textContent='اختر الولاية'; return; }

  let avatar_url;
  const file=$('pAvatar').files[0];
  if(file){
    if(!validImage(file)){ $('profileMsg').textContent='الصورة يجب أن تكون JPG أو PNG أو WEBP وأقل من 5MB'; return; }
    const upload=await uploadAvatar(file);
    if(upload.error){ $('profileMsg').textContent=upload.error; return; }
    avatar_url=upload.url;
  }

  const gender=$('pGender').value;
  const seeking=$('pSeeking').value;
  if(!['male','female'].includes(gender)||!['male','female'].includes(seeking)){ $('profileMsg').textContent='اختر الجنس ومن تبحث عنه'; return; }
  const data={date_of_birth:dob,wilaya,gender,seeking};
  if(avatar_url)data.avatar_url=avatar_url;
  const {error}=await supabase.from('profiles').update(data).eq('id',currentUser.id);
  $('profileMsg').textContent=error?error.message:'تم حفظ الملف ✓';
  if(!error){$('pAvatar').value='';await loadProfile();await loadUsers();}
};

$('search').oninput=()=>loadUsers($('search').value.trim());

$('blockBtn').onclick=toggleBlock;\n$('reportBtn').onclick=reportSelected;\n\n$('messageForm').onsubmit=async e=>{
  e.preventDefault();
  if(!selectedUser)return;
  if(selectedBlocked){ $('messages').innerHTML='<p class="muted">تم حظر هذا المستخدم. ألغِ الحظر أولاً لإرسال رسالة.</p>'; return; }
  const content=$('messageInput').value.trim();
  if(!content)return;
  const {error}=await supabase.from('messages').insert({sender_id:currentUser.id,receiver_id:selectedUser.id,content});
  if(error){alert(error.message);return}
  $('messageInput').value='';
  loadMessages();
};

async function usernameAuth(action,body){
  try{
    const res=await fetch(AUTH_FUNCTION,{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},
      body:JSON.stringify({action,...body})
    });
    const data=await res.json().catch(()=>({error:'استجابة غير صالحة'}));
    if(!res.ok)return {error:data.error||'تعذر تنفيذ الطلب'};
    return data;
  }catch(error){
    return {error:'تعذر الاتصال بخدمة تسجيل الدخول'};
  }
}

async function init(user){
  if(currentUser?.id===user?.id)return;
  currentUser=user;
  $('authView').classList.add('hidden');
  $('appView').classList.remove('hidden');
  $('logoutBtn').classList.remove('hidden');
  await loadProfile();
  await loadUsers();

  if(messageChannel)await supabase.removeChannel(messageChannel);
  messageChannel=supabase.channel('messages-live').on('postgres_changes',{
    event:'INSERT',schema:'public',table:'messages'
  },payload=>{
    if(selectedUser&&(
      (payload.new.sender_id===currentUser.id&&payload.new.receiver_id===selectedUser.id)||
      (payload.new.sender_id===selectedUser.id&&payload.new.receiver_id===currentUser.id)
    ))loadMessages();
  }).subscribe();
}

async function loadProfile(){
  const {data,error}=await supabase.from('profiles')
    .select('id,username,date_of_birth,wilaya,gender,seeking,avatar_url')
    .eq('id',currentUser.id).maybeSingle();
  if(error){$('profileMsg').textContent=error.message;return}
  if(!data)return;
  $('pUsername').value=data.username||'';
  $('pDateOfBirth').value=data.date_of_birth||'';
  $('pWilaya').value=data.wilaya||'';
  $('pGender').value=data.gender||'';
  $('pSeeking').value=data.seeking||'';
  showImage($('profileAvatarPreview'),data.avatar_url);
}

async function loadUsers(q=''){
  let query=supabase.from('profiles')
    .select('id,username,date_of_birth,wilaya,gender,seeking,avatar_url,created_at')
    .neq('id',currentUser.id)
    .order('created_at',{ascending:false})
    .limit(50);

  if(q)query=query.or('username.ilike.%'+q+'%,wilaya.ilike.%'+q+'%');

  const {data,error}=await query;
  if(error){$('users').textContent=error.message;return}

  $('users').innerHTML=(data||[]).map(u=>`
    <div class="user" data-id="${escAttr(u.id)}">
      <img class="user-avatar" src="${escAttr(u.avatar_url||'')}" alt="" onerror="this.style.display='none'">
      <div>
        <b>${esc(u.username)}</b>
        <div class="muted">${u.date_of_birth?ageFromDob(u.date_of_birth)+' سنة':''}${u.wilaya?' · '+esc(u.wilaya):''}</div>
      </div>
    </div>`).join('')||'<p class="muted">لا توجد نتائج.</p>';

  document.querySelectorAll('.user').forEach(el=>el.onclick=()=>{
    selectedUser=(data||[]).find(u=>u.id===el.dataset.id);
    if(!selectedUser)return;
    $('chatTitle').textContent='محادثة مع '+selectedUser.username;
    loadMessages();
  });
}

async function refreshSafetyActions(){\n  if(!selectedUser)return;\n  const {data,error}=await supabase.from('blocks').select('blocked_id').eq('blocked_id',selectedUser.id).maybeSingle();\n  selectedBlocked=!error&&!!data;\n  $('blockBtn').textContent=selectedBlocked?'🔓 إلغاء الحظر':'🚫 حظر';\n  $('messageInput').disabled=selectedBlocked;\n  $('messageInput').placeholder=selectedBlocked?'الحظر مفعّل — ألغِ الحظر للرسائل':'اكتب رسالة...';\n}\n\nasync function toggleBlock(){\n  if(!selectedUser)return;\n  if(selectedBlocked){\n    const {error}=await supabase.from('blocks').delete().eq('blocker_id',currentUser.id).eq('blocked_id',selectedUser.id);\n    if(error){alert(error.message);return;}\n    selectedBlocked=false;\n  }else{\n    const {error}=await supabase.from('blocks').insert({blocker_id:currentUser.id,blocked_id:selectedUser.id});\n    if(error){alert(error.message);return;}\n    selectedBlocked=true;\n  }\n  await refreshSafetyActions();\n  await loadUsers($('search').value.trim());\n  if(selectedBlocked){$('messages').innerHTML='<p class="muted">تم حظر هذا المستخدم. لن تتمكن من مراسلته.</p>';}else{await loadMessages();}\n}\n\nasync function reportSelected(){\n  if(!selectedUser)return;\n  const reason=prompt('سبب التبليغ؟\\n\\n1 - حساب مزيف\\n2 - إساءة أو تحرش\\n3 - طلب مال أو احتيال\\n4 - محتوى غير مناسب\\n5 - سبب آخر');\n  if(!reason)return;\n  const details=prompt('تفاصيل إضافية (اختياري):')||null;\n  const {error}=await supabase.from('reports').insert({reporter_id:currentUser.id,reported_id:selectedUser.id,reason:reason.slice(0,500),details:details?details.slice(0,2000):null});\n  if(error){alert(error.message);return;}\n  alert('تم إرسال التبليغ للإدارة. شكرًا لمساعدتك في الحفاظ على أمان الموقع.');\n}\n\nasync function loadMessages(){
  if(!selectedUser)return;
  const {data,error}=await supabase.from('messages').select('*')
    .or('and(sender_id.eq.'+currentUser.id+',receiver_id.eq.'+selectedUser.id+'),and(sender_id.eq.'+selectedUser.id+',receiver_id.eq.'+currentUser.id+')')
    .order('created_at',{ascending:true});
  if(error){$('messages').textContent=error.message;return}
  $('messages').innerHTML=(data||[]).map(m=>'<div class="bubble '+(m.sender_id===currentUser.id?'mine':'')+'">'+esc(m.content)+'</div>').join('');
  $('messages').scrollTop=$('messages').scrollHeight;
}

async function uploadAvatar(file){
  const ext=(file.type.split('/')[1]||'jpg').replace('jpeg','jpg');
  const path=`${currentUser.id}/avatar-${Date.now()}.${ext}`;
  const {error}=await supabase.storage.from('avatars').upload(path,file,{
    cacheControl:'3600',upsert:false,contentType:file.type
  });
  if(error)return {error:error.message};
  const {data}=supabase.storage.from('avatars').getPublicUrl(path);
  return {url:data.publicUrl,path};
}

async function saveProfile(data){
  return supabase.from('profiles').update(data).eq('id',currentUser.id);
}

function previewFile(file,img){
  if(!file){img.classList.add('hidden');img.removeAttribute('src');return}
  if(!validImage(file)){img.classList.add('hidden');return}
  const reader=new FileReader();
  reader.onload=()=>{img.src=reader.result;img.classList.remove('hidden')};
  reader.readAsDataURL(file);
}

function validImage(file){
  return ['image/jpeg','image/png','image/webp'].includes(file.type)&&file.size<=5*1024*1024;
}

function isAdult(value){
  if(!value)return false;
  const dob=new Date(value+'T00:00:00');
  if(Number.isNaN(dob.getTime()))return false;
  const now=new Date();
  let age=now.getFullYear()-dob.getFullYear();
  const m=now.getMonth()-dob.getMonth();
  if(m<0||(m===0&&now.getDate()<dob.getDate()))age--;
  return age>=18&&age<=100;
}

function ageFromDob(value){
  const dob=new Date(value+'T00:00:00');
  const now=new Date();
  let age=now.getFullYear()-dob.getFullYear();
  const m=now.getMonth()-dob.getMonth();
  if(m<0||(m===0&&now.getDate()<dob.getDate()))age--;
  return age;
}

function esc(s){return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]||c));}
function escAttr(s){return esc(s).replace(/'/g,'&#39;');}
function showImage(img,url){
  if(url){img.src=url;img.classList.remove('hidden')}else{img.removeAttribute('src');img.classList.add('hidden')}
}

const {data:{session}}=await supabase.auth.getSession();
if(session)await init(session.user);

supabase.auth.onAuthStateChange((_event,session)=>{
  if(session&&!currentUser)init(session.user);
});
const loginTab=document.getElementById('loginTab'),signupTab=document.getElementById('signupTab'),loginForm=document.getElementById('loginForm'),signupForm=document.getElementById('signupForm'),msg=document.getElementById('authMessage');
function show(type){loginForm?.classList.toggle('hidden-form',type!=='login');signupForm?.classList.toggle('hidden-form',type!=='signup');loginTab?.classList.toggle('active',type==='login');signupTab?.classList.toggle('active',type==='signup');if(msg)msg.textContent='';}
loginTab?.addEventListener('click',()=>show('login'));signupTab?.addEventListener('click',()=>show('signup'));
function message(t,error=true){if(msg){msg.textContent=t;msg.className='auth-message '+(error?'error':'success')}}
document.getElementById('loginSubmit')?.addEventListener('click',()=>message('سيتم ربط تسجيل الدخول الحقيقي بقاعدة البيانات في الخطوة التالية.'));
document.getElementById('signupSubmit')?.addEventListener('click',()=>message('سيتم ربط إنشاء الحساب الحقيقي بقاعدة البيانات في الخطوة التالية.'));
document.getElementById('guestLink')?.addEventListener('click',()=>{location.href='home.html'});
if(!document.getElementById('loginTab')){document.querySelectorAll('.view-profile').forEach(b=>b.addEventListener('click',()=>{}));}
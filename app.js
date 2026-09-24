function openBox(type){
  document.getElementById('box').classList.remove('hidden');
  document.getElementById('login').classList.toggle('hidden',type!=='login');
  document.getElementById('signup').classList.toggle('hidden',type!=='signup');
  document.getElementById('lt').style.background=type==='login'?'#dcefe7':'#edf5f1';
  document.getElementById('st').style.background=type==='signup'?'#dcefe7':'#edf5f1';
}

const imageInput=document.getElementById('profileImage');
const preview=document.getElementById('imagePreview');

imageInput.addEventListener('change',()=>{
  const file=imageInput.files[0];
  if(!file){preview.classList.add('hidden');preview.innerHTML='';return;}
  if(!file.type.startsWith('image/')){alert('يرجى اختيار صورة فقط');imageInput.value='';return;}
  const reader=new FileReader();
  reader.onload=()=>{preview.innerHTML='<img src="'+reader.result+'" alt="معاينة صورة البروفايل">';preview.classList.remove('hidden');};
  reader.readAsDataURL(file);
});

document.querySelectorAll('form').forEach(form=>{
  form.addEventListener('submit',e=>{
    e.preventDefault();
    if(form.id==='signup'){
      const password=form.elements.password.value;
      if(password.length<6){alert('كلمة المرور يجب أن تكون 6 أحرف على الأقل');return;}
      document.getElementById('formMessage').textContent='تم التحقق من بيانات التسجيل. سيتم ربطها بقاعدة البيانات في الخطوة التالية.';
    }else{
      document.getElementById('formMessage').textContent='سيتم ربط تسجيل الدخول بقاعدة البيانات في الخطوة التالية.';
    }
  });
});
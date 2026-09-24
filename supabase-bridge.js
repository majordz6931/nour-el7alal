/* Nour El7alal - Supabase production bridge */
(() => {
  const SB_URL = "https://fnkvlmrzzxptncrqpyyz.supabase.co";
  const SB_KEY = "sb_publishable_hwffg3R4YzXTMnDu8-ZMDQ_1NuLnAfY";
  const sb = window.supabase.createClient(SB_URL, SB_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  window.NOUR_SUPABASE = sb;
  const edge = (name) => SB_URL + "/functions/v1/" + name;

  const safeErr = e => e?.message || "حدث خطأ في الاتصال";
  const role = () => currentUser?.role === "admin";

  function mapProfile(p, likesCount=0) {
    return {
      id:p.id, username:p.username, role:(p.username||"").toLowerCase()==="admin" ? "admin" : "user",
      gender:p.gender==="female"?"أنثى":"ذكر", dob:p.date_of_birth||"", wilaya:p.wilaya||"",
      bio:p.bio||"لا توجد نبذة", photo:p.avatar_url||"", online:!!p.online, banned:!!p.banned,
      joinDate:p.created_at ? new Date(p.created_at).toLocaleDateString("ar-DZ") : "",
      hearts:likesCount, views:p.views||0, is_visible:p.is_visible!==false
    };
  }
  const keyOf=(a,b)=>[a,b].sort().join("_");
  function timeOf(d){const n=new Date(d);return n.toLocaleTimeString("ar-DZ",{hour:"2-digit",minute:"2-digit",hour12:false});}

  async function cleanupExpiredStories(){
    if(!currentUser?.id) return;
    try{
      await sb.from("stories").delete().eq("user_id",currentUser.id).lt("expires_at",new Date().toISOString());
    }catch(e){console.error("Story cleanup:",e);}
  }

  async function loadData() {
    if (!currentUser) return;
    // لا ننتظر تنظيف القصص المنتهية أثناء الدخول؛ هذا طلب إضافي لا يجب أن يوقف فتح الموقع.
    cleanupExpiredStories().catch(()=>{});
    const [{data:ps,error:pe},{data:ls,error:le},{data:ms,error:me},{data:rs,error:re},{data:stories,error:se},{data:anns,error:ae}] = await Promise.all([
      sb.from("profiles").select("*").eq("is_visible",true),
      sb.from("likes").select("liker_id,liked_id"),
      role() ? sb.from("messages").select("*").order("created_at",{ascending:true}) : sb.from("messages").select("*").or("sender_id.eq."+currentUser.id+",receiver_id.eq."+currentUser.id).order("created_at",{ascending:true}),
      sb.from("reactions").select("*"),
      sb.from("stories").select("*").gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false}),
      sb.from("announcements").select("*").order("created_at",{ascending:false})
    ]);
    if(pe) throw pe;
    DB.users=(ps||[]).map(p=>mapProfile(p));
    const me=(ps||[]).find(p=>p.id===currentUser.id);
    if(me){
      const savedRole=currentUser.role;
      currentUser=mapProfile(me);
      if(savedRole==="admin") currentUser.role="admin";
    }
    const countMap={}; (ls||[]).forEach(x=>{countMap[x.liked_id]=(countMap[x.liked_id]||0)+1;});
    DB.users.forEach(u=>u.hearts=countMap[u.id]||0);
    DB.likes={}; (ls||[]).forEach(x=>{if(!DB.likes[x.liker_id])DB.likes[x.liker_id]=new Set();DB.likes[x.liker_id].add(x.liked_id);});
    DB.messages={};
    for(const m of (ms||[])){
      const k=keyOf(m.sender_id,m.receiver_id);
      if(!DB.messages[k])DB.messages[k]=[];
      let url=m.media_url||"";
      if(url && (m.message_type==="image"||m.message_type==="voice")){
        const {data}=await sb.storage.from("chat-media").createSignedUrl(url,3600);
        url=data?.signedUrl||"";
      }
      DB.messages[k].push({id:"m"+m.id,dbId:m.id,from:m.sender_id,to:m.receiver_id,type:m.message_type,text:m.content||"",url,dur:m.duration_seconds?("0:"+String(m.duration_seconds).padStart(2,"0")):"0:00",time:timeOf(m.created_at),read:!!m.read_at});
    }
    DB.reactions={};
    (rs||[]).forEach(r=>{if(!DB.reactions["m"+r.message_id])DB.reactions["m"+r.message_id]={};DB.reactions["m"+r.message_id][r.emoji]=(DB.reactions["m"+r.message_id][r.emoji]||0)+1;});
    window.NOUR_STORIES=stories||[];
    DB.announcements=anns||[];
    if(se||ae) renderStories();
  }

  async function setPresence(online) {
    if(!currentUser?.id || role()) return;
    await sb.from("profiles").update({online,last_seen:new Date().toISOString()}).eq("id",currentUser.id);
  }

function usernameEmail(username){return "u_"+Array.from(new TextEncoder().encode(username.toLowerCase()),x=>x.toString(16).padStart(2,"0")).join("")+"@nour-el7alal.com";}
  async function usernameAuth(action, body) {
    const r=await fetch(edge("username-auth"),{
      method:"POST",headers:{"Content-Type":"application/json","apikey":SB_KEY},
      body:JSON.stringify({action,...body})
    });
    const data=await r.json();
    if(!r.ok) throw new Error(data.error||"تعذر تسجيل الدخول");
    if(data.session) {
      const {error}=await sb.auth.setSession({access_token:data.session.access_token,refresh_token:data.session.refresh_token});
      if(error) throw error;
      try{localStorage.setItem("nour_auth_session",JSON.stringify(data.session));}catch(_){}
    }
    return data;
  }

  async function uploadFile(bucket, userId, file, prefix="file") {
    const ext=(file.name.split(".").pop()||"bin").toLowerCase().replace(/[^a-z0-9]/g,"");
    const path=userId+"/"+prefix+"-"+crypto.randomUUID()+"."+ext;
    const {error}=await sb.storage.from(bucket).upload(path,file,{upsert:false,contentType:file.type||"application/octet-stream"});
    if(error) throw error;
    return path;
  }

  async function callAdmin(action, extra={}) {
    const {data:{session}}=await sb.auth.getSession();
    if(!session) throw new Error("انتهت الجلسة");
    const r=await fetch(edge("admin-actions"),{
      method:"POST",headers:{"Content-Type":"application/json","apikey":SB_KEY,"Authorization":"Bearer "+session.access_token},
      body:JSON.stringify({action,...extra})
    });
    const data=await r.json(); if(!r.ok) throw new Error(data.error||"فشل طلب المدير"); return data;
  }

  async function doLoginReal(ev){
    ev.preventDefault();
    try{
      const u=document.getElementById("l-user").value.trim(), p=document.getElementById("l-pass").value;
      const data=await usernameAuth("login",{username:u,password:p});
      const {data:pr,error}=await sb.from("profiles").select("*").eq("id",data.user.id).single();
      if(error) throw error;
      if(pr.banned){await sb.auth.signOut();showToast("🚫 حسابك محظور — تواصل مع الإدارة");return;}
      currentUser=mapProfile(pr);
      currentUser.role=data.user?.app_metadata?.role==="admin" ? "admin" : currentUser.role;
      if(currentUser.role==="admin"){await setupRealtime();openAdmin();}
      else{openApp();Promise.allSettled([loadData(),setPresence(true),setupRealtime()]).then(()=>{renderProfiles();renderConvList();updateProfilePage();renderStoriesReal();updateOnlineCount();});}
    }catch(e){showToast("❌ "+safeErr(e));}
  }
  async function doRegisterReal(ev){
    ev.preventDefault();
    try{
      const u=document.getElementById("r-user").value.trim(), p=document.getElementById("r-pass").value;
      const rawGender=document.getElementById("r-gender").value; const g=rawGender==="ذكر"||rawGender==="male"?"male":"female";
      const d=document.getElementById("r-dob").value, w=document.getElementById("r-wilaya").value, b=document.getElementById("r-bio").value.trim();
      const file=document.getElementById("photo-inp")?.files?.[0]||null;
      if(!w){showToast("⚠️ اختر الولاية");return;}
      if(calcAge(d)<18){showToast("⚠️ يجب أن يكون عمرك 18 سنة على الأقل");return;}
      const data=await usernameAuth("signup",{username:u,password:p,date_of_birth:d,wilaya:w,gender:g,seeking:g==="male"?"female":"male"});
      currentUser=mapProfile({id:data.user.id,username:u,date_of_birth:d,wilaya:w,gender:g,bio:b,created_at:new Date().toISOString()});
      if(file){
        const path=await uploadFile("avatars",currentUser.id,file,"avatar");
        const {data:pub}=sb.storage.from("avatars").getPublicUrl(path);
        await sb.from("profiles").update({avatar_url:pub.publicUrl,bio:b||"لا توجد نبذة"}).eq("id",currentUser.id);
        currentUser.photo=pub.publicUrl; currentUser.bio=b||"لا توجد نبذة";
      }else if(b){await sb.from("profiles").update({bio:b}).eq("id",currentUser.id);}
      openApp();
      Promise.allSettled([loadData(),setPresence(true),setupRealtime()]).then(()=>{renderProfiles();renderConvList();updateProfilePage();renderStoriesReal();updateOnlineCount();});
    }catch(e){showToast("❌ "+safeErr(e));}
  }
  async function logoutReal(){
    try{await setPresence(false);await sb.auth.signOut();}catch(_){}
    currentUser=null;currentChatUser=null;window.__nourChatSig='';
    if(realtimeChannel){try{await sb.removeChannel(realtimeChannel);}catch(_){} realtimeChannel=null;}
    document.getElementById("screen-app").classList.remove("active");
    document.getElementById("screen-admin").classList.remove("active");
    document.getElementById("screen-app").style.display="none";
    document.getElementById("screen-auth").style.display="flex";
    showToast("👋 تم تسجيل الخروج بأمان");
  }

  async function saveMyProfileReal(){
    if(!currentUser) return;
    try{
      const bio=document.getElementById("edit-bio").value.trim();
      const file=document.getElementById("edit-photo-inp")?.files?.[0]||null;
      const patch={bio};
      if(file){
        const path=await uploadFile("avatars",currentUser.id,file,"avatar");
        patch.avatar_url=sb.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      }
      const {data,error}=await sb.from("profiles").update(patch).eq("id",currentUser.id).select().single();
      if(error)throw error;
      currentUser=mapProfile(data);
      await loadData();updateProfilePage();renderProfiles();showToast("✅ تم حفظ الملف الشخصي");
    }catch(e){showToast("❌ "+safeErr(e));}
  }

  async function toggleHeartReal(ev,uid){
    ev?.stopPropagation?.(); if(!currentUser||role()||uid===currentUser.id) return;
    const liked=(DB.likes[currentUser.id]||new Set()).has(uid);
    try{
      let error;
      if(liked){
        ({error}=await sb.from("likes").delete().eq("liker_id",currentUser.id).eq("liked_id",uid));
      }else{
        ({error}=await sb.from("likes").insert({liker_id:currentUser.id,liked_id:uid}));
      }
      if(error) throw error;
      await loadData();
      renderProfiles();updateStats();
      showToast(liked?"💔 تم إلغاء القلب":"❤️ تم إرسال القلب");
    }catch(e){showToast("❌ "+safeErr(e));}
  }

  async function heartFromModalReal(){
    if(!modalUser||modalUser.role==="admin")return;
    await toggleHeartReal({stopPropagation(){}},modalUser.id);
    document.getElementById("profile-modal").classList.remove("open");
  }

  async function submitReportReal(){
    if(!reportTarget)return;
    try{
      const {error}=await sb.from("reports").insert({
        reporter_id:currentUser.id,reported_id:reportTarget.id,
        reason:document.getElementById("report-reason").value,
        details:document.getElementById("report-details").value.trim()
      });
      if(error)throw error;
      document.getElementById("report-modal").classList.remove("open");
      document.getElementById("report-details").value="";
      showToast("🚨 تم إرسال البلاغ للإدارة");
    }catch(e){showToast("❌ "+safeErr(e));}
  }

  async function openChatReal(u){
    currentChatUser=u;
    const isAdmin=u.role==="admin";
    const av=document.getElementById("cw-av");
    av.className="chat-hdr-av"+(isAdmin?" admin-av-hdr":"");
    if(u.photo)av.innerHTML='<img src="'+u.photo+'" style="width:100%;height:100%;border-radius:50%;object-fit:cover">';
    else av.textContent=isAdmin?"👑":(u.gender==="أنثى"?"👩":"👨");
    document.getElementById("cw-name").innerHTML=isAdmin?'<span class="admin-name">👑 ADMIN</span>':u.username;
    document.getElementById("cw-status").innerHTML=isAdmin?'<span style="color:var(--admin-color)">🛡️ مدير الموقع</span>':(u.online?'<span style="color:var(--green2)">🟢 متصل الآن</span>':'<span style="color:var(--muted)">⚫ غير متصل</span>');
    document.getElementById("chat-report-btn").style.display=isAdmin?"none":"flex";
    const key=keyOf(currentUser.id,u.id), msgs=DB.messages[key]||[];
    const unread=msgs.filter(m=>m.from===u.id&&!m.read&&m.dbId);
    if(unread.length) await sb.from("messages").update({read_at:new Date().toISOString()}).in("id",unread.map(m=>m.dbId));
    unread.forEach(m=>m.read=true);
    renderChatMsgs();renderConvList();
    document.getElementById("chat-window").classList.add("open");
    document.getElementById("emoji-panel").classList.add("hidden");emojiOpen=false;
  }

  async function sendMsgReal(){
    const inp=document.getElementById("msg-inp"), text=inp.value.trim();
    if(!text||!currentChatUser)return;
    try{
      const {error}=await sb.from("messages").insert({sender_id:currentUser.id,receiver_id:currentChatUser.id,content:text,message_type:"text"});
      if(error)throw error;
      inp.value="";document.getElementById("emoji-panel").classList.add("hidden");emojiOpen=false;
      await loadData();renderChatMsgs();renderConvList();
    }catch(e){showToast("❌ "+safeErr(e));}
  }

  async function sendImageReal(inp){
    const f=inp.files?.[0];if(!f||!currentChatUser)return;
    try{
      if(f.size>8*1024*1024)throw new Error("الصورة أكبر من 8MB");
      const path=await uploadFile("chat-media",currentUser.id,f,"img");
      const {error}=await sb.from("messages").insert({sender_id:currentUser.id,receiver_id:currentChatUser.id,content:"[صورة]",message_type:"image",media_url:path});
      if(error)throw error;inp.value="";await loadData();renderChatMsgs();renderConvList();showToast("🖼️ تم إرسال الصورة");
    }catch(e){showToast("❌ "+safeErr(e));}
  }

  let recStream=null, recBlob=null;
  async function toggleRecReal(){
    if(isRecording){stopRecReal();return;}
    try{
      recStream=await navigator.mediaDevices.getUserMedia({audio:true});
      mediaRecorder=new MediaRecorder(recStream);audioChunks=[];
      mediaRecorder.ondataavailable=e=>audioChunks.push(e.data);mediaRecorder.start();isRecording=true;recSeconds=0;
      document.getElementById("rec-bar").classList.remove("hidden");document.getElementById("mic-btn").classList.add("mic-rec");
      recInterval=setInterval(()=>{recSeconds++;const m=Math.floor(recSeconds/60),s=recSeconds%60;document.getElementById("rec-timer").textContent=m+":"+String(s).padStart(2,"0");},1000);
    }catch(e){showToast("❌ لا يمكن الوصول إلى الميكروفون");}
  }
  async function stopRecReal(){
    if(!mediaRecorder)return;
    mediaRecorder.onstop=async()=>{
      try{
        const blob=new Blob(audioChunks,{type:"audio/webm"});
        const file=new File([blob],"voice.webm",{type:"audio/webm"});
        const path=await uploadFile("chat-media",currentUser.id,file,"voice");
        const {error}=await sb.from("messages").insert({sender_id:currentUser.id,receiver_id:currentChatUser.id,content:"[صوتية]",message_type:"voice",media_url:path,duration_seconds:recSeconds});
        if(error)throw error;await loadData();renderChatMsgs();renderConvList();showToast("🎙️ تم إرسال الرسالة الصوتية");
      }catch(e){showToast("❌ "+safeErr(e));}
      cleanupRec();
    };
    mediaRecorder.stop();recStream?.getTracks().forEach(t=>t.stop());
  }
  function cancelRecReal(){recStream?.getTracks().forEach(t=>t.stop());if(mediaRecorder&&mediaRecorder.state!=="inactive")mediaRecorder.stop();cleanupRec();}
  function cleanupRecReal(){isRecording=false;clearInterval(recInterval);recSeconds=0;mediaRecorder=null;audioChunks=[];document.getElementById("rec-bar").classList.add("hidden");document.getElementById("mic-btn").classList.remove("mic-rec");document.getElementById("rec-timer").textContent="0:00";}

  async function addReactionReal(msgId,em){
    const dbId=String(msgId).replace(/^m/,""); if(!dbId)return;
    try{
      await sb.from("reactions").insert({message_id:Number(dbId),user_id:currentUser.id,emoji:em});
      await loadData();renderChatMsgs();
    }catch(e){showToast("❌ "+safeErr(e));}
  }

  async function addStoryReal(ev){
    const file=ev?.target?.files?.[0];
    if(!file||!currentUser||role()) return;
    try{
      if(file.size>25*1024*1024) throw new Error("القصة أكبر من 25MB");
      if(!file.type.startsWith("image/")&&!file.type.startsWith("video/")) throw new Error("اختر صورة أو فيديو");
      await cleanupExpiredStories();
      const caption=(prompt("اكتب وصف القصة (اختياري):")||"").trim();
      const path=await uploadFile("stories",currentUser.id,file,"story");
      const expires=new Date(Date.now()+24*60*60*1000).toISOString();
      const {error}=await sb.from("stories").insert({user_id:currentUser.id,media_url:path,caption,expires_at:expires});
      if(error){await sb.storage.from("stories").remove([path]);throw error;}
      ev.target.value="";
      await loadData();
      renderStoriesReal();
      showToast("📸 تم نشر قصتك — ستختفي بعد 24 ساعة");
      setTimeout(async()=>{
        try{
          await sb.from("stories").delete().eq("user_id",currentUser.id).eq("media_url",path);
          await sb.storage.from("stories").remove([path]);
          await loadData();renderStoriesReal();
        }catch(e){console.error("Story expiry:",e);}
      },24*60*60*1000+3000);
    }catch(e){showToast("❌ "+safeErr(e));if(ev?.target)ev.target.value="";}
  }

  function renderStoriesReal(){
    const wrap=document.getElementById("stories-wrap");if(!wrap)return;wrap.innerHTML="";
    const add=document.createElement("div");add.className="story-item";
    add.innerHTML='<div class="story-ring story-add-ring"><div class="story-inner story-add-inner"><span style="font-size:1.5rem">➕</span></div></div><div class="story-name">قصتي</div>';
    add.onclick=()=>document.getElementById("story-file-inp")?.click();
    wrap.appendChild(add);
    (window.NOUR_STORIES||[]).forEach(s=>{
      const u=DB.users.find(x=>x.id===s.user_id);if(!u)return;
      const item=document.createElement("div");item.className="story-item";
      item.innerHTML='<div class="story-ring"><div class="story-inner">'+(u.photo?'<img src="'+u.photo+'">':(u.gender==="أنثى"?"👩":"👨"))+'</div></div><div class="story-name">'+u.username+'</div>';
      item.onclick=()=>openStory({media_url:s.media_url,caption:s.caption||"",created_at:s.created_at,emoji:"🌿",bg:"linear-gradient(135deg,#0a2a0a,#1a4a1a)"},u);
      wrap.appendChild(item);
    });
  }

  async function adminTabReal(el,section){
    document.querySelectorAll(".a-tab").forEach(t=>t.classList.remove("active"));
    document.querySelectorAll(".admin-section").forEach(s=>s.classList.remove("active"));
    el.classList.add("active");document.getElementById("a-"+section).classList.add("active");
    const r={overview:renderAdminOverviewReal,users:renderAdminUsersReal,credentials:renderAdminCredsSafe,chat:renderAdminChat,messages:renderAdminMsgs,reports:renderAdminReportsReal,banned:renderAdminBannedReal,announce:renderAnnounceHistory}[section];
    if(r)r();
  }
  function renderAdminCredsSafe(){
    const el=document.getElementById("admin-creds-list");
    el.innerHTML='<div class="glass" style="padding:1rem;border-color:rgba(245,158,11,.3)"><b style="color:var(--gold2)">🔐 حماية كلمات السر</b><p style="color:var(--muted);margin-top:.5rem;font-size:.82rem">كلمات السر لا تُخزّن أو تُعرض في لوحة المدير. تتم إدارتها بأمان بواسطة Supabase Auth.</p></div>';
  }
  function renderAdminOverviewReal(){
    const users=DB.users.filter(u=>u.role!=="admin");
    document.getElementById("a-total").textContent=users.length;
    document.getElementById("a-online-c").textContent=users.filter(u=>u.online).length;
    document.getElementById("a-rep-c").textContent="—";
    document.getElementById("a-ban-c").textContent=users.filter(u=>u.banned).length;
    renderAdminUsersReal();
  }
  function renderAdminUsersReal(query=""){
    const list=document.getElementById("admin-users-list");if(!list)return;list.innerHTML="";
    let users=DB.users.filter(u=>u.role!=="admin"&&(!query||u.username.toLowerCase().includes(query.toLowerCase())||u.wilaya.includes(query)));
    users.forEach(u=>{
      const d=document.createElement("div");d.className="uac";
      d.innerHTML='<div class="uac-hdr"><div class="uac-av">'+(u.photo?'<img src="'+u.photo+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">':(u.gender==="أنثى"?"👩":"👨"))+'</div><div class="uac-info"><div class="uac-name">'+u.username+(u.banned?'<span class="badge badge-red">محظور</span>':"")+'</div><div class="uac-sub">'+calcAge(u.dob)+" سنة • "+u.wilaya+" • "+(u.online?"🟢 متصل":"⚫ غير متصل")+'</div></div></div><div class="uac-actions"><button class="btn btn-sm btn-ghost" onclick="adminViewUser(\''+u.id+'\')">👁️ عرض</button>'+(u.banned?'<button class="btn btn-sm btn-gold" onclick="unbanUser(\''+u.id+'\')">✅ رفع الحظر</button>':'<button class="btn btn-sm btn-red" onclick="banUser(\''+u.id+'\')">🚫 حظر</button>')+'<button class="btn btn-sm btn-red" onclick="deleteUser(\''+u.id+'\')">🗑️ حذف</button></div>';
      list.appendChild(d);
    });
    if(!list.children.length)list.innerHTML='<div class="admin-empty">لا يوجد أعضاء</div>';
  }
  async function banUserReal(id){try{await callAdmin("ban",{user_id:id});await loadData();renderAdminUsersReal();renderAdminOverviewReal();renderAdminBannedReal();showToast("🚫 تم حظر العضو");}catch(e){showToast("❌ "+safeErr(e));}}
  async function unbanUserReal(id){try{await callAdmin("unban",{user_id:id});await loadData();renderAdminUsersReal();renderAdminBannedReal();showToast("✅ تم رفع الحظر");}catch(e){showToast("❌ "+safeErr(e));}}
  async function deleteUserReal(id){if(!confirm("هل تريد حذف هذا الحساب نهائياً؟"))return;try{await callAdmin("delete_user",{user_id:id});await loadData();renderAdminUsersReal();renderAdminOverviewReal();showToast("🗑️ تم حذف الحساب");}catch(e){showToast("❌ "+safeErr(e));}}
  function renderAdminBannedReal(){
    const list=document.getElementById("admin-banned-list");list.innerHTML="";
    const users=DB.users.filter(u=>u.banned);
    if(!users.length){list.innerHTML='<div class="admin-empty">لا توجد حسابات محظورة 👍</div>';return;}
    users.forEach(u=>{const d=document.createElement("div");d.className="uac";d.innerHTML='<div class="uac-hdr"><div class="uac-av">'+(u.gender==="أنثى"?"👩":"👨")+'</div><div class="uac-info"><div class="uac-name">'+u.username+' <span class="badge badge-red">محظور</span></div></div></div><div class="uac-actions"><button class="btn btn-sm btn-gold" onclick="unbanUser(\''+u.id+'\')">✅ رفع الحظر</button></div>';list.appendChild(d);});
  }
  async function sendAnnounceReal(){
    const txt=document.getElementById("announce-text").value.trim();if(!txt)return showToast("⚠️ اكتب نص الإعلان");
    try{await callAdmin("announcement",{text:txt});document.getElementById("announce-text").value="";showToast("📢 تم حفظ الإعلان");await loadData();renderAnnounceHistory();}catch(e){showToast("❌ "+safeErr(e));}
  }
  function renderAnnounceHistoryReal(){
    const h=document.getElementById("announce-history");h.innerHTML=(DB.announcements||[]).map(a=>'<div class="glass" style="padding:.75rem;margin-bottom:.5rem"><div>'+a.text+'</div><div style="color:var(--muted);font-size:.7rem">'+timeOf(a.created_at)+'</div></div>').join("");
  }
  async function openAppReal(){
    document.getElementById("screen-auth").style.display="none";document.getElementById("screen-admin").classList.remove("active");document.getElementById("screen-app").classList.add("active");
    renderProfiles();renderConvList();updateProfilePage();renderStoriesReal();updateOnlineCount();showToast("🎉 أهلاً بك "+currentUser.username+"!");
  }
  async function openAdminReal(){
    document.getElementById("screen-auth").style.display="none";document.getElementById("screen-app").classList.remove("active");document.getElementById("screen-admin").classList.add("active");
    await loadData();renderAdminOverviewReal();renderAdminUsersReal();renderAdminCredsSafe();renderAdminChat();renderAdminMsgs();renderAdminReportsReal();renderAdminBannedReal();renderAnnounceHistoryReal();showToast("🛡️ لوحة المدير");
  }
  async function renderAdminReportsReal(){
    const list=document.getElementById("admin-reports-list");list.innerHTML="";
    const {data,error}=await sb.from("reports").select("*,reporter:profiles!reports_reporter_id_fkey(username),reported:profiles!reports_reported_id_fkey(username)").order("created_at",{ascending:false});
    if(error){list.innerHTML='<div class="admin-empty">تعذر تحميل البلاغات</div>';return;}
    if(!data?.length){list.innerHTML='<div class="admin-empty">لا توجد بلاغات 👍</div>';return;}
    data.forEach(r=>{const d=document.createElement("div");d.className="rcard";d.innerHTML='<div class="rcard-hdr"><div><div class="rcard-who">🚨 '+(r.reported?.username||r.reported_id)+'</div><div style="color:var(--muted);font-size:.72rem">'+timeOf(r.created_at)+'</div></div><span class="badge badge-red">'+r.status+'</span></div><div style="font-size:.82rem"><b>السبب:</b> '+r.reason+'</div><div style="color:var(--muted);font-size:.78rem">'+(r.details||"")+'</div><div style="font-size:.75rem;color:var(--muted)">المبلّغ: '+(r.reporter?.username||r.reporter_id)+'</div><div class="rcard-actions"><button class="btn btn-sm btn-red" onclick="banUser(\''+r.reported_id+'\')">🚫 حظر</button><button class="btn btn-sm btn-gold" onclick="resolveReport(\''+r.id+'\')">✅ معالجة</button></div>';list.appendChild(d);});
  }
  async function resolveReportReal(id){const {error}=await sb.from("reports").update({status:"resolved"}).eq("id",id);if(error)showToast("❌ "+safeErr(error));else{showToast("✅ تمت المعالجة");renderAdminReportsReal();}}
  function renderAdminChatReal(){renderAdminChat();}
  let bootDone=false;
  async function restoreSession(session){
    if(bootDone||!session?.user?.id)return false;
    try{
      const {data:p,error}=await sb.from("profiles").select("*").eq("id",session.user.id).maybeSingle();
      if(error||!p){console.warn("Supabase profile restore:",error||"profile not found");return false;}
      currentUser=mapProfile(p);
      if(p.banned){await sb.auth.signOut();return false;}
      currentUser.role=session.user.app_metadata?.role==="admin"?"admin":currentUser.role;
      bootDone=true;
      if(currentUser.role==="admin"){
        await setupRealtime(); openAdmin();
      }else{
        openApp();
        Promise.allSettled([loadData(),setPresence(true),setupRealtime()]).then(()=>{
          renderProfiles();renderConvList();updateProfilePage();renderStoriesReal();updateOnlineCount();
        });
      }
      return true;
    }catch(e){console.error("Supabase restore:",e);return false;}
  }

  async function boot(){
    for(let attempt=0;attempt<10&&!bootDone;attempt++){
      try{
        const {data:{session}}=await sb.auth.getSession();
        if(await restoreSession(session))return;
        try{
          const raw=localStorage.getItem("nour_auth_session");
          if(raw){
            const saved=JSON.parse(raw);
            if(saved?.access_token&&saved?.refresh_token){
              const s=await sb.auth.setSession({access_token:saved.access_token,refresh_token:saved.refresh_token});
              if(s.data?.session&&await restoreSession(s.data.session))return;
            }
          }
        }catch(e){console.warn("Saved session restore:",e);}
      }catch(e){console.error("Supabase boot:",e);}
      await new Promise(r=>setTimeout(r,300+attempt*100));
    }
    console.warn("Supabase boot: no persisted session found");
  }

  sb.auth.onAuthStateChange((event,session)=>{
    if(event==="INITIAL_SESSION"||event==="SIGNED_IN"){
      setTimeout(()=>restoreSession(session),0);
    }
  });


  window.doLogin=doLoginReal; window.doRegister=doRegisterReal; window.logout=logoutReal;
  window.openApp=openAppReal; window.openAdmin=openAdminReal; window.saveMyProfile=saveMyProfileReal;
  window.toggleHeart=toggleHeartReal; window.heartFromModal=heartFromModalReal; window.submitReport=submitReportReal;
  window.openChat=openChatReal; window.sendMsg=sendMsgReal; window.sendImage=sendImageReal;
  window.toggleRec=toggleRecReal; window.stopRec=stopRecReal; window.cancelRec=cancelRecReal; window.cleanupRec=cleanupRecReal;
  window.addReaction=addReactionReal; window.renderStories=renderStoriesReal; window.addStory=addStoryReal;
  window.adminTab=adminTabReal; window.banUser=banUserReal; window.unbanUser=unbanUserReal; window.deleteUser=deleteUserReal;
  window.sendAnnounce=sendAnnounceReal; window.renderAdminReports=renderAdminReportsReal; window.resolveReport=resolveReportReal;
  window.renderAdminCreds=renderAdminCredsSafe;

  // Count profile visits in Supabase whenever a member opens another member's profile.
  const legacyOpenModal=window.openModal;
  window.openModal=async function(u){
    if(u && currentUser?.id && u.id!==currentUser.id && u.role!=="admin"){
      try{
        const {data,error}=await sb.rpc("increment_profile_view",{target_user_id:u.id});
        if(error) throw error;
        if(Number.isFinite(Number(data))){
          u.views=Number(data);
          const cached=DB.users.find(x=>x.id===u.id);
          if(cached) cached.views=Number(data);
        }
      }catch(e){
        console.error("Profile view:",e);
      }
    }
    return legacyOpenModal(u);
  };

  const legacyOpenStory=window.openStory;
  window.openStory=function(s,u){
    if(!s?.media_url) return legacyOpenStory(s,u);
    const sv=document.getElementById("story-viewer");
    document.getElementById("sv-name").textContent=u?.username||"";
    document.getElementById("sv-time").textContent=s.created_at?new Date(s.created_at).toLocaleTimeString("ar-DZ",{hour:"2-digit",minute:"2-digit"}):"";
    const avEl=document.getElementById("sv-av");
    avEl.innerHTML=u?.photo?'<img src="'+u.photo+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">':(u?.gender==="أنثى"?"👩":"👨");
    const body=document.getElementById("sv-body");
    const url=sb.storage.from("stories").getPublicUrl(s.media_url).data.publicUrl;
    body.innerHTML=s.media_url.match(/\.(mp4|webm|mov|m4v)$/i)
      ? '<video src="'+url+'" controls autoplay playsinline style="width:100%;max-height:520px;object-fit:contain"></video>'
      : '<img src="'+url+'" alt="" style="width:100%;max-height:520px;object-fit:contain">';
    body.style.background="#000";
    document.getElementById("sv-caption").textContent=s.caption||"";
    const prog=document.getElementById("sv-progress");prog.innerHTML='<div class="sv-bar"><div class="sv-bar-fill" id="sv-fill"></div></div>';
    sv.classList.add("open");
    clearInterval(sv._iv);
    let w=0;sv._iv=setInterval(()=>{w+=2;const fill=document.getElementById("sv-fill");if(fill)fill.style.width=w+"%";if(w>=100){clearInterval(sv._iv);sv.classList.remove("open");}},100);
  };

  let realtimeChannel=null;
  async function setupRealtime(){
    if(realtimeChannel){
      try{await sb.removeChannel(realtimeChannel);}catch(_){}
      realtimeChannel=null;
    }
    if(!currentUser?.id)return;
    realtimeChannel=sb.channel("nour-realtime-"+currentUser.id)
      .on("postgres_changes",{event:"*",schema:"public",table:"messages"},async()=>{
        if(!currentUser)return;
        await loadData();
        if(currentChatUser){renderChatMsgs();renderConvList();}
      })
      .on("postgres_changes",{event:"*",schema:"public",table:"likes"},async()=>{
        if(currentUser){await loadData();renderProfiles();updateStats();}
      })
      .on("postgres_changes",{event:"*",schema:"public",table:"reactions"},async()=>{
        if(currentUser){await loadData();if(currentChatUser)renderChatMsgs();}
      })
      .on("postgres_changes",{event:"*",schema:"public",table:"profiles"},async()=>{
        if(currentUser){await loadData();renderProfiles();updateOnlineCount();}
      })
      .subscribe((status,error)=>{
        if(status==="CHANNEL_ERROR")console.error("Realtime chat:",error);
      });
  }

  async function refreshOpenChat(){
    if(!currentUser?.id || !currentChatUser)return;
    try{
      const {data,error}=await sb.from("messages").select("*")
        .or("sender_id.eq."+currentUser.id+",receiver_id.eq."+currentUser.id)
        .order("created_at",{ascending:true});
      if(error)throw error;
      const chatSig=(data||[]).map(m=>[m.id,m.sender_id,m.receiver_id,m.content,m.message_type,m.media_url,m.duration_seconds,m.read_at,m.created_at].join("~")).join("|");
      if(chatSig===window.__nourChatSig)return;
      window.__nourChatSig=chatSig;
      DB.messages={};
      for(const m of (data||[])){
        const k=keyOf(m.sender_id,m.receiver_id);
        if(!DB.messages[k])DB.messages[k]=[];
        let url=m.media_url||"";
        if(url && (m.message_type==="image"||m.message_type==="voice")){
          const {data:signed}=await sb.storage.from("chat-media").createSignedUrl(url,3600);
          url=signed?.signedUrl||"";
        }
        DB.messages[k].push({id:"m"+m.id,dbId:m.id,from:m.sender_id,to:m.receiver_id,type:m.message_type,text:m.content||"",url,dur:m.duration_seconds?("0:"+String(m.duration_seconds).padStart(2,"0")):"0:00",time:timeOf(m.created_at),read:!!m.read_at});
      }
      renderChatMsgs();
      renderConvList();
    }catch(e){console.error("Chat refresh:",e);}
  }

  setInterval(()=>{if(currentUser&&!role())setPresence(true);},20000);
  setInterval(()=>{if(currentUser&&currentChatUser&&!document.hidden)refreshOpenChat();},2500);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&currentUser&&currentChatUser)refreshOpenChat();});
  boot();
})();
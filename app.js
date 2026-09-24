const SUPABASE_URL="https://fiqqkexapeivhvoigomv.supabase.co";
const SUPABASE_KEY="sb_publishable__K-3VfJgl21taaQVfgiXNA_o0AdTHU7";
const supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const wilayas=["أدرار","الشلف","الأغواط","أم البواقي","باتنة","بجاية","بسكرة","بشار","البليدة","البويرة","تمنراست","تبسة","تلمسان","تيارت","تيزي وزو","الجزائر","الجلفة","جيجل","سطيف","سعيدة","سكيكدة","سيدي بلعباس","عنابة","قالمة","قسنطينة","المدية","مستغانم","المسيلة","معسكر","ورقلة","وهران","البيض","إليزي","برج بوعريريج","بومرداس","الطارف","تندوف","تيسمسيلت","الوادي","خنشلة","سوق أهراس","تيبازة","ميلة","عين الدفلى","النعامة","عين تموشنت","غرداية","غليزان","تيميمون","برج باجي مختار","أولاد جلال","بني عباس","عين صالح","عين قزام","تقرت","جانت","المغير","المنيعة"];
const $=s=>document.querySelector(s);
const state={user:null,profile:null,selectedUser:null,messages:[],profiles:[],channel:null,notificationChannel:null,presenceChannel:null,unread:{},presenceTimer:null,blockedIds:new Set(),likedIds:new Set(),likedByIds:new Set(),mutualLikeIds:new Set()};
$("#wilaya").innerHTML='<option value="">اختر ولايتك</option>'+wilayas.map(x=>'<option>'+x+'</option>').join("");
document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tabs button").forEach(x=>x.classList.remove("active"));b.classList.add("active");const reg=b.dataset.tab==="register";$("#registerForm").hidden=!reg;$("#loginForm").hidden=reg;$("#authMsg").textContent=""});
function msg(t){$("#authMsg").textContent=t||""}
function internalEmail(username){const bytes=new TextEncoder().encode(username.trim().toLowerCase());return Array.from(bytes).map(b=>b.toString(16).padStart(2,"0")).join("")+"@nour-el7alal.com"}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
async function compressImage(file){const size=600;let source=null,url=null;try{if("createImageBitmap" in window){try{source=await createImageBitmap(file,{imageOrientation:"from-image"})}catch(e){source=null}}if(!source){url=URL.createObjectURL(file);source=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error("تعذر قراءة الصورة"));img.src=url})}const w=source.width||source.naturalWidth,h=source.height||source.naturalHeight;if(!w||!h)throw new Error("صورة غير صالحة");const scale=Math.min(size/w,size/h,1),c=document.createElement("canvas");c.width=Math.max(1,Math.round(w*scale));c.height=Math.max(1,Math.round(h*scale));const ctx=c.getContext("2d",{alpha:false});if(!ctx)throw new Error("تعذر تجهيز الصورة");ctx.fillStyle="#ffffff";ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(source,0,0,c.width,c.height);const blob=await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error("تعذر ضغط الصورة")),"image/jpeg",.85));if(url)URL.revokeObjectURL(url);if(source.close)source.close();return blob}catch(err){if(url)URL.revokeObjectURL(url);try{if(source?.close)source.close()}catch(e){}throw err}}
const photoInput=$("#profilePhoto"),photoPreview=$("#profilePreview");
photoInput?.addEventListener("change",()=>{const f=photoInput.files[0];if(!f)return;if(f.size>5*1024*1024){photoInput.value="";photoPreview.hidden=true;msg("حجم الصورة لازم يكون أقل من 5 ميغابايت.");return}photoPreview.src=URL.createObjectURL(f);photoPreview.hidden=false;msg("")});
async function uploadAvatar(userId,file,oldPath=null){if(!file||!/^image\/(jpeg|png|webp)$/i.test(file.type))throw new Error("اختر صورة JPG أو PNG أو WEBP.");if(file.size>5*1024*1024)throw new Error("حجم الصورة يجب أن يكون أقل من 5 ميغابايت.");const ext=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg";const path=userId+"/avatar-"+Date.now()+"."+ext;const bucket=supabaseClient.storage.from("avatars");const {error}=await bucket.upload(path,file,{contentType:file.type,cacheControl:"3600",upsert:false});if(error)throw error;if(oldPath&&oldPath!==path){const {error:removeError}=await bucket.remove([oldPath]);if(removeError){await bucket.remove([path]);throw removeError}}const {data}=bucket.getPublicUrl(path);return {path,url:data.publicUrl+"?v="+Date.now()}}
async function setPresence(online){if(!state.user?.id)return;const {error}=await supabaseClient.from("profiles").update({is_online:online,last_seen:new Date().toISOString()}).eq("id",state.user.id);if(error)console.error("presence:",error)}
async function startPresence(){if(!state.user?.id)return;await setPresence(true);if(state.presenceChannel)supabaseClient.removeChannel(state.presenceChannel);state.presenceChannel=supabaseClient.channel("profiles-presence").on("postgres_changes",{event:"UPDATE",schema:"public",table:"profiles"},payload=>{const p=payload.new;if(!p?.id||String(p.id)===String(state.user?.id))return;const i=state.profiles.findIndex(x=>String(x.id)===String(p.id));if(i>=0){const wasOnline=!!state.profiles[i].is_online&&state.profiles[i].last_seen&&Date.now()-new Date(state.profiles[i].last_seen).getTime()<=10000;const next={...state.profiles[i],...p};const isOnline=!!next.is_online&&next.last_seen&&Date.now()-new Date(next.last_seen).getTime()<=10000;state.profiles[i]=next;if(wasOnline!==isOnline)renderUsers()}else if(p.is_online===true){loadProfiles()}}).subscribe();if(state.presenceTimer)clearInterval(state.presenceTimer);state.presenceTimer=setInterval(()=>setPresence(true),2000)}
async function stopPresence(){if(state.presenceTimer){clearInterval(state.presenceTimer);state.presenceTimer=null}await setPresence(false)}
async function refreshLikes(){
 if(!state.user?.id)return;
 const {data,error}=await supabaseClient.from("profile_likes").select("id,user_id,target_id,created_at").or("user_id.eq."+state.user.id+",target_id.eq."+state.user.id);
 if(error){console.error("likes:",error);return}
 const rows=data||[];
 state.likedIds=new Set(rows.filter(x=>x.user_id===state.user.id).map(x=>x.target_id));
 state.likedByIds=new Set(rows.filter(x=>x.target_id===state.user.id).map(x=>x.user_id));
 state.mutualLikeIds=new Set([...state.likedIds].filter(id=>state.likedByIds.has(id)));
}
async function getLikePeople(ids){
 const clean=[...new Set(ids||[])].filter(id=>id&&id!==state.user.id);
 if(!clean.length)return [];
 const {data,error}=await supabaseClient.from("profiles").select("id,username,full_name,wilaya,age,avatar_url,avatar_path,is_online,last_seen,marital_status,profession,verified,likes_count").in("id",clean);
 if(error){console.error("like people:",error);return []}
 return (data||[]).map(p=>{if(p.avatar_path&&!p.avatar_url){const {data:pub}=supabaseClient.storage.from("avatars").getPublicUrl(p.avatar_path);p.avatar_url=pub?.publicUrl||null}return p});
}
async function showLikesPanel(){
 const panel=$("#communityPanel");panel.hidden=false;await refreshLikes();
 const mutual=[...state.mutualLikeIds],received=[...state.likedByIds].filter(id=>!state.mutualLikeIds.has(id)),sent=[...state.likedIds].filter(id=>!state.mutualLikeIds.has(id));
 const people=await getLikePeople([...new Set([...mutual,...received,...sent])]);const find=id=>people.find(p=>p.id===id);
 const card=(p,type)=>{
  const action=type==="mutual"?"💬 مراسلة":type==="received"?"💚 اهتمام متبادل":"❤️ تم الإعجاب";
  return '<article class="discover-card like-person-card"><div class="discover-avatar">'+(p.avatar_url?'<img src="'+escapeHtml(p.avatar_url)+'" alt="">':escapeHtml((p.username||"ن")[0]))+'</div><b>'+escapeHtml(p.username||"عضو")+(p.verified?" ✓":"")+'</b><small>'+escapeHtml((p.age||"")+" سنة • "+(p.wilaya||"الجزائر"))+'</small><small>'+escapeHtml(p.marital_status||"الحالة غير محددة")+'</small><div><button class="mini-action like-person-action" data-id="'+p.id+'" data-type="'+type+'">'+action+'</button></div></article>';
 };
 const grid=(ids,type)=>ids.map(id=>find(id)).filter(Boolean).map(p=>card(p,type)).join("")||'<div class="empty-search">لا توجد نتائج بعد.</div>';
 panel.innerHTML='<div class="panel-head"><h3>💚 الإعجابات والاهتمامات</h3><button id="closeLikes">×</button></div><div class="likes-summary"><span>❤️ أرسلت '+state.likedIds.size+'</span><span>💚 وصلتك '+state.likedByIds.size+'</span><span>🤝 متبادل '+state.mutualLikeIds.size+'</span></div><div class="likes-section"><h4>🤝 اهتمام متبادل</h4><div class="discover-grid">'+grid(mutual,"mutual")+'</div></div><div class="likes-section"><h4>💚 أشخاص مهتمون بك</h4><div class="discover-grid">'+grid(received,"received")+'</div></div><div class="likes-section"><h4>❤️ إعجاباتك</h4><div class="discover-grid">'+grid(sent,"sent")+'</div></div>';
 $("#closeLikes").onclick=closeCommunityPanel;
 document.querySelectorAll(".like-person-action").forEach(b=>b.onclick=async()=>{const id=b.dataset.id,type=b.dataset.type;if(type==="mutual"){closeCommunityPanel();await selectUser(id);return}await likeProfile(id)});
}
async function loadProfile(userId){const {data,error}=await supabaseClient.from("profiles").select("*").eq("id",userId).single();if(error)throw error;if(data?.avatar_path&&!data.avatar_url){const {data:pub}=supabaseClient.storage.from("avatars").getPublicUrl(data.avatar_path);data.avatar_url=pub?.publicUrl||null}state.profile=data;state.user={id:userId,...data}}
async function showChat(){
 if(!state.profile)return;
 $("#authView").hidden=true;$("#chatView").hidden=false;$("#siteBanner").hidden=true;
 startNotifications();
 $("#me").textContent="@"+state.profile.username+" · "+(state.profile.wilaya||"");
 $("#myAvatar").innerHTML=state.profile.avatar_url?'<img src="'+escapeHtml(state.profile.avatar_url)+'" alt="">':escapeHtml((state.profile.username||"ن")[0]);
 $("#message").disabled=true;$(".send-btn").disabled=true;
 const backMembers=$("#backMembers");
 if(backMembers)backMembers.onclick=()=>{state.selectedUser=null;$("#message").value="";$("#message").disabled=true;$(".send-btn").disabled=true;const roomHead=document.querySelector(".room-head");if(roomHead)roomHead.hidden=true;const messages=$("#messages");if(messages)messages.innerHTML="";renderUsers();document.querySelector(".chat-sidebar")?.classList.remove("mobile-hidden");document.querySelector(".room")?.classList.remove("mobile-active")};
 const roomHead=document.querySelector(".room-head");if(roomHead)roomHead.hidden=true;
 await loadProfiles();await refreshLikes();await startPresence();initChatUX();
 await initAdminAccess();
 if(!state.selectedUser&&state.profiles.length)await selectUser(state.profiles[0].id)
}
async function loadProfiles(){const [{data,error},{data:blocks,error:blockError}]=await Promise.all([supabaseClient.from("profiles").select("id,username,full_name,wilaya,age,avatar_url,avatar_path,is_online,last_seen,likes_count").order("updated_at",{ascending:false}),supabaseClient.from("profile_blocks").select("user_id,blocked_id").or("user_id.eq."+state.user.id+",blocked_id.eq."+state.user.id)]);if(error){console.error(error);return}if(blockError)console.error("blocks:",blockError);state.blockedIds=new Set((blocks||[]).flatMap(b=>[b.user_id===state.user.id?b.blocked_id:b.user_id]));state.profiles=(data||[]).filter(p=>p.id!==state.user.id&&!state.blockedIds.has(p.id)&&p.is_online===true&&p.last_seen&&Date.now()-new Date(p.last_seen).getTime()<=10000).map(p=>{if(p.avatar_path&&!p.avatar_url){const {data:pub}=supabaseClient.storage.from("avatars").getPublicUrl(p.avatar_path);p.avatar_url=pub?.publicUrl||null}return p});if(state.selectedUser&&state.blockedIds.has(state.selectedUser.id)){state.selectedUser=null;$("#message").disabled=true;$(".send-btn").disabled=true;const h=document.querySelector(".room-head");if(h)h.hidden=true}renderUsers()}
function renderUsers(){const q=($("#userSearch")?.value||"").trim().toLowerCase();const collator=new Intl.Collator("en-US",{numeric:true,sensitivity:"base"});const people=state.profiles.filter(p=>!q||String(p.username||"").toLowerCase().includes(q)||String(p.wilaya||"").toLowerCase().includes(q)).slice().sort((a,b)=>{const aa=String(a.username||"").trim(),bb=String(b.username||"").trim();return collator.compare(aa,bb)||aa.toLowerCase().localeCompare(bb.toLowerCase());});$("#users").innerHTML=people.map(p=>{const selected=state.selectedUser?.id===p.id;const av=p.avatar_url?'<img src="'+escapeHtml(p.avatar_url)+'" alt="">':escapeHtml((p.username||"ن")[0]);return '<button type="button" class="user '+(selected?"selected":"")+'" data-id="'+escapeHtml(p.id)+'"><span class="avatar-sm">'+av+'</span><span><b>'+escapeHtml(p.username)+'</b><small>'+escapeHtml(p.wilaya||"الجزائر")+'</small></span><i>●</i>'+(state.unread[p.id]?'<em class="unread-badge">'+state.unread[p.id]+'</em>':"")+'</button>'}).join("");$("#onlineCount").textContent=people.length+" متصل";const users=$("#users");if(users){users.onclick=e=>{const btn=e.target.closest(".user");if(!btn)return;e.preventDefault();selectUser(btn.dataset.id).catch(err=>{console.error("selectUser:",err);msg("تعذر فتح المحادثة: "+(err.message||"خطأ"))})}}}
async function openProfile(id){
 const p=state.profiles.find(x=>x.id===id); if(!p)return;
 const {data,error}=await supabaseClient.from("profiles").select("id,username,full_name,wilaya,age,avatar_url,avatar_path,bio,gender,marital_status,profession,education,seeking,verified,is_online,last_seen").eq("id",id).single();
 if(error){alert(error.message);return}
 const profile=data||p;
 if(profile.avatar_path&&!profile.avatar_url){const {data:pub}=supabaseClient.storage.from("avatars").getPublicUrl(profile.avatar_path);profile.avatar_url=pub?.publicUrl||null}
 const panel=$("#communityPanel"); panel.hidden=false; const chatApp=document.querySelector(".chat-app"); if(chatApp)chatApp.hidden=true;
 const avatar=profile.avatar_url?'<img src="'+escapeHtml(profile.avatar_url)+'" alt="">':escapeHtml((profile.username||"ن")[0]);
 panel.innerHTML='<div class="panel-head"><button id="backToChat" class="ghost">← العودة للشات</button><h3>الملف الشخصي</h3><button id="closePanel">×</button></div><div class="profile-card-large profile-view"><div class="big-avatar">'+avatar+'</div><h2>'+escapeHtml(profile.username||"عضو")+(profile.verified?" ✓":"")+'</h2><p>'+escapeHtml((profile.age?profile.age+" سنة • ":"")+(profile.wilaya||"الجزائر"))+'</p><div class="profile-info-list"><div><b>الحالة الاجتماعية</b><span>'+escapeHtml(profile.marital_status||"غير محددة")+'</span></div><div><b>المهنة</b><span>'+escapeHtml(profile.profession||"غير محددة")+'</span></div><div><b>المستوى الدراسي</b><span>'+escapeHtml(profile.education||"غير محدد")+'</span></div><div><b>يبحث عن</b><span>'+escapeHtml(profile.seeking||"غير محدد")+'</span></div><div><b>نبذة</b><span>'+escapeHtml(profile.bio||"لم يكتب نبذة بعد.")+'</span></div></div><div class="profile-actions"><button class="primary" id="profileChat">💬 مراسلة</button><button class="mini-action profile-like-action" id="profileLike">❤️ إعجاب</button><button class="mini-action" id="profileRequest">💍 طلب تعارف</button><button class="mini-action" id="profileBlock">🚫 حظر</button><button class="mini-action" id="profileReport">⚠️ إبلاغ</button></div></div>';
 $("#closePanel").onclick=()=>{panel.hidden=true;const chatApp=document.querySelector(".chat-app");if(chatApp)chatApp.hidden=false}; $("#backToChat").onclick=()=>{panel.hidden=true;const chatApp=document.querySelector(".chat-app");if(chatApp)chatApp.hidden=false};
 $("#profileChat").onclick=()=>{panel.hidden=true;selectUser(id)};
 $("#profileLike").textContent=state.likedIds.has(id)?"💚 تم الإعجاب":"❤️ إعجاب";
 $("#profileLike").onclick=async()=>{await likeProfile(id);$("#profileLike").textContent=state.likedIds.has(id)?"💚 تم الإعجاب":"❤️ إعجاب"};
 $("#profileRequest").onclick=()=>sendRequest(id);
}
async function selectUser(id){const p=state.profiles.find(x=>String(x.id)===String(id));if(!p){console.error("User not found",id);return}const roomHead=document.querySelector(".room-head");if(roomHead)roomHead.hidden=false;state.unread[id]=0;state.selectedUser=p;$("#roomName").textContent=p.username;$("#roomStatus").textContent=(p.wilaya||"الجزائر")+" • محادثة خاصة";$(".active-avatar").innerHTML=p.avatar_url?'<img src="'+escapeHtml(p.avatar_url)+'" alt="">':escapeHtml((p.username||"ن")[0]);$("#message").disabled=false;$(".send-btn").disabled=false;$("#message").placeholder="اكتب رسالة محترمة...";document.querySelector(".chat-sidebar")?.classList.add("mobile-hidden");document.querySelector(".room")?.classList.add("mobile-active");renderUsers();$("#message").focus();try{await loadMessages()}catch(err){console.error("loadMessages:",err);state.messages=[];renderMessages()}}
async function loadMessages(){if(!state.selectedUser)return;const me=state.user.id,other=state.selectedUser.id;const {data,error}=await supabaseClient.from("messages").select("id,sender_id,recipient_id,body,created_at,edited_at,deleted_at,attachment_url,attachment_name").or("and(sender_id.eq."+me+",recipient_id.eq."+other+"),and(sender_id.eq."+other+",recipient_id.eq."+me+")").order("created_at",{ascending:true});if(error){console.error(error);return}state.messages=data||[];renderMessages();subscribeMessages()}
function renderVoiceMessage(m){return m.attachment_url?'<audio class="voice-player" controls preload="metadata" src="'+escapeHtml(m.attachment_url)+'"></audio>':escapeHtml(m.body||"");}
function renderMessages(){const el=$("#messages");if(!state.selectedUser){el.innerHTML="";return}if(!state.messages.length){el.innerHTML='<div class="welcome-chat"><div class="welcome-icon">💬</div><h3>ابدأ المحادثة</h3><p>أرسل أول رسالة محترمة إلى '+escapeHtml(state.selectedUser.username)+'.</p></div>';return}el.innerHTML=state.messages.map(m=>'<div class="bubble '+(m.sender_id===state.user.id?"mine":"")+'"><b>'+escapeHtml(m.sender_id===state.user.id?state.profile.username:state.selectedUser.username)+'</b><span>'+escapeHtml(m.deleted_at?"تم حذف الرسالة":(m.body||""))+'</span>'+renderAttachment(m)+'<time>'+new Date(m.created_at).toLocaleTimeString("ar-DZ",{hour:"2-digit",minute:"2-digit"})+'</time></div>').join("");el.scrollTop=el.scrollHeight}
function subscribeMessages(){if(state.channel)supabaseClient.removeChannel(state.channel);if(!state.selectedUser)return;const other=state.selectedUser.id;state.channel=supabaseClient.channel("private-chat-"+state.user.id+"-"+other).on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:"recipient_id=eq."+state.user.id},payload=>{if(payload.new.sender_id===other&&!state.messages.some(m=>m.id===payload.new.id)){state.messages.push(payload.new);renderMessages()}}).subscribe()}
function unlockMessageAudio(){try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;const ctx=window.__nourAudio||(window.__nourAudio=new C());if(ctx.state==="suspended")ctx.resume();}catch(e){}}
document.addEventListener("click",unlockMessageAudio,{passive:true});
function playMessageSound(){try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;const ctx=window.__nourAudio||(window.__nourAudio=new C());if(ctx.state==="suspended")ctx.resume();const now=ctx.currentTime;[0,0.16].forEach((d,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type="sine";o.frequency.setValueAtTime(i?920:680,now+d);g.gain.setValueAtTime(0.0001,now+d);g.gain.exponentialRampToValueAtTime(0.16,now+d+0.02);g.gain.exponentialRampToValueAtTime(0.0001,now+d+0.14);o.connect(g);g.connect(ctx.destination);o.start(now+d);o.stop(now+d+0.15)});}catch(e){console.debug("message sound:",e)}}
function showMessageToast(name,text){let t=document.querySelector(".message-toast");if(!t){t=document.createElement("div");t.className="message-toast";t.style.cssText="position:fixed;top:18px;right:18px;z-index:99999;min-width:240px;max-width:min(360px,calc(100vw - 36px));padding:12px 14px;border-radius:12px;background:#202c33;color:#eef6f8;box-shadow:0 10px 35px rgba(0,0,0,.35);border:1px solid #34444d;direction:rtl;display:flex;flex-direction:column;gap:4px;opacity:0;transform:translateY(-12px);pointer-events:none;transition:.2s";document.body.appendChild(t)}t.innerHTML="<b>💬 "+escapeHtml(name)+"</b><span>"+escapeHtml(text||"رسالة جديدة")+"</span>";t.style.opacity="1";t.style.transform="translateY(0)";clearTimeout(window.__messageToastTimer);window.__messageToastTimer=setTimeout(()=>{t.style.opacity="0";t.style.transform="translateY(-12px)"},4500)}
function notifyMessage(message){const sender=state.profiles.find(p=>p.id===message.sender_id);const name=sender?.username||"عضو جديد";const text=String(message.body||"رسالة جديدة").slice(0,120);playMessageSound();showMessageToast(name,text);if(document.hidden&&"Notification" in window&&Notification.permission==="granted"){try{new Notification("نور الحلال • "+name,{body:text,icon:sender?.avatar_url||undefined,tag:"message-"+message.id})}catch(e){console.debug("notification:",e)}}if(navigator.vibrate)navigator.vibrate([120,60,120])}
function startNotifications(){
 if(state.notificationChannel)return;
 state.notificationChannel=supabaseClient.channel("all-notifications-"+state.user.id)
 .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:"recipient_id=eq."+state.user.id},payload=>{const m=payload.new;if(m.sender_id===state.user.id)return;notifyMessage(m);if(state.selectedUser?.id===m.sender_id){if(!state.messages.some(x=>x.id===m.id)){state.messages.push(m);renderMessages()}return}state.unread[m.sender_id]=(state.unread[m.sender_id]||0)+1;renderUsers()})
 .on("postgres_changes",{event:"INSERT",schema:"public",table:"profile_likes",filter:"target_id=eq."+state.user.id},async payload=>{
  const liker=payload.new?.user_id;if(!liker||liker===state.user.id)return;await refreshLikes();const people=await getLikePeople([liker]);const name=people[0]?.username||"عضو";const mutual=state.mutualLikeIds.has(liker);
  playMessageSound();showMessageToast(mutual?"💚 اهتمام متبادل":"💚 إعجاب جديد",mutual?"يوجد اهتمام متبادل مع "+name:name+" مهتم بملفك الشخصي");
  if(document.hidden&&"Notification" in window&&Notification.permission==="granted"){try{new Notification("نور الحلال • "+(mutual?"اهتمام متبادل":"إعجاب جديد"),{body:mutual?"يوجد اهتمام متبادل مع "+name:name+" مهتم بملفك الشخصي",icon:people[0]?.avatar_url||undefined,tag:"like-"+payload.new.id})}catch(e){}}
 })
 .subscribe(status=>{if(status==="SUBSCRIBED")console.debug("notifications: connected");else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT")console.warn("notifications channel:",status)});
 if("Notification" in window&&Notification.permission==="default")Notification.requestPermission().catch(()=>{});
}
async function register(e){e.preventDefault();const username=$("#username").value.trim(),password=$("#password").value,age=Number($("#age").value),wilaya=$("#wilaya").value,photo=photoInput?.files?.[0];if(!photo)return msg("لازم تختار صورة بروفايل.");if(password!==$("#confirmPassword").value)return msg("كلمتا المرور غير متطابقتين.");if(age<18)return msg("الموقع مخصص لمن أعمارهم 18 سنة أو أكثر.");if(!wilaya)return msg("اختر الولاية.");if(!/^[\p{L}\p{N}_ .-]{3,30}$/u.test(username))return msg("اسم المستخدم يجب أن يكون بين 3 و30 حرفًا.");msg("جاري إنشاء الحساب...");try{const {data,error}=await supabaseClient.functions.invoke("create-nour-account",{body:{username,password,age,wilaya}});if(error)throw error;if(!data?.ok)throw new Error(data?.error==="username_taken"?"اسم المستخدم مستعمل من قبل.":data?.details||data?.error||"تعذر إنشاء الحساب.");const {data:loginData,error:loginError}=await supabaseClient.auth.signInWithPassword({email:internalEmail(username),password});if(loginError)throw loginError;await loadProfile(loginData.user.id);const avatar=await uploadAvatar(loginData.user.id,photo,null);const {error:updateError}=await supabaseClient.from("profiles").update({avatar_path:avatar.path,avatar_url:avatar.url}).eq("id",data.user_id);if(updateError)throw updateError;state.profile.avatar_path=avatar.path;state.profile.avatar_url=avatar.url;await showChat()}catch(err){console.error(err);msg(err.message||"تعذر إنشاء الحساب.")}}
async function login(e){e.preventDefault();msg("جاري تسجيل الدخول...");try{const username=$("#loginUsername").value.trim();if(!username)return msg("اكتب اسم المستخدم.");const {data,error}=await supabaseClient.auth.signInWithPassword({email:internalEmail(username),password:$("#loginPassword").value});if(error)throw error;await loadProfile(data.user.id);await showChat()}catch(err){console.error(err);msg(err.message||"تعذر تسجيل الدخول.")}}
function closeModerationModal(){document.querySelector(".moderation-modal")?.remove()}
function showChatProfile(id){
  const p=state.profiles.find(x=>String(x.id)===String(id));
  if(!p)return;
  closeCommunityPanel();
  showProfile(id);
}
function showModerationChoice(id,name){
  return new Promise(resolve=>{
    closeModerationModal();
    const blocked=state.blockedIds.has(id);
    const modal=document.createElement("div");
    modal.className="moderation-modal";
    modal.innerHTML='<div class="moderation-card" role="dialog" aria-modal="true"><div class="moderation-head"><strong>إدارة العضو</strong><button type="button" class="moderation-close">×</button></div><p class="moderation-name">'+escapeHtml(name||"العضو")+'</p><select class="moderation-select" id="moderationAction"><option value="">اختر الإجراء...</option><option value="block">'+(blocked?"🔓 فك الحظر":"🚫 حظر العضو")+'</option><option value="report">⚠️ إبلاغ عن العضو</option></select><div class="moderation-footer"><button type="button" class="moderation-cancel">إلغاء</button><button type="button" class="moderation-confirm">متابعة</button></div></div>';
    document.body.appendChild(modal);
    const finish=a=>{closeModerationModal();resolve(a)};
    modal.querySelector(".moderation-close").onclick=()=>finish(null);
    modal.querySelector(".moderation-cancel").onclick=()=>finish(null);
    modal.onclick=e=>{if(e.target===modal)finish(null)};
    modal.querySelector(".moderation-confirm").onclick=()=>finish(modal.querySelector("#moderationAction").value||null);
  });
}
function chooseReportReason(name){
  return new Promise(resolve=>{
    closeModerationModal();
    const reasons=["إساءة أو سب","تحرش أو مضايقة","حساب مزيف أو انتحال شخصية","محتوى غير لائق","طلب مال أو احتيال","رسائل مزعجة","مخالفة شروط الموقع","سبب آخر"];
    const modal=document.createElement("div");
    modal.className="moderation-modal";
    modal.innerHTML='<div class="moderation-card" role="dialog" aria-modal="true"><div class="moderation-head"><strong>⚠️ إبلاغ عن العضو</strong><button type="button" class="moderation-close">×</button></div><p class="moderation-name">اختر سبب الإبلاغ عن '+escapeHtml(name||"العضو")+'</p><select class="moderation-select" id="reportReason"><option value="">اختر سبب الإبلاغ...</option>'+reasons.map((r,i)=>'<option value="'+i+'">'+escapeHtml(r)+'</option>').join("")+'</select><div class="moderation-footer"><button type="button" class="moderation-cancel">إلغاء</button><button type="button" class="moderation-confirm">إرسال البلاغ</button></div></div>';
    document.body.appendChild(modal);
    const finish=v=>{closeModerationModal();resolve(v)};
    modal.querySelector(".moderation-close").onclick=()=>finish(null);
    modal.querySelector(".moderation-cancel").onclick=()=>finish(null);
    modal.onclick=ev=>{if(ev.target===modal)finish(null)};
    modal.querySelector(".moderation-confirm").onclick=()=>{
      const n=Number(modal.querySelector("#reportReason").value);
      if(!Number.isInteger(n)||n<0){alert("اختر سبب الإبلاغ أولاً.");return}
      finish(reasons[n]);
    };
  });
}
async function blockUser(id){
  if(!id||id===state.user.id)return;
  const p=state.profiles.find(x=>x.id===id)||state.selectedUser; const name=p?.username||"هذا العضو";
  const choice=await showModerationChoice(id,name); if(choice!=="block")return;
  if(!confirm("هل تريد حظر "+name+"؟"))return;
  const {error}=await supabaseClient.from("profile_blocks").upsert({user_id:state.user.id,blocked_id:id},{onConflict:"user_id,blocked_id"});
  if(error){alert("تعذر الحظر: "+error.message);return}
  state.blockedIds.add(id);state.selectedUser=null;$("#message").value="";$("#message").disabled=true;$(".send-btn").disabled=true;
  const h=document.querySelector(".room-head");if(h)h.hidden=true;await loadProfiles();
  document.querySelector(".chat-sidebar")?.classList.remove("mobile-hidden");document.querySelector(".room")?.classList.remove("mobile-active");
}
async function unblockUser(id){
  if(!id)return;
  const p=state.profiles.find(x=>x.id===id); const name=p?.username||"هذا العضو";
  const choice=await showModerationChoice(id,name); if(choice!=="block")return;
  const {error}=await supabaseClient.from("profile_blocks").delete().eq("user_id",state.user.id).eq("blocked_id",id);
  if(error){alert("تعذر فك الحظر: "+error.message);return}
  state.blockedIds.delete(id);await loadProfiles();
}
async function reportUser(id,name){
  if(!id||id===state.user.id)return;
  const reason=await chooseReportReason(name); if(!reason)return;
  const {error}=await supabaseClient.from("profile_reports").insert({reporter_id:state.user.id,reported_id:id,reason,details:null});
  if(error){alert("تعذر إرسال البلاغ: "+error.message);return}
  alert("تم إرسال البلاغ للإدارة للمراجعة.");
}
async function showModerationMenu(id,name){
  const choice=await showModerationChoice(id,name);
  if(choice==="block"){if(state.blockedIds.has(id))await unblockUserDirect(id);else await blockUserDirect(id)}
  else if(choice==="report")await reportUserDirect(id,name);
}
async function blockUserDirect(id){
  if(!id||id===state.user.id)return;
  const {error}=await supabaseClient.from("profile_blocks").upsert({user_id:state.user.id,blocked_id:id},{onConflict:"user_id,blocked_id"});
  if(error){alert("تعذر الحظر: "+error.message);return}
  state.blockedIds.add(id);state.selectedUser=null;$("#message").value="";$("#message").disabled=true;$(".send-btn").disabled=true;
  const h=document.querySelector(".room-head");if(h)h.hidden=true;await loadProfiles();
  document.querySelector(".chat-sidebar")?.classList.remove("mobile-hidden");document.querySelector(".room")?.classList.remove("mobile-active");
}
async function unblockUserDirect(id){
  const {error}=await supabaseClient.from("profile_blocks").delete().eq("user_id",state.user.id).eq("blocked_id",id);
  if(error){alert("تعذر فك الحظر: "+error.message);return}
  state.blockedIds.delete(id);await loadProfiles();
}
async function reportUserDirect(id,name){
  const reason=await chooseReportReason(name);if(!reason)return;
  const {error}=await supabaseClient.from("profile_reports").insert({reporter_id:state.user.id,reported_id:id,reason,details:null});
  if(error){alert("تعذر إرسال البلاغ: "+error.message);return}
  alert("تم إرسال البلاغ للإدارة للمراجعة.");
}
let voiceRecorder=null,voiceChunks=[],voiceStartedAt=0;
async function toggleVoiceRecording(){
 if(!state.selectedUser)return msg("اختر عضوًا أولًا.");
 if(voiceRecorder?.state==="recording"){voiceRecorder.stop();return}
 if(!navigator.mediaDevices?.getUserMedia)return msg("المتصفح لا يدعم تسجيل الصوت.");
 try{
  const stream=await navigator.mediaDevices.getUserMedia({audio:true});
  const types=["audio/webm;codecs=opus","audio/webm","audio/mp4","audio/ogg;codecs=opus"];
  const mime=types.find(t=>MediaRecorder.isTypeSupported?.(t))||"";
  voiceRecorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);voiceChunks=[];voiceStartedAt=Date.now();
  const btn=$("#voiceBtn");btn.textContent="⏹️";btn.classList.add("recording");
  voiceRecorder.ondataavailable=e=>{if(e.data.size)voiceChunks.push(e.data)};
  voiceRecorder.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());btn.textContent="🎤";btn.classList.remove("recording");const blob=new Blob(voiceChunks,{type:voiceRecorder.mimeType||"audio/webm"});if(blob.size<1000)return;if(Date.now()-voiceStartedAt<500){msg("سجّل ثانية واحدة على الأقل.");return}await sendVoiceMessage(blob)};
  voiceRecorder.start();
 }catch(e){console.error("voice:",e);msg("تعذر الوصول إلى الميكروفون. اسمح بالوصول للميكروفون ثم أعد المحاولة.")}
}
async function sendVoiceMessage(blob){
 const recipientId=state.selectedUser?.id;if(!recipientId)return;
 const ext=(blob.type.includes("ogg")?"ogg":blob.type.includes("mp4")?"m4a":"webm");
 const path=state.user.id+"/voice-"+Date.now()+"."+ext;
 const {error:up}=await supabaseClient.storage.from("voice-messages").upload(path,blob,{contentType:blob.type||"audio/webm",cacheControl:"3600",upsert:false});
 if(up){console.error(up);msg("تعذر رفع الرسالة الصوتية: "+up.message);return}
 const {data:url}=supabaseClient.storage.from("voice-messages").getPublicUrl(path);
 const {error}=await supabaseClient.from("messages").insert({sender_id:state.user.id,recipient_id:recipientId,body:"",attachment_url:url.publicUrl,attachment_name:path});
 if(error){await supabaseClient.storage.from("voice-messages").remove([path]);msg("تعذر إرسال الرسالة الصوتية: "+error.message);return}
 await loadMessages();
}
async function sendChatImage(file){
 const recipientId=state.selectedUser?.id;if(!recipientId||!file)return;
 if(!/^image\/(jpeg|png|webp|gif)$/i.test(file.type)){msg("اختر صورة JPG أو PNG أو WEBP أو GIF.");return}
 if(file.size>10*1024*1024){msg("حجم الصورة يجب أن يكون أقل من 10 ميغابايت.");return}
 try{
  // أرسل الصورة الأصلية بدون Canvas/ضغط حتى لا تتغير الدقة أو الجودة.
  const ext=file.type==="image/png"?"png":file.type==="image/webp"?"webp":file.type==="image/gif"?"gif":"jpg";
  const path=state.user.id+"/image-"+Date.now()+"."+ext;
  const {error:up}=await supabaseClient.storage.from("chat-images").upload(path,file,{contentType:file.type,cacheControl:"3600",upsert:false});
  if(up){console.error(up);msg("تعذر رفع الصورة: "+up.message);return}
  const {data:url}=supabaseClient.storage.from("chat-images").getPublicUrl(path);
  const {error}=await supabaseClient.from("messages").insert({sender_id:state.user.id,recipient_id:recipientId,body:"",attachment_url:url.publicUrl,attachment_name:path});
  if(error){await supabaseClient.storage.from("chat-images").remove([path]);msg("تعذر إرسال الصورة: "+error.message);return}
  await loadMessages();
 }catch(e){console.error("sendChatImage:",e);msg("تعذر إرسال الصورة.");}
}
function renderAttachment(m){
 if(!m.attachment_url)return "";
 const name=String(m.attachment_name||"").toLowerCase();
 if(/\.(jpg|jpeg|png|webp|gif)$/.test(name)) return '<a class="chat-image-link" href="'+escapeHtml(m.attachment_url)+'" target="_blank" rel="noopener"><img class="chat-image" src="'+escapeHtml(m.attachment_url)+'" alt="صورة مرسلة" loading="lazy"></a>';
 return '<audio class="voice-player" controls preload="metadata" src="'+escapeHtml(m.attachment_url)+'"></audio>';
}
async function sendMessage(e){e.preventDefault();if(!state.selectedUser)return msg("اختر عضوًا أولًا.");const input=$("#message");const body=input.value.trim();if(!body)return;const recipientId=state.selectedUser.id;const {error}=await supabaseClient.from("messages").insert({sender_id:state.user.id,recipient_id:recipientId,body});if(error){console.error("sendMessage:",error);msg("تعذر إرسال الرسالة: "+error.message);return}input.value="";const {data:check,error:checkError}=await supabaseClient.from("messages").select("id,sender_id,recipient_id,body,created_at,edited_at,deleted_at").or("and(sender_id.eq."+state.user.id+",recipient_id.eq."+recipientId+"),and(sender_id.eq."+recipientId+",recipient_id.eq."+state.user.id+")").order("created_at",{ascending:true});if(!checkError){state.messages=check||[];renderMessages()}else{console.error("reload messages:",checkError);msg("تم الإرسال، لكن تعذر تحديث المحادثة.");}}
async function adminApi(action,extra={}){const {data,error}=await supabaseClient.functions.invoke("admin-control",{body:{action,...extra}});if(error)throw error;if(data?.error)throw new Error(data.error);return data}
async function initAdminAccess(){const b=$("#adminNav");if(!b)return;try{const data=await adminApi("me");if(data?.is_admin){b.hidden=false;return true}}catch(e){b.hidden=true}return false}
async function showAdminPanel(){const panel=$("#communityPanel");panel.hidden=false;const chatApp=document.querySelector(".chat-app");if(chatApp)chatApp.hidden=true;panel.innerHTML='<div class="panel-head"><h3>🛡️ لوحة تحكم الإدارة</h3><button id="closeAdmin">×</button></div><div class="admin-wrap"><div id="adminStats" class="admin-stats"></div><div class="admin-toolbar"><input id="adminSearch" placeholder="ابحث باسم المستخدم أو الولاية..."><button class="mini-action" id="refreshAdmin">↻ تحديث</button></div><div id="adminUsers" class="admin-users"></div><div id="adminConversation" class="admin-conversation"></div></div>';$("#closeAdmin").onclick=()=>{panel.hidden=true;if(chatApp)chatApp.hidden=false};$("#refreshAdmin").onclick=()=>showAdminPanel();const d=await adminApi("dashboard");$("#adminStats").innerHTML='<div><b>'+d.stats.users+'</b><span>الأعضاء</span></div><div><b>'+d.stats.online+'</b><span>متصل الآن</span></div><div><b>'+d.stats.messages+'</b><span>الرسائل</span></div><div><b>'+d.stats.reports+'</b><span>البلاغات المفتوحة</span></div>';let users=d.users||[];const render=()=>{const q=($("#adminSearch").value||"").toLowerCase();const list=users.filter(u=>(u.username||"").toLowerCase().includes(q)||(u.wilaya||"").toLowerCase().includes(q));$("#adminUsers").innerHTML=list.map(u=>'<article class="admin-user"><div class="admin-user-main"><div class="admin-avatar">'+(u.avatar_url?'<img src="'+escapeHtml(u.avatar_url)+'" alt="">':escapeHtml((u.username||"ن")[0]))+'</div><div><b>'+escapeHtml(u.username)+'</b><small>'+escapeHtml((u.age||"")+" سنة • "+(u.wilaya||"الجزائر"))+'</small><small>'+((u.is_online)?'🟢 متصل':'⚪ غير متصل')+(u.verified?' • ✓ موثق':'')+'</small></div></div><div class="admin-actions"><button class="mini-action edit-admin" data-id="'+u.id+'">✏️ تعديل</button><button class="mini-action chat-admin" data-id="'+u.id+'">💬 الرسائل</button><button class="mini-action danger delete-admin" data-id="'+u.id+'">🗑️ حذف</button></div></article>').join("");document.querySelectorAll(".edit-admin").forEach(b=>b.onclick=()=>adminEditUser(users.find(u=>u.id===b.dataset.id)));document.querySelectorAll(".chat-admin").forEach(b=>b.onclick=()=>adminConversation(users.find(u=>u.id===b.dataset.id)));document.querySelectorAll(".delete-admin").forEach(b=>b.onclick=async()=>{if(!confirm("حذف الحساب نهائيًا؟"))return;try{await adminApi("delete_user",{user_id:b.dataset.id});await showAdminPanel()}catch(e){alert(e.message)}})};$("#adminSearch").oninput=render;render()}
function adminEditUser(u){if(!u)return;const panel=$("#communityPanel");$("#adminConversation").innerHTML='<div class="admin-edit"><h4>تعديل حساب: '+escapeHtml(u.username)+'</h4><div class="admin-form-grid"><input id="aeUsername" value="'+escapeHtml(u.username||"")+'" placeholder="اسم المستخدم"><input id="aeAge" type="number" min="18" max="100" value="'+escapeHtml(u.age||"")+'" placeholder="العمر"><input id="aeWilaya" value="'+escapeHtml(u.wilaya||"")+'" placeholder="الولاية"><input id="aeProfession" value="'+escapeHtml(u.profession||"")+'" placeholder="المهنة"><select id="aeVerified"><option value="false">غير موثق</option><option value="true" '+(u.verified?'selected':'')+'>موثق</option></select><select id="aeOnline"><option value="false">غير متصل</option><option value="true" '+(u.is_online?'selected':'')+'>متصل</option></select></div><textarea id="aeBio" placeholder="النبذة">'+escapeHtml(u.bio||"")+'</textarea><div><button class="primary" id="saveAdminUser">حفظ</button><button class="mini-action" id="cancelAdminEdit">إلغاء</button></div></div>';$("#cancelAdminEdit").onclick=()=>$("#adminConversation").innerHTML="";$("#saveAdminUser").onclick=async()=>{try{await adminApi("update_user",{user_id:u.id,username:$("#aeUsername").value.trim(),age:Number($("#aeAge").value)||null,wilaya:$("#aeWilaya").value.trim(),profession:$("#aeProfession").value.trim(),bio:$("#aeBio").value,verified:$("#aeVerified").value==="true",is_online:$("#aeOnline").value==="true",last_seen:new Date().toISOString()});alert("تم حفظ الحساب");showAdminPanel()}catch(e){alert(e.message)}}}
async function adminConversation(u){if(!u)return;const all=(await adminApi("users")).users||[];const others=all.filter(x=>x.id!==u.id);$("#adminConversation").innerHTML='<div class="admin-chat-head"><h4>محادثات '+escapeHtml(u.username)+'</h4><select id="adminOther"><option value="">اختر العضو الآخر</option>'+others.map(x=>'<option value="'+x.id+'">'+escapeHtml(x.username)+'</option>').join("")+'</select><button class="mini-action danger" id="clearAdminChat">مسح المحادثة</button></div><div id="adminMsgs" class="admin-msgs">اختر عضوًا آخر لعرض المحادثة.</div>';$("#adminOther").onchange=async()=>{const other=$("#adminOther").value;if(!other)return;try{const d=await adminApi("messages",{user_a:u.id,user_b:other});$("#adminMsgs").innerHTML=(d.messages||[]).map(m=>'<div class="admin-msg"><div><b>'+escapeHtml((m.sender_id===u.id?u.username:(all.find(x=>x.id===m.sender_id)?.username||"عضو")) )+'</b><time>'+new Date(m.created_at).toLocaleString("ar-DZ")+'</time></div><p>'+escapeHtml(m.body)+'</p><button class="danger mini-action del-msg" data-id="'+m.id+'">حذف</button></div>').join("")||'<p>لا توجد رسائل.</p>';document.querySelectorAll(".del-msg").forEach(b=>b.onclick=async()=>{await adminApi("delete_message",{message_id:b.dataset.id});$("#adminOther").dispatchEvent(new Event("change"))})}catch(e){alert(e.message)}};$("#clearAdminChat").onclick=async()=>{const other=$("#adminOther").value;if(!other)return alert("اختر العضو الآخر.");if(confirm("مسح كامل المحادثة؟")){await adminApi("clear_conversation",{user_a:u.id,user_b:other});$("#adminOther").dispatchEvent(new Event("change"))}}}
async function showBlocked(){const panel=$("#communityPanel");panel.hidden=false;try{const {data,error}=await supabaseClient.from("profile_blocks").select("blocked_id,created_at").eq("user_id",state.user.id).order("created_at",{ascending:false});if(error)throw error;const ids=(data||[]).map(x=>x.blocked_id);let people=[];if(ids.length){const r=await supabaseClient.from("profiles").select("id,username,avatar_url,avatar_path,wilaya").in("id",ids);if(r.error)throw r.error;people=r.data||[]}panel.innerHTML='<div class="panel-head"><h3>🚫 المحظورون</h3><button id="closeBlocked">×</button></div>'+(people.length?people.map(p=>'<div class="request-row"><span><b>'+escapeHtml(p.username)+'</b><small>'+escapeHtml(p.wilaya||"الجزائر")+'</small></span><button class="mini-action unblock-user" data-id="'+p.id+'">🔓 فك الحظر</button></div>').join(""):'<div class="admin-empty">لا يوجد أعضاء محظورون.</div>');$("#closeBlocked").onclick=closeCommunityPanel;document.querySelectorAll(".unblock-user").forEach(b=>b.onclick=async()=>{await unblockUser(b.dataset.id);showBlocked()})}catch(e){panel.innerHTML='<p>'+escapeHtml(e.message)+'</p>'}}
function closeCommunityPanel(){const panel=$("#communityPanel"),chatApp=document.querySelector(".chat-app");if(panel)panel.hidden=true;if(chatApp)chatApp.hidden=false;}
async function showSection(section){
 const panel=$("#communityPanel");
 const chatApp=document.querySelector(".chat-app");
 if(chatApp)chatApp.hidden=true;
 if(section==="admin"){ const w=window.open("admin.html","nour-el7alal-admin"); if(!w) location.href="admin.html"; return }
 panel.hidden=false;
 if(section==="blocked"){await showBlocked();return}
 if(section==="profile"){
  const p=state.profile||{};
  panel.innerHTML='<div class="panel-head"><h3>حسابي 👤</h3><button id="closePanel">×</button></div>'+
  '<div class="profile-card-large profile-edit-card">'+
  '<div class="account-photo-wrap"><div class="big-avatar" id="accountAvatar">'+(p.avatar_url?'<img src="'+escapeHtml(p.avatar_url)+'" alt="">':escapeHtml((p.username||"ن")[0]))+'</div><label class="profile-photo-edit">🖼️ تغيير الصورة<input id="changeProfilePhoto" type="file" accept="image/jpeg,image/png,image/webp"></label></div>'+
  '<div class="account-username">@'+escapeHtml(p.username||"")+'</div>'+
  '<div class="profile-form-grid">'+
  '<label>الاسم الكامل<input id="fullNameEdit" maxlength="80" value="'+escapeHtml(p.full_name||"")+'" placeholder="اكتب اسمك الكامل"></label>'+
  '<label>العمر<input id="ageEdit" type="number" min="18" max="100" value="'+escapeHtml(p.age||"")+'" placeholder="18"></label>'+
  '<label>الولاية<select id="wilayaEdit"><option value="">اختر الولاية</option>'+wilayas.map(w=>'<option '+(p.wilaya===w?"selected":"")+'>'+escapeHtml(w)+'</option>').join("")+'</select></label>'+
  '<label>الجنس<select id="genderEdit"><option value="">اختر</option><option '+(p.gender==="رجل"?"selected":"")+'>رجل</option><option '+(p.gender==="امرأة"?"selected":"")+' >امرأة</option></select></label>'+
  '<label>الحالة الاجتماعية<select id="statusEdit"><option value="">اختر الحالة</option><option '+(p.marital_status==="أعزب/عزباء"?"selected":"")+'>أعزب/عزباء</option><option '+(p.marital_status==="مطلق/مطلقة"?"selected":"")+'>مطلق/مطلقة</option><option '+(p.marital_status==="أرمل/أرملة"?"selected":"")+'>أرمل/أرملة</option></select></label>'+
  '<label>المهنة<input id="professionEdit" maxlength="80" value="'+escapeHtml(p.profession||"")+'" placeholder="مثال: مهندس"></label>'+
  '<label>المستوى الدراسي<input id="educationEdit" maxlength="80" value="'+escapeHtml(p.education||"")+'" placeholder="مثال: جامعي"></label>'+
  '<label>أبحث عن<input id="seekingEdit" maxlength="120" value="'+escapeHtml(p.seeking||"")+'" placeholder="مثال: زواج جاد"></label>'+
  '</div>'+
  '<label class="profile-bio-label">نبذة عني<textarea id="bioEdit" maxlength="500" placeholder="اكتب نبذة محترمة عن نفسك...">'+escapeHtml(p.bio||"")+'</textarea><small id="bioCount">'+String((p.bio||"").length)+'/500</small></label>'+
  '<button class="primary profile-save-btn" id="saveProfile">💾 حفظ التعديلات</button><p class="profile-save-msg" id="profileSaveMsg"></p>'+
  '</div>';
  $("#closePanel").onclick=closeCommunityPanel;
  $("#bioEdit").oninput=()=>$("#bioCount").textContent=$("#bioEdit").value.length+"/500";
  $("#changeProfilePhoto").onchange=async()=>{
   const file=$("#changeProfilePhoto").files?.[0];if(!file)return;
   if(file.size>5*1024*1024){alert("حجم الصورة لازم يكون أقل من 5 ميغابايت.");return}
   try{
    const oldPath=state.profile.avatar_path||null;
    const avatar=await uploadAvatar(state.user.id,file,oldPath);
    const {error}=await supabaseClient.from("profiles").update({avatar_path:avatar.path,avatar_url:avatar.url}).eq("id",state.user.id);
    if(error){await supabaseClient.storage.from("avatars").remove([avatar.path]);throw error}
    state.profile.avatar_path=avatar.path;state.profile.avatar_url=avatar.url;state.user.avatar_path=avatar.path;state.user.avatar_url=avatar.url;
    $("#accountAvatar").innerHTML='<img src="'+escapeHtml(avatar.url)+'" alt="">';
    $("#myAvatar").innerHTML='<img src="'+escapeHtml(avatar.url)+'" alt="">';
    await loadProfiles();
    $("#profileSaveMsg").textContent="تم تغيير الصورة ✅";
   }catch(err){console.error(err);alert("تعذر تغيير الصورة: "+(err.message||"خطأ"))}
  };
  $("#saveProfile").onclick=async()=>{
   const age=Number($("#ageEdit").value);
   if(!age||age<18||age>100){$("#profileSaveMsg").textContent="العمر يجب أن يكون بين 18 و100 سنة.";return}
   const update={full_name:$("#fullNameEdit").value.trim()||null,age,wilaya:$("#wilayaEdit").value||null,gender:$("#genderEdit").value||null,marital_status:$("#statusEdit").value||null,profession:$("#professionEdit").value.trim()||null,education:$("#educationEdit").value.trim()||null,seeking:$("#seekingEdit").value.trim()||null,bio:$("#bioEdit").value.trim()||null,updated_at:new Date().toISOString()};
   const {error}=await supabaseClient.from("profiles").update(update).eq("id",state.user.id);
   if(error){console.error(error);$("#profileSaveMsg").textContent="تعذر الحفظ: "+error.message;return}
   Object.assign(state.profile,update);Object.assign(state.user,update);
   $("#me").textContent="@"+state.profile.username+" · "+(state.profile.wilaya||"");
   $("#profileSaveMsg").textContent="تم حفظ حسابك بنجاح ✅";
   await loadProfiles();
  };
  return
 }
 if(section==="discover"){
 await refreshLikes();
 panel.innerHTML='<div class="panel-head"><h3>البحث المتقدم 🔎</h3><button id="closePanel">×</button></div>'+
 '<div class="advanced-search">'+
 '<div class="search-title">ابحث عن الشخص المناسب</div>'+
 '<div class="filter-grid advanced-filter-grid">'+
 '<label>اسم المستخدم<input id="filterQ" placeholder="مثال: Zineb23"></label>'+
 '<label>الولاية<select id="filterWilaya"><option value="">كل الولايات</option>'+wilayas.map(w=>'<option>'+escapeHtml(w)+'</option>').join("")+'</select></label>'+
 '<label>العمر من<input id="filterMin" type="number" min="18" max="100" placeholder="18"></label>'+
 '<label>العمر إلى<input id="filterMax" type="number" min="18" max="100" placeholder="100"></label>'+
 '<label>الحالة الاجتماعية<select id="filterStatus"><option value="">كل الحالات</option><option>أعزب/عزباء</option><option>مطلق/مطلقة</option><option>أرمل/أرملة</option></select></label>'+
 '<label>المهنة<input id="filterProfession" placeholder="مثال: مهندس"></label>'+
 '</div>'+
 '<label class="online-filter"><input id="filterOnline" type="checkbox"> 🟢 المتصلون الآن فقط</label>'+
 '<div class="search-result-count" id="discoverCount"></div>'+
 '</div><div id="discoverResults" class="discover-grid"></div>';
 $("#closePanel").onclick=()=>panel.hidden=true;
 const isOnline=p=>Boolean(p.is_online&&p.last_seen&&(Date.now()-new Date(p.last_seen).getTime()<=10000));
 const run=()=>{
  const q=($("#filterQ").value||"").trim().toLowerCase(),w=$("#filterWilaya").value;
  const min=Number($("#filterMin").value)||18,max=Number($("#filterMax").value)||100,status=$("#filterStatus").value;
  const prof=($("#filterProfession").value||"").trim().toLowerCase(),online=$("#filterOnline").checked;
  const list=state.profiles.filter(p=>
   (!q||String(p.username||"").toLowerCase().includes(q))&&
   (!w||p.wilaya===w)&&
   (p.age&&p.age>=min&&p.age<=max)&&
   (!status||p.marital_status===status)&&
   (!prof||String(p.profession||"").toLowerCase().includes(prof))&&
   (!online||isOnline(p))
  );
  $("#discoverCount").textContent=list.length+" عضو مطابق للبحث";
  $("#discoverResults").innerHTML=list.length?list.map(p=>{
   const onlineNow=isOnline(p);
   return '<article class="discover-card" data-profile-id="'+p.id+'"><div class="discover-avatar">'+(p.avatar_url?'<img src="'+escapeHtml(p.avatar_url)+'" alt="">':escapeHtml((p.username||"ن")[0]))+'</div><b>'+escapeHtml(p.username)+(onlineNow?' <span class="online-dot">●</span>':'')+'</b><small>'+escapeHtml((p.age||"")+" سنة • "+(p.wilaya||"الجزائر"))+'</small><small>'+escapeHtml(p.marital_status||"الحالة غير محددة")+(p.profession?" • "+escapeHtml(p.profession):"")+'</small><div><button class="mini-action like-btn" data-id="'+p.id+'">❤️ إعجاب</button><button class="mini-action request-btn" data-id="'+p.id+'">💍 طلب تعارف</button></div></article>'
  }).join(""):'<div class="empty-search">لا توجد نتائج مطابقة 🔎<br><small>جرّب توسيع العمر أو إزالة أحد الفلاتر.</small></div>';
  document.querySelectorAll(".discover-card").forEach(card=>card.onclick=e=>{if(!e.target.closest("button"))openProfile(card.dataset.profileId)});
  document.querySelectorAll(".like-btn").forEach(b=>b.onclick=()=>likeProfile(b.dataset.id));
  document.querySelectorAll(".request-btn").forEach(b=>b.onclick=()=>sendRequest(b.dataset.id));
 };
 ["filterQ","filterWilaya","filterMin","filterMax","filterStatus","filterProfession"].forEach(id=>$("#"+id).oninput=run);
 $("#filterOnline").onchange=run;
 run();return}
if(section==="requests"){await refreshLikes();const {data,error}=await supabaseClient.from("marriage_requests").select("id,sender_id,recipient_id,status,created_at").or("sender_id.eq."+state.user.id+",recipient_id.eq."+state.user.id).order("created_at",{ascending:false});if(error)return panel.innerHTML='<p>'+escapeHtml(error.message)+'</p>';const ids=[...new Set((data||[]).map(x=>x.sender_id===state.user.id?x.recipient_id:x.sender_id))];const people=state.profiles.filter(p=>ids.includes(p.id));panel.innerHTML='<div class="panel-head"><h3>❤️ الطلبات</h3><button id="closePanel">×</button></div><div class="request-tabs"><button class="mini-action" id="showLikesTab">💚 الإعجابات</button><button class="mini-action" id="showRequestsTab">💍 طلبات التعارف</button></div><div id="requestsBody">'+(data||[]).map(r=>{const p=people.find(x=>x.id===(r.sender_id===state.user.id?r.recipient_id:r.sender_id));return '<div class="request-row"><span>'+escapeHtml(p?.username||"عضو")+'</span><b>'+escapeHtml(r.status)+'</b>'+(r.recipient_id===state.user.id&&r.status==="pending"?'<button class="mini-action accept-btn" data-id="'+r.id+'">قبول</button><button class="mini-action reject-btn" data-id="'+r.id+'">رفض</button>':"")+'</div>'}).join("")+"</div>";$("#closePanel").onclick=()=>panel.hidden=true;$("#showLikesTab").onclick=()=>showLikesPanel();$("#showRequestsTab").onclick=()=>showSection("requests");document.querySelectorAll(".accept-btn").forEach(b=>b.onclick=()=>updateRequest(b.dataset.id,"accepted"));document.querySelectorAll(".reject-btn").forEach(b=>b.onclick=()=>updateRequest(b.dataset.id,"rejected"));return}
 if(section==="offers"){const {data,error}=await supabaseClient.from("marriage_offers").select("id,owner_id,name,age,wilaya,gender,offer_type,bio,avatar_emoji,verified,online").eq("status","active").order("created_at",{ascending:false}).limit(30);if(error)return panel.innerHTML='<p>'+escapeHtml(error.message)+'</p>';panel.innerHTML='<div class="panel-head"><h3>عروض الزواج 💍</h3><button id="closePanel">×</button></div><div class="discover-grid">'+(data||[]).map(o=>'<article class="discover-card"><div class="discover-avatar">'+escapeHtml(o.avatar_emoji||"💍")+'</div><b>'+escapeHtml(o.name||"عضو")+'</b><small>'+escapeHtml((o.age||"")+" سنة • "+(o.wilaya||"الجزائر"))+'</small><p>'+escapeHtml(o.bio||"عرض زواج جاد")+'</p><button class="mini-action offer-request" data-id="'+o.owner_id+'">💍 تواصل</button></article>').join("")+'</div>';$("#closePanel").onclick=()=>panel.hidden=true;document.querySelectorAll(".offer-request").forEach(b=>b.onclick=()=>sendRequest(b.dataset.id));}
}
async function likeProfile(id){
 if(!id||id===state.user.id)return;
 await refreshLikes();
 if(state.likedIds.has(id)){
  const {error}=await supabaseClient.from("profile_likes").delete().eq("user_id",state.user.id).eq("target_id",id);
  if(error){alert("تعذر إلغاء الإعجاب: "+error.message);return}
  await refreshLikes();renderCurrentLikeButtons(id);return;
 }
 const {error}=await supabaseClient.from("profile_likes").insert({user_id:state.user.id,target_id:id});
 if(error){alert("تعذر تسجيل الإعجاب: "+error.message);return}
 await refreshLikes();renderCurrentLikeButtons(id);
 if(state.mutualLikeIds.has(id))alert("💚 اهتمام متبادل! يمكنكما بدء محادثة محترمة.");
 else msg("تم تسجيل الإعجاب ❤️");
}
function renderCurrentLikeButtons(id){
 document.querySelectorAll(".like-btn[data-id='"+id+"']").forEach(b=>b.textContent=state.likedIds.has(id)?"💚 تم الإعجاب":"❤️ إعجاب");
 const b=$("#profileLike");if(b)b.textContent=state.likedIds.has(id)?"💚 تم الإعجاب":"❤️ إعجاب";
}
async function sendRequest(id){if(id===state.user.id)return;const {error}=await supabaseClient.from("marriage_requests").upsert({sender_id:state.user.id,recipient_id:id,status:"pending"},{onConflict:"sender_id,recipient_id"});if(error)alert(error.message);else alert("تم إرسال طلب التعارف 💍")}
async function updateRequest(id,status){const {error}=await supabaseClient.from("marriage_requests").update({status,updated_at:new Date().toISOString()}).eq("id",id);if(error)alert(error.message);else showSection("requests")}
const EMOJI_LIST=["😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","🙃","😉","😍","🥰","😘","😎","🤩","🥳","😏","😢","😭","😤","😠","😡","😱","🤔","🤗","😴","🤢","🤮","😷","🤒","👋","👌","✌️","🤞","🤟","🤘","🤙","👍","👎","👏","🙌","🙏","💪","❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","💕","💞","💓","💗","💖","💘","💝","🔥","✨","⭐","🌟","💫","🎉","🎊","💯","💍","💎","🌹","🌷","🌸","🌺","🌻","🍀","☀️","🌙","🍎","🍓","🍉","🍕","🍔","🍟","🍰","🎂","☕","🥤","⚽","🏆","🎮","🎵","🎶","🚗","✈️","🏠","💰","🎁","📱","💡","✅","❌","⚠️","❗","❓","💬","📌","🔒","🔑"];
function showEmojiPicker(){let box=$("#emojiPicker");const hideKeyboard=()=>{const input=$("#message");if(input)input.blur();const active=document.activeElement;if(active&&typeof active.blur==="function")active.blur()};if(box){const opening=box.hidden;box.hidden=!box.hidden;if(opening)hideKeyboard();return}box=document.createElement("div");box.id="emojiPicker";box.className="emoji-picker";box.hidden=false;box.innerHTML='<div class="emoji-head"><b>الإيموجيات</b><button type="button" id="closeEmoji">×</button></div><div class="emoji-grid">'+EMOJI_LIST.map(e=>'<button type="button">'+e+'</button>').join("")+'</div>';document.querySelector(".send").parentElement.appendChild(box);hideKeyboard();box.querySelector("#closeEmoji").onclick=()=>box.hidden=true;box.querySelectorAll(".emoji-grid button").forEach(b=>b.onclick=()=>{$("#message").value+=b.textContent})}
function initChatUX(){if(window.chatUX)return;window.chatUX=true;document.querySelectorAll(".community-nav button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".community-nav button").forEach(x=>x.classList.remove("active"));b.classList.add("active");showSection(b.dataset.section)});$("#searchToggle").onclick=()=>$("#searchBox").hidden=!$("#searchBox").hidden;$("#userSearch").oninput=renderUsers;$("#newChat").onclick=()=>{$("#searchBox").hidden=false;$("#userSearch").focus()};const roomProfileBtn=$("#roomProfile");if(roomProfileBtn)roomProfileBtn.onclick=()=>{if(!state.selectedUser)return;showChatProfile(state.selectedUser.id);};const roomMoreBtn=$("#roomMore");if(roomMoreBtn)roomMoreBtn.onclick=()=>{if(!state.selectedUser)return;showModerationMenu(state.selectedUser.id,state.selectedUser.username);};document.querySelectorAll(".quick-replies button").forEach(b=>b.onclick=()=>{if(!state.selectedUser)return;$("#message").value=b.textContent;$("#message").focus()});$("#emojiBtn").onclick=()=>{if(!state.selectedUser)return;showEmojiPicker()};$("#imageBtn").onclick=()=>{if(!state.selectedUser)return msg("اختر عضوًا أولًا.");$("#chatImageInput").click()};$("#chatImageInput").onchange=async e=>{const f=e.target.files?.[0];e.target.value="";if(f)await sendChatImage(f)};$("#voiceBtn").onclick=toggleVoiceRecording;$("#messageForm").onsubmit=sendMessage;window.addEventListener("pagehide",()=>{if(state.user?.id){supabaseClient.from("profiles").update({is_online:false,last_seen:new Date().toISOString()}).eq("id",state.user.id)}});$("#logout").onclick=async()=>{await stopPresence();await supabaseClient.auth.signOut();if(state.channel)await supabaseClient.removeChannel(state.channel);if(state.notificationChannel)await supabaseClient.removeChannel(state.notificationChannel);if(state.presenceChannel)await supabaseClient.removeChannel(state.presenceChannel);location.reload()}}
async function boot(){const {data}=await supabaseClient.auth.getSession();if(data.session){try{await loadProfile(data.session.user.id);await showChat()}catch(err){console.error(err);await supabaseClient.auth.signOut()}}supabaseClient.auth.onAuthStateChange(async(event,session)=>{if(session&&!state.profile){try{await loadProfile(session.user.id);await showChat()}catch(err){console.error(err)}}})}
$("#registerForm").onsubmit=register;
$("#loginForm").onsubmit=login;
boot();
const chats=[
{name:"محمد",letter:"م",last:"السلام عليكم، كيف حالك؟",time:"10:32"},
{name:"أحمد",letter:"أ",last:"تشرفت بمعرفتك",time:"أمس"},
{name:"يوسف",letter:"ي",last:"بارك الله فيك",time:"أمس"}
];
const list=document.getElementById("chatList"),search=document.getElementById("searchInput"),empty=document.getElementById("emptyChat"),conversation=document.getElementById("conversation"),messages=document.getElementById("messages"),toast=document.getElementById("toast");
let active=null;
function render(q=""){list.innerHTML="";chats.filter(c=>c.name.includes(q)||c.last.includes(q)).forEach((c,i)=>{const el=document.createElement("div");el.className="chat-item"+(active?.name===c.name?" active":"");el.innerHTML=`<div class="avatar">${c.letter}</div><div class="chat-info"><b>${c.name}</b><span>${c.last}</span></div><small class="time">${c.time}</small>`;el.onclick=()=>openChat(c);list.appendChild(el)})}
function openChat(c){active=c;empty.classList.add("hidden");conversation.classList.remove("hidden");document.getElementById("chatName").textContent=c.name;document.getElementById("chatAvatar").textContent=c.letter;messages.innerHTML="";addBubble(c.last,"them");render(search.value)}
function addBubble(text,who){const d=document.createElement("div");d.className="bubble "+who;d.textContent=text;messages.appendChild(d);messages.scrollTop=messages.scrollHeight}
document.getElementById("messageForm").addEventListener("submit",e=>{e.preventDefault();const input=document.getElementById("messageInput");if(!input.value.trim())return;addBubble(input.value.trim(),"me");input.value="";setTimeout(()=>active&&addBubble("وصلت رسالتك 👍","them"),600)});
search.addEventListener("input",()=>render(search.value));
document.getElementById("backBtn").onclick=()=>{conversation.classList.add("hidden");empty.classList.remove("hidden")};
document.getElementById("startBtn").onclick=()=>document.getElementById("authModal").classList.remove("hidden");
document.getElementById("newChatBtn").onclick=()=>document.getElementById("authModal").classList.remove("hidden");
document.getElementById("profileBtn").onclick=()=>document.getElementById("profileModal").classList.remove("hidden");
document.getElementById("mobileProfileBtn").onclick=()=>document.getElementById("profileModal").classList.remove("hidden");
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>b.closest(".modal").classList.add("hidden"));
document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tabs button").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.getElementById("loginForm").classList.toggle("hidden",b.dataset.tab!=="login");document.getElementById("signupForm").classList.toggle("hidden",b.dataset.tab!=="signup")});
document.getElementById("loginForm").onsubmit=e=>{e.preventDefault();toastMsg("سيتم ربط تسجيل الدخول الحقيقي في المرحلة التالية");};
document.getElementById("signupForm").onsubmit=e=>{e.preventDefault();toastMsg("سيتم ربط إنشاء الحساب الحقيقي في المرحلة التالية");};
function toastMsg(t){toast.textContent=t;toast.classList.add("show");setTimeout(()=>toast.classList.remove("show"),2500)}
render();
(() => {
  const originalRegister=window.doRegister;
  window.doRegister=async function(ev){
    const g=document.getElementById("r-gender");
    const old=g.value;
    g.value=old==="أنثى"?"female":"male";
    try{return await originalRegister(ev);}finally{g.value=old;}
  };
  const hideLegacySecret=()=>document.querySelector("#login-form p")?.remove();
  hideLegacySecret();
  const oldOpenAdmin=window.openAdmin;
  window.openAdmin=async function(){hideLegacySecret();return oldOpenAdmin();};
})();
(() => {
  // Registration gender is normalized inside supabase-bridge.js.
  // Do not change the select value here: its options are Arabic labels.
  const hideLegacySecret=()=>document.querySelector("#login-form p")?.remove();
  hideLegacySecret();
  const oldOpenAdmin=window.openAdmin;
  if(oldOpenAdmin){
    window.openAdmin=async function(){hideLegacySecret();return oldOpenAdmin();};
  }
})();
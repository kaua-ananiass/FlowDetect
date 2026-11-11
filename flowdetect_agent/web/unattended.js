window.initUnattended = function({invoke,video,native}) {
  const form=document.getElementById('agentUnattendedForm');
  const message=document.getElementById('agentUnattendedStatus');
  const password=document.getElementById('agentAccessPassword');
  const confirm=document.getElementById('agentAccessPasswordConfirm');
  const disable=document.getElementById('agentUnattendedDisable');
  let busy=false;
  function show(status){
    message.textContent=status.enabled?'Acesso não assistido ativo · captura nativa · sessão Windows desbloqueada':'Acesso não assistido desligado';
    disable.disabled=!status.enabled;
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;
    if(password.value!==confirm.value){message.textContent='As senhas não conferem.';return;}
    busy=true;const secret=password.value;password.value='';confirm.value='';
    try {
      const status=await invoke('agent_unattended_configure',{enabled:true,password:secret});
      window.dispatchEvent(new Event('flowdetect-input-state-changed'));
      native.stop();video.stop();show(status);await video.enable();
    }catch(error){message.textContent=String(error.message || error);}finally{busy=false;}
  });
  disable.addEventListener('click',async()=>{
    if(busy)return;busy=true;native.stop();video.stop();
    try{show(await invoke('agent_unattended_configure',{enabled:false,password:''}));window.dispatchEvent(new Event('flowdetect-input-state-changed'));}
    catch(error){message.textContent=String(error.message || error);}finally{busy=false;}
  });
  invoke('agent_unattended_status').then(async status=>{show(status);if(status.enabled)await video.enable();})
    .catch(error=>{message.textContent=String(error.message || error);});
  setInterval(async()=>{
    try{const status=await invoke('agent_unattended_status');if(!status.enabled){native.stop();video.stop();}}
    catch{}
  },5000);
};

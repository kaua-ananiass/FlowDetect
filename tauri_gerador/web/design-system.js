/* Interactive visual reference. Never invokes the automation runtime. */
(function(){
  "use strict";
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const I=n=>`<svg class="ds-icon" aria-hidden="true"><use href="#ds-i-${n}"/></svg>`;
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const themeMedia=matchMedia("(prefers-color-scheme: dark)");
  let choice=document.body.dataset.themeChoice||"dark";
  function theme(c,persist=true){
    choice=c;
    document.body.dataset.themeChoice=c;
    document.body.dataset.theme=c==="system"?(themeMedia.matches?"dark":"light"):c;
    document.documentElement.style.colorScheme=document.body.dataset.theme;
    $('meta[name="theme-color"]').content=document.body.dataset.theme==="dark"?"#07111F":"#F3F7FA";
    $$("[data-ds-theme]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.dsTheme===c)));
    if(persist)try{localStorage.setItem("flowdetect-design-theme",c);}catch{}
  }
  theme(choice,false);
  $$("[data-ds-theme]").forEach(b=>b.addEventListener("click",()=>theme(b.dataset.dsTheme)));
  themeMedia.addEventListener("change",()=>{if(choice==="system")theme("system",false);});
  let toastTimer;
  function notify(text){
    clearTimeout(toastTimer);
    $("#ds-toast").textContent=text;$("#ds-toast").hidden=false;
    toastTimer=setTimeout(()=>{$("#ds-toast").hidden=true;},3800);
  }
  $$("[data-ds-filter]").forEach(b=>b.addEventListener("click",()=>{
    const cat=b.dataset.dsFilter;
    $$("[data-ds-filter]").forEach(n=>n.setAttribute("aria-pressed",String(n===b)));
    let count=0;
    $$(".ds-command-card").forEach(card=>{card.hidden=cat!=="all"&&card.dataset.category!==cat;if(!card.hidden)count++;});
    $("#ds-block-count").textContent=count+" "+(count===1?"tipo de bloco":"tipos de bloco");
  }));
  $$("[data-ds-block-form]").forEach(form=>form.addEventListener("submit",e=>{
    e.preventDefault();if(!form.reportValidity())return;
    const card=form.closest(".ds-command-card");
    const value=String(new FormData(form).get("block-name")).trim();
    if(!value){$('[name="block-name"]',form).focus();return;}
    $("[data-ds-preview]",card).textContent=value;
    card.dataset.configured="true";
    notify("Configuração refletida no card de exemplo.");
  }));
  function flip(card){
    let back=$(".automation-library-card-back",card);
    if(!back){
      const name=$(".automation-library-card-front h3",card).textContent;
      back=document.createElement("section");back.className="automation-library-card-face automation-library-card-back";
      back.innerHTML=`<h3>Detalhes da automação</h3><form class="ds-command-form" data-ds-library-form><label><span>Nome</span><input name="library-name" value="${esc(name)}" required></label><label><span>Descrição</span><textarea>Fluxo demonstrativo.</textarea></label><div class="ds-row"><button type="button" class="primary-button" data-ds-submit-library>Salvar</button><button type="button" class="ghost-button" data-ds-flip>Voltar</button></div></form>`;
      $(".automation-library-card-stage",card).append(back);
      card.classList.add("ds-library-card");
      bindLibraryForm($("form",back));
    }
    const front=$(".automation-library-card-front",card);
    const flipped=card.classList.toggle("is-flipped");
    front.inert=flipped;front.setAttribute("aria-hidden",String(flipped));
    back.inert=!flipped;back.setAttribute("aria-hidden",String(!flipped));
    const target=flipped?$("input",back):$("button",front);
    target?.focus({preventScroll:true});
  }
  function bindLibraryForm(form){
    form.addEventListener("submit",e=>{
      e.preventDefault();if(!form.reportValidity())return;
      const name=$('[name="library-name"]',form).value.trim();if(!name)return;
      const card=form.closest(".automation-library-card");
      $(".automation-library-card-front h3",card).textContent=name;
      flip(card);notify("Nome do card atualizado nesta demonstração.");
    });
  }
  $$("[data-ds-library-form]").forEach(bindLibraryForm);

  const dialog=$("#ds-dialog");let dialogAction=null,origin=null;
  function openDialog(title,body,submit,action,danger=false){
    origin=document.activeElement;
    $("#ds-dialog-title").textContent=title;
    $("#ds-dialog-content").innerHTML=body;
    $("#ds-dialog-submit").textContent=submit;
    $("#ds-dialog-submit").className=danger?"danger-button":"primary-button";
    dialogAction=action;dialog.showModal();
  }
  $("#ds-dialog-form").addEventListener("submit",e=>{
    e.preventDefault();if(!e.target.reportValidity())return;
    if(dialogAction?.(new FormData(e.target))===false)return;
    dialog.close();
  });
  dialog.addEventListener("close",()=>{dialogAction=null;if(origin?.isConnected)origin.focus({preventScroll:true});});
  dialog.addEventListener("click",e=>{
    if(e.target!==dialog)return;
    const r=dialog.getBoundingClientRect();
    if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();
  });
  function windowDialog(){
    openDialog("Selecionar janela",`<p>Escolha o aplicativo que receberá a automação.</p><label class="ds-checkbox"><input type="radio" name="window" value="Portal fiscal" checked>Portal fiscal · Chrome</label><label class="ds-checkbox"><input type="radio" name="window" value="ERP">ERP · Cadastro de empresas</label><label class="ds-checkbox"><input type="radio" disabled>FlowDetect Studio · bloqueado</label><p class="ds-caption">Janelas ilustrativas. A captura real é feita no aplicativo.</p>`,"Selecionar",d=>notify("Janela selecionada no exemplo: "+d.get("window")+"."));
  }
  let timer=null,index=0;
  const steps=["Abrir portal","Preencher empresa","Reconhecer confirmação","Salvar download","Registrar resultado"];
  function stop(completed=false){
    clearInterval(timer);timer=null;
    $("#ds-run-start").disabled=false;$("#ds-run-stop").disabled=true;$("#ds-runtime-value").disabled=false;
    $("#ds-run-status").textContent=completed?"Simulação concluída":"Simulação interrompida";
    if(!completed)$("#ds-run-caption").textContent="Execução parada. As etapas pendentes não foram executadas.";
  }
  function reset(){
    clearInterval(timer);timer=null;index=0;
    $("#ds-run-percent").textContent="0%";$("#ds-run-progress").value=0;$("#ds-run-step").textContent="0 de 5 etapas";
    $("#ds-run-caption").textContent="Tudo pronto para começar.";$("#ds-run-status").textContent="Aguardando início da simulação";
    $("#ds-run-start").disabled=false;$("#ds-run-stop").disabled=true;$("#ds-runtime-value").disabled=false;
    $("#ds-run-log").innerHTML=`<li>${I("clock")}Aguardando execução <time>00:00</time></li>`;
  }
  function start(){
    reset();$("#ds-run-start").disabled=true;$("#ds-run-stop").disabled=false;$("#ds-runtime-value").disabled=true;
    $("#ds-run-status").textContent="Executando simulação";$("#ds-run-caption").textContent=steps[0];$("#ds-run-log").innerHTML="";
    timer=setInterval(()=>{
      const li=document.createElement("li");li.innerHTML=I("check")+"<span>"+steps[index]+"</span><time>00:0"+(index+1)+"</time>";
      $("#ds-run-log").append(li);index++;
      $("#ds-run-progress").value=index*20;$("#ds-run-percent").textContent=index*20+"%";$("#ds-run-step").textContent=index+" de 5 etapas";
      $("#ds-run-caption").textContent=index===5?"Todas as etapas foram concluídas.":steps[index];
      if(index===5){stop(true);notify("Simulação concluída: 5 de 5 etapas.");}
    },900);
  }
  $("#ds-run-start").addEventListener("click",start);$("#ds-run-stop").addEventListener("click",()=>stop());
  $("#ds-run-reset").addEventListener("click",reset);window.addEventListener("pagehide",()=>clearInterval(timer));
  const scroll=(el)=>el.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth",block:"start"});
  $$("[data-ds-page]").forEach(b=>b.addEventListener("click",()=>{
    $("#ds-full-map").dataset.page=b.dataset.dsPage;
    $$("[data-ds-page]").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));
    const names={principal:"Encontrar “Emitir guia”",pagina_2:"Encontrar “Guia emitida”",pagina_3:"Conferir valor da guia",pagina_4:"Confirmar download"};
    $("#ds-map-recognition-title").textContent="03 · "+names[b.dataset.dsPage];
  }));
  $("#ds-confidence").addEventListener("input",e=>$("#ds-confidence-output").textContent=e.target.value+"%");
  $("#ds-screen-guard").addEventListener("change",e=>{
    $("#ds-extension-run").disabled=!e.target.checked;
    $("#ds-guard-message").textContent=e.target.checked?"Tela inicial confirmada. URL e texto correspondem.":"Abra a tela inicial configurada.";
    $("#ds-guard-message").classList.toggle("is-success",e.target.checked);
  });
  $("#ds-welcome-form").addEventListener("submit",e=>{e.preventDefault();notify("Bem-vindo ao exemplo visual do FlowDetect Studio.");});
  function updateTypeLabels(){
    $$(".ds-type-row").forEach(row=>{
      const preview=$(".ds-type-preview",row);
      const sample=preview.querySelector("h1,h2,h3,h4,strong,.workspace-tab")||preview.querySelector("p");
      const label=$(".ds-size-chip",row);
      if(!sample||!label)return;
      const style=getComputedStyle(sample);
      label.textContent=Math.round(parseFloat(style.fontSize))+"px / "+Math.round(parseFloat(style.lineHeight))+"px";
    });
  }
  requestAnimationFrame(updateTypeLabels);
  document.fonts?.ready.then(updateTypeLabels);
  window.addEventListener("resize",updateTypeLabels);
  // A single light follows precise pointers; touch and reduced motion stay static.
  const finePointer=matchMedia("(hover: hover) and (pointer: fine)");
  const reducedMotion=matchMedia("(prefers-reduced-motion: reduce)");
  let lightFrame=0,lightSample=null;
  document.addEventListener("pointermove",event=>{
    if(!finePointer.matches||reducedMotion.matches)return;
    const surface=event.target.closest?.(".ds-command-card,.ds-library-card .automation-library-card-face");
    if(!surface)return;
    lightSample={surface,x:event.clientX,y:event.clientY};
    if(lightFrame)return;
    lightFrame=requestAnimationFrame(()=>{
      lightFrame=0;
      if(!lightSample.surface.isConnected||reducedMotion.matches)return;
      const rect=lightSample.surface.getBoundingClientRect();
      lightSample.surface.style.setProperty("--ds-pointer-x",Math.round(lightSample.x-rect.left)+"px");
      lightSample.surface.style.setProperty("--ds-pointer-y",Math.round(lightSample.y-rect.top)+"px");
    });
  },{passive:true});
  document.addEventListener("click",e=>{
    const b=e.target.closest("button");if(!b)return;
    if(b.matches("[data-ds-theme],[data-ds-filter],[data-ds-page],[data-replay-target],[data-replay-class-target]"))return;
    if(b.hasAttribute("data-ds-feedback")){notify(b.dataset.dsFeedback);return;}
    if(b.hasAttribute("data-ds-submit-block")){b.closest("form").requestSubmit();return;}
    if(b.hasAttribute("data-ds-submit-library")){b.closest("form").requestSubmit();return;}
    if(b.matches("[data-ds-flip],.launcher-flip-trigger")){flip(b.closest(".automation-library-card"));return;}
    if(b.hasAttribute("data-ds-duplicate")){
      const card=b.closest(".automation-library-card"),clone=card.cloneNode(true);
      clone.classList.remove("is-active","is-flipped");
      const title=$(".automation-library-card-front h3",clone);title.textContent+=" · cópia";
      $('[name="library-name"]',clone).value=title.textContent;
      bindLibraryForm($("form",clone));card.parentElement.append(clone);notify("Card duplicado no exemplo.");return;
    }
    if(b.hasAttribute("data-ds-run-start")){scroll($("#ds-execution"));start();return;}
    if(b.hasAttribute("data-ds-monitor")){scroll($("#ds-monitor"));return;}
    if(b.hasAttribute("data-ds-open-text")){
      $$("[data-ds-filter]").find(x=>x.dataset.dsFilter==="all").click();
      const card=$('[data-ds-command="text"]');$("details",card).open=true;scroll(card);return;
    }
    if(b.hasAttribute("data-ds-recognition")){$("#ds-recognition-result").textContent="Teste demonstrativo: OCR 1 e OCR 2 encontrados. Rotas prontas para revisão.";notify("2 alvos reconhecidos na simulação.");return;}
    if(b.hasAttribute("data-ds-window")||b.textContent.trim()==="Selecionar janela"){windowDialog();return;}
    if(b.hasAttribute("data-ds-key")){
      openDialog("Capturar tecla ou atalho",`<p>Clique no campo e pressione a combinação. Escape cancela.</p><label><span>Combinação</span><input id="ds-key-input" name="shortcut" readonly required placeholder="Pressione as teclas"></label><p class="ds-caption">A captura fica limitada a este campo.</p>`,"Confirmar",d=>{if(!d.get("shortcut")){notify("Pressione uma tecla no campo.");return false;}notify("Atalho confirmado: "+d.get("shortcut")+".");});
      const input=$("#ds-key-input");input.addEventListener("keydown",event=>{
        if(["Escape","Tab"].includes(event.key))return;event.preventDefault();
        const parts=[event.ctrlKey&&"Ctrl",event.altKey&&"Alt",event.shiftKey&&"Shift",event.metaKey&&"Meta"].filter(Boolean);
        if(!["Control","Alt","Shift","Meta"].includes(event.key))parts.push(event.key===" "?"Espaço":event.key.length===1?event.key.toUpperCase():event.key);
        input.value=parts.join(" + ");
      });input.focus();return;
    }
    if(b.hasAttribute("data-ds-close")){dialog.close();return;}
    if(b.hasAttribute("data-ds-confirm")||b.textContent.trim()==="Parar"){
      openDialog("Parar a execução?",'<p>As etapas pendentes não serão executadas. Você poderá revisar o resultado e testar novamente.</p><p class="ds-caption">Esta ação afeta somente a simulação da página.</p>',"Parar execução",()=>{if(timer)stop();notify("Execução demonstrativa interrompida.");},true);return;
    }
    if(b.matches("#ds-run-start,#ds-run-stop,#ds-run-reset,#ds-dialog-submit")||b.type==="submit")return;
    if(b.textContent.trim().startsWith("Testar")){scroll($("#ds-execution"));start();return;}
    if(b.closest(".ds-theme-toggle"))return;
    notify("Exemplo visual: "+b.textContent.trim()+".");
  });
})();

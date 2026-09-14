/* The main page drops its loading veil once the existing streams can begin. */
(() => {
  const root=document.documentElement,screen=document.querySelector('#entry-screen');
  if(!root.classList.contains('entry-pending')||!screen)return;
  const enter=screen.querySelector('#entry-open'),skip=screen.querySelector('#entry-skip');
  const message=screen.querySelector('#entry-message');
  const slots={motion:{state:'unbound'},music:{state:'unbound'}};
  const background=[...document.body.children].filter(el=>el!==screen&&el.tagName!=='SCRIPT');
  const previousInert=background.map(el=>el.inert);
  background.forEach(el=>{el.inert=true;});
  let timedOut=false,opening=false,leaving=false,pollTimer;
  const cleanups=new Map();
  function reveal(){
    if(leaving)return;
    leaving=true;clearTimeout(deadlineTimer);clearTimeout(pollTimer);
    document.removeEventListener('visibilitychange',render);
    skip.hidden=true;
    cleanups.forEach(dispose=>dispose());cleanups.clear();
    background.forEach((el,i)=>{el.inert=previousInert[i];});
    root.classList.remove('entry-pending');screen.classList.add('entry-opening','entry-leaving');
    document.dispatchEvent(new Event('wedding:revealed'));
    const finish=()=>{screen.hidden=true;screen.classList.remove('entry-leaving');};
    screen.addEventListener('transitionend',event=>{if(event.target===screen)finish();},{once:true});
    setTimeout(finish,800);
    const heading=document.querySelector('#us-title');heading?.setAttribute('tabindex','-1');heading?.focus({preventScroll:true});
  }
  function render(){
    if(leaving)return;
    const failed=Object.values(slots).some(slot=>slot.state==='error');
    screen.classList.toggle('entry-paused',document.hidden);
    enter.disabled=Object.values(slots).some(slot=>slot.state==='unbound');
    enter.setAttribute('aria-busy','true');
    message.textContent=opening?'欢喜即将开场…':'正在准备开场，首段画面缓冲后自动进入';
    skip.hidden=!failed;
    screen.classList.toggle('entry-delayed',!skip.hidden);
    if(document.hidden)return;
    if(timedOut){enterInvitation(true,true);return;}
    // iOS can defer audio preload and frame decoding until play() is requested.
    // Neither audio permission nor a pending play promise is a loading condition.
    const buffered=['ready','skipped','error'].includes(slots.motion.state);
    if(!opening&&buffered&&!enter.disabled){enterInvitation(false,true);return;}
    if(opening&&buffered)reveal();
  }
  function measure(kind,media){
    let buffered=0;
    for(let i=0;i<media.buffered.length;i++)if(media.buffered.start(i)<=media.currentTime+.1&&media.buffered.end(i)>=media.currentTime)buffered=Math.max(buffered,media.buffered.end(i)-media.currentTime);
    const remaining=Number.isFinite(media.duration)?media.duration-media.currentTime:Infinity;
    // Use real buffered seconds, including WebKit's metadata/first-frame states.
    // The native player decodes while the cover fades; no full-file wait or fetch.
    const ready=media.readyState>=1&&buffered>0&&buffered>=Math.min(.4,remaining*.9);
    slots[kind]={media,state:media.error?'error':ready?'ready':'loading'};
  }
  function enterInvitation(force=false,automatic=false){
    if(leaving)return;
    if(!opening){
      opening=true;window.WeddingEntry.pending=false;
      // A tap can still start playback immediately with its user activation.
      // Automatic opening must not depend on permission for audible autoplay.
      document.dispatchEvent(new CustomEvent('wedding:enter',{detail:{automatic}}));
    }
    if(force)reveal();else render();
  }
  window.WeddingEntry={pending:true,
    track(kind,media){
      if(leaving||!slots[kind])return;
      cleanups.get(kind)?.();
      const update=()=>{
        measure(kind,media);
        render();
      };
      const events=['loadedmetadata','loadeddata','durationchange','progress','suspend','canplay','playing','error','emptied'];
      events.forEach(event=>media.addEventListener(event,update));
      cleanups.set(kind,()=>events.forEach(event=>media.removeEventListener(event,update)));
      update();
    },
    unavailable(kind){
      if(leaving||!slots[kind])return;
      cleanups.get(kind)?.();cleanups.delete(kind);
      slots[kind]={state:'skipped'};render();
    },
    fail(kind){if(!leaving&&slots[kind]){slots[kind]={state:'error'};render();}},
    blocked(){render();}
  };
  // A stalled request or mobile preload restriction cannot hold the invitation
  // indefinitely. Keep the existing portrait visible and continue native loading.
  const deadlineTimer=setTimeout(()=>{timedOut=true;render();},6000);
  function poll(){
    if(leaving)return;
    for(const [kind,slot]of Object.entries(slots))if(slot.media)measure(kind,slot.media);
    render();
    if(!leaving)pollTimer=setTimeout(poll,250);
  }
  pollTimer=setTimeout(poll,250);
  document.addEventListener('visibilitychange',render);
  enter.addEventListener('click',()=>enterInvitation());skip.addEventListener('click',()=>enterInvitation(true));
  screen.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();enterInvitation(true);}
    if(event.key==='Tab'){
      const buttons=[enter,skip].filter(button=>!button.hidden&&!button.disabled);
      if(event.shiftKey&&document.activeElement===buttons[0]){event.preventDefault();buttons.at(-1).focus();}
      else if(!event.shiftKey&&document.activeElement===buttons.at(-1)){event.preventDefault();buttons[0].focus();}
    }
  });
  render();screen.focus({preventScroll:true});
})();

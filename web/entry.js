/* A real tap starts the existing streams; reveal as soon as their first portion is playable. */
(() => {
  const root=document.documentElement,screen=document.querySelector('#entry-screen');
  if(!root.classList.contains('entry-pending')||!screen)return;
  const enter=screen.querySelector('#entry-open'),skip=screen.querySelector('#entry-skip');
  const message=screen.querySelector('#entry-message');
  const slots={motion:{state:'unbound'},music:{state:'unbound'}};
  const background=[...document.body.children].filter(el=>el!==screen&&el.tagName!=='SCRIPT');
  const previousInert=background.map(el=>el.inert);
  background.forEach(el=>{el.inert=true;});
  let slow=false,opening=false,leaving=false;
  const cleanups=new Map();
  function reveal(){
    if(leaving)return;
    leaving=true;clearTimeout(slowTimer);
    skip.hidden=true;
    cleanups.forEach(dispose=>dispose());cleanups.clear();
    background.forEach((el,i)=>{el.inert=previousInert[i];});
    root.classList.remove('entry-pending');screen.classList.add('entry-leaving');
    document.dispatchEvent(new Event('wedding:revealed'));
    const finish=()=>{screen.hidden=true;screen.classList.remove('entry-leaving');};
    screen.addEventListener('transitionend',event=>{if(event.target===screen)finish();},{once:true});
    setTimeout(finish,800);
    const heading=document.querySelector('#us-title');heading?.setAttribute('tabindex','-1');heading?.focus({preventScroll:true});
  }
  function render(){
    if(leaving)return;
    const failed=Object.values(slots).some(slot=>slot.state==='error');
    const incomplete=Object.values(slots).some(slot=>!['ready','skipped'].includes(slot.state));
    enter.disabled=Object.values(slots).some(slot=>slot.state==='unbound');
    enter.setAttribute('aria-busy',String(opening));
    message.textContent=opening?'欢喜即将开场…':'轻触信封或封蜡，开启喜帖';
    skip.hidden=!(failed||(slow&&(opening||incomplete)));
    screen.classList.toggle('entry-delayed',!skip.hidden);
    if(opening&&Object.values(slots).every(slot=>slot.state==='skipped'||slot.state==='error'||(slot.state==='ready'&&!slot.media.paused)))reveal();
  }
  function enterInvitation(force=false){
    if(leaving)return;
    if(!opening){
      opening=true;window.WeddingEntry.pending=false;screen.classList.add('entry-opening');
      // Keep user activation: invoke music/video play() inside the actual tap.
      document.dispatchEvent(new Event('wedding:enter'));
    }
    if(force)reveal();else render();
  }
  window.WeddingEntry={pending:true,
    track(kind,media){
      if(leaving||!slots[kind])return;
      cleanups.get(kind)?.();
      const update=()=>{
        let buffered=0;
        for(let i=0;i<media.buffered.length;i++)if(media.buffered.start(i)<=media.currentTime+.1&&media.buffered.end(i)>=media.currentTime)buffered=Math.max(buffered,media.buffered.end(i)-media.currentTime);
        // HAVE_FUTURE_DATA plus a small lead is enough. Never require
        // canplaythrough, the MP4's end, or the full music recording.
        const remaining=Number.isFinite(media.duration)?media.duration-media.currentTime:Infinity;
        const ready=media.readyState>=3&&buffered>=Math.min(.4,remaining*.9);
        slots[kind]={media,state:media.error?'error':ready?'ready':'loading'};
        render();
      };
      const events=['loadedmetadata','loadeddata','progress','canplay','playing','error','emptied'];
      events.forEach(event=>media.addEventListener(event,update));
      cleanups.set(kind,()=>events.forEach(event=>media.removeEventListener(event,update)));
      update();
    },
    unavailable(kind){
      if(leaving||!slots[kind])return;
      cleanups.get(kind)?.();cleanups.delete(kind);
      slots[kind]={state:'skipped'};render();
    },
    fail(kind){if(!leaving&&slots[kind]){slots[kind]={state:'error'};render();}}
  };
  const slowTimer=setTimeout(()=>{slow=true;render();},8000);
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

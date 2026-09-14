/* One opening gate coordinates the existing players; it owns no extra media. */
(() => {
  const root=document.documentElement,screen=document.querySelector('#entry-screen');
  if(!root.classList.contains('entry-pending')||!screen)return;
  const enter=screen.querySelector('#entry-open'),skip=screen.querySelector('#entry-skip');
  const message=screen.querySelector('#entry-message'),progress=screen.querySelector('progress');
  const slots={motion:{state:'loading',fraction:0},music:{state:'loading',fraction:0}};
  const background=[...document.body.children].filter(el=>el!==screen&&el.tagName!=='SCRIPT');
  const previousInert=background.map(el=>el.inert);
  background.forEach(el=>{el.inert=true;});
  let slow=false,leaving=false;
  const cleanups=new Map();
  function render(){
    if(leaving)return;
    const ready=Object.values(slots).every(slot=>slot.state==='ready'||slot.state==='skipped');
    const failed=Object.values(slots).some(slot=>slot.state==='error');
    enter.disabled=!ready;
    enter.querySelector('span').textContent=ready?'开启请柬':'正在准备';
    screen.classList.toggle('entry-ready',ready);
    progress.value=Object.values(slots).reduce((sum,slot)=>sum+slot.fraction,0);
    for(const [kind,slot]of Object.entries(slots)){
      const label=screen.querySelector('[data-entry-state="'+kind+'"]');
      label.dataset.state=slot.state;
      label.textContent=(kind==='motion'?'画面':'音乐')+(slot.state==='ready'?'已就绪':slot.state==='skipped'?'未启用':slot.state==='error'?'稍后加载':'准备中');
    }
    message.textContent=ready?'良辰已至，等你开启。':failed?'部分内容暂未备好，可以先看请柬。':slow?'网络慢一点，可以先进入，边看边加载。':'正在备好画面与音乐…';
  }
  function enterInvitation(){
    if(leaving)return;
    leaving=true;window.WeddingEntry.pending=false;clearTimeout(slowTimer);
    cleanups.forEach(dispose=>dispose());cleanups.clear();
    background.forEach((el,i)=>{el.inert=previousInert[i];});
    root.classList.remove('entry-pending');screen.classList.add('entry-leaving');
    // Synchronous dispatch preserves the click's activation for audible play().
    document.dispatchEvent(new Event('wedding:enter'));
    const finish=()=>{screen.hidden=true;screen.classList.remove('entry-leaving');};
    screen.addEventListener('transitionend',event=>{if(event.target===screen)finish();},{once:true});
    setTimeout(finish,650);
    const heading=document.querySelector('#us-title');heading?.setAttribute('tabindex','-1');heading?.focus({preventScroll:true});
  }
  window.WeddingEntry={pending:true,
    track(kind,media){
      if(!this.pending||!slots[kind])return;
      cleanups.get(kind)?.();
      const update=()=>{
        let buffered=0;
        // Measure actual playable media ahead of the first frame, not elapsed time.
        for(let i=0;i<media.buffered.length;i++)if(media.buffered.start(i)<=.1)buffered=Math.max(buffered,media.buffered.end(i));
        const duration=Number.isFinite(media.duration)&&media.duration>0?media.duration:Infinity;
        // Do not wait for the container's exact end: MP4 duration can include
        // timestamp padding beyond its final buffered frame.
        const target=Math.min(2,duration*.95);
        const fraction=Math.min(1,buffered/Math.max(.1,target-.15));
        // Browsers may stop preloading once they estimate uninterrupted playback.
        // HAVE_ENOUGH_DATA is ready even when they elect not to fetch the whole clip.
        const ready=media.readyState>=4||(media.readyState>=3&&fraction>=1);
        slots[kind]={state:media.error?'error':ready?'ready':'loading',fraction:ready?1:Math.min(.95,fraction)};
        render();
      };
      const events=['loadedmetadata','loadeddata','progress','canplay','canplaythrough','error','emptied'];
      events.forEach(event=>media.addEventListener(event,update));
      cleanups.set(kind,()=>events.forEach(event=>media.removeEventListener(event,update)));
      update();
    },
    unavailable(kind){
      if(!this.pending||!slots[kind])return;
      cleanups.get(kind)?.();cleanups.delete(kind);
      slots[kind]={state:'skipped',fraction:1};render();
    },
    fail(kind){
      if(!this.pending||!slots[kind])return;
      slots[kind]={state:'error',fraction:0};render();
    }
  };
  const slowTimer=setTimeout(()=>{slow=true;render();},12000);
  enter.addEventListener('click',enterInvitation);skip.addEventListener('click',enterInvitation);
  screen.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();enterInvitation();}
    if(event.key==='Tab'){
      const buttons=[enter,skip].filter(button=>!button.disabled);
      if(event.shiftKey&&document.activeElement===buttons[0]){event.preventDefault();buttons.at(-1).focus();}
      else if(!event.shiftKey&&document.activeElement===buttons.at(-1)){event.preventDefault();buttons[0].focus();}
    }
  });
  render();screen.focus({preventScroll:true});
})();

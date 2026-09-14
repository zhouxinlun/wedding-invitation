(() => {
  const config=window.WEDDING.coupleMotion,frame=document.querySelector('.us-photo'),video=frame?.querySelector('video');
  if(!config?.enabled||!video||!window.IntersectionObserver){window.WeddingEntry?.unavailable('motion');return;}
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let visible=false,pending=false,failed=false,expiresAt=0,pageActive=true,retries=0,retryTimer;
  const portrait=frame.closest('.opening-portrait');
  let popout,canvas,compositor,popoutTurn=false,animation,reelLoading,backgroundStarted=false;
  if(config.webPopoutFile&&portrait&&window.createWeddingPopout){
    popout=document.createElement('video');popout.className='popout-source';popout.preload='none';
    popout.muted=true;popout.playsInline=true;popout.setAttribute('muted','');popout.setAttribute('playsinline','');popout.setAttribute('aria-hidden','true');
    canvas=document.createElement('canvas');canvas.className='popout-canvas';canvas.setAttribute('aria-hidden','true');
    compositor=window.createWeddingPopout(popout,canvas);
    if(compositor){portrait.append(popout,canvas);popoutTurn=true;}
  }
  video.loop=true;video.muted=true;video.playsInline=true;
  if(compositor)video.loop=false;
  const active=()=>popoutTurn?popout:video;
  const wanted=()=>!window.WeddingEntry?.pending&&pageActive&&visible&&!document.hidden&&!reduced.matches&&!document.querySelector('dialog[open]');
  async function prepareReel(force=false){
    if(reelLoading)return reelLoading;
    if(!force&&video.getAttribute('src')&&expiresAt>Date.now()+15000)return;
    reelLoading=(async()=>{
      const media=await window.WeddingCloud.motion(force);
      if(!wanted()&&!window.WeddingEntry?.pending)return;
      video.preload='auto';video.src=media.url;expiresAt=media.expiresAt;failed=false;video.load();
    })();
    try{await reelLoading;}finally{reelLoading=null;}
  }
  function prepareOpening(){
    if(!window.WeddingEntry?.pending)return;
    if(reduced.matches){window.WeddingEntry.unavailable('motion');return;}
    window.WeddingEntry.track('motion',active());
    if(popoutTurn){popout.preload='auto';popout.src=config.webPopoutFile;popout.load();}
    else prepareReel().catch(()=>window.WeddingEntry?.fail('motion'));
  }
  function stopDrawing(){
    if(popout?.cancelVideoFrameCallback)popout.cancelVideoFrameCallback(animation);else cancelAnimationFrame(animation);
    animation=null;portrait?.classList.remove('popout-playing');
  }
  function warmBackground(){
    if(backgroundStarted||!window.WeddingEntry||document.documentElement.classList.contains('entry-pending'))return;
    // Let the untouched HD stream keep the bandwidth until its remaining frames
    // are buffered. Album navigation can still request its own photos on demand.
    if(compositor&&popout&&!reduced.matches&&!popout.error&&!popout.ended){
      if(!Number.isFinite(popout.duration)||!popout.buffered.length||popout.buffered.end(popout.buffered.length-1)<popout.duration-.15)return;
    }
    backgroundStarted=true;
    document.dispatchEvent(new Event('wedding:opening-buffered'));
    if(popoutTurn)prepareReel().catch(()=>{});
  }
  function disablePopout(){
    stopDrawing();popout?.pause();popoutTurn=false;compositor?.dispose();compositor=null;
    popout?.remove();canvas?.remove();video.loop=true;
    prepareOpening();
    warmBackground();
  }
  function draw(){
    animation=null;if(!wanted()||!popoutTurn||popout.paused)return;
    try{
      if(compositor.draw()){
        // Hold the frame still. Only the extracted people step across its edge.
        const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
        const lift=ease((popout.currentTime-1.2)/1.5)*(1-ease((popout.currentTime-5.5)/2));
        canvas.style.transform=`translateY(${-3*lift}%) scale(${1+.24*lift})`;
        portrait.classList.add('popout-playing');
      }
      animation=popout.requestVideoFrameCallback?popout.requestVideoFrameCallback(draw):requestAnimationFrame(draw);
    }catch(_){disablePopout();sync();}
  }
  if(compositor){
    popout.addEventListener('playing',()=>{stopDrawing();draw();});
    popout.addEventListener('pause',stopDrawing);
    popout.addEventListener('ended',()=>{stopDrawing();popoutTurn=false;video.currentTime=0;sync();});
    popout.addEventListener('error',()=>{disablePopout();sync();});
    ['progress','canplaythrough','ended'].forEach(event=>popout.addEventListener(event,warmBackground));
    canvas.addEventListener('webglcontextlost',()=>{disablePopout();sync();});
    video.addEventListener('ended',()=>{
      if(!compositor)return;popoutTurn=true;popout.currentTime=0;sync();
    });
  }
  function clearRetry(){clearTimeout(retryTimer);retryTimer=null;}
  function retrySoon(){
    if(!wanted()||retryTimer||retries>=3)return;
    retryTimer=setTimeout(()=>{retryTimer=null;sync();},[1000,3000,8000][retries++]);
  }
  async function sync(){
    if(!wanted()){clearRetry();video.pause();popout?.pause();stopDrawing();frame.classList.remove('motion-playing');return;}
    if(pending||(!failed&&!active().paused))return;
    pending=true;let fallback=false;const selected=active();
    try{
      if(popoutTurn){
        if(!popout.getAttribute('src'))popout.src=config.webPopoutFile;
      }else if(failed||!video.getAttribute('src')||expiresAt<Date.now()+15000){await prepareReel(failed);if(!wanted())return;}
      if(wanted())await active().play();
    }catch(error){
      frame.classList.remove('motion-playing');
      // A browser gesture restriction needs the next real interaction. Network
      // failures get a small, bounded retry window while the portrait is visible.
      if(error.name!=='NotAllowedError'){
        if(popoutTurn){disablePopout();fallback=true;}else retrySoon();
      }
    }
    finally{pending=false;if(!wanted()){video.pause();popout?.pause();}else if(fallback||selected!==active())sync();}
  }
  video.addEventListener('playing',()=>{retries=0;clearRetry();});
  video.addEventListener('timeupdate',()=>frame.classList.toggle('motion-playing',wanted()&&!popoutTurn&&!video.paused&&video.currentTime>0));
  video.addEventListener('pause',()=>frame.classList.remove('motion-playing'));
  video.addEventListener('error',()=>{failed=true;expiresAt=0;frame.classList.remove('motion-playing');retrySoon();});
  const observer=new IntersectionObserver(entries=>{const next=entries[0].intersectionRatio>.08;if(next&&!visible)retries=0;visible=next;sync();},{threshold:[0,.08]});
  observer.observe(frame);
  document.addEventListener('visibilitychange',sync);
  reduced.addEventListener('change',()=>{prepareOpening();sync();});
  document.addEventListener('wedding:enter',sync);
  document.addEventListener('wedding:revealed',warmBackground,{once:true});
  // No overlay control: a real gesture can resume muted playback on browsers
  // that disallow initial autoplay, without consuming the guest's interaction.
  document.addEventListener('pointerdown',sync,{passive:true});
  document.addEventListener('keydown',sync);
  window.addEventListener('online',()=>{retries=0;clearRetry();sync();});
  // Blessing dialogs are created by the following deferred script.
  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('dialog').forEach(dialog=>new MutationObserver(sync).observe(dialog,{attributes:true,attributeFilter:['open']}));
  });
  window.addEventListener('pagehide',()=>{pageActive=false;clearRetry();video.pause();popout?.pause();stopDrawing();});
  window.addEventListener('pageshow',()=>{pageActive=true;retries=0;sync();});
  prepareOpening();
})();

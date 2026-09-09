(() => {
  const config=window.WEDDING.coupleMotion,frame=document.querySelector('.us-photo'),video=frame?.querySelector('video');
  if(!config?.enabled||!video||!window.IntersectionObserver)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let visible=false,pending=false,failed=false,expiresAt=0;
  const retry=document.createElement('button');retry.type='button';retry.className='motion-retry';retry.textContent='再看一次微笑 ↻';retry.hidden=true;frame.append(retry);
  const wanted=()=>visible&&!document.hidden&&!reduced.matches&&!document.querySelector('dialog[open]');
  async function sync(){
    if(!wanted()){video.pause();frame.classList.remove('motion-playing');return;}
    if(pending||failed||!video.paused)return;
    pending=true;
    try{
      if(!video.getAttribute('src')||expiresAt<Date.now()+15000){const media=await window.WeddingCloud.motion();if(!wanted())return;video.src=media.url;expiresAt=media.expiresAt;}
      if(wanted())await video.play();
    }catch(_){frame.classList.remove('motion-playing');retry.hidden=false;}
    finally{pending=false;if(!wanted())video.pause();}
  }
  video.addEventListener('timeupdate',()=>frame.classList.toggle('motion-playing',wanted()&&!video.paused&&video.currentTime>0));
  video.addEventListener('pause',()=>frame.classList.remove('motion-playing'));
  video.addEventListener('error',()=>{failed=true;expiresAt=0;frame.classList.remove('motion-playing');retry.hidden=false;});
  retry.onclick=async event=>{event.stopPropagation();failed=false;retry.hidden=true;try{const media=await window.WeddingCloud.motion(true);video.src=media.url;expiresAt=media.expiresAt;sync();}catch(_){retry.hidden=false;}};
  const observer=new IntersectionObserver(entries=>{visible=entries[0].intersectionRatio>.08;sync();},{threshold:[0,.08]});
  observer.observe(frame);
  document.addEventListener('visibilitychange',sync);
  reduced.addEventListener('change',sync);
  // Blessing dialogs are created by the following deferred script.
  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('dialog').forEach(dialog=>new MutationObserver(sync).observe(dialog,{attributes:true,attributeFilter:['open']}));
  });
  window.addEventListener('pagehide',()=>video.pause());
  window.addEventListener('pageshow',sync);
})();

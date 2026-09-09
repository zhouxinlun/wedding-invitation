(() => {
  const config=window.WEDDING.coupleMotion,frame=document.querySelector('.us-photo'),video=frame?.querySelector('video');
  if(!config?.enabled||!video||!window.IntersectionObserver)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let visible=false,pending=false,failed=false;
  const wanted=()=>visible&&!document.hidden&&!reduced.matches&&!document.querySelector('dialog[open]');
  function sync(){
    if(!wanted()){video.pause();frame.classList.remove('motion-playing');return;}
    if(pending||failed||!video.paused)return;
    if(!video.getAttribute('src'))video.src=config.webFile;
    pending=true;
    video.play().catch(()=>{frame.classList.remove('motion-playing');}).finally(()=>{pending=false;if(!wanted())video.pause();});
  }
  video.addEventListener('timeupdate',()=>frame.classList.toggle('motion-playing',wanted()&&!video.paused&&video.currentTime>0));
  video.addEventListener('pause',()=>frame.classList.remove('motion-playing'));
  video.addEventListener('error',()=>{failed=true;frame.classList.remove('motion-playing');});
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

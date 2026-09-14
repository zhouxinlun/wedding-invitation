(() => {
  'use strict';
  const w=window.WEDDING,dialog=document.querySelector('#share-dialog'),button=document.querySelector('#share-invite');
  // Use the configured public entry even in local previews. Never forward visitor parameters.
  const url=new URL('/',w.shareUrl).href,input=document.querySelector('#share-url');
  const status=document.querySelector('#share-status');
  const poster=document.querySelector('#share-poster'),posterStatus=document.querySelector('#share-poster-status');
  const retry=document.querySelector('#retry-poster'),save=document.querySelector('#save-poster');
  poster.addEventListener('load',()=>{posterStatus.hidden=true;retry.hidden=true;});
  poster.addEventListener('error',()=>{posterStatus.hidden=false;posterStatus.textContent='海报暂时没展开，可以重试或先复制链接。';retry.hidden=false;});
  function loadPoster(){
    if(poster.getAttribute('src'))return;
    posterStatus.hidden=false;posterStatus.textContent='海报正在展开…';retry.hidden=true;
    poster.src=poster.dataset.src;
  }
  retry.addEventListener('click',()=>{poster.removeAttribute('src');loadPoster();});
  function showPoster(){loadPoster();status.textContent='';dialog.showModal();}
  input.value=url;input.addEventListener('click',()=>input.select());
  // Download the build-generated full-resolution JPEG. Native sharing is no
  // longer the action, and no second fetch/blob competes with image loading.
  save.href=poster.dataset.src;
  if(window.IntersectionObserver){
    const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();loadPoster();}},{rootMargin:'240px'});
    observer.observe(button);
  }else if(window.WeddingEntry?.pending)document.addEventListener('wedding:revealed',loadPoster,{once:true});else loadPoster();
  button.addEventListener('click',showPoster);
  save.addEventListener('click',event=>{
    loadPoster();
    if(/MicroMessenger/i.test(navigator.userAgent)){
      // WeChat's WebView may suppress download links. Keep the actual JPEG in
      // view so its native long-press menu can save it to the phone's album.
      event.preventDefault();
      status.textContent='请长按上方海报，选择「保存到相册」，即可保存完整长图。';
      poster.scrollIntoView?.({block:'center',behavior:'smooth'});
    }else status.textContent='已请求下载完整海报；也可以长按图片保存。';
  });
  document.querySelector('#copy-link').addEventListener('click',async()=>{
    try{
      if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(url);
      else{input.focus();input.select();if(!document.execCommand('copy'))throw Error('COPY_UNAVAILABLE');}
      status.textContent='链接已复制，可以和海报一起发给亲友。';
    }catch(_){input.focus();input.select();status.textContent='请长按链接手动复制，或保存带二维码的海报。';}
  });
})();

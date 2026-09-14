(() => {
  'use strict';
  const w=window.WEDDING,dialog=document.querySelector('#share-dialog'),button=document.querySelector('#share-invite');
  // Use the configured public entry even in local previews. Never forward visitor parameters.
  const url=new URL('/',w.shareUrl).href,input=document.querySelector('#share-url');
  const text=`我们结婚啦！${w.groom} & ${w.bride}，邀你于${w.dateLabel} ${w.ceremonyTime}，共赴${w.venue.fullName}。`;
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
  function showPoster(){loadPoster();dialog.showModal();}
  input.value=url;input.addEventListener('click',()=>input.select());
  let payload=null,sharing=false,preparing=false;
  // Prepare the public image before the click: share() must keep the click's user activation.
  function prepareShare(){
    loadPoster();
    if(!(window.isSecureContext&&navigator.share&&navigator.canShare))return;
    if(preparing||payload)return;
    preparing=true;
    fetch(poster.src).then(async response=>{
      if(!response.ok)throw Error('POSTER_UNAVAILABLE');
      const blob=await response.blob();if(blob.type!=='image/jpeg')throw Error('INVALID_POSTER');
      const files=[new File([blob],'良辰之约-微信海报.jpg',{type:blob.type})];
      const candidate={files,title:'良辰之约 · '+w.groom+'与'+w.bride,text,url};
      if(navigator.canShare({files})&&navigator.canShare(candidate)){payload=candidate;save.textContent='发送海报';}
    }).catch(()=>{}).finally(()=>{preparing=false;}); // The image and link remain usable without file sharing.
  }
  if(window.IntersectionObserver){
    const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();prepareShare();}},{rootMargin:'240px'});
    observer.observe(button);
  }else if(window.WeddingEntry?.pending)document.addEventListener('wedding:revealed',prepareShare,{once:true});else prepareShare();
  button.addEventListener('click',()=>{showPoster();prepareShare();});
  save.addEventListener('click',async event=>{
    if(!payload)return; // A normal same-origin download when system sharing is unavailable.
    event.preventDefault();
    if(sharing)return;
    sharing=true;save.setAttribute('aria-disabled','true');
    try{await navigator.share(payload);}
    catch(error){if(error.name!=='AbortError')status.textContent='暂时无法唤起分享，请长按海报保存后发送。';}
    finally{sharing=false;save.removeAttribute('aria-disabled');}
  });
  document.querySelector('#copy-link').addEventListener('click',async()=>{
    try{
      if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(url);
      else{input.focus();input.select();if(!document.execCommand('copy'))throw Error('COPY_UNAVAILABLE');}
      status.textContent='链接已复制，可以和海报一起发给亲友。';
    }catch(_){input.focus();input.select();status.textContent='请长按链接手动复制，或保存带二维码的海报。';}
  });
})();

(() => {
  'use strict';
  const w=window.WEDDING,dialog=document.querySelector('#share-dialog'),button=document.querySelector('#share-invite');
  // Use the configured public entry even in local previews. Never forward visitor parameters.
  const url=new URL('/',w.shareUrl).href,input=document.querySelector('#share-url');
  const text=`我们结婚啦！${w.groom} & ${w.bride}，邀你于${w.dateLabel} ${w.ceremonyTime}，共赴${w.venue.fullName}。`;
  const status=document.querySelector('#share-status');
  input.value=url;input.addEventListener('click',()=>input.select());
  let payload=null,sharing=false;
  // Prepare the public image before the click: share() must keep the click's user activation.
  function prepareShare(){
    if(!(window.isSecureContext&&navigator.share&&navigator.canShare))return;
    fetch(document.querySelector('.share-preview img').src).then(async response=>{
      if(!response.ok)throw Error('COVER_UNAVAILABLE');
      const blob=await response.blob();if(blob.type!=='image/jpeg')throw Error('INVALID_COVER');
      const files=[new File([blob],'良辰之约-分享封面.jpg',{type:blob.type})];
      const candidate={files,title:'良辰之约 · '+w.groom+'与'+w.bride,text,url};
      if(navigator.canShare({files})&&navigator.canShare(candidate))payload=candidate;
    }).catch(()=>{}); // The visible, same-origin image and link remain usable without file sharing.
  }
  if(window.IntersectionObserver){
    const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();prepareShare();}},{rootMargin:'240px'});
    observer.observe(button);
  }else if(window.WeddingEntry?.pending)document.addEventListener('wedding:revealed',prepareShare,{once:true});else prepareShare();
  button.addEventListener('click',async()=>{
    if(sharing)return;
    if(!payload){dialog.showModal();return;}
    sharing=true;button.disabled=true;
    try{await navigator.share(payload);}
    catch(error){if(error.name!=='AbortError')dialog.showModal();}
    finally{sharing=false;button.disabled=false;}
  });
  document.querySelector('#copy-link').addEventListener('click',async()=>{
    try{
      if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(url);
      else{input.focus();input.select();if(!document.execCommand('copy'))throw Error('COPY_UNAVAILABLE');}
      status.textContent='链接已复制。长按上方封面保存后，可在微信中一起发送给亲友。';
    }catch(_){input.focus();input.select();status.textContent='请长按链接手动复制，再把封面和链接发给亲友。';}
  });
})();

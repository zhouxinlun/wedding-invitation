(function(scope){
'use strict';
function failure(code,message){const error=new Error(message);error.code=code;return error;}
function errorMessage(error){
  return error&&error.guestMessage||'暂时未能连接，请检查网络后重试；你的输入还在';
}
function scaledSize(width,height){
  if(!(width>0&&height>0))throw failure('PHOTO_ERROR','这张照片无法读取，请换一张');
  const ratio=Math.min(1,1280/Math.max(width,height));
  return {width:Math.max(1,Math.round(width*ratio)),height:Math.max(1,Math.round(height*ratio))};
}
async function compressPhoto(file){
  if(!file||!['image/jpeg','image/png'].includes(file.type)||file.size>10*1024*1024)throw failure('PHOTO_ERROR','请选择10MB以内的JPG或PNG照片');
  const url=URL.createObjectURL(file),image=new Image();
  try{
    await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(failure('PHOTO_ERROR','这张照片无法读取，请换一张'));image.src=url;});
    const size=scaledSize(image.naturalWidth,image.naturalHeight),canvas=document.createElement('canvas');
    canvas.width=size.width;canvas.height=size.height;
    const context=canvas.getContext('2d');if(!context)throw failure('PHOTO_ERROR','当前浏览器无法处理照片，请换一个浏览器');
    context.fillStyle='#fff';context.fillRect(0,0,size.width,size.height);context.drawImage(image,0,0,size.width,size.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.75));
    if(!blob||blob.size>3*1024*1024)throw failure('PHOTO_ERROR','照片处理后仍过大，请换一张');
    return blob;
  }finally{URL.revokeObjectURL(url);}
}
function nonce(){
  const bytes=new Uint8Array(16);scope.crypto.getRandomValues(bytes);
  return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
function createClient(config,loadSDK=()=>import('./vendor/cloudbase.js').then(module=>module.default),compress=compressPhoto){
  let app,connecting;
  const media=new Map(),pendingMedia=new Map();
  async function connect(){
    if(connecting)return connecting;
    connecting=(async()=>{
      if(!config||!config.envId)throw failure('NOT_CONFIGURED','请柬暂未连接云端，请稍后再试');
      if(!app){const sdk=await loadSDK();app=sdk.init({env:config.envId});}
      const auth=app.auth(),current=await auth.getSession();
      // SDK v3 reports unauthenticated when this browser has no credentials yet.
      if(current.error&&current.error.code!=='unauthenticated')throw current.error;
      if(!current.data||!current.data.session){
        const signed=await auth.signInAnonymously();
        if(signed.error)throw signed.error;
        if(!signed.data||!signed.data.session)throw failure('LOGIN_REQUIRED','未能建立访客身份，请稍后重试');
      }
      return app;
    })();
    try{return await connecting;}catch(error){console.warn("[WeddingCloud] connect",String(error.code||error.name||"UNKNOWN").replace(/[^a-zA-Z0-9_.-]/g,""));throw error;}finally{connecting=null;}
  }
  async function invoke(action,data){
    const client=await connect();
    let response;
    try{response=await client.callFunction({name:config.functionName,data:{...data,action},parse:true});}
    catch(error){console.warn('[WeddingCloud] function',String(error.code||error.name||'UNKNOWN').replace(/[^a-zA-Z0-9_.-]/g,''));throw error;}
    if(response.code){console.warn('[WeddingCloud] function response',String(response.code).replace(/[^a-zA-Z0-9_.-]/g,''));const error=failure(response.code,'云端暂时无法访问，请稍后重试');if(response.ok===false)error.guestMessage=response.message;throw error;}
    const result=response.result;
    if(!result||result.ok!==true){
      const error=failure(result&&result.code||'SERVICE_UNAVAILABLE',result&&result.message||'心意暂时未能送达，请稍后重试');
      error.guestMessage=error.message;throw error;
    }
    return result;
  }
  async function uploadDraft(draft,onProgress=()=>{}){
    const owner=await invoke('identity');
    for(let i=0;i<draft.photos.length;i++){
      const photo=draft.photos[i];if(photo.fileID)continue;
      onProgress('正在整理第'+(i+1)+'张照片');
      const blob=await compress(photo.file),client=await connect();
      onProgress('正在上传第'+(i+1)+'张照片');
      const result=await client.uploadFile({cloudPath:'guest-uploads/'+owner.ownerKey+'/'+draft.nonce+'/'+i+'.jpg',filePath:blob});
      if(!result.fileID)throw failure('PHOTO_ERROR','照片上传未完成，请重试');
      photo.fileID=result.fileID;
    }
    onProgress('心意正在送达');
    return invoke('submit',{nonce:draft.nonce,name:draft.name,text:draft.text,emoji:'',files:draft.photos.map(photo=>photo.fileID)});
  }
  async function signedMedia(action,data={},force=false){
    const key=action+':'+(data.group||''),cached=media.get(key);
    if(!force&&cached&&cached.expiresAt>Date.now()+15000)return cached;
    if(pendingMedia.has(key))return pendingMedia.get(key);
    const request=invoke(action,data).then(result=>{media.set(key,result);return result;});
    pendingMedia.set(key,request);
    try{return await request;}finally{pendingMedia.delete(key);}
  }
  return {invoke,uploadDraft,nonce,pollMs:config&&config.pollMs||20000,
    album:(group,force=false)=>signedMedia('album',{group},force),motion:(force=false)=>signedMedia('usMotion',{},force)};
}
const api={createClient,compressPhoto,scaledSize,nonce,errorMessage};
if(typeof module==='object'&&module.exports)module.exports=api;
else {scope.WeddingCloudTools=api;scope.WeddingCloud=createClient(scope.WEDDING_CLOUD);}
})(typeof window==='object'?window:globalThis);

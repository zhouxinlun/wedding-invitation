const config=require('./blessing-config');
let initialized=false;
function failure(code,message){const error=new Error(message);error.code=code;return error;}
function invoke(action,data){
  if(!config.envId||!wx.cloud)return Promise.reject(failure('NOT_READY','祝福墙正在准备，稍后再来留下心意'));
  if(!initialized){wx.cloud.init({env:config.envId,traceUser:false});initialized=true;}
  return wx.cloud.callFunction({name:config.functionName,data:Object.assign({action},data||{})}).then(res=>{
    if(!res.result||res.result.ok!==true)throw failure(res.result&&res.result.code||'SERVICE_UNAVAILABLE',res.result&&res.result.message||'暂时未能连接祝福墙，请稍后重试');
    return res.result;
  });
}
function nonce(){return Date.now().toString(36)+'_'+Math.random().toString(36).slice(2)+'_'+Math.random().toString(36).slice(2);}
function compress(file){return new Promise((resolve,reject)=>{
  const fail=()=>reject(failure('PHOTO_ERROR','这张照片暂时无法处理，请换一张'));
  wx.getImageInfo({src:file,success:info=>{
    if(!(info.width>0&&info.height>0)){fail();return;}
    // Specify only one edge: the platform preserves the aspect ratio, including portrait images.
    const edge=info.width>=info.height?{compressedWidth:Math.min(1280,info.width)}:{compressedHeight:Math.min(1280,info.height)};
    wx.compressImage({src:file,quality:70,...edge,success:res=>resolve(res.tempFilePath),fail});
  },fail});
});}
function photoSize(file){return new Promise((resolve,reject)=>wx.getFileSystemManager().stat({path:file,success:res=>resolve(res.stats.size),fail:()=>reject(failure('PHOTO_ERROR','照片已失效，请重新选择'))}));}
function uploadDraft(draft,ownerKey,onProgress){
  let chain=Promise.resolve();
  draft.photos.forEach((photo,index)=>{chain=chain.then(()=>{
    if(photo.fileID)return;
    onProgress('正在整理第'+(index+1)+'张照片');
    return compress(photo.path).then(path=>photoSize(path).then(size=>{
      if(size>3*1024*1024)throw failure('PHOTO_ERROR','照片压缩后仍较大，请换一张');
      onProgress('正在上传第'+(index+1)+'张照片');
      return wx.cloud.uploadFile({cloudPath:'guest-uploads/'+ownerKey+'/'+draft.nonce+'/'+index+'.jpg',filePath:path});
    })).then(res=>{photo.fileID=res.fileID;});
  });});
  return chain.then(()=>{
    onProgress('心意正在送达');
    return invoke('submit',{nonce:draft.nonce,name:draft.name,text:draft.text,emoji:draft.emoji,files:draft.photos.map(photo=>photo.fileID)});
  });
}
module.exports={configured:()=>!!config.envId,pollMs:config.pollMs,invoke,nonce,uploadDraft};

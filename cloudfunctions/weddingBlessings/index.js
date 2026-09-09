'use strict';
const cloud=require('wx-server-sdk');
const jpeg=require('jpeg-js');
const {PNG}=require('pngjs');
const {createService,GuestError,digest}=require('./core');
const {requestIdentity}=require('./request-identity');
const albums=require('./albums.json');
const motion=require('./motion.json');
cloud.init({env:cloud.DYNAMIC_CURRENT_ENV});
const db=cloud.database();
const POSTS='wedding_blessings', LIMITS='wedding_blessing_limits';
const error=(code,message)=>{throw new GuestError(code,message);};
async function get(collection,id,source=db){
  const result=await source.collection(collection).where({_id:id}).limit(1).get();
  return result.data[0]||null;
}
const repo={
  async reserve({id,owner,input,fingerprint,time,lock,limits}){
    return db.runTransaction(async tx=>{
      const existing=await get(POSTS,id,tx);
      if(existing){
        if(existing.fingerprint!==fingerprint)error('DUPLICATE_CONFLICT','这次投稿内容已变化，请重新打开后再发');
        if(['pending','approved'].includes(existing.status))return {fresh:false,doc:existing};
        if(['deleted','rejected'].includes(existing.status))error('ALREADY_HANDLED','这份投稿已处理，请重新打开后再发');
        if(existing.status==='processing'&&time-existing.updatedAt<limits.lease)error('IN_PROGRESS','上一份心意正在送达，请稍后重试核对');
        await tx.collection(POSTS).doc(id).update({data:{status:'processing',lock,updatedAt:time}});
        return {fresh:true};
      }
      const day=new Date(time+8*3600000).toISOString().slice(0,10);
      const limit=await get(LIMITS,owner,tx);
      if(limit&&time-limit.lastAt<limits.cooldown)error('RATE_LIMIT','心意已收到，稍等半分钟再送一份吧');
      if(limit&&limit.day===day&&limit.count>=limits.perDay)error('RATE_LIMIT','今天已经留下很多心意，明天再来吧');
      await tx.collection(LIMITS).doc(owner).set({data:{day,count:limit&&limit.day===day?limit.count+1:1,lastAt:time}});
      await tx.collection(POSTS).doc(id).set({data:{owner,name:input.name,text:input.text,emoji:input.emoji,photos:[],
        status:'processing',fingerprint,lock,createdAt:time,updatedAt:time}});
      return {fresh:true};
    });
  },
  async finish(id,lock,photos,time){
    const result=await db.collection(POSTS).where({_id:id,lock,status:'processing'}).update({data:{photos,status:'approved',updatedAt:time}});
    return result.stats.updated===1;
  },
  async fail(id,lock,time){return db.collection(POSTS).where({_id:id,lock,status:'processing'}).update({data:{status:'failed',updatedAt:time}});},
  async list({mode,status,owner,limit}){
    const where=mode==='public'?{status:'approved'}:mode==='mine'?{owner,status:db.command.neq('deleted')}:{status};
    return (await db.collection(POSTS).where(where).orderBy('createdAt','desc').limit(limit).get()).data;
  },
  async reply({postId,id,owner,name,text,replyToId,fingerprint,time,limits}){
    return db.runTransaction(async tx=>{
      const post=await get(POSTS,postId,tx);
      if(!post||post.status!=='approved')error('POST_UNAVAILABLE','这份祝福已不可回复，请刷新列表');
      const replies=post.replies||[],existing=replies.find(reply=>reply.id===id);
      if(existing){
        if(existing.deletedAt)error('ALREADY_HANDLED','这条回复已删除，可以重新写一条');
        if(existing.fingerprint!==fingerprint)error('DUPLICATE_CONFLICT','这次回复内容已变化，请重新打开后再发');
        return;
      }
      const target=replyToId?replies.find(reply=>reply.id===replyToId):post;
      if(!target||target.deletedAt)error('POST_UNAVAILABLE','要回复的留言已不可用，请刷新列表');
      if(replies.length>=limits.perThread)error('THREAD_FULL','这份祝福的回复已满，可以再写一份新祝福');
      const limitKey=owner+'_replies',day=new Date(time+8*3600000).toISOString().slice(0,10),limit=await get(LIMITS,limitKey,tx);
      if(limit&&time-limit.lastAt<limits.cooldown)error('RATE_LIMIT','回复已收到，稍等几秒再发送吧');
      if(limit&&limit.day===day&&limit.count>=limits.perDay)error('RATE_LIMIT','今天已留下很多回复，明天再来吧');
      await tx.collection(LIMITS).doc(limitKey).set({data:{day,count:limit&&limit.day===day?limit.count+1:1,lastAt:time}});
      await tx.collection(POSTS).doc(postId).update({data:{replies:replies.concat({id,owner,name,text,replyToId,replyToName:target.name,fingerprint,createdAt:time}),updatedAt:time}});
    });
  },
  async removeReply({postId,replyId,owner,time}){
    return db.runTransaction(async tx=>{
      const post=await get(POSTS,postId,tx);
      if(!post||post.status!=='approved')error('POST_UNAVAILABLE','这份祝福已移除，请刷新列表');
      const reply=(post.replies||[]).find(item=>item.id===replyId);
      if(!reply||reply.owner!==owner)error('FORBIDDEN','只能删除自己写的回复');
      if(reply.deletedAt)return;
      // Keep the identity/fingerprint tombstone so delayed retries cannot recreate deleted text.
      const replies=post.replies.map(item=>item.id===replyId?{...item,text:'',deletedAt:time}:item);
      await tx.collection(POSTS).doc(postId).update({data:{replies,updatedAt:time}});
    });
  },
  async removePhoto({postId,photoKey,owner,time}){
    return db.runTransaction(async tx=>{
      const post=await get(POSTS,postId,tx);
      if(!post||post.owner!==owner)error('FORBIDDEN','只能删除自己上传的照片');
      if(post.status==='deleted')return {files:[],status:'deleted'};
      if(post.status!=='approved')error('POST_UNAVAILABLE','这份祝福暂时不可修改，请刷新列表');
      const file=(post.photos||[]).find(id=>digest(id)===photoKey);
      if(!file)return {files:[],status:post.status};
      const photos=post.photos.filter(id=>id!==file);
      const status=!photos.length&&!post.text&&!post.emoji?'deleted':'approved';
      await tx.collection(POSTS).doc(postId).update({data:{photos,status,updatedAt:time}});
      return {files:[file],status};
    });
  },
  async change(id,{owner,admin,status,now}){
    return db.runTransaction(async tx=>{
      const doc=await get(POSTS,id,tx);
      if(!doc||(!admin&&doc.owner!==owner))return null;
      if(doc.status==='deleted')return status==='deleted'?doc:null;
      if(status!=='deleted'&&doc.status!=='pending')return null;
      await tx.collection(POSTS).doc(id).update({data:{status,updatedAt:now,reviewedAt:admin?now:null}});
      return doc;
    });
  }
};
function canonicalImage(buffer,limits){
  if(!Buffer.isBuffer(buffer)||buffer.length>limits.fileBytes)error('INVALID_FILE','照片过大，请选择3MB以内的照片');
  let data;
  try{
    if(buffer[0]===0xff&&buffer[1]===0xd8){data=jpeg.decode(buffer,{useTArray:true,maxResolutionInMP:4,maxMemoryUsageInMB:64});}
    else if(buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){
      if(buffer.length<24||buffer.readUInt32BE(16)*buffer.readUInt32BE(20)>limits.pixels)error('INVALID_FILE','请选择较小的照片');
      data=PNG.sync.read(buffer,{checkCRC:true});
    }else error('INVALID_FILE','请选择JPG或PNG照片');
  }catch(e){if(e instanceof GuestError)throw e;error('INVALID_FILE','这张照片无法读取，请换一张');}
  if(!data.width||!data.height||data.width*data.height>limits.pixels)error('INVALID_FILE','照片尺寸过大，请缩小后重试');
  // Re-encoding drops EXIF/GPS and makes a separate immutable server-owned publication copy.
  return jpeg.encode({data:data.data,width:data.width,height:data.height},75).data;
}
const media={
  async freeze(fileID,path,limits){
    const source=await cloud.downloadFile({fileID});
    const result=await cloud.uploadFile({cloudPath:path,fileContent:canonicalImage(source.fileContent,limits)});
    if(!result.fileID)throw new Error('STORAGE_UPLOAD_FAILED');
    return result.fileID;
  },
  async remove(fileList){
    let remaining=[...fileList];
    for(let attempt=0;attempt<3&&remaining.length;attempt++){
      try{
        const result=await cloud.deleteFile({fileList:remaining});
        const removed=new Set((result.fileList||[]).filter(file=>file.status===0).map(file=>file.fileID));
        remaining=remaining.filter(id=>!removed.has(id));
      }catch(_){ /* A transient deletion error does not make a withdrawn post public again. */ }
    }
    if(remaining.length){console.error('BLESSING_PHOTO_CLEANUP_PENDING',{count:remaining.length});throw new Error('PHOTO_CLEANUP_PENDING');}
  },
  async urls(ids,maxAge=300){
    const map={};
    for(let start=0;start<ids.length;start+=50){
      const result=await cloud.getTempFileURL({fileList:ids.slice(start,start+50).map(fileID=>({fileID,maxAge}))});
      for(const file of result.fileList||[])if(file.tempFileURL)map[file.fileID]=file.tempFileURL;
    }
    return map;
  }
};
exports.main=async (event,context)=>{
  try{
    const admins=(process.env.BLESSING_ADMIN_OPENIDS||'').split(',').map(s=>s.trim()).filter(Boolean);
    const service=createService({repo,media,albums,motion,admins,appid:process.env.BLESSING_APPID,webEnv:process.env.TCB_ENV||process.env.SCF_NAMESPACE});
    const result=await service(event||{},requestIdentity(context));
    return {ok:true,...result};
  }catch(e){
    if(e instanceof GuestError)return {ok:false,code:e.code,message:e.message};
    console.error('BLESSING_SERVICE_ERROR',{name:e.name,code:e.code||e.errCode||'UNKNOWN'});
    return {ok:false,code:'SERVICE_UNAVAILABLE',message:'心意暂时未能送达，请稍后重试；你的输入还在'};
  }
};
exports.canonicalImage=canonicalImage;

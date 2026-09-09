'use strict';
const crypto = require('crypto');
const LIMITS = Object.freeze({text:160, name:20, photos:3, fileBytes:3*1024*1024, pixels:4*1024*1024, cooldown:30000, perDay:20, lease:90000});
const EMOJI = ['❤️','🌹','🎉','🥂','💐','囍'];
const REPLY_LIMITS=Object.freeze({text:160,name:20,perThread:200,cooldown:3000,perDay:100});
class GuestError extends Error { constructor(code,message){super(message);this.code=code;} }
const fail=(code,message)=>{throw new GuestError(code,message);};
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
function identity(context){
  if(context&&context.OPENID&&context.APPID)return {platform:'wechat',openid:context.OPENID,key:digest(context.OPENID).slice(0,32)};
  // CloudBase Web invocations may also carry the environment's WX_APPID.
  // Only an invocation OPENID establishes a native WeChat identity.
  if(context&&context.WEB_UID&&context.ENV&&!context.OPENID)return {platform:'web',openid:'',key:digest('cloudbase:'+context.ENV+':'+context.WEB_UID).slice(0,32)};
  fail('LOGIN_REQUIRED','未能确认你的身份，请刷新页面后重试');
}
function validate(event,owner){
  const clean=value=>typeof value==='string'?value.trim():'';
  const name=clean(event.name), text=clean(event.text), emoji=clean(event.emoji);
  if(!name || Array.from(name).length>LIMITS.name || Array.from(text).length>LIMITS.text) fail('INVALID_INPUT','请填写20字以内的称呼、160字以内的祝福');
  if(emoji && !EMOJI.includes(emoji)) fail('INVALID_INPUT','请选择一个祝福表情');
  const files=event.files===undefined?[]:event.files;
  if(!Array.isArray(files)||files.length>LIMITS.photos||new Set(files).size!==files.length) fail('INVALID_INPUT','每次最多分享3张照片');
  if(!text&&!emoji&&!files.length) fail('INVALID_INPUT','写一句祝福，或送上一张照片、一个表情');
  if(typeof event.nonce!=='string'||!/^[a-zA-Z0-9_-]{16,64}$/.test(event.nonce)) fail('INVALID_INPUT','请重新打开投稿窗口');
  const prefix='guest-uploads/'+owner.key+'/'+event.nonce+'/';
  files.forEach(file=>{
    if(typeof file!=='string'||!/^cloud:\/\/[^/?#]+\//.test(file)) fail('INVALID_FILE','照片来源无效，请重新选择');
    const pathname=file.replace(/^cloud:\/\/[^/]+\//,'');
    if(!pathname.startsWith(prefix)||!/^\d\.(jpg|png)$/.test(pathname.slice(prefix.length))) fail('INVALID_FILE','只能提交自己本次选择的照片');
  });
  return {name,text,emoji,files,nonce:event.nonce};
}
function createService({repo,media,albums={},motion={},admins=[],appid,webEnv,now=Date.now,token=()=>crypto.randomBytes(12).toString('hex')}){
  function authorize(context){
    const owner=identity(context);
    if(owner.platform==='wechat'&&(!appid||context.APPID!==appid))fail('APP_MISMATCH','投稿服务尚未正确连接');
    if(owner.platform==='web'&&(!webEnv||context.ENV!==webEnv))fail('APP_MISMATCH','网页投稿服务尚未正确连接');
    return {...owner,admin:owner.platform==='wechat'&&admins.includes(owner.openid)};
  }
  async function present(docs,owner){
    // Only call this with already authorized rows; private/pending file IDs never enter a public response.
    const ids=[...new Set(docs.flatMap(doc=>doc.photos||[]))];
    const urls=ids.length?await media.urls(ids):{};
    return docs.map(doc=>({id:doc._id,name:doc.name,text:doc.text,emoji:doc.emoji,status:doc.status,createdAt:doc.createdAt,
      own:doc.owner===owner.key,photos:(doc.photos||[]).filter(id=>urls[id]).map(id=>urls[id]),
      photoKeys:(doc.photos||[]).filter(id=>urls[id]).map(digest),
      replies:(doc.replies||[]).filter(reply=>!reply.deletedAt).map(reply=>({id:reply.id,name:reply.name,text:reply.text,replyToId:reply.replyToId,
        replyToName:reply.replyToName,createdAt:reply.createdAt,own:reply.owner===owner.key}))}));
  }
  return async function handle(event,context){
    const owner=authorize(context);
    if(event.action==='identity')return {ownerKey:owner.key,admin:owner.admin,adminConfigured:admins.length>0,identityCode:owner.openid};
    if(event.action==='usMotion'){
      // Only the deployment-owned portrait is signable; ignore caller-supplied file IDs.
      if(!motion.us)fail('MEDIA_UNAVAILABLE','合影暂未加载，请重试');
      const startedAt=now(),urls=await media.urls([motion.us],3600);
      if(!urls[motion.us])fail('MEDIA_UNAVAILABLE','合影暂未加载，请重试');
      return {url:urls[motion.us],expiresAt:startedAt+3500000};
    }
    if(event.action==='album'){
      // This deployment-owned catalogue is the only source of signable wedding media.
      if(typeof event.group!=='string'||!Object.prototype.hasOwnProperty.call(albums,event.group))fail('INVALID_INPUT','这本相册暂时未能打开');
      const photos=albums[event.group],startedAt=now();
      const urls=await media.urls(photos.map(photo=>photo.fileID),3600);
      if(photos.some(photo=>!urls[photo.fileID]))fail('MEDIA_UNAVAILABLE','照片暂未加载，请重试');
      return {photos:photos.map(photo=>({file:photo.file,url:urls[photo.fileID]})),expiresAt:startedAt+3500000};
    }
    if(event.action==='list'){
      const mode=event.mode||'public';
      if(!['public','mine','manage'].includes(mode))fail('INVALID_INPUT','无法打开这个列表');
      if(mode==='manage'&&!owner.admin)fail('FORBIDDEN','这里由新人管理');
      const status=mode==='manage'&&event.status==='approved'?'approved':mode==='manage'?'pending':undefined;
      const docs=await repo.list({mode,status,owner:owner.key,limit:50});
      const allowed=docs.filter(doc=>mode==='public'?doc.status==='approved':mode==='mine'?doc.owner===owner.key&&doc.status!=='deleted':doc.status===status);
      return {items:await present(allowed,owner),limit:50};
    }
    if(event.action==='submit'){
      const input=validate(event,owner),time=now(),id=digest(owner.key+':'+input.nonce),lock=token();
      const fingerprint=digest(JSON.stringify([input.name,input.text,input.emoji,input.files]));
      const reserved=await repo.reserve({id,owner:owner.key,input,fingerprint,time,lock,limits:LIMITS});
      if(!reserved.fresh)return {id,status:reserved.doc.status};
      const copies=[];
      try{
        for(let i=0;i<input.files.length;i++)copies.push(await media.freeze(input.files[i],'blessing-photos/'+id+'/'+lock+'/'+i+'.jpg',LIMITS));
        const committed=await repo.finish(id,lock,copies,now());
        if(!committed)fail('CANCELLED','这份投稿已撤回，请重新打开后再发送');
        await media.remove(input.files).catch(()=>{});
        return {id,status:'approved'};
      }catch(error){
        await media.remove(copies).catch(()=>{});
        await repo.fail(id,lock,now()).catch(()=>{});
        throw error;
      }
    }
    if(event.action==='reply'){
      const name=typeof event.name==='string'?event.name.trim():'',text=typeof event.text==='string'?event.text.trim():'';
      const replyToId=event.replyToId===undefined?'':event.replyToId;
      if(!name||Array.from(name).length>REPLY_LIMITS.name||!text||Array.from(text).length>REPLY_LIMITS.text)fail('INVALID_INPUT','请填写20字以内的称呼和160字以内的回复');
      if(typeof event.postId!=='string'||!/^[a-f0-9]{64}$/.test(event.postId)||typeof replyToId!=='string'||(replyToId&&!/^[a-f0-9]{64}$/.test(replyToId)))fail('INVALID_INPUT','这条回复的位置无效，请刷新后重试');
      if(typeof event.nonce!=='string'||!/^[a-zA-Z0-9_-]{16,64}$/.test(event.nonce))fail('INVALID_INPUT','请重新打开回复窗口');
      const id=digest(owner.key+':reply:'+event.nonce),fingerprint=digest(JSON.stringify([event.postId,replyToId,name,text]));
      await repo.reply({postId:event.postId,id,owner:owner.key,name,text,replyToId,fingerprint,time:now(),limits:REPLY_LIMITS});
      return {id,postId:event.postId,status:'approved'};
    }
    if(event.action==='removeReply'||event.action==='removePhoto'){
      const key=event.action==='removeReply'?event.replyId:event.photoKey;
      if(typeof event.postId!=='string'||!/^[a-f0-9]{64}$/.test(event.postId)||typeof key!=='string'||!/^[a-f0-9]{64}$/.test(key))fail('INVALID_INPUT','要删除的内容无效，请刷新后重试');
      if(event.action==='removeReply'){
        await repo.removeReply({postId:event.postId,replyId:key,owner:owner.key,time:now()});
        return {id:key,postId:event.postId,status:'deleted'};
      }
      const removed=await repo.removePhoto({postId:event.postId,photoKey:key,owner:owner.key,time:now()});
      await media.remove(removed.files).catch(()=>{});
      return {postId:event.postId,photoKey:key,status:removed.status};
    }
    if(event.action==='review'||event.action==='remove'){
      if(typeof event.id!=='string'||!/^[a-f0-9]{64}$/.test(event.id))fail('INVALID_INPUT','这份祝福暂时无法处理');
      if(event.action==='review'&&!owner.admin)fail('FORBIDDEN','这里由新人管理');
      if(event.action==='review'&&!['approved','rejected'].includes(event.decision))fail('INVALID_INPUT','请选择展示或不展示');
      const status=event.action==='remove'?'deleted':event.decision;
      const changed=await repo.change(event.id,{owner:owner.key,admin:owner.admin,status,now:now()});
      if(!changed)fail('FORBIDDEN','无法修改这份祝福，请刷新后重试');
      if(status==='deleted'||status==='rejected')await media.remove(changed.photos||[]).catch(()=>{});
      return {id:event.id,status};
    }
    fail('INVALID_INPUT','暂不支持这项操作');
  };
}
module.exports={createService,GuestError,LIMITS,REPLY_LIMITS,validate,digest,identity};

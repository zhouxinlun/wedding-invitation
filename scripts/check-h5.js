'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const {createClient,scaledSize}=require('../web/cloud-client');
const root=path.resolve(__dirname,'..');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
// Test-only SDK and network controls: production always uses the official SDK.
function sdkFixture(){
  const calls=[],uploads=[];let session=null,signs=0,reply={ok:true},fail=false,raw=false;
  const app={auth:()=>({getSession:async()=>({data:{session},error:session?null:{code:'unauthenticated'}}),signInAnonymously:async()=>{signs++;session={test:true};return {data:{session}};}}),
    callFunction:async args=>{calls.push(args);if(fail)throw Error('offline');const value=typeof reply==='function'?reply(args.data):reply;return raw?value:{result:value};},
    uploadFile:async args=>{uploads.push(args);return {fileID:'cloud://test.bucket/'+args.cloudPath};}};
  const client=createClient({envId:'test-env',functionName:'test-function'},async()=>({init:()=>app}),async file=>file);
  return {client,calls,uploads,get signs(){return signs;},set reply(value){reply=value;raw=false;},set rawReply(value){reply=value;raw=true;},set fail(value){fail=value;}};
}
function uiFixture(){
  const dom=new JSDOM('<!doctype html><main id="wall"></main>',{url:'https://invitation.example',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
  w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
  w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
  w.URL.createObjectURL=()=> 'blob:test-'+Math.random();w.URL.revokeObjectURL=()=>{};w.confirm=()=>true;
  for(const file of ['miniprogram/shared/blessing-snow.js','miniprogram/shared/blessing-editor.js','web/blessings.js'])w.eval(fs.readFileSync(path.join(root,file),'utf8'));
  const calls=[],drafts=[];let list=[],pendingUpload=null,pendingReply=null,pendingList=null,next=0;
  const client={pollMs:60000,nonce:()=>String(++next).padStart(32,'0'),
    invoke:async(action,data)=>{calls.push({action,data});if(action==='list'){if(pendingList){const p=pendingList;pendingList=null;return p.promise;}return {items:structuredClone(list)};}if(action==='reply'&&pendingReply)return pendingReply.promise;return {ok:true};},
    uploadDraft:async(draft,progress)=>{drafts.push(draft);progress('正在上传第1张照片');return pendingUpload?pendingUpload.promise:{id:'new-post'};}};
  const wall=w.document.querySelector('#wall'),dispose=w.WeddingBlessings.mount(wall,{client});
  return {w,wall,calls,drafts,q:s=>wall.querySelector(s),set list(value){list=value;},set pendingUpload(value){pendingUpload=value;},set pendingReply(value){pendingReply=value;},set pendingList(value){pendingList=value;},
    async refresh(){w.document.dispatchEvent(new w.Event('visibilitychange'));await flush();},
    async submit(form){form.dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();},close(){dispose();w.close();}};
}
const post=(id,own=true)=>({id,name:'亲友'+id,text:'长长久久',emoji:'',photos:[],photoKeys:[],replies:[],own,status:'approved',createdAt:1});
(async()=>{
  const s=sdkFixture();await Promise.all([s.client.invoke('identity'),s.client.invoke('list')]);assert.equal(s.signs,1);
  await s.client.invoke('identity');assert.equal(s.signs,1);assert(s.calls.every(call=>call.parse===true&&call.name==='test-function'));
  s.reply={ok:false,code:'SLOW_DOWN',message:'稍等一下再送祝福'};await assert.rejects(s.client.invoke('submit'),error=>error.guestMessage==='稍等一下再送祝福');
  s.rawReply={ok:false,code:'INVALID_INPUT',message:'请填写称呼'};await assert.rejects(s.client.invoke('submit'),error=>error.guestMessage==='请填写称呼');
  s.fail=true;await assert.rejects(s.client.invoke('list'),/offline/);s.fail=false;
  s.reply=data=>data.action==='identity'?{ok:true,ownerKey:'verified-owner'}:{ok:true,id:'saved'};
  const draft={nonce:'stable-nonce',name:'亲友',text:'🌹',photos:[{file:{size:10}}]};
  await s.client.uploadDraft(draft);await s.client.uploadDraft(draft);assert.equal(s.uploads.length,1);assert.equal(s.uploads[0].cloudPath,'guest-uploads/verified-owner/stable-nonce/0.jpg');
  assert(s.calls.filter(call=>call.data.action==='submit').slice(-2).every(call=>call.data.nonce===draft.nonce&&call.data.files.length===1));
  s.reply={ok:true,photos:[],expiresAt:Date.now()+60000};const before=s.calls.length;
  await Promise.all([s.client.album('red'),s.client.album('red')]);await s.client.album('red');assert.equal(s.calls.length,before+1);
  await s.client.album('red',true);assert.equal(s.calls.length,before+2);
  assert.deepEqual(scaledSize(3000,6000),{width:640,height:1280});assert.deepEqual(scaledSize(6000,3000),{width:1280,height:640});assert.deepEqual(scaledSize(200,100),{width:200,height:100});assert.throws(()=>scaledSize(0,100));
  console.log('PASS H5 SDK 会话复用、错误透传、上传路径、重试复用照片与 nonce、媒体缓存及照片比例');

  const u=uiFixture();await flush();
  try{
    const old=post('old'),newer={...post('new',false),createdAt:2};u.list=[old,newer];await u.refresh();
    assert.equal(u.q('.b-author span').textContent,'亲友new');assert.equal(u.wall.querySelectorAll('.b-delete-action').length,1);
    u.q('.b-letter-card').click();u.q('input[name=name]').value='来宾';u.q('textarea[name=text]').value='新婚快乐';u.q('.b-emoji-row button').click();assert.equal(u.q('textarea[name=text]').value,'新婚快乐❤️');
    const upload=deferred();u.pendingUpload=upload;await u.submit(u.q('form'));assert.equal(u.q('.b-send').disabled,true);assert.equal(u.q('.b-loading').hidden,false);assert.match(u.q('.b-progress').textContent,/上传/);
    upload.reject(Error('offline'));await flush();assert.equal(u.q('dialog').open,true);assert.equal(u.q('.b-send').disabled,false);assert.match(u.q('.b-error').textContent,/输入还在/);
    const originalDraft=u.drafts[0];u.pendingUpload=null;u.list=[post('new-post'),old,newer];await u.submit(u.q('form'));
    assert.equal(u.drafts[1],originalDraft);assert.equal(u.q('dialog').open,false);assert.equal(u.q('textarea[name=text]').value,'');assert.equal(u.q('input[name=name]').value,'来宾');
    console.log('PASS H5 正式祝福发送等待、失败保留输入、重试去重、成功清空、列表倒序和作者删除按钮');

    u.q('.b-reply-action').click();const rd=u.q('.b-web-reply-dialog'),rf=rd.querySelector('form');rd.querySelector('[name=text]').value='一起欢喜';
    const pending=deferred();u.pendingReply=pending;await u.submit(rf);assert.equal(rd.querySelector('.b-send').disabled,true);assert.equal(rd.querySelector('.b-loading').hidden,false);
    pending.reject(Error('offline'));await flush();assert(rd.open);assert.equal(rd.querySelector('[name=text]').value,'一起欢喜');assert.match(rd.querySelector('.b-error').textContent,/输入还在/);
    const firstReply=u.calls.find(call=>call.action==='reply').data;u.pendingReply=null;await u.submit(rf);assert(!rd.open);assert.equal(u.calls.filter(call=>call.action==='reply').at(-1).data.nonce,firstReply.nonce);
    const own=post('photo-owner');own.photos=['https://cdn.example/a.jpg','https://cdn.example/b.jpg'];own.photoKeys=['key-a','key-b'];
    own.replies=[{id:'own-reply',name:'我',text:'谢谢',replyToName:own.name,own:true,createdAt:2},{id:'other-reply',name:'朋友',text:'快乐',replyToName:own.name,own:false,createdAt:3}];u.list=[own];await u.refresh();
    assert.equal(u.wall.querySelectorAll('.b-delete-reply').length,1);u.q('.b-delete-photo').click();await flush();assert.deepEqual(structuredClone(u.calls.find(call=>call.action==='removePhoto').data),{postId:'photo-owner',photoKey:'key-a'});
    u.q('.b-delete-reply').click();await flush();assert.equal(u.calls.find(call=>call.action==='removeReply').data.replyId,'own-reply');
    console.log('PASS H5 回复等待及失败提示、回复重试 nonce、自己的回复与单张照片删除请求');

    const stale=deferred();u.pendingList=stale;await u.refresh();u.q('.b-letter-card').click();u.q('textarea[name=text]').value='新的一份祝福';
    u.list=[post('latest')];await u.submit(u.q('form'));stale.resolve({items:[post('stale')]});await flush();
    assert.equal(u.q('.b-author span').textContent,'亲友latest');assert(!u.wall.textContent.includes('亲友stale'));
    console.log('PASS H5 提交期间的迟到列表不能覆盖最新祝福');
  }finally{u.close();}

  const {out}=require('./build-web');assert(fs.existsSync(path.join(out,'web/vendor/cloudbase.js')),'Run npm run build:web first');
  const files=fs.readdirSync(out,{recursive:true}).filter(file=>fs.statSync(path.join(out,file)).isFile());
  assert(!files.some(file=>/cloudfunctions|node_modules|preview|\.env|admin|secret|\.map$/.test(file)));
  for(const relative of ['web/index.html','web/style.css','web/h5.css']){
    const source=fs.readFileSync(path.join(out,relative),'utf8');
    for(const match of source.matchAll(/(?:src|href)="([^"#]+)"|url\(['"]?([^)'"\s]+)|@import\s+['"]([^'"]+)/g)){
      const target=match[1]||match[2]||match[3];if(/^(?:https?:|data:|#)/.test(target))continue;
      assert(fs.existsSync(path.resolve(out,path.dirname(relative),decodeURI(target.split(/[?#]/)[0]))),'Missing public asset: '+target);
    }
  }
  console.log('PASS H5 发布包静态资源完整，排除私有云函数、凭据及演示页面');
})().catch(error=>{console.error(error);process.exitCode=1;});

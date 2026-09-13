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
function uiFixture(savedName=''){
  const dom=new JSDOM('<!doctype html><main id="wall"></main>',{url:'https://invitation.example',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
  w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
  w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
  w.URL.createObjectURL=()=> 'blob:test-'+Math.random();w.URL.revokeObjectURL=()=>{};w.confirm=()=>true;
  if(savedName)w.localStorage.setItem('wedding-guest-name',savedName);
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
    assert(u.q('.b-name-label').hidden);assert.equal(u.q('.b-saved-name strong').textContent,'来宾');
    console.log('PASS H5 正式祝福发送等待、失败保留输入、重试去重、成功清空、列表倒序和作者删除按钮');

    u.q('.b-reply-action').click();const rd=u.q('.b-web-reply-dialog'),rf=rd.querySelector('form');rd.querySelector('[name=text]').value='一起欢喜';
    assert(rd.querySelector('.b-name-label').hidden);assert.equal(rd.querySelector('.b-saved-name strong').textContent,'来宾');
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

  const returning=uiFixture('老朋友');try{
    await flush();assert(returning.q('.b-name-label').hidden);
    assert.equal(returning.q('[name=name]').value,'老朋友');
    returning.q('.b-saved-name button').click();assert(!returning.q('.b-name-label').hidden);
    const input=returning.q('[name=name]');input.value='新落款';input.dispatchEvent(new returning.w.Event('change'));
    assert.equal(returning.w.localStorage.getItem('wedding-guest-name'),'新落款');assert(returning.q('.b-name-label').hidden);
    const album=returning.w.document.createElement('dialog');album.id='photo-dialog';returning.w.document.body.append(album);
    const snow=returning.q('.b-snow');album.showModal();await flush();assert.equal(snow.parentElement,album);
    album.close();await flush();assert.equal(snow.parentElement,returning.wall);
    assert.equal(returning.w.document.querySelectorAll('.b-snow').length,1);
    console.log('PASS 已记忆落款免重复填写，可修改并共用于回复；相册复用单一祝福飘雪层');
  }finally{returning.close();}

  const {out}=require('./build-web');assert(fs.existsSync(path.join(out,'web/vendor/cloudbase.js')),'Run npm run build:web first');
  const entryHtml=fs.readFileSync(path.join(out,'web/index.html'),'utf8');
  for(const {hash,interacted=false} of [{hash:''},{hash:'#us'},{hash:'#invitation'},{hash:'#blessings'},{hash:'',interacted:true}]){
    const dom=new JSDOM(entryHtml,{url:'https://invitation.example/web/index.html?from=friend'+hash,runScripts:'outside-only',pretendToBeVisual:true});
    const win=dom.window,doc=win.document,scrolls=[],copies=[],mediaRequests=[],centered=[],frames=[],observers=[];
    try{
      win.matchMedia=()=>({matches:true,addEventListener(){}});
      win.HTMLElement.prototype.scrollIntoView=function(){scrolls.push(this.id);};
      win.scrollTo=options=>{centered.push(options);scrolls.push('us');};
      win.requestAnimationFrame=callback=>{frames.push(callback);return frames.length;};
      Object.defineProperty(win,'innerHeight',{value:900});
      for(const [index,chapter] of [...doc.querySelectorAll('main>.nav-section')].entries())chapter.getBoundingClientRect=()=>({top:120+index*900,height:900});
      doc.querySelector('#us').getBoundingClientRect=()=>({top:120,height:640});
      doc.querySelector('.bottom-nav').getBoundingClientRect=()=>({height:80});
      win.IntersectionObserver=class{constructor(callback){observers.push(callback);}observe(){}unobserve(){}};
      win.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
      win.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
      Object.defineProperty(win,'isSecureContext',{value:true});
      Object.defineProperty(win.navigator,'clipboard',{value:{writeText:async text=>copies.push(text)}});
      win.WeddingCloud={album:(group,force)=>{const reply=deferred();mediaRequests.push({group,force,...reply});return reply.promise;}};
      for(const file of ['miniprogram/wedding.js','miniprogram/shared/rose-vines.js','miniprogram/journey.js','web/app.js','web/share.js'])win.eval(fs.readFileSync(path.join(root,file),'utf8'));
      if(interacted)win.dispatchEvent(new win.Event('wheel'));
      await flush();frames.splice(0).forEach(callback=>callback());
      if(hash==='#blessings'||interacted)assert.equal(centered.length,0,'Deep links and guest interaction keep their position');
      else assert.equal(centered.at(-1).top,30,'Opening is centered above the 80px navigation');
      assert.equal(doc.querySelector('main>section').id,'us');
      assert.equal(doc.querySelector('.bottom-nav .active').hash,hash==='#blessings'?'#blessings':'#us');
      const originalRects=[...doc.querySelectorAll('main>.nav-section')].map(chapter=>chapter.getBoundingClientRect);
      for(const [index,chapter] of [...doc.querySelectorAll('main>.nav-section')].entries())chapter.getBoundingClientRect=()=>({top:20+(index-4)*900,height:900});
      observers[1]([{isIntersecting:true,target:doc.querySelector('#schedule')}]);
      assert.equal(doc.querySelector('.bottom-nav .active').hash,'#journey','A late observer entry cannot highlight a chapter outside the reading area');
      [...doc.querySelectorAll('main>.nav-section')].forEach((chapter,index)=>{chapter.getBoundingClientRect=originalRects[index];});
      assert.equal(doc.querySelectorAll('h1').length,1);
      assert(!doc.querySelector('#invitation'));
      assert.equal(doc.querySelector('#us video').loop,true);
      assert.equal(doc.querySelector('#us .us-photo img').getAttribute('fetchpriority'),'high');
      assert(doc.querySelector('#us').textContent.includes('周新沦'));
      assert(doc.querySelector('#us').textContent.includes('11:08'));
      assert.equal(doc.querySelectorAll('.schedule-event').length,17);
      assert(doc.querySelector('#schedule').textContent.includes('11:38'));
      assert(doc.querySelector('#schedule').textContent.includes('11:40'));
      assert(doc.querySelector('#schedule').textContent.includes('12:00'));
      for(const el of doc.querySelectorAll('[data-field="guestArrivalTime"]'))assert.equal(el.textContent,'10:40');
      assert(doc.querySelector('meta[property="og:description"]').content.includes('11:08'));
      for(const link of doc.querySelectorAll('.bottom-nav a')){
        link.click();assert.equal(scrolls.at(-1),link.hash.slice(1));assert.equal(win.location.hash,link.hash);
        assert.equal(doc.documentElement.classList.contains('opening-active'),link.hash==='#us');
      }
      win.location.hash='#invitation';win.dispatchEvent(new win.HashChangeEvent('hashchange'));
      assert.equal(win.location.hash,'#us');assert.equal(scrolls.at(-1),'us');
      assert.equal(doc.querySelector('.bottom-nav .active').hash,'#us');
      doc.querySelector('#share-invite').click();assert(doc.querySelector('#share-dialog').open);
      doc.querySelector('#copy-link').click();await flush();
      assert.equal(copies.at(-1),require('../miniprogram/wedding').shareUrl);
      assert.equal(doc.querySelector('#share-url').value,copies.at(-1));
      assert.equal(new URL(doc.querySelector('.share-preview img').src).pathname,'/miniprogram/assets/couple-red-natural-v2.jpg');
      doc.querySelector('#share-dialog').close();
      doc.querySelector('[data-album=red]').click();
      const photo=doc.querySelector('#lightbox-image');assert.equal(mediaRequests.length,0,'Bundled cover never requires cloud login');
      assert.equal(photo.getAttribute('src'),'../miniprogram/assets/couple-red-natural-v2.jpg');photo.onload();
      assert(doc.querySelector('.lightbox-frame').classList.contains('photo-ready'));
      assert.equal(doc.querySelectorAll('.lightbox-vine').length,4);
      doc.querySelector('.photo-next').click();assert.equal(mediaRequests.length,1);
      doc.querySelector('.photo-next').click();assert.equal(mediaRequests.length,2);
      const newer=win.WEDDING.photos.filter(p=>p.group==='red')[2];
      mediaRequests[1].resolve({photos:[{file:newer.file,url:'https://media.example/newer'}]});await flush();
      assert.equal(photo.src,'https://media.example/newer');mediaRequests[0].reject(Error('late'));await flush();
      assert.equal(photo.src,'https://media.example/newer');
      doc.querySelector('.photo-close').click();assert(!doc.querySelector('#photo-dialog').open);
    }finally{win.close();}
  }
  const inner=new JSDOM(entryHtml),landing=new JSDOM(fs.readFileSync(path.join(out,'index.html'),'utf8'));
  try{
    for(const resource of inner.window.document.querySelectorAll('script[src],link[rel="stylesheet"]')){
      const url=new URL(resource.getAttribute('src')||resource.getAttribute('href'),'https://invitation.example/web/index.html');
      if(url.origin!=='https://invitation.example')continue;
      const bytes=fs.readFileSync(path.join(out,decodeURI(url.pathname)));
      assert.equal(url.searchParams.get('v'),require('node:crypto').createHash('sha256').update(bytes).digest('hex').slice(0,12),'Published code must bypass stale browser caches: '+url.pathname);
    }
    for(const property of ['og:title','og:description','og:url','og:image']){
      const selector=`meta[property="${property}"]`;
      assert.equal(landing.window.document.querySelector(selector).content,inner.window.document.querySelector(selector).content);
    }
    const image=new URL(inner.window.document.querySelector('meta[property="og:image"]').content);
    assert.equal(image.protocol,'https:');assert.equal(image.search,'');
    assert.equal(image.origin,new URL(require('../miniprogram/wedding').shareUrl).origin);
    assert(fs.existsSync(path.join(out,image.pathname)),'Share image must ship with the public site');
    let redirect='';
    require('node:vm').runInNewContext(landing.window.document.querySelector('script').textContent,{location:{search:'?from=friend',hash:'#album',replace:url=>{redirect=url;}}});
    assert.equal(redirect,'./web/index.html?from=friend#album');
  }finally{inner.window.close();landing.window.close();}
  console.log('PASS H5 首屏为我们、旧喜帖链接兼容、五章导航、分享链接清理参数、根地址和内页同封面');
  const files=fs.readdirSync(out,{recursive:true}).filter(file=>fs.statSync(path.join(out,file)).isFile());
  assert(!files.some(file=>/cloudfunctions|node_modules|preview|\.env|admin|secret|\.map$/.test(file)));
  assert(!files.some(file=>/couple-red\.jpg|share-card\.png|share-square\.png|良辰之约-微信请柬\.png/.test(file)));
  const favicon=fs.readFileSync(path.join(out,'favicon.ico'));assert.equal(favicon.readUInt16LE(2),1);assert.equal(favicon.readUInt16LE(4),4);
  for(const relative of ['web/index.html','web/style.css','web/h5.css']){
    const source=fs.readFileSync(path.join(out,relative),'utf8');
    for(const match of source.matchAll(/(?:src|href)="([^"#]+)"|url\(['"]?([^)'"\s]+)|@import\s+['"]([^'"]+)/g)){
      const target=match[1]||match[2]||match[3];if(/^(?:https?:|data:|#)/.test(target))continue;
      assert(fs.existsSync(path.resolve(out,path.dirname(relative),decodeURI(target.split(/[?#]/)[0]))),'Missing public asset: '+target);
    }
  }
  console.log('PASS H5 发布包静态资源完整，排除私有云函数、凭据及演示页面');
})().catch(error=>{console.error(error);process.exitCode=1;});

'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const flush=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};
function setup(popoutMode='none',webFile=''){
  const dom=new JSDOM('<div class="opening-portrait"><div class="us-photo"><video muted loop playsinline></video></div></div><dialog></dialog>',{url:'https://invitation.example',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,video=w.document.querySelector('video'),frame=video.parentElement,calls=[],timers=new Map();
  let visibility,paused=true,playError=null,mediaError=false,delayed=null,next=0;
  w.WEDDING={coupleMotion:{enabled:true,webFile,webPopoutFile:popoutMode==='none'?'':'media/carry.mp4'}};
  const reduced={matches:false,addEventListener(type,cb){this.changed=cb;}};
  w.matchMedia=()=>reduced;
  w.HTMLMediaElement.prototype.load=function(){};
  if(popoutMode!=='none')w.createWeddingPopout=clip=>{
    if(popoutMode==='unavailable')return null;
    let stopped=true;Object.defineProperty(clip,'paused',{get:()=>stopped});
    clip.play=async()=>{calls.push('popout');if(playError)throw playError;stopped=false;clip.currentTime=3;clip.dispatchEvent(new w.Event('playing'));};
    clip.pause=()=>{stopped=true;clip.dispatchEvent(new w.Event('pause'));};
    return {draw(){if(popoutMode==='draw-error')throw Error('context lost');return true;},dispose(){calls.push('dispose');}};
  };
  w.IntersectionObserver=class{constructor(cb){visibility=cb;}observe(){}disconnect(){}};
  w.setTimeout=(fn)=>{timers.set(++next,fn);return next;};w.clearTimeout=id=>timers.delete(id);
  w.WeddingCloud={motion:async force=>{calls.push(force?'refresh':'sign');if(delayed)return delayed;if(mediaError)throw Error('offline');return {url:'https://media.example/portrait.mp4',expiresAt:Date.now()+60000};}};
  Object.defineProperty(video,'paused',{get:()=>paused});
  video.play=async()=>{calls.push('play');if(playError)throw playError;paused=false;video.currentTime=1;video.dispatchEvent(new w.Event('playing'));video.dispatchEvent(new w.Event('timeupdate'));};
  video.pause=()=>{paused=true;video.dispatchEvent(new w.Event('pause'));};
  w.eval(fs.readFileSync(path.join(__dirname,'../web/couple-motion.js'),'utf8'));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  return {w,video,frame,calls,timers,reduced,visible:ratio=>visibility([{intersectionRatio:ratio}]),
    set playError(value){playError=value;},set mediaError(value){mediaError=value;},set delayed(value){delayed=value;},
    tick:async()=>{const [id,fn]=timers.entries().next().value||[];if(fn){timers.delete(id);fn();await flush();}},close:()=>w.close()};
}
(async()=>{
  // Exercise the real controller after the host initially denies playback.
  // These events occur without a scroll or a fresh IntersectionObserver entry.
  for(const mode of ['none','ready'])for(const event of ['WeixinJSBridgeReady','wedding:revealed','loadeddata','canplay','touchend','click']){
    const f=setup(mode);try{
      f.playError=new f.w.DOMException('Host not ready','NotAllowedError');f.visible(.8);await flush();
      const clip=mode==='ready'?f.w.document.querySelector('.popout-source'):f.video;
      assert(clip.paused);assert.equal(f.timers.size,0);
      f.playError=null;
      const target=['loadeddata','canplay'].includes(event)?clip:f.w.document;
      target.dispatchEvent(new f.w.Event(event));await flush();
      assert(!clip.paused,`${mode}: ${event} must resume a visible portrait without a scroll`);
      f.visible(0);target.dispatchEvent(new f.w.Event(event));await flush();assert(clip.paused,'Readiness must not start an offscreen clip');
    }finally{f.close();}
  }
  const local=setup('none','media/reel.mp4');try{
    local.visible(.8);
    assert(local.calls.includes('play'),'A local source must call play synchronously, before user activation can expire');
    await flush();assert.equal(local.video.getAttribute('src'),'media/reel.mp4');
  }finally{local.close();}
  console.log('PASS 微信就绪、首段解码、退出 Loading 和 iOS 触摸均可恢复，离屏不偷跑，本地播放保留同步手势');
  const a=setup();
  try{
    a.playError=new a.w.DOMException('Gesture required','NotAllowedError');a.visible(.8);await flush();
    assert.equal(a.frame.querySelector('button'),null,'Autoplay rejection must not put a replay button over the portrait');
    assert.equal(a.timers.size,0,'Autoplay policy is retried by a real gesture, not a timer loop');
    a.playError=null;a.w.document.dispatchEvent(new a.w.Event('pointerdown'));await flush();
    assert.equal(a.video.paused,false);assert(a.video.loop);assert(a.frame.classList.contains('motion-playing'));
    a.visible(0);assert(a.video.paused);a.visible(.8);await flush();assert(!a.video.paused);
    const dialog=a.w.document.querySelector('dialog');dialog.setAttribute('open','');await flush();assert(a.video.paused);
    dialog.removeAttribute('open');await flush();assert(!a.video.paused);
    a.w.dispatchEvent(new a.w.Event('pagehide'));assert(a.video.paused);
    a.w.document.dispatchEvent(new a.w.Event('pointerdown'));await flush();assert(a.video.paused);
    a.w.dispatchEvent(new a.w.Event('pageshow'));await flush();assert(!a.video.paused);
    console.log('PASS H5 无重播按钮、受限自动播放通过手势恢复、循环属性、离屏/相册/后台暂停与返回恢复');
  }finally{a.close();}
  const b=setup();
  try{
    b.mediaError=true;b.visible(.8);await flush();assert(b.video.paused);assert.equal(b.timers.size,1);
    b.mediaError=false;await b.tick();assert(!b.video.paused);
    b.video.dispatchEvent(new b.w.Event('error'));assert.equal(b.timers.size,1);await b.tick();assert(b.calls.includes('refresh'));
    b.mediaError=true;b.video.dispatchEvent(new b.w.Event('error'));await flush();
    for(let i=0;i<6;i++)await b.tick();assert.equal(b.timers.size,0,'Persistent failure must stop automatic retries');
    b.mediaError=false;b.w.dispatchEvent(new b.w.Event('online'));await flush();assert(!b.video.paused);
    console.log('PASS H5 短暂网络失败自动恢复、媒体错误更新签名、持续失败限制重试、联网后恢复');
  }finally{b.close();}
  const c=setup();
  try{
    let resolve;c.delayed=new Promise(r=>resolve=r);c.visible(.8);c.visible(0);
    resolve({url:'https://media.example/late.mp4',expiresAt:Date.now()+60000});await flush();
    assert(c.video.paused);assert(!c.calls.includes('play'));assert.equal(c.video.getAttribute('src'),null);
    console.log('PASS H5 离屏后不接受迟到的视频加载');
  }finally{c.close();}
  const p=setup('ready');
  try{
    p.visible(.8);await flush();const clip=p.w.document.querySelector('.popout-source');
    assert(!clip.paused);assert(!p.calls.includes('sign'),'First short scene does not require cloud authentication');
    assert(p.frame.parentElement.classList.contains('popout-playing'));
    assert(!p.video.loop,'Long reel hands off to the new scene at its end');
    const dialog=p.w.document.querySelector('dialog');dialog.setAttribute('open','');await flush();assert(clip.paused);
    assert(!p.frame.parentElement.classList.contains('popout-playing'));
    dialog.removeAttribute('open');await flush();assert(!clip.paused);
    p.reduced.matches=true;p.reduced.changed();await flush();assert(clip.paused);
    p.reduced.matches=false;p.reduced.changed();await flush();assert(!clip.paused);
    clip.pause();clip.dispatchEvent(new p.w.Event('ended'));await flush();assert(!p.video.paused);assert(clip.paused);
    p.video.pause();p.video.dispatchEvent(new p.w.Event('ended'));await flush();assert(!clip.paused);assert(p.video.paused);
    p.visible(0);assert(clip.paused);p.visible(.8);await flush();assert(!clip.paused);
    clip.dispatchEvent(new p.w.Event('error'));await flush();assert(p.video.loop);assert(!p.video.paused);
    assert(!p.w.document.querySelector('.popout-canvas'));
    console.log('PASS 新短片与旧合集连续轮换、相册/离屏/减弱动态暂停、媒体失败回到原生循环');
  }finally{p.close();}
  for(const mode of ['unavailable','draw-error']){
    const p=setup(mode);try{
      p.visible(.8);await flush();assert(!p.video.paused);assert(p.video.loop);
      assert(!p.frame.parentElement.classList.contains('popout-playing'));
    }finally{p.close();}
  }
  console.log('PASS WebGL 不可用或播放期间合成失败，均保留可播放的原片');
})().catch(error=>{console.error(error);process.exitCode=1;});

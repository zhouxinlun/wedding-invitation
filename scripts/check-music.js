'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const source=fs.readFileSync(path.join(__dirname,'../web/music.js'),'utf8');
const flush=async()=>{for(let n=0;n<12;n++)await Promise.resolve();};
function setup(webFile){
  const dom=new JSDOM('<!doctype html><button data-music-toggle hidden><span class="garden-music-label"></span></button>',{url:'https://invitation.example',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
  let paused=true,reject=false,resolvePlay=null,loads=0,broken=false;const calls=[];
  w.WEDDING={music:{title:'Selected recording',artist:'Artist',webFile}};
  Object.defineProperty(w.HTMLMediaElement.prototype,'paused',{get:()=>paused});
  Object.defineProperty(w.HTMLMediaElement.prototype,'error',{get:()=>broken?{code:2}:null});
  w.HTMLMediaElement.prototype.load=function(){loads++;broken=false;};
  w.HTMLMediaElement.prototype.pause=function(){paused=true;this.dispatchEvent(new w.Event('pause'));};
  w.HTMLMediaElement.prototype.play=async function(){
    calls.push('play');if(broken)throw new w.DOMException('Source unavailable','NotSupportedError');if(reject)throw new w.DOMException('Gesture required','NotAllowedError');
    if(resolvePlay)await resolvePlay;paused=false;this.dispatchEvent(new w.Event('playing'));
  };
  w.eval(source);
  return {w,calls,get loads(){return loads;},audio:w.document.querySelector('audio'),button:w.document.querySelector('.wedding-music'),badge:w.document.querySelector('[data-music-toggle]'),set reject(value){reject=value;},set broken(value){broken=value;},set delay(value){resolvePlay=value;},close:()=>w.close()};
}
(async()=>{
  const empty=setup('');try{assert.equal(empty.button,null);assert.equal(empty.audio,null);assert(empty.badge.hidden);}finally{empty.close();}
  const a=setup('media/recording.mp3');try{
    assert(a.audio.loop);assert.equal(a.audio.preload,'auto');assert.equal(a.loads,1,'Request audio buffering on page entry');assert.equal(a.calls.length,0,'Never start audible media on page entry');
    a.w.document.dispatchEvent(new a.w.Event('click'));await flush();assert.equal(a.calls.length,1,'First page tap starts the music');
    assert(!a.audio.paused);a.button.click();await flush();assert(a.audio.paused);
    a.w.document.dispatchEvent(new a.w.Event('click'));await flush();assert(a.audio.paused,'A manual pause survives other page taps');
    assert(!a.badge.hidden);assert.equal(a.w.document.querySelectorAll('audio').length,1,'Both controls share a single recording');
    a.badge.click();await flush();assert(!a.audio.paused);assert.equal(a.button.getAttribute('aria-pressed'),'true');
    assert.equal(a.badge.getAttribute('aria-pressed'),'true');assert.equal(a.badge.getAttribute('aria-label'),a.button.getAttribute('aria-label'));
    a.audio.currentTime=14;a.w.dispatchEvent(new a.w.Event('pagehide'));assert(a.audio.paused);
    a.w.dispatchEvent(new a.w.Event('pageshow'));await flush();assert(!a.audio.paused);assert.equal(a.audio.currentTime,14);
    a.button.click();await flush();assert(a.audio.paused);
    assert.equal(a.badge.getAttribute('aria-pressed'),'false');assert.match(a.badge.textContent,/音乐/);
    a.w.dispatchEvent(new a.w.Event('pagehide'));a.w.dispatchEvent(new a.w.Event('pageshow'));await flush();assert(a.audio.paused,'A deliberate pause must survive returning to the page');
    a.reject=true;a.button.click();await flush();assert(a.audio.paused);assert.match(a.button.textContent,/音乐/);
    a.reject=false;a.w.document.dispatchEvent(new a.w.Event('click'));await flush();assert(!a.audio.paused,'Blocked autoplay may resume on the next ordinary interaction');
    a.audio.dispatchEvent(new a.w.Event('error'));assert(a.audio.paused);assert.match(a.button.textContent,/重试/);
    a.broken=true;const loads=a.loads;a.button.click();await flush();assert.equal(a.loads,loads+1,'Network-failed audio must reload its source before retry');assert(!a.audio.paused);
  }finally{a.close();}
  const late=setup('media/recording.mp3');try{
    let done;late.delay=new Promise(resolve=>done=resolve);late.button.click();await flush();
    late.button.click();done();await flush();assert(late.audio.paused,'Cancelled loading must not start music when the request finishes');
    assert.equal(late.button.getAttribute('aria-pressed'),'false');
  }finally{late.close();}
  console.log('PASS 首次页面点击播放、手动暂停不被其他点击覆盖、单播放器、循环/返回续播、错误重试与迟到取消');
})().catch(error=>{console.error(error);process.exitCode=1;});

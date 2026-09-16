'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const source=fs.readFileSync(path.join(__dirname,'../web/music.js'),'utf8');
const flush=async()=>{for(let n=0;n<12;n++)await Promise.resolve();};
function setup(webFile){
  const dom=new JSDOM('<!doctype html><button data-music-toggle hidden><span class="garden-music-label"></span></button>',{url:'https://invitation.example',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
  let paused=true,broken=false,loads=0;const calls=[];
  w.WEDDING={music:{title:'Selected recording',artist:'Artist',webFile}};
  Object.defineProperty(w.HTMLMediaElement.prototype,'paused',{get:()=>paused});
  Object.defineProperty(w.HTMLMediaElement.prototype,'error',{get:()=>broken?{code:2}:null});
  w.HTMLMediaElement.prototype.load=function(){loads++;};
  w.HTMLMediaElement.prototype.pause=function(){paused=true;this.dispatchEvent(new w.Event('pause'));};
  w.HTMLMediaElement.prototype.play=function(){calls.push('play');if(broken)return Promise.reject(new w.DOMException('Source unavailable','NotSupportedError'));paused=false;this.dispatchEvent(new w.Event('playing'));return Promise.resolve();};
  w.eval(source);
  return {w,calls,get loads(){return loads;},audio:w.document.querySelector('audio'),button:w.document.querySelector('.wedding-music'),badge:w.document.querySelector('[data-music-toggle]'),set broken(value){broken=value;},close:()=>w.close()};
}
(async()=>{
  const empty=setup('');try{assert.equal(empty.button,null);assert.equal(empty.audio,null);assert(empty.badge.hidden);}finally{empty.close();}
  const music=setup('media/recording.mp3');try{
    assert(music.audio.loop);assert(music.audio.autoplay);assert(!music.audio.muted);assert.equal(music.audio.preload,'auto');
    assert.equal(music.loads,1,'Audio source loads once on page entry');await flush();assert.equal(music.calls.length,1,'Music play is requested immediately');assert(!music.audio.paused);
    music.button.click();await flush();assert(music.audio.paused);music.badge.click();await flush();assert(!music.audio.paused);
    assert.equal(music.w.document.querySelectorAll('audio').length,1,'Both controls share one player');
    music.audio.dispatchEvent(new music.w.Event('error'));assert(music.audio.paused);assert.match(music.button.textContent,/重试/);
    music.broken=true;const loads=music.loads;music.button.click();await flush();assert.equal(music.loads,loads+1,'Retry reloads a failed source');
  }finally{music.close();}
  console.log('PASS 页面加载即请求音乐、按钮暂停/继续、单播放器与错误重试');
})().catch(error=>{console.error(error);process.exitCode=1;});

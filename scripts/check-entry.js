'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'web/index.html'),'utf8');
const flush=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};
function fixture({gate=true,popout=true,reduced=false}={}){
  const dom=new JSDOM(html,{url:'https://invitation.example/web/index.html'+(gate?'':'#album'),runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;
  const media=new WeakMap(),calls=[],timers=new Map();let next=0,observe;
  const info=el=>{if(!media.has(el))media.set(el,{paused:true,readyState:0,duration:8,start:0,end:0,error:null});return media.get(el);};
  for(const key of ['paused','readyState','duration','error'])Object.defineProperty(w.HTMLMediaElement.prototype,key,{get(){return info(this)[key];}});
  Object.defineProperty(w.HTMLMediaElement.prototype,'buffered',{get(){const s=info(this);return {length:s.end?1:0,start:()=>s.start,end:()=>s.end};}});
  w.HTMLMediaElement.prototype.load=function(){calls.push({type:'load',el:this});};
  w.HTMLMediaElement.prototype.play=async function(){calls.push({type:'play',el:this});info(this).paused=false;this.dispatchEvent(new w.Event('playing'));};
  w.HTMLMediaElement.prototype.pause=function(){info(this).paused=true;this.dispatchEvent(new w.Event('pause'));};
  w.matchMedia=()=>({matches:reduced,addEventListener(){}});
  w.IntersectionObserver=class{constructor(cb){observe=cb;}observe(){}disconnect(){}};
  w.WEDDING={music:{webFile:'media/music.m4a',title:'Piano',artist:'Artist'},coupleMotion:{enabled:true,webPopoutFile:'media/opening.mp4'}};
  w.WeddingCloud={motion:async()=>{calls.push({type:'cloud'});return {url:'https://media.example/reel.mp4',expiresAt:Date.now()+60000};}};
  w.createWeddingPopout=()=>popout?{draw:()=>true,dispose(){}}:null;
  w.setTimeout=(fn,ms)=>{timers.set(++next,{fn,ms});return next;};w.clearTimeout=id=>timers.delete(id);
  if(gate)d.documentElement.classList.add('entry-pending');
  for(const file of ['entry.js','couple-motion.js','music.js'])w.eval(fs.readFileSync(path.join(root,'web',file),'utf8'));
  observe([{intersectionRatio:.8}]);
  const q=s=>d.querySelector(s);
  return {w,d,q,calls,timers,audio:q('audio'),clip:q('.popout-source')||q('.us-motion'),
    ready(el,state={}){Object.assign(info(el),{readyState:3,end:2.5},state);el.dispatchEvent(new w.Event('canplay'));},
    tick(ms){for(const [id,timer]of [...timers])if(timer.ms===ms){timers.delete(id);timer.fn();}},close(){w.close();}};
}
(async()=>{
  const f=fixture();try{
    await flush();assert(f.w.WeddingEntry.pending);assert(f.q('main').inert);assert(!f.q('#entry-open').disabled,'Seal accepts a tap before metadata arrives');
    assert.equal(f.calls.filter(c=>c.type==='play').length,0,'Preload must not start invisible video or audible music');
    f.d.dispatchEvent(new f.w.Event('pointerdown'));f.d.dispatchEvent(new f.w.Event('click'));await flush();assert.equal(f.calls.filter(c=>c.type==='play').length,0);
    let revealed=0;f.d.addEventListener('wedding:revealed',()=>revealed++);
    f.q('#entry-open').click();assert(!f.w.WeddingEntry.pending);assert(f.q('main').inert,'The cover remains while the streams connect');
    assert(f.calls.some(c=>c.type==='play'&&c.el===f.audio),'Music starts synchronously in the entry click');
    assert(f.calls.some(c=>c.type==='play'&&c.el===f.clip),'Video starts in the same real tap');
    f.ready(f.audio,{duration:180,end:1});assert(f.q('main').inert,'Audio alone does not reveal an empty portrait');
    f.ready(f.clip,{readyState:1,end:8});assert(f.q('main').inert,'Metadata alone is not a playable frame');
    f.ready(f.clip,{readyState:3,end:.5});assert(!f.q('main').inert,'Reveal with half a second, without canplaythrough or the complete clip');
    assert.equal(revealed,1);await flush();assert(!f.audio.paused&&!f.clip.paused);
    assert(f.q('.opening-portrait').classList.contains('popout-playing'));
    f.tick(800);assert(f.q('#entry-screen').hidden);
    assert(!f.calls.some(call=>call.type==='cloud'),'The long reel must not compete with the first partial buffer');
    f.ready(f.clip,{end:8});f.clip.dispatchEvent(new f.w.Event('progress'));await flush();
    assert(f.calls.some(call=>call.type==='cloud'),'Warm the long reel once the first scene has buffered');
    assert.equal(revealed,1,'Continued incremental data must not reopen the cover');
    f.q('.wedding-music').click();await flush();assert(f.audio.paused);f.d.dispatchEvent(new f.w.Event('click'));await flush();assert(f.audio.paused,'Manual pause survives after opening');
  }finally{f.close();}
  console.log('PASS 开场使用原播放器预载、半秒媒体即可进入、点击同步启动、进入前不偷跑、进入后手动暂停');
  const slow=fixture();try{
    slow.q('#entry-open').click();slow.tick(8000);assert(!slow.q('#entry-skip').hidden);
    slow.ready(slow.audio,{error:{code:2},readyState:0,end:0});assert(!slow.q('#entry-skip').hidden);
    slow.q('#entry-skip').click();await flush();assert(!slow.w.WeddingEntry.pending);assert(!slow.q('main').inert);
    slow.ready(slow.clip);slow.ready(slow.audio);slow.tick(800);assert(slow.q('#entry-screen').hidden,'Late loads never reopen the gate');
  }finally{slow.close();}
  const fallback=fixture({popout:false});try{
    await flush();assert(fallback.clip.src.startsWith('https://media.example'));
    fallback.ready(fallback.clip);fallback.ready(fallback.audio);assert(!fallback.q('#entry-open').disabled);
    fallback.q('#entry-open').click();await flush();assert(!fallback.clip.paused);
  }finally{fallback.close();}
  const still=fixture({reduced:true});try{
    still.ready(still.audio);assert(!still.q('#entry-open').disabled);
    still.q('#entry-open').click();await flush();assert(still.clip.paused);assert(!still.audio.paused);
  }finally{still.close();}
  const deep=fixture({gate:false});try{
    await flush();assert(!deep.w.WeddingEntry);assert(!deep.q('main').inert);
    assert(deep.calls.some(c=>c.type==='play'),'Deep links retain existing playback behavior');
  }finally{deep.close();}
  console.log('PASS 慢网和错误可跳过、迟到事件清理、WebGL缺失使用原视频、减弱动态和章节深链接');
})().catch(error=>{console.error(error);process.exitCode=1;});

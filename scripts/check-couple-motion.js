'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createService}=require('../cloudfunctions/weddingBlessings/core');
const flush=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
function setup(){
  let definition,onVisibility,resolve,reject;const calls=[],timers=new Map();let next=0;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../miniprogram/components/couple-motion/index.js'),'utf8'),{
    Component:value=>{definition=value;},require:()=>({invoke:action=>{calls.push(action);return new Promise((yes,no)=>{resolve=yes;reject=no;});}}),Date,Promise,
    setTimeout:fn=>{timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id),
    wx:{createVideoContext:()=>({play:()=>calls.push('play'),pause:()=>calls.push('pause')})}
  });
  const component={...definition.methods,data:{...definition.data},properties:{enabled:true,paused:false},
    setData(p,cb){Object.assign(this.data,p);if(cb)cb();},triggerEvent:name=>calls.push(name),
    createIntersectionObserver:()=>({relativeToViewport(){return this;},observe(_,fn){onVisibility=fn;},disconnect(){calls.push('disconnect');}})};
  definition.lifetimes.attached.call(component);definition.lifetimes.ready.call(component);
  return {component,definition,calls,timers,visible:ratio=>onVisibility({intersectionRatio:ratio}),
    respond:()=>resolve({url:'https://media.example/motion.mp4',expiresAt:Date.now()+50000}),reject:()=>reject(Error('offline'))};
}
(async()=>{
  const file='cloud://example.bucket/wedding-media/motion/portrait.mp4',signed=[];
  const options={motion:{us:file},appid:'app',now:()=>100,media:{urls:async(ids,ttl)=>{signed.push({ids,ttl});return {[file]:'https://cdn.example/motion.mp4'};}}};
  const service=createService(options),context={APPID:'app',OPENID:'guest'};
  assert.deepEqual(await service({action:'usMotion',files:['cloud://example.bucket/private.mp4'],fileID:'private'},context),{url:'https://cdn.example/motion.mp4',expiresAt:3500100});
  assert.deepEqual(signed,[{ids:[file],ttl:3600}]);
  await assert.rejects(service({action:'usMotion'},{}),e=>e.code==='LOGIN_REQUIRED');
  await assert.rejects(service({action:'usMotion'},{...context,APPID:'wrong'}),e=>e.code==='APP_MISMATCH');
  for(const failed of [{...options,motion:{}},{...options,media:{urls:async()=>({})}}])await assert.rejects(createService(failed)({action:'usMotion'},context),e=>e.code==='MEDIA_UNAVAILABLE');
  console.log('PASS 动图签名仅允许部署文件，忽略注入文件；宾客身份与 AppID 校验，缺失资源显式失败');

  const t=setup(),c=t.component;
  assert.equal(t.calls.length,0);t.visible(.5);c.sync();assert.equal(t.calls.filter(x=>x==='usMotion').length,1);
  t.respond();await flush();assert.equal(c.data.mounted,true);assert(t.calls.includes('play'));assert.equal(c.data.hasFrame,false);
  c.playing();c.timeUpdate({detail:{currentTime:.3}});assert.equal(c.data.hasFrame,true);assert.equal(t.timers.size,0);
  t.visible(0);assert.equal(c.data.playing,false);assert.equal(t.calls.at(-1),'pause');const playsBefore=t.calls.filter(x=>x==='play').length;c.readyToPlay();assert.equal(t.calls.filter(x=>x==='play').length,playsBefore);
  t.visible(.5);await flush();assert.equal(t.calls.filter(x=>x==='usMotion').length,1);
  t.definition.pageLifetimes.hide.call(c);assert.equal(c.wanted(),false);
  c._expiresAt=0;t.definition.pageLifetimes.show.call(c);assert.equal(t.calls.filter(x=>x==='usMotion').length,2);t.respond();await flush();assert.equal(c.data.hasFrame,false);
  c.properties.paused=true;c.sync();assert.equal(t.calls.at(-1),'pause');c.preview();assert.equal(t.calls.at(-1),'preview');
  t.definition.lifetimes.detached.call(c);assert.equal(t.timers.size,0);assert.equal(t.calls.at(-1),'disconnect');
  console.log('PASS 合影仅入屏加载、请求去重、首帧后渐显、滑走及后台暂停、过期返回刷新、卸载清理和原图预览事件');

  const late=setup();late.visible(.5);late.visible(0);late.respond();await flush();assert.equal(late.component.data.mounted,false);assert(!late.calls.includes('play'));
  const failed=setup();failed.visible(.5);failed.reject();await flush();assert.equal(failed.component.data.error,true);assert.equal(failed.component.data.mounted,false);
  failed.component.retry();failed.respond();await flush();assert.equal(failed.component.data.error,false);assert.equal(failed.component.data.mounted,true);
  [...failed.timers.values()][0]();assert.equal(failed.component.data.error,true);assert.equal(failed.component.data.mounted,false);
  failed.component.retry();failed.definition.lifetimes.detached.call(failed.component);failed.respond();await flush();assert.equal(failed.component.data.mounted,false);
  console.log('PASS 网络失败及无首帧保留原照片，显式重试可恢复，离开或卸载不接受迟到播放');
})().catch(error=>{console.error(error);process.exitCode=1;});

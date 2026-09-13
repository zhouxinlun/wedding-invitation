const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const config=require('../miniprogram/wedding');
const journey=require('../miniprogram/journey');
const pageSource=fs.readFileSync(path.join(root,'miniprogram/pages/invitation/index.js'),'utf8');
const checks=[];
function verify(name,fn){fn();checks.push(name);}
function setup(wedding=config){
  let page;const calls=[];let timerSerial=0;const timers=new Map();
  const wx=new Proxy({}, {get:(_,name)=>options=>{calls.push({name,options});if(name==='getStorageSync') return undefined;if(name==='createMapContext') return {includePoints:options=>calls.push({name:'includePoints',options})};}});
  vm.runInNewContext(pageSource,{require:module=>module==='../../journey'?journey:module==='../../shared/rose-vines'?require('../miniprogram/shared/rose-vines'):module==='../../shared/preview-images'?Object.assign((page,current,urls)=>wx.previewImage({current,urls}),{cleanup:()=>{}}):structuredClone(wedding),Page:definition=>{page=definition;},wx,
    setTimeout:(fn,delay)=>{timers.set(++timerSerial,{fn,delay});return timerSerial;},clearTimeout:id=>timers.delete(id)});
  page.setData=(patch,callback)=>{for(const [key,value] of Object.entries(patch)){const parts=key.split('.');let target=page.data;for(const part of parts.slice(0,-1)) target=target[part];target[parts.at(-1)]=value;}if(callback) callback();};
  return {page,calls,timers};
}
verify('分享路径及两种封面文件存在',()=>{
  const {page}=setup();const share=page.onShareAppMessage();const timeline=page.onShareTimeline();
  assert(fs.existsSync(path.join(root,'miniprogram',share.path+'.wxml')));
  [share.imageUrl,timeline.imageUrl].forEach(file=>assert(fs.existsSync(path.join(root,'miniprogram',file))));
  assert(share.title.includes(config.groom)&&share.title.includes(config.bride));
});
verify('小程序六章与 H5 五章均可导航，后台暂停仍正常',()=>{
 const {page,calls,timers}=setup();page.onLoad();
 const expected=['invitation','us','album','blessings','schedule','journey'];
 const native=fs.readFileSync(path.join(root,'miniprogram/pages/invitation/index.wxml'),'utf8');
 const web=fs.readFileSync(path.join(root,'web/index.html'),'utf8');
 assert.deepEqual(Array.from(page.data.chapters,c=>c.id),expected);
 const nav=web.match(/<nav class="bottom-nav"[\s\S]*?<\/nav>/)[0];
 assert.deepEqual(Array.from(nav.matchAll(/href="#([^"]+)"/g),m=>m[1]),expected.slice(1));
 assert.deepEqual(Array.from(nav.matchAll(/class="nav-number"[^>]*>([^<]+)/g),m=>m[1]),['01','02','03','04','05']);
 for(const [index,id] of expected.entries()){
  assert(native.includes('id="'+id+'"'));if(id!=='invitation')assert(web.includes('id="'+id+'"'));
  page.navigate({currentTarget:{dataset:{target:id}}});
  assert.equal(page.data.active,id);assert.equal(page.data.activeIndex,index);
  assert.equal(calls.filter(c=>c.name==='pageScrollTo').at(-1).options.selector,'#'+id);
 }
 const before=calls.length;page.navigate({currentTarget:{dataset:{target:'film'}}});assert.equal(calls.length,before);
 assert(!('openingFilm' in config));assert.equal(page.openFilm,undefined);
 for(const template of [native,web])assert(!/id="film"|opening-video|opening-film|filmOpen|一眼千年|敬请期待/.test(template));
 assert(native.includes('<couple-motion'));assert(web.includes('class="us-motion"'));
 assert(calls.some(c=>c.name==='showShareMenu'));
 page.onHide();assert.equal(page.data.pageVisible,false);assert.equal(page.data.navQuiet,false);
 page.onShow();assert.equal(page.data.pageVisible,true);page.onUnload();assert.equal(timers.size,0);
});
verify('未确认地图坐标时不调用导航',()=>{const {page,calls}=setup(withoutLocations());assert.equal(page.data.canNavigate,false);page.navigateVenue();assert(!calls.some(c=>c.name==='openLocation'));assert(!calls.some(c=>c.name==='getLocation'||c.name==='getPrivacySetting'));});
verify('有效坐标原样传给地图，失败提供复制地址',()=>{const w=structuredClone(config);w.venue.latitude=39.9;w.venue.longitude=116.4;const {page,calls}=setup(w);assert.equal(page.data.canNavigate,true);page.openMap(page.data.selectedPlace);const map=calls.find(c=>c.name==='openLocation');assert.equal(map.options.latitude,39.9);assert.equal(map.options.name,w.venue.fullName);map.options.fail();assert(calls.some(c=>c.name==='showModal'));});
verify('相册预览涵盖四张合照',()=>{const {page,calls}=setup();page.previewPhoto({currentTarget:{dataset:{src:'/assets/couple-smile.jpg'}}});const preview=calls.find(c=>c.name==='previewImage').options;assert.equal(preview.current,'/assets/couple-smile.jpg');assert.equal(preview.urls.length,4);preview.urls.forEach(file=>assert(fs.existsSync(path.join(root,'miniprogram',file))));});
verify('日历以 UTC 表达北京时间11:08—11:38典礼，保留中文折行',()=>{const ics=fs.readFileSync(path.join(root,'exports/婚礼日程.ics'),'utf8');assert(ics.includes('DTSTART:20261006T030800Z'));assert(ics.includes('DTEND:20261006T033800Z'));assert(ics.includes('\r\n'));for(const line of ics.split('\r\n')) assert(Buffer.byteLength(line)<=75);});
verify('邀请信息中的姓名、日期与饭店一致',()=>{assert.equal(config.groom,'周新沦');assert.equal(config.bride,'李小妮');assert.equal(config.date,'2026-10-06');assert.equal(config.ceremonyTime,'11:08');assert.equal(config.venue.fullName,'尚汇宴（时代-龙和大道店）');});
verify('所有 JSON 配置可读取且页面路径有效',()=>{for(const file of ['project.config.json','miniprogram/app.json','miniprogram/sitemap.json','miniprogram/pages/invitation/index.json']) JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));const app=JSON.parse(fs.readFileSync(path.join(root,'miniprogram/app.json'),'utf8'));app.pages.forEach(page=>['js','json','wxml','wxss'].forEach(ext=>assert(fs.existsSync(path.join(root,'miniprogram',page+'.'+ext)))));});
verify('距离计算使用球面距离并明确单位，空坐标与越界坐标不参与',()=>{
  assert.equal(journey.distanceKm({latitude:0,longitude:0},{latitude:0,longitude:0}),0);
  assert(Math.abs(journey.distanceKm({latitude:0,longitude:0},{latitude:0,longitude:1})-111.195)<.001);
  for(const place of [null,{latitude:null,longitude:116},{latitude:91,longitude:0},{latitude:39,longitude:'116'}]) assert.equal(journey.distanceKm(place,config.venue),null);
  assert.equal(journey.formatDistance(null),''); assert.equal(journey.formatDistance(.09),'不足 100 米'); assert.equal(journey.formatDistance(.52),'约 520 米'); assert.equal(journey.formatDistance(1.24),'约 1.2 公里');
});
function withoutLocations(){const w=structuredClone(config);w.venue.latitude=null;w.venue.longitude=null;return w;}
function withLocations(){const w=structuredClone(config);Object.assign(w.venue,{latitude:39.9,longitude:116.4});w.homes=[{name:'新郎家',address:'测试地址',latitude:39.8,longitude:116.4},{name:'新娘家',address:'测试地址',latitude:null,longitude:null}];return w;}
verify('加载不请求位置，未配置落点时也不请求位置',()=>{const {page,calls}=setup(withoutLocations());page.onLoad();page.requestDistance();assert(!calls.some(c=>c.name==='getLocation'||c.name==='getPrivacySetting'));assert.equal(page.data.distance,'');});
verify('隐私同意前不定位，取消后仍可使用请柬',()=>{const {page,calls}=setup(withLocations());page.onLoad();page.requestDistance();calls.find(c=>c.name==='getPrivacySetting').options.success({needAuthorization:true,privacyContractName:'测试指引'});assert.equal(page.data.privacyOpen,true);assert(!calls.some(c=>c.name==='getLocation'));page.cancelDistance();assert.equal(page.data.privacyOpen,false);assert.equal(page.data.distanceState,'idle');assert(!calls.some(c=>c.name==='getLocation'));});
verify('同意后获取 GCJ02 位置，切换地址复用本次位置而不再索取',()=>{const {page,calls}=setup(withLocations());page.onLoad();page.agreeDistance();calls.find(c=>c.name==='authorize').options.success();const location=calls.find(c=>c.name==='getLocation');assert.equal(location.options.type,'gcj02');location.options.success({latitude:39.7,longitude:116.4});const venueDistance=page.data.distance;page.selectDestination({currentTarget:{dataset:{index:1}}});assert.notEqual(page.data.distance,venueDistance);assert.equal(page.data.selectedPlace.name,'新郎家');assert.equal(calls.filter(c=>c.name==='getLocation').length,1);assert(!calls.some(c=>c.name==='setStorageSync'));assert(!JSON.stringify(page.onShareAppMessage()).includes('39.7'));});
verify('定位失败、超时均无虚构距离，允许重试并忽略过期回调',()=>{const {page,calls,timers}=setup(withLocations());page.onLoad();page.locate();const first=calls.find(c=>c.name==='getLocation');[...timers.values()].find(t=>t.delay===12000).fn();assert.equal(page.data.distanceState,'error');assert.equal(page.data.distance,'');first.options.success({latitude:1,longitude:2});assert.equal(page.data.distance,'');page.locate();const second=calls.filter(c=>c.name==='getLocation')[1];second.options.fail();assert.equal(page.data.distanceState,'error');});
verify('定位完成使用当前选择地点，切换无坐标目的地不显示距离',()=>{const {page,calls}=setup(withLocations());page.onLoad();page.locate();page.selectDestination({currentTarget:{dataset:{index:1}}});calls.find(c=>c.name==='getLocation').options.success({latitude:39.8,longitude:116.4});assert.equal(page.data.distance,'不足 100 米');page.selectDestination({currentTarget:{dataset:{index:2}}});assert.equal(page.data.distance,'');assert.equal(page.data.mapMarkers.length,0);});
verify('菜单滚动仅切换两次透明状态，停止和后台恢复，重复跳转与卸载清理计时器',()=>{
 const {page,calls,timers}=setup();page.onLoad();assert.equal(page.data.motion,true);assert(!calls.some(c=>c.name==='getStorageSync'));assert.equal(page.toggleMotion,undefined);
 let changes=0;const setData=page.setData;page.setData=(p,c)=>{changes++;setData(p,c);};
 for(let i=0;i<20;i++)page.onPageScroll();assert.equal(changes,1);assert.equal(page.data.navQuiet,true);assert.equal(timers.size,1);[...timers.values()][0].fn();assert.equal(page.data.navQuiet,false);assert.equal(changes,2);
 page.navigate({currentTarget:{dataset:{target:'us'}}});page.navigate({currentTarget:{dataset:{target:'journey'}}});assert.equal(page.data.active,'journey');assert.equal(page.data.turns,undefined);assert.equal(timers.size,1);
 page.celebrate();assert.equal(page.data.sparks.length,8);page.onPageScroll();page.onHide();assert.equal(page.data.pageVisible,false);assert.equal(page.data.navQuiet,false);assert.equal(page._navigating,false);page.onUnload();assert.equal(timers.size,0);assert.equal(page._origin,null);assert(!page._alive);
});
verify('微信授权等待不受 GPS 超时约束，取消后不获取位置',()=>{const {page,calls,timers}=setup(withLocations());page.onLoad();page.requestDistance();calls.find(c=>c.name==='getPrivacySetting').options.success({needAuthorization:false});assert.equal(timers.size,0);assert.equal(calls.find(c=>c.name==='authorize').options.scope,'scope.userLocation');assert(!calls.some(c=>c.name==='getLocation'));calls.find(c=>c.name==='authorize').options.fail();assert.equal(page.data.distanceState,'error');assert.equal(page.data.distance,'');});
verify('小程序声明仅按需定位权限，不声明后台定位',()=>{const app=JSON.parse(fs.readFileSync(path.join(root,'miniprogram/app.json'),'utf8'));assert.deepEqual(app.requiredPrivateInfos,['getLocation']);assert(app.permission['scope.userLocation']);assert(!app.requiredBackgroundModes);});
verify('正式饭店配置有有效落点，页面首次加载就有地图标记',()=>{const {page,calls}=setup();page.onLoad();assert(journey.hasCoordinates(config.venue));assert(config.venue.address);assert.equal(page.data.mapMarkers.length,1);assert.equal(page.data.mapMarkers[0].latitude,config.venue.latitude);assert.equal(page.data.canNavigate,true);assert(!calls.some(c=>c.name==='getLocation'||c.name==='authorize'));});
verify('导航主按钮先授权定位，再显示两点距离并打开对应饭店地图',()=>{const {page,calls}=setup(withLocations());page.onLoad();page.navigateVenue();assert(!calls.some(c=>c.name==='openLocation'));calls.find(c=>c.name==='getPrivacySetting').options.success({needAuthorization:false});calls.find(c=>c.name==='authorize').options.success();calls.find(c=>c.name==='getLocation').options.success({latitude:39.8,longitude:116.3});assert.equal(page.data.mapMarkers.length,2);assert(page.data.distance);assert.equal(calls.find(c=>c.name==='includePoints').options.points.length,2);assert.equal(calls.find(c=>c.name==='openLocation').options.latitude,39.9);assert.equal(page.data.hasOrigin,true);});
verify('授权拒绝可主动进入设置恢复，未授权不导航',()=>{const {page,calls}=setup();page.onLoad();assert(!calls.some(c=>c.name==='openLocation'||c.name==='getLocation'));page.navigateVenue();calls.find(c=>c.name==='getPrivacySetting').options.success({needAuthorization:false});calls.find(c=>c.name==='authorize').options.fail();assert.equal(page.data.locationDenied,true);page.openLocationSettings();calls.find(c=>c.name==='openSetting').options.success({authSetting:{'scope.userLocation':true}});assert.equal(page.data.locationDenied,false);assert.equal(calls.filter(c=>c.name==='getPrivacySetting').length,2);});
verify('授权期间切换目的地不会意外跳到导航页',()=>{const {page,calls}=setup(withLocations());page.onLoad();page.navigateVenue();page.selectDestination({currentTarget:{dataset:{index:1}}});calls.find(c=>c.name==='getPrivacySetting').options.success({needAuthorization:false});calls.find(c=>c.name==='authorize').options.success();calls.find(c=>c.name==='getLocation').options.success({latitude:39.7,longitude:116.4});assert.equal(page.data.selectedPlace.name,'新郎家');assert(!calls.some(c=>c.name==='openLocation'));});
console.log(checks.map(name=>'PASS '+name).join('\n'));

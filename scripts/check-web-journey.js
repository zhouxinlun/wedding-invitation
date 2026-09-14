'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),page=fs.readFileSync(path.join(root,'web/index.html'),'utf8');
const journey=require('../miniprogram/journey'),config=require('../miniprogram/wedding'),coordinates=require('coordtransform');
const places=journey.destinations(config),flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
// Controlled SDK surface for our loading, coordinate and retry contracts.
// Actual AMap tiles/security proxy are checked separately in a real browser.
function fixture(){
  const dom=new JSDOM(page,{url:'https://invitation.example/web/index.html',runScripts:'outside-only'}),w=dom.window,d=w.document;
  const q=s=>d.querySelector(s),maps=[],requests=[],timers=new Map();let id=0;
  w.setTimeout=(fn,ms)=>{const key=++id;timers.set(key,{fn,ms});return key;};w.clearTimeout=key=>timers.delete(key);
  Object.defineProperty(w,'isSecureContext',{value:true});
  Object.defineProperty(w.navigator,'geolocation',{value:{getCurrentPosition:(success,failure,options)=>requests.push({success,failure,options})}});
  class TestMap{
    constructor(container,options){this.container=container;this.options=options;this.events={};this.markers=[];maps.push(this);}
    on(event,callback){this.events[event]=callback;}
    add(marker){this.markers.push(marker);this.container.append(marker.content);}
    addControl(control){this.control=control;}
    setZoomAndCenter(zoom,center){this.center=center;}
    setFitView(markers){this.fit=markers;}
    destroy(){this.destroyed=true;this.container.replaceChildren();}
  }
  class Marker{
    constructor(options){Object.assign(this,options);}
    setPosition(position){this.position=position;}
    setContent(content){this.content.replaceWith(content);this.content=content;}
  }
  const SDK={Map:TestMap,Marker,ToolBar:class{constructor(options){this.options=options;}}};
  w.WeddingJourney=journey;w.eval(fs.readFileSync(path.join(root,'dist/h5/web/vendor/journey-map.js'),'utf8'));
  const app=w.WeddingMap.create();
  const script=()=>q('script[src^="https://webapi.amap.com/maps?"]');
  const callback=()=>w[new URL(script().src).searchParams.get('callback')];
  return {w,d,q,app,maps,requests,timers,script,callback,
    async ready(){w.AMap=SDK;callback()();await flush();},
    async expire(){for(const [key,{fn,ms}]of [...timers]){if(ms<=15000&&timers.has(key)){timers.delete(key);fn();}}await flush();},close:()=>w.close()};
}
(async()=>{
  const structural=new JSDOM(page),doc=structural.window.document,card=doc.querySelector('.journey-card');
  assert(card.querySelector('#destination-map'));
  assert(card.compareDocumentPosition(doc.querySelector('.journey-timing'))&structural.window.Node.DOCUMENT_POSITION_FOLLOWING);
  assert(doc.querySelector('#locate-guest'));assert(!page.includes('leaflet'));structural.window.close();
  console.log('PASS 地图卡片、卡片下方时间与定位入口');
  for(const outcome of ['success','denied','timeout']){
    const f=fixture();try{
      f.app.setPlace(places[0]);assert.equal(f.requests.length,0);assert(!f.script(),'Offscreen maps do not load SDK');
      f.app.activate();assert.equal(f.requests.length,1);assert(f.script());
      assert.equal(f.w._AMapSecurityConfig.serviceHost,'https://invitation.example/_AMapService');
      assert(!('securityJsCode' in f.w._AMapSecurityConfig));
      assert.equal(f.requests[0].options.timeout,12000);assert(f.requests[0].options.enableHighAccuracy);
      f.app.setPlace(places[2]);assert.equal(f.requests.length,1);assert.equal(f.d.querySelectorAll('script[src^="https://webapi.amap.com/maps?"]').length,1);
      await f.ready();assert.equal(f.maps.length,1,'A superseded destination must not construct an extra map');
      let current=f.maps.at(-1);
      assert.equal(f.q('.wedding-map-label').textContent,places[2].displayName);
      assert.equal(current.markers[0].position.join(','),[places[2].longitude,places[2].latitude].join(','),'AMap markers must use GCJ-02');
      assert(!f.q('#map-state').hidden,'SDK ready alone does not mean tiles loaded');
      current.events.complete();assert(f.q('#map-state').hidden);
      if(outcome==='success'){
        const point=coordinates.gcj02towgs84(places[2].longitude,places[2].latitude);
        f.requests[0].success({coords:{longitude:point[0],latitude:point[1]}});
        assert.equal(f.q('#guest-distance').textContent,'不足 100 米','Distance compares WGS84 with WGS84');
        assert(f.q('.guest-map-pin'));const marker=current.markers[1];
        assert(Math.abs(marker.position[0]-places[2].longitude)<.0001);assert(Math.abs(marker.position[1]-places[2].latitude)<.0001);
        const from=new URL(f.q('#open-map').href).searchParams.get('from').split(',').map(Number);
        assert(Math.abs(from[0]-places[2].longitude)<.0001);assert(Math.abs(from[1]-places[2].latitude)<.0001);
      }else{
        f.requests[0].failure({code:outcome==='denied'?1:3});
        assert.match(f.q('#location-state').textContent,outcome==='denied'?/未获允许/:/超时/);
        assert(!f.q('.guest-map-pin'));assert(!f.q('#locate-guest').disabled);
        assert.equal(new URL(f.q('#open-map').href).searchParams.get('from'),'');
        f.q('#locate-guest').click();assert.equal(f.requests.length,2);
      }
      for(const place of places){
        f.app.setPlace(place);await flush();current=f.maps.at(-1);
        assert.equal(f.q('.wedding-map-label').textContent,place.displayName||place.name);
        assert(new URL(f.q('#open-map').href).searchParams.get('to').startsWith(place.longitude+','+place.latitude));
        current.events.complete();
      }
    }finally{f.close();}
  }
  console.log('PASS 三地点切换、定位成功/拒绝/超时、独立定位重试、GCJ-02标记、WGS84距离与导航起终点');
  const f=fixture();try{
    f.app.setPlace(places[0]);f.app.activate();await f.ready();
    const obsolete=f.maps.at(-1);await f.expire();assert.match(f.q('#map-message').textContent,/超时/);assert(!f.q('#retry-map').hidden);
    f.q('#retry-map').click();await flush();assert(obsolete.destroyed);assert.equal(f.requests.length,1,'Map retry must not prompt GPS again');
    obsolete.events.complete();assert(!f.q('#map-state').hidden,'An old completion must not dismiss a new load');
    f.maps.at(-1).events.complete();assert(f.q('#map-state').hidden);await f.expire();assert(f.q('#map-state').hidden);
    f.app.setPlace(places[1]);await flush();await f.expire();assert.match(f.q('#map-message').textContent,/超时/);
    assert.equal(new URL(f.q('#open-map').href).hostname,'uri.amap.com');
  }finally{f.close();}
  console.log('PASS 底图挂起有界超时、独立重试、迟到事件隔离、成功清理与新地点加载期限');
  for(const failure of ['timeout','network','key']){
    const f=fixture();try{
      f.app.setPlace(places[0]);f.app.activate();const obsolete=f.callback();
      if(failure==='timeout')await f.expire();
      else {if(failure==='network')f.script().onerror();else f.callback()('INVALID_USER_KEY');await flush();}
      assert(!f.q('#retry-map').hidden);assert(!f.script());
      f.q('#retry-map').click();assert(f.script());obsolete();await flush();assert.equal(f.maps.length,0);
      await f.ready();assert.equal(f.maps.length,1);f.maps[0].events.complete();assert(f.q('#map-state').hidden);
      assert.equal(f.requests.length,1);
    }finally{f.close();}
  }
  console.log('PASS 在线SDK挂起/网络失败/Key拒绝及重试、旧SDK回调隔离（受控SDK测试）');
})().catch(error=>{console.error(error);process.exitCode=1;});

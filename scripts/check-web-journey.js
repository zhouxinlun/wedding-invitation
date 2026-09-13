'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const dom=new JSDOM(fs.readFileSync(path.join(root,'web/index.html'),'utf8'));
try{
  const doc=dom.window.document,card=doc.querySelector('.journey-card');
  assert(card.querySelector('#destination-map'),'H5 travel card must include an inline map');
  assert(doc.querySelector('.journey-timing'),'Ceremony and arrival times belong below the card');
  assert(card.compareDocumentPosition(doc.querySelector('.journey-timing'))&dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
  assert(doc.querySelector('#locate-guest'),'Guests can retry their own location');
}finally{dom.window.close();}
console.log('PASS 赴宴地图、定位入口及卡片下方时间结构');

const config=require('../miniprogram/wedding'),journey=require('../miniprogram/journey');
const conversions=require('coordtransform');
const page=fs.readFileSync(path.join(root,'web/index.html'),'utf8');
for(const outcome of ['success','denied','timeout']){
  const runtime=new JSDOM(page,{url:'https://invitation.example/web/index.html',runScripts:'outside-only',pretendToBeVisual:true});
  const w=runtime.window,doc=w.document,requests=[];
  try{
    Object.defineProperty(w,'isSecureContext',{value:true});
    Object.defineProperty(w.navigator,'geolocation',{value:{getCurrentPosition:(success,failure,options)=>requests.push({success,failure,options})}});
    const container=doc.querySelector('#destination-map');
    Object.defineProperty(container,'clientWidth',{value:354});Object.defineProperty(container,'clientHeight',{value:180});
    w.WeddingJourney=journey;
    w.eval(fs.readFileSync(path.join(root,'dist/h5/web/vendor/journey-map.js'),'utf8'));
    const map=w.WeddingMap.create(),places=journey.destinations(config);
    map.setPlace(places[0]);assert.equal(requests.length,0,'No location request before entering travel');
    assert(!container.classList.contains('leaflet-container'),'No offscreen tile prefetch');
    map.activate();assert(container.classList.contains('leaflet-container'));
    assert.equal(requests.length,1);assert.equal(requests[0].options.timeout,12000);assert(requests[0].options.enableHighAccuracy);
    map.setPlace(places[2]);assert.equal(requests.length,1,'Switching destinations does not duplicate a pending location prompt');
    assert.equal(doc.querySelector('.wedding-map-label').textContent,places[2].displayName);
    assert.equal(new URL(doc.querySelector('#open-map').href).searchParams.get('from'),'');
    if(outcome==='success'){
      const point=conversions.gcj02towgs84(places[2].longitude,places[2].latitude);
      requests[0].success({coords:{latitude:point[1],longitude:point[0]}});
      assert.equal(doc.querySelector('#guest-distance').textContent,'不足 100 米','WGS84 origin must be compared with the converted destination');
      assert(doc.querySelector('.guest-map-pin'));
      const route=new URL(doc.querySelector('#open-map').href),from=route.searchParams.get('from').split(',').map(Number);
      assert(Math.abs(from[0]-places[2].longitude)<.0001);assert(Math.abs(from[1]-places[2].latitude)<.0001);
      map.setPlace(places[0]);assert.match(doc.querySelector('#guest-distance').textContent,/公里/);
      assert(new URL(doc.querySelector('#open-map').href).searchParams.get('to').startsWith(places[0].longitude+','+places[0].latitude));
    }else{
      requests[0].failure({code:outcome==='denied'?1:3});
      assert.match(doc.querySelector('#location-state').textContent,outcome==='denied'?/未获允许/:/超时/);
      assert(!doc.querySelector('.guest-map-pin'),'Never display an invented origin');
      assert(!doc.querySelector('#locate-guest').disabled);
      doc.querySelector('#locate-guest').click();assert.equal(requests.length,2,'A guest can retry denied/timed-out location');
    }
    for(const place of places){map.setPlace(place);assert.equal(doc.querySelector('.wedding-map-label').textContent,place.displayName||place.name);}
    assert(doc.querySelector('.leaflet-control-attribution a[href="https://www.openstreetmap.org/copyright"]'));
  }finally{w.close();}
}
console.log('PASS 真实 Leaflet 初始化、三地点切换、定位成功/拒绝/超时重试、坐标系转换、导航起终点和延迟定位');

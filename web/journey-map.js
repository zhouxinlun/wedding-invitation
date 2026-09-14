/* Destinations use GCJ-02. Browser GPS and straight-line distances use WGS84. */
const coordinates = require('coordtransform');

// JS API is loaded online from AMap, as required by its SDK distribution terms.
// The public browser Key belongs here; securityJsCode lives only in Nginx.
const MAP_KEY='e9c27479bd108ea4092a77a3bed700b4';
let api, apiRequest, callbackSequence=0;
function loadAMap() {
  if(api)return Promise.resolve(api);
  if(apiRequest)return apiRequest;
  window._AMapSecurityConfig={serviceHost:location.origin+'/_AMapService'};
  apiRequest=new Promise((resolve,reject)=>{
    const callback='weddingMapReady'+(++callbackSequence),script=document.createElement('script');
    let settled=false;
    const finish=(error)=>{
      if(settled)return;settled=true;clearTimeout(timer);script.remove();
      // A timed-out script can arrive late. Its own callback cannot settle a retry.
      window[callback]=()=>{delete window[callback];};
      if(error){apiRequest=null;reject(error);}
      else {delete window[callback];api=window.AMap;resolve(api);}
    };
    const timer=setTimeout(()=>finish(Error('timeout')),10000);
    window[callback]=error=>finish(error||!window.AMap?.Map ? Error('sdk') : null);
    script.onerror=()=>finish(Error('sdk'));
    script.src='https://webapi.amap.com/maps?'+new URLSearchParams({v:'2.0',key:MAP_KEY,callback,plugin:'AMap.ToolBar'});
    script.async=true;document.head.appendChild(script);
  });
  return apiRequest;
}

window.WeddingMap = {
  create() {
    const q = selector => document.querySelector(selector);
    const container=q('#destination-map'), mapState=q('#map-state'), distance=q('#guest-distance');
    const locationState=q('#location-state'), locateButton=q('#locate-guest'), route=q('#open-map');
    const mapMessage=q('#map-message'), retryMap=q('#retry-map');
    const journey=window.WeddingJourney;
    let map, destinationMarker, originMarker, place, destination, origin;
    let generation=0, deadline, loading=false;
    let active=false, requested=false, locating=false;

    function updateRoute() {
      if(!place?.canNavigate)return;
      const url=new URL('https://uri.amap.com/navigation');
      const from=origin ? coordinates.wgs84togcj02(origin.longitude,origin.latitude).join(',')+',我的位置' : '';
      url.search=new URLSearchParams({from,to:[place.longitude,place.latitude,place.fullName||place.name].join(','),mode:'car',policy:'0',src:'wedding-invitation',callnative:'0'});
      route.href=url.toString();
    }
    function showDistance() {
      distance.textContent=origin&&destination ? journey.formatDistance(journey.distanceKm(origin,destination)) : '你与这份欢喜，相距几许？';
      if(origin)locationState.textContent='直线距离 · 实际路程以导航为准';
      updateRoute();
    }
    function render() {
      if(!map||!destination)return;
      const target=[place.longitude,place.latitude];
      const pin=document.createElement('div');pin.className='wedding-map-pin';
      const label=document.createElement('span');label.className='wedding-map-label';label.textContent=place.displayName||place.name;
      const seal=document.createElement('b');seal.textContent='囍';pin.append(label,seal);
      if(!destinationMarker){destinationMarker=new api.Marker({position:target,anchor:'bottom-center',content:pin});map.add(destinationMarker);}
      else {destinationMarker.setPosition(target);destinationMarker.setContent(pin);}
      if(origin){
        const userPoint=coordinates.wgs84togcj02(origin.longitude,origin.latitude);
        if(!originMarker){
          const dot=document.createElement('div');dot.className='guest-map-pin';dot.title='我的位置';dot.append(document.createElement('span'));
          originMarker=new api.Marker({position:userPoint,anchor:'center',content:dot});map.add(originMarker);
        }else originMarker.setPosition(userPoint);
        map.setFitView([destinationMarker,originMarker],true,[55,35,35,35],15);
      }else map.setZoomAndCenter(16,target,true);
      container.setAttribute('aria-label',(place.displayName||place.name)+'地图');
      showDistance();
    }
    function showMapError(message) {
      mapState.hidden=false;retryMap.hidden=false;mapMessage.textContent=message+'，仍可打开导航';
    }
    async function ensureMap() {
      if(map){render();return;}
      if(loading)return;
      loading=true;
      const current=++generation;
      mapState.hidden=false;retryMap.hidden=true;mapMessage.textContent='正在展开地图…';
      clearTimeout(deadline);
      deadline=setTimeout(()=>{if(current===generation)showMapError('地图加载超时');},10000);
      try {
        await loadAMap();
        if(current!==generation)return;
        // A fresh map on destination changes gives every load its own completion
        // event. Old completions cannot hide a newer destination's loading state.
        map=new api.Map(container,{center:[place.longitude,place.latitude],zoom:16,viewMode:'2D',
          dragEnable:false,scrollWheel:false,touchZoom:true,doubleClickZoom:false,keyboardEnable:false,rotateEnable:false,pitchEnable:false});
        map.on('complete',()=>{
          if(current!==generation)return;
          clearTimeout(deadline);mapState.hidden=true;retryMap.hidden=true;
        });
        map.addControl(new api.ToolBar({position:{bottom:'28px',right:'10px'}}));
        render();
      }catch(error){
        if(current===generation){clearTimeout(deadline);showMapError(error.message==='timeout'?'地图加载超时':'地图暂未加载');}
      }finally{if(current===generation)loading=false;}
    }
    function resetMap() {
      ++generation;clearTimeout(deadline);loading=false;
      if(map)map.destroy();
      map=destinationMarker=originMarker=null;
    }
    retryMap.addEventListener('click',()=>{resetMap();ensureMap();});
    function locate() {
      if(locating)return;
      requested=true;
      if(!navigator.geolocation||!window.isSecureContext){locationState.textContent='当前浏览器无法定位，仍可打开导航';return;}
      locating=true;locateButton.disabled=true;locateButton.lastElementChild.textContent='正在定位';locationState.textContent='请允许获取手机当前位置';
      const finish=()=>{locating=false;locateButton.disabled=false;locateButton.lastElementChild.textContent=origin?'更新位置':'重新定位';};
      navigator.geolocation.getCurrentPosition(position=>{
        const next={latitude:position.coords.latitude,longitude:position.coords.longitude};
        if(!journey.hasCoordinates(next)){finish();locationState.textContent='未取得有效位置，请重试';return;}
        origin=next;finish();render();showDistance();
      },error=>{
        finish();locationState.textContent=error.code===1?'定位未获允许，可在微信或浏览器设置中开启':error.code===3?'定位超时，请重试或直接导航':'暂时无法定位，请重试或直接导航';
      },{enableHighAccuracy:true,timeout:12000,maximumAge:60000});
    }
    function activate() {
      active=true;
      if(!place?.canNavigate)return;
      ensureMap();
      if(!requested)locate();
    }
    locateButton.addEventListener('click',locate);
    return {
      activate,
      setPlace(next) {
        const changed=place?.id!==next.id;
        place=next;
        if(changed)resetMap();
        if(!place.canNavigate){container.parentElement.hidden=true;distance.parentElement.parentElement.hidden=true;return;}
        container.parentElement.hidden=false;distance.parentElement.parentElement.hidden=false;
        const [longitude,latitude]=coordinates.gcj02towgs84(place.longitude,place.latitude);
        destination={latitude,longitude};showDistance();
        if(active)activate();
      }
    };
  }
};

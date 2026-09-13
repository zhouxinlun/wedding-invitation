/* Built with Leaflet and coordtransform; mini-program coordinates stay GCJ-02. */
const L = require('leaflet');
const coordinates = require('coordtransform');

window.WeddingMap = {
  create() {
    const q = selector => document.querySelector(selector);
    const container=q('#destination-map'), mapState=q('#map-state'), distance=q('#guest-distance');
    const locationState=q('#location-state'), locateButton=q('#locate-guest'), route=q('#open-map');
    const journey=window.WeddingJourney;
    let map, tiles, destinationMarker, originMarker, place, destination, origin;
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
      const latlng=[destination.latitude,destination.longitude];
      const label=document.createElement('span');label.textContent=place.displayName||place.name;
      if(!destinationMarker)destinationMarker=L.marker(latlng,{icon:L.divIcon({className:'wedding-map-pin',html:'<span>囍</span>',iconSize:[34,40],iconAnchor:[17,40]}),keyboard:false}).addTo(map);
      destinationMarker.setLatLng(latlng).unbindTooltip().bindTooltip(label,{permanent:true,direction:'top',offset:[0,-36],className:'wedding-map-label'});
      if(origin){
        const userPoint=[origin.latitude,origin.longitude];
        if(!originMarker)originMarker=L.marker(userPoint,{icon:L.divIcon({className:'guest-map-pin',html:'<span></span>',iconSize:[18,18]}),keyboard:false}).bindTooltip('我的位置').addTo(map);
        originMarker.setLatLng(userPoint);
        map.fitBounds([latlng,userPoint],{padding:[45,45],maxZoom:15,animate:false});
      }else map.setView(latlng,16,{animate:false});
      container.setAttribute('aria-label',(place.displayName||place.name)+'地图');
      showDistance();
    }
    function ensureMap() {
      if(map)return;
      map=L.map(container,{zoomControl:false,scrollWheelZoom:false,dragging:false,touchZoom:true,doubleClickZoom:false,boxZoom:false,keyboard:false,attributionControl:true});
      map.attributionControl.setPrefix(false);
      L.control.zoom({position:'bottomright',zoomInTitle:'放大地图',zoomOutTitle:'缩小地图'}).addTo(map);
      let loaded=0,failed=0;
      tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
        maxZoom:19,keepBuffer:0,referrerPolicy:'strict-origin-when-cross-origin',
        attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
      });
      tiles.on('loading',()=>{loaded=0;failed=0;mapState.hidden=false;mapState.textContent='正在展开地图…';});
      tiles.on('tileload',()=>{loaded++;mapState.hidden=true;});
      tiles.on('tileerror',()=>{failed++;if(!loaded){mapState.hidden=false;mapState.textContent='底图暂未加载，可使用下方导航';}});
      tiles.on('load',()=>{mapState.hidden=!failed;if(failed)mapState.textContent=loaded?'部分底图未加载，可使用下方导航':'底图暂未加载，可使用下方导航';});
      tiles.addTo(map);
    }
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
      ensureMap();map.invalidateSize({pan:false});render();
      if(!requested)locate();
    }
    locateButton.addEventListener('click',()=>{if(tiles)tiles.redraw();locate();});
    return {
      activate,
      setPlace(next) {
        place=next;
        if(!place.canNavigate){container.parentElement.hidden=true;distance.parentElement.parentElement.hidden=true;return;}
        container.parentElement.hidden=false;distance.parentElement.parentElement.hidden=false;
        const [longitude,latitude]=coordinates.gcj02towgs84(place.longitude,place.latitude);
        destination={latitude,longitude};showDistance();
        if(active)activate();
      }
    };
  }
};

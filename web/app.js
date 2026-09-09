(() => {
  'use strict';
  const w = window.WEDDING;
  const fields = {...w, venue: w.venue.fullName, venueName: w.venue.name, branch: w.venue.branch, district: w.venue.district};
  document.querySelectorAll('[data-field]').forEach(el => {el.textContent = fields[el.dataset.field] || '';});
  const asset = file => '../miniprogram/assets/' + file;
  const grid = document.querySelector('#photo-grid');
  const photoAsset = photo => photo.package ? '../miniprogram/' + photo.package + '/images/' + photo.file : asset(photo.file);
  document.querySelector('#album-count').textContent = `${w.albums.length}本相册 · ${w.photos.length}个心动瞬间 · 轻触翻开`;
  const coverVines = window.WEDDING_VINES.plan('album-covers', Math.max(0, w.albums.length - 2));
  w.albums.forEach((album, index) => {
    const button = document.createElement('button'); button.className = 'album-book reveal' + (index === 0 ? ' book-feature' : ''); button.dataset.album = album.id;
    const count = w.photos.filter(photo => photo.group === album.id).length;
    button.setAttribute('aria-label', `翻开${album.title}，共${count}张`);
    const frame = document.createElement('span'); frame.className = 'book-photo';
    const img = new Image(); img.src = asset(album.cover); img.alt = album.title; img.loading = 'lazy'; img.width = 600; img.height = 400;
    const number = document.createElement('span'); number.className = 'book-number'; number.textContent = '0' + (index + 1);
    const open = document.createElement('span'); open.className = 'book-open'; open.textContent = '翻开 ↗'; frame.append(img, number, open);
    const label = document.createElement('span'); label.className = 'book-label';
    const title = document.createElement('span'); title.className = 'serif'; title.textContent = album.title;
    const total = document.createElement('span'); total.className = 'book-count'; total.textContent = count + '帧'; label.append(title, total); button.append(frame, label);
    if (index === 0) {const sub = document.createElement('span'); sub.className = 'book-subtitle'; sub.textContent = album.subtitle; button.append(sub);}
    if(index < w.albums.length - 2){const vine=document.createElement('span');vine.className='book-vine'+(index%2?' vine-reverse':'');vine.setAttribute('aria-hidden','true');const art=new Image();art.src=asset(coverVines[index]);art.alt='';art.loading='lazy';vine.append(art);button.append(vine);}
    grid.append(button);
  });
  const phases = document.querySelector('#schedule-phases');
  const make = (tag, cls, text) => {const el = document.createElement(tag); el.className = cls; if(text) el.textContent = text; return el;};
  w.schedule.forEach((phase, index) => {
    const section = make('section', 'schedule-phase reveal'); const heading = make('div','phase-heading'); const intro = make('div','phase-intro');
    const title = make('h3','phase-title serif'); title.append(make('span','phase-number','0'+(index+1)), document.createTextNode(phase.title));
    intro.append(title,make('p','phase-subtitle',phase.subtitle)); const link = make('a','phase-place',phase.placeLabel+' ↗'); link.href='#journey'; link.dataset.place=phase.destination;
    heading.append(intro,link); const list=make('ol','event-list');
    phase.events.forEach(event => {const row=make('li','schedule-event reveal'+(event.highlight?' event-highlight':''));const clock=make('div','event-clock');clock.append(make('time','',event.time)); if(event.end) clock.append(make('time','event-end','— '+event.end));if(event.timeNote)clock.append(make('span','event-time-note',event.timeNote));const copy=make('div','event-copy');copy.append(make('h4','event-title serif',event.title),make('p','event-detail',event.detail));row.append(clock,copy);list.append(row);});
    section.append(heading,list);phases.append(section);
  });
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const navLinks = [...document.querySelectorAll('.bottom-nav a')];
  const nav = document.querySelector('.bottom-nav');
  let turnTimer, navTimer, navigating = false, motionEnabled = true;
  function setMotion() {
    motionEnabled = !reduceMotion.matches;
    document.documentElement.classList.toggle('still', !motionEnabled);
    document.documentElement.classList.toggle('js-motion', motionEnabled && 'IntersectionObserver' in window);
  }
  setMotion(); reduceMotion.addEventListener('change', setMotion);
  function restoreNavigation() {clearTimeout(navTimer); nav.classList.remove('nav-quiet');}
  window.addEventListener('scroll', () => {
    nav.classList.add('nav-quiet'); clearTimeout(navTimer);
    navTimer = setTimeout(restoreNavigation, 220);
  }, {passive:true});
  nav.addEventListener('pointerdown', restoreNavigation);
  nav.addEventListener('focusin', restoreNavigation);
  document.addEventListener('visibilitychange', () => {
    document.documentElement.classList.toggle('paused', document.hidden);
    if(document.hidden) {restoreNavigation();clearTimeout(turnTimer);navigating=false;}
  });
  const snow = document.querySelector('.joy-snow');
  [3,94,11,85,22,74,6,91,33,65,16,80,44,57,1,98,29,70].forEach((left,i) => {
    const piece = document.createElement('span'); piece.className = 'snow-piece';
    piece.textContent = ['囍','喜','✦'][i%3];
    piece.style.cssText = `left:${left}%;font-size:${i%3===2?9:14}px;--sway:${(i%2?1:-1)*(10+i%4*5)}px;animation-duration:${12+i%6}s;animation-delay:${-i*1.73}s`;
    snow.append(piece);
  });
  function selectChapter(id) {
    const index = navLinks.findIndex(a => a.hash === '#' + id);
    if (index < 0) return;
    navLinks.forEach((a,i) => { a.classList.toggle('active',i===index); if(i===index) a.setAttribute('aria-current','location'); else a.removeAttribute('aria-current'); });
  }
  document.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', event => {
    const index = navLinks.findIndex(a => a.hash === link.hash);
    const target = document.querySelector(link.hash);
    if (!target || index < 0) return;
    event.preventDefault(); clearTimeout(turnTimer); navigating = true; selectChapter(target.id);
    restoreNavigation();
    target.scrollIntoView({behavior:motionEnabled?'smooth':'instant',block:'start'});
    history.replaceState(null,'',link.hash);
    turnTimer = setTimeout(()=>{navigating=false;},motionEnabled?520:0);
  }));
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {if(entry.isIntersecting) {entry.target.classList.add('visible'); revealObserver.unobserve(entry.target);}}), {threshold:.03});
    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
    const navObserver = new IntersectionObserver(entries => entries.forEach(entry => {if(entry.isIntersecting && !navigating) selectChapter(entry.target.id);}), {rootMargin:'-12% 0px -42% 0px'});
    document.querySelectorAll('.nav-section').forEach(el => navObserver.observe(el));
  }
  const blessings = ['愿你也被幸福偏爱','接住这一份喜气','好事成双，喜乐常伴','谢谢你来，见证我们'];
  let blessingIndex = 0, sparkTimer;
  document.querySelector('.joy-stamp').addEventListener('click', () => {
    const note=document.querySelector('.stamp-note'); note.textContent=blessings[blessingIndex++%blessings.length]; note.classList.add('has-blessing');
    const sparks=document.querySelector('.stamp-sparks'); sparks.replaceChildren(); clearTimeout(sparkTimer);
    if(motionEnabled) for(let i=0;i<8;i++){const ray=document.createElement('span');ray.className='spark-ray';ray.style.transform=`rotate(${i*45}deg)`;const glyph=document.createElement('span');glyph.className='spark-glyph';glyph.textContent=i%2?'喜':'囍';ray.append(glyph);sparks.append(ray);}
    sparkTimer=setTimeout(()=>sparks.replaceChildren(),1300);
  });
  const photoDialog = document.querySelector('#photo-dialog');
  let selectedPhoto = 0, previewPhotos = w.photos.filter(photo => !photo.package);
  function showPhoto(index) {
    selectedPhoto = (index + previewPhotos.length) % previewPhotos.length;
    const photo = previewPhotos[selectedPhoto]; const img = document.querySelector('#lightbox-image');
    img.classList.remove('photo-enter'); void img.offsetWidth; img.src = photoAsset(photo); img.alt = photo.title; img.classList.add('photo-enter'); document.querySelector('#lightbox-caption').textContent = `${selectedPhoto + 1} / ${previewPhotos.length}　${photo.title}`;
  }
  document.querySelectorAll('[data-photo]').forEach(button => button.addEventListener('click', () => {previewPhotos=w.photos.filter(photo=>!photo.package);showPhoto(Number(button.dataset.photo)); photoDialog.showModal();}));
  document.querySelectorAll('[data-album]').forEach(button => button.addEventListener('click', () => {previewPhotos=w.photos.filter(photo=>photo.group===button.dataset.album);showPhoto(0);photoDialog.showModal();}));
  document.querySelector('.photo-prev').addEventListener('click', () => showPhoto(selectedPhoto - 1));
  document.querySelector('.photo-next').addEventListener('click', () => showPhoto(selectedPhoto + 1));
  photoDialog.addEventListener('keydown', event => {if(event.key==='ArrowLeft') showPhoto(selectedPhoto-1); if(event.key==='ArrowRight') showPhoto(selectedPhoto+1);});
  let touchStart = 0;
  photoDialog.addEventListener('touchstart', event => {touchStart=event.changedTouches[0].clientX;},{passive:true});
  photoDialog.addEventListener('touchend', event => {const delta=event.changedTouches[0].clientX-touchStart;if(Math.abs(delta)>60) showPhoto(selectedPhoto+(delta<0?1:-1));},{passive:true});
  document.querySelectorAll('dialog .close-dialog').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  const toast = document.querySelector('.toast'); let toastTimer;
  function notify(message) {toast.textContent=message;toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.hidden=true,3200);}
  async function copy(text, successMessage) {
    try {
      if(navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
      else {const input=document.createElement('textarea');input.value=text;input.style.cssText='position:fixed;top:0;left:0;opacity:0';document.body.append(input);input.select();const copied=document.execCommand('copy');input.remove();if(!copied) throw new Error('copy unavailable');}
      notify(successMessage);
    } catch {notify('复制未成功，请长按文字手动复制。');}
  }
  const journey = window.WeddingJourney;
  const places = journey.destinations(w);
  let selectedPlace = places[0];
  const tabs = document.querySelector('.destination-tabs');
  function selectPlace(index) {
    selectedPlace = places[index];
    document.querySelector('#place-label').textContent = selectedPlace.label;
    document.querySelector('#place-name').textContent = selectedPlace.displayName || selectedPlace.name;
    document.querySelector('#place-room').textContent = selectedPlace.room || '';
    document.querySelector('#place-detail-note').textContent = selectedPlace.note || '';
    document.querySelector('#open-map .button-title').textContent = '打开' + selectedPlace.label + '导航';
    document.querySelector('#place-branch').textContent = selectedPlace.branch || '';
    document.querySelector('#place-address').textContent = [selectedPlace.district,selectedPlace.address].filter(Boolean).join(' ');
    [...tabs.children].forEach((button,i)=>{button.classList.toggle('selected',index===i);button.setAttribute('aria-pressed',String(index===i));});
    const mapLink = document.querySelector('#open-map'); mapLink.hidden = !selectedPlace.canNavigate;
    document.querySelector('#copy-venue').classList.toggle('copy-only',!selectedPlace.canNavigate);
    if(selectedPlace.canNavigate) {
      const url = new URL('https://uri.amap.com/marker');
      url.search = new URLSearchParams({position:selectedPlace.longitude+','+selectedPlace.latitude,name:selectedPlace.fullName||selectedPlace.name,coordinate:'gaode',callnative:'0'}).toString();
      mapLink.href = url.toString();
    } else mapLink.removeAttribute('href');
    document.querySelector('#map-note').textContent = selectedPlace.canNavigate ? '微信小程序内支持定位授权、小地图与直线距离；这里可直接打开所选地点导航。' : '复制完整店名，可在地图中搜索路线。';
  }
  places.forEach((place,index)=>{const button=document.createElement('button');button.textContent=place.label;button.addEventListener('click',()=>selectPlace(index));tabs.append(button);});
  tabs.hidden = places.length < 2; selectPlace(0);
  document.querySelectorAll('[data-place]').forEach(link => link.addEventListener('click', () => {const index=places.findIndex(place=>place.id===link.dataset.place);if(index>=0)selectPlace(index);}));
  document.querySelector('#copy-venue').addEventListener('click', () => copy(journey.addressText(selectedPlace),'赴约地址已复制'));
  document.querySelector('#share-invite').addEventListener('click',()=>document.querySelector('#share-dialog').showModal());
  const caption=`我们结婚啦！\n${w.groom} & ${w.bride}\n诚邀你在${w.dateLabel} ${w.ceremonyTime}，来见证我们的婚礼。\n${w.venue.district} · ${w.venue.fullName} · ${w.venue.room}\n请于${w.guestArrivalTime}前到场。\n带着祝福来，就很好。`;
  document.querySelector('#copy-caption').addEventListener('click',()=>copy(caption,'邀请文案已复制'));
  const filmDialog=document.querySelector('#film-dialog'); const video=document.querySelector('#opening-film');
  if(w.openingFilm.enabled && w.openingFilm.url){
    const button=document.querySelector('#watch-film');button.hidden=false;
    document.querySelector('.cinema-coming').hidden=true;
    document.querySelector('#cinema-status').textContent='轻触欣赏 ↗';
    document.querySelector('.cinema-portal').classList.add('cinema-ready');
    if(w.openingFilm.poster){const poster=document.querySelector('.cinema-poster');poster.src=w.openingFilm.poster;poster.hidden=false;}
    video.src=w.openingFilm.url;video.poster=w.openingFilm.poster||'';
    const error=document.querySelector('#film-error'), state=document.querySelector('#film-state');
    let filmTimer;
    const failed=()=>{if(!filmDialog.open)return;clearTimeout(filmTimer);video.pause();video.hidden=true;error.hidden=false;state.textContent='我们的喜帖，随时为你展开';};
    const openFilm=()=>{
      clearTimeout(filmTimer);error.hidden=true;video.hidden=false;
      document.querySelector('#film-percent').textContent='0%';document.querySelector('.film-progress div').style.width='0%';
      state.textContent='正在展开影像…';if(!filmDialog.open)filmDialog.showModal();
      video.load();filmTimer=setTimeout(failed,20000);
      video.play().catch(()=>{clearTimeout(filmTimer);if(filmDialog.open && error.hidden)state.textContent='轻触播放，展开这一场梦';});
    };
    button.addEventListener('click',openFilm);document.querySelector('#retry-film').addEventListener('click',openFilm);
    document.querySelector('#skip-failed-film').addEventListener('click',()=>filmDialog.close());
    filmDialog.addEventListener('close',()=>{clearTimeout(filmTimer);video.pause();});
    video.addEventListener('playing',()=>{clearTimeout(filmTimer);state.textContent='一舞惊鸿，赴一生之约';});
    video.addEventListener('timeupdate',()=>{if(!filmDialog.open||!(video.duration>0))return;const progress=Math.max(0,Math.min(100,Math.floor(video.currentTime/video.duration*100)));document.querySelector('#film-percent').textContent=progress+'%';document.querySelector('.film-progress div').style.width=progress+'%';});
    video.addEventListener('ended',()=>filmDialog.close());video.addEventListener('error',failed);
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&filmDialog.open)filmDialog.close();});
  }
})();

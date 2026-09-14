(() => {
  'use strict';
  const w = window.WEDDING;
  const journeyMap = window.WeddingMap?.create();
  const fields = {...w, venue: w.venue.fullName, venueName: w.venue.name, branch: w.venue.branch, district: w.venue.district};
  document.querySelectorAll('[data-field]').forEach(el => {el.textContent = fields[el.dataset.field] || '';});
  const asset = file => '../miniprogram/assets/' + file;
  document.querySelectorAll('main > .nav-section').forEach(section => {
    const brand = document.createElement('div'); brand.className = 'chapter-brand';
    const seal = document.createElement('span'); seal.className = 'wax-seal';
    const logo = new Image(); logo.src = asset('couple-wax-seal.jpg'); logo.alt = '周新沦与李小妮 · 双名烫金封蜡'; logo.width = 80; logo.height = 80;
    seal.append(logo); brand.append(seal); section.prepend(brand);
  });
  const grid = document.querySelector('#photo-grid');
  document.querySelector('#album-count').textContent = `${w.albums.length}本相册 · ${w.photos.length}个心动瞬间 · 轻触翻开`;
  const coverVines = window.WEDDING_VINES.plan('album-covers', Math.max(0, w.albums.length - 2));
  w.albums.forEach((album, index) => {
    const button = document.createElement('button'); button.className = 'album-book reveal' + (index === 0 ? ' book-feature' : ''); button.dataset.album = album.id;
    const count = w.photos.filter(photo => photo.group === album.id).length;
    button.setAttribute('aria-label', `翻开${album.title}，共${count}张`);
    const frame = document.createElement('span'); frame.className = 'book-photo';
    const img = new Image(); img.dataset.albumSrc = asset(album.cover); img.alt = album.title; img.loading = 'lazy'; img.width = 600; img.height = 400;
    const number = document.createElement('span'); number.className = 'book-number'; number.textContent = '0' + (index + 1);
    const open = document.createElement('span'); open.className = 'book-open'; open.textContent = '翻开 ↗'; frame.append(img, number, open);
    const label = document.createElement('span'); label.className = 'book-label';
    const title = document.createElement('span'); title.className = 'serif'; title.textContent = album.title;
    const total = document.createElement('span'); total.className = 'book-count'; total.textContent = count + '帧'; label.append(title, total); button.append(frame, label);
    if (index === 0) {const sub = document.createElement('span'); sub.className = 'book-subtitle'; sub.textContent = album.subtitle; button.append(sub);}
    if(index < w.albums.length - 2){const vine=document.createElement('span');vine.className='book-vine'+(index%2?' vine-reverse':'');vine.setAttribute('aria-hidden','true');const art=new Image();art.dataset.albumSrc=asset(coverVines[index]);art.alt='';art.loading='lazy';vine.append(art);button.append(vine);}
    grid.append(button);
  });
  // Native lazy loading can fetch several screens ahead, behind the opening cover.
  // Give each album its real URLs only when that book approaches the viewport.
  function observeAlbums(){
    const load=book=>book.querySelectorAll('[data-album-src]').forEach(img=>{img.src=img.dataset.albumSrc;delete img.dataset.albumSrc;});
    if(!window.IntersectionObserver){grid.querySelectorAll('.album-book').forEach(load);return;}
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if(entry.isIntersecting){load(entry.target);observer.unobserve(entry.target);}
    }),{rootMargin:'240px 0px'});
    grid.querySelectorAll('.album-book').forEach(book=>observer.observe(book));
  }
  if(window.WeddingEntry?.pending)document.addEventListener('wedding:revealed',observeAlbums,{once:true});else observeAlbums();
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
  const chapters = navLinks.map(link => document.querySelector(link.hash));
  let turnTimer, navTimer, navigating = false, motionEnabled = true;
  function setMotion() {
    motionEnabled = !reduceMotion.matches;
    document.documentElement.classList.toggle('still', !motionEnabled);
    document.documentElement.classList.toggle('js-motion', motionEnabled && 'IntersectionObserver' in window);
  }
  setMotion(); reduceMotion.addEventListener('change', setMotion);
  function restoreNavigation() {
    clearTimeout(navTimer); nav.classList.remove('nav-quiet');
    if (!navigating) updateChapterAtViewport();
  }
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
    if(id==='journey'&&!document.documentElement.classList.contains('journey-active'))journeyMap?.activate();
    document.documentElement.classList.toggle('journey-active',id==='journey');
    document.documentElement.classList.toggle('opening-active', id === 'us');
    navLinks.forEach((a,i) => { a.classList.toggle('active',i===index); if(i===index) a.setAttribute('aria-current','location'); else a.removeAttribute('aria-current'); });
  }
  function updateChapterAtViewport() {
    const readingLine = (window.innerHeight - nav.getBoundingClientRect().height) * .3;
    let current = chapters[0];
    for (const chapter of chapters) {
      if (chapter.getBoundingClientRect().top > readingLine) break;
      current = chapter;
    }
    selectChapter(current.id);
  }
  function scrollToChapter(target, behavior) {
    if (target.id !== 'us' && target.id !== 'journey') {
      target.scrollIntoView({behavior,block:'start'});
      return;
    }
    const openingNode = target.id==='journey'?target.querySelector('.journey-card'):target;
    const opening = openingNode.getBoundingClientRect();
    // Reveal transforms move the painted card, not its final layout position.
    let absoluteTop = window.scrollY + opening.top;
    if(target.id==='journey'){
      absoluteTop=0;
      for(let node=openingNode;node;node=node.offsetParent)absoluteTop+=node.offsetTop;
    }
    const availableHeight = window.innerHeight - nav.getBoundingClientRect().height;
    const topSpace = Math.max(12, (availableHeight - opening.height) / 2);
    window.scrollTo({top:Math.max(0, absoluteTop - topSpace),behavior});
  }
  document.addEventListener('wedding:enter',()=>{
    scrollToChapter(document.querySelector('#us'),'instant');
    selectChapter('us');restoreNavigation();
  });
  // Old invitation links still land on the new opening; named chapters stay usable.
  function syncChapterFromHash() {
    if (location.hash === '#invitation') {
      history.replaceState(null, '', '#us');
      selectChapter('us');
      scrollToChapter(document.querySelector('#us'), 'instant');
    }
    selectChapter(location.hash.slice(1) || 'us');
  }
  syncChapterFromHash();
  window.addEventListener('hashchange', syncChapterFromHash);
  // Align once after the display font settles; never pull a guest back after interaction.
  if ((!location.hash || location.hash === '#us' || location.hash === '#journey') &&
      performance.getEntriesByType?.('navigation')[0]?.type !== 'back_forward') {
    const entryHash = location.hash;
    let interacted = false;
    const cancelAlignment = () => {interacted = true;};
    const inputEvents = ['pointerdown','touchstart','wheel','keydown'];
    inputEvents.forEach(type => window.addEventListener(type, cancelAlignment, {once:true,passive:true}));
    (document.fonts?.ready || Promise.resolve()).then(() => requestAnimationFrame(() => {
      inputEvents.forEach(type => window.removeEventListener(type, cancelAlignment));
      if (!interacted && location.hash === entryHash) {
        scrollToChapter(document.querySelector(entryHash==='#journey'?'#journey':'#us'), 'instant');
        restoreNavigation();
      }
    }));
  }
  document.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', event => {
    const index = navLinks.findIndex(a => a.hash === link.hash);
    const target = document.querySelector(link.hash);
    if (!target || index < 0) return;
    if(target.id==='journey'&&link.dataset.place){
      const destinationIndex=places.findIndex(place=>place.id===link.dataset.place);
      if(destinationIndex>=0)selectPlace(destinationIndex);
    }
    event.preventDefault(); clearTimeout(turnTimer); navigating = true; selectChapter(target.id);
    restoreNavigation();
    scrollToChapter(target, motionEnabled?'smooth':'instant');
    history.replaceState(null,'',link.hash);
    turnTimer = setTimeout(()=>{navigating=false;updateChapterAtViewport();},motionEnabled?520:0);
  }));
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {if(entry.isIntersecting) {entry.target.classList.add('visible'); revealObserver.unobserve(entry.target);}}), {threshold:.03});
    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
    // Observer notifications may describe a chapter we have already scrolled past.
    const navObserver = new IntersectionObserver(() => {if(!navigating) updateChapterAtViewport();}, {rootMargin:'-12% 0px -42% 0px'});
    document.querySelectorAll('.nav-section').forEach(el => navObserver.observe(el));
  }
  const photoDialog = document.querySelector('#photo-dialog');
  const photoSnow = snow.cloneNode(true); photoSnow.classList.add('photo-snow'); photoDialog.prepend(photoSnow);
  const photoFrame = document.querySelector('.lightbox-frame'), photoVines = document.querySelector('.lightbox-vines');
  let selectedPhoto = 0, previewPhotos = w.photos.filter(photo => !photo.package),photoRequest=0;
  const photoState=make('div','photo-state'),photoMessage=make('p','','正在展开这一帧…'),photoRetry=make('button','outline-btn','重新加载');
  photoState.setAttribute('role','status');photoRetry.type='button';photoState.append(photoMessage,photoRetry);photoDialog.querySelector('figure').append(photoState);
  function photoFailed(){photoState.hidden=false;photoRetry.hidden=false;photoMessage.textContent='这张照片暂时未能打开';document.querySelector('#lightbox-image').hidden=true;photoFrame.classList.remove('photo-ready');}
  async function showPhoto(index,force=false) {
    selectedPhoto = (index + previewPhotos.length) % previewPhotos.length;
    const photo = previewPhotos[selectedPhoto]; const img = document.querySelector('#lightbox-image');
    const request=++photoRequest;img.hidden=true;img.removeAttribute('src');photoState.hidden=false;photoRetry.hidden=true;photoMessage.textContent='正在展开这一帧…';
    photoFrame.classList.remove('photo-ready'); photoVines.replaceChildren();
    window.WEDDING_VINES.plan('lightbox:'+photo.file,4).forEach((file,i)=>{
      const branch=make('span','lightbox-vine vine-side-'+i),art=new Image();art.src=asset(file);art.alt='';art.width=660;art.height=220;art.draggable=false;branch.append(art);photoVines.append(branch);
    });
    document.querySelector('#lightbox-caption').textContent = `${selectedPhoto + 1} / ${previewPhotos.length}　${photo.title}`;
    try{
      // The approved cover ships with the page; other originals retain signed cloud URLs.
      const result=photo.cloud ? await window.WeddingCloud.album(photo.group,force) : null;
      if(request!==photoRequest)return;
      const media=photo.cloud ? result.photos.find(item=>item.file===photo.file) : {url:photo.package?'../miniprogram/'+photo.package+'/images/'+photo.file:asset(photo.file)};if(!media)throw Error('PHOTO_MISSING');
      img.onload=()=>{if(request!==photoRequest)return;photoState.hidden=true;img.hidden=false;img.classList.remove('photo-enter');void img.offsetWidth;img.classList.add('photo-enter');photoFrame.classList.add('photo-ready');};
      img.onerror=()=>{if(request===photoRequest)photoFailed();};img.alt=photo.title;img.src=media.url;
    }catch(_){if(request===photoRequest)photoFailed();}
  }
  photoRetry.onclick=()=>showPhoto(selectedPhoto,true);
  photoDialog.addEventListener('close',()=>{photoRequest++;});
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
    document.querySelector('#map-note').textContent = selectedPlace.canNavigate ? '定位仅用于本次查看距离与导航。' : '复制完整店名，可在地图中搜索路线。';
    journeyMap?.setPlace(selectedPlace);
  }
  places.forEach((place,index)=>{const button=document.createElement('button');button.textContent=place.label;button.type='button';button.addEventListener('click',()=>selectPlace(index));tabs.append(button);});
  tabs.hidden = places.length < 2; selectPlace(0);
  document.querySelector('#copy-venue').addEventListener('click', () => copy(journey.addressText(selectedPlace),'赴约地址已复制'));
})();

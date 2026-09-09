(() => {
  'use strict';
  const wedding = window.WEDDING;
  const asset = '../miniprogram/assets/';
  const photoUrl = photo => photo.package ? `../miniprogram/${photo.package}/images/${photo.file}` : asset + photo.file;
  const selected = new URLSearchParams(location.search).get('group');
  const album = wedding.albums.find(item => item.id === selected) || wedding.albums[0];
  const photos = wedding.photos.filter(photo => photo.group === album.id);
  const selector = document.querySelector('#choose-album');
  wedding.albums.forEach(item => {const option = document.createElement('option');option.value = item.id;option.textContent = item.title;option.selected = item.id === album.id;selector.append(option);});
  selector.addEventListener('change', () => {location.href = 'album-preview.html?group=' + encodeURIComponent(selector.value);});
  document.title = album.title + ' · 良辰之约';
  document.querySelector('.gallery-title').textContent = album.title;
  document.querySelector('.gallery-subtitle').textContent = album.subtitle;
  document.querySelector('.gallery-eyebrow').textContent = `OUR MOMENTS · ${photos.length} 帧心动`;
  const grid = document.querySelector('.gallery-grid');
  const dialog = document.querySelector('.photo-dialog');
  let current = 0;
  function showPhoto(index) {
    current = (index + photos.length) % photos.length;
    const image = document.querySelector('#album-large');image.src = photoUrl(photos[current]);image.alt = photos[current].title;
    dialog.querySelector('figcaption').textContent = `${current + 1} / ${photos.length}　${photos[current].title}`;
  }
  const ornaments = window.WEDDING_VINES.plan(album.id, Math.max(0, photos.length - 1));
  photos.forEach((photo, index) => {
    const section = document.createElement('section');section.className = 'gallery-photo gallery-reveal' + (index % 2 ? ' vine-reverse' : '');
    const button = document.createElement('button');button.className = 'photo-open';button.setAttribute('aria-label', '放大查看' + photo.title);
    const img = new Image();img.className = 'gallery-original';img.src = photoUrl(photo);img.alt = photo.title;img.loading = index ? 'lazy' : 'eager';
    if (photo.width && photo.height) {img.width = photo.width;img.height = photo.height;}
    button.append(img);button.addEventListener('click', () => {showPhoto(index);dialog.showModal();});
    const caption = document.createElement('div');caption.className = 'gallery-caption';
    const number = document.createElement('span');number.textContent = `${index + 1} / ${photos.length}`;
    const label = document.createElement('span');label.textContent = photo.label;caption.append(number, label);section.append(button, caption);
    if (index < photos.length - 1) {
      const bridge = document.createElement('div');bridge.className = 'vine-bridge gallery-reveal';bridge.setAttribute('aria-hidden', 'true');
      const unfurl = document.createElement('div');unfurl.className = 'vine-unfurl';
      const vine = new Image();vine.src = asset + ornaments[index];vine.alt = '';vine.className = 'vine-art';vine.loading = 'lazy';
      unfurl.append(vine);bridge.append(unfurl);section.append(bridge);
    }
    grid.append(section);
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {entry.target.classList.add('photo-visible', 'vine-visible');observer.unobserve(entry.target);}
    }), {rootMargin:'0px 0px 25px 0px'});
    document.querySelectorAll('.gallery-reveal').forEach(el => observer.observe(el));
    window.addEventListener('pagehide', () => observer.disconnect(), {once:true});
  } else document.querySelectorAll('.gallery-reveal').forEach(el => el.classList.add('photo-visible', 'vine-visible'));
  dialog.querySelector('.close-dialog').addEventListener('click', () => dialog.close());
  dialog.querySelector('.photo-prev').addEventListener('click', () => showPhoto(current - 1));
  dialog.querySelector('.photo-next').addEventListener('click', () => showPhoto(current + 1));
  dialog.addEventListener('keydown', event => {if(event.key === 'ArrowLeft')showPhoto(current - 1);if(event.key === 'ArrowRight')showPhoto(current + 1);});
  let start;
  dialog.addEventListener('touchstart', event => {start = event.changedTouches[0].clientX;}, {passive:true});
  dialog.addEventListener('touchend', event => {const delta = event.changedTouches[0].clientX - start;if(Math.abs(delta) > 60)showPhoto(current + (delta < 0 ? 1 : -1));}, {passive:true});
  document.addEventListener('visibilitychange', () => document.body.classList.toggle('paused', document.hidden));
})();

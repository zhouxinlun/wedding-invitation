const wedding = require('../../wedding');
const journey = require('../../journey');
const previewImages = require('../../shared/preview-images');
const vines = require('../../shared/rose-vines');
const coverVines = vines.plan('album-covers', Math.max(0, wedding.albums.length - 2));
const destinations = journey.destinations(wedding);
const chapters = [
  {id: 'invitation', label: '喜帖', title: '翻开这一封喜悦'},
  {id: 'film', label: '影像', title: '一眼千年，珍藏此刻'},
  {id: 'us', label: '我们', title: '把余生，写成我们'},
  {id: 'album', label: '相册', title: '收藏每一个心动'},
  {id: 'blessings', label: '祝福', title: '有你们，欢喜成双'},
  {id: 'schedule', label: '流程', title: '从清晨，走向一生'},
  {id: 'journey', label: '赴宴', title: '赴一场，满心欢喜'}
];
const blessings = ['愿你也被幸福偏爱', '接住这一份喜气', '好事成双，喜乐常伴', '谢谢你来，见证我们'];
const confetti = Array.from({length: 18}, (_, i) => ({
  id: i, glyph: i % 3 === 0 ? '囍' : (i % 3 === 1 ? '喜' : '✦'),
  left: [3, 94, 11, 85, 22, 74, 6, 91, 33, 65, 16, 80, 44, 57, 1, 98, 29, 70][i],
  duration: 12 + i % 6, delay: -(i * 1.73), size: i % 3 === 2 ? 15 : 24 + i % 3 * 4,
  sway: (i % 2 ? 1 : -1) * (20 + i % 4 * 10)
}));
function markers(place, origin) {
  const destination = place.canNavigate ? [{id: 1, latitude: place.latitude, longitude: place.longitude,
    iconPath: '/assets/map-marker.png', width: 30, height: 30,
    callout: {content: place.fullName || place.name, display: 'ALWAYS', color: '#123d40',
      bgColor: '#fff6e4', borderRadius: 12, padding: 10, fontSize: 12}}] : [];
  if (destination.length && origin) destination.push({id: 2, ...origin, iconPath: '/assets/map-marker.png', width: 24, height: 24,
    callout: {content: '你在这里', display: 'ALWAYS', color: '#fff6e4', bgColor: '#123d40', borderRadius: 12, padding: 8, fontSize: 12}});
  return destination;
}
Page({
  data: {
    wedding, chapters, confetti, destinations,
    photos: wedding.photos.filter(photo => !photo.package).map(photo => ({...photo, url: '/assets/' + photo.file})),
    albums: wedding.albums.map((album, index) => ({...album, vine: coverVines[index] || '', count: wedding.photos.filter(photo => photo.group === album.id).length})),
    active: 'invitation', activeIndex: 0, motion: true, pageVisible: true, navQuiet: false,
    revealReady: false, revealed: {}, sparks: [], blessing: '',
    filmReady: !!(wedding.openingFilm.enabled && wedding.openingFilm.url),
    filmOpen: false, filmError: false, filmLoading: false, filmProgress: 0,
    selectedPlace: destinations[0], selectedIndex: 0,
    mapMarkers: markers(destinations[0]), canNavigate: destinations[0].canNavigate,
    hasOrigin: false, locationDenied: false, navigationRequested: false, distance: '', distanceState: 'idle', distanceNote: '轻触计算你与喜宴的距离',
    privacyOpen: false, privacyContractName: '隐私保护指引'
  },
  onLoad() {
    this._alive = true; this._blessingIndex = 0;
    wx.showShareMenu({menus: ['shareAppMessage', 'shareTimeline']});
  },
  onReady() {
    try {
      this.sectionObserver = this.createIntersectionObserver({observeAll: true, nativeMode: true});
      this.sectionObserver.relativeToViewport({top: -70, bottom: -180}).observe('.nav-section', result => {
        if (result.intersectionRatio > 0 && !this._navigating && this._alive) {
          const index = chapters.findIndex(chapter => chapter.id === result.id);
          if (index >= 0 && this.data.active !== result.id) this.setData({active: result.id, activeIndex: index});
        }
      });
      this.revealObserver = this.createIntersectionObserver({observeAll: true, nativeMode: true, thresholds: [0, .05]});
      this.revealObserver.relativeToViewport({bottom: -35}).observe('.reveal-section', result => {
        if (result.intersectionRatio > 0 && !this.data.revealed[result.id] && this._alive)
          this.setData({['revealed.' + result.id]: true});
      });
      this.setData({revealReady: true});
    } catch (_) { this.setData({revealReady: false}); }
  },
  onShow() { this.setData({pageVisible: true}); },
  onHide() {
    clearTimeout(this._navTimer); clearTimeout(this._turnTimer); this._navigating = false;
    this.closeFilm(); this.setData({pageVisible: false, navQuiet: false});
  },
  onPageScroll() {
    if (!this._alive || !this.data.pageVisible) return;
    if (!this.data.navQuiet) this.setData({navQuiet: true});
    clearTimeout(this._navTimer);
    this._navTimer = setTimeout(() => {
      if (this._alive) this.setData({navQuiet: false});
    }, 220);
  },
  showNavigation() { clearTimeout(this._navTimer); this.setData({navQuiet: false}); },
  onUnload() {
    this._alive = false; this._origin = null; previewImages.cleanup(this);
    [this.sectionObserver, this.revealObserver].forEach(observer => { if (observer) observer.disconnect(); });
    [this._turnTimer, this._navTimer, this._sparkTimer, this._locationTimer, this._filmTimer].forEach(clearTimeout);
  },
  navigate(event) {
    const index = chapters.findIndex(chapter => chapter.id === event.currentTarget.dataset.target);
    if (index < 0) return;
    const chapter = chapters[index];
    clearTimeout(this._turnTimer); this._navigating = true;
    this.showNavigation(); this.setData({active: chapter.id, activeIndex: index});
    wx.pageScrollTo({selector: '#' + chapter.id, duration: this.data.motion ? 420 : 0, offsetTop: -22});
    this._turnTimer = setTimeout(() => { this._navigating = false; }, this.data.motion ? 520 : 0);
  },
  celebrate() {
    const index = this._blessingIndex++;
    clearTimeout(this._sparkTimer);
    this.setData({blessing: blessings[index % blessings.length],
      sparks: this.data.motion ? Array.from({length: 8}, (_, i) => ({id: index * 8 + i, angle: i * 45, glyph: i % 2 ? '喜' : '囍'})) : []});
    this._sparkTimer = setTimeout(() => { if (this._alive) this.setData({sparks: []}); }, 1300);
  },
  previewPhoto(event) {
    return previewImages(this, event.currentTarget.dataset.src, this.data.photos.map(photo => photo.url));
  },
  openAlbum(event) {
    const album = wedding.albums.find(item => item.id === event.currentTarget.dataset.id);
    if (!album || this._openingAlbum) return;
    this._openingAlbum = true;
    wx.navigateTo({url: '/' + album.package + '/pages/gallery/index?group=' + album.id,
      fail: () => wx.showToast({title: '相册暂未打开，请轻触重试', icon: 'none'}),
      complete: () => { this._openingAlbum = false; }});
  },
  scheduleDestination(event) {
    const index = destinations.findIndex(place => place.id === event.currentTarget.dataset.place);
    if (index < 0) return;
    this.selectDestination({currentTarget: {dataset: {index}}});
    this.navigate({currentTarget: {dataset: {target: 'journey'}}});
  },
  selectDestination(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index) || !destinations[index]) return;
    const place = destinations[index];
    this._navigateAfterLocation = false;
    this.setData({selectedIndex: index, selectedPlace: place, mapMarkers: markers(place, this._origin), canNavigate: place.canNavigate, navigationRequested: false,
      distance: journey.formatDistance(journey.distanceKm(this._origin, place)),
      distanceState: this.data.distanceState === 'loading' ? 'loading' : this._origin && place.canNavigate ? 'ready' : 'idle',
      distanceNote: this._origin && place.canNavigate ? '直线距离 · 实际路程以导航为准' : '轻触计算你与目的地的距离'}, () => this.fitMap());
  },
  copyDestination() { this.copyPlace(this.data.selectedPlace); },
  copyVenue() { this.copyPlace(wedding.venue); },
  copyPlace(place) {
    wx.setClipboardData({data: journey.addressText(place),
      success: () => wx.showToast({title: '赴约地址已复制', icon: 'none'}),
      fail: () => wx.showToast({title: '请长按地址复制', icon: 'none'})});
  },
  navigateVenue() {
    if (this._origin) { this.openMap(this.data.selectedPlace); return; }
    this.beginLocation(true);
  },
  fitMap() {
    if (!this._origin || !this.data.canNavigate) return;
    const place = this.data.selectedPlace;
    wx.createMapContext('destination-map', this).includePoints({
      points: [this._origin, {latitude: place.latitude, longitude: place.longitude}], padding: [65, 45, 55, 45]
    });
  },
  openMap(place) {
    if (!journey.hasCoordinates(place)) { wx.showToast({title: '目的地位置尚未填写', icon: 'none'}); return; }
    wx.openLocation({latitude: place.latitude, longitude: place.longitude,
      name: place.fullName || place.name, address: place.address || place.district || '', scale: 16,
      fail: () => wx.showModal({title: '可用地址继续赴约', content: '地图暂时无法打开，复制地址后可在地图中搜索。',
        confirmText: '复制地址', success: result => { if (result.confirm) this.copyPlace(place); }})});
  },
  requestDistance() { this.beginLocation(false); },
  beginLocation(navigate) {
    if (!this.data.canNavigate) {
      this.setData({distanceNote: '可先复制完整店名，在地图中查看路程'}); return;
    }
    if (this.data.distanceState === 'loading') return;
    this._navigateAfterLocation = navigate;
    this._origin = null;
    this.setData({hasOrigin: false, navigationRequested: navigate, mapMarkers: markers(this.data.selectedPlace), distance: '', distanceState: 'loading', distanceNote: '正在准备定位'});
    if (typeof wx.getPrivacySetting !== 'function') { this.authorizeLocation(); return; }
    wx.getPrivacySetting({success: result => {
      if (!this._alive) return;
      if (result.needAuthorization) this.setData({privacyOpen: true, privacyContractName: result.privacyContractName || '隐私保护指引', distanceState: 'idle'});
      else this.authorizeLocation();
    }, fail: () => this.locationFailed()});
  },
  agreeDistance() { this.setData({privacyOpen: false}); this.authorizeLocation(); },
  cancelDistance() { this._navigateAfterLocation = false; this.setData({privacyOpen: false, navigationRequested: false, distanceState: 'idle', distanceNote: '慢慢来，我们等你；也可复制地址赴约'}); },
  openPrivacyContract() {
    wx.openPrivacyContract({fail: () => wx.showToast({title: '指引暂时无法打开', icon: 'none'})});
  },
  authorizeLocation() {
    if (!this._alive) return;
    this.setData({distanceState: 'loading', distanceNote: '等待你的定位授权'});
    // Give guests unlimited time to read WeChat's consent prompt. Only the subsequent GPS request times out.
    wx.authorize({scope: 'scope.userLocation', success: () => {
      if (this._alive) { this.setData({locationDenied: false}); this.locate(); }
    }, fail: () => { if (this._alive) { this.setData({locationDenied: true}); this.locationFailed(); } }});
  },
  openLocationSettings() {
    wx.openSetting({success: result => {
      if (!this._alive) return;
      if (result.authSetting['scope.userLocation']) {
        this.setData({locationDenied: false});
        this.beginLocation(this.data.navigationRequested);
      } else this.locationFailed();
    }, fail: () => this.locationFailed()});
  },
  locate() {
    if (!this._alive) return;
    this.setData({distanceState: 'loading', distanceNote: '正在计算与你的距离'});
    const request = {}; this._locationRequest = request;
    clearTimeout(this._locationTimer);
    this._locationTimer = setTimeout(() => {
      if (this._locationRequest === request) { this._locationRequest = null; this.locationFailed(); }
    }, 12000);
    wx.getLocation({type: 'gcj02', success: origin => {
      if (!this._alive || this._locationRequest !== request) return;
      clearTimeout(this._locationTimer); this._locationRequest = null;
      if (!journey.hasCoordinates(origin)) { this.locationFailed(); return; }
      this._origin = {latitude: origin.latitude, longitude: origin.longitude};
      this.setData({distance: journey.formatDistance(journey.distanceKm(this._origin, this.data.selectedPlace)),
        hasOrigin: true, mapMarkers: markers(this.data.selectedPlace, this._origin),
        distanceState: 'ready', locationDenied: false, distanceNote: '直线距离 · 实际路程以导航为准'}, () => {
          if (!this._alive) return;
          this.fitMap();
          if (this._navigateAfterLocation) { this._navigateAfterLocation = false; this.openMap(this.data.selectedPlace); }
        });
    }, fail: () => {
      if (this._locationRequest !== request) return;
      clearTimeout(this._locationTimer); this._locationRequest = null; this.locationFailed();
    }});
  },
  locationFailed() {
    if (this._alive) this.setData({distance: '', distanceState: 'error', distanceNote: this.data.locationDenied ? '可开启定位，或复制地址赴约' : '暂时无法获取位置，可重试或复制地址'});
  },
  openFilm() {
    if (!this.data.filmReady) return;
    clearTimeout(this._filmTimer);
    this.setData({filmOpen: true, filmError: false, filmLoading: true, filmProgress: 0});
    this._filmTimer = setTimeout(() => { if (this._alive && this.data.filmOpen) this.onFilmError(); }, 20000);
  },
  onFilmPlay() { clearTimeout(this._filmTimer); if (this.data.filmOpen) this.setData({filmLoading: false}); },
  onFilmTimeUpdate(event) {
    if (!this.data.filmOpen || this.data.filmError) return;
    const {currentTime, duration} = event.detail;
    if (!(duration > 0) || !Number.isFinite(currentTime)) return;
    const progress = Math.max(0, Math.min(100, Math.floor(currentTime / duration * 100)));
    if (progress !== this.data.filmProgress) this.setData({filmProgress: progress});
  },
  closeFilm() { clearTimeout(this._filmTimer); this.setData({filmOpen: false, filmLoading: false}); },
  onFilmError() { clearTimeout(this._filmTimer); if (this.data.filmOpen) this.setData({filmError: true, filmLoading: false}); },
  onShareAppMessage() {
    return {title: `${wedding.groom} & ${wedding.bride}｜10月6日，邀你赴约`, path: '/pages/invitation/index', imageUrl: '/assets/share-card.png'};
  },
  onShareTimeline() {
    return {title: `${wedding.groom} & ${wedding.bride}的婚礼请柬｜2026.10.06`, query: '', imageUrl: '/assets/share-square.png'};
  }
});

const wedding = require('../wedding');
const previewImages = require('./preview-images');
const vines = require('./rose-vines');
const client = require('./blessing-client');
module.exports = packageName => ({
  data: {album: null, photos: [], missing: false, revealReady: false, revealed: {}, pageVisible: true, mediaLoading: false, mediaError: false},
  onLoad(options) {
    this._alive = true;
    const album = wedding.albums.find(item => item.id === options.group && item.package === packageName);
    if (!album) { this.setData({missing: true}); return; }
    const selected = wedding.photos.filter(photo => photo.group === album.id && (!photo.package || photo.package === packageName));
    const ornaments = vines.plan(album.id, Math.max(0, selected.length - 1));
    const photos = selected.map((photo, index) => ({...photo,
      url: photo.cloud ? '' : photo.package ? '/' + photo.package + '/images/' + photo.file : '/assets/' + photo.file,
      loaded: false, failed: false,
      vine: ornaments[index] || ''}));
    this.setData({album, photos});
    wx.setNavigationBarTitle({title: album.title + ' · 良辰之约'});
    wx.showShareMenu({menus: ['shareAppMessage']});
    this.loadAlbumMedia().catch(() => {});
  },
  loadAlbumMedia(force) {
    if (!this.data.photos.some(photo => photo.cloud)) return Promise.resolve();
    if (this._mediaRequest) return this._mediaRequest;
    if (!force && this._mediaExpires > Date.now()) return Promise.resolve();
    this.setData({mediaLoading: true, mediaError: false});
    this._mediaRequest = client.invoke('album', {group: this.data.album.id}).then(result => {
      const urls = {};
      (result.photos || []).forEach(photo => { urls[photo.file] = photo.url; });
      if (!(result.expiresAt > Date.now()) || this.data.photos.some(photo => photo.cloud && !/^https:\/\//.test(urls[photo.file] || ''))) throw new Error('MEDIA_UNAVAILABLE');
      if (!this._alive) return;
      this._mediaExpires = result.expiresAt;
      this.setData({photos: this.data.photos.map(photo => ({...photo, url: photo.cloud ? urls[photo.file] : photo.url, failed: false})), mediaLoading: false});
    }).catch(error => {
      if (this._alive) this.setData({mediaLoading: false, mediaError: true});
      throw error;
    }).then(value => { this._mediaRequest = null; return value; }, error => { this._mediaRequest = null; throw error; });
    return this._mediaRequest;
  },
  retryAlbumMedia() { return this.loadAlbumMedia(true).catch(() => {}); },
  photoLoaded(event) { this.setData({['photos[' + event.currentTarget.dataset.index + '].loaded']: true}); },
  photoFailed(event) { const path = 'photos[' + event.currentTarget.dataset.index + ']'; this.setData({[path + '.failed']: true, [path + '.loaded']: false}); },
  previewPhoto(event) {
    const current = event.currentTarget.dataset.src;
    const index = this.data.photos.findIndex(photo => photo.url === current);
    if (index < 0 || !current) return Promise.resolve();
    return this.loadAlbumMedia().then(() => {
      if (!this._alive) return;
      const urls = this.data.photos.map(photo => photo.url);
      return previewImages(this, urls[index], urls);
    }).catch(() => { if (this._alive) wx.showToast({title: '照片暂未加载，请重试', icon: 'none'}); });
  },
  onReady() {
    if (this.data.missing) return;
    try {
      this.photoObserver = this.createIntersectionObserver({observeAll: true, nativeMode: true});
      this.photoObserver.relativeToViewport({bottom: 50}).observe('.gallery-reveal', result => {
        if (result.intersectionRatio > 0 && this._alive && !this.data.revealed[result.id])
          this.setData({['revealed.' + result.id]: true});
      });
      this.setData({revealReady: true});
    } catch (_) { this.setData({revealReady: false}); }
  },
  onShow() { this.setData({pageVisible: true}); if (this.data.album) this.loadAlbumMedia().catch(() => {}); },
  onHide() { this.setData({pageVisible: false}); },
  onUnload() { this._alive = false; if (this.photoObserver) this.photoObserver.disconnect(); previewImages.cleanup(this); },
  returnToInvite() {
    wx.navigateBack({fail: () => wx.reLaunch({url: '/pages/invitation/index'})});
  },
  onShareAppMessage() {
    const album = this.data.album;
    return album ? {title: wedding.groom + '与' + wedding.bride + ' · ' + album.title,
      path: '/' + packageName + '/pages/gallery/index?group=' + album.id, imageUrl: '/assets/' + album.cover} :
      {title: wedding.groom + '与' + wedding.bride + '的婚礼', path: '/pages/invitation/index', imageUrl: '/assets/share-card.png'};
  }
});

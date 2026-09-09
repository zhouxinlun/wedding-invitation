// WeChat's media viewer needs local media files, rather than code-package paths.
let serial = 0;
function remove(files) {
  const fs = wx.getFileSystemManager();
  files.forEach(filePath => fs.unlink({filePath, fail: () => {}}));
}
function cleanup(page) {
  if (page._previewFiles) remove(page._previewFiles);
  page._previewFiles = [];
}
function previewImages(page, current, urls) {
  if (page._previewLoading || !urls.includes(current)) return Promise.resolve();
  cleanup(page);
  page._previewLoading = true;
  const batch = Date.now() + '-' + (++serial);
  const fs = wx.getFileSystemManager();
  wx.showLoading({title: '正在展开照片', mask: true});
  return Promise.all(urls.map((src, index) => /^https:\/\//.test(src) ? Promise.resolve(src) : new Promise((resolve, reject) => {
    const filePath = wx.env.USER_DATA_PATH + '/wedding-preview-' + batch + '-' + index + '.jpg';
    fs.readFile({filePath: src, success: result => {
      fs.writeFile({filePath, data: result.data, success: () => {
        if (page._alive === false) remove([filePath]);
        else page._previewFiles.push(filePath);
        resolve(filePath);
      }, fail: reject});
    }, fail: reject});
  }))).then(paths => {
    wx.hideLoading();
    if (page._alive === false) return;
    wx.previewImage({current: paths[urls.indexOf(current)], urls: paths,
      fail: () => wx.showToast({title: '照片暂未打开，请重试', icon: 'none'})});
  }).catch(() => {
    wx.hideLoading();
    if (page._alive !== false) wx.showToast({title: '照片暂未加载，请重试', icon: 'none'});
  }).then(() => { page._previewLoading = false; });
}
module.exports = previewImages;
module.exports.cleanup = cleanup;

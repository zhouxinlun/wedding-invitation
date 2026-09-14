'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {createCanvas,loadImage}=require('@napi-rs/canvas'),jsQR=require('jsqr');
const {renderPoster}=require('./render-poster'),wedding=require('../miniprogram/wedding');

(async()=>{
  const bytes=await renderPoster(),original=await loadImage(bytes);
  assert.equal(original.width,1080);assert.equal(original.height,1920);
  // Decode the complete delivered picture, including its photograph and decorations,
  // after realistic resizing and JPEG compression, rather than testing a bare QR.
  for(const width of [1080,720,540]){
    const height=Math.round(width*original.height/original.width),canvas=createCanvas(width,height),c=canvas.getContext('2d');
    c.drawImage(original,0,0,width,height);
    const compressed=await loadImage(canvas.toBuffer('image/jpeg',70));
    c.drawImage(compressed,0,0);
    const decoded=jsQR(c.getImageData(0,0,width,height).data,width,height);
    assert(decoded,`Poster QR must survive a ${width}px-wide JPEG at quality 70`);
    assert.equal(decoded.data,new URL('/',wedding.shareUrl).href);
    assert(!new URL(decoded.data).search,'The poster cannot contain guest or preview parameters');
  }
  const destination=path.resolve(__dirname,'../exports/良辰之约-微信海报.jpg');
  await fs.mkdir(path.dirname(destination),{recursive:true});await fs.writeFile(destination,bytes);
  console.log('PASS 完整海报二维码：1080 / 720 / 540 像素、JPEG 70 压缩后均解码为正式请柬地址');
})().catch(error=>{console.error(error);process.exitCode=1;});

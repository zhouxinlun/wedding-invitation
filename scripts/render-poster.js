'use strict';
// Code-native invitation composition: the approved photograph is drawn proportionally,
// without retouching. This replaces the previous browser-only poster renderer.
const fs=require('node:fs/promises'),path=require('node:path');
const {createCanvas,loadImage,GlobalFonts}=require('@napi-rs/canvas');
const QRCode=require('qrcode');
const root=path.resolve(__dirname,'..');
const publicPath='web/media/wedding-share-poster.jpg';

async function renderPoster(w=require('../miniprogram/wedding')){
  GlobalFonts.registerFromPath(path.join(__dirname,'assets/wedding-poster.ttf'),'Wedding Poster');
  const asset=file=>loadImage(path.join(root,'miniprogram/assets',file));
  const [photo,leftVine,rightVine,seal]=await Promise.all([
    asset('couple-red-natural-v2.jpg'),asset('rose-vines/vine-01.png'),
    asset('rose-vines/vine-08.png'),asset('couple-wax-seal.jpg')
  ]);
  const canvas=createCanvas(1080,1920),c=canvas.getContext('2d');
  const gold='#e5c391',cream='#f8e9cd';
  c.fillStyle='#123d40';c.fillRect(0,0,1080,1920);
  const wash=c.createRadialGradient(260,360,30,400,800,1200);
  wash.addColorStop(0,'#28564e');wash.addColorStop(1,'#123d40');
  c.fillStyle=wash;c.fillRect(0,0,1080,1920);
  c.strokeStyle='#b397625e';c.lineWidth=1;c.strokeRect(30.5,30.5,1019,1859);
  c.strokeStyle='#b397622e';c.strokeRect(38.5,38.5,1003,1843);

  function text(value,y,size,{x=540,color=gold,spacing=0}={}){
    c.font=`${size}px "Wedding Poster"`;c.fillStyle=color;c.textBaseline='middle';
    const chars=[...value],widths=chars.map(ch=>c.measureText(ch).width);
    let left=x-(widths.reduce((a,b)=>a+b,0)+(chars.length-1)*spacing)/2;
    for(let i=0;i<chars.length;i++){c.fillText(chars[i],left,y);left+=widths[i]+spacing;}
  }
  function line(x,y,x2,y2,color='#b3976266'){
    c.beginPath();c.strokeStyle=color;c.lineWidth=1;c.moveTo(x,y);c.lineTo(x2,y2);c.stroke();
  }
  function arch(x,y,width,height){
    c.beginPath();c.moveTo(x,y+height);c.lineTo(x,y+width/2);
    c.arc(x+width/2,y+width/2,width/2,Math.PI,0);c.lineTo(x+width,y+height);c.closePath();
  }
  function vine(image,x,y,width,rotation){
    c.save();c.translate(x,y);c.rotate(rotation);c.drawImage(image,0,-width/6,width,width/3);c.restore();
  }
  text('一 封 喜 帖 · 一 生 之 约',90,19,{spacing:3});
  text('良辰之约',174,86,{color:cream,spacing:16});
  text('A PROMISE FOR LIFE',242,14,{spacing:5,color:'#bac5ad'});

  // The photo keeps its native 4:5 ratio. Only the arch's outer corners are clipped.
  const px=176,py=296,pw=728,ph=pw*photo.height/photo.width;
  c.save();arch(px,py,pw,ph);c.clip();c.drawImage(photo,px,py,pw,ph);c.restore();
  arch(px,py,pw,ph);c.strokeStyle='#e4c28c';c.lineWidth=2;c.stroke();
  arch(px-12,py-12,pw+24,ph+24);c.strokeStyle='#b99b656b';c.lineWidth=1;c.stroke();
  for(const [label,x] of [['谨备喜宴 · 敬候光临',98],['天作之合 · 佳偶天成',982]]){
    [...label].forEach((ch,i)=>text(ch,499+i*33,21,{x,color:'#c6ab79'}));
  }
  vine(leftVine,166,935,364,-Math.PI/2);
  vine(rightVine,916,1000,300,Math.PI/2);
  // Reuse the page's existing wax silhouette, including its exact clipped edge.
  const css=await fs.readFile(path.join(root,'web/h5.css'),'utf8');
  const polygon=css.match(/\.wax-seal img\{[^}]*clip-path:polygon\(([^)]+)\)/);
  if(!polygon)throw Error('Missing approved wax-seal silhouette');
  c.save();c.translate(184,1180);c.rotate(-.12);c.translate(-65,-65);
  c.beginPath();polygon[1].split(',').forEach((point,i)=>{
    const [x,y]=point.trim().split(/\s+/).map(parseFloat);c[i?'lineTo':'moveTo'](x*1.3,y*1.3);
  });c.closePath();c.clip();c.drawImage(seal,0,0,130,130);c.restore();

  text(w.groom,1290,54,{x:334,color:cream,spacing:5});
  text('&',1293,35,{x:540});text(w.bride,1290,54,{x:746,color:cream,spacing:5});
  line(160,1350,920,1350);
  text(w.date.replaceAll('-','.'),1398,42,{spacing:3});
  text(`${w.guestArrivalTime} 前到场  ·  ${w.ceremonyTime} 典礼`,1460,25,{color:'#e9d7b4',spacing:1});
  text(w.venue.fullName,1530,32,{color:cream,spacing:1});
  text(`${w.venue.district} · ${w.venue.room}`,1575,22,{color:'#c3cbb9',spacing:2});

  // Real QR modules, integer pixel size, four-module quiet zone. Decorations never
  // enter this square; even a shared image without accompanying text has its link.
  const url=new URL('/',w.shareUrl).href;
  const qr=QRCode.create(url,{errorCorrectionLevel:'M'}),moduleSize=6,quiet=4;
  const size=(qr.modules.size+quiet*2)*moduleSize,qx=(1080-size)/2,qy=1636;
  c.fillStyle='#fff9ed';c.fillRect(qx,qy,size,size);
  c.fillStyle='#123537';
  for(let row=0;row<qr.modules.size;row++)for(let col=0;col<qr.modules.size;col++){
    if(qr.modules.get(row,col))c.fillRect(qx+(quiet+col)*moduleSize,qy+(quiet+row)*moduleSize,moduleSize,moduleSize);
  }
  // Separate gold corner marks leave the quiet zone intact.
  for(const [x,y,dx,dy] of [[qx-8,qy-8,1,1],[qx+size+8,qy-8,-1,1],[qx-8,qy+size+8,1,-1],[qx+size+8,qy+size+8,-1,-1]]){
    line(x,y,x+dx*22,y,gold);line(x,y,x,y+dy*22,gold);
  }
  text('带着祝福来，就很好。',1733,24,{x:258,spacing:3});
  text('长按识别二维码',1724,22,{x:828,spacing:2});
  text('打开请柬',1766,22,{x:828,spacing:3});
  return canvas.toBuffer('image/jpeg',93);
}

if(require.main===module){
  renderPoster().then(async bytes=>{
    const destination=path.join(root,'exports/良辰之约-微信海报.jpg');
    await fs.mkdir(path.dirname(destination),{recursive:true});await fs.writeFile(destination,bytes);
    console.log(destination+' ('+bytes.length+' bytes)');
  }).catch(error=>{console.error(error);process.exitCode=1;});
}
module.exports={renderPoster,publicPath};

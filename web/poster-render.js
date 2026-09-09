// Render the invitation's own typography/layout at its native pixel size.
// Draw the original wedding photo proportionally; this renderer only lays out the invitation.
(async () => {
  if (new URLSearchParams(location.search).has('format')) return;
  const w = window.WEDDING;
  const photo = new Image(); photo.src = '../miniprogram/assets/couple-red.jpg'; await photo.decode();
  await document.fonts.ready;
  const canvas = document.createElement('canvas'); canvas.width=1080;canvas.height=1920;
  const c=canvas.getContext('2d');const gold='#e8c996';const serif='"Songti SC", "STSong", serif';
  c.fillStyle='#123d40';c.fillRect(0,0,1080,1920);
  const wash=c.createRadialGradient(100,160,0,100,160,1350);wash.addColorStop(0,'#285951');wash.addColorStop(1,'#123d40');c.fillStyle=wash;c.fillRect(0,0,1080,1920);
  c.lineWidth=1;c.strokeStyle='#829474';c.strokeRect(27.5,27.5,1025,1865);c.strokeStyle='#42694f';c.strokeRect(34.5,34.5,1011,1851);
  function text(value,y,size,{color=gold,font=serif,spacing=0,x=540}={}){
    c.font=`${size}px ${font}`;c.fillStyle=color;c.textBaseline='middle';
    const chars=[...value];const widths=chars.map(ch=>c.measureText(ch).width);let left=x-(widths.reduce((a,b)=>a+b,0)+(chars.length-1)*spacing)/2;
    chars.forEach((ch,i)=>{c.fillText(ch,left,y);left+=widths[i]+spacing;});
  }
  function arch(x,y,width,height){c.beginPath();c.moveTo(x,y+height);c.lineTo(x,y+width/2);c.arc(x+width/2,y+width/2,width/2,Math.PI,0);c.lineTo(x+width,y+height);c.closePath();}
  text('一 封 喜 帖 · 一 生 之 约',85,21,{font:'"PingFang SC",sans-serif',spacing:3});
  text('良辰之约',185,100,{spacing:17,color:'#f8dfad'});
  text('TOGETHER, A NEW CHAPTER',267,14,{font:'Arial,sans-serif',spacing:6,color:'#c6cdb6'});
  const px=122,py=326,pw=836,ph=975;
  arch(px-11,py-11,pw+22,ph+22);c.strokeStyle='#8e9b78';c.stroke();
  c.save();arch(px,py,pw,ph);c.clip();const ratio=Math.max(pw/photo.width,ph/photo.height);const dw=photo.width*ratio,dh=photo.height*ratio;c.drawImage(photo,px+(pw-dw)/2,py+(ph-dh)/2,dw,dh);c.restore();
  arch(px,py,pw,ph);c.strokeStyle='#d7b986';c.lineWidth=2;c.stroke();
  [['谨备喜宴 · 敬候光临',69],['天作之合 · 佳偶天成',1010]].forEach(([value,x])=>{[...value].forEach((ch,i)=>text(ch,455+i*30,20,{x,spacing:0,color:'#c3aa78'}));});
  c.save();c.translate(124,1110);c.rotate(-.1);c.fillStyle='#a74433';c.fillRect(-47,-52,94,105);c.strokeStyle='#e6b77d';c.strokeRect(-47,-52,94,105);text('囍',0,61,{x:0,color:'#ffdeb0'});c.restore();
  text(w.groom,1395,62,{x:334,spacing:7,color:'#f7eee0'});text('&',1395,42,{x:540,font:'Georgia,serif'});text(w.bride,1395,62,{x:746,spacing:7,color:'#f7eee0'});
  c.lineWidth=1;c.strokeStyle='#789475';c.beginPath();c.moveTo(134,1460);c.lineTo(946,1460);c.moveTo(134,1595);c.lineTo(946,1595);c.moveTo(365,1484);c.lineTo(365,1573);c.moveTo(715,1484);c.lineTo(715,1573);c.stroke();
  text('2026',1504,45,{x:250,font:'Georgia,serif',color:'#f7eee0'});text('年',1557,17,{x:250,font:'"PingFang SC",sans-serif',spacing:5,color:'#c3cdb7'});
  text('10.06',1526,81,{font:'Georgia,serif',color:'#e8c48b'});text(w.ceremonyTime,1504,45,{x:830,font:'Georgia,serif',color:'#f7eee0'});text('仪式开始',1557,17,{x:830,font:'"PingFang SC",sans-serif',spacing:5,color:'#c3cdb7'});
  text('诚邀您见证我们的婚礼',1646,22,{font:'"PingFang SC",sans-serif',spacing:5,color:'#cad3bf'});
  text(w.venue.fullName,1718,35,{spacing:2,color:'#f4dab0'});text(w.venue.district,1768,21,{font:'"PingFang SC",sans-serif',spacing:4,color:'#c8d0bb'});text('带着祝福来，就很好。',1830,18,{font:'"PingFang SC",sans-serif',spacing:4,color:'#d9bf8f'});
  const link=document.createElement('a');link.id='download-poster';link.download='良辰之约-微信请柬.png';link.href=canvas.toDataURL('image/png');link.textContent='保存高清请柬';link.style.cssText='position:fixed;right:18px;bottom:18px;padding:12px 20px;background:#e5c58e;color:#123d40;text-decoration:none;font-size:14px;z-index:5';document.body.append(link);
})();

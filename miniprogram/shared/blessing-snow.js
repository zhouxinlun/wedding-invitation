// One visual descriptor shared by the native invitation and its labelled Web preview.
(function(){
  const slots=6,positions=[4,53,18,60,8,42];
  function create(item,slot,serial){
    const variant=(serial-1)%6;
    let text=Array.from(item.text|| (item.photos&&item.photos.length?'珍藏的回忆也来赴约':'新婚快乐，永远幸福')).filter(c=>!/[\s，。！？、,.!?]/.test(c)).slice(0,10);
    if(!text.length)text=[item.emoji||'囍'];
    const chars=text.map((glyph,i)=>{
      let x=i*31,y=0,turn=0;
      if(variant===0){y=Math.sin(i/Math.max(1,text.length-1)*Math.PI)*24;turn=Math.cos(i/Math.max(1,text.length-1)*Math.PI)*9;}
      if(variant===1){x=i*28;y=i*9;turn=12;}
      if(variant===2){y=(i%2)*13;turn=i%2?7:-7;}
      if(variant===3){x=16+Math.sin(i*.9)*12;y=i*30;turn=Math.cos(i*.9)*8;}
      if(variant===4){y=Math.cos(i*.65)*18+18;turn=Math.sin(i*.65)*8;}
      if(variant===5){x=i*29;y=Math.abs(i-(text.length-1)/2)*10;turn=i<(text.length-1)/2?-9:9;}
      return {id:i,glyph,x:Math.round(x),y:Math.round(y),turn:Math.round(turn)};
    });
    chars.forEach((c,i)=>{const next=chars[i+1];if(!next)return;const dx=next.x-c.x,dy=next.y-c.y,angle=Math.atan2(dy,dx);Object.assign(c,{link:true,linkX:Math.round(c.x+14+Math.cos(angle)*12),linkY:Math.round(c.y+15+Math.sin(angle)*12),linkLength:Math.max(6,Math.round(Math.hypot(dx,dy)-24)),linkTurn:Math.round(angle*180/Math.PI)});});
    return {id:serial,postId:item.id,slot,variant,name:item.name,emoji:item.emoji||'♡',chars,
      width:Math.max(...chars.map(c=>c.x))+38,height:Math.max(...chars.map(c=>c.y))+62,
      left:positions[slot],duration:20+(serial%4)*2,drift:(slot%2?-1:1)*(24+serial%3*12),rotation:(slot%2?-1:1)*(3+serial%4),opacity:.3+(serial%3)*.045};
  }
  const api={slots,create};
  if(typeof module!=='undefined')module.exports=api;else window.WeddingBlessingSnow=api;
})();

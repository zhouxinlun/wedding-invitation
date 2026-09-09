(function(){
  function fit(width,height,maxWidth,maxHeight){
    if(!(width>0&&height>0))return {width:160,height:160};
    const scale=Math.min(maxWidth/width,maxHeight/height,1);
    return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
  }
  function append(text,emoji,limit=160){
    const value=String(text||'')+emoji;
    return Array.from(value).length>limit?null:value;
  }
  const api={fit,append};
  if(typeof module!=='undefined')module.exports=api;else window.WeddingBlessingEditor=api;
})();

'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),wedding=require('../miniprogram/wedding');
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
function fixture({wechat=false,lazy=false,gate=false}={}){
  const dom=new JSDOM(fs.readFileSync(path.join(root,'web/index.html'),'utf8'),{url:'https://local-preview.example/web/index.html?guest=private#album',runScripts:'outside-only'});
  const w=dom.window,d=w.document,calls=[],copies=[],requests=[];let intersect;
  w.WEDDING=wedding;w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  if(gate)w.WeddingEntry={pending:true};
  Object.defineProperty(w,'isSecureContext',{value:true});
  if(wechat)Object.defineProperty(w.navigator,'userAgent',{value:'Mozilla/5.0 iPhone MicroMessenger/8.0'});
  if(lazy)w.IntersectionObserver=class{constructor(callback){intersect=()=>callback([{isIntersecting:true}]);}observe(){}disconnect(){}};
  w.fetch=url=>{requests.push(url);throw Error('Poster saving does not need a second fetch');};
  w.navigator.canShare=()=>true;w.navigator.share=data=>{calls.push(data);return Promise.resolve();};
  Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async text=>copies.push(text)}});
  w.eval(fs.readFileSync(path.join(root,'web/share.js'),'utf8'));
  return {w,d,calls,copies,requests,intersect:()=>intersect(),button:d.querySelector('#share-invite'),dialog:d.querySelector('#share-dialog'),save:d.querySelector('#save-poster'),close:()=>w.close()};
}
(async()=>{
  for(const wechat of [false,true]){
    const f=fixture({wechat,lazy:true});try{
      assert.equal(f.d.querySelector('#share-poster').getAttribute('src'),null);
      f.button.click();assert(f.dialog.open);assert.equal(f.save.textContent,'保存海报长图');
      const poster=f.d.querySelector('#share-poster');assert.equal(f.save.href,poster.src);
      assert.equal(new URL(f.save.href).pathname,'/web/media/wedding-share-poster.jpg');
      assert.equal(f.save.download,'良辰之约-海报长图.jpg');
      const click=new f.w.MouseEvent('click',{bubbles:true,cancelable:true});
      // Capture the application's result, then suppress jsdom's unsupported navigation.
      let prevented;f.save.addEventListener('click',event=>{prevented=event.defaultPrevented;event.preventDefault();},{once:true});
      f.save.dispatchEvent(click);await flush();assert.equal(prevented,wechat);
      assert.equal(f.calls.length,0,'Saving never opens the system share sheet, even if file sharing is supported');
      assert.equal(f.requests.length,0,'Use the existing full-resolution JPEG rather than fetch a second Blob');
      if(wechat)assert.match(f.d.querySelector('#share-status').textContent,/长按.*保存到相册/);
      f.d.querySelector('#copy-link').click();await flush();assert.equal(f.copies[0],wedding.shareUrl);assert.match(f.d.querySelector('#share-status').textContent,/已复制/);
    }finally{f.close();}
  }
  const lazy=fixture({lazy:true});try{
    lazy.intersect();const poster=lazy.d.querySelector('#share-poster');assert(poster.getAttribute('src'));
    poster.dispatchEvent(new lazy.w.Event('error'));assert(!lazy.d.querySelector('#retry-poster').hidden);
    lazy.d.querySelector('#retry-poster').click();assert(lazy.d.querySelector('#retry-poster').hidden);
    poster.dispatchEvent(new lazy.w.Event('load'));assert(lazy.d.querySelector('#share-poster-status').hidden);
  }finally{lazy.close();}
  const gate=fixture({gate:true});try{
    const poster=gate.d.querySelector('#share-poster');assert.equal(poster.getAttribute('src'),null);
    gate.d.dispatchEvent(new gate.w.Event('wedding:revealed'));assert(poster.getAttribute('src'));
  }finally{gate.close();}
  console.log('PASS 保存完整海报长图、微信长按保存、无系统转发或重复下载、延迟取图与重试、正式链接复制');
})().catch(error=>{console.error(error);process.exitCode=1;});

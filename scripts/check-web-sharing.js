'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),wedding=require('../miniprogram/wedding');
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
function fixture({native=true,files=true,offline=false,pending=false,error=null,lazy=false}={}){
  const dom=new JSDOM(fs.readFileSync(path.join(root,'web/index.html'),'utf8'),{url:'https://local-preview.example/web/index.html?guest=private#album',runScripts:'outside-only'});
  const w=dom.window,d=w.document,calls=[],copies=[],requests=[];let resolveShare,resolveFetch,intersect;
  w.WEDDING=wedding;w.File=File;w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  Object.defineProperty(w,'isSecureContext',{value:true});
  if(lazy)w.IntersectionObserver=class{constructor(callback){intersect=()=>callback([{isIntersecting:true}]);}observe(){}disconnect(){}};
  const response={ok:true,blob:async()=>new Blob([fs.readFileSync(path.join(root,'exports/良辰之约-微信海报.jpg'))],{type:'image/jpeg'})};
  w.fetch=url=>{requests.push(url);return offline?Promise.reject(Error('offline')):pending?new Promise(resolve=>{resolveFetch=()=>resolve(response);}):Promise.resolve(response);};
  if(native){w.navigator.canShare=data=>data.files?files:true;w.navigator.share=data=>{calls.push(data);return error?Promise.reject(error):new Promise(resolve=>{resolveShare=resolve;});};}
  Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async text=>copies.push(text)}});
  w.eval(fs.readFileSync(path.join(root,'web/share.js'),'utf8'));
  return {w,d,calls,copies,requests,intersect:()=>intersect(),button:d.querySelector('#share-invite'),dialog:d.querySelector('#share-dialog'),save:d.querySelector('#save-poster'),ready:()=>resolveFetch(),finish:()=>resolveShare(),close:()=>w.close()};
}
(async()=>{
  const native=fixture();try{
    await flush();native.button.click();assert(native.dialog.open);assert.equal(native.calls.length,0);native.save.click();
    assert.equal(native.calls.length,1,'Share is called synchronously within the click, not after a fetch');
    native.save.click();assert.equal(native.calls.length,1,'A pending share cannot start twice');
    const payload=native.calls[0];assert.equal(payload.url,wedding.shareUrl);assert(payload.text.includes(wedding.groom));
    assert.equal(payload.files[0].type,'image/jpeg');
    assert.deepEqual(Buffer.from(await payload.files[0].arrayBuffer()),fs.readFileSync(path.join(root,'exports/良辰之约-微信海报.jpg')));
    assert.equal(native.dialog.open,true);native.finish();await flush();assert.equal(native.save.hasAttribute('aria-disabled'),false);
  }finally{native.close();}
  for(const options of [{native:false},{files:false},{offline:true},{pending:true},{error:Error('Sharing target unavailable')}]){
    const u=fixture(options);try{
      await flush();u.button.click();if(options.error)u.save.click();await flush();assert(u.dialog.open);
      assert.equal(u.d.querySelectorAll('.footer-actions>*').length,1);
      assert.equal(new URL(u.d.querySelector('.share-preview img').src).pathname,'/web/media/wedding-share-poster.jpg');
      u.d.querySelector('#copy-link').click();await flush();assert.equal(u.copies[0],wedding.shareUrl);assert.match(u.d.querySelector('#share-status').textContent,/已复制/);
      if(options.pending){u.ready();await flush();assert.equal(u.calls.length,0,'Finishing a fetch must never open a system share without a new click');}
    }finally{u.close();}
  }
  const cancel=fixture({error:Object.assign(Error('cancelled'),{name:'AbortError'})});try{
    await flush();cancel.button.click();cancel.save.click();await flush();assert(cancel.dialog.open);assert(!cancel.save.hasAttribute('aria-disabled'));assert.equal(cancel.d.querySelector('#share-status').textContent,'');
  }finally{cancel.close();}
  const lazy=fixture({lazy:true});try{
    await flush();assert.equal(lazy.requests.length,0);assert.equal(lazy.d.querySelector('#share-poster').getAttribute('src'),null,'The poster must not compete with opening media');
    lazy.intersect();await flush();assert.equal(lazy.requests.length,1);
    const poster=lazy.d.querySelector('#share-poster');poster.dispatchEvent(new lazy.w.Event('error'));
    assert(!lazy.d.querySelector('#retry-poster').hidden);
    lazy.d.querySelector('#retry-poster').click();assert(lazy.d.querySelector('#retry-poster').hidden);
    poster.dispatchEvent(new lazy.w.Event('load'));assert(lazy.d.querySelector('#share-poster-status').hidden);
    lazy.button.click();lazy.save.click();assert.equal(lazy.calls.length,1);lazy.finish();await flush();
  }finally{lazy.close();}
  console.log('PASS 分享完整二维码海报＋公网链接、延迟加载、图片重试、点击激活、重复点击、取消、能力缺失/网络/分享失败回退');
})().catch(error=>{console.error(error);process.exitCode=1;});

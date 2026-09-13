'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),wedding=require('../miniprogram/wedding');
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
function fixture({native=true,files=true,offline=false,pending=false,error=null}={}){
  const dom=new JSDOM(fs.readFileSync(path.join(root,'web/index.html'),'utf8'),{url:'https://local-preview.example/web/index.html?guest=private#album',runScripts:'outside-only'});
  const w=dom.window,d=w.document,calls=[],copies=[];let resolveShare,resolveFetch;
  w.WEDDING=wedding;w.File=File;w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  Object.defineProperty(w,'isSecureContext',{value:true});
  const response={ok:true,blob:async()=>new Blob([fs.readFileSync(path.join(root,'miniprogram/assets/couple-red-natural-v2.jpg'))],{type:'image/jpeg'})};
  w.fetch=()=>offline?Promise.reject(Error('offline')):pending?new Promise(resolve=>{resolveFetch=()=>resolve(response);}):Promise.resolve(response);
  if(native){w.navigator.canShare=data=>data.files?files:true;w.navigator.share=data=>{calls.push(data);return error?Promise.reject(error):new Promise(resolve=>{resolveShare=resolve;});};}
  Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async text=>copies.push(text)}});
  w.eval(fs.readFileSync(path.join(root,'web/share.js'),'utf8'));
  return {w,d,calls,copies,button:d.querySelector('#share-invite'),dialog:d.querySelector('#share-dialog'),ready:()=>resolveFetch(),finish:()=>resolveShare(),close:()=>w.close()};
}
(async()=>{
  const native=fixture();try{
    await flush();native.button.click();
    assert.equal(native.calls.length,1,'Share is called synchronously within the click, not after a fetch');
    native.button.click();assert.equal(native.calls.length,1,'A pending share cannot start twice');
    const payload=native.calls[0];assert.equal(payload.url,wedding.shareUrl);assert(payload.text.includes(wedding.groom));
    assert.equal(payload.files[0].type,'image/jpeg');
    assert.deepEqual(Buffer.from(await payload.files[0].arrayBuffer()),fs.readFileSync(path.join(root,'miniprogram/assets/couple-red-natural-v2.jpg')));
    assert.equal(native.dialog.open,false);native.finish();await flush();assert.equal(native.button.disabled,false);
  }finally{native.close();}
  for(const options of [{native:false},{files:false},{offline:true},{pending:true},{error:Error('Sharing target unavailable')}]){
    const u=fixture(options);try{
      await flush();u.button.click();await flush();assert(u.dialog.open);
      assert.equal(u.d.querySelectorAll('.footer-actions>*').length,1);
      assert.equal(u.d.querySelector('.share-preview img').getAttribute('src'),'../miniprogram/assets/couple-red-natural-v2.jpg');
      u.d.querySelector('#copy-link').click();await flush();assert.equal(u.copies[0],wedding.shareUrl);assert.match(u.d.querySelector('#share-status').textContent,/已复制/);
      if(options.pending){u.ready();await flush();assert.equal(u.calls.length,0,'Finishing a fetch must never open a system share without a new click');}
    }finally{u.close();}
  }
  const cancel=fixture({error:Object.assign(Error('cancelled'),{name:'AbortError'})});try{
    await flush();cancel.button.click();await flush();assert(!cancel.dialog.open);assert(!cancel.button.disabled);
  }finally{cancel.close();}
  console.log('PASS 分享新图原始字节＋公网链接、点击激活、重复点击、取消、能力缺失/网络/分享失败回退');
})().catch(error=>{console.error(error);process.exitCode=1;});

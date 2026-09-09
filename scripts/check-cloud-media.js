'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createService}=require('../cloudfunctions/weddingBlessings/core');
(async()=>{
 const photos=[{file:'example.jpg',fileID:'cloud://test.bucket/wedding-media/a.jpg'}];
 const calls=[];const service=createService({albums:{sample:photos},appid:'app',media:{async urls(ids,ttl){calls.push({ids,ttl});return {[photos[0].fileID]:'https://cdn.example/photo?temporary=1'};}},now:()=>100});
 const res=await service({action:'album',group:'sample',files:['cloud://test.bucket/blessing-photos/private.jpg']},{APPID:'app',OPENID:'guest'});
 assert.equal(res.photos.length,1);assert.equal(res.expiresAt,3500100);assert.equal(calls[0].ttl,3600);assert.deepEqual(calls[0].ids,[photos[0].fileID]);
 for(const group of ['unknown','__proto__','constructor',null])await assert.rejects(service({action:'album',group},{APPID:'app',OPENID:'guest'}),e=>e.code==='INVALID_INPUT');
 await assert.rejects(service({action:'album',group:'sample'},{}),e=>e.code==='LOGIN_REQUIRED');
 await assert.rejects(service({action:'album',group:'sample'},{APPID:'wrong',OPENID:'guest'}),e=>e.code==='APP_MISMATCH');
 const broken=createService({albums:{sample:photos},appid:'app',media:{urls:async()=>({})}});
 await assert.rejects(broken({action:'album',group:'sample'},{APPID:'app',OPENID:'guest'}),e=>e.code==='MEDIA_UNAVAILABLE');
 const catalogue=require('../cloudfunctions/weddingBlessings/albums.json'),wedding=require('../miniprogram/wedding');
 assert.deepEqual(Object.keys(catalogue).sort(),wedding.albums.map(a=>a.id).sort());
 for(const album of wedding.albums){assert.deepEqual(catalogue[album.id].map(p=>p.file),wedding.photos.filter(p=>p.group===album.id).map(p=>p.file));assert(catalogue[album.id].every(p=>/^cloud:\/\/[^/]+\/wedding-media\/photos\/[a-f0-9]{64}\.jpg$/.test(p.fileID)));}
 let requestCount=0,respond,reject,opened=[];
 const fakeWedding={albums:[{id:'sample',package:'album-one',title:'样本'}],photos:[{file:'a.jpg',group:'sample',package:'album-one',cloud:true}]};
 const sandbox={module:{exports:{}},require:id=>id==='../wedding'?fakeWedding:id==='./rose-vines'?{plan:()=>[]}:id==='./blessing-client'?{invoke:()=>{requestCount++;return new Promise((yes,no)=>{respond=yes;reject=no;});}}:((page,current,urls)=>opened.push({current,urls})),wx:{setNavigationBarTitle(){},showShareMenu(){},showToast(){}},Date};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../miniprogram/shared/gallery.js'),'utf8'),sandbox);
 const page=sandbox.module.exports('album-one');page.setData=patch=>Object.assign(page.data,patch);page.onLoad({group:'sample'});page.onShow();assert.equal(requestCount,1);const pending=page.loadAlbumMedia();respond({photos:[{file:'a.jpg',url:'https://media.example/old'}],expiresAt:Date.now()+50000});await pending;assert.equal(page.data.mediaError,false);
 await page.previewPhoto({currentTarget:{dataset:{src:'https://media.example/old'}}});assert.equal(opened[0].current,'https://media.example/old');assert.equal(requestCount,1);
 page._mediaExpires=0;const expired=page.previewPhoto({currentTarget:{dataset:{src:'https://media.example/old'}}});respond({photos:[{file:'a.jpg',url:'https://media.example/fresh'}],expiresAt:Date.now()+50000});await expired;assert.equal(opened[1].current,'https://media.example/fresh');
 const failed=page.retryAlbumMedia();reject(Error('offline'));await failed;assert.equal(page.data.mediaError,true);assert.equal(page.data.mediaLoading,false);
 const retried=page.retryAlbumMedia();respond({photos:[{file:'a.jpg',url:'https://media.example/retry'}],expiresAt:Date.now()+50000});await retried;assert.equal(page.data.mediaError,false);assert.equal(page.data.photos[0].url,'https://media.example/retry');
 const leaving=page.retryAlbumMedia();page._alive=false;respond({photos:[{file:'a.jpg',url:'https://media.example/late'}],expiresAt:Date.now()+50000});await leaving;assert.equal(page.data.photos[0].url,'https://media.example/retry');
 console.log('PASS 相册请求去重、有效链接复用、过期预览刷新、失败重试、页面离开忽略迟到结果');
 console.log('PASS 相册签名仅限部署清单，非管理员宾客可读；注入文件、未知相册、错误身份被拒绝；缺失照片显式失败');
})().catch(e=>{console.error(e);process.exitCode=1;});

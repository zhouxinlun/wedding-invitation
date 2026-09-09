const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..'),editor=require('../miniprogram/shared/blessing-editor'),snow=require('../miniprogram/shared/blessing-snow');
function component(client,wxOverrides={}){
  let def;const timers=new Map();let sequence=0;
  vm.runInNewContext(fs.readFileSync(path.join(root,'miniprogram/components/blessings/index.js'),'utf8'),{require:id=>id.includes('blessing-editor')?editor:id.includes('blessing-snow')?snow:client,Component:d=>def=d,wx:{showToast(){},...wxOverrides},setTimeout:(fn,ms)=>{timers.set(++sequence,{fn,ms});return sequence;},clearTimeout:id=>timers.delete(id)});
  const c={...def.methods,data:structuredClone(def.data),properties:{paused:false},setData(patch){for(const [key,value]of Object.entries(patch)){const keys=key.replace(/\[(\d+)\]/g,'.$1').split('.');let obj=this.data;for(const part of keys.slice(0,-1))obj=obj[part];obj[keys.at(-1)]=value;}},triggerEvent(){}};
  def.lifetimes.attached.call(c);return {c,close:()=>def.lifetimes.detached.call(c)};
}
(async()=>{
  const calls=[],uploads=[];let dimensions={width:4000,height:3000},failure=false;
  const wx={cloud:{init(){},uploadFile:async args=>{uploads.push(args);return {fileID:'cloud://test/photo.jpg'};},callFunction:async()=>({result:{ok:true,status:'approved'}})},
    getImageInfo:args=>failure?args.fail({}):args.success(dimensions),compressImage:args=>{calls.push(args);args.success({tempFilePath:'/tmp/compressed.jpg'});},
    getFileSystemManager:()=>({stat:args=>args.success({stats:{size:1000}})})};
  const box={wx,module:{exports:{}},require:()=>({envId:'test',functionName:'test'})};vm.runInNewContext(fs.readFileSync(path.join(root,'miniprogram/shared/blessing-client.js'),'utf8'),box);
  const send=()=>box.module.exports.uploadDraft({nonce:'test-nonce-00001',name:'来宾',text:'祝福',photos:[{path:'/tmp/original.jpg'}]},'owner',()=>{});
  await send();assert.equal(calls.at(-1).compressedWidth,1280);assert(!('compressedHeight'in calls.at(-1)));
  dimensions={width:2000,height:4000};await send();assert.equal(calls.at(-1).compressedHeight,1280);assert(!('compressedWidth'in calls.at(-1)));
  dimensions={width:64,height:48};await send();assert.equal(calls.at(-1).compressedWidth,64);
  dimensions={width:3000,height:4000,orientation:'right'};await send();assert(Object.keys(calls.at(-1)).filter(k=>k.startsWith('compressed')).length===1);
  failure=true;await assert.rejects(send(),e=>e.code==='PHOTO_ERROR');assert.equal(uploads.length,4);
  console.log('PASS 横竖照片只指定长边、保留比例且不放大小图；读取失败不上传');
  assert.deepEqual(editor.fit(4000,2000,280,280),{width:280,height:140});assert.deepEqual(editor.fit(1000,4000,280,280),{width:70,height:280});assert.equal(editor.append('好呀','🌹'),'好呀🌹');assert.equal(editor.append('字'.repeat(160),'🌹'),null);assert.equal(editor.append('字'.repeat(158),'❤️'),'字'.repeat(158)+'❤️');
  console.log('PASS 小缩略图按比例适配；表情进入正文且不超160字');
  let items=[{id:'post',name:'亲友甲',text:'一级祝福',emoji:'',photos:['https://example.invalid/photo'],createdAt:1,replies:[{id:'child',name:'亲友乙',replyToName:'亲友甲',text:'仅回复，不飘雪',createdAt:2}]}],release,replyRequests=[];
  const client={configured:()=>true,pollMs:20000,nonce:()=> 'stable-nonce-00001',invoke:async(action,data)=>{if(action==='identity')return {ownerKey:'guest'};if(action==='list')return {items};if(action==='reply'){replyRequests.push(structuredClone(data));return new Promise(resolve=>{release=resolve;});}},uploadDraft:async()=>({id:'post',status:'approved'})};
  const h=component(client);await h.c.loadIdentity();await h.c.refresh();h.c.openForm();h.c.inputName({detail:{value:'我'}});h.c.inputText({detail:{value:'正文'}});h.c.chooseEmoji({currentTarget:{dataset:{emoji:'🌹'}}});assert.equal(h.c.data.text,'正文🌹');assert.equal(h.c.data.emoji,'');h.c.closeForm();
  h.c.photoLoaded({currentTarget:{dataset:{id:'post',index:0}},detail:{width:2000,height:1000}});assert.equal(h.c.data.items[0].photoViews[0].width/h.c.data.items[0].photoViews[0].height,2);
  h.c.openReply({currentTarget:{dataset:{id:'post',replyId:'child'}}});assert.equal(h.c.data.replyTarget.name,'亲友乙');assert(h.c.data.motionPaused);h.c.inputReply({detail:{value:'接住啦'}});h.c.replyEmoji({currentTarget:{dataset:{emoji:'❤️'}}});assert.equal(h.c.data.replyText,'接住啦❤️');
  h.c.setData({name:'',replyText:''});const sending=h.c.submitReply({detail:{value:{name:'表单当前称呼',text:'接住啦❤️'}}});assert.equal(h.c.data.name,'表单当前称呼');assert.equal(replyRequests[0].text,'接住啦❤️');assert(h.c.data.replyBusy);assert(h.c.data.replyProgress);h.c.closeReply();assert(h.c.data.replyOpen);await h.c.submitReply();assert.equal(replyRequests.length,1);assert.equal(replyRequests[0].replyToId,'child');release({id:'new-reply',status:'approved'});await sending;assert(!h.c.data.replyBusy&&!h.c.data.replyOpen);assert.equal(h.c.data.text,'正文🌹');
  for(let i=0;i<6;i++)h.c.spawnSnow(i);assert(h.c.data.flakes.every(f=>f.postId==='post'));assert(h.c.data.flakes.every(f=>!f.chars.map(x=>x.glyph).join('').includes('回复')));h.close();
  console.log('PASS 点按指定回复对象、加载期间锁定、防双击、主稿保留；仅一级祝福进入飘雪');
  let fail=true;const retryClient={...client,invoke:async(action,data)=>action==='reply'?(replyRequests.push(data),fail?Promise.reject(Error('network')):{id:'recovered',status:'approved'}):client.invoke(action,data)};
  const retry=component(retryClient);await retry.c.loadIdentity();retry.c.inputName({detail:{value:'我'}});retry.c.openReply({currentTarget:{dataset:{id:'post'}}});retry.c.inputReply({detail:{value:'保留原回复'}});await retry.c.submitReply();assert(retry.c.data.replyUncertain);const draft=retry.c._replyDraft;retry.c.closeReply();retry.c.openReply({currentTarget:{dataset:{id:'post',replyId:'child'}}});assert.equal(retry.c.data.replyTarget.replyToId,'');retry.c.inputReply({detail:{value:'不能改目标'}});assert.equal(retry.c.data.replyText,'保留原回复');fail=false;await retry.c.submitReply();assert.equal(replyRequests.at(-1),draft);assert(!retry.c.data.replyUncertain);retry.close();
  console.log('PASS 回复结果不明保留原稿和原目标，同一nonce核对恢复');
  let requests=[],modal,confirmed=false,deletedItems=[{id:'own-post',own:true,name:'本人',text:'我的祝福',emoji:'',photos:[],photoKeys:[],replies:[],createdAt:1}];
  const deletionClient={configured:()=>true,pollMs:20000,invoke:async(action,data)=>{requests.push({action,data});if(action==='identity')return {ownerKey:'me'};if(action==='list')return {items:deletedItems};if(action==='remove'){deletedItems=[];return {status:'deleted'};}}};
  const deletion=component(deletionClient,{showModal:options=>{modal=options;},showLoading(){},hideLoading(){}});await deletion.c.loadIdentity();await deletion.c.refresh();
  const event={currentTarget:{dataset:{kind:'post',id:'own-post'}}};const cancel=deletion.c.deleteContent(event);assert(deletion.c.data.deleting);await deletion.c.deleteContent(event);assert(!requests.some(r=>r.action==='remove'));modal.success({confirm:false});await cancel;assert(!deletion.c.data.deleting);assert.equal(deletion.c.data.items.length,1);
  deletion.c.spawnSnow(0);const pendingDelete=deletion.c.deleteContent(event);modal.success({confirm:true});await pendingDelete;assert.equal(requests.filter(r=>r.action==='remove').length,1);assert.equal(deletion.c.data.items.length,0);assert.equal(deletion.c.data.flakes.length,0);assert(!deletion.c.data.deleting);deletion.close();
  console.log('PASS 本人删除前确认、取消不请求、重复点击锁定，完成后同步列表并停止已删祝福飘雪');

  let holdPoll=false,resolvePoll,latestReads=0;
  const raceClient={...client,invoke:async(action,data)=>{if(action==='list'){latestReads++;if(holdPoll)return new Promise(resolve=>{resolvePoll=resolve;});return {items};}return client.invoke(action,data);}};
  const race=component(raceClient);await race.c.loadIdentity();await race.c.refresh();holdPoll=true;const oldRead=race.c.refresh();const readsBefore=latestReads;const afterMutation=race.c.refresh(true);assert.equal(latestReads,readsBefore);holdPoll=false;resolvePoll({items:[]});await afterMutation;assert.equal(latestReads,readsBefore+1);assert.equal(race.c.data.items.length,items.length);race.close();
  console.log('PASS 变更后刷新等待旧轮询完成再读取，避免成功回复被旧列表覆盖');
  for(const page of ['web/index.html','web/blessings-preview.html']){const html=fs.readFileSync(path.join(root,page),'utf8');assert(html.includes('blessing-editor.js'));assert(html.indexOf('blessing-editor.js')<html.indexOf('src="blessings.js"'));}
})().catch(error=>{console.error(error);process.exitCode=1;});

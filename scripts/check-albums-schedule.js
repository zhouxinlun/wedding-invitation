const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const crypto=require('node:crypto');
const root=path.join(__dirname,'../miniprogram');const wedding=require('../miniprogram/wedding');const journey=require('../miniprogram/journey');const gallery=require('../miniprogram/shared/gallery');const app=require('../miniprogram/app.json');const checks=[];
function check(name,fn){checks.push({name,fn});}
check('已完成的60张精修照片全部导入，四张指定照片有真实可追溯副本',()=>{
 const records=JSON.parse(fs.readFileSync(path.join(root,'../exports/相册原片清单.json'),'utf8'));
 assert.equal(records.length,60);assert.equal(new Set(records.map(r=>r.source)).size,60);
 for(const name of ['L_K_8863.JPG','L_K_8858.JPG','L_K_8905.JPG','L_K_8902.JPG'])assert(records.some(r=>path.basename(r.source)===name));
 for(const record of records){const relative=record.destination.split('miniprogram/').at(-1);const file=path.join(root,relative);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),record.sha256);assert(wedding.photos.some(p=>(p.package+'/images/'+p.file)===relative));}
});
check('相册分组完整且资源仅依赖主包或自身分包',()=>{
 assert.equal(wedding.photos.length,64);assert.equal(wedding.albums.length,7);assert.equal(wedding.albums[0].id,'vows');
 const files=new Set();for(const album of wedding.albums){assert(fs.existsSync(path.join(root,'assets',album.cover)));const p=app.subPackages.find(p=>p.root===album.package);assert(p);for(const ext of ['js','json','wxml','wxss'])assert(fs.existsSync(path.join(root,p.root,p.pages[0]+'.'+ext)));const photos=wedding.photos.filter(p=>p.group===album.id);assert(photos.length>=5);for(const photo of photos){assert(!photo.package||photo.package===album.package);const f=photo.package?photo.package+'/images/'+photo.file:'assets/'+photo.file;assert(!files.has(f));files.add(f);assert(fs.existsSync(path.join(root,f)));}}
 assert.equal(files.size,wedding.photos.length);
});
check('新封面随主包展示，旧封面退役，照片不会在主页面引用分包资源',()=>{
 assert.equal(wedding.photos[0].file,'couple-red-natural-v2.jpg');assert.equal(wedding.photos[0].cloud,false);assert(!fs.existsSync(path.join(root,'assets/couple-red.jpg')));
 assert.equal(wedding.albums[1].id,'heart');assert.equal(wedding.albums[5].id,'red');
 const source=fs.readFileSync(path.join(root,'pages/invitation/index.wxml'),'utf8');assert(app.subPackages.every(p=>!source.includes('/'+p.root+'/')));
});
check('每个相册分包及主包均低于2MB并保留启动余量',()=>{
 const sizes=Object.fromEntries(['main',...app.subPackages.map(p=>p.root)].map(k=>[k,0]));
 function walk(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,ent.name);if(ent.isDirectory())walk(f);else if(ent.name!=='.DS_Store'){const rel=path.relative(root,f);if(require('../project.config.json').packOptions.ignore.some(rule=>rule.type==='folder'&&rel.startsWith(rule.value+'/')))continue;const pkg=app.subPackages.find(p=>rel.startsWith(p.root+'/'));sizes[pkg?pkg.root:'main']+=fs.statSync(f).size;}}}walk(root);
 for(const size of Object.values(sizes))assert(size<2000000);assert(sizes.main<1700000);console.log('Package bytes:',sizes);
});
check('两家小区有效定位、流程地点引用及时间顺序正确',()=>{
 assert.equal(wedding.homes.length,2);wedding.homes.forEach(p=>{assert(journey.hasCoordinates(p));assert(p.note.includes('集合入口'));});
 const ids=journey.destinations(wedding).map(p=>p.id);let previous=0;
 for(const phase of wedding.schedule){assert(ids.includes(phase.destination));for(const event of phase.events){const minute=t=>t.split(':').map(Number).reduce((h,m)=>h*60+m);assert(minute(event.time)>=previous);previous=minute(event.time);if(event.end)assert(minute(event.end)>minute(event.time));}}
 assert.equal(wedding.guestArrivalTime,'10:40');assert.equal(wedding.ceremonyTime,'11:08');assert(wedding.preparationNotes.some(n=>n.includes('包间')&&n.includes('确认')));
 const events=wedding.schedule.flatMap(phase=>phase.events);
 assert.deepEqual(events.map(event=>event.time),['05:30','06:00','06:20','06:30','06:40','07:20','07:50','08:40','09:10','09:30','09:30','10:00','10:40','11:08','11:38','11:40','12:00']);
 assert.equal(events.find(event=>event.time===wedding.ceremonyTime).end,'11:38');
 assert.equal(events.at(-1).timeNote,'之前');assert.equal(events.find(event=>event.time==='08:40').timeNote,'之前');
 const calendar=fs.readFileSync(path.join(root,'../exports/婚礼日程.ics'),'utf8').replace(/\r\n /g,'');assert(calendar.includes(wedding.guestArrivalTime));assert(calendar.includes(wedding.venue.room));
 const exported=fs.readFileSync(path.join(root,'../exports/婚礼流程与筹备提醒.txt'),'utf8');
 for(const event of events)assert(exported.includes(event.time+(event.end?'—'+event.end:'')+(event.timeNote||'')+' '+event.title));
});
check('分包实际页面逻辑：分组、放大与分享路径，拒绝跨分包相册',async()=>{
 const source=fs.readFileSync(path.join(root,'shared/gallery.js'),'utf8');const calls=[];const sandbox={require:p=>p==='../wedding'?wedding:p==='./rose-vines'?require('../miniprogram/shared/rose-vines'):p==='./blessing-client'?{invoke:async(action,{group})=>({photos:wedding.photos.filter(p=>p.group===group).map(p=>({file:p.file,url:'https://media.example/'+p.file})),expiresAt:Date.now()+100000})}:((page,current,urls)=>sandbox.wx.previewImage({current,urls})),module:{exports:{}},wx:new Proxy({}, {get:(_,name)=>options=>calls.push({name,options})})};vm.runInNewContext(source,sandbox);
 for(const album of wedding.albums){const page=sandbox.module.exports(album.package);page.setData=p=>Object.assign(page.data,p);page.onLoad({group:album.id});await page.loadAlbumMedia();assert.equal(page.data.photos.length,wedding.photos.filter(p=>p.group===album.id).length);const current=page.data.photos.at(-1).url;await page.previewPhoto({currentTarget:{dataset:{src:current}}});assert.equal(calls.at(-1).options.current,current);assert(calls.at(-1).options.urls.every(u=>u.startsWith('https://media.example/')||u==='/assets/couple-red-natural-v2.jpg'));assert(page.onShareAppMessage().path.endsWith('?group='+album.id));}
 const bad=sandbox.module.exports('album-one');bad.setData=p=>Object.assign(bad.data,p);bad.onLoad({group:wedding.albums.find(a=>a.package==='album-two').id});assert.equal(bad.data.missing,true);assert.equal(bad.data.photos.length,0);
});
check('主页面相册点击路由失败可重试，流程跳转同步选中正确地点',()=>{
 let page;const calls=[];vm.runInNewContext(fs.readFileSync(path.join(root,'pages/invitation/index.js'),'utf8'),{require:p=>p==='../../journey'?journey:p==='../../shared/rose-vines'?require('../miniprogram/shared/rose-vines'):p==='../../shared/preview-images'?(()=>{}):wedding,Page:p=>page=p,wx:new Proxy({}, {get:(_,name)=>options=>calls.push({name,options})}),setTimeout:()=>1,clearTimeout:()=>{}});page.setData=(patch,callback)=>{Object.assign(page.data,patch);if(callback)callback();};
 const album=wedding.albums[4];const click={currentTarget:{dataset:{id:album.id}}};page.openAlbum(click);page.openAlbum(click);assert.equal(calls.filter(c=>c.name==='navigateTo').length,1);const call=calls.find(c=>c.name==='navigateTo');assert.equal(call.options.url,'/'+album.package+'/pages/gallery/index?group='+album.id);call.options.fail();call.options.complete();page.openAlbum(click);assert.equal(calls.filter(c=>c.name==='navigateTo').length,2);
 page.scheduleDestination({currentTarget:{dataset:{place:'home-1'}}});assert.equal(page.data.active,'journey');assert.equal(page.data.selectedPlace.fullName,wedding.homes[1].fullName);assert(!calls.some(c=>c.name==='getLocation'));assert.equal(calls.at(-1).options.selector,'#journey');
});
(async()=>{for(const {name,fn} of checks){await fn();console.log('PASS '+name);}})().catch(error=>{console.error(error);process.exitCode=1;});

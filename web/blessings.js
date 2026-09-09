(function(){
'use strict';
const EMOJIS=['❤️','🌹','🎉','🥂','💐','囍'],snow=window.WeddingBlessingSnow,editor=window.WeddingBlessingEditor;
const el=(tag,cls,text)=>{const node=document.createElement(tag);node.className=cls||'';if(text)node.textContent=text;return node;};
function mount(root,options){
  const demo=options&&options.demo===true;
  const client=options&&options.client||window.WeddingCloud;
  let items=demo?(options.items||[]).map(item=>({...item,photos:[...item.photos]})):[],photos=[],busy=false,cursor=0,serial=0;
  let draft=null,replyDraft=null,mutating=false,revision=0,reading=null,disposed=false,pollTimer;
  const photoFiles=new Map();
  const urls=[],timers=new Set(),scheduled=new Map(),flakes=new Map(),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  root.classList.add('blessings');
  root.innerHTML=`<div class="b-heading"><h2 class="b-title">有你们，欢喜成双。</h2><p class="b-intro">见字如面，见你欢喜。</p></div>
  <button class="b-letter-card" aria-label="写一份祝福"><img class="b-letter-vine" src="../miniprogram/assets/rose-vines/vine-07.png" alt=""><div class="b-letter-to">致 小妮与新沦</div><div class="b-letter-title">这份欢喜，<span>就差你的一笔。</span></div><div class="b-letter-footer"><span>写祝福，也分享照片</span><span class="b-seal">寄 ♡</span></div></button>
  <div class="b-feed-heading"><span>亲友祝福</span><span class="b-feed-order">最新心意在前</span></div><div class="b-feed-frame"><div class="b-feed-scroll" role="region" aria-label="亲友祝福列表" tabindex="0"><div class="b-posts"></div><p class="b-list-end">每一句，都被好好珍藏 ♡</p></div></div><p class="b-footnote">祝福在这里相聚，良辰还在下方继续。</p>
  <div class="b-snow" aria-hidden="true"></div><button class="b-fab" aria-label="写祝福或分享照片"><span>♡</span>送祝福</button>
  <dialog class="b-web-dialog" aria-labelledby="blessing-form-title"><div class="b-sheet"><div class="b-sheet-head"><div><span class="b-sheet-to">TO 小妮 & 新沦</span><h2 class="b-sheet-title" id="blessing-form-title">把欢喜，写给你们。</h2></div><button class="b-close" aria-label="关闭祝福窗口">×</button></div><form><div class="b-form-scroll"><div class="b-form-body"><label class="b-label b-name-label"><span>落款</span><input name="name" class="b-input" maxlength="20" placeholder="亲友熟悉的称呼" required autocomplete="nickname"></label><label class="b-label b-message-label"><span>想对你们说</span><textarea name="text" class="b-textarea" maxlength="160" placeholder="愿你们有说不完的话，也有看不完的风景。"></textarea><span class="b-counter">0 / 160</span></label><div class="b-emoji-row"></div><div class="b-photo-label"><span>附上你的独家收藏</span><span class="b-optional">0 / 3 张</span></div><p class="b-photo-note">新郎手机相册穷尽，请尽情上传新娘的丑照</p><div class="b-photo-picker"></div><input type="file" name="photos" accept="image/jpeg,image/png" multiple hidden><p class="b-error" role="status" aria-live="polite"></p><p class="b-identity-note">称呼、祝福和照片会展示给打开请柬的亲友。请在当前浏览器删除自己的内容；更换设备或清除浏览器数据后，原身份可能无法找回。</p></div></div><div class="b-send-footer"><div class="b-loading" role="status" aria-live="polite" hidden><div class="b-loading-spinner"></div><div><span class="b-progress"></span><span class="b-loading-hint">请稍候，完成后会自动显示</span></div></div><span class="b-send-note">${demo?'仅预览效果，本页操作不会发送给亲友':'写下称呼，把这份心意留给我们'}</span><button type="submit" class="b-send">寄出这份欢喜 ↗</button></div></form></div></dialog>`;
  const q=s=>root.querySelector(s),dialog=q('dialog'),form=q('form'),feed=q('.b-posts'),layer=q('.b-snow');
  q('.b-send').disabled=false;
  const status=el('div','b-feed-status'),statusText=el('span',''),retry=el('button','b-feed-retry','重新连接');
  status.setAttribute('role','status');status.setAttribute('aria-live','polite');retry.type='button';retry.hidden=true;status.append(statusText,retry);q('.b-feed-heading').after(status);
  function message(text,failed=false){statusText.textContent=text;retry.hidden=!failed;status.hidden=!text;status.classList.toggle('has-error',failed);}
  function errorText(error){return error&&error.guestMessage||(['PHOTO_ERROR','NOT_CONFIGURED'].includes(error&&error.code)?error.message:'暂时未能连接，请检查网络后重试；你的输入还在');}
  async function refresh(){
    if(demo||disposed)return true;
    if(reading)return reading;
    const stamp=revision;
    const request=(async()=>{
      try{
        if(!client)throw Error('CLOUD_CLIENT_UNAVAILABLE');
        const result=await client.invoke('list',{mode:'public'});
        if(disposed||stamp!==revision||mutating)return false;
        items=result.items;render();message('');sync();return true;
      }catch(error){if(!disposed&&stamp===revision)message(errorText(error),true);return false;}
    })();
    reading=request;
    try{return await request;}finally{if(reading===request)reading=null;}
  }
  async function afterMutation(successText){
    if(reading)await reading;
    mutating=false;
    const loaded=await refresh();
    if(!loaded&&!disposed)message(successText+'，列表暂未更新，请点这里重试',true);
    return loaded;
  }
  function poll(){clearTimeout(pollTimer);if(demo||disposed)return;pollTimer=setTimeout(async()=>{if(!document.hidden&&!busy&&!replyBusy&&!mutating)await refresh();poll();},client&&client.pollMs||20000);}
  function visibility(){sync();if(!document.hidden&&!mutating)refresh();poll();}
  retry.onclick=()=>{message('正在连接亲友来信…');refresh();};
  try{if(!demo)q('[name=name]').value=localStorage.getItem('wedding-guest-name')||'';}catch(_){}
  function remember(name){q('[name=name]').value=name;try{if(!demo)localStorage.setItem('wedding-guest-name',name);}catch(_){}}
  form.querySelectorAll('button:not([type])').forEach(button=>button.type='button');
  function wait(fn,ms){const id=setTimeout(()=>{timers.delete(id);fn();},ms);timers.add(id);return id;}
  function blocked(){return document.hidden||!!document.querySelector('dialog[open]')||reduced.matches;}
  function stopSnow(){scheduled.forEach(clearTimeout);scheduled.clear();flakes.forEach(node=>node.remove());flakes.clear();}
  function spawn(slot,preferred){
    if(blocked()||flakes.has(slot))return;
    const published=items.filter(item=>item.status==='approved');if(!published.length)return;
    const item=preferred||published[cursor++%published.length],f=snow.create(item,slot,++serial),node=el('div','b-flake b-flake-'+f.variant);node.dataset.postId=item.id;
    Object.assign(node.style,{left:f.left+'%',width:f.width/2+'px',height:f.height/2+'px',animationDuration:f.duration+'s'});node.style.setProperty('--drift',f.drift/2+'px');node.style.setProperty('--tilt',f.rotation+'deg');node.style.setProperty('--alpha',f.opacity);
    const thread=el('div','b-thread');thread.style.width=f.width/2+'px';thread.style.height=f.height/2+'px';
    f.chars.forEach(c=>{if(c.link){const link=el('div','b-link');Object.assign(link.style,{left:c.linkX/2+'px',top:c.linkY/2+'px',width:c.linkLength/2+'px',transform:'rotate('+c.linkTurn+'deg)'});thread.append(link);}const letter=el('span','b-letter',c.glyph);Object.assign(letter.style,{left:c.x/2+'px',top:c.y/2+'px',transform:'rotate('+c.turn+'deg)'});thread.append(letter);});
    const end=el('span','b-thread-end',f.emoji);Object.assign(end.style,{left:(f.width-25)/2+'px',top:(f.height-24)/2+'px'});thread.append(end);node.append(thread);layer.append(node);flakes.set(slot,node);
    node.addEventListener('animationend',event=>{if(event.target!==node)return;node.remove();flakes.delete(slot);if(!blocked())scheduled.set(slot,wait(()=>{scheduled.delete(slot);spawn(slot);},1800));},{once:true});
  }
  function sync(){root.classList.toggle('b-paused',blocked());if(blocked()){stopSnow();return;}for(let i=0;i<snow.slots;i++)if(!flakes.has(i)&&!scheduled.has(i))scheduled.set(i,wait(()=>{scheduled.delete(i);spawn(i);},120+i*1250));}
  const modalObserver=new MutationObserver(sync);modalObserver.observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
  document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',sync);
  let previousOverflow='';
  function open(){previousOverflow=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';dialog.showModal();sync();}
  q('.b-letter-card').onclick=open;q('.b-fab').onclick=open;q('.b-close').onclick=()=>{if(!busy)dialog.close();};dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});dialog.addEventListener('close',()=>{document.documentElement.style.overflow=previousOverflow;sync();});
  function drawEmoji(){const row=q('.b-emoji-row');row.replaceChildren();EMOJIS.forEach(emoji=>{const b=el('button','',emoji);b.type='button';b.ariaLabel='加入正文 '+emoji;b.onclick=()=>{if(busy)return;const value=editor.append(q('[name=text]').value,emoji);if(value===null){q('.b-error').textContent='正文最多160字，删减几个字再加入表情吧';return;}q('[name=text]').value=value;q('.b-counter').textContent=Array.from(value).length+' / 160';};row.append(b);});}
  function drawPhotos(){const row=q('.b-photo-picker');row.replaceChildren();q('.b-optional').textContent=photos.length+' / 3 张';photos.forEach((src,i)=>{const wrap=el('div','b-picked'),img=el('img');img.src=src;img.alt='本次选择的照片';const b=el('button','','×');b.type='button';b.ariaLabel='移除第'+(i+1)+'张照片';b.onclick=()=>{if(busy)return;photos.splice(i,1);drawPhotos();};wrap.append(img,b);row.append(wrap);});if(photos.length<3){const b=el('button','b-add-photo');b.type='button';b.append(el('span','','＋'),el('span','','添张照片'));b.onclick=()=>{if(!busy)q('[name=photos]').click();};row.append(b);}}
  q('[name=photos]').onchange=event=>{if(busy)return;q('.b-error').textContent='';for(const file of [...event.target.files].slice(0,3-photos.length)){if(!['image/jpeg','image/png'].includes(file.type)||file.size>10*1024*1024){q('.b-error').textContent='请选择10MB以内的JPG或PNG照片';continue;}const url=URL.createObjectURL(file);urls.push(url);photos.push(url);photoFiles.set(url,file);}event.target.value='';drawPhotos();};
  q('[name=text]').oninput=event=>q('.b-counter').textContent=Array.from(event.target.value).length+' / 160';
  function burst(){const burstLayer=el('div','b-burst');burstLayer.ariaHidden='true';for(let i=0;i<12;i++){const piece=el('span','',['✿','♡','✧'][i%3]);piece.style.setProperty('--x',((i%2?-1:1)*(15+i*4))+'px');piece.style.setProperty('--y',-(40+i%5*18)+'px');piece.style.animationDelay=i*.025+'s';burstLayer.append(piece);}root.append(burstLayer);wait(()=>burstLayer.remove(),1800);}
  function dateLabel(time){const d=new Date(time),pad=n=>String(n).padStart(2,'0');return (d.getMonth()+1)+'月'+d.getDate()+'日 '+pad(d.getHours())+':'+pad(d.getMinutes());}
  function removeDemo(post,kind,target){
    if(!demo||busy||replyBusy||!(kind==='reply'?target.own:post.own))return;
    const emptyPhoto=kind==='photo'&&post.photos.length===1&&!post.text&&!post.emoji;
    const message=kind==='post'||emptyPhoto?'删除这条祝福、附带照片和下面的回复？':kind==='reply'?'删除自己的这条回复？其他留言会保留。':'删除这张照片？文字和其他照片会保留。';
    if(!window.confirm(message))return;
    if(kind==='post'||emptyPhoto)items=items.filter(item=>item.id!==post.id);
    else if(kind==='reply')post.replies=post.replies.filter(reply=>reply.id!==target.id);
    else post.photos=post.photos.filter(src=>src!==target);
    stopSnow();render();sync();
  }
  async function remove(post,kind,target,button){
    if(demo){removeDemo(post,kind,target);return;}
    if(busy||replyBusy||mutating||!(kind==='reply'?target.own:post.own))return;
    const emptyPhoto=kind==='photo'&&post.photos.length===1&&!post.text&&!post.emoji;
    if(!window.confirm(kind==='post'||emptyPhoto?'删除这条祝福、附带照片和下面的回复？':kind==='reply'?'删除自己的这条回复？其他留言会保留。':'删除这张照片？文字和其他照片会保留。'))return;
    const label=button.textContent;button.disabled=true;button.textContent='正在删除…';mutating=true;revision++;
    try{
      const action=kind==='post'?'remove':kind==='reply'?'removeReply':'removePhoto';
      const data=kind==='post'?{id:post.id}:kind==='reply'?{postId:post.id,replyId:target.id}:{postId:post.id,photoKey:post.photoKeys&&post.photoKeys[post.photos.indexOf(target)]};
      await client.invoke(action,data);
      if(kind==='post'||emptyPhoto)items=items.filter(item=>item.id!==post.id);
      else if(kind==='reply')post.replies=post.replies.filter(reply=>reply.id!==target.id);
      else {const index=post.photos.indexOf(target);post.photos.splice(index,1);post.photoKeys.splice(index,1);}
      stopSnow();render();await afterMutation('已删除');sync();
    }catch(error){message(errorText(error),true);}finally{mutating=false;button.disabled=false;button.textContent=label;}
  }
  function deleteButton(label,cls,post,kind,target){const button=el('button',cls,label);button.type='button';button.onclick=event=>{event.stopPropagation();remove(post,kind,target,button);};return button;}
  function render(){
    feed.replaceChildren();const shown=items.filter(item=>item.status==='approved').sort((a,b)=>b.createdAt-a.createdAt);
    q('.b-list-end').hidden=!shown.length;
    if(!shown.length){const empty=el('div','b-empty');empty.append(el('span','b-empty-heart','♡'),el('span','','第一份祝福，留给你。'));feed.append(empty);}
    shown.forEach(item=>{
      const card=el('article','b-post'),head=el('div','b-post-head'),author=el('div','b-author');author.append(el('span','',item.name),el('span','b-time',dateLabel(item.createdAt)));head.append(el('span','b-avatar',item.emoji||'♡'),author,el('span','b-post-flower','✧'));card.append(head);
      if(item.text){const body=el('p','b-post-text',item.text);body.tabIndex=0;body.setAttribute('role','button');body.ariaLabel='回复'+item.name;body.onclick=()=>openReply(item);body.onkeydown=event=>{if(event.key==='Enter')openReply(item);};card.append(body);}
      if(item.photos.length){const grid=el('div','b-photo-grid b-photos-'+item.photos.length);item.photos.forEach(src=>{const b=el('button','b-web-photo');b.ariaLabel='放大查看祝福照片';const img=el('img');img.src=src;img.alt='亲友分享的照片';img.loading='lazy';b.append(img);b.onclick=()=>{const d=el('dialog','b-image-dialog'),close=el('button','b-close','×'),large=el('img');close.ariaLabel='关闭祝福照片';large.src=src;large.alt='祝福照片预览';close.onclick=()=>d.close();d.append(close,large);document.body.append(d);d.addEventListener('close',()=>d.remove(),{once:true});d.showModal();};const wrap=el('div','b-published-photo');wrap.append(b);if(item.own)wrap.append(deleteButton('删除照片','b-delete-photo',item,'photo',src));grid.append(wrap);});card.append(grid);}
      const actions=el('div','b-post-actions'),replyAction=el('button','b-reply-action','♡ 回复');replyAction.type='button';replyAction.onclick=()=>openReply(item);if(item.own)actions.append(deleteButton('删除祝福','b-delete-action',item,'post'));actions.append(replyAction);card.append(actions);
      if(item.replies&&item.replies.length){const conversation=el('div','b-replies');item.replies.slice().sort((a,b)=>a.createdAt-b.createdAt).forEach(reply=>{const line=el('div','b-reply-line');line.tabIndex=0;line.setAttribute('role','button');line.ariaLabel='回复'+reply.name;line.append(el('span','b-reply-name',reply.name),el('span','b-reply-word',' 回复 '),el('span','b-reply-name',reply.replyToName),el('span','', '：'+reply.text));line.onclick=()=>openReply(item,reply);line.onkeydown=event=>{if(event.target===line&&event.key==='Enter')openReply(item,reply);};if(reply.own)line.append(deleteButton('删除','b-delete-reply',item,'reply',reply));conversation.append(line);});card.append(conversation);}
      feed.append(card);
    });
  }
  function setBusy(active,message){busy=active;q('.b-loading').hidden=!active;q('.b-send-note').hidden=active;q('.b-progress').textContent=message||'';form.querySelectorAll('input,textarea,button').forEach(node=>node.disabled=active);q('.b-close').disabled=active;}
  const delay=ms=>new Promise(resolve=>wait(resolve,ms));
  form.onsubmit=async event=>{
    event.preventDefault();if(busy||mutating)return;
    const data=new FormData(form),name=String(data.get('name')).trim(),text=String(data.get('text')).trim();
    if(!name||(!text&&!photos.length)){q('.b-error').textContent='请写下称呼，再添一句祝福、一个表情或一张照片';return;}
    if(Array.from(name).length>20||Array.from(text).length>160){q('.b-error').textContent='称呼最多20字，祝福最多160字';return;}
    q('.b-error').textContent='';setBusy(true,'正在送出这份心意');let sentId;
    try{
      if(demo){await delay(450);sentId='local-demo-'+(++serial);items.unshift({id:sentId,own:true,name:name+' · 示例',text,emoji:'',photos:[...photos],replies:[],status:'approved',createdAt:Date.now()});}
      else {
        const signature=JSON.stringify([name,text,photos]);
        if(!draft||draft.signature!==signature)draft={signature,nonce:client.nonce(),name,text,photos:photos.map(url=>({file:photoFiles.get(url)}))};
        mutating=true;revision++;
        const result=await client.uploadDraft(draft,note=>setBusy(true,note));sentId=result.id;
        setBusy(true,'心意已送达，正在更新来信');await afterMutation('心意已送达');
        photos.forEach(url=>{URL.revokeObjectURL(url);photoFiles.delete(url);});draft=null;
      }
      photos=[];form.reset();remember(name);drawPhotos();q('.b-counter').textContent='0 / 160';
      dialog.close();render();q('.b-feed-scroll').scrollTop=0;stopSnow();const item=items.find(item=>item.id===sentId);if(item)spawn(0,item);sync();burst();
    }catch(error){q('.b-error').textContent=errorText(error);}finally{mutating=false;setBusy(false);}
  };
  const replyDialog=el('dialog','b-web-dialog b-web-reply-dialog');replyDialog.innerHTML=`<div class="b-sheet b-reply-sheet"><div class="b-sheet-head"><div><span class="b-sheet-to">一来一往，都是欢喜</span><h2 class="b-sheet-title">回复</h2></div><button type="button" class="b-close" aria-label="关闭回复窗口">×</button></div><form><div class="b-form-scroll b-reply-form-scroll"><div class="b-form-body"><label class="b-label b-name-label"><span>落款</span><input class="b-input" name="name" autocomplete="nickname" maxlength="20" placeholder="亲友熟悉的称呼" required></label><label class="b-label b-message-label"><span>回复内容</span><textarea class="b-textarea" name="text" maxlength="160" placeholder="接住这份心意，也说说你的欢喜…" required></textarea><span class="b-counter">0 / 160</span></label><div class="b-emoji-row"></div></div></div><div class="b-send-footer"><p class="b-error" role="alert"></p><div class="b-loading" role="status" hidden><div class="b-loading-spinner"></div><span>正在送出回复</span></div><span class="b-send-note">${demo?'示例回复只保留在本页':'一来一往，把欢喜接下去'}</span><button class="b-send" type="submit">送出回复 ↗</button></div></form></div>`;root.append(replyDialog);
  const rq=selector=>replyDialog.querySelector(selector);let replyTarget=null,replyBusy=false,replyOverflow='';
  function openReply(post,reply){if(mutating||busy)return;replyTarget={post,reply};rq('.b-sheet-title').textContent='回复 '+(reply||post).name;rq('[name=name]').value=q('[name=name]').value;rq('[name=text]').value='';rq('.b-counter').textContent='0 / 160';rq('.b-error').textContent='';rq('.b-send').disabled=false;replyOverflow=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';replyDialog.showModal();sync();}
  rq('.b-close').onclick=()=>{if(!replyBusy)replyDialog.close();};replyDialog.addEventListener('cancel',event=>{if(replyBusy)event.preventDefault();});replyDialog.addEventListener('close',()=>{document.documentElement.style.overflow=replyOverflow;sync();});
  EMOJIS.forEach(emoji=>{const button=el('button','',emoji);button.type='button';button.ariaLabel='加入回复 '+emoji;button.onclick=()=>{if(replyBusy)return;const value=editor.append(rq('[name=text]').value,emoji);if(value===null){rq('.b-error').textContent='回复最多160字';return;}rq('[name=text]').value=value;rq('.b-counter').textContent=Array.from(value).length+' / 160';};rq('.b-emoji-row').append(button);});
  rq('[name=text]').oninput=event=>rq('.b-counter').textContent=Array.from(event.target.value).length+' / 160';
  rq('form').onsubmit=async event=>{
    event.preventDefault();if(replyBusy||mutating||!replyTarget)return;
    const name=rq('[name=name]').value.trim(),text=rq('[name=text]').value.trim();
    if(!name||!text){rq('.b-error').textContent='请写下称呼和回复';return;}
    if(Array.from(name).length>20||Array.from(text).length>160){rq('.b-error').textContent='称呼最多20字，回复最多160字';return;}
    replyBusy=true;rq('.b-error').textContent='';rq('.b-loading').hidden=false;replyDialog.querySelectorAll('button,input,textarea').forEach(node=>node.disabled=true);
    try{
      const {post,reply}=replyTarget;
      if(demo){await delay(450);post.replies=post.replies||[];post.replies.push({id:'demo-reply-'+(++serial),own:true,name:name+' · 示例',text,replyToId:reply?reply.id:'',replyToName:(reply||post).name,createdAt:Date.now()});}
      else {
        const data={postId:post.id,replyToId:reply?reply.id:'',name,text},signature=JSON.stringify(data);
        if(!replyDraft||replyDraft.signature!==signature)replyDraft={signature,data:{...data,nonce:client.nonce()}};
        mutating=true;revision++;await client.invoke('reply',replyDraft.data);replyDraft=null;remember(name);await afterMutation('回复已送出');
      }
      replyDialog.close();render();
    }catch(error){rq('.b-error').textContent=errorText(error);}finally{mutating=false;replyBusy=false;rq('.b-loading').hidden=true;replyDialog.querySelectorAll('button,input,textarea').forEach(node=>node.disabled=false);}
  };
  drawEmoji();drawPhotos();render();sync();
  if(!demo){message('正在打开亲友来信…');refresh();poll();}else message('');
  return ()=>{disposed=true;revision++;clearTimeout(pollTimer);stopSnow();timers.forEach(clearTimeout);modalObserver.disconnect();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',sync);urls.forEach(url=>URL.revokeObjectURL(url));if(dialog.open)dialog.close();if(replyDialog.open)replyDialog.close();};
}
window.WeddingBlessings={mount};
const root=document.querySelector('#guest-wall');if(root)mount(root,{demo:false});
})();

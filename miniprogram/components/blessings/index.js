const client=require('../../shared/blessing-client');
const snow=require('../../shared/blessing-snow');
const editor=require('../../shared/blessing-editor');
const EMOJIS=['❤️','🌹','🎉','🥂','💐','囍'];
Component({
  properties:{paused:{type:Boolean,value:false,observer(){this.syncMotion();}}},
  data:{items:[],postCount:0,flakes:[],bursts:[],emojis:EMOJIS,formOpen:false,ready:false,loading:false,busy:false,
    pageVisible:true,motionPaused:false,status:'',error:'',name:'',text:'',emoji:'',formPhotos:[],
    textCount:0,progress:'',uncertain:false,feedTop:0,replyOpen:false,replyBusy:false,replyText:'',replyCount:0,
    replyTarget:null,replyError:'',replyUncertain:false,replyProgress:'',deleting:false},
  lifetimes:{
    attached(){this._alive=true;this._snowTimers=[];this._endTimers=[];this._cursor=0;this._serial=0;this._identity=null;this._polling=false;this.loadIdentity();},
    detached(){this._alive=false;this.stop();}
  },
  pageLifetimes:{show(){this.setData({pageVisible:true});this.syncMotion();if(this._identity)this.refresh();},hide(){this.setData({pageVisible:false});this.stop();this.syncMotion();}},
  methods:{
    stopSnow(){(this._snowTimers||[]).forEach(clearTimeout);(this._endTimers||[]).forEach(clearTimeout);this._snowTimers=[];this._endTimers=[];},
    stop(){clearTimeout(this._pollTimer);clearTimeout(this._burstTimer);this.stopSnow();},
    syncMotion(){
      if(!this._alive)return;
      const pause=!!(this.properties.paused||!this.data.pageVisible||this.data.formOpen||this.data.replyOpen);
      this.setData({motionPaused:pause});
      if(pause){this.stopSnow();this.setData({flakes:[]});}else this.startSnow();
    },
    loadIdentity(){
      if(!client.configured()){this.setData({ready:false,status:'祝福墙正在准备，稍后再来留下心意'});return;}
      return client.invoke('identity').then(result=>{if(!this._alive)return;this._identity=result;this.setData({ready:true,status:''});return this.refresh();})
        .catch(error=>{if(this._alive)this.setData({ready:false,status:error.message||'暂时无法连接祝福墙'});});
    },
    retry(){return this._identity?this.refresh(true):this.loadIdentity();},
    refresh(force){
      if(!this._alive||!this.data.pageVisible||!this._identity||!this.data.ready)return Promise.resolve();
      // A post-mutation refresh must read after any older in-flight poll has finished.
      if(this._polling)return force?this._polling.then(()=>this.refresh(true)):this._polling;
      clearTimeout(this._pollTimer);if(!this.data.items.length)this.setData({loading:true});
      this._polling=client.invoke('list',{mode:'public'}).then(result=>{
        if(!this._alive)return;
        const previous=new Map(this.data.items.map(item=>[item.id,item]));
        const items=result.items.slice().sort((a,b)=>b.createdAt-a.createdAt).map(item=>{
          const old=previous.get(item.id),oldPhotos=new Map((old?.photoViews||[]).map(photo=>[photo.key,photo]));
          return {...item,dateLabel:this.dateLabel(item.createdAt),replies:(item.replies||[]).slice().sort((a,b)=>a.createdAt-b.createdAt),
            photoViews:item.photos.map((url,index)=>{const key=(item.photoKeys||[])[index]||url,cached=oldPhotos.get(key);return {url,index,key,width:cached?.width||160,height:cached?.height||160};})};
        });
        this._publicItems=items;const visible=new Set(items.map(item=>item.id));
        this.setData({items,postCount:items.length,error:'',flakes:this.data.flakes.filter(flake=>visible.has(flake.postId))});
        if(this._justSentId){const own=items.find(item=>item.id===this._justSentId);if(own&&!this.data.motionPaused){this.spawnSnow(0,own);this._justSentId=null;}}
        this.startSnow();
      }).catch(error=>{if(this._alive)this.setData({error:error.message||'祝福暂时未能更新，轻触重试'});}).then(()=>{
        this._polling=false;if(!this._alive)return;this.setData({loading:false});
        if(this.data.pageVisible)this._pollTimer=setTimeout(()=>this.refresh(),client.pollMs);
      });
      return this._polling;
    },
    dateLabel(time){const d=new Date(time),pad=n=>String(n).padStart(2,'0');return (d.getMonth()+1)+'月'+d.getDate()+'日 '+pad(d.getHours())+':'+pad(d.getMinutes());},
    startSnow(){
      if(!this._alive||this.data.motionPaused||!this._publicItems||!this._publicItems.length)return;
      for(let i=0;i<snow.slots;i++)if(!this.data.flakes.some(f=>f.slot===i)&&!this._snowTimers[i])this._snowTimers[i]=setTimeout(()=>{this._snowTimers[i]=null;this.spawnSnow(i);},120+i*1250);
    },
    spawnSnow(slot,preferred){
      if(!this._alive||this.data.motionPaused||!this._publicItems||!this._publicItems.length)return;
      clearTimeout(this._snowTimers[slot]);this._snowTimers[slot]=null;clearTimeout(this._endTimers[slot]);
      const item=preferred||this._publicItems[this._cursor++%this._publicItems.length],flake=snow.create(item,slot,++this._serial);
      this.setData({flakes:this.data.flakes.filter(f=>f.slot!==slot).concat(flake)});
      this._endTimers[slot]=setTimeout(()=>this.snowEnded({currentTarget:{dataset:{id:flake.id,slot}}}),flake.duration*1000+300);
    },
    snowEnded(event){
      if(!this._alive)return;
      const id=Number(event.currentTarget.dataset.id),slot=Number(event.currentTarget.dataset.slot);
      if(!this.data.flakes.some(f=>f.id===id))return;
      clearTimeout(this._endTimers[slot]);this._endTimers[slot]=null;this.setData({flakes:this.data.flakes.filter(f=>f.id!==id)});
      if(!this.data.motionPaused)this._snowTimers[slot]=setTimeout(()=>{this._snowTimers[slot]=null;this.spawnSnow(slot);},1800);
    },
    openForm(){this.setData({formOpen:true,error:''});this.syncMotion();this.triggerEvent('composing',{open:true});},
    closeForm(){if(this.data.busy)return;this.setData({formOpen:false});this.syncMotion();this.triggerEvent('composing',{open:false});},
    hold(){},
    inputName(event){if(!this.data.uncertain&&!this.data.busy&&!this.data.replyBusy&&!this.data.replyUncertain)this.setData({name:event.detail.value});},
    inputText(event){if(!this.data.uncertain&&!this.data.busy)this.setData({text:event.detail.value,textCount:Array.from(event.detail.value).length});},
    chooseEmoji(event){
      if(this.data.busy||this.data.uncertain)return;
      const text=editor.append(this.data.text,event.currentTarget.dataset.emoji);
      if(text===null){this.setData({error:'正文最多160字，删减几个字再加入表情吧'});return;}
      this.setData({text,textCount:Array.from(text).length,error:''});
    },
    photoLoaded(event){
      const {id,index}=event.currentTarget.dataset,at=this.data.items.findIndex(item=>item.id===id);
      if(at<0||!this.data.items[at].photoViews[Number(index)])return;
      const size=editor.fit(event.detail.width,event.detail.height,this.data.items[at].photos.length===1?280:190,280);
      this.setData({['items['+at+'].photoViews['+index+'].width']:size.width,['items['+at+'].photoViews['+index+'].height']:size.height});
    },
    pickedPhotoLoaded(event){
      const index=Number(event.currentTarget.dataset.index);if(!this.data.formPhotos[index])return;
      const size=editor.fit(event.detail.width,event.detail.height,180,210);
      this.setData({['formPhotos['+index+'].width']:size.width,['formPhotos['+index+'].height']:size.height});
    },
    choosePhotos(){
      if(this.data.busy||this.data.uncertain||this.data.formPhotos.length>=3)return;
      const choose=()=>wx.chooseMedia({count:3-this.data.formPhotos.length,mediaType:['image'],sourceType:['album','camera'],sizeType:['compressed'],
        success:result=>{if(this._alive)this.setData({formPhotos:this.data.formPhotos.concat(result.tempFiles.map(photo=>({path:photo.tempFilePath}))).slice(0,3)});},
        fail:error=>{if(!/cancel/.test(error.errMsg||''))wx.showToast({title:'暂时无法选择照片，请重试',icon:'none'});}});
      if(wx.requirePrivacyAuthorize)wx.requirePrivacyAuthorize({success:choose,fail:()=>wx.showToast({title:'同意照片用途后，才能选择照片',icon:'none'})});else choose();
    },
    removePhoto(event){if(!this.data.busy&&!this.data.uncertain)this.setData({formPhotos:this.data.formPhotos.filter((_,i)=>i!==Number(event.currentTarget.dataset.index))});},
    deleteContent(event){
      if(this.data.deleting)return Promise.resolve();
      const {id,kind,replyId,photoKey}=event.currentTarget.dataset,post=this.data.items.find(item=>item.id===id);
      if(!post)return Promise.resolve();
      let action,data,content;
      if(kind==='post'&&post.own){
        action='remove';data={id};content='这条祝福、附带照片和下面的回复将一起从祝福墙移除。';
      }else if(kind==='reply'&&(post.replies||[]).some(reply=>reply.id===replyId&&reply.own)){
        action='removeReply';data={postId:id,replyId};content='删除自己这条回复，其他亲友的留言会保留。';
      }else if(kind==='photo'&&post.own&&post.photoViews.some(photo=>photo.key===photoKey)){
        if(!/^[a-f0-9]{64}$/.test(photoKey)){this.refresh(true);wx.showToast({title:'照片信息正在更新，请稍后再试',icon:'none'});return Promise.resolve();}
        action='removePhoto';data={postId:id,photoKey};
        content=post.photos.length===1&&!post.text&&!post.emoji?'这是这条祝福的最后一张照片，删除后整条空祝福和下面的回复将一起移除。':'只删除这张照片，祝福文字和其他照片会保留。';
      }else return Promise.resolve();
      this.setData({deleting:true,error:''});
      return new Promise(resolve=>wx.showModal({title:kind==='post'?'删除这份祝福？':kind==='reply'?'删除这条回复？':'删除这张照片？',content,confirmText:'删除',confirmColor:'#8b4450',cancelText:'保留',success:resolve,fail:()=>resolve({confirm:false})})).then(async result=>{
        if(!result.confirm||!this._alive)return;
        wx.showLoading({title:'正在删除',mask:true});
        try{
          const removed=await client.invoke(action,data);
          await this.refresh(true);
          if(!this._alive)return;
          // Keep deletion visible even if the subsequent list request failed.
          const items=this.data.items.filter(item=>!(item.id===id&&(kind==='post'||kind==='photo'&&removed.status==='deleted'))).map(item=>{
            if(item.id!==id)return item;
            if(kind==='reply')return {...item,replies:item.replies.filter(reply=>reply.id!==replyId)};
            if(kind==='photo'){const photoViews=item.photoViews.filter(photo=>photo.key!==photoKey).map((photo,index)=>({...photo,index}));return {...item,photoViews,photos:photoViews.map(photo=>photo.url),photoKeys:photoViews.map(photo=>photo.key)};}
            return item;
          });
          this._publicItems=items;this.setData({items,postCount:items.length,flakes:this.data.flakes.filter(flake=>items.some(item=>item.id===flake.postId))});
          wx.showToast({title:'已删除',icon:'none'});
        }catch(error){if(this._alive){this.setData({error:error.message||'删除未确认，请重试'});wx.showToast({title:'删除未确认，请重试',icon:'none'});}}
        finally{wx.hideLoading();}
      }).then(()=>{if(this._alive)this.setData({deleting:false});});
    },
    openReply(event){
      if(this.data.formOpen||this.data.busy)return;
      const {id,replyId}=event.currentTarget.dataset,post=this.data.items.find(item=>item.id===id);
      const target=replyId&&post?(post.replies||[]).find(reply=>reply.id===replyId):post;
      if(!target)return;
      if(this._replyDraft&&(this._replyDraft.postId!==id||this._replyDraft.replyToId!==(replyId||''))){
        wx.showToast({title:'请先核对上一条回复的送达结果',icon:'none'});
        this.setData({replyOpen:true});this.syncMotion();return;
      }
      const same=this.data.replyTarget?.postId===id&&this.data.replyTarget?.replyToId===(replyId||'');
      this.setData({replyOpen:true,replyTarget:{postId:id,replyToId:replyId||'',name:target.name},replyText:same?this.data.replyText:'',replyCount:same?this.data.replyCount:0,replyError:''});
      this.syncMotion();
    },
    closeReply(){if(this.data.replyBusy)return;this.setData({replyOpen:false});this.syncMotion();},
    inputReply(event){if(!this.data.replyBusy&&!this.data.replyUncertain)this.setData({replyText:event.detail.value,replyCount:Array.from(event.detail.value).length,replyError:''});},
    replyEmoji(event){
      if(this.data.replyBusy||this.data.replyUncertain)return;
      const replyText=editor.append(this.data.replyText,event.currentTarget.dataset.emoji);
      if(replyText===null){this.setData({replyError:'回复最多160字，删减几个字再加入表情吧'});return;}
      this.setData({replyText,replyCount:Array.from(replyText).length,replyError:''});
    },
    submitReply(event){
      if(this.data.replyBusy)return Promise.resolve();
      // Native form values include the latest nickname/keyboard input before blur/setData catches up.
      const values=event&&event.detail&&event.detail.value;
      if(!this._replyDraft&&values){
        const name=typeof values.name==='string'?values.name:this.data.name;
        const replyText=typeof values.text==='string'?values.text:this.data.replyText;
        this.setData({name,replyText,replyCount:Array.from(replyText).length});
      }
      if(!this.data.ready||!this.data.replyTarget){this.setData({replyError:'回复服务还未接通，请稍后重试'});return Promise.resolve();}
      if(!this.data.name.trim()||!this.data.replyText.trim()){this.setData({replyError:'写下你的称呼和回复内容吧'});return Promise.resolve();}
      if(!this._replyDraft)this._replyDraft={nonce:client.nonce(),postId:this.data.replyTarget.postId,replyToId:this.data.replyTarget.replyToId,name:this.data.name.trim(),text:this.data.replyText.trim()};
      this.setData({replyBusy:true,replyProgress:'正在送出你的回复',replyError:''});
      return client.invoke('reply',this._replyDraft).then(result=>{
        if(!this._alive)return;
        if(result.status!=='approved')throw new Error('REPLY_NOT_CONFIRMED');
        this._replyDraft=null;this.setData({replyProgress:'回复已送达，正在更新留言',replyUncertain:false});
        return this.refresh(true).then(()=>{if(!this._alive)return;this.setData({replyBusy:false,replyOpen:false,replyText:'',replyCount:0,replyProgress:''});this.syncMotion();wx.showToast({title:'回复已送达',icon:'none'});});
      }).catch(error=>{
        if(!this._alive)return;
        const certain=['INVALID_INPUT','RATE_LIMIT','FORBIDDEN','POST_UNAVAILABLE','THREAD_FULL','DUPLICATE_CONFLICT','ALREADY_HANDLED','LOGIN_REQUIRED','APP_MISMATCH','NOT_READY'].includes(error.code);
        if(certain)this._replyDraft=null;
        this.setData({replyBusy:false,replyUncertain:!certain,replyProgress:'',replyError:certain?error.message:'送达结果尚未确认，请重试核对；这条回复会保留'});
      });
    },
    submit(){
      if(this.data.busy)return Promise.resolve();
      if(!this.data.ready||!this._identity){this.setData({error:'祝福服务还未接通，暂时无法发送'});return Promise.resolve();}
      if(!this.data.name.trim()){this.setData({error:'写下你的称呼，让我们知道是谁的心意'});return Promise.resolve();}
      if(!this.data.text.trim()&&!this.data.formPhotos.length){this.setData({error:'写一句祝福，或添一张照片、一个表情吧'});return Promise.resolve();}
      if(!this._draft)this._draft={nonce:client.nonce(),name:this.data.name.trim(),text:this.data.text.trim(),emoji:this.data.emoji,photos:this.data.formPhotos.map(photo=>({path:photo.path}))};
      this.setData({busy:true,error:'',progress:'正在准备你的心意'});
      return client.uploadDraft(this._draft,this._identity.ownerKey,message=>{if(this._alive)this.setData({progress:message});}).then(result=>{
        if(!this._alive)return;
        if(result.status!=='approved')throw new Error('PUBLISH_NOT_CONFIRMED');
        this._justSentId=result.id;this._draft=null;
        this.setData({uncertain:false,progress:'已送达，正在展开你的祝福',feedTop:0});
        return this.refresh(true).then(()=>{
          if(!this._alive)return;
          this.setData({busy:false,formOpen:false,text:'',textCount:0,formPhotos:[],progress:''});
          this.syncMotion();if(this._justSentId){const own=this.data.items.find(item=>item.id===this._justSentId);if(own){this.spawnSnow(0,own);this._justSentId=null;}}
          this.triggerEvent('composing',{open:false});this.burst();wx.showToast({title:'祝福已送达，欢喜飘起来',icon:'none',duration:2200});
        });
      }).catch(error=>{
        if(!this._alive)return;
        const certain=['INVALID_INPUT','INVALID_FILE','PHOTO_ERROR','RATE_LIMIT','FORBIDDEN','ALREADY_HANDLED','DUPLICATE_CONFLICT','LOGIN_REQUIRED','APP_MISMATCH','NOT_READY'].includes(error.code);
        if(certain)this._draft=null;
        this.setData({busy:false,uncertain:!certain,progress:'',error:certain?error.message:'送达结果尚未确认，请重试核对；这份心意会保留'});
      });
    },
    burst(){clearTimeout(this._burstTimer);this.setData({bursts:Array.from({length:12},(_,i)=>({id:i,glyph:i%3===0?'✿':i%3===1?'♡':'✧',x:(i%2?-1:1)*(30+i*8),y:-(80+(i%5)*35),delay:i*.025}))});this._burstTimer=setTimeout(()=>{if(this._alive)this.setData({bursts:[]});},1800);},
    preview(event){const item=this.data.items.find(item=>item.id===event.currentTarget.dataset.id);if(item&&item.photos.length)wx.previewImage({current:item.photos[Number(event.currentTarget.dataset.index)]||item.photos[0],urls:item.photos});}
  }
});

const client=require('../../shared/blessing-client');
Component({
  properties:{
    enabled:{type:Boolean,value:false,observer(){this.sync();}},
    paused:{type:Boolean,value:false,observer(){this.sync();}}
  },
  data:{url:'',mounted:false,playing:false,hasFrame:false,error:false,inView:false,pageVisible:true},
  lifetimes:{
    attached(){this._alive=true;},
    ready(){
      this._ready=true;
      try{
        this._observer=this.createIntersectionObserver({thresholds:[0,.08]});
        this._observer.relativeToViewport().observe('#motion-frame',entry=>{
          if(!this._alive)return;this.setData({inView:entry.intersectionRatio>.08});this.sync();
        });
      }catch(_){ /* Keep the original photograph when viewport observation is unavailable. */ }
    },
    detached(){this._alive=false;clearTimeout(this._playTimer);this._video?.pause();this._observer?.disconnect();}
  },
  pageLifetimes:{
    show(){this.setData({pageVisible:true});this.sync();},
    hide(){this.setData({pageVisible:false});this.sync();}
  },
  methods:{
    wanted(){return this._alive&&this._ready&&this.properties.enabled&&!this.properties.paused&&this.data.inView&&this.data.pageVisible;},
    load(){
      if(this._request)return this._request;
      if(this.data.url&&this._expiresAt>Date.now()+10000)return Promise.resolve();
      this._request=client.invoke('usMotion').then(result=>{
        if(!/^https:\/\//.test(result.url||'')||!(result.expiresAt>Date.now()))throw Error('MOTION_UNAVAILABLE');
        if(!this._alive)return;
        this._expiresAt=result.expiresAt;this.setData({url:result.url,error:false,hasFrame:false});
      }).then(()=>{this._request=null;},error=>{this._request=null;throw error;});
      return this._request;
    },
    sync(){
      if(!this._alive||!this._ready)return;
      if(!this.wanted()){
        clearTimeout(this._playTimer);this._video?.pause();this.setData({playing:false});return;
      }
      if(this._starting||this.data.playing||this.data.error)return;
      this._starting=true;
      this.load().then(()=>{
        this._starting=false;if(!this.wanted())return;
        this.setData({mounted:true},()=>{
          if(!this.wanted())return;
          this.readyToPlay();clearTimeout(this._playTimer);
          this._playTimer=setTimeout(()=>{if(this.wanted()&&!this.data.hasFrame)this.failed();},10000);
        });
      }).catch(()=>{this._starting=false;this.failed();});
    },
    readyToPlay(){
      if(!this.wanted())return;
      this._video=wx.createVideoContext('us-motion-video',this);
      this._video.play();
    },
    playing(){
      if(!this.wanted()){this._video?.pause();return;}
      this.setData({playing:true,error:false});
    },
    timeUpdate(event){
      this._lastTime=event.detail.currentTime;
      if(this._lastTime>0&&!this.data.hasFrame){clearTimeout(this._playTimer);this.setData({hasFrame:true});}
    },
    onPause(){if(this._alive)this.setData({playing:false});},
    failed(){
      if(!this._alive)return;
      clearTimeout(this._playTimer);this._video?.pause();this.setData({error:true,mounted:false,playing:false,hasFrame:false});
    },
    retry(){
      this._expiresAt=0;this.setData({error:false,hasFrame:false});this.sync();
    },
    preview(){this.triggerEvent('preview');}
  }
});

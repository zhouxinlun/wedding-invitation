(() => {
  const config=window.WEDDING?.music;
  // No placeholder playback control while the chosen recording is still missing.
  if(!config?.webFile){window.WeddingEntry?.unavailable('music');return;}
  const audio=document.createElement('audio');
  // Start muted so browser autoplay policies allow the first frame of audio;
  // unmute as soon as playback is confirmed below.
  audio.src=config.webFile;audio.preload='auto';audio.autoplay=true;audio.muted=true;audio.defaultMuted=true;audio.setAttribute('muted','');audio.loop=true;audio.volume=.28;
  const control=document.createElement('button');control.type='button';control.className='wedding-music';
  const record=document.createElement('span');record.className='music-record';record.setAttribute('aria-hidden','true');
  const label=document.createElement('span');label.className='music-label';
  control.append(record,label);document.body.append(audio);
  (document.querySelector('.nav-track')||document.body).append(control);
  const controls=[control,...document.querySelectorAll('[data-music-toggle]')];
  controls.forEach(button=>{button.hidden=false;});
  document.documentElement.classList.add('has-music');
  let enabled=false,pending=false,pageActive=true,failed=false,firstGesture=true;
  const wanted=()=>enabled&&pageActive&&!document.hidden;
  function render(){
    const playing=!audio.paused;
    const action=failed?'重试音乐':playing?'暂停音乐':pending?'加载音乐':'播放音乐';
    controls.forEach(button=>{
      button.classList.toggle('is-playing',playing);button.setAttribute('aria-pressed',String(playing));
      button.querySelector('.music-label,.garden-music-label').textContent=failed?'重试':pending?'载入':playing?'暂停':'音乐';
      button.setAttribute('aria-label',action+' · '+config.title);
      button.title=config.title+' · '+config.artist;
    });
  }
  async function sync(){
    if(!wanted()){audio.pause();render();return;}
    if(pending||!audio.paused)return;
    pending=true;render();
    try{if(audio.error)audio.load();await audio.play();audio.muted=false;firstGesture=false;}
    catch(error){
      enabled=false;
      if(error.name==='NotAllowedError'){
        // Permission to play sound is separate from buffering. Keep the first
        // real tap available instead of trapping guests on the loading letter.
        failed=false;firstGesture=true;window.WeddingEntry?.blocked('music');
      }else{failed=true;window.WeddingEntry?.fail('music');}
    }
    finally{pending=false;if(!wanted())audio.pause();render();}
  }
  const start=event=>{if(event?.detail?.automatic!==true)firstGesture=false;failed=false;enabled=true;if(!audio.paused)audio.muted=false;sync();};
  document.addEventListener('wedding:enter',start);
  const startOnGesture=event=>{
    if(window.WeddingEntry?.pending)return;
    if(!firstGesture||event.target.closest?.('.wedding-music,[data-music-toggle]'))return;
    if(event.type==='keydown'&&!['Enter',' '].includes(event.key))return;
    start();
  };
  // Invoke play synchronously inside the first real tap; audible autoplay is
  // otherwise blocked by mobile browsers. A deliberate pause never re-arms it.
  ['pointerdown','touchstart','click','touchend','keydown'].forEach(type=>document.addEventListener(type,startOnGesture,{capture:true,passive:true}));
  controls.forEach(button=>button.addEventListener('click',()=>{firstGesture=false;failed=false;enabled=!enabled;sync();}));
  audio.addEventListener('playing',()=>{if(!wanted())audio.pause();render();});
  audio.addEventListener('pause',()=>render());
  audio.addEventListener('error',()=>{enabled=false;failed=true;audio.pause();render();});
  document.addEventListener('visibilitychange',sync);
  window.addEventListener('pagehide',()=>{pageActive=false;sync();});
  window.addEventListener('pageshow',()=>{pageActive=true;sync();});
  // Buffer concurrently with the clip. The entry attempts playback once ready;
  // browsers that block sound resume through the first real guest interaction.
  window.WeddingEntry?.track('music',audio);
  audio.load();
  render();
  // Dynamic audio elements do not consistently honor autoplay on mobile;
  // explicitly request the muted autoplay path as soon as the source is ready.
  start({detail:{automatic:true}});
})();

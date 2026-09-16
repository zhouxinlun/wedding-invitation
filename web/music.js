(() => {
  const config=window.WEDDING?.music;
  if(!config?.webFile)return;
  const audio=document.createElement('audio');
  audio.src=config.webFile;audio.preload='auto';audio.autoplay=true;audio.loop=true;audio.volume=.28;
  const control=document.createElement('button');control.type='button';control.className='wedding-music';
  const record=document.createElement('span');record.className='music-record';record.setAttribute('aria-hidden','true');
  const label=document.createElement('span');label.className='music-label';
  control.append(record,label);document.body.append(audio);
  (document.querySelector('.nav-track')||document.body).append(control);
  const controls=[control,...document.querySelectorAll('[data-music-toggle]')];
  controls.forEach(button=>{button.hidden=false;});
  document.documentElement.classList.add('has-music');
  let failed=false;
  const gestureEvents=['pointerdown','touchstart','click','keydown'];
  function render(){
    const playing=!audio.paused;
    const action=failed?'重试音乐':playing?'暂停音乐':'播放音乐';
    controls.forEach(button=>{
      button.classList.toggle('is-playing',playing);button.setAttribute('aria-pressed',String(playing));
      button.querySelector('.music-label,.garden-music-label').textContent=failed?'重试':playing?'暂停':'音乐';
      button.setAttribute('aria-label',action+' · '+config.title);
      button.title=config.title+' · '+config.artist;
    });
  }
  function play(){
    failed=false;
    if(audio.error)audio.load();
    const result=audio.play();
    result?.then?.(()=>{
      gestureEvents.forEach(type=>document.removeEventListener(type,resumeFromGesture,true));
      render();
    },()=>{});
    result?.catch?.(error=>{
      // Mobile browsers reject audible autoplay without a user gesture.
      // Keep the normal music state; the first tap will retry it.
      if(error?.name!=='NotAllowedError')failed=true;
      render();
    });
    render();
  }
  function resumeFromGesture(event){
    // Music controls handle their own gesture; the global retry must not toggle them twice.
    if(event.target.closest?.('.wedding-music,[data-music-toggle]'))return;
    if(audio.paused)play();
  }
  gestureEvents.forEach(type=>document.addEventListener(type,resumeFromGesture,true));
  controls.forEach(button=>button.addEventListener('click',()=>{
    if(!audio.paused){audio.pause();render();return;}
    play();
  }));
  audio.addEventListener('playing',render);
  audio.addEventListener('pause',render);
  audio.addEventListener('error',()=>{failed=true;audio.pause();render();});
  audio.load();
  render();
  play();
})();

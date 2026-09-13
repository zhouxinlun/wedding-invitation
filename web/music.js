(() => {
  const config=window.WEDDING?.music;
  // No placeholder playback control while the chosen recording is still missing.
  if(!config?.webFile)return;
  const audio=document.createElement('audio');
  audio.src=config.webFile;audio.preload='none';audio.loop=true;audio.volume=.28;
  const control=document.createElement('button');control.type='button';control.className='wedding-music';
  const record=document.createElement('span');record.className='music-record';record.setAttribute('aria-hidden','true');
  const label=document.createElement('span');label.className='music-label';
  control.append(record,label);document.body.append(audio,control);
  const controls=[control,...document.querySelectorAll('[data-music-toggle]')];
  controls.forEach(button=>{button.hidden=false;});
  document.documentElement.classList.add('has-music');
  let enabled=false,pending=false,pageActive=true,failed=false;
  const wanted=()=>enabled&&pageActive&&!document.hidden;
  function render(){
    const playing=!audio.paused;
    const action=failed?'重试音乐':playing?'暂停音乐':pending?'加载音乐':'播放音乐';
    controls.forEach(button=>{
      button.classList.toggle('is-playing',playing);button.setAttribute('aria-pressed',String(playing));
      button.querySelector('.music-label,.garden-music-label').textContent=action;
      button.setAttribute('aria-label',action+' · '+config.title);
      button.title=config.title+' · '+config.artist;
    });
  }
  async function sync(){
    if(!wanted()){audio.pause();render();return;}
    if(pending||!audio.paused)return;
    pending=true;render();
    try{await audio.play();}
    catch(_){enabled=false;failed=true;}
    finally{pending=false;if(!wanted())audio.pause();render();}
  }
  controls.forEach(button=>button.addEventListener('click',()=>{failed=false;enabled=!enabled;sync();}));
  audio.addEventListener('playing',()=>{if(!wanted())audio.pause();render();});
  audio.addEventListener('pause',()=>render());
  audio.addEventListener('error',()=>{enabled=false;failed=true;audio.pause();render();});
  document.addEventListener('visibilitychange',sync);
  window.addEventListener('pagehide',()=>{pageActive=false;sync();});
  window.addEventListener('pageshow',()=>{pageActive=true;sync();});
  render();
})();

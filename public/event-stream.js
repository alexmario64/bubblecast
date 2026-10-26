// Local overlay transport. Own reconnection explicitly: EventSource can stop permanently after an
// HTTP error, and comment-only keepalives cannot be observed by JavaScript.
(()=>{
 function connect({EventSource:Source=window.EventSource,fetcher=(...a)=>window.fetch(...a),now=()=>Date.now(),later=setTimeout,clearLater=clearTimeout,repeat=setInterval,clearRepeat=clearInterval,reload=()=>window.location.reload(),storage}={}){
  const listeners=new Map();let source=null,retry=null,request=null,stopped=false,failures=0,lastHeartbeat=now(),openedAt=now(),generation=0,settingsRevision=0,reloaded=false;
  const reloadKey='bubblecast-overlay-reload:'+window.location.pathname+window.location.search;
  const snapshots=new Map();let opened=false;
  const dispatch=(type,event)=>{
   if(type==='open')opened=true;if(type==='error')opened=false;
   if(['settings','polls','tts-cooldown'].includes(type))snapshots.set(type,event);
   if(type==='poll'||type==='poll-remove'){try{const update=JSON.parse(event.data),polls=JSON.parse(snapshots.get('polls')?.data||'[]').filter(p=>p.sourceKey!==update.sourceKey||type==='poll-remove'&&p.id!==update.id);if(type==='poll')polls.push(update);snapshots.set('polls',{data:JSON.stringify(polls)});}catch{}}
   for(const fn of listeners.get(type)||[])fn(event);
  };
  async function settingsSnapshot(current,revision){
   const controller=new AbortController();request=controller;const timeout=later(()=>controller.abort(),5000);
   try{const response=await fetcher('/api/settings',{cache:'no-store',signal:controller.signal});if(!response.ok)return false;const settings=await response.json();
    if(stopped||current!==generation||!settings||typeof settings!=='object'||Array.isArray(settings))return false;
    if(revision===settingsRevision)dispatch('settings',{data:JSON.stringify(settings)});return true;
   }catch{return false;}finally{clearLater(timeout);if(request===controller)request=null;}
  }
  async function recover(current){
   if(stopped||current!==generation)return;
   if(failures>=5){
    // Never navigate an OBS source into an offline server. Probe locally first, and limit reloads
    // across documents so a broken endpoint cannot create a reload loop.
    const reachable=await settingsSnapshot(current,settingsRevision);if(stopped||current!==generation)return;
    if(reachable&&!reloaded&&reload){let allowed=false;try{const saved=storage||window.sessionStorage,previous=saved.getItem(reloadKey);if(previous===null||now()-Number(previous)>=120000){saved.setItem(reloadKey,String(now()));allowed=true;}}catch{}
     if(allowed){reloaded=true;reload();}
    }
   }
   if(!stopped&&current===generation)open();
  }
  function failed(active){
   if(stopped||active!==source||retry!==null)return;
   source?.close();source=null;request?.abort();generation++;failures++;dispatch('error',{});
   retry=later(()=>{retry=null;recover(generation);},Math.min(1000*2**Math.min(failures-1,4),10000));
  }
  function bind(type,active){active.addEventListener(type,event=>{
   if(stopped||source!==active)return;
   if(type==='settings')settingsRevision++;
   dispatch(type,event);
  });}
  function open(){
   if(stopped)return;lastHeartbeat=openedAt=now();const current=++generation;
   try{const active=source=new Source('/api/events');
    active.addEventListener('open',()=>{if(source===active&&!stopped)settingsSnapshot(current,settingsRevision);});
    active.addEventListener('heartbeat',()=>{if(source!==active||stopped)return;lastHeartbeat=now();if(now()-openedAt>=45000)failures=0;});
    active.addEventListener('error',()=>failed(active));
    for(const type of new Set(['settings',...listeners.keys()]))if(type!=='error')bind(type,active);
   }catch{failed(source);}
  }
  const watch=repeat(()=>{if(source&&(source.readyState===2||now()-lastHeartbeat>=45000))failed(source);},5000);
  function close(){if(stopped)return;stopped=true;generation++;source?.close();source=null;request?.abort();clearLater(retry);retry=null;clearRepeat(watch);window.removeEventListener('pagehide',close);}
  window.addEventListener('pagehide',close);
  open();
  const events={addEventListener(type,fn){if(!listeners.has(type)){listeners.set(type,new Set());if(source&&type!=='settings'&&type!=='error')bind(type,source);}listeners.get(type).add(fn);},removeEventListener(type,fn){listeners.get(type)?.delete(fn);},close,fork(){
   // Same-origin dock panes use one parent stream, keeping HTTP connections free for local saves/status.
   const registrations=[];let closed=false;const fork={addEventListener(type,fn){if(closed)return;const wrapped=e=>{if(!closed)fn(e);};registrations.push([type,wrapped]);events.addEventListener(type,wrapped);
    const snapshot=snapshots.get(type),current=generation;if(snapshot||type==='open'&&opened)later(()=>{if(closed||stopped||current!==generation)return;if(type==='open'&&opened)fn({});else if(snapshot===snapshots.get(type))fn(snapshot);},0);
   },close(){if(closed)return;closed=true;for(const [type,fn] of registrations)events.removeEventListener(type,fn);}};return fork;
  }};return events;
 }
 window.bubblecastEvents={connect};
})();

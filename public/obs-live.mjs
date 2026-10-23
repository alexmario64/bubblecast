// OBS gives its browser sources and docks window.obsstudio. Pages inside OBS report whether OBS is
// streaming, so Bubblecast spends YouTube API quota only while the streamer is live.
export function reportObsStreaming({obs=globalThis.window?.obsstudio,target=globalThis.window,fetcher=(...a)=>fetch(...a),every=30000,repeat=setInterval}={}){
 if(typeof obs?.getStatus!=='function')return false;
 let pairing=null;
 async function post(streaming){try{pairing??=fetcher('/api/pair').then(r=>r.json()).then(j=>j.token);const token=await pairing;if(!token)return;const r=await fetcher('/api/obs/streaming',{method:'POST',headers:{'Content-Type':'application/json','X-Bubblecast-Token':token},body:JSON.stringify({streaming})});if(r.status===401)pairing=null;}catch{pairing=null;}}
 const check=()=>{try{obs.getStatus(status=>post(status?.streaming===true));}catch{}};
 target?.addEventListener?.('obsStreamingStarted',()=>post(true));
 target?.addEventListener?.('obsStreamingStopped',()=>post(false));
 check();repeat(check,every);
 return true;
}

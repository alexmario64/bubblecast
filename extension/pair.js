let sourceFingerprint='',bridgeStopped=false,pairTimer=null,sourceEvents=null;

function retireBridge(){
 if(bridgeStopped)return;
 bridgeStopped=true;
 if(pairTimer!==null)clearInterval(pairTimer);
 sourceEvents?.close();
 window.removeEventListener('bubblecast-pair',pair);
 window.removeEventListener('bubblecast-connect-sources',connectSources);
 document.removeEventListener('DOMContentLoaded',pair);
 window.dispatchEvent(new CustomEvent('bubblecast-bridge-reload-needed'));
}

// Extension reloads invalidate scripts in already-open pages. Guard both the
// send call and the reply callback, then retire the old script instead of retrying.
function sendToBridge(message,onReply){
 if(bridgeStopped)return;
 try{
  if(!chrome.runtime?.id){retireBridge();return;}
  chrome.runtime.sendMessage(message,result=>{
   if(bridgeStopped)return;
   try{
    const error=chrome.runtime.lastError;
    if(error){if(/context invalidated/i.test(error.message||''))retireBridge();return;}
    onReply(result);
   }catch{retireBridge();}
  });
 }catch{retireBridge();}
}

async function syncSources(force=false){
 if(bridgeStopped)return;
 try{
  const response=await fetch('/api/sources');
  if(!response.ok)return;
  const config=await response.json();
  if(bridgeStopped||!config.configured)return;
  const fingerprint=JSON.stringify(config);
  if(!force&&sourceFingerprint===fingerprint)return;
  sendToBridge({type:'configureSources',config},result=>{
   if(result?.ok)sourceFingerprint=fingerprint;
   window.dispatchEvent(new CustomEvent('bubblecast-sources-status',{detail:JSON.stringify(result||{})}));
  });
 }catch{}
}

function pair(){sendToBridge({type:'pair'},result=>{if(result?.ok)window.dispatchEvent(new CustomEvent('bubblecast-paired'));});}
function connectSources(){syncSources(true);}
window.addEventListener('bubblecast-pair',pair);
document.addEventListener('DOMContentLoaded',pair);
pairTimer=setInterval(pair,15000);
window.addEventListener('bubblecast-connect-sources',connectSources);
sourceEvents=new EventSource('/api/events');
sourceEvents.addEventListener('sources',connectSources);

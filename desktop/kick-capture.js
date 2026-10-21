(()=>{
 if(window.__bubblecastKickCapture)return;window.__bubblecastKickCapture=true;
 const session=crypto.randomUUID(),seen=new Map();let list=null,ready=false,starting=false,baselineMax=-1;
 const send=data=>window.bubblecastCapture.send({type:'chat',data:{platform:'kick',sourceKey:'kick',...data}});
 function walk(node,parts){if(node.nodeType===3){if(node.textContent)parts.push({type:'text',text:node.textContent});return;}if(node.nodeType!==1)return;if(node.tagName==='IMG'){const src=node.currentSrc||node.src;if(src)parts.push({type:'image',src,alt:node.alt||'emote'});return;}if(node.tagName==='BR'){parts.push({type:'text',text:'\n'});return;}for(const child of node.childNodes)walk(child,parts);}
 function scan(){
  list=document.querySelector('[data-testid="chatroom-messages"]');if(!list)return;if(!starting){starting=true;setTimeout(()=>{scan();ready=true;window.__bubblecastKickDOMReady=true;},750);}
  // Freeze the initial native history as a baseline. Later virtual indices are
  // live arrivals, while history reconstruction can only enrich existing IDs.
  for(const row of list.querySelectorAll('[data-index]')){
   const name=row.querySelector('button[title][data-prevent-expand]');if(!name)continue;
   const meta=name.parentElement?.parentElement,body=meta?.nextElementSibling;if(!body)continue;
   const user=name.textContent.trim(),parts=[];walk(body,parts);if(!user||!parts.length)continue;
   const index=row.getAttribute('data-index');if(!ready)baselineMax=Math.max(baselineMax,Number(index));const badges=[...meta.querySelectorAll('img')].map(img=>({src:img.currentSrc||img.src,alt:img.alt||'Badge'})),signature=JSON.stringify([user,parts,badges]);let record=seen.get(index);if(!record||record.user!==user){record={user,id:session+':'+index+':'+crypto.randomUUID(),attempts:0,lastAt:0,live:ready&&Number(index)>baselineMax,emitted:false};seen.set(index,record);}const changed=record.signature!==signature;if(changed){record.signature=signature;record.attempts=0;}if(record.attempts>=5||!changed&&Date.now()-record.lastAt<500)continue;record.attempts++;record.lastAt=Date.now();while(seen.size>1000)seen.delete(seen.keys().next().value);
   send({id:record.id,...(!record.live||record.emitted?{action:'update'}:{}),user,parts,badges,captureState:ready?'listening':'starting',observedAt:Date.now(),capturedAt:Date.now()});record.emitted=true;
  }
 }
 let pending=false;const observer=new MutationObserver(()=>{if(pending)return;pending=true;queueMicrotask(()=>{pending=false;scan();});});observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});setInterval(scan,1000);setInterval(()=>send({action:'heartbeat',captureState:window.__bubblecastKickNetworkReady||ready?'listening':'starting'}),10000);scan();
})();

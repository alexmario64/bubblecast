(()=>{
 if(window.__bubblecastTikTokCaptureActive)return;window.__bubblecastTikTokCaptureActive=true;
 const selector='[data-e2e="chat-message"]',session=crypto.randomUUID();
 const seen=new Map(),ignored=new Set(),ignoredNodes=new WeakSet(),nodeIds=new WeakMap();
 let listening=false,initialised=false,cutoff=-1,stopped=false,heartbeat=null;
 const timers=new Set();
 document.documentElement.dataset.bubblecastVersion='1.6.0';
 function stop(){if(stopped)return;stopped=true;window.__bubblecastTikTokCaptureActive=false;observer.disconnect();clearInterval(heartbeat);for(const timer of timers)clearTimeout(timer);timers.clear();document.documentElement.dataset.bubblecastBridge='reload-needed';}
 function send(data,attempt=0){
  if(stopped)return;
  try{chrome.runtime.sendMessage({type:'chat',data:{platform:'tiktok',bridgeVersion:'1.6.0',captureState:listening?'listening':'starting',...data}},reply=>{
   if(stopped)return;
   try{const error=chrome.runtime.lastError;if(error&&/context invalidated/i.test(error.message||'')){stop();return;}document.documentElement.dataset.bubblecastBridge=(!error&&reply?.ok)?'connected':'disconnected';if((error||!reply?.ok)&&attempt<4&&data.action!=='heartbeat'){const timer=setTimeout(()=>{timers.delete(timer);send(data,attempt+1);},1000*(attempt+1));timers.add(timer);}}catch{stop();}
  });}catch{stop();}
 }
 function container(){const input=document.querySelector('[data-e2e="live-chat-input-container"]');let parent=input?.parentElement;for(let i=0;parent&&i<4;i++,parent=parent.parentElement)if(parent.querySelector(selector))return parent;return document.querySelector(selector)?.closest('[data-index]')?.parentElement||input?.parentElement||null;}
 function indexOf(el){const n=Number(el.closest('[data-index]')?.getAttribute('data-index'));return Number.isInteger(n)&&n>=0?n:null;}
 function welcome(){for(const wrapper of container()?.querySelectorAll('[data-index]')||[]){if(wrapper.querySelector(selector))continue;const text=wrapper.textContent?.trim()||'';if(text.includes('Welcome to TikTok LIVE!')||text.length>40&&wrapper.querySelector('svg path[d^="M25 3h7"]'))return wrapper;}return null;}
 function source(el){return el.currentSrc||el.src||el.querySelector('source')?.src||el.getAttribute('src')||'';}
 function walk(node,parts){
  if(node.nodeType===Node.TEXT_NODE){if(node.textContent)parts.push({type:'text',text:node.textContent});return;}
  if(node.nodeType!==Node.ELEMENT_NODE||node.matches('script,style,[hidden],[aria-hidden="true"]:not(img):not(video)'))return;
  if(node.matches('img,video')){const src=source(node),alt=node.alt||node.getAttribute('aria-label')||'emote';if(src)parts.push({type:node.tagName==='VIDEO'?'video':'image',src,alt,large:/sticker|gif/i.test(node.className+' '+alt)});else parts.push({type:'text',text:alt});return;}
  if(node.tagName==='BR')parts.push({type:'text',text:'\n'});for(const child of node.childNodes)walk(child,parts);
 }
 const semantic=parts=>parts.map(p=>p.type==='text'?p.text:p.alt||'').join('').replace(/\s+/g,' ').trim();
 function read(el){
  const owner=el.querySelector('[data-e2e="message-owner-name"]');if(!owner)return null;
  const user=(owner.getAttribute('title')||owner.textContent||'').trim(),group=owner.parentElement;
  const body=el.querySelector('[data-e2e="message-content"]')||group?.parentElement?.nextElementSibling;
  if(!user||!body)return null;const parts=[];walk(body,parts);if(!parts.some(p=>p.type!=='text'||p.text.trim()))return null;
  const badges=[...group.querySelectorAll('img')].map(img=>{const label=img.parentElement?.textContent.trim()||'',src=source(img);const role=/moderater|moderator/i.test(src)?'Moderator':/grade_badge/i.test(src)?'Level':/gifter/i.test(src)?'Top gifter':'Badge';return {src,label,alt:img.alt||img.title||[role,label].filter(Boolean).join(' ')};});
  return {user,parts,badges};
 }
 function nativeId(el){return el.getAttribute('data-message-id')||el.getAttribute('data-msg-id')||(/^\d{10,30}$/.test(el.id)?el.id:'');}
 function identity(el,message){const id=nativeId(el);if(id)return id;const index=indexOf(el);if(index!==null)return JSON.stringify([session,index,message.user,semantic(message.parts)]);if(!nodeIds.has(el))nodeIds.set(el,crypto.randomUUID());return nodeIds.get(el);}
 function ignore(el){ignoredNodes.add(el);const message=read(el);if(message)ignored.add(identity(el,message));while(ignored.size>10000)ignored.delete(ignored.values().next().value);}
 function capture(el){
  if(!el.isConnected)return;const index=indexOf(el);if(!listening||index===null&&ignoredNodes.has(el)||index!==null&&index<=cutoff){ignore(el);return;}
  const message=read(el);if(!message)return;const key=identity(el,message);if(ignored.has(key))return;
  const previous=seen.get(key);if(previous&&semantic(previous.parts)===semantic(message.parts)&&previous.parts.filter(p=>p.type!=='text').length>message.parts.filter(p=>p.type!=='text').length)message.parts=previous.parts;
  const signature=JSON.stringify(message);if(previous?.signature===signature)return;
  const id=previous?.id||nativeId(el)||crypto.randomUUID();seen.set(key,{id,signature,parts:message.parts});while(seen.size>10000)seen.delete(seen.keys().next().value);
  send({...message,id,sourceId:id,observedAt:Date.now(),capturedAt:Date.now(),...(previous?{action:'update'}:{})});
 }
 function prepare(){
  const root=container();if(!root)return false;
  if(!initialised){initialised=true;root.querySelectorAll(selector).forEach(ignore);document.documentElement.dataset.bubblecastCapture='starting';send({action:'heartbeat'});}
  if(!listening){const marker=welcome();if(marker)cutoff=indexOf(marker)??-1;else{const indices=[...root.querySelectorAll(selector)].map(indexOf).filter(n=>n!==null);root.querySelectorAll(selector).forEach(ignore);const nativeReady=window.__bubblecastTikTokBaselineReady===true;if(!document.querySelector('[data-e2e="room-chat-input-field"]')||!nativeReady&&(!indices.length||Math.min(...indices)===0))return false;cutoff=indices.length?Math.max(...indices):-1;}listening=true;document.documentElement.dataset.bubblecastCapture='listening';send({action:'heartbeat'});}
  return true;
 }
 const observer=new MutationObserver(mutations=>{
  if(stopped||!prepare())return;
  const pending=new Set();for(const m of mutations){const target=m.target.nodeType===1?m.target:m.target.parentElement;const row=target?.closest(selector);if(row)pending.add(row);if(m.type==='attributes'&&target?.hasAttribute('data-index'))target.querySelectorAll(selector).forEach(el=>pending.add(el));for(const n of m.addedNodes)if(n.nodeType===1){if(n.matches(selector))pending.add(n);n.querySelectorAll(selector).forEach(el=>pending.add(el));}}
  for(const el of pending)capture(el);
 });
 observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['id','data-message-id','data-msg-id','data-index','class','src','srcset','title']});
 window.addEventListener('bubblecast-tiktok-baseline-ready',()=>{if(!stopped)prepare();});
 prepare();heartbeat=setInterval(()=>{if(!stopped&&container()){prepare();send({action:'heartbeat'});}},10000);
})();

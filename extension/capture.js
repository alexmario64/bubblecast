(()=>{
 const platform=location.hostname.includes('twitch')?'twitch':'youtube';
 const selector=platform==='twitch'?'[data-a-target="chat-line-message"],.chat-line__message':'yt-live-chat-text-message-renderer,yt-live-chat-paid-message-renderer,yt-live-chat-membership-item-renderer,yt-live-chat-paid-sticker-renderer';
 const ids=new WeakMap(),sent=new Set(),observed=new WeakMap(),signatures=new WeakMap(),sourceIds=new Map(),sentIds=new Set(),rendered=new Map(),ignoredIds=new Set();let started=false,listening=false,startupTimer=null,startupAt=0;
 const sourceId=el=>el.id||el.getAttribute('data-id')||el.getAttribute('enhancer-message-handled')||'';
 document.documentElement.dataset.bubblecastVersion='1.6.0';
 function send(data,attempt=0){try{chrome.runtime.sendMessage({type:'chat',data:{platform,bridgeVersion:'1.6.0',captureState:listening?'listening':'starting',...data}},reply=>{const error=chrome.runtime.lastError;document.documentElement.dataset.bubblecastBridge=(!error&&reply?.ok)?'connected':'disconnected';if((error||!reply?.ok)&&attempt<4&&data.action!=='heartbeat')setTimeout(()=>send(data,attempt+1),1000*(attempt+1));});}catch{document.documentElement.dataset.bubblecastBridge='reload-needed';}}
 const chatContainer=()=>document.querySelector(platform==='twitch'?'.chat-scrollable-area__message-container,[data-a-target="chat-scroller"]':'yt-live-chat-item-list-renderer #items');
 function ignoreRow(el){const nativeId=sourceId(el),id=ids.get(el)||(nativeId&&sourceIds.get(nativeId))||nativeId||crypto.randomUUID();ids.set(el,id);sent.add(el);sentIds.add(id);ignoredIds.add(id);if(nativeId)sourceIds.set(nativeId,id);while(ignoredIds.size>10000)ignoredIds.delete(ignoredIds.values().next().value);}
 function historyRow(el){if(platform!=='twitch')return false;const welcome=chatContainer()?.querySelector('[data-a-target="chat-welcome-message"]');return !!welcome&&!!(el.compareDocumentPosition(welcome)&Node.DOCUMENT_POSITION_FOLLOWING);}
 function arm(){if(listening)return;chatContainer()?.querySelectorAll(selector).forEach(el=>{if(platform==='youtube'||historyRow(el))ignoreRow(el);});listening=true;document.documentElement.dataset.bubblecastCapture='listening';send({action:'heartbeat'});}
 function prepareStartup(){
  if(listening)return true;
  const container=chatContainer();if(!container)return false;
  if(platform==='twitch'){
   if(container.querySelector('[data-a-target="chat-welcome-message"]')){arm();return true;}
   container.querySelectorAll(selector).forEach(ignoreRow);return false;
  }
  // YouTube populates its first response in multiple DOM batches. Baseline
  // those batches before arming; this is a one-time startup gate, not a chat delay.
  container.querySelectorAll(selector).forEach(ignoreRow);
  const elapsed=Date.now()-startupAt;clearTimeout(startupTimer);startupTimer=setTimeout(arm,Math.max(0,1000-elapsed,Math.min(400,3000-elapsed)));
  return false;
 }
 function mediaSrc(el){let s=el.currentSrc||el.src||el.querySelector('source')?.src||el.getAttribute('src');if(s?.startsWith('//'))s='https:'+s;return s;}
 function walk(node,parts){
 if(node.nodeType===Node.TEXT_NODE){if(node.textContent)parts.push({type:'text',text:node.textContent});return;}
 if(node.nodeType!==Node.ELEMENT_NODE)return;
 if(node.matches('script,style,[hidden],[aria-hidden="true"]:not(img):not(video)'))return;
 if(node.matches('img,video')){const src=mediaSrc(node),alt=node.alt||node.getAttribute('aria-label')||'emote';if(src)parts.push({type:node.tagName==='VIDEO'?'video':'image',src,alt,large:/sticker|gif/i.test(node.className+' '+node.parentElement?.className+' '+alt)});else if(alt)parts.push({type:'text',text:alt});return;}
 if(node.tagName==='BR')parts.push({type:'text',text:'\n'});
 for(const c of node.childNodes)walk(c,parts);
 }
 function rememberIdentity(el){const id=ids.get(el),nativeId=sourceId(el);if(id&&nativeId)sourceIds.set(nativeId,id);}
 const semantic=parts=>parts.map(p=>p.type==='text'?p.text:p.alt||'').join('').replace(/\s+/g,' ').trim();
 function bodyIdentity(el){const user=el.querySelector(platform==='twitch'?'[data-a-target="chat-message-username"],.chat-author__display-name':'#author-name')?.textContent.trim();const body=el.querySelector(platform==='twitch'?'[data-a-target="chat-line-message-body"]':'#message'),parts=[];if(body)walk(body,parts);return {user,parts};}
 function rows(nodes){const result=[];for(const n of nodes)if(n.nodeType===1){if(n.matches(selector))result.push(n);result.push(...n.querySelectorAll(selector));}return result;}
 function inheritReplacement(old,next){
 const id=ids.get(old);if(!id||ids.has(next))return;
 const before=rendered.get(id)||bodyIdentity(old),after=bodyIdentity(next),oldNative=sourceId(old),nextNative=sourceId(next);
 if(oldNative&&nextNative&&oldNative!==nextNative)return;
 if(!before.user||before.user!==after.user||semantic(before.parts)!==semantic(after.parts))return;
 ids.set(next,id);rememberIdentity(next);if(sent.has(old)&&!signatures.has(old))sent.add(next);
 }
 function capture(el){
 rememberIdentity(el);if(!el.isConnected)return;
 const nativeId=sourceId(el);
 const knownId=ids.get(el)||(nativeId&&sourceIds.get(nativeId))||nativeId;
 if(!listening||historyRow(el)||ignoredIds.has(knownId)){ignoreRow(el);return;}
 if(sent.has(el)&&!signatures.has(el)){if(nativeId){sourceIds.set(nativeId,ids.get(el));sentIds.add(ids.get(el));}return;}
 const author=el.querySelector(platform==='twitch'?'[data-a-target="chat-message-username"],.chat-author__display-name':'#author-name'),user=author?.textContent.trim();
 const color=platform==='twitch'&&author?getComputedStyle(author).color:'',rgb=color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
 const userColor=/^#[a-f0-9]{6}$/i.test(color)?color.toLowerCase():rgb?'#'+rgb.slice(1).map(n=>Math.max(0,Math.min(255,Number(n))).toString(16).padStart(2,'0')).join(''):'';
 const body=el.querySelector(platform==='twitch'?'[data-a-target="chat-line-message-body"]':'#message');
 let parts=[];
 if(platform==='twitch'){
 if(body?.matches('[data-a-target="chat-line-message-body"]'))walk(body,parts);
 else {const fragments=el.querySelectorAll('.text-fragment,.chat-line__message--emote,.link-fragment,[data-a-target="emote-name"],img:not(.chat-badge):not([data-a-target="chat-badge"]),video');for(const f of fragments)if(!f.closest('[data-a-target="chat-badge"],.chat-line__username-container')&&![...fragments].some(other=>other!==f&&other.contains(f)))walk(f,parts);}
 }else if(body)walk(body,parts);
 if(platform==='youtube')for(const sticker of el.querySelectorAll('#sticker img'))walk(sticker,parts);
 if(!user||!parts.length)return;
 const badges=[...el.querySelectorAll(platform==='twitch'?'img.chat-badge,[data-a-target="chat-badge"] img':'yt-live-chat-author-badge-renderer img')].map(img=>({src:mediaSrc(img),alt:img.alt||img.title||'badge'}));
 const id=ids.get(el)||(nativeId&&sourceIds.get(nativeId))||nativeId||crypto.randomUUID();ids.set(el,id);if(nativeId)sourceIds.set(nativeId,id);
 const previous=rendered.get(id);if(previous&&semantic(previous.parts)===semantic(parts)&&previous.parts.filter(p=>p.type!=='text').length>parts.filter(p=>p.type!=='text').length)parts=previous.parts;
 const signature=JSON.stringify({user,userColor,parts,badges,nativeId});if(signatures.get(el)===signature)return;const updating=signatures.has(el)||sentIds.has(id);signatures.set(el,signature);sentIds.add(id);
 while(sourceIds.size>10000)sourceIds.delete(sourceIds.keys().next().value);while(sentIds.size>10000)sentIds.delete(sentIds.values().next().value);
 sent.add(el);if(sent.size>3000)sent.delete(sent.values().next().value);
 rendered.set(id,{user,parts,sourceId:nativeId});while(rendered.size>10000)rendered.delete(rendered.keys().next().value);
 send({sourceId:nativeId,observedAt:observed.get(el)||Date.now(),capturedAt:Date.now(),...(updating?{action:'update'}:{}),id,user,userColor,userId:el.getAttribute('author-external-channel-id')||el.querySelector('[data-user-id]')?.getAttribute('data-user-id')||'',parts,badges});
 if(!updating)setTimeout(()=>capture(el),450);
 }
 // Send text promptly. Late badge/emote hydration updates the existing bubble.
 function queue(el){if(!observed.has(el))observed.set(el,Date.now());capture(el);}
 function deleted(el){return el.hasAttribute('is-deleted')||el.matches('.chat-line__message--deleted')||!!el.querySelector('[data-a-target="chat-deleted-message-placeholder"],.deleted-message');}
 const observer=new MutationObserver(mutations=>{
 if(!started){init();return;}
 if(!prepareStartup())return;
 // Bind identities before processing new nodes, even if React already detached the old row.
 for(const m of mutations){const target=m.target.nodeType===1?m.target:m.target.parentElement;const row=target?.closest(selector);if(row)rememberIdentity(row);for(const old of rows(m.removedNodes))rememberIdentity(old);}
 for(const m of mutations){const removed=rows(m.removedNodes),added=rows(m.addedNodes);for(let i=0;i<Math.min(removed.length,added.length);i++)inheritReplacement(removed[i],added[i]);}
 const removals=mutations.filter(m=>m.removedNodes.length),additions=mutations.filter(m=>m.addedNodes.length);for(const r of removals)for(const a of additions){const sameSlot=r.previousSibling===a.previousSibling&&r.nextSibling===a.nextSibling,before=r.previousSibling===a.addedNodes[a.addedNodes.length-1]&&(a.nextSibling===r.removedNodes[0]||a.nextSibling===r.nextSibling),after=r.nextSibling===a.addedNodes[0]&&(a.previousSibling===r.removedNodes[r.removedNodes.length-1]||a.previousSibling===r.previousSibling);if(r!==a&&r.target===a.target&&(sameSlot||before||after)){const removed=rows(r.removedNodes),added=rows(a.addedNodes);for(let i=0;i<Math.min(removed.length,added.length);i++)inheritReplacement(removed[i],added[i]);}}
 for(const m of mutations){
 const target=m.target.nodeType===1?m.target:m.target.parentElement;const row=target?.closest(selector);
 if(row){if(deleted(row)){send({action:'delete',id:ids.get(row)||row.id});}else queue(row);}
 for(const n of m.addedNodes)if(n.nodeType===1){if(n.matches(selector))queue(n);n.querySelectorAll(selector).forEach(queue);}
 }
 });
 // Existing rows and asynchronous history hydration form the baseline.
 function init(){if(started)return;const container=chatContainer();if(!container)return;started=true;startupAt=Date.now();container.querySelectorAll(selector).forEach(ignoreRow);document.documentElement.dataset.bubblecastCapture='starting';send({action:'heartbeat'});if(platform==='youtube')startupTimer=setTimeout(arm,1000);else prepareStartup();}
 // Observe the stable document, since chat scrollers are replaced after startup.
 observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['id','data-id','enhancer-message-handled','is-deleted','class','style','src','srcset']});
 init();setInterval(()=>{init();const c=document.querySelector(platform==='twitch'?'.chat-scrollable-area__message-container,[data-a-target="chat-scroller"]':'yt-live-chat-item-list-renderer #items');if(c)send({action:'heartbeat'});},10000);
})();

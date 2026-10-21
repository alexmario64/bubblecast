importScripts('sources.js');
const sourceManager=new BubblecastSourceManager(chrome);
let pairing=null;
async function pair(){if(!pairing)pairing=(async()=>{const r=await fetch('http://127.0.0.1:3927/api/pair',{signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('Local app unavailable');const {token}=await r.json();await chrome.storage.local.set({token});return token;})().finally(()=>pairing=null);return pairing;}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
 (async()=>{
 if(message.type==='configureSources'){
 if(!/^http:\/\/(?:127\.0\.0\.1|localhost):3927\//.test(sender.url||''))throw Error('Invalid setup origin');
 const result=await sourceManager.configure(message.config);let {token}=await chrome.storage.local.get('token');if(!token)token=await pair();
 const report=()=>fetch('http://127.0.0.1:3927/api/sources/status',{method:'POST',headers:{'Content-Type':'application/json','X-Bubblecast-Token':token},body:JSON.stringify({...result,version:'1.6.0'}),signal:AbortSignal.timeout(5000)});
 let r=await report();if(r.status===401){token=await pair();r=await report();}return result;
 }
 if(message.type==='pair'){
 if(!/^http:\/\/(?:127\.0\.0\.1|localhost):3927\//.test(sender.url||''))throw Error('Invalid pairing origin');
 const previous=await chrome.storage.local.get('token');const current=await pair();return {ok:true,reconnected:previous.token!==current};
 }
 if(message.type!=='chat'||!/^https:\/\/www\.(?:twitch\.tv|youtube\.com|tiktok\.com)\//.test(sender.url||''))throw Error('Invalid source');
 const sourceKey=await sourceManager.sourceKey(message.data?.platform,sender.tab?.id);if(!sourceKey)return {ok:true,ignored:true};
 let {token}=await chrome.storage.local.get('token');if(!token)token=await pair();
 const post=token=>fetch('http://127.0.0.1:3927/api/bridge',{method:'POST',headers:{'Content-Type':'application/json','X-Bubblecast-Token':token},body:JSON.stringify({...message.data,sourceKey}),signal:AbortSignal.timeout(7000)});
 let r=await post(token);if(r.status===401)r=await post(await pair());
 return {ok:r.ok,error:r.ok?undefined:'Local app returned '+r.status};
 })().then(reply).catch(e=>reply({ok:false,error:e.message}));return true;
});
// Tab IDs belong to a browser session. Starting Chrome never starts chat.
chrome.runtime.onStartup?.addListener(()=>{chrome.storage.local.set({managedTabs:{}}).catch(()=>{});});

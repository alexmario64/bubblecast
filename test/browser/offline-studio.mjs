// Synthetic Studio data and local assets only. Used by screenshots while a real helper is running,
// so no page can reach its account sessions, settings, or any live platform.
import {readFile} from 'node:fs/promises';
import {Subathon} from '../../subathon.mjs';
import {defaults} from '../../core.mjs';
import {diagnosticSnapshot} from '../../diagnostics.mjs';
const root=new URL('../../',import.meta.url);
export async function offlineStudio(page,{language='en',scenario=''}={}){
 let unavailable=scenario==='unavailable';const now=Date.now(),sources={enabled:true,configured:true,twitchChannel:'example',tiktokChannel:'example',kickChannel:'example',urls:{twitch:'t',youtube:'',tiktok:'t',kick:'k'}};
 const collector={active:true,version:'1.33.7',accounts:{tiktok:{signedIn:false}},feeds:{tiktok:{transport:'page',startup:'painted'},kick:{transport:'network'}}};
 const traffic={twitch:{received:42,displayed:40,lastMessageAt:now},youtube:{received:0,displayed:0},tiktok:{received:0,displayed:0},kick:{received:7,displayed:7,lastMessageAt:now}};
 const youtube={configured:true,connected:true,channel:{title:'Example'},chats:{},discovery:{state:'complete',startedAt:now-2000,finishedAt:now,found:0}};
 if(scenario==='key-matches'){youtube.candidates=[{video:'mmmmmmmmmmm',title:'Main stream',live:true,format:'horizontal',formatSource:'obs-main'},{video:'vvvvvvvvvvv',title:'Vertical stream',live:true,format:'vertical',formatSource:'aitum-vertical'},{video:'sssssssssss',title:'Scheduled stream',live:false,format:'',formatSource:'unknown'}];}
 if(scenario==='no-app'){Object.assign(youtube,{configured:false,connected:false,readMode:'page',channel:null});sources.youtubeChannel='@example';sources.youtubeLive='https://www.youtube.com/@example/live';}
 const diagnostics=diagnosticSnapshot({sources,collector,traffic,youtube,twitchChatReady:true,obs:{checkedAt:now,websocket:'unavailable',browserAt:now,browserStreaming:true},trigger:{reason:'stream-start',route:scenario==='no-app'?'page':'api',at:now-2000,blocked:'none',series:{state:'scheduled',attempt:1,startedAt:now-20000,nextAt:now+40000,expected:{horizontal:true,vertical:true}}}},now);
 const subathon=new Subathon().snapshot();Object.assign(subathon,{status:'paused',remainingMs:30963000,counters:{subscriptions:128,bits:7420,money:80.85,tiktokGifts:42,kicks:500},addedMs:38880000,goals:[{id:'demo-goal-one',title:'Community game night',metric:'subscriptions',target:100},{id:'demo-goal-two',title:'Choose the next challenge',metric:'bits',target:10000},{id:'demo-goal-three',title:'A special celebration',metric:'money',target:500}]});
 const status={settings:{...defaults,language},sources,collector,traffic,bridge:{},youtube,diagnostics,update:{current:'1.33.7'}};
 // A fulfilled SSE response ends immediately. Keep the synthetic connection open in memory,
 // so screenshots represent a healthy server instead of a recurring EOF/reconnect error.
 await page.addInitScript(({settings,subathon})=>{
  window.EventSource=class extends EventTarget{
   static CONNECTING=0;static OPEN=1;static CLOSED=2;
   constructor(){super();this.readyState=0;setTimeout(()=>{if(this.readyState===2)return;this.readyState=1;this.dispatchEvent(new Event('open'));for(const [type,value] of Object.entries({settings,subathon,heartbeat:{at:Date.now()}}))this.dispatchEvent(new MessageEvent(type,{data:JSON.stringify(value)}));},0);this.timer=setInterval(()=>this.dispatchEvent(new MessageEvent('heartbeat',{data:JSON.stringify({at:Date.now()})})),15000);}
   close(){this.readyState=2;clearInterval(this.timer);}
  };
 },{settings:status.settings,subathon});
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin!=='http://127.0.0.1:3927')return route.abort('blockedbyclient');
  const path=url.pathname;
  if(path==='/api/status'&&unavailable)return route.fulfill({status:503,json:{error:'Fixture server unavailable'}});
  if(path==='/api/events')return route.fulfill({contentType:'text/event-stream',body:'event: settings\ndata: '+JSON.stringify(status.settings)+'\n\nevent: subathon\ndata: '+JSON.stringify(subathon)+'\n\n'});
  if(path.startsWith('/api/'))return route.fulfill({json:path==='/api/subathon'?subathon:path==='/api/status'?status:path==='/api/pair'?{token:'offline-fixture'}:path==='/api/settings'?status.settings:path==='/api/sources'?sources:path==='/api/apps'?{}:path==='/api/polls'?{polls:[]}:path==='/api/emotes'?{emotes:{}}:path.startsWith('/api/tts/')?{voices:[]}: {}});
  const alias={'/':'public/index.html','/core.mjs':'core.mjs','/logos/twitch.png':'logos/twitch-purple-logo-png-transparent.png','/logos/youtube.png':'logos/Youtube_logo.png','/tts':'public/tts.html','/dock':'public/dock.html','/overlay':'public/overlay.html','/poll-overlay':'public/poll-overlay.html','/subathon-overlay':'public/subathon-overlay.html'};
  const target=new URL(alias[path]||(path.startsWith('/logos/')?'public/'+path.split('/').at(-1):'public'+path),root);
  if(!target.href.startsWith(root.href))return route.abort('blockedbyclient');
  try{const body=await readFile(target),ext=target.pathname.split('.').at(-1);return route.fulfill({body,contentType:{html:'text/html',js:'text/javascript',mjs:'text/javascript',css:'text/css',svg:'image/svg+xml',png:'image/png',ttf:'font/ttf'}[ext]||'application/octet-stream'});}catch{return route.fulfill({status:404,body:'Offline fixture asset missing'});}
 });
 return {setUnavailable:value=>{unavailable=value;}};
}

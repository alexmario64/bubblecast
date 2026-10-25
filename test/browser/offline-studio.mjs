// Synthetic Studio data and local assets only. Used by screenshots while a real helper is running,
// so no page can reach its account sessions, settings, or any live platform.
import {readFile} from 'node:fs/promises';
import {defaults} from '../../core.mjs';
import {diagnosticSnapshot} from '../../diagnostics.mjs';
const root=new URL('../../',import.meta.url);
export async function offlineStudio(page,{language='en'}={}){
 const now=Date.now(),sources={enabled:true,configured:true,twitchChannel:'example',tiktokChannel:'example',kickChannel:'example',urls:{twitch:'t',youtube:'',tiktok:'t',kick:'k'}};
 const collector={active:true,version:'1.33.3',accounts:{tiktok:{signedIn:false}},feeds:{tiktok:{transport:'page'},kick:{transport:'network'}}};
 const traffic={twitch:{received:42,displayed:40,lastMessageAt:now},youtube:{received:0,displayed:0},tiktok:{received:0,displayed:0},kick:{received:7,displayed:7,lastMessageAt:now}};
 const youtube={configured:true,connected:true,channel:{title:'Example'},chats:{},discovery:{state:'complete',startedAt:now-2000,finishedAt:now,found:0}};
 const diagnostics=diagnosticSnapshot({sources,collector,traffic,youtube,twitchChatReady:true,obs:{checkedAt:now,websocket:'unavailable',browserAt:now,browserStreaming:true},trigger:{reason:'stream-start',route:'api',at:now-2000}},now);
 const status={settings:{...defaults,language},sources,collector,traffic,bridge:{},youtube,diagnostics,update:{current:'1.33.3'}};
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin!=='http://127.0.0.1:3927')return route.abort('blockedbyclient');
  const path=url.pathname;
  if(path==='/api/events')return route.fulfill({contentType:'text/event-stream',body:'event: settings\ndata: '+JSON.stringify(defaults)+'\n\n'});
  if(path.startsWith('/api/'))return route.fulfill({json:path==='/api/status'?status:path==='/api/pair'?{token:'offline-fixture'}:path==='/api/settings'?defaults:path==='/api/apps'?{}:path==='/api/polls'?{polls:[]}:path==='/api/emotes'?{emotes:{}}:path.startsWith('/api/tts/')?{voices:[]}: {}});
  const alias={'/':'public/index.html','/core.mjs':'core.mjs','/logos/twitch.png':'logos/twitch-purple-logo-png-transparent.png','/logos/youtube.png':'logos/Youtube_logo.png','/tts':'public/tts.html','/dock':'public/dock.html','/overlay':'public/overlay.html','/poll-overlay':'public/poll-overlay.html'};
  const target=new URL(alias[path]||(path.startsWith('/logos/')?'public/'+path.split('/').at(-1):'public'+path),root);
  if(!target.href.startsWith(root.href))return route.abort('blockedbyclient');
  try{const body=await readFile(target),ext=target.pathname.split('.').at(-1);return route.fulfill({body,contentType:{html:'text/html',js:'text/javascript',mjs:'text/javascript',css:'text/css',svg:'image/svg+xml',png:'image/png',ttf:'font/ttf'}[ext]||'application/octet-stream'});}catch{return route.fulfill({status:404,body:'Offline fixture asset missing'});}
 });
}

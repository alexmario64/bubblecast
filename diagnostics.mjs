import {mkdir,stat,rename,rm,appendFile} from 'node:fs/promises';
import {dirname} from 'node:path';

const platforms=['twitch','youtube','tiktok','kick'];
const count=n=>Number.isFinite(n)&&n>=0?Math.min(Math.round(n),Number.MAX_SAFE_INTEGER):0;
const recent=(at,now,age)=>count(at)>0&&now>=at&&now-at<age;
const choice=(value,allowed,fallback)=>allowed.includes(value)?value:fallback;
export function discoveryStatus(d={}){d??={};return {state:choice(d.state,['idle','checking','complete','error'],'idle'),startedAt:count(d.startedAt),finishedAt:count(d.finishedAt),found:Math.min(count(d.found),2)};}

// This is a strict allowlist, not a redactor. Never copy arbitrary errors, URLs, account names,
// message IDs/text, cookies, OBS settings or stream-key fields into diagnostics or its log.
export function diagnosticSnapshot({version='',sources={},collector={},traffic={},bridge={},twitch={},twitchChatReady=false,youtube={},kick={},obs={},trigger={},clients=0,renderTiming={}}={},now=Date.now()){
 const helper=collector.active===true,enabled=sources.enabled!==false,urls=sources.urls||{};
 const rows=Object.fromEntries(platforms.map(p=>{
  const official={twitch,youtube,kick}[p],account=collector.accounts?.[p],feed=helper?collector.feeds?.[p]:null;
  const configured=enabled&&!!(urls[p]||p==='youtube'&&(urls.youtubeShorts||sources.youtubeChannel||youtube.connected));
  const receiving=configured&&recent(traffic[p]?.lastMessageAt,now,60000),capture=helper&&!!collector.errors?.[p]||!!feed?.error||!!feed?.polling?.error||feed?.startup==='failed';
  const hasError=!!official?.error||!!capture;
  const reading=p==='youtube'&&!['page','signin'].includes(youtube.readMode)&&Object.values(youtube.chats||{}).some(c=>c.reading??c.live);
  const route=!configured?'none':p==='twitch'?'irc':reading?'api':feed?choice(feed.transport,['network','page'],'page'):'none';
  const session=official?(official.connected?'signed-in':'signed-out'):choice(account?.signedIn,[true,false],null)===null?'unknown':account.signedIn?'signed-in':'signed-out';
  const state=!enabled?'disabled':!configured?'not-configured':capture?'error':receiving?'receiving':hasError?'error':p==='youtube'&&youtube.configured&&!youtube.connected?'signin-required':p==='twitch'&&twitchChatReady||reading?'connected':['tiktok','kick'].includes(p)&&!helper?'helper-offline':p==='tiktok'&&account?.signedIn===false?'signin-required':'waiting';
  return [p,{state,route,session,startup:p==='tiktok'?choice(feed?.startup,['painting','painted','failed','user-opened'],'not-started'):null,hasError,heartbeat:configured&&recent(bridge[p],now,25000),received:count(traffic[p]?.received),displayed:count(traffic[p]?.displayed),lastMessageAt:count(traffic[p]?.lastMessageAt)}];
 }));
 const ws=recent(obs.checkedAt,now,45000)?choice(obs.websocket,['ready','unavailable'],'unavailable'):'not-checked',browser=recent(obs.browserAt,now,75000);
 const detection={websocket:ws,browser,browserStreaming:browser?obs.browserStreaming===true:null,websocketMain:ws==='ready'?obs.main===true:null,main:browser&&(ws!=='ready'||obs.browserAt>=obs.checkedAt)?obs.browserStreaming===true:ws==='ready'?obs.main===true:null,vertical:ws==='ready'&&obs.verticalDetected?obs.vertical===true:null,path:ws==='ready'?(browser?'both':'websocket'):browser?'browser':'none'};
 const api=discoveryStatus(youtube.discovery),page=discoveryStatus(collector.youtubeDiscovery),series=trigger.series||{};
 const bounded={state:choice(series.state,['idle','scheduled','checking','complete','exhausted','stopped'],'idle'),attempt:Math.min(count(series.attempt),4),startedAt:count(series.startedAt),nextAt:count(series.nextAt),expected:{horizontal:series.expected?.horizontal===true,vertical:series.expected?.vertical===true}};
 const blocked=choice(trigger.blocked,['none','disabled','manual-links','signin-required','missing-channel','helper-offline'],'none');
 const slot=k=>enabled&&!!(sources.youtubeFound?.some(f=>f.slot===k)||/\/live_chat\?v=[\w-]{11}(?:&|$)/.test(urls[k]||''));
 const safeVersion=v=>typeof v==='string'&&/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(v)?v:null;
 return {version:safeVersion(version),helperVersion:safeVersion(collector.version),helper,platforms:rows,obs:detection,youtube:{app:youtube.configured===true,connected:youtube.connected===true,quotaExhausted:count(youtube.quotaUntil)>now,channel:!!(sources.youtubeChannel||youtube.channel),slots:{horizontal:slot('youtube'),vertical:slot('youtubeShorts')},series:bounded,blocked,trigger:choice(trigger.reason,['stream-start','dock-send','manual'],'none'),triggerAt:count(trigger.at),route:choice(trigger.route,['api','page'],'none'),api,page},overlays:{clients:count(clients),lastPaint:Object.fromEntries(['overlay','vertical','webcam','dock'].map(view=>[view,Math.max(0,...platforms.map(p=>count(renderTiming[view]?.[p]?.updatedAt)))]))}};
}

export class Diagnostics{
 constructor({file,now=Date.now,maxBytes=1024*1024,sampleMs=60000}={}){Object.assign(this,{file,now,maxBytes,sampleMs});this.previous='';this.lastWrite=0;this.error=false;this.busy=false;}
 snapshot(input){return {...diagnosticSnapshot(input,this.now()),log:{error:this.error}};}
 async record(input){
  if(this.busy)return;const now=this.now(),snapshot=diagnosticSnapshot(input,now);
  // Counters and paint timestamps are sampled once a minute; connection changes are logged immediately.
  const stable=JSON.stringify({...snapshot,platforms:Object.fromEntries(platforms.map(p=>{const {received,displayed,lastMessageAt,...row}=snapshot.platforms[p];return [p,row];})),overlays:{clients:snapshot.overlays.clients}});
  if(stable===this.previous&&now-this.lastWrite<this.sampleMs)return;
  this.busy=true;
  try{
   const line=JSON.stringify({at:new Date(now).toISOString(),...snapshot})+'\n';
   await mkdir(dirname(this.file),{recursive:true});
   let size=0;try{size=(await stat(this.file)).size;}catch(e){if(e.code!=='ENOENT')throw e;}
   if(size&&size+Buffer.byteLength(line)>this.maxBytes){await rm(this.file+'.1',{force:true});await rename(this.file,this.file+'.1');}
   await appendFile(this.file,line,{mode:0o600});this.previous=stable;this.lastWrite=now;this.error=false;
  }catch{this.error=true;}finally{this.busy=false;}
 }
}

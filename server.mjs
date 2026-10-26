import {OutputStarts,pageCandidates} from './youtube-slot-matching.mjs';
import {YouTubeDiscovery} from './youtube-discovery.mjs';
import {Diagnostics,discoveryStatus} from './diagnostics.mjs';
import {Outbox,destinations} from './outbox.mjs';
import {TwitchOfficial} from './twitch-official.mjs';
import {TwitchLive} from './twitch-live.mjs';
import {YouTubeOfficial,sourceKeys as youtubeKeys,assignSlots} from './youtube-official.mjs';
import {YouTubeMerge} from './youtube-merge.mjs';
import {KickOfficial} from './kick-official.mjs';
import {AppKeys} from './app-keys.mjs';
import {PollJobs,PollEndJobs,pollDestinations} from './poll-jobs.mjs';
import {PollStore} from './polls.mjs';
import http from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,extname} from 'node:path';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {settings,normalize} from './core.mjs';
import {setupObs,obsStreams} from './obs.mjs';
import {addObsDock} from './obs-dock.mjs';
import {Updates} from './updates.mjs';
import {Speech} from './tts.mjs';
import {NaturalVoices} from './natural-voices.mjs';
import {MessageRelay} from './relay.mjs';
import {sourceConfig,withFoundVideos,withAccountChannels} from './source-config.mjs';
import {DockHistory} from './dock-history.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));
// Where settings, channels and sign-ins are saved: next to the code when run from the repo, and in the
// user's app data folder when installed (set by the packaged helper), since the install folder is read-only.
const dataDir=process.env.BUBBLECAST_DATA||root;
const diagnostics=new Diagnostics({file:join(dataDir,'.local','diagnostics.log')});
let state=settings();try{state=settings(JSON.parse(await readFile(join(dataDir,'settings.json'),'utf8')));}catch{}
let sources={configured:false,enabled:true,twitchChannel:'',youtubeVideo:'',youtubeShortsVideo:'',tiktokChannel:'',kickChannel:'',urls:{twitch:'',youtube:'',youtubeShorts:'',tiktok:'',kick:''}},sourceStatus={version:null,twitch:false,youtube:false,youtubeShorts:false,tiktok:false,kick:false,updatedAt:0};// savedSources is what the streamer entered; sources adds account channels and discovered YouTube streams.
let savedSources=sources;try{sources=savedSources=sourceConfig(JSON.parse(await readFile(join(dataDir,'sources.json'),'utf8')));}catch{}
const token=randomBytes(24).toString('hex'),clients=new Set(),relay=new MessageRelay(),dockHistory=new DockHistory();
// Text to speech: spoken chat goes only to the /tts pages, not into the dock history.
const natural=new NaturalVoices({dir:join(dataDir,'.local','piper')});
const speech=new Speech({natural,onCooldown:c=>rewardSync.pauseFor(c),emit:(type,data)=>{const frame=`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;for(const r of clients)r.write(frame);}});
const outbox=new Outbox(),pollJobs=new PollJobs(),pollEndJobs=new PollEndJobs();let collectorWaiter=null;
function queueCollector(command){if(collectorCommands.length>=64)throw Error('Capture command queue is busy.');collectorCommands.push(command);collectorWaiter?.();}
let collector={updatedAt:0,version:null,errors:{}},collectorCommands=[];
const polls=new PollStore();
const pollFile=join(dataDir,'.local','polls.json');
try{const saved=JSON.parse(await readFile(pollFile,'utf8'));if(JSON.stringify(saved.urls)===JSON.stringify(sources.urls)&&Date.now()-saved.savedAt<86400000)for(const poll of saved.polls||[])if(!['completed','terminated','closed','unavailable'].includes(poll.status))polls.accept(poll);}catch{}
async function savePolls(){await mkdir(join(dataDir,'.local'),{recursive:true});await writeFile(pollFile,JSON.stringify({urls:sources.urls,savedAt:Date.now(),polls:polls.snapshot()}));}
const renderTiming={overlay:{},vertical:{},webcam:{},dock:{}};
const collectorActive=()=>Date.now()-collector.updatedAt<15000;
let bridge={twitch:0,youtube:0,tiktok:0,kick:0},catalog={},catalogAt=0,catalogErrors=[];
const traffic={kick:{received:0,displayed:0,lastMessageAt:0,bridgeVersion:'unknown',lastRelayMs:null},tiktok:{received:0,displayed:0,lastMessageAt:0,bridgeVersion:'unknown',lastRelayMs:null},twitch:{received:0,displayed:0,lastMessageAt:0,bridgeVersion:'unknown',lastRelayMs:null},youtube:{received:0,displayed:0,lastMessageAt:0,bridgeVersion:'unknown',lastRelayMs:null}};
function emit(type,data){if(type==='message'&&state.ttsEnabled){const m=normalize(data,state);if(m)speech.consider(m,state);}dockHistory.accept(type,data);const frame=`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;for(const r of clients)r.write(frame);}
async function emotes(){if(Date.now()-catalogAt<300000)return {emotes:catalog,errors:catalogErrors};const result={};let errors=[];
 for(const url of ['https://api.betterttv.net/3/cached/emotes/global',...(state.twitchId?[`https://api.betterttv.net/3/cached/users/twitch/${state.twitchId}`]:[])]){try{const r=await fetch(url,{signal:AbortSignal.timeout(7000)});if(!r.ok)throw Error(String(r.status));const j=await r.json();for(const e of Array.isArray(j)?j:[...(j.channelEmotes||[]),...(j.sharedEmotes||[])])result[e.code]=`https://cdn.betterttv.net/emote/${e.id}/3x`;}catch(e){errors.push(e.message);}}
 catalog=result;catalogErrors=errors;catalogAt=Date.now();return {emotes:result,errors};}
const server=http.createServer(async(req,res)=>{
 if(!/^(?:127\.0\.0\.1|localhost):3927$/.test(req.headers.host||'')){res.writeHead(403);return res.end('Host denied');}
 const u=new URL(req.url,'http://127.0.0.1:3927');const origin=req.headers.origin;
 if(origin&&origin!=='http://127.0.0.1:3927'&&origin!=='http://localhost:3927'&&!origin.startsWith('chrome-extension://')){res.writeHead(403);return res.end('Origin denied');}
 if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
 res.setHeader('Access-Control-Allow-Headers','Content-Type, X-Bubblecast-Token');res.setHeader('Cache-Control','no-store');
 if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
 const json=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
 try{
 if(u.pathname==='/oauth/youtube/callback'||u.pathname==='/oauth/kick/callback'){const kickSign=u.pathname.includes('kick');let message=(kickSign?'Kick':'YouTube')+' is connected. You can close this tab and return to Bubblecast.';try{await (kickSign?kick:youtube).callback(u.searchParams);}catch(e){message=e.message;}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Referrer-Policy':'no-referrer','Cache-Control':'no-store'});return res.end('<!doctype html><meta charset=utf-8><title>Bubblecast</title><body style="font:16px system-ui;padding:40px;color:#333"><h1 style="font-size:22px">Bubblecast</h1><p>'+message.replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))+'</p>');}
 if(u.pathname==='/fonts/komika-axis.ttf'){
 const candidates=[join(process.env.LOCALAPPDATA||'','Microsoft','Windows','Fonts'),join(process.env.WINDIR||'C:/Windows','Fonts'),join(process.env.HOME||'','Library','Fonts'),'/Library/Fonts'].flatMap(dir=>['KOMIKAX.ttf','KOMIKAX_.ttf'].map(file=>join(dir,file)));for(const path of candidates){try{const font=await readFile(path);res.writeHead(200,{'Content-Type':'font/ttf','Cache-Control':'private, max-age=86400'});return res.end(font);}catch{}}return json({error:'Install Komika Axis for this user account.'},404);
 }
 if(u.pathname==='/api/events'){res.writeHead(200,{'Content-Type':'text/event-stream','Connection':'keep-alive'});res.write(`event: settings\ndata: ${JSON.stringify(state)}\n\n`);res.write('event: polls\ndata: '+JSON.stringify(polls.snapshot())+'\n\n');res.write('event: tts-cooldown\ndata: '+JSON.stringify(speech.cooldown(state))+'\n\n');res.write('event: heartbeat\ndata: '+JSON.stringify({at:Date.now()})+'\n\n');clients.add(res);req.on('close',()=>clients.delete(res));return;}
 if(u.pathname==='/api/polls'&&req.method==='GET')return json({polls:polls.snapshot()});
 if(u.pathname==='/api/status')return json({diagnostics:diagnostics.snapshot(diagnosticInput()),bridge,traffic,settings:state,sources,sourceStatus,renderTiming,twitch:twitch.status(),youtube:youtube.status(),kick:kick.status(),update:updates.status(),tts:{error:speech.error,queued:speech.queue.length,rewardsReady:twitch.redemptionsReady,canManage:twitch.canManageRewards,reward:rewardSync.status},collector:{...collector,active:collectorActive(),viewers:{...collector.viewers,...youtube.viewers,...(twitch.viewers?{twitch:twitch.viewers}:{}),...(kick.viewers?{kick:kick.viewers}:{})}}});
 if(u.pathname==='/api/collector/commands'&&req.method==='GET'){if(req.headers['x-bubblecast-token']!==token)return json({error:'Pair the capture app.'},401);const deliver=()=>{const commands=collectorCommands.map(c=>c.action==='send'?{action:'send',job:forHelper(outbox.claim(c.id),'send')}:c.action==='create-poll'?{action:'create-poll',job:forHelper(pollJobs.claim(c.id))}:c.action==='end-poll'?{action:'end-poll',job:forHelper(pollEndJobs.claim(c.id))}:c).filter(c=>!['send','create-poll','end-poll'].includes(c.action)||c.job);collectorCommands=[];json({commands});};if(collectorCommands.length||u.searchParams.get('wait')!=='1'){deliver();return;}if(collectorWaiter)return json({error:'Collector already listening'},409);const done=()=>{if(collectorWaiter!==done)return;collectorWaiter=null;clearTimeout(timer);deliver();};const timer=setTimeout(done,25000);collectorWaiter=done;res.on('close',()=>{if(collectorWaiter===done){collectorWaiter=null;clearTimeout(timer);}});return;}
 if(u.pathname==='/api/chat/history'&&req.method==='GET')return json({messages:dockHistory.snapshot(state)});
 if(u.pathname==='/api/sources'&&req.method==='GET')return json({...sources,urls:{...sources.urls,twitch:''},captureMode:collectorActive()?'desktop':'chrome'});
 if(u.pathname==='/api/pair'&&req.method==='GET')return json({token});
 if(u.pathname==='/api/tts/natural'&&req.method==='GET')return json({supported:natural.supported,voices:await natural.list()});
 if(u.pathname==='/api/tts/voices'&&req.method==='GET')return json({voices:await speech.voices(),error:speech.error});
 if(u.pathname.startsWith('/api/tts/audio/')&&req.method==='GET'){const file=speech.file(u.pathname.slice(15));if(!file)return json({error:'Gone'},404);try{const audio=await readFile(file);res.writeHead(200,{'Content-Type':'audio/wav','Content-Length':audio.length});return res.end(audio);}catch{return json({error:'Gone'},404);}}
 if(u.pathname==='/api/apps'&&req.method==='GET')return json(appKeys.public());
 if(u.pathname==='/api/emotes')return json(await emotes());
 if(req.method==='POST'||req.method==='PATCH'&&['/api/settings','/api/sources'].includes(u.pathname)){
 if(req.headers['x-bubblecast-token']!==token)return json({error:'Pair the bridge from the setup screen.'},401);
 let body='';for await(const c of req){body+=c;if(body.length>100000){json({error:'Too large'},413);req.destroy();return;}}
 const data=JSON.parse(body||'{}');
 if(u.pathname==='/api/twitch/connect')return json(await twitch.startSignIn());
 if(u.pathname==='/api/youtube/connect'){const sign=youtube.startSignIn();if(data.browser)openBrowser(sign.url);return json(sign);}
 if(u.pathname==='/api/youtube/check'){await checkYouTube('manual');return json({ok:true,discovery:discovery.status(),blocked:discoveryBlocked()});}
 if(u.pathname==='/api/youtube/stream'){await youtube.choose(String(data.video||''),String(data.choice||''));return json(youtube.status());}
 if(u.pathname==='/api/youtube/disconnect'){await youtube.disconnect();return json({ok:true});}
 if(u.pathname==='/api/kick/connect'){if(!collectorActive()||!collector.kickConnect)return json({error:'Start the updated background helper to connect Kick for chat and polls.'},409);if(collectorCommands.length>=64)return json({error:'Capture command queue is busy.'},429);const sign=kick.startSignIn();queueCollector({action:'kick-connect',url:sign.url});return json({helper:true});}
 if(u.pathname==='/api/kick/disconnect'){await kick.disconnect();return json({ok:true});}
 if(u.pathname==='/api/apps'){const keys=await appKeys.set(data.platform,data);const target=data.platform==='kick'?kick:youtube;if(target.setApp(keys)&&target.connected)await target.forget();refreshSources();return json(appKeys.public());}
 if(u.pathname==='/api/twitch/disconnect'){await twitch.disconnect();return json({ok:true});}
 if(u.pathname==='/api/polls/create'){if(origin?.startsWith('chrome-extension://'))return json({error:'Use the dock poll composer.'},403);const helperNeeded=helperTargets(data);if(helperNeeded&&(!collectorActive()||!collector.pollCreation))return json({error:'Restart the updated background helper before creating polls.'},409);if(collectorCommands.length>=64)return json({error:'Capture command queue is busy.'},429);const {job,fresh}=pollJobs.enqueue(data,sources.enabled?sources.urls:{},polls.snapshot());if(fresh){if(job.urls.twitch)pollJobs.result(job.id,'twitch',await twitch.createPoll(job.spec));for(const key of youtubeKeys)if(job.urls[key])pollJobs.result(job.id,key,await youtube.createPoll(key,job.spec));if(helperNeeded)queueCollector({action:'create-poll',id:job.id});}return json(pollJobs.public(job));}
 if(u.pathname==='/api/polls/end'){if(origin?.startsWith('chrome-extension://'))return json({error:'Use the dock poll controls.'},403);const helperNeeded=helperTargets(data);if(helperNeeded&&(!collectorActive()||!collector.pollCreation))return json({error:'Background helper is unavailable.'},409);if(collectorCommands.length>=64)return json({error:'Capture command queue is busy.'},429);const {job,fresh}=pollEndJobs.enqueue(data,sources.enabled?sources.urls:{},polls.snapshot());if(fresh){if(job.polls.twitch)pollEndJobs.result(job.id,'twitch',await twitch.endPoll(job.polls.twitch.id));for(const key of youtubeKeys)if(job.polls[key])pollEndJobs.result(job.id,key,await youtube.endPoll(key,job.polls[key].id));if(helperNeeded)queueCollector({action:'end-poll',id:job.id});}return json(pollEndJobs.public(job));}
 if(u.pathname==='/api/polls/end/status')return json(pollEndJobs.public(pollEndJobs.get(data.id))||{error:'Poll status expired.'});
 if(u.pathname==='/api/polls/end/result'){for(const key of pollDestinations)if(data.results?.[key])pollEndJobs.result(data.id,key,data.results[key]);return json({ok:true});}
 if(u.pathname==='/api/polls/create/status')return json(pollJobs.public(pollJobs.get(data.id))||{error:'Poll status expired.'});
 if(u.pathname==='/api/polls/create/result'){for(const key of pollDestinations)if(data.results?.[key])pollJobs.result(data.id,key,data.results[key]);return json({ok:true});}
 if(u.pathname==='/api/chat/send'){if(Array.isArray(data.targets)&&data.targets.some(k=>String(k).startsWith('youtube')))checkYouTube('dock-send').catch(()=>{});if(origin?.startsWith('chrome-extension://'))return json({error:'Use the Bubblecast dock to send messages.'},403);if(collectorCommands.length>=64)return json({error:'Capture command queue is busy.'},429);const official=sendOfficial(),helperNeeded=helperTargets(data,official);if(helperNeeded&&(!collectorActive()||!/^1\.(?:[89]|[1-9]\d)\./.test(collector.version||'')))return json({error:'Start or update the Bubblecast background helper to send messages.'},409);const {job,fresh}=outbox.enqueue(data,sources.enabled?sources.urls:{});if(fresh){job.official=[...official];if(job.urls.twitch)outbox.result(job.id,'twitch',await twitch.sendChat(job.text));for(const key of youtubeKeys)if(job.urls[key])outbox.result(job.id,key,await youtube.sendChat(key,job.text));if(job.urls.kick&&job.official.includes('kick'))outbox.result(job.id,'kick',await kick.sendChat(job.text));if(helperNeeded)queueCollector({action:'send',id:job.id});}return json(outbox.public(job));}
 if(u.pathname==='/api/chat/send/status')return json(outbox.public(outbox.get(data.id))||{error:'Message status expired.'});
 if(u.pathname==='/api/chat/send/result'){const results=data.results||{};for(const target of destinations)if(results[target])outbox.result(data.id,target,results[target]);return json({ok:true});}
 if(u.pathname==='/api/render-timing'){if(!Object.hasOwn(renderTiming,data.view)||!['twitch','youtube','tiktok','kick'].includes(data.platform))return json({error:'Invalid timing source'},400);const key=data.platform==='youtube'&&data.sourceKey==='youtubeShorts'?'youtubeShorts':data.platform,previous=renderTiming[data.view][key];if(data.mediaMs!=null&&previous&&previous.messageId!==data.messageId)return json({ok:true,ignored:true});const entry=previous?.messageId===data.messageId?{...previous}:{};entry.messageId=String(data.messageId||'').slice(0,200);for(const field of ['paintMs','mediaMs'])if(Number.isFinite(data[field])&&data[field]>=0&&data[field]<=60000)entry[field]=Math.round(data[field]);entry.updatedAt=Date.now();renderTiming[data.view][key]=entry;return json({ok:true});}
 if(u.pathname==='/api/sources'){const saved=sourceConfig(req.method==='PATCH'?{...savedSources,...data}:data);if(['youtubeChannel','youtubeVideo','youtubeShortsVideo','enabled'].some(k=>saved[k]!==savedSources[k])){pageFound=[];pageFoundAt=0;pageCheck=null;}const next=resolvedSources(savedSources=saved),changed=JSON.stringify(next.urls)!==JSON.stringify(sources.urls);sources=next;sourceStatus={version:null,twitch:false,youtube:false,youtubeShorts:false,tiktok:false,kick:false,updatedAt:0};await writeFile(join(dataDir,'sources.json'),JSON.stringify(savedSources,null,2));if(changed){emit('clear',{});polls.clear();await savePolls();emit('polls',[]);}emit('sources',sources);configureTwitch();configureYouTube();configureKick();return json(sources);}
 if(u.pathname==='/api/collector/status'){const wasActive=collectorActive();collector={youtubeDiscovery:discoveryStatus(data.youtubeDiscovery),updatedAt:data.active===true?Date.now():0,pollCreation:data.pollCreation===true,kickConnect:data.kickConnect===true,version:String(data.version||'').slice(0,20),audio:data.audio?{pages:Math.max(0,Number(data.audio.pages)||0),unmuted:Math.max(0,Number(data.audio.unmuted)||0)}:null,viewers:Object.fromEntries(destinations.filter(k=>data.viewers?.[k]&&typeof data.viewers[k]==='object').map(k=>{const v=data.viewers[k];return [k,{live:typeof v.live==='boolean'?v.live:null,viewers:Number.isFinite(v.viewers)&&v.viewers>=0?Math.round(v.viewers):null,updatedAt:Number.isFinite(v.updatedAt)?v.updatedAt:0,error:v.error?String(v.error).slice(0,120):null}];})),accounts:Object.fromEntries(destinations.filter(k=>data.accounts?.[k]).map(k=>{const a=data.accounts[k];return [k,{state:['ready','signed-out','unavailable'].includes(a.state)?a.state:'unavailable',signedIn:typeof a.signedIn==='boolean'?a.signedIn:null,canSend:a.canSend===true,detail:String(a.detail||'').slice(0,250)}];})),feeds:Object.fromEntries(['twitch','youtube','youtubeShorts','tiktok','kick'].filter(key=>data.feeds?.[key]).map(key=>{const f=data.feeds[key];return [key,{startup:key==='tiktok'&&['painting','painted','failed','user-opened'].includes(f.startup)?f.startup:null,transport:f.transport==='network'?'network':'page',chatMode:['live','switching','page-default'].includes(f.chatMode)?f.chatMode:null,diagnostics:f.diagnostics&&typeof f.diagnostics==='object'?{pollEditor:f.diagnostics.pollEditor||null,pollLaunch:f.diagnostics.pollLaunch||null,signin:f.diagnostics.signin||null,pollControls:f.diagnostics.pollControls||[],page:f.diagnostics.page||null,wire:f.diagnostics.wire||[],http:f.diagnostics.http||[],sockets:(Array.isArray(f.diagnostics.sockets)?f.diagnostics.sockets:[]).slice(0,10).map(v=>String(v).slice(0,100)),events:(Array.isArray(f.diagnostics.events)?f.diagnostics.events:[]).slice(0,15).map(v=>String(v).slice(0,100)),responses:Number(f.diagnostics.responses)||0,attached:!!f.diagnostics.attached,paths:(Array.isArray(f.diagnostics.paths)?f.diagnostics.paths:[]).slice(-12).filter(p=>typeof p==='string').map(p=>p.slice(0,200)),title:String(f.diagnostics.title||'').slice(0,200)}:null,batches:Number.isFinite(f.batches)?f.batches:0,pageDelayMs:Number.isFinite(f.pageDelayMs)?f.pageDelayMs:null,sourceDelayMs:Number.isFinite(f.sourceDelayMs)?f.sourceDelayMs:null,polling:f.polling?{running:!!f.polling.running,requests:Number(f.polling.requests)||0,lastRequestMs:Number.isFinite(f.polling.lastRequestMs)?f.polling.lastRequestMs:null,error:typeof f.polling.error==='string'?f.polling.error.slice(0,150):null}:null,error:typeof f.error==='string'?f.error.slice(0,200):null}];})),errors:data.errors&&typeof data.errors==='object'?data.errors:{}};if(!wasActive&&collectorActive())emit('sources',sources);return json({ok:true});}
 if(u.pathname==='/api/collector/control'){if(!['show','signin','refresh','setup','quit','poll-editor','poll-check'].includes(data.action))return json({error:'Unknown capture action'},400);if(['show','signin','refresh','poll-editor','poll-check'].includes(data.action)&&!['twitch','youtube','youtubeShorts','tiktok','kick'].includes(data.sourceKey))return json({error:'Unknown source'},400);queueCollector({action:data.action,sourceKey:data.sourceKey,...(data.action==='setup'&&data.page==='connections'?{page:'connections'}:{})});return json({ok:true});}
 if(u.pathname==='/api/sources/status'){if(collectorActive()&&data.mode!=='desktop')return json({ok:true,ignored:true});sourceStatus={version:/^\d+\.\d+\.\d+$/.test(data.version||'')?data.version:null,mode:data.mode==='desktop'?'desktop':'chrome',twitch:data.twitch===true,youtube:data.youtube===true,youtubeShorts:data.youtubeShorts===true,tiktok:data.tiktok===true,kick:data.kick===true,updatedAt:Date.now()};return json({ok:true});}
 if(u.pathname==='/api/obs/setup')return json(await setupObs({resolution:state.resolution}));
 if(u.pathname==='/api/tts/test'){const voice=typeof data.voice==='string'?data.voice:state.ttsVoice;if(!await speech.knows(voice))return json({error:'That voice is not installed.'},400);try{return json(await speech.test({...state,ttsVoice:voice},{preview:data.preview===true}));}catch(e){return json({error:e.message},500);}}
 if(u.pathname==='/api/tts/natural/install'){try{natural.install(String(data.id||''));return json({ok:true});}catch(e){return json({error:e.message},400);}}
 if(u.pathname==='/api/tts/natural/remove'){try{await natural.remove(String(data.id||''));return json({ok:true});}catch(e){return json({error:e.message},400);}}
 if(u.pathname==='/api/tts/skip'){speech.skip();return json({ok:true});}
 if(u.pathname==='/api/update/check')return json(await updates.check(true));
 if(u.pathname==='/api/update/install'){const job=updates.job();if(!job)return json({error:updates.status().packaged?'No update to install.':'This copy runs from source. Update it with git pull.'},409);if(!collectorActive())return json({error:'Start Bubblecast to install the update.'},409);updates.report('downloading');queueCollector({action:'update',...job});return json(updates.status());}
 if(u.pathname==='/api/update/progress'){updates.report(String(data.stage||''),data.detail);return json({ok:true});}
 if(u.pathname==='/api/youtube/page-live'){
  if(!youtube.pageFallback||!pageCheck||data.id!==pageCheck.id||data.channel!==pageCheck.channel||sources.youtubeLive!==pageCheck.channel||Date.now()>pageCheck.until)return json({ok:true,ignored:true});
  pageCheck=null;if(data.error===true)return json({ok:true});
  const videos=(Array.isArray(data.videos)?data.videos:[]).filter(v=>/^[\w-]{11}$/.test(v?.video||'')).slice(0,4);pageFound=pageSlots(videos);pageFoundAt=Date.now();await youtubeFound(youtube.found);discovery.settle();return json({ok:true,found:pageFound});}
 if(u.pathname==='/api/obs/streaming'){obsDetection.browserAt=Date.now();obsDetection.browserStreaming=data.streaming===true;streamingChanged();return json({ok:true,live:obsLive()});}
 if(u.pathname==='/api/obs/dock')return json(await addObsDock().catch(error=>({status:'failed',detail:error.message})));
 if(u.pathname==='/api/settings'){const before=state;state=settings(req.method==='PATCH'?{...state,...data}:data);catalogAt=0;await saveSettings();rewardSync.fromStudio(before).catch(()=>{});return json(state);}
 if(u.pathname==='/api/tts/reward/create'){try{return json(await rewardSync.create());}catch(e){return json({error:e.message},400);}}
 if(u.pathname==='/api/clear'){emit('clear',{});return json({ok:true});}
 if(u.pathname==='/api/bridge'||u.pathname==='/api/test'){
 if(u.pathname==='/api/bridge'&&collectorActive()&&data.transport!=='desktop')return json({ok:true,ignored:true});
 if(u.pathname==='/api/bridge'&&['twitch','youtube','tiktok','kick'].includes(data.platform))bridge[data.platform]=Date.now();
 if(u.pathname==='/api/bridge'&&traffic[data.platform]){if(['starting','listening'].includes(data.captureState))traffic[data.platform].captureState=data.captureState;if(/^\d+\.\d+\.\d+$/.test(data.bridgeVersion||''))traffic[data.platform].bridgeVersion=data.bridgeVersion;if(data.action!=='update'&&Number.isFinite(data.observedAt)&&data.observedAt<=Date.now()&&Date.now()-data.observedAt<60000)traffic[data.platform].lastRelayMs=Date.now()-data.observedAt;}
 // While the official stream reads a YouTube chat, the signed-out page copy only adds emoji images and badges to its messages.
 if(data.platform==='youtube'&&data.action!=='heartbeat'){if(!youtube.pageFallback){if(youtube.reading(data.sourceKey||'youtube')){if(!['poll','delete','clear'].includes(data.action))for(const m of youtubeMerge.page(data)){const event=relay.ingest(m,state);if(event)emit(event.type,event.message);}}return json({ok:true,ignored:true});}
  // Only no-app and exhausted-quota reads use page chat. API startup/auth errors never select fallback.
  if(data.action==='poll')return json({ok:true});}
 if(data.action==='poll'){const poll=polls.accept(data.poll?{...data.poll,platform:data.platform,sourceKey:data.sourceKey}:data);if(poll){emit('poll',poll);await savePolls();}return json({ok:true,displayed:!!poll});}
 if(data.action==='delete'){emit('delete',{id:String(data.id||'').slice(0,200),userId:String(data.userId||'').slice(0,100),platform:data.platform,...(data.sourceKey?{sourceKey:data.sourceKey}:{})});return json({ok:true});}
 if(data.action==='clear'){emit('clear',{});return json({ok:true});}
 if(data.action==='heartbeat')return json({ok:true});
 if(u.pathname==='/api/bridge'&&traffic[data.platform]&&data.action!=='update'){traffic[data.platform].received++;traffic[data.platform].lastMessageAt=Date.now();}
 const event=relay.ingest(data,state);if(event){emit(event.type,event.message);if(event.type==='message'&&u.pathname==='/api/bridge')traffic[event.message.platform].displayed++;}return json({ok:true,displayed:!!event});}
 return json({error:'Unknown action'},404);
 }
 const files={'/connection-status.js':'connection-status.js','/connection-cards.css':'connection-cards.css','/event-stream.js':'event-stream.js','/i18n.js':'i18n.js','/tooltip.js':'tooltip.js','/select.js':'select.js','/tts':'tts.html','/tts.js':'tts.js','/tts.css':'tts.css','/setup-guide.js':'setup-guide.js','/setup-guide.css':'setup-guide.css','/logos/kick.svg':'kick.svg','/dock-layout.mjs':'dock-layout.mjs','/render-timing.mjs':'render-timing.mjs','/obs-live.mjs':'obs-live.mjs','/render-patch.mjs':'render-patch.mjs','/dock':'dock.html','/dock.js':'dock.js','/poll-compose.mjs':'poll-compose.mjs','/poll-board.mjs':'poll-board.mjs','/poll-overlay':'poll-overlay.html','/poll-overlay.js':'poll-overlay.js','/poll-overlay.css':'poll-overlay.css','/poll-overlay-view.mjs':'poll-overlay-view.mjs','/dock.css':'dock.css','/logos/youtube.svg':'youtube.svg','/logos/tiktok.svg':'tiktok.svg','/logos/tiktok-on-dark.svg':'tiktok-on-dark.svg','/logos/twitch.png':'../logos/twitch-purple-logo-png-transparent.png','/logos/youtube.png':'../logos/Youtube_logo.png','/':'index.html','/overlay':'overlay.html','/app.js':'app.js','/connections.js':'connections.js','/overlay.js':'overlay.js','/layouts.mjs':'layouts.mjs','/overlay.css':'overlay.css','/style.css':'style.css','/theme.css':'theme.css','/logo-glyph.svg':'logo-glyph.svg','/favicon.svg':'favicon.svg','/core.mjs':'../core.mjs'};
 if(!files[u.pathname])return json({error:'Not found'},404);
 const file=files[u.pathname];res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'})[extname(file)]});res.end(await readFile(join(root,'public',file)));
 }catch(e){if(!res.headersSent)json({error:e.message},400);else res.end();}
});
setInterval(()=>{const removed=polls.prune();for(const poll of removed)emit('poll-remove',poll);if(removed.length)savePolls().catch(()=>{});},1000).unref();
setInterval(()=>{const frame='event: heartbeat\ndata: '+JSON.stringify({at:Date.now()})+'\n\n';for(const r of clients)r.write(frame);},15000).unref();
// Twitch runs here. Chat, subs and raids always come from Twitch's official chat connection (the only
// source with GIFs); signing in adds badges, reward titles, text-free redemptions, polls, sending and viewers.
function ingestOfficial(data){const platform=data.platform;bridge[platform]=Date.now();if(data.action==='delete'){emit('delete',{platform,sourceKey:data.sourceKey||platform,id:String(data.id||'').slice(0,200),userId:String(data.userId||'').slice(0,100)});return;}if(data.action==='clear'){emit('clear',{});return;}if(data.action!=='update'){traffic[platform].received++;traffic[platform].lastMessageAt=Date.now();}const event=relay.ingest(data,state);if(event){emit(event.type,event.message);if(event.type==='message')traffic[platform].displayed++;}}
const twitch=new TwitchOfficial({file:join(dataDir,'.local','twitch-auth.json'),onMessage:ingestOfficial,onRedemption:r=>{if(state.ttsEnabled)speech.redeemed(r,state);},onRewardChange:r=>rewardSync.fromTwitch(r).catch(()=>{}),onAuth:()=>{refreshSources();setTimeout(()=>rewardSync.load(),8000);},onPoll:async p=>{const poll=polls.accept(p);if(poll){emit('poll',poll);await savePolls();}}});
const twitchChat=new TwitchLive({onMessage:ingestOfficial,reward:id=>twitch.rewards.get(id),badgeImages:(tag,info)=>twitch.badgeList(tag,info)});
function configureTwitch(){const channel=sources.enabled&&sources.urls.twitch?sources.twitchChannel:'';twitch.configure(twitch.connected?channel:'');twitchChat.configure(channel);}
// Opens Google or Kick sign-in in the default browser, so docks inside OBS can connect too (Google blocks embedded sign-in).
function openBrowser(url){if(!/^https:\/\/(?:accounts\.google\.com|id\.kick\.com)\//.test(url))return;const [cmd,args]=process.platform==='win32'?['rundll32',['url.dll,FileProtocolHandler',url]]:process.platform==='darwin'?['open',[url]]:['xdg-open',[url]];try{spawn(cmd,args,{detached:true,stdio:'ignore',windowsHide:true}).on('error',()=>{}).unref();}catch{}}
// Twitch and YouTube always use their APIs. Kick sends through its API once connected; Kick polls have no API and stay in the helper.
const officialTargets=new Set(['twitch',...youtubeKeys]);
const sendOfficial=()=>new Set([...officialTargets,...(kick.connected?['kick']:[])]);
function helperTargets(data,official=officialTargets){return (Array.isArray(data.targets)?data.targets:[]).some(k=>!official.has(k));}
// A send job keeps the routes chosen when it was queued, so a later Kick sign-in or sign-out can never send twice.
function forHelper(job,kind){if(!job)return job;const official=kind==='send'&&job.official?new Set(job.official):officialTargets;return {...job,urls:Object.fromEntries(Object.entries(job.urls).filter(([k])=>!official.has(k)))};}
// YouTube: official API for sending, polls and viewers; the helper reads chat from the page signed out.
const appKeys=new AppKeys({file:join(dataDir,'.local','app-keys.json')});
const youtube=new YouTubeOfficial({live:false,file:join(dataDir,'.local','youtube-auth.json'),choicesFile:join(dataDir,'.local','youtube-streams.json'),onFound:found=>youtubeFound(found).catch(()=>{}),onMessage:ingestYouTube,onQuota:()=>refreshSources(),onAuth:()=>refreshSources(),onPoll:async p=>{const poll=polls.accept(p);if(poll){emit('poll',poll);await savePolls();}}});
const youtubeMerge=new YouTubeMerge({file:join(dataDir,'.local','youtube-emojis.json')});
function ingestYouTube(m){if(m.action){ingestOfficial(m);return;}const {message,updates}=youtubeMerge.api(m);ingestOfficial(message);for(const u of updates)ingestOfficial(u);}
// Kick: official API for sending and viewers once connected; chat and polls stay with the helper.
const kick=new KickOfficial({file:join(dataDir,'.local','kick-auth.json'),onAuth:()=>refreshSources()});
function configureKick(){kick.configure(sources.enabled&&sources.urls.kick?sources.kickChannel:'',{enabled:sources.enabled});}
async function saveSettings(){await writeFile(join(dataDir,'settings.json'),JSON.stringify(state,null,2));emit('settings',state);}
// Keeps the text-to-speech reward and Studio in step: Studio edits go to Twitch, Twitch edits come back to
// Studio, and a command elsewhere pauses the reward for the shared wait so Twitch shows it unavailable too.
const rewardSync={status:{linked:false,managed:false,error:null},pauseTimer:null,
 async create(){if(!twitch.canManageRewards)throw Error('Reconnect Twitch to let Bubblecast manage channel point rewards.');
  const title=state.ttsReward||'TTS';let r,managed=true;
  try{r=await twitch.createReward({title,cost:state.ttsRewardCost,cooldown:state.ttsGlobalCooldown});}
  catch(e){// A reward with this name already exists: link that one instead.
   if(!/DUPLICATE/i.test(e.message))throw e;r=(await twitch.listRewards()).find(x=>x.title.trim().toLowerCase()===title.trim().toLowerCase());if(!r)throw e;managed=await twitch.rewardManaged(r.id);}
  if(!r)throw Error('Twitch did not create the reward.');
  state=settings({...state,ttsReward:r.title,ttsRewardId:r.id,ttsRewardCost:r.cost,...(managed?{}:{ttsGlobalCooldown:r.cooldown})});await saveSettings();
  this.status={linked:true,managed,error:null};if(managed)await twitch.updateReward(r.id,{cooldown:state.ttsGlobalCooldown}).catch(()=>{});return this.status;},
 // Studio changed: send title, cost and the shared wait to the linked reward.
 async fromStudio(before){const id=state.ttsRewardId;if(!id||!twitch.canManageRewards)return;
  const changes={};if(state.ttsReward!==before.ttsReward&&state.ttsReward)changes.title=state.ttsReward;if(state.ttsRewardCost!==before.ttsRewardCost)changes.cost=state.ttsRewardCost;if(state.ttsGlobalCooldown!==before.ttsGlobalCooldown)changes.cooldown=state.ttsGlobalCooldown;
  if(!Object.keys(changes).length)return;try{await twitch.updateReward(id,changes);this.status={linked:true,managed:true,error:null};}catch(e){this.status={...this.status,error:e.message};}},
 // Twitch changed the reward (or Bubblecast connected): bring title, cost and cooldown into Studio.
 async fromTwitch(r){if(!r||r.id!==state.ttsRewardId)return;const next=settings({...state,ttsReward:r.title,ttsRewardCost:r.cost,ttsGlobalCooldown:r.cooldown});
  this.status={...this.status,linked:true};if(next.ttsReward!==state.ttsReward||next.ttsRewardCost!==state.ttsRewardCost||next.ttsGlobalCooldown!==state.ttsGlobalCooldown){state=next;await saveSettings();}},
 async load(){if(!state.ttsRewardId||!twitch.redemptionsReady)return;try{const r=await twitch.findReward(state.ttsRewardId);if(!r){this.status={linked:false,managed:false,error:'The linked reward was deleted on Twitch. Create it again.'};return;}
  this.status={linked:true,managed:await twitch.rewardManaged(r.id),error:null};await this.fromTwitch(r);}catch(e){this.status={...this.status,error:e.message};}},
 // A message from a command started the shared wait: pause the reward until it ends.
 pauseFor({until,fromReward}){if(fromReward||!state.ttsRewardId||!this.status.managed)return;const id=state.ttsRewardId;clearTimeout(this.pauseTimer);
  twitch.updateReward(id,{paused:true}).catch(()=>{});this.pauseTimer=setTimeout(()=>twitch.updateReward(id,{paused:false}).catch(()=>{}),Math.max(0,until-Date.now()));}};
setInterval(()=>rewardSync.load(),300000).unref();setTimeout(()=>rewardSync.load(),15000).unref();

// Update checks: the installed Windows app (BUBBLECAST_PACKAGED) can install them; a checkout only reports them.
const updates=new Updates({current:JSON.parse(await readFile(join(root,'package.json'),'utf8')).version,packaged:process.env.BUBBLECAST_PACKAGED==='1'});
setTimeout(()=>{updates.check().catch(()=>{});setInterval(()=>updates.check().catch(()=>{}),3600000).unref();},20000).unref();
// OBS queries are local. Discovery runs only on a start edge, with four finite attempts; metadata/chat
// reads retain their existing cadence while an output is live and for two minutes after it stops.
let sourceReadMode=null,pageFound=[],pageFoundAt=0,pageCheck=null,obsStreamingAt=0,verticalLive=false,checkUntil=0,lastCheck=0;
const obsLive=()=>obsStreamingAt>0&&Date.now()-obsStreamingAt<120000;
function outputState(){const now=Date.now(),ws=obsDetection.websocket==='ready'&&now-obsDetection.checkedAt<45000,browser=obsDetection.browserAt>0&&now-obsDetection.browserAt<75000;
 return {main:browser&&(!ws||obsDetection.browserAt>=obsDetection.checkedAt)?obsDetection.browserStreaming===true:ws&&obsDetection.main===true,vertical:ws&&obsDetection.verticalDetected&&obsDetection.vertical===true};}
function discoveryBlocked(){if(!sources.enabled)return 'disabled';if(savedSources.youtubeVideo||savedSources.youtubeShortsVideo)return 'manual-links';if(youtube.readMode==='signin')return 'signin-required';if(youtube.pageFallback&&!sources.youtubeLive)return 'missing-channel';if(youtube.pageFallback&&!collectorActive())return 'helper-offline';return 'none';}
function slotsFilled(expected,since){if(youtube.pageFallback?pageFoundAt<since:youtube.discovery.state!=='complete'||youtube.discovery.finishedAt<since)return false;const found=sources.youtubeFound||[];const filled=slot=>!!(savedSources[slot==='youtube'?'youtubeVideo':'youtubeShortsVideo']||found.some(f=>f.slot===slot&&(youtube.pageFallback||youtube.candidates.some(c=>c.video===f.video&&(c.live||c.receiving)&&['horizontal','vertical'].includes(c.format)))));return (!expected.main||filled('youtube'))&&(!expected.vertical||filled('youtubeShorts'));}
async function checkYouTube(reason='stream-start'){
 if(discoveryBlocked()!=='none'||Date.now()-lastCheck<10000)return;lastCheck=Date.now();discoveryTrigger={reason,at:lastCheck,route:youtube.readMode};diagnostics.record(diagnosticInput());
 if(youtube.apiReady){const generation=discovery.generation,localOutputs=await obsStreams({includeKeys:true}).catch(()=>null);if(reason==='stream-start'&&(generation!==discovery.generation||!Object.values(outputState()).some(Boolean)))return;youtube.setOutputKeys(localOutputs?.keys);if(discoveryBlocked()!=='none')return;if(reason!=='stream-start')checkUntil=Date.now()+150000;youtube.setLive(true);await youtube.findLive();if(youtube.pageFallback)refreshSources();}
 if(youtube.pageFallback&&discoveryBlocked()==='none'&&collectorCommands.length<64&&(!pageCheck||Date.now()>pageCheck.until)){
  const id=randomBytes(12).toString('hex');pageCheck={id,reason,channel:sources.youtubeLive,until:Date.now()+55000};queueCollector({action:'youtube-check',...pageCheck,current:pageFound.map(f=>({video:f.video,title:f.title,vertical:f.format==='vertical'?true:f.format==='horizontal'?false:null}))});}
}
function streamingChanged(){const outputs=outputState();outputStarts.update(outputs,Date.now());verticalLive=outputs.vertical;if(outputs.main||outputs.vertical)obsStreamingAt=Date.now();else if(pageCheck?.reason==='stream-start')pageCheck=null;youtube.setLive(obsLive()||Date.now()<checkUntil);discovery.update(outputs);}
// Detect main and Aitum starts independently. Repeated idle/recording status spends no YouTube quota.
let obsChecking=false;setInterval(async()=>{if(obsChecking)return;obsChecking=true;try{const s=await obsStreams().catch(()=>null);Object.assign(obsDetection,{checkedAt:Date.now(),websocket:s?'ready':'unavailable',main:s?.streaming===true,vertical:s?.vertical===true,verticalDetected:s?.verticalDetected===true});streamingChanged();}finally{obsChecking=false;}},20000).unref();
let quotaOut=false;setInterval(()=>{streamingChanged();const out=youtube.quotaUntil>Date.now();if(out!==quotaOut){quotaOut=out;refreshSources();}},15000).unref();
function configureYouTube(){const found=sources.youtubeFound||[],slot=k=>found.find(f=>f.slot===k)?.video||'';youtube.configure(sources.enabled?{youtube:sources.urls.youtube?sources.youtubeVideo||slot('youtube'):'',youtubeShorts:sources.urls.youtubeShorts?sources.youtubeShortsVideo||slot('youtubeShorts'):''}:{});youtube.autoFind(savedSources.enabled&&!savedSources.youtubeVideo&&!savedSources.youtubeShortsVideo);}
// A newly found or ended YouTube stream updates the chat sources the same way saving connections does.
async function youtubeFound(found){const next=resolvedSources(savedSources,found);if(JSON.stringify(next.urls)===JSON.stringify(sources.urls)&&JSON.stringify(next.youtubeFound)===JSON.stringify(sources.youtubeFound))return;const changed=JSON.stringify(next.urls)!==JSON.stringify(sources.urls);sources=next;if(changed)await savePolls();emit('sources',sources);configureYouTube();}
// No-app/quota fallback uses only existing probes, never an extra platform request.
function pageSlots(videos){return assignSlots(pageCandidates(videos,{...youtube.choices,prior:pageFound,outputs:outputState(),starts:outputStarts.starts}));}
function resolvedSources(saved=savedSources,found=youtube.found){const next=withFoundVideos(withAccountChannels(saved,{twitch:twitch.connected?twitch.auth?.login:'',kick:kick.connected?kick.auth?.channel:''}),youtube.apiReady?found:pageFound,youtube.connected?youtube.auth?.channel?.id||'':'',youtube.pageFallback);if(youtube.readMode==='signin')next.urls={...next.urls,youtube:'',youtubeShorts:''};return next;}
function refreshSources(){if(youtube.pageFallback&&sourceReadMode==='api'){pageFound=(sources.youtubeFound||[]).map(f=>({...f}));pageFoundAt=Date.now();}sourceReadMode=youtube.readMode;const next=resolvedSources();const changed=JSON.stringify(next)!==JSON.stringify(sources);sources=next;if(changed)emit('sources',sources);configureTwitch();configureYouTube();configureKick();}
const outputStarts=new OutputStarts();
const discovery=new YouTubeDiscovery({check:checkYouTube,filled:slotsFilled});
const obsDetection={checkedAt:0,browserAt:0},diagnosticVersion=JSON.parse(await readFile(join(root,'package.json'),'utf8')).version;let discoveryTrigger={};
function diagnosticInput(){return {version:diagnosticVersion,sources,collector:{...collector,active:collectorActive()},traffic,bridge,twitch:twitch.status(),twitchChatReady:twitchChat.ready,youtube:youtube.status(),kick:kick.status(),obs:obsDetection,trigger:{...discoveryTrigger,series:discovery.status(),blocked:discoveryBlocked()},clients:clients.size,renderTiming};}
setInterval(()=>diagnostics.record(diagnosticInput()),5000).unref();
await appKeys.load();youtube.setApp(appKeys.get('youtube'));kick.setApp(appKeys.get('kick'));await twitch.load();configureTwitch();await youtube.load();await kick.load();configureKick();await youtubeMerge.load();refreshSources();
await diagnostics.record(diagnosticInput());
server.listen(3927,'127.0.0.1',()=>console.log('Bubblecast ready: http://127.0.0.1:3927 • OBS: http://127.0.0.1:3927/overlay'));


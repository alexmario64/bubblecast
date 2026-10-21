import {Outbox,destinations} from './outbox.mjs';
import {PollJobs,PollEndJobs,pollDestinations} from './poll-jobs.mjs';
import {PollStore} from './polls.mjs';
import http from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,extname} from 'node:path';
import {randomBytes} from 'node:crypto';
import {settings,normalize} from './core.mjs';
import {youtubeAuth} from './youtube.mjs';
import {secureStore} from './secure-store.mjs';
import {setupObs} from './obs.mjs';
import {MessageRelay} from './relay.mjs';
import {sourceConfig} from './source-config.mjs';
import {DockHistory} from './dock-history.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));
const youtube=youtubeAuth(secureStore(join(root,'.local','youtube.dpapi')));
let state=settings();try{state=settings(JSON.parse(await readFile(join(root,'settings.json'),'utf8')));}catch{}
let sources={configured:false,enabled:false,twitchChannel:'',youtubeVideo:'',youtubeShortsVideo:'',tiktokChannel:'',kickChannel:'',urls:{twitch:'',youtube:'',youtubeShorts:'',tiktok:'',kick:''}},sourceStatus={version:null,twitch:false,youtube:false,youtubeShorts:false,tiktok:false,kick:false,updatedAt:0};try{sources=sourceConfig(JSON.parse(await readFile(join(root,'sources.json'),'utf8')));}catch{}
const token=randomBytes(24).toString('hex'),clients=new Set(),relay=new MessageRelay(),dockHistory=new DockHistory();
const outbox=new Outbox(),pollJobs=new PollJobs(),pollEndJobs=new PollEndJobs();let collectorWaiter=null;
function queueCollector(command){if(collectorCommands.length>=64)throw Error('Capture command queue is busy.');collectorCommands.push(command);collectorWaiter?.();}
let collector={updatedAt:0,version:null,errors:{}},collectorCommands=[];
const polls=new PollStore();
const pollFile=join(root,'.local','polls.json');
try{const saved=JSON.parse(await readFile(pollFile,'utf8'));if(JSON.stringify(saved.urls)===JSON.stringify(sources.urls)&&Date.now()-saved.savedAt<86400000)for(const poll of saved.polls||[])if(!['completed','terminated','closed','unavailable'].includes(poll.status))polls.accept(poll);}catch{}
async function savePolls(){await mkdir(join(root,'.local'),{recursive:true});await writeFile(pollFile,JSON.stringify({urls:sources.urls,savedAt:Date.now(),polls:polls.snapshot()}));}
const renderTiming={overlay:{},vertical:{},webcam:{},dock:{}};
const collectorActive=()=>Date.now()-collector.updatedAt<15000;
let bridge={twitch:0,youtube:0,tiktok:0,kick:0},catalog={},catalogAt=0,catalogErrors=[];
const traffic={kick:{received:0,displayed:0,lastMessageAt:0,bridgeVersion:'unknown',lastRelayMs:null},tiktok:{received:0,displayed:0,lastMessageAt:0,bridgeVersion:'unknown',lastRelayMs:null},twitch:{received:0,displayed:0,lastMessageAt:0,bridgeVersion:'unknown',lastRelayMs:null},youtube:{received:0,displayed:0,lastMessageAt:0,bridgeVersion:'unknown',lastRelayMs:null}};
function emit(type,data){dockHistory.accept(type,data);const frame=`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;for(const r of clients)r.write(frame);}
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
 if(u.pathname==='/oauth/youtube/callback'){
 try{await youtube.callback(u.searchParams);res.writeHead(303,{Location:'/?youtube=connected','Referrer-Policy':'no-referrer'});return res.end();}
 catch(e){res.writeHead(400,{'Content-Type':'text/plain; charset=utf-8','Referrer-Policy':'no-referrer'});return res.end(e.message+' Return to Bubblecast and retry Connect YouTube.');}
 }
 if(u.pathname==='/fonts/komika-axis.ttf'){
 const candidates=[join(process.env.LOCALAPPDATA||'','Microsoft','Windows','Fonts'),join(process.env.WINDIR||'C:/Windows','Fonts'),join(process.env.HOME||'','Library','Fonts'),'/Library/Fonts'].flatMap(dir=>['KOMIKAX.ttf','KOMIKAX_.ttf'].map(file=>join(dir,file)));for(const path of candidates){try{const font=await readFile(path);res.writeHead(200,{'Content-Type':'font/ttf','Cache-Control':'private, max-age=86400'});return res.end(font);}catch{}}return json({error:'Install Komika Axis for this user account.'},404);
 }
 if(u.pathname==='/api/events'){res.writeHead(200,{'Content-Type':'text/event-stream','Connection':'keep-alive'});res.write(`event: settings\ndata: ${JSON.stringify(state)}\n\n`);res.write('event: polls\ndata: '+JSON.stringify(polls.snapshot())+'\n\n');clients.add(res);req.on('close',()=>clients.delete(res));return;}
 if(u.pathname==='/api/polls'&&req.method==='GET')return json({polls:polls.snapshot()});
 if(u.pathname==='/api/status')return json({bridge,traffic,settings:state,sources,sourceStatus,renderTiming,collector:{...collector,active:collectorActive()}});
 if(u.pathname==='/api/collector/commands'&&req.method==='GET'){if(req.headers['x-bubblecast-token']!==token)return json({error:'Pair the capture app.'},401);const deliver=()=>{const commands=collectorCommands.map(c=>c.action==='send'?{action:'send',job:outbox.claim(c.id)}:c.action==='create-poll'?{action:'create-poll',job:pollJobs.claim(c.id)}:c.action==='end-poll'?{action:'end-poll',job:pollEndJobs.claim(c.id)}:c).filter(c=>!['send','create-poll','end-poll'].includes(c.action)||c.job);collectorCommands=[];json({commands});};if(collectorCommands.length||u.searchParams.get('wait')!=='1'){deliver();return;}if(collectorWaiter)return json({error:'Collector already listening'},409);const done=()=>{if(collectorWaiter!==done)return;collectorWaiter=null;clearTimeout(timer);deliver();};const timer=setTimeout(done,25000);collectorWaiter=done;res.on('close',()=>{if(collectorWaiter===done){collectorWaiter=null;clearTimeout(timer);}});return;}
 if(u.pathname==='/api/chat/history'&&req.method==='GET')return json({messages:dockHistory.snapshot(state)});
 if(u.pathname==='/api/sources'&&req.method==='GET')return json({...sources,captureMode:collectorActive()?'desktop':'chrome'});
 if(u.pathname==='/api/pair'&&req.method==='GET')return json({token});
 if(u.pathname==='/api/emotes')return json(await emotes());
 if(req.method==='POST'){
 if(req.headers['x-bubblecast-token']!==token)return json({error:'Pair the bridge from the setup screen.'},401);
 let body='';for await(const c of req){body+=c;if(body.length>100000){json({error:'Too large'},413);req.destroy();return;}}
 const data=JSON.parse(body||'{}');
 if(u.pathname==='/api/polls/create'){if(origin?.startsWith('chrome-extension://'))return json({error:'Use the dock poll composer.'},403);if(!collectorActive()||!collector.pollCreation)return json({error:'Restart the updated background helper before creating polls.'},409);if(collectorCommands.length>=64)return json({error:'Capture command queue is busy.'},429);const {job,fresh}=pollJobs.enqueue(data,sources.enabled?sources.urls:{},polls.snapshot());if(fresh)queueCollector({action:'create-poll',id:job.id});return json(pollJobs.public(job));}
 if(u.pathname==='/api/polls/end'){if(origin?.startsWith('chrome-extension://'))return json({error:'Use the dock poll controls.'},403);if(!collectorActive()||!collector.pollCreation)return json({error:'Background helper is unavailable.'},409);if(collectorCommands.length>=64)return json({error:'Capture command queue is busy.'},429);const {job,fresh}=pollEndJobs.enqueue(data,sources.enabled?sources.urls:{},polls.snapshot());if(fresh)queueCollector({action:'end-poll',id:job.id});return json(pollEndJobs.public(job));}
 if(u.pathname==='/api/polls/end/status')return json(pollEndJobs.public(pollEndJobs.get(data.id))||{error:'Poll status expired.'});
 if(u.pathname==='/api/polls/end/result'){for(const key of pollDestinations)if(data.results?.[key])pollEndJobs.result(data.id,key,data.results[key]);return json({ok:true});}
 if(u.pathname==='/api/polls/create/status')return json(pollJobs.public(pollJobs.get(data.id))||{error:'Poll status expired.'});
 if(u.pathname==='/api/polls/create/result'){for(const key of pollDestinations)if(data.results?.[key])pollJobs.result(data.id,key,data.results[key]);return json({ok:true});}
 if(u.pathname==='/api/chat/send'){if(origin?.startsWith('chrome-extension://'))return json({error:'Use the Bubblecast dock to send messages.'},403);if(collectorCommands.length>=64)return json({error:'Capture command queue is busy.'},429);if(!collectorActive()||!/^1\.(?:[89]|[1-9]\d)\./.test(collector.version||''))return json({error:'Start or update the Bubblecast background helper to send messages.'},409);const {job,fresh}=outbox.enqueue(data,sources.enabled?sources.urls:{});if(fresh)queueCollector({action:'send',id:job.id});return json(outbox.public(job));}
 if(u.pathname==='/api/chat/send/status')return json(outbox.public(outbox.get(data.id))||{error:'Message status expired.'});
 if(u.pathname==='/api/chat/send/result'){const results=data.results||{};for(const target of destinations)if(results[target])outbox.result(data.id,target,results[target]);return json({ok:true});}
 if(u.pathname==='/api/render-timing'){if(!Object.hasOwn(renderTiming,data.view)||!['twitch','youtube','tiktok','kick'].includes(data.platform))return json({error:'Invalid timing source'},400);const key=data.platform==='youtube'&&data.sourceKey==='youtubeShorts'?'youtubeShorts':data.platform,previous=renderTiming[data.view][key];if(data.mediaMs!=null&&previous&&previous.messageId!==data.messageId)return json({ok:true,ignored:true});const entry=previous?.messageId===data.messageId?{...previous}:{};entry.messageId=String(data.messageId||'').slice(0,200);for(const field of ['paintMs','mediaMs'])if(Number.isFinite(data[field])&&data[field]>=0&&data[field]<=60000)entry[field]=Math.round(data[field]);entry.updatedAt=Date.now();renderTiming[data.view][key]=entry;return json({ok:true});}
 if(u.pathname==='/api/sources'){const next=sourceConfig(data),changed=JSON.stringify(next.urls)!==JSON.stringify(sources.urls);sources=next;sourceStatus={version:null,twitch:false,youtube:false,youtubeShorts:false,tiktok:false,kick:false,updatedAt:0};await writeFile(join(root,'sources.json'),JSON.stringify(sources,null,2));if(changed){emit('clear',{});polls.clear();await savePolls();emit('polls',[]);}emit('sources',sources);return json(sources);}
 if(u.pathname==='/api/collector/status'){const wasActive=collectorActive();collector={updatedAt:data.active===true?Date.now():0,pollCreation:data.pollCreation===true,version:String(data.version||'').slice(0,20),audio:data.audio?{pages:Math.max(0,Number(data.audio.pages)||0),unmuted:Math.max(0,Number(data.audio.unmuted)||0)}:null,viewers:Object.fromEntries(destinations.filter(k=>data.viewers?.[k]&&typeof data.viewers[k]==='object').map(k=>{const v=data.viewers[k];return [k,{live:typeof v.live==='boolean'?v.live:null,viewers:Number.isFinite(v.viewers)&&v.viewers>=0?Math.round(v.viewers):null,updatedAt:Number.isFinite(v.updatedAt)?v.updatedAt:0,error:v.error?String(v.error).slice(0,120):null}];})),accounts:Object.fromEntries(destinations.filter(k=>data.accounts?.[k]).map(k=>{const a=data.accounts[k];return [k,{state:['ready','signed-out','unavailable'].includes(a.state)?a.state:'unavailable',signedIn:typeof a.signedIn==='boolean'?a.signedIn:null,canSend:a.canSend===true,detail:String(a.detail||'').slice(0,250)}];})),twitchPoll:data.twitchPoll?{hasClient:!!data.twitchPoll.hasClient,status:String(data.twitchPoll.status||'').slice(0,20),error:typeof data.twitchPoll.error==='string'?data.twitchPoll.error.slice(0,150):null}:null,twitchTransport:data.twitchTransport==='direct'?'direct':'page',twitchPageDelayMs:Number.isFinite(data.twitchPageDelayMs)?Math.max(0,Math.min(60000,data.twitchPageDelayMs)):null,feeds:Object.fromEntries(['twitch','youtube','youtubeShorts','tiktok','kick'].filter(key=>data.feeds?.[key]).map(key=>{const f=data.feeds[key];return [key,{transport:f.transport==='network'?'network':'page',chatMode:['live','switching','page-default'].includes(f.chatMode)?f.chatMode:null,diagnostics:f.diagnostics&&typeof f.diagnostics==='object'?{pollEditor:f.diagnostics.pollEditor||null,pollLaunch:f.diagnostics.pollLaunch||null,signin:f.diagnostics.signin||null,pollControls:f.diagnostics.pollControls||[],page:f.diagnostics.page||null,wire:f.diagnostics.wire||[],http:f.diagnostics.http||[],sockets:(Array.isArray(f.diagnostics.sockets)?f.diagnostics.sockets:[]).slice(0,10).map(v=>String(v).slice(0,100)),events:(Array.isArray(f.diagnostics.events)?f.diagnostics.events:[]).slice(0,15).map(v=>String(v).slice(0,100)),responses:Number(f.diagnostics.responses)||0,attached:!!f.diagnostics.attached,paths:(Array.isArray(f.diagnostics.paths)?f.diagnostics.paths:[]).slice(-12).filter(p=>typeof p==='string').map(p=>p.slice(0,200)),title:String(f.diagnostics.title||'').slice(0,200)}:null,batches:Number.isFinite(f.batches)?f.batches:0,pageDelayMs:Number.isFinite(f.pageDelayMs)?f.pageDelayMs:null,sourceDelayMs:Number.isFinite(f.sourceDelayMs)?f.sourceDelayMs:null,polling:f.polling?{running:!!f.polling.running,requests:Number(f.polling.requests)||0,lastRequestMs:Number.isFinite(f.polling.lastRequestMs)?f.polling.lastRequestMs:null,error:typeof f.polling.error==='string'?f.polling.error.slice(0,150):null}:null,error:typeof f.error==='string'?f.error.slice(0,200):null}];})),errors:data.errors&&typeof data.errors==='object'?data.errors:{}};if(!wasActive&&collectorActive())emit('sources',sources);return json({ok:true});}
 if(u.pathname==='/api/collector/control'){if(!['show','signin','refresh','setup','quit','poll-editor','poll-check'].includes(data.action))return json({error:'Unknown capture action'},400);if(['show','signin','refresh','poll-editor','poll-check'].includes(data.action)&&!['twitch','youtube','youtubeShorts','tiktok','kick'].includes(data.sourceKey))return json({error:'Unknown source'},400);queueCollector({action:data.action,sourceKey:data.sourceKey});return json({ok:true});}
 if(u.pathname==='/api/sources/status'){if(collectorActive()&&data.mode!=='desktop')return json({ok:true,ignored:true});sourceStatus={version:/^\d+\.\d+\.\d+$/.test(data.version||'')?data.version:null,mode:data.mode==='desktop'?'desktop':'chrome',twitch:data.twitch===true,youtube:data.youtube===true,youtubeShorts:data.youtubeShorts===true,tiktok:data.tiktok===true,kick:data.kick===true,updatedAt:Date.now()};return json({ok:true});}
 if(u.pathname==='/api/youtube/status')return json(await youtube.status());
 if(u.pathname==='/api/youtube/config')return json(await youtube.configure(data));
 if(u.pathname==='/api/youtube/connect')return json(await youtube.start());
 if(u.pathname==='/api/youtube/broadcasts')return json(await youtube.broadcasts());
 if(u.pathname==='/api/youtube/disconnect')return json(await youtube.disconnect());
 if(u.pathname==='/api/obs/setup')return json(await setupObs({resolution:state.resolution}));
 if(u.pathname==='/api/settings'){state=settings(data);catalogAt=0;await writeFile(join(root,'settings.json'),JSON.stringify(state,null,2));emit('settings',state);return json(state);}
 if(u.pathname==='/api/clear'){emit('clear',{});return json({ok:true});}
 if(u.pathname==='/api/bridge'||u.pathname==='/api/test'){
 if(u.pathname==='/api/bridge'&&collectorActive()&&data.transport!=='desktop')return json({ok:true,ignored:true});
 if(u.pathname==='/api/bridge'&&['twitch','youtube','tiktok','kick'].includes(data.platform))bridge[data.platform]=Date.now();
 if(u.pathname==='/api/bridge'&&traffic[data.platform]){if(['starting','listening'].includes(data.captureState))traffic[data.platform].captureState=data.captureState;if(/^\d+\.\d+\.\d+$/.test(data.bridgeVersion||''))traffic[data.platform].bridgeVersion=data.bridgeVersion;if(data.action!=='update'&&Number.isFinite(data.observedAt)&&data.observedAt<=Date.now()&&Date.now()-data.observedAt<60000)traffic[data.platform].lastRelayMs=Date.now()-data.observedAt;}
 if(data.action==='poll'){const poll=polls.accept(data.poll?{...data.poll,platform:data.platform,sourceKey:data.sourceKey}:data);if(poll){emit('poll',poll);await savePolls();}return json({ok:true,displayed:!!poll});}
 if(data.action==='delete'){emit('delete',{id:String(data.id||'').slice(0,200),userId:String(data.userId||'').slice(0,100),platform:data.platform,...(data.sourceKey?{sourceKey:data.sourceKey}:{})});return json({ok:true});}
 if(data.action==='clear'){emit('clear',{});return json({ok:true});}
 if(data.action==='heartbeat')return json({ok:true});
 if(u.pathname==='/api/bridge'&&traffic[data.platform]&&data.action!=='update'){traffic[data.platform].received++;traffic[data.platform].lastMessageAt=Date.now();}
 const event=relay.ingest(data,state);if(event){emit(event.type,event.message);if(event.type==='message'&&u.pathname==='/api/bridge')traffic[event.message.platform].displayed++;}return json({ok:true,displayed:!!event});}
 return json({error:'Unknown action'},404);
 }
 const files={'/logos/kick.svg':'kick.svg','/dock-layout.mjs':'dock-layout.mjs','/render-timing.mjs':'render-timing.mjs','/render-patch.mjs':'render-patch.mjs','/dock':'dock.html','/dock.js':'dock.js','/poll-compose.mjs':'poll-compose.mjs','/poll-board.mjs':'poll-board.mjs','/poll-overlay':'poll-overlay.html','/poll-overlay.js':'poll-overlay.js','/poll-overlay.css':'poll-overlay.css','/poll-overlay-view.mjs':'poll-overlay-view.mjs','/dock.css':'dock.css','/logos/youtube.svg':'youtube.svg','/logos/tiktok.svg':'tiktok.svg','/logos/twitch.png':'../logos/twitch-purple-logo-png-transparent.png','/logos/youtube.png':'../logos/Youtube_logo.png','/':'index.html','/overlay':'overlay.html','/app.js':'app.js','/connections.js':'connections.js','/overlay.js':'overlay.js','/layouts.mjs':'layouts.mjs','/overlay.css':'overlay.css','/style.css':'style.css','/theme.css':'theme.css','/wiiu.css':'wiiu.css','/core.mjs':'../core.mjs'};
 if(!files[u.pathname])return json({error:'Not found'},404);
 const file=files[u.pathname];res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'})[extname(file)]});res.end(await readFile(join(root,'public',file)));
 }catch(e){if(!res.headersSent)json({error:e.message},400);else res.end();}
});
setInterval(()=>{const removed=polls.prune();for(const poll of removed)emit('poll-remove',poll);if(removed.length)savePolls().catch(()=>{});},1000).unref();
setInterval(()=>{for(const r of clients)r.write(': keepalive\n\n');},20000).unref();
server.listen(3927,'127.0.0.1',()=>console.log('Bubblecast ready: http://127.0.0.1:3927 • OBS: http://127.0.0.1:3927/overlay'));


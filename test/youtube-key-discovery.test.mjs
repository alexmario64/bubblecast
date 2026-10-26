import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {YouTubeOfficial} from '../youtube-official.mjs';
import {streamKeyFingerprint as fp} from '../youtube-slot-matching.mjs';
const main='mmmmmmmmmmm',vertical='vvvvvvvvvvv',mainKey='fixture-private-main-ingestion',verticalKey='fixture-private-vertical-ingestion';
const broadcast=(id,key,time=0)=>({id,snippet:{title:id,actualStartTime:new Date(time).toISOString()},status:{lifeCycleStatus:'live'},contentDetails:{boundStreamId:key}});
async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'bubblecast-key-match-'));t.after(()=>rm(dir,{recursive:true,force:true}));const calls=[],found=[];
 const data={active:[broadcast(vertical,'vertical-id',1000),broadcast(main,'main-id',2000)],upcoming:[],streams:[{id:'vertical-id',status:{streamStatus:'active'},cdn:{ingestionInfo:{streamName:verticalKey}}},{id:'main-id',status:{streamStatus:'active'},cdn:{ingestionInfo:{streamName:mainKey}}}]};
 const options={file:join(dir,'auth.json'),choicesFile:join(dir,'youtube-streams.json'),clientId:'fixture-client',clientSecret:'fixture-secret',schedule:()=>null,cancel:()=>{},request:async(url,init)=>{calls.push({url,init});const u=new URL(url);return {ok:true,status:200,json:async()=>({items:u.pathname.endsWith('/liveBroadcasts')?(u.searchParams.get('broadcastStatus')==='active'?data.active:data.upcoming):data.streams})};},onFound:v=>found.push(v)};
 const yt=new YouTubeOfficial(options);yt.auth={client_id:'fixture-client',access_token:'fixture-access',refresh_token:'fixture-refresh',expires_at:Date.now()+3600000};await yt.save();yt.autoFind(true);yt.setOutputKeys({main:[fp(mainKey)],vertical:[fp(verticalKey)]});
 return {yt,options,data,calls,found,dir};
}
test('reversed API listing maps ingestion keys to the correct OBS main and Aitum slots',async t=>{
 const {yt,calls}=await fixture(t);await yt.findLive();assert.deepEqual(yt.found.map(c=>[c.video,c.slot]),[[main,'youtube'],[vertical,'youtubeShorts']]);assert.equal(yt.candidates.find(c=>c.video===main).formatSource,'obs-main');assert.equal(yt.candidates.find(c=>c.video===vertical).formatSource,'aitum-vertical');
 const metadata=calls.filter(c=>c.url.includes('/liveStreams?'));assert.equal(metadata.length,1);const query=new URL(metadata[0].url).searchParams;assert.equal(query.get('part'),'id,status,cdn');assert.deepEqual(query.get('id').split(','),['vertical-id','main-id']);assert.ok(!JSON.stringify(calls).includes(mainKey));assert.ok(!JSON.stringify(calls).includes(verticalKey));
});
test('exact key matches persist as digests and survive restart with OBS unavailable',async t=>{
 const {yt,options}=await fixture(t);await yt.findLive();const saved=await readFile(options.choicesFile,'utf8');assert.ok(!saved.includes(mainKey));assert.ok(!saved.includes(verticalKey));assert.equal(JSON.parse(saved).matches[fp(verticalKey)],'vertical');
 const next=new YouTubeOfficial(options);await next.load();next.autoFind(true);await next.findLive();assert.deepEqual(next.found.map(c=>[c.video,c.slot]),[[main,'youtube'],[vertical,'youtubeShorts']]);assert.ok(next.candidates.every(c=>c.formatSource==='remembered-key'));
});
test('raw keys and fingerprints never appear in status, found streams or callback payloads',async t=>{
 const {yt,found}=await fixture(t);await yt.findLive();for(const key of [mainKey,verticalKey,fp(mainKey),fp(verticalKey)]){assert.ok(!JSON.stringify(yt.status()).includes(key));assert.ok(!JSON.stringify(yt.candidates).includes(key));assert.ok(!JSON.stringify(found).includes(key));}
});
test('an ingestion-key rotation does not inherit a manual choice for the previous key on the same bound ID',async t=>{
 const {yt,data}=await fixture(t);await yt.findLive();await yt.choose(main,'vertical');assert.equal(yt.candidates.find(c=>c.video===main).formatSource,'manual');const rotated='fixture-rotated-private-main';data.streams.find(s=>s.id==='main-id').cdn.ingestionInfo.streamName=rotated;yt.setOutputKeys({main:[fp(rotated)],vertical:[fp(verticalKey)]});await yt.findLive();assert.equal(yt.candidates.find(c=>c.video===main).format,'horizontal');assert.equal(yt.candidates.find(c=>c.video===main).formatSource,'obs-main');
});
test('manual format takes precedence over matching; Automatic restores the observed match without another API call',async t=>{
 const {yt,calls}=await fixture(t);await yt.findLive();const count=calls.length;await yt.choose(vertical,'horizontal');assert.equal(yt.candidates.find(c=>c.video===vertical).format,'horizontal');await yt.choose(vertical,'auto');assert.equal(yt.candidates.find(c=>c.video===vertical).formatSource,'aitum-vertical');assert.equal(calls.length,count);
});
test('legacy bound-ID preferences migrate to a digest while preserving per-broadcast hiding',async t=>{
 const {yt,data}=await fixture(t);yt.choices.formats['main-id']='vertical';yt.choices.hidden=[vertical];await yt.findLive();assert.equal(yt.choices.formats['main-id'],undefined);assert.equal(yt.choices.formats[fp(mainKey)],'vertical');assert.equal(yt.candidates.find(c=>c.video===vertical).hidden,true);assert.equal(yt.found[0].slot,'youtubeShorts');
 data.active[0].id='sssssssssss';await yt.findLive();assert.equal(yt.candidates.find(c=>c.video==='sssssssssss').hidden,false);
});
test('missing CDN names do not reuse stale bindings and leave format explicitly unmatched',async t=>{
 const {yt,data}=await fixture(t);await yt.findLive();for(const stream of data.streams)delete stream.cdn;await yt.findLive();assert.ok(yt.candidates.every(c=>c.formatSource==='unknown'));
});
test('same ingestion key on both outputs is reported as ambiguous and never guessed into a slot',async t=>{
 const {yt}=await fixture(t);yt.setOutputKeys({main:[fp(mainKey),fp(verticalKey)],vertical:[fp(mainKey),fp(verticalKey)]});await yt.findLive();assert.deepEqual(yt.found,[]);assert.ok(yt.status().candidates.every(c=>c.formatSource==='ambiguous'));
});
test('upcoming receiving status and key matching share one bounded metadata request',async t=>{
 const {yt,data,calls}=await fixture(t);data.upcoming=data.active;data.active=[];await yt.findLive();assert.equal(calls.filter(c=>c.url.includes('/liveStreams?')).length,1);assert.ok(yt.candidates.every(c=>c.receiving));assert.deepEqual(yt.found.map(c=>[c.video,c.slot]),[[main,'youtube'],[vertical,'youtubeShorts']]);
});
test('offline, missing-app and quota-exhausted states never make metadata or discovery requests',async t=>{
 const {yt,calls}=await fixture(t);yt.setLive(false);await yt.findLive();assert.equal(calls.length,0);yt.setLive(true);yt.clientSecret='';await yt.findLive();assert.equal(calls.length,0);yt.clientSecret='fixture-secret';yt.quotaUntil=Date.now()+60000;await yt.findLive();assert.equal(calls.length,0);
});
test('a stopped metadata result cannot save matches or restart a reader',async t=>{
 const {yt,data}=await fixture(t);let finish;yt.request=async url=>({ok:true,status:200,json:()=>url.includes('/liveStreams?')?new Promise(r=>{finish=r;}):Promise.resolve({items:data.active})});const pending=yt.findLive();for(let i=0;i<20&&!finish;i++)await new Promise(r=>setImmediate(r));assert.ok(finish);yt.setLive(false);finish({items:data.streams});await pending;assert.deepEqual(yt.found,[]);assert.deepEqual(yt.choices.matches,{});
});
test('a persistence failure preserves current matching and reports unavailable memory without secret errors',async t=>{
 const {yt,dir}=await fixture(t);const file=join(dir,'not-a-folder');await writeFile(file,'fixture');yt.choicesFile=join(file,'choices.json');await yt.findLive();assert.equal(yt.found.length,2);assert.equal(yt.status().matching.memory,'unavailable');assert.equal(yt.status().discovery.state,'complete');
});

test('untrusted ingestion-metadata errors cannot put a raw stream name into public status',async t=>{
 const {yt,data}=await fixture(t);yt.request=async url=>{if(url.includes('/liveStreams?'))throw Error('unexpected '+mainKey);return {ok:true,status:200,json:async()=>({items:data.active})};};await yt.findLive();assert.equal(yt.status().discovery.state,'error');assert.equal(yt.status().error,'YouTube stream metadata could not be read.');assert.ok(!JSON.stringify(yt.status()).includes(mainKey));
});

import vm from 'node:vm';
const serverCode=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
function orchestration(yt,read){
 let outputs={main:true};const from=serverCode.indexOf('async function checkYouTube('),to=serverCode.indexOf('function streamingChanged()',from);assert.ok(from>0&&to>from);
 const context=vm.createContext({youtube:yt,discovery:{generation:1},outputState:()=>outputs,discoveryBlocked:()=> 'none',obsStreams:read,lastCheck:0,discoveryTrigger:{},diagnostics:{record(){}},diagnosticInput:()=>({}),checkUntil:0,Date});vm.runInContext(serverCode.slice(from,to),context);
 return {context,stop:()=>{outputs={};context.discovery.generation++;yt.setLive(false);}};
}
test('the production bounded-check handler passes only local key digests into API matching',async t=>{
 const {yt}=await fixture(t);yt.setOutputKeys({});let reads=0;const wire=orchestration(yt,async options=>{assert.equal(options.includeKeys,true);reads++;return {keys:{main:[fp(mainKey)],vertical:[fp(verticalKey)]}};});await wire.context.checkYouTube('stream-start');assert.equal(reads,1);assert.deepEqual(yt.found.map(c=>[c.video,c.slot]),[[main,'youtube'],[vertical,'youtubeShorts']]);
});
test('stopping while local OBS inspection is pending cancels discovery before spending YouTube quota',async t=>{
 const {yt,calls}=await fixture(t);let finish;const wire=orchestration(yt,()=>new Promise(r=>{finish=r;}));const pending=wire.context.checkYouTube('stream-start');assert.ok(finish);wire.stop();finish({keys:{main:[fp(mainKey)]}});await pending;assert.equal(calls.length,0);assert.equal(yt.live,false);assert.deepEqual(yt.choices.matches,{});
});

test('quota exhaustion during ingestion matching changes to page policy once and makes no further discovery requests',async t=>{
 const {yt,data}=await fixture(t);let requests=0,exhausted=0;yt.onQuota=()=>exhausted++;yt.request=async url=>{requests++;return url.includes('/liveStreams?')?{ok:false,status:403,json:async()=>({error:{message:mainKey,errors:[{reason:'quotaExceeded'}]}})}:{ok:true,status:200,json:async()=>({items:data.active})};};await yt.findLive();assert.equal(yt.readMode,'page');assert.equal(exhausted,1);assert.equal(requests,2);await yt.findLive();assert.equal(requests,2);assert.ok(!JSON.stringify(yt.status()).includes(mainKey));
});

test('remembered and manual formats follow the ingestion key across new broadcast and bound-stream IDs',async t=>{
 const {yt,options,data}=await fixture(t);await yt.findLive();await yt.choose(vertical,'horizontal');
 data.active=[broadcast('nnnnnnnnnnn','new-main-id'),broadcast('sssssssssss','new-vertical-id')];data.streams[0].id='new-vertical-id';data.streams[1].id='new-main-id';const next=new YouTubeOfficial(options);await next.load();next.autoFind(true);await next.findLive();const v=next.candidates.find(c=>c.video==='sssssssssss'),m=next.candidates.find(c=>c.video==='nnnnnnnnnnn');assert.equal(v.format,'horizontal');assert.equal(v.formatSource,'manual');assert.equal(m.format,'horizontal');assert.equal(m.formatSource,'remembered-key');await next.choose(v.video,'auto');assert.equal(next.candidates.find(c=>c.video===v.video).format,'vertical');assert.equal(next.candidates.find(c=>c.video===v.video).formatSource,'remembered-key');
});

test('unknown API slot guesses cannot finish the bounded checks before local keys become available',()=>{
 const start=serverCode.indexOf('function slotsFilled('),end=serverCode.indexOf('async function checkYouTube(',start);const youtube={pageFallback:false,discovery:{state:'complete',finishedAt:100},candidates:[{video:main,live:true,format:''},{video:vertical,live:true,format:''}]};const context=vm.createContext({youtube,sources:{youtubeFound:[{video:main,slot:'youtube'},{video:vertical,slot:'youtubeShorts'}]},savedSources:{}});vm.runInContext(serverCode.slice(start,end),context);assert.equal(context.slotsFilled({main:true,vertical:true},1),false);youtube.candidates[0].format='horizontal';assert.equal(context.slotsFilled({main:true,vertical:true},1),false);youtube.candidates[1].format='vertical';assert.equal(context.slotsFilled({main:true,vertical:true},1),true);
});

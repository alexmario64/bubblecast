import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,stat,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Diagnostics,diagnosticSnapshot} from '../diagnostics.mjs';

const now=1800000000000;
const configured={sources:{enabled:true,urls:{twitch:'t',youtube:'y',tiktok:'t',kick:'k'}}};
test('diagnostics distinguish active chat, quiet connections, helper failure and disabled sources',()=>{
 const input={...configured,twitchChatReady:true,collector:{active:true,accounts:{tiktok:{signedIn:false}},feeds:{kick:{transport:'network',error:'secret error'}}},youtube:{connected:true,chats:{youtube:{live:true}}},traffic:{tiktok:{received:7,displayed:5,lastMessageAt:now-1000}}};
 const s=diagnosticSnapshot(input,now);
 assert.equal(s.platforms.twitch.state,'connected');assert.equal(s.platforms.twitch.route,'irc');
 assert.equal(s.platforms.youtube.state,'connected');assert.equal(s.platforms.youtube.route,'api');
 assert.equal(s.platforms.kick.state,'error');assert.equal(s.platforms.kick.hasError,true);
 assert.equal(s.platforms.tiktok.state,'receiving');assert.equal(s.platforms.tiktok.session,'signed-out');assert.equal(s.platforms.tiktok.received,7);
 assert.equal(diagnosticSnapshot({...input,collector:{active:false}},now).platforms.kick.state,'helper-offline');
 assert.equal(diagnosticSnapshot({...input,sources:{...input.sources,enabled:false}},now).platforms.tiktok.state,'disabled');
 assert.equal(diagnosticSnapshot({},now).platforms.youtube.state,'not-configured');
 assert.equal(diagnosticSnapshot({sources:{youtubeChannel:'@example'},youtube:{configured:true}},now).platforms.youtube.state,'signin-required');
});
test('missing or stale OBS and Aitum detection stays unknown instead of claiming offline',()=>{
 let obs=diagnosticSnapshot({obs:{checkedAt:now,websocket:'ready',main:false,vertical:false,verticalDetected:false}},now).obs;
 assert.equal(obs.main,false);assert.equal(obs.vertical,null);assert.equal(obs.path,'websocket');
 obs=diagnosticSnapshot({obs:{checkedAt:now,websocket:'unavailable',browserAt:now,browserStreaming:true}},now).obs;
 assert.equal(obs.main,true);assert.equal(obs.vertical,null);assert.equal(obs.path,'browser');
 obs=diagnosticSnapshot({obs:{checkedAt:now-60000,websocket:'ready',main:true,vertical:true,verticalDetected:true,browserAt:now-100000,browserStreaming:true}},now).obs;
 assert.equal(obs.main,null);assert.equal(obs.vertical,null);assert.equal(obs.path,'none');
 assert.equal(diagnosticSnapshot({obs:{checkedAt:now,websocket:'ready',vertical:true,verticalDetected:true}},now).obs.vertical,true);
});
test('diagnostics persist only allowed scalar fields even when every input contains personal data',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'bubblecast-diagnostics-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const secret='PRIVATE-chat-cookie-key-token',file=join(dir,'diagnostics.log');
 const d=new Diagnostics({file,now:()=>now});
 const input={...configured,version:secret,collector:{active:true,version:secret,errors:{kick:secret},feeds:{kick:{error:secret,transport:secret,diagnostics:{wire:[secret],paths:[secret]}}},accounts:{tiktok:{signedIn:true,detail:secret}},youtubeDiscovery:{state:secret,startedAt:NaN,found:Infinity,token:secret}},youtube:{configured:true,connected:true,channel:{title:secret},error:secret,discovery:{state:'complete',found:2,token:secret},chats:{youtube:{live:true,video:secret}}},obs:{checkedAt:now,websocket:secret,streamKey:secret},trigger:{reason:secret,route:secret},renderTiming:{overlay:{kick:{updatedAt:now,messageId:secret}}},message:secret};
 await d.record(input);const text=await readFile(file,'utf8');assert.ok(!text.includes(secret));assert.ok(!JSON.stringify(d.snapshot(input)).includes(secret));
 const saved=JSON.parse(text);assert.equal(saved.platforms.kick.hasError,true);assert.equal(saved.youtube.api.found,2);assert.equal(saved.youtube.page.found,0);assert.equal(saved.version,null);
 if(process.platform!=='win32')assert.equal((await stat(file)).mode&0o777,0o600);
});
test('logging samples counts, records connection transitions and rotates into one bounded backup',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'bubblecast-diagnostics-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const file=join(dir,'diagnostics.log');let time=now;const d=new Diagnostics({file,now:()=>time,maxBytes:12000});
 await d.record(configured);await d.record({...configured,traffic:{twitch:{received:1}}});assert.equal((await readFile(file,'utf8')).trim().split('\n').length,1);
 time+=60000;await d.record({...configured,traffic:{twitch:{received:2}}});assert.equal(JSON.parse((await readFile(file,'utf8')).trim().split('\n').at(-1)).platforms.twitch.received,2);
 time++;await d.record({...configured,collector:{active:true}});assert.equal((await readFile(file,'utf8')).trim().split('\n').length,3);
 for(let i=0;i<12;i++){time+=60000;await d.record(configured);}
 assert.ok((await stat(file)).size<=12000);assert.ok((await stat(file+'.1')).size<=12000);
 for(const path of [file,file+'.1'])for(const line of (await readFile(path,'utf8')).trim().split('\n'))assert.ok(JSON.parse(line).at);
});
test('a log write failure is visible, never throws and recovers on the next sample',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'bubblecast-diagnostics-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const file=join(dir,'diagnostics.log'),d=new Diagnostics({file,now:()=>now});await mkdir(file);
 await d.record({});assert.equal(d.snapshot({}).log.error,true);await rm(file,{recursive:true});
 await d.record({});assert.equal(d.snapshot({}).log.error,false);assert.ok((await readFile(file,'utf8')).length);
});

test('a channel landing page does not count as a filled YouTube chat slot',()=>{
 const sources={youtubeChannel:'@example',urls:{youtube:'https://www.youtube.com/@example/live'}};
 assert.equal(diagnosticSnapshot({sources},now).youtube.slots.horizontal,false);
 sources.urls.youtube='https://www.youtube.com/live_chat?v=abcdefghijk&is_popout=1';assert.equal(diagnosticSnapshot({sources},now).youtube.slots.horizontal,true);
});

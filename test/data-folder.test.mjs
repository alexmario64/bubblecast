import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {isolatedServer} from './server-fixture.mjs';
import {NetworkFeed,youtubeActions} from '../network-chat.mjs';
// The installed app points BUBBLECAST_DATA at the user's app data folder; saving must land there.
test('an installed server saves channels and settings and relays no-app YouTube chat in its data folder',async t=>{
 const {dir,request}=await isolatedServer(t);
 const initial=await (await request('/api/status')).json();assert.equal(initial.diagnostics.platforms.youtube.state,'not-configured');
 const log=await readFile(join(dir,'.local','diagnostics.log'),'utf8');assert.equal(JSON.parse(log.trim()).helper,false);
 const {token}=await (await request('/api/pair')).json();
 const post=async(path,body)=>{const r=await request(path,{method:'POST',headers:{'content-type':'application/json','x-bubblecast-token':token},body:JSON.stringify(body)});assert.equal(r.status,200,path+': '+await r.clone().text());return r.json();};
 await post('/api/sources',{tiktokChannel:'samplestreamer'});
 assert.match(await readFile(join(dir,'sources.json'),'utf8'),/samplestreamer/);
 const settings=await (await request('/api/settings')).json();await post('/api/settings',settings);
 await readFile(join(dir,'settings.json'),'utf8');
 await post('/api/obs/streaming',{streaming:false});const idle=await (await request('/api/status')).json();assert.equal(idle.youtube.live,false,'YouTube waits for a stream, not merely OBS opening');assert.equal(idle.diagnostics.youtube.series.state,'idle');
 assert.equal((await post('/api/obs/streaming',{streaming:true})).live,true);assert.equal((await (await request('/api/status')).json()).youtube.live,true);
 const detected=(await (await request('/api/status')).json()).diagnostics.obs;assert.equal(detected.browser,true);assert.equal(detected.main,true);assert.equal(detected.path,'browser');
 await post('/api/sources',{enabled:true,youtubeChannel:'@example'});
 assert.equal((await (await request('/api/sources')).json()).urls.youtube,'','channel lookup never becomes a chat window');
 await post('/api/collector/status',{active:true,version:'1.33.4'});await post('/api/youtube/check',{});
 const commands=await (await request('/api/collector/commands',{headers:{'X-Bubblecast-Token':token}})).json(),check=commands.commands.find(c=>c.action==='youtube-check');assert.ok(check);
 const result={id:check.id,channel:check.channel};
 const found=(await post('/api/youtube/page-live',{...result,videos:[{video:'abcdefghijk',vertical:true},{video:'bcdefghijkl',vertical:false}]})).found;
 assert.deepEqual(found.map(f=>[f.slot,f.video]),[['youtube','bcdefghijkl'],['youtubeShorts','abcdefghijk']],'the page fallback fills both slots by shape');
 const urls=(await (await request('/api/sources')).json()).urls;assert.match(urls.youtubeShorts,/v=abcdefghijk/);
 const before=(await (await request('/api/sources')).json()).urls;
 assert.equal((await post('/api/youtube/page-live',{...result,videos:[]})).ignored,true,'a consumed/stale probe cannot replace a chat');assert.deepEqual((await (await request('/api/sources')).json()).urls,before);
 const messages=[],feed=new NetworkFeed({platform:'youtube',sourceKey:'youtubeShorts',onMessage:m=>messages.push(m)});
 const batch=id=>({continuationContents:{liveChatContinuation:{actions:[{addChatItemAction:{item:{liveChatTextMessageRenderer:{id,authorName:{simpleText:'Example'},message:{runs:[{text:'fixture chat'},{emoji:{shortcuts:[':dance:'],image:{thumbnails:[{url:'https://yt3.ggpht.com/fixture.gif'}]}}}]}}}}}]}}});
 feed.accept(youtubeActions(batch('old'),'youtubeShorts'),{baseline:true});feed.accept(youtubeActions(batch('new'),'youtubeShorts'));feed.accept(youtubeActions(batch('new'),'youtubeShorts'));assert.equal(messages.length,2);assert.equal(messages[1].action,'update');
 for(const m of messages)await post('/api/bridge',{...m,transport:'desktop'});
 const history=await (await request('/api/chat/history')).json();assert.equal(history.messages.length,1);assert.equal(history.messages[0].id,'new');assert.equal(history.messages[0].sourceKey,'youtubeShorts');assert.equal(history.messages[0].parts[0].text,'fixture chat');assert.equal(history.messages[0].parts[1].src,'https://yt3.ggpht.com/fixture.gif');
 const status=await (await request('/api/status')).json();assert.equal(status.traffic.youtube.received,1);assert.equal(status.diagnostics.youtube.slots.vertical,true);
 await post('/api/apps',{platform:'youtube',clientId:'fixture.apps.googleusercontent.com',clientSecret:'fixture-secret'});
 const signedOut=await (await request('/api/status')).json();assert.equal(signedOut.youtube.readMode,'signin');assert.equal(signedOut.sources.urls.youtube,'');assert.equal((await post('/api/bridge',{...messages[0],id:'must-ignore',transport:'desktop'})).ignored,true);assert.equal((await (await request('/api/chat/history')).json()).messages.length,1);
});

test('quota exhaustion switches the existing API-discovered chats to read-only page capture without changing URLs',async t=>{
 const {request}=await isolatedServer(t,{youtubeFixture:true}),{token}=await (await request('/api/pair')).json();
 const post=async(path,data)=>{const r=await request(path,{method:'POST',headers:{'content-type':'application/json','x-bubblecast-token':token},body:JSON.stringify(data)});assert.equal(r.status,200);return r.json();};
 await post('/api/sources',{enabled:true});await post('/api/collector/status',{active:true,version:'1.33.4'});await post('/api/youtube/check',{});
 const api=await (await request('/api/status')).json();assert.equal(api.youtube.readMode,'api');assert.ok(api.sources.urls.youtube);assert.ok(api.sources.urls.youtubeShorts);assert.equal(api.diagnostics.youtube.route,'api');
 const deadline=Date.now()+5000;let page;
 do{await new Promise(r=>setTimeout(r,25));page=await (await request('/api/status')).json();assert.ok(Date.now()<deadline,'mock quota did not switch the read mode');}while(page.youtube.readMode!=='page');
 assert.deepEqual(page.sources.urls,api.sources.urls,'the helper retains both existing chat windows');assert.equal(page.diagnostics.platforms.youtube.route,'none','an API chat ID does not imply an active API reader after quota exhaustion');
 const commands=await (await request('/api/collector/commands',{headers:{'x-bubblecast-token':token}})).json();assert.equal(commands.commands.length,0,'fallback for known streams needs no discovery or reload command');
 await post('/api/bridge',{platform:'youtube',sourceKey:'youtube',transport:'desktop',id:'quota-page-message',user:'Example',parts:[{type:'text',text:'fixture after quota'}]});assert.equal((await (await request('/api/chat/history')).json()).messages.length,1);
});

for(const change of ['channel','disconnect','expiry'])test('a page probe cannot replace chats after '+change,async t=>{
 const {request,advance}=await isolatedServer(t),{token}=await (await request('/api/pair')).json();
 const post=async(path,data)=>{const r=await request(path,{method:'POST',headers:{'content-type':'application/json','x-bubblecast-token':token},body:JSON.stringify(data)});assert.equal(r.status,200);return r.json();};
 await post('/api/sources',{youtubeChannel:'@first'});await post('/api/collector/status',{active:true,version:'1.33.4'});await post('/api/youtube/check',{});
 const commands=await (await request('/api/collector/commands',{headers:{'x-bubblecast-token':token}})).json(),check=commands.commands[0];assert.equal(check.action,'youtube-check');
 if(change==='channel')await post('/api/sources',{youtubeChannel:'@second'});else if(change==='disconnect')await post('/api/sources',{youtubeChannel:'@first',enabled:false});else await advance(55001);
 assert.equal((await post('/api/youtube/page-live',{id:check.id,channel:check.channel,videos:[{video:'aaaaaaaaaaa'}]})).ignored,true);
 const sources=await (await request('/api/sources')).json();assert.equal(sources.urls.youtube,'');assert.deepEqual(sources.youtubeFound,[]);
});
test('an ordinary API permission failure never enables page-chat fallback',async t=>{
 const {request}=await isolatedServer(t,{youtubeFixture:'forbidden'}),{token}=await (await request('/api/pair')).json();
 const post=async(path,data)=>{const r=await request(path,{method:'POST',headers:{'content-type':'application/json','x-bubblecast-token':token},body:JSON.stringify(data)});assert.equal(r.status,200);return r.json();};
 await post('/api/sources',{enabled:true});await post('/api/collector/status',{active:true,version:'1.33.4'});await post('/api/youtube/check',{});
 const deadline=Date.now()+5000;let status;do{await new Promise(r=>setTimeout(r,25));status=await (await request('/api/status')).json();assert.ok(Date.now()<deadline);}while(!status.youtube.error);
 assert.equal(status.youtube.readMode,'api');assert.equal(status.youtube.quotaUntil,null);assert.equal(status.sources.youtubeLive,undefined);
 assert.equal((await post('/api/bridge',{platform:'youtube',transport:'desktop',id:'blocked-fallback',user:'Example',parts:[{type:'text',text:'fixture'}]})).ignored,true);assert.equal((await (await request('/api/chat/history')).json()).messages.length,0);
});

test('TikTok collector startup and session states reach diagnostics without private fields, preserving anonymous chat',async t=>{
 const {request,dir,advance}=await isolatedServer(t),{token}=await (await request('/api/pair')).json();
 const post=async(path,data)=>{const r=await request(path,{method:'POST',headers:{'content-type':'application/json','x-bubblecast-token':token},body:JSON.stringify(data)});assert.equal(r.status,200);return r.json();};
 await post('/api/sources',{tiktokChannel:'fixture'});
 const report={active:true,version:'1.33.5',accounts:{tiktok:{state:'signed-out',signedIn:false,canSend:false,sessionid:'fixture-private-cookie'}},feeds:{tiktok:{transport:'network',startup:'painted',cookies:['fixture-private-cookie']}}};
 await post('/api/collector/status',report);let status=await (await request('/api/status')).json();assert.equal(status.diagnostics.platforms.tiktok.state,'signin-required');assert.equal(status.diagnostics.platforms.tiktok.startup,'painted');assert.ok(!JSON.stringify(status.collector).includes('fixture-private-cookie'));
 await post('/api/bridge',{platform:'tiktok',sourceKey:'tiktok',id:'fixture-new',user:'Example',parts:[{type:'text',text:'Synthetic offline fixture'}],transport:'desktop'});status=await (await request('/api/status')).json();assert.equal(status.diagnostics.platforms.tiktok.state,'receiving');assert.equal(status.diagnostics.platforms.tiktok.session,'signed-out');assert.equal((await (await request('/api/chat/history')).json()).messages.length,1);
 report.feeds.tiktok.startup='fixture-private-cookie';await post('/api/collector/status',report);status=await (await request('/api/status')).json();assert.equal(status.collector.feeds.tiktok.startup,null);assert.equal(status.diagnostics.platforms.tiktok.startup,'not-started');
 await advance(5001);await new Promise(r=>setTimeout(r,5100));const log=await readFile(join(dir,'.local','diagnostics.log'),'utf8');assert.ok(!log.includes('fixture-private-cookie'));assert.ok(!log.includes('Synthetic offline fixture'));const latest=JSON.parse(log.trim().split('\n').at(-1));assert.equal(latest.platforms.tiktok.startup,'not-started');assert.equal(latest.platforms.tiktok.session,'signed-out');assert.equal(latest.platforms.tiktok.received,1);
});

test('server discovery restores key matches without OBS and never exposes ingestion names or fingerprints in status or logs',async t=>{
 const {request,dir,networkCalls}=await isolatedServer(t,{youtubeFixture:'keys'}),{token}=await (await request('/api/pair')).json();
 const post=async(path,data)=>{const response=await request(path,{method:'POST',headers:{'content-type':'application/json','x-bubblecast-token':token},body:JSON.stringify(data)});assert.equal(response.status,200,await response.clone().text());return response.json();};
 await post('/api/obs/streaming',{streaming:false});await request('/api/status');assert.deepEqual((await networkCalls()).calls,[],'opening OBS or recording offline spends no YouTube quota');
 await post('/api/youtube/check',{});const status=await (await request('/api/status')).json();assert.equal(status.sources.youtubeFound.find(f=>f.slot==='youtube').video,'bbbbbbbbbbb');assert.equal(status.sources.youtubeFound.find(f=>f.slot==='youtubeShorts').video,'aaaaaaaaaaa');assert.ok(status.youtube.candidates.every(c=>c.formatSource==='remembered-key'));
 const outgoing=(await networkCalls()).calls;assert.equal(outgoing.filter(url=>url.includes('/liveStreams?')).length,1);assert.equal(status.youtube.readMode,'api');assert.equal(status.diagnostics.youtube.route,'api');
 const publicText=JSON.stringify(status),log=await readFile(join(dir,'.local','diagnostics.log'),'utf8');for(const secret of ['fixture-main-ingestion-private','fixture-vertical-ingestion-private','sha256:']){assert.ok(!publicText.includes(secret));assert.ok(!log.includes(secret));assert.ok(!JSON.stringify(outgoing).includes(secret));}
 const commands=await (await request('/api/collector/commands',{headers:{'x-bubblecast-token':token}})).json();assert.deepEqual(commands.commands,[],'matching never queues page discovery or platform actions');
});

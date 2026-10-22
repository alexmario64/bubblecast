import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {YouTubeOfficial,YOUTUBE_SCOPE,youtubeRedirectUri,JsonObjects,chatMessage,youtubePoll} from '../youtube-official.mjs';
// A scripted Google: OAuth token endpoint and the YouTube Data API.
function google({scope=YOUTUBE_SCOPE,refresh='refresh-1',live=true,errors={},streams=[]}={}){
 const calls=[];
 const request=async(url,options={})=>{const u=new URL(url);calls.push({url:u,method:options.method||'GET',body:options.body,headers:options.headers});
  const reply=(status,body)=>({ok:status<300,status,json:async()=>body});
  if(u.hostname==='oauth2.googleapis.com'&&u.pathname==='/token'){const grant=options.body.get('grant_type');return grant==='refresh_token'?reply(200,{access_token:'access-2',expires_in:3600}):reply(200,{access_token:'access-1',expires_in:3600,scope,...(refresh?{refresh_token:refresh}:{})});}
  if(u.pathname.endsWith('/channels'))return reply(200,{items:[{id:'UC1',snippet:{title:'My channel'}}]});
  if(u.pathname.endsWith('/videos'))return reply(200,{items:[{id:'aaaaaaaaaaa',liveStreamingDetails:live?{activeLiveChatId:'chat-1',concurrentViewers:'1234'}:{actualEndTime:'2026-01-01T00:00:00Z'}}]});
  const key=u.pathname.split('/youtube/v3/')[1];if(errors[key])return reply(403,{error:{errors:[{reason:errors[key]}]}});
  if(key==='liveChat/messages/stream'){const chunks=streams.shift()||[];return {ok:true,status:200,body:(async function*(){for(const c of chunks)yield new TextEncoder().encode(c);})()};}
  if(key==='liveChat/messages')return reply(200,{id:'msg-1'});if(key==='liveChat/messages/transition')return reply(200,{id:'msg-1'});
  return reply(404,{});};
 return {calls,request};
}
async function signedIn(t,options){const dir=await mkdtemp(join(tmpdir(),'bubblecast-'));t.after(()=>rm(dir,{recursive:true,force:true}));const g=google(options),timers=[],polls=[];
 const messages=[],yt=new YouTubeOfficial({file:join(dir,'youtube-auth.json'),clientId:'client.apps.googleusercontent.com',clientSecret:'installed-secret',request:g.request,schedule:(fn,ms)=>{const h={fn,ms};timers.push(h);return h;},cancel:h=>{if(h)h.cancelled=true;},random:()=>0,onPoll:p=>polls.push(p),onMessage:m=>messages.push(m)});
 const {url}=yt.startSignIn();const state=new URL(url).searchParams.get('state');await yt.callback(new URLSearchParams({state,code:'code-1'}));return {yt,g,timers,polls,messages,dir,url};}
const chatTimer=timers=>timers.find(h=>!h.cancelled&&!h.ran&&h.ms===1000);
const settle=async()=>{for(let i=0;i<30;i++)await new Promise(r=>setImmediate(r));};
test('Google sign-in uses PKCE, the YouTube scope and the local callback, and stores lasting access privately',async t=>{
 const {yt,g,url,dir}=await signedIn(t);const auth=new URL(url).searchParams;
 assert.equal(auth.get('redirect_uri'),youtubeRedirectUri);assert.equal(auth.get('scope'),YOUTUBE_SCOPE);assert.equal(auth.get('code_challenge_method'),'S256');assert.equal(auth.get('access_type'),'offline');assert.ok(!auth.has('client_secret'));
 const exchange=g.calls.find(c=>c.url.hostname==='oauth2.googleapis.com');assert.equal(exchange.body.get('client_secret'),'installed-secret');assert.equal(createHash('sha256').update(exchange.body.get('code_verifier')).digest('base64url'),auth.get('code_challenge'));
 assert.deepEqual(yt.status().channel,{id:'UC1',title:'My channel'});assert.equal(yt.connected,true);
 const saved=JSON.parse(await readFile(join(dir,'youtube-auth.json'),'utf8'));assert.equal(saved.refresh_token,'refresh-1');
});
test('sign-in rejects a wrong state, a missing scope and access without a refresh token',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'bubblecast-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 for(const [options,pattern] of [[{},/did not match/],[{scope:'other'},/not granted/],[{refresh:''},/lasting access/]]){const g=google(options),yt=new YouTubeOfficial({file:join(dir,'a.json'),clientId:'c',clientSecret:'s',request:g.request,schedule:()=>0,cancel:()=>{}});const {url}=yt.startSignIn();const state=pattern.source.includes('match')?'wrong':new URL(url).searchParams.get('state');await assert.rejects(yt.callback(new URLSearchParams({state,code:'x'})),pattern);assert.equal(yt.connected,false);}
});
test('live chats and viewers come from one videos.list call per refresh',async t=>{
 const {yt,g,timers}=await signedIn(t);yt.configure({youtube:'aaaaaaaaaaa',youtubeShorts:'not a video id'});
 {const h=chatTimer(timers);h.ran=true;await h.fn();}
 const videos=g.calls.filter(c=>c.url.pathname.endsWith('/videos'));assert.equal(videos.length,1);assert.equal(videos[0].url.searchParams.get('id'),'aaaaaaaaaaa');assert.equal(videos[0].url.searchParams.get('part'),'liveStreamingDetails');
 assert.deepEqual([yt.viewers.youtube.live,yt.viewers.youtube.viewers],[true,1234]);assert.equal(yt.viewers.youtubeShorts,undefined,'invalid video ids are ignored');
 assert.ok(timers.some(h=>!h.cancelled&&h.ms>=90000&&h.ms<=110000),'refreshes about every 90-110 seconds');
});
test('sending, creating and ending polls use the official live chat endpoints',async t=>{
 const {yt,g,timers,polls}=await signedIn(t);yt.configure({youtube:'aaaaaaaaaaa'});{const h=chatTimer(timers);h.ran=true;await h.fn();}
 assert.deepEqual(await yt.sendChat('youtube','hello'),{status:'submitted',detail:'Sent'});
 const send=g.calls.find(c=>c.url.pathname.endsWith('/liveChat/messages')&&c.method==='POST');assert.deepEqual(JSON.parse(send.body),{snippet:{liveChatId:'chat-1',type:'textMessageEvent',textMessageDetails:{messageText:'hello'}}});
 assert.equal((await yt.createPoll('youtube',{question:'Next?',choices:['Kart','Zelda']})).status,'submitted');
 const poll=JSON.parse(g.calls.filter(c=>c.url.pathname.endsWith('/liveChat/messages')).at(-1).body);assert.deepEqual(poll.snippet.pollDetails,{metadata:{questionText:'Next?',options:[{optionText:'Kart'},{optionText:'Zelda'}]}});assert.equal(polls[0].id,'msg-1');assert.equal(polls[0].sourceKey,'youtube');
 assert.equal((await yt.endPoll('youtube','page-id')).status,'submitted');const end=g.calls.at(-1);assert.equal(end.url.pathname,'/youtube/v3/liveChat/messages/transition');assert.equal(end.url.searchParams.get('id'),'msg-1');assert.equal(end.url.searchParams.get('status'),'closed');
 assert.equal((await yt.sendChat('youtubeShorts','hi')).status,'failed','a stream that is not configured cannot be sent to');
});
test('quota and permission errors explain themselves; expired access refreshes before calls',async t=>{
 const {yt,timers}=await signedIn(t,{errors:{'liveChat/messages':'quotaExceeded'}});yt.configure({youtube:'aaaaaaaaaaa'});{const h=chatTimer(timers);h.ran=true;await h.fn();}
 const r=await yt.sendChat('youtube','hello');assert.equal(r.status,'failed');assert.match(r.detail,/quota/i);
 yt.auth.expires_at=Date.now();await yt.api('channels',{query:{part:'id',mine:'true'}});assert.equal(yt.auth.access_token,'access-2');
});
test('chat is read from the official stream, skipping history and resuming from the last page token',async t=>{
 const now=Date.now(),at=ms=>new Date(now+ms).toISOString(),author={displayName:'Viewer',channelId:'UCv'};
 const page1=JSON.stringify({nextPageToken:'p1',items:[{id:'old',snippet:{type:'textMessageEvent',publishedAt:at(-60000),textMessageDetails:{messageText:'history'}},authorDetails:author},{id:'m1',snippet:{type:'textMessageEvent',publishedAt:at(5000),textMessageDetails:{messageText:'hello :yt-happy:'}},authorDetails:author}]});
 const page2=JSON.stringify({nextPageToken:'p2',items:[{id:'m2',snippet:{type:'superChatEvent',publishedAt:at(6000),superChatDetails:{amountDisplayString:'$5.00',userComment:'gg'}},authorDetails:author},{id:'d1',snippet:{type:'messageDeletedEvent',publishedAt:at(7000),messageDeletedDetails:{deletedMessageId:'m1'}}}]});
 const {yt,g,timers,messages}=await signedIn(t,{streams:[['[',page1.slice(0,40),page1.slice(40)+',\n'+page2,']'],[]]});yt.configure({youtube:'aaaaaaaaaaa'});
 {const h=chatTimer(timers);h.ran=true;await h.fn();}await settle();
 const stream=g.calls.find(c=>c.url.pathname==='/youtube/v3/liveChat/messages/stream');assert.equal(stream.url.searchParams.get('liveChatId'),'chat-1');assert.equal(stream.url.searchParams.get('part'),'id,snippet,authorDetails');assert.ok(!stream.url.searchParams.has('pageToken'));
 assert.deepEqual(messages.map(m=>m.action||m.id),['m1','m2','delete'],'history from before Bubblecast started is skipped');
 assert.deepEqual(messages[0].parts,[{type:'text',text:'hello :yt-happy:'}]);assert.equal(messages[0].user,'Viewer');assert.deepEqual(messages[1].event,{kind:'superchat',title:'$5.00'});assert.equal(messages[2].id,'m1');
 const reconnect=chatTimer(timers);reconnect.ran=true;await reconnect.fn();await settle();
 assert.equal(g.calls.filter(c=>c.url.pathname==='/youtube/v3/liveChat/messages/stream').at(-1).url.searchParams.get('pageToken'),'p2','reconnects resume where the last stream ended');
 yt.configure({});assert.deepEqual(yt.streams,{},'removing the stream stops reading');
});
test('stream helpers parse split JSON and map polls and memberships',()=>{
 const p=new JsonObjects();assert.deepEqual(p.push('[{"a":"}{\\"'),[]);assert.deepEqual(p.push('"},{"b":1}'),[{a:'}{"'},{b:1}]);
 assert.deepEqual(chatMessage({id:'x',snippet:{type:'membershipGiftingEvent',publishedAt:'2026-10-21T00:00:00Z',membershipGiftingDetails:{giftMembershipsCount:5}},authorDetails:{displayName:'Gifter'}}).event,{kind:'giftmembership',title:'Gifted 5 memberships'});
 assert.equal(chatMessage({id:'y',snippet:{type:'pollEvent'}}),null);
 assert.deepEqual(youtubePoll({id:'q',snippet:{pollDetails:{status:'active',metadata:{questionText:'Next?',options:[{optionText:'A',tally:'3'},{optionText:'B',tally:'1'}]}}}}).choices.map(c=>[c.votes,c.percent]),[[3,75],[1,25]]);
});
test('the server keeps serving the overlay font file',async()=>{const server=await readFile(new URL('../server.mjs',import.meta.url),'utf8');assert.match(server,/u\.pathname==='\/fonts\/komika-axis\.ttf'/);});

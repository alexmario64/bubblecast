import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {KickOfficial,KICK_SCOPES,kickRedirectUri} from '../kick-official.mjs';
import {AppKeys} from '../app-keys.mjs';
// A scripted Kick: id.kick.com OAuth and the public API.
function kick({scope=KICK_SCOPES.join(' '),live=true,chat}={}){
 const calls=[];
 const request=async(url,options={})=>{const u=new URL(url);calls.push({url:u,method:options.method||'GET',body:options.body,headers:options.headers});
  const reply=(status,body)=>({ok:status<300,status,json:async()=>body});
  if(u.hostname==='id.kick.com'&&u.pathname==='/oauth/token')return options.body.get('grant_type')==='refresh_token'?reply(200,{access_token:'access-2',refresh_token:'refresh-2',expires_in:3600}):reply(200,{access_token:'access-1',refresh_token:'refresh-1',expires_in:3600,scope});
  if(u.hostname==='id.kick.com'&&u.pathname==='/oauth/revoke')return reply(200,{});
  if(u.pathname==='/public/v1/users')return reply(200,{data:[{user_id:7,name:'SampleStreamer'}]});
  if(u.pathname==='/public/v1/channels')return reply(200,{data:(u.searchParams.get('slug')==='samplestreamer'||u.searchParams.get('broadcaster_user_id')==='7')?[{broadcaster_user_id:7,slug:'samplestreamer',stream:{is_live:live,viewer_count:42}}]:[]});
  if(u.pathname==='/public/v1/chat')return chat?chat(options):reply(200,{data:{is_sent:true,message_id:'m1'}});
  return reply(404,{});};
 return {calls,request};
}
async function signedIn(t,options){const dir=await mkdtemp(join(tmpdir(),'bubblecast-'));t.after(()=>rm(dir,{recursive:true,force:true}));const k=kick(options),timers=[];
 const client=new KickOfficial({file:join(dir,'kick-auth.json'),request:k.request,schedule:(fn,ms)=>{const h={fn,ms};timers.push(h);return h;},cancel:h=>{if(h)h.cancelled=true;},random:()=>0});client.setApp({clientId:'my-kick-app',clientSecret:'kick-secret'});
 const {url}=client.startSignIn();await client.callback(new URLSearchParams({state:new URL(url).searchParams.get('state'),code:'code-1'}));return {client,k,timers,dir,url};}
const run=async timers=>{const h=timers.find(x=>!x.cancelled&&!x.ran);h.ran=true;await h.fn();};
test('Kick sign-in uses the streamer’s own app with PKCE and the local callback, and stores access privately',async t=>{
 const {client,k,url,dir}=await signedIn(t);const auth=new URL(url).searchParams;
 assert.equal(new URL(url).origin,'https://id.kick.com');assert.equal(auth.get('client_id'),'my-kick-app');assert.equal(auth.get('redirect_uri'),kickRedirectUri);assert.equal(auth.get('scope'),'user:read channel:read chat:write');assert.equal(auth.get('code_challenge_method'),'S256');assert.ok(!auth.has('client_secret'));
 const exchange=k.calls.find(c=>c.url.pathname==='/oauth/token');assert.equal(exchange.body.get('client_secret'),'kick-secret');assert.equal(createHash('sha256').update(exchange.body.get('code_verifier')).digest('base64url'),auth.get('code_challenge'));
 assert.deepEqual(client.status().user,{id:7,name:'SampleStreamer'});const saved=JSON.parse(await readFile(join(dir,'kick-auth.json'),'utf8'));assert.equal(saved.refresh_token,'refresh-1');assert.equal(saved.client_id,'my-kick-app');
 if(process.platform!=='win32')assert.equal((await stat(join(dir,'kick-auth.json'))).mode&0o777,0o600);
});
test('Kick sign-in is refused without app keys, with a mismatched state or missing permissions',async t=>{
 const plain=new KickOfficial({file:'unused'});assert.throws(()=>plain.startSignIn(),/Kick app/);
 const dir=await mkdtemp(join(tmpdir(),'bubblecast-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const client=new KickOfficial({file:join(dir,'a.json'),request:kick({scope:'user:read'}).request});client.setApp({clientId:'my-kick-app',clientSecret:'s'});
 client.startSignIn();await assert.rejects(client.callback(new URLSearchParams({state:'wrong',code:'c'})),/did not match/);
 const {url}=client.startSignIn();await assert.rejects(client.callback(new URLSearchParams({state:new URL(url).searchParams.get('state'),code:'c'})),/every permission/);assert.equal(client.connected,false);
});
test('Kick finds the channel, reports live viewers and sends one message as the signed-in user',async t=>{
 const {client,k,timers}=await signedIn(t);assert.equal((await client.sendChat('hi')).status,'failed','no channel yet');
 client.configure('SampleStreamer');await run(timers);assert.equal(client.status().ready,true);assert.deepEqual({live:client.viewers.live,viewers:client.viewers.viewers},{live:true,viewers:42});
 assert.equal(timers.at(-1).ms,90000,'channel checks are spaced out');
 assert.equal((await client.sendChat('hello Kick')).status,'submitted');const sent=k.calls.find(c=>c.url.pathname==='/public/v1/chat');assert.deepEqual(JSON.parse(sent.body),{type:'user',broadcaster_user_id:7,content:'hello Kick'});assert.equal(sent.headers.Authorization,'Bearer access-1');
 assert.equal((await client.sendChat('x'.repeat(501))).status,'failed');
});
test('a Kick send with no answer is unknown and never retried; a refusal is a failure',async t=>{
 let attempts=0;const {client,timers}=await signedIn(t,{chat:()=>{attempts++;throw new TypeError('network down');}});client.configure('samplestreamer');await run(timers);
 assert.equal((await client.sendChat('hello')).status,'unknown');assert.equal(attempts,1);
 const refused=await signedIn(t,{chat:()=>({ok:false,status:403,json:async()=>({message:'Forbidden'})})});refused.client.configure('samplestreamer');await run(refused.timers);
 const result=await refused.client.sendChat('hello');assert.equal(result.status,'failed');assert.match(result.detail,/not allowed/);
});
test('an unknown Kick channel is reported instead of sending anywhere',async t=>{
 const {client,timers}=await signedIn(t);client.configure('someone-else');await run(timers);assert.match(client.status().error,/not found/);assert.equal((await client.sendChat('hi')).status,'failed');
});
test('disconnecting revokes the token and forgets it locally',async t=>{
 const {client,k,dir}=await signedIn(t);await client.disconnect();assert.equal(client.connected,false);await assert.rejects(readFile(join(dir,'kick-auth.json')));assert.ok(k.calls.some(c=>c.url.pathname==='/oauth/revoke'));
});
test('saved access is dropped when the streamer switches to a different Kick app',async t=>{
 const {dir}=await signedIn(t);const next=new KickOfficial({file:join(dir,'kick-auth.json')});next.setApp({clientId:'another-app',clientSecret:'s'});await next.load();assert.equal(next.connected,false);
 const same=new KickOfficial({file:join(dir,'kick-auth.json')});same.setApp({clientId:'my-kick-app',clientSecret:'s'});await same.load();assert.equal(same.connected,true);
});
test('app keys are saved privately, validated, and never returned to the page',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'bubblecast-'));t.after(()=>rm(dir,{recursive:true,force:true}));const file=join(dir,'app-keys.json'),keys=new AppKeys({file});
 await keys.set('youtube',{clientId:'123-abc.apps.googleusercontent.com',clientSecret:'GOCSPX-secret'});await keys.set('kick',{clientId:'01KICKAPP',clientSecret:'kick-secret'});
 assert.deepEqual(keys.public(),{youtube:{clientId:'123-abc.apps.googleusercontent.com',hasSecret:true},kick:{clientId:'01KICKAPP',hasSecret:true}});assert.ok(!JSON.stringify(keys.public()).includes('secret"'));
 await keys.set('kick',{clientId:'01KICKAPP',clientSecret:''});assert.equal(keys.get('kick').clientSecret,'kick-secret','an empty secret keeps the saved one for the same app');
 await keys.set('kick',{clientId:'02OTHER',clientSecret:''});assert.equal(keys.get('kick').clientSecret,'','a different app never inherits the old secret');
 await assert.rejects(keys.set('youtube',{clientId:'not-a-google-id'}),/Google client ID/);await assert.rejects(keys.set('twitch',{clientId:'x'}),/Unknown/);
 const again=new AppKeys({file});await again.load();assert.equal(again.get('youtube').clientSecret,'GOCSPX-secret');
 if(process.platform!=='win32')assert.equal((await stat(file)).mode&0o777,0o600);
});

test('Kick discovers its own channel by authenticated user ID, not display name, and keeps it across restarts',async t=>{
 const {client,k,timers,dir}=await signedIn(t);await run(timers);
 assert.equal(client.auth.channel,'samplestreamer');assert.equal(client.status().channel,'samplestreamer');assert.equal(client.status().ready,true);
 const lookup=k.calls.find(c=>c.url.pathname==='/public/v1/channels');assert.equal(lookup.url.searchParams.get('broadcaster_user_id'),'7');assert.equal(lookup.url.searchParams.has('slug'),false);
 const saved=JSON.parse(await readFile(join(dir,'kick-auth.json'),'utf8'));assert.equal(saved.channel,'samplestreamer');
 const next=new KickOfficial({file:join(dir,'kick-auth.json')});next.setApp({clientId:'my-kick-app',clientSecret:'s'});await next.load();assert.equal(next.auth.channel,'samplestreamer');
});
test('disabled Kick sources do not discover a channel after sign-in',async t=>{
 const {client,k,timers}=await signedIn(t);client.configure('',{enabled:false});assert.ok(timers.every(h=>h.cancelled));assert.equal(k.calls.some(c=>c.url.pathname==='/public/v1/channels'),false);
 client.configure('',{enabled:true});await run(timers);assert.equal(client.auth.channel,'samplestreamer');
});
test('saved Kick access without a remembered channel can discover it at startup',async t=>{
 const {dir,k}=await signedIn(t);const timers=[];const next=new KickOfficial({file:join(dir,'kick-auth.json'),request:k.request,schedule:(fn,ms)=>{const h={fn,ms};timers.push(h);return h;},cancel:h=>{if(h)h.cancelled=true;}});next.setApp({clientId:'my-kick-app',clientSecret:'s'});await next.load();next.configure('');await run(timers);assert.equal(next.auth.channel,'samplestreamer');assert.equal(next.status().ready,true);
});
test('a late own-channel lookup cannot re-enable disconnected Kick sources',async t=>{
 const {client,k,timers}=await signedIn(t);let release,started;const waiting=new Promise(resolve=>{started=resolve;});client.request=async(url,options)=>{if(new URL(url).pathname==='/public/v1/channels'){started();return new Promise(resolve=>{release=()=>resolve({ok:true,json:async()=>({data:[{broadcaster_user_id:7,slug:'samplestreamer'}]})});});}return k.request(url,options);};
 const lookup=run(timers);await waiting;client.configure('',{enabled:false});release();await lookup;assert.equal(client.auth.channel,undefined);assert.equal(client.status().ready,false);assert.equal(client.channel,'');
});

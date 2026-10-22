import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {redemption,poll,TwitchOfficial,TWITCH_CLIENT_ID} from '../twitch-official.mjs';
test('redemptions without text become events; polls map to the shared poll model',()=>{
 const e={id:'r1',user_id:'7',user_name:'Viewer',user_input:'',reward:{id:'w1',title:'poyo',cost:750}};
 assert.deepEqual(redemption(e,new Map([['w1',{color:'#FFD37A',image:'https://static-cdn.jtvnw.net/custom-reward-images/default-4.png'}]])),{platform:'twitch',sourceKey:'twitch',id:'reward-r1',user:'Viewer',userId:'7',parts:[],event:{kind:'redemption',title:'poyo',amount:750,color:'#FFD37A',image:'https://static-cdn.jtvnw.net/custom-reward-images/default-4.png'}});
 assert.equal(redemption({...e,user_input:'with text'}),null);
 const p={id:'p1',title:'Next game?',choices:[{id:'a',title:'Kart',votes:3},{id:'b',title:'Zelda'}],ends_at:'2026-10-21T20:00:00Z'};
 assert.deepEqual(poll(p,'channel.poll.progress'),{platform:'twitch',sourceKey:'twitch',id:'p1',question:'Next game?',status:'active',choices:[{id:'a',text:'Kart',votes:3},{id:'b',text:'Zelda',votes:0}],endsAt:Date.parse('2026-10-21T20:00:00Z')});
 assert.equal(poll({...p,status:'terminated'},'channel.poll.end').status,'terminated');assert.equal(poll({...p,status:'completed'},'channel.poll.end').status,'completed');
});
// A scripted Twitch: OAuth, Helix and one EventSub socket, all fake.
function fake(t,{owner=true,tokens}={}){
 const calls=[],timers=[];let socket;
 class Socket{constructor(url){this.url=url;this.listeners={};socket=this;}addEventListener(k,f){this.listeners[k]=f;}close(){this.closed=true;}emit(m){return this.listeners.message({data:JSON.stringify(m)});}}
 const responses={'/device':{device_code:'dev',user_code:'ABCD1234',verification_uri:'https://www.twitch.tv/activate?device-code=ABCD1234',expires_in:1800,interval:5},'/validate':{user_id:owner?'100':'200',login:owner?'streamer':'mod',scopes:[]},'/users?login=streamer':{data:[{id:'100',login:'streamer'}]},'/chat/badges/global':{data:[{set_id:'subscriber',versions:[{id:'12',image_url_4x:'https://static-cdn.jtvnw.net/badges/v1/sub/3',title:'1-Year Subscriber'}]}]},'/channel_points/custom_rewards?broadcaster_id=100':{data:[{id:'w1',title:'Hydrate!',cost:300,background_color:'#00C7AC'}]},'/streams?user_id=100':{data:[{viewer_count:42}]},'/chat/messages':{data:[{is_sent:true}]},'/polls':{data:[{id:'p1',title:'Q?',choices:[{id:'a',title:'A'},{id:'b',title:'B'}]}]}};
 let tokenReplies=tokens||[{status:400,body:{message:'authorization_pending'}},{status:200,body:{access_token:'at',refresh_token:'rt',expires_in:14400}}];
 const request=async(url,options={})=>{const path=url.replace(/^https:\/\/(id\.twitch\.tv\/oauth2|api\.twitch\.tv\/helix)/,'');calls.push({path,method:options.method||'GET',headers:options.headers,body:options.body});
  if(path==='/token'){const r=tokenReplies.shift()||{status:200,body:{access_token:'at2',refresh_token:'rt2',expires_in:14400}};return {ok:r.status===200,status:r.status,json:async()=>r.body};}
  if(path==='/eventsub/subscriptions')return {ok:true,status:202,json:async()=>({data:[{}]})};
  const key=Object.keys(responses).find(k=>path===k||path.startsWith('/chat/badges?')&&k==='/chat/badges/global');const body=responses[key]||{data:[]};return {ok:true,status:200,json:async()=>body};};
 const schedule=(fn,ms)=>{const h={fn,ms};timers.push(h);return h;},cancel=h=>{if(h)h.cancelled=true;};
 const run=async(predicate=()=>true)=>{const due=timers.filter(h=>!h.cancelled&&!h.ran&&predicate(h));for(const h of due){h.ran=true;await h.fn();}};
 return {calls,timers,run,get socket(){return socket;},Socket,request,schedule,cancel};
}
test('Device Code sign-in waits for approval, validates, saves the token privately and connects',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'bubblecast-')),file=join(dir,'twitch-auth.json');t.after(()=>rm(dir,{recursive:true,force:true}));
 const f=fake(t),messages=[],polls=[],twitch=new TwitchOfficial({file,request:f.request,Socket:f.Socket,schedule:f.schedule,cancel:f.cancel,random:()=>0,onMessage:m=>messages.push(m),onPoll:p=>polls.push(p)});
 twitch.configure('streamer');const pending=await twitch.startSignIn();assert.equal(pending.userCode,'ABCD1234');assert.match(pending.verificationUri,/twitch\.tv\/activate/);
 const device=f.calls.find(c=>c.path==='/device');assert.equal(device.body.get('client_id'),TWITCH_CLIENT_ID);assert.ok(!device.body.has('client_secret'));
 await f.run(h=>h.ms===5000);assert.equal(twitch.connected,false,'still pending');await f.run(h=>h.ms===5000);
 assert.equal(twitch.connected,true);assert.equal(twitch.auth.login,'streamer');if(process.platform!=='win32')assert.equal((await stat(file)).mode&0o777,0o600);assert.equal(JSON.parse(await readFile(file,'utf8')).refresh_token,'rt');
 for(let i=0;i<50&&!f.socket;i++)await new Promise(r=>setImmediate(r));assert.match(f.socket.url,/eventsub\.wss\.twitch\.tv/);
 await f.socket.emit({metadata:{message_type:'session_welcome'},payload:{session:{id:'s1',keepalive_timeout_seconds:10}}});
 const subs=f.calls.filter(c=>c.path==='/eventsub/subscriptions').map(c=>JSON.parse(c.body).type);assert.deepEqual(subs,['channel.channel_points_custom_reward_redemption.add','channel.poll.begin','channel.poll.progress','channel.poll.end'],'chat comes from the chat connection, EventSub only adds redemptions and polls');assert.equal(JSON.parse(f.calls.find(c=>c.path==='/eventsub/subscriptions').body).transport.session_id,'s1');
 const note={metadata:{message_type:'notification',message_id:'x1'},payload:{subscription:{type:'channel.channel_points_custom_reward_redemption.add'},event:{id:'r9',user_name:'Viewer',user_input:'',reward:{id:'w1',title:'Hydrate!',cost:300}}}};
 await f.socket.emit(note);await f.socket.emit(note);assert.equal(messages.length,1,'duplicate deliveries are dropped');assert.equal(messages[0].event.title,'Hydrate!');assert.equal(messages[0].event.color,'#00C7AC','reward color comes from the reward list');
 assert.deepEqual(twitch.badgeList('subscriber/12,unknown/1','subscriber/14'),[{src:'https://static-cdn.jtvnw.net/badges/v1/sub/3',alt:'1-Year Subscriber',label:'14'}]);
 assert.deepEqual(await twitch.sendChat('hello'),{status:'submitted',detail:'Sent'});assert.deepEqual(JSON.parse(f.calls.find(c=>c.path==='/chat/messages').body),{broadcaster_id:'100',sender_id:'100',message:'hello'});
 assert.equal((await twitch.createPoll({question:'Q?',choices:['A','B'],duration:120})).status,'submitted');assert.equal(polls[0].status,'active');
 assert.equal((await twitch.endPoll('p1')).status,'submitted');assert.deepEqual(JSON.parse(f.calls.filter(c=>c.path==='/polls').at(-1).body),{broadcaster_id:'100',id:'p1',status:'TERMINATED'});
 await f.run(h=>h.ms===3000);assert.deepEqual([twitch.viewers.live,twitch.viewers.viewers],[true,42]);
 twitch.stop();
});
test('moderators can send chat but get no owner-only events or polls, and expired tokens refresh once',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'bubblecast-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const f=fake(t,{owner:false,tokens:[]}),twitch=new TwitchOfficial({file:join(dir,'a.json'),request:f.request,Socket:f.Socket,schedule:f.schedule,cancel:f.cancel,random:()=>0});
 twitch.auth={access_token:'old',refresh_token:'rt',expires_at:Date.now()+1000,user_id:'200',login:'mod'};twitch.configure('streamer');for(let i=0;i<50&&!twitch.broadcaster;i++)await new Promise(r=>setImmediate(r));
 assert.ok(f.calls.some(c=>c.path==='/token'&&c.body.get('grant_type')==='refresh_token'),'a token about to expire is refreshed before use');
 assert.equal(f.socket,undefined,'a moderator needs no EventSub connection');assert.equal(twitch.ready,true,'moderators can still send chat');
 assert.equal((await twitch.createPoll({question:'Q?',choices:['A','B'],duration:120})).status,'failed');twitch.stop();
});

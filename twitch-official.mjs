// Official Twitch connection: Device Code sign-in, EventSub WebSocket and Helix.
// Runs in the local server. No secret is needed: the app is a Public Twitch client.
import {errorText} from './net-errors.mjs';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {dirname} from 'node:path';
export const TWITCH_CLIENT_ID='yxei290g7kg2xheueg1esf32moozc0';
export const TWITCH_SCOPES=['user:read:chat','user:write:chat','channel:read:subscriptions','channel:read:redemptions','channel:manage:redemptions','channel:manage:polls'];
const ID='https://id.twitch.tv/oauth2',HELIX='https://api.twitch.tv/helix',EVENTSUB='wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=30';

// ---- EventSub event mapping (pure) ----
// Chat, subs and raids come from Twitch's chat connection (twitch-live.mjs), which alone carries GIFs.
// EventSub adds what chat cannot: text-free redemptions and poll updates.
// Redemptions with text also arrive as a chat message carrying the reward id; only text-free ones are taken here.
// A Twitch reward as Bubblecast uses it; Twitch's cooldown is off (0) or 1 s and up.
export function rewardInfo(r){return {id:r.id,title:r.title||'',cost:r.cost||0,paused:!!r.is_paused,enabled:r.is_enabled!==false,cooldown:r.global_cooldown_setting?.is_enabled?r.global_cooldown_setting.global_cooldown_seconds||0:0};}
function rewardBody({title,cost,cooldown,paused,prompt}){const b={};if(title!=null)b.title=String(title).slice(0,45);if(cost!=null)b.cost=Math.max(1,Math.round(cost));
 if(cooldown!=null){b.is_global_cooldown_enabled=cooldown>0;if(cooldown>0)b.global_cooldown_seconds=Math.round(cooldown);}if(paused!=null)b.is_paused=!!paused;
 if(prompt){b.is_user_input_required=true;b.prompt='Your message is read aloud on stream.';}return b;}
export function redemption(e,rewards=new Map()){
 if(!e?.id||!e.reward||String(e.user_input||'').trim())return null;const reward=rewards.get(e.reward.id);
 return {platform:'twitch',sourceKey:'twitch',id:'reward-'+e.id,user:e.user_name||e.user_login||'Someone',userId:e.user_id||'',parts:[],event:{kind:'redemption',title:e.reward.title,amount:e.reward.cost,color:reward?.color,image:reward?.image}};
}
export function poll(e,type){
 if(!e?.id||!e.title||!Array.isArray(e.choices))return null;
 const status=type==='channel.poll.end'?(e.status==='completed'?'completed':e.status==='terminated'?'terminated':'closed'):'active';
 return {platform:'twitch',sourceKey:'twitch',id:e.id,question:e.title,status,choices:e.choices.map(c=>({id:c.id,text:c.title,votes:Number(c.votes??0)})),endsAt:e.ends_at?Date.parse(e.ends_at):null};
}

// ---- Connection ----
export class TwitchOfficial{
 constructor({file,request=fetch,Socket=WebSocket,now=Date.now,schedule=setTimeout,cancel=clearTimeout,random=Math.random,onMessage=()=>{},onPoll=()=>{},onAuth=()=>{},onRedemption=()=>{},onRewardChange=()=>{}}){
  Object.assign(this,{file,request,Socket,now,schedule,cancel,random,onMessage,onPoll,onAuth,onRedemption,onRewardChange});
  this.auth=null;this.pending=null;this.channel='';this.broadcaster=null;this.socket=null;this.session=null;this.subscribed=[];this.failed=[];this.error=null;this.viewers=null;this.badges=new Map();this.rewards=new Map();this.seen=new Set();this.timers={};this.generation=0;
 }
 async load(){try{this.auth=JSON.parse(await readFile(this.file,'utf8'));}catch{this.auth=null;}this.timer('validate',()=>this.validate(),1000);}
 async save(){await mkdir(dirname(this.file),{recursive:true});await writeFile(this.file,JSON.stringify(this.auth),{mode:0o600});}
 timer(name,fn,ms){this.cancel(this.timers[name]);this.timers[name]=this.schedule(()=>{this.timers[name]=null;return fn();},ms);}
 get connected(){return !!this.auth?.access_token;}
 get ready(){return !!(this.connected&&this.broadcaster);}
 get isBroadcaster(){return !!(this.broadcaster&&this.auth?.user_id===this.broadcaster.id);}
 // ---- The text-to-speech reward. Twitch only lets an app change rewards that app created. ----
 get canManageRewards(){return this.isBroadcaster&&(this.auth?.scopes||[]).includes('channel:manage:redemptions');}
 async findReward(id){if(!id||!this.isBroadcaster)return null;const r=(await this.helix('/channel_points/custom_rewards?broadcaster_id='+this.broadcaster.id+'&id='+encodeURIComponent(id))).data?.[0];return r?rewardInfo(r):null;}
 async rewardManaged(id){if(!this.canManageRewards||!id)return false;try{return !!(await this.helix('/channel_points/custom_rewards?broadcaster_id='+this.broadcaster.id+'&only_manageable_rewards=true&id='+encodeURIComponent(id))).data?.length;}catch{return false;}}
 // Every reward on the channel, to link one that already exists by name.
 async listRewards(){if(!this.isBroadcaster)return [];return ((await this.helix('/channel_points/custom_rewards?broadcaster_id='+this.broadcaster.id)).data||[]).map(rewardInfo);}
 async createReward({title,cost,cooldown}){if(!this.canManageRewards)throw Error('Reconnect Twitch to let Bubblecast manage channel point rewards.');
  const r=(await this.helix('/channel_points/custom_rewards?broadcaster_id='+this.broadcaster.id,{method:'POST',body:rewardBody({title,cost,cooldown,prompt:true})})).data?.[0];return r?rewardInfo(r):null;}
 async updateReward(id,changes){if(!this.canManageRewards)throw Error('Reconnect Twitch to let Bubblecast manage channel point rewards.');
  const r=(await this.helix('/channel_points/custom_rewards?broadcaster_id='+this.broadcaster.id+'&id='+encodeURIComponent(id),{method:'PATCH',body:rewardBody(changes)})).data?.[0];return r?rewardInfo(r):null;}
 // Whether channel point redemptions reach Bubblecast: the channel owner must be connected.
 get redemptionsReady(){return this.connected&&!!this.isBroadcaster&&!!this.broadcaster;}
 status(){return {connected:this.connected,login:this.auth?.login||'',channel:this.channel,ready:this.ready,broadcaster:this.isBroadcaster,pending:this.pending&&this.pending.expiresAt>this.now()?{userCode:this.pending.userCode,verificationUri:this.pending.verificationUri,expiresAt:this.pending.expiresAt}:null,missing:this.failed,error:this.error,viewers:this.viewers};}
 async form(path,fields){const r=await this.request(ID+path,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(fields),signal:AbortSignal.timeout(10000)});let body={};try{body=await r.json();}catch{}return {ok:r.ok,status:r.status,body};}

 // Device Code sign-in: the streamer enters a short code at twitch.tv/activate.
 async startSignIn(){
  const {ok,body}=await this.form('/device',{client_id:TWITCH_CLIENT_ID,scopes:TWITCH_SCOPES.join(' ')});
  if(!ok||!body.device_code)throw Error(body.message||'Twitch did not start sign-in. Try again.');
  this.pending={deviceCode:body.device_code,userCode:body.user_code,verificationUri:body.verification_uri,expiresAt:this.now()+body.expires_in*1000,interval:Math.max(5,body.interval||5)*1000};this.error=null;
  this.timer('device',()=>this.pollDevice(),this.pending.interval);return this.status().pending;
 }
 async pollDevice(){
  const p=this.pending;if(!p)return;if(p.expiresAt<=this.now()){this.pending=null;this.error='The Twitch sign-in code expired. Start again.';return;}
  try{const {ok,body}=await this.form('/token',{client_id:TWITCH_CLIENT_ID,scopes:TWITCH_SCOPES.join(' '),device_code:p.deviceCode,grant_type:'urn:ietf:params:oauth:grant-type:device_code'});
   if(this.pending!==p)return;
   if(ok&&body.access_token){this.pending=null;await this.accept(body);return;}
   const reason=String(body.message||'');if(/slow_down/i.test(reason))p.interval+=5000;else if(!/authorization_pending/i.test(reason)){this.pending=null;this.error=/denied/i.test(reason)?'Twitch sign-in was declined.':'Twitch sign-in did not finish. Start again.';return;}
  }catch{}this.timer('device',()=>this.pollDevice(),p.interval);
 }
 async accept(token){
  this.auth={access_token:token.access_token,refresh_token:token.refresh_token,expires_at:this.now()+(token.expires_in||0)*1000};
  if(!await this.validate())return;await this.save();this.reconnect();this.onAuth();
 }
 // Twitch requires apps to validate tokens hourly.
 async validate(){
  if(!this.auth)return false;
  try{const r=await this.request(ID+'/validate',{headers:{Authorization:'OAuth '+this.auth.access_token},signal:AbortSignal.timeout(10000)});
   if(r.status===401){if(!await this.refresh())return false;return this.validate();}
   if(r.ok){const v=await r.json();Object.assign(this.auth,{user_id:v.user_id,login:v.login,scopes:v.scopes||[]});}
  }catch{}this.timer('validate',()=>this.validate(),3600000);return true;
 }
 async refresh(){
  if(!this.auth?.refresh_token){await this.forget('Twitch sign-in ended. Connect Twitch again.');return false;}
  const {ok,body}=await this.form('/token',{client_id:TWITCH_CLIENT_ID,grant_type:'refresh_token',refresh_token:this.auth.refresh_token});
  if(!ok||!body.access_token){await this.forget('Twitch sign-in ended. Connect Twitch again.');return false;}
  Object.assign(this.auth,{access_token:body.access_token,refresh_token:body.refresh_token||this.auth.refresh_token,expires_at:this.now()+(body.expires_in||0)*1000});await this.save();return true;
 }
 async forget(error=null){this.auth=null;this.pending=null;this.error=error;this.stop();for(const name of ['device','validate'])this.cancel(this.timers[name]);await rm(this.file,{force:true});this.onAuth();}
 async disconnect(){const token=this.auth?.access_token;await this.forget();if(token)try{await this.form('/revoke',{client_id:TWITCH_CLIENT_ID,token});}catch{}}
 async helix(path,{method='GET',body}={},retry=true){
  if(!this.auth)throw Error('Connect Twitch first.');if(this.auth.expires_at&&this.auth.expires_at-this.now()<60000)await this.refresh();
  const r=await this.request(HELIX+path,{method,headers:{'Client-Id':TWITCH_CLIENT_ID,Authorization:'Bearer '+this.auth?.access_token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});
  if(r.status===401&&retry&&await this.refresh())return this.helix(path,{method,body},false);
  if(r.status===204)return {};let json={};try{json=await r.json();}catch{}
  if(r.status===401)throw Error('Twitch sign-in expired. Connect Twitch again in Connections.');
  if(!r.ok)throw Error(json.message||'Twitch returned HTTP '+r.status);return json;
 }

 // ---- EventSub ----
 configure(channel){channel=String(channel||'').toLowerCase();if(!/^[a-z0-9_]{1,25}$/.test(channel))channel='';if(channel===this.channel)return;this.channel=channel;this.reconnect();}
 // Stops the event connection only; sign-in and hourly validation keep their own timers.
 stop(){this.generation++;for(const name of ['keepalive','retry','viewers'])this.cancel(this.timers[name]);const socket=this.socket;this.socket=null;this.session=null;socket?.close();this.broadcaster=null;this.viewers=null;}
 reconnect(){this.stop();if(this.connected&&this.channel)this.start(this.generation).catch(error=>{this.error=errorText(error,'Twitch');this.timer('retry',()=>this.reconnect(),60000);});}
 async start(generation){
  const user=(await this.helix('/users?login='+encodeURIComponent(this.channel))).data?.[0];if(generation!==this.generation)return;
  if(!user)throw Error('Twitch channel '+this.channel+' was not found.');this.broadcaster={id:user.id,login:user.login};this.error=null;
  await this.loadBadges();if(this.isBroadcaster)await this.loadRewards();if(generation!==this.generation)return;
  if(this.isBroadcaster)this.open(EVENTSUB,generation);this.timer('viewers',()=>this.refreshViewers(generation),3000);
 }
 badgeList(tag,info){const months=Object.fromEntries(String(info||'').split(',').filter(Boolean).map(b=>b.split('/')));return String(tag||'').split(',').filter(Boolean).map(b=>{const [set,version]=b.split('/'),image=this.badges.get(set+'/'+version);return image?{src:image.src,alt:image.title||set,...(set==='subscriber'&&months.subscriber?{label:months.subscriber}:{})}:null;}).filter(Boolean);}
 async loadBadges(){const images=new Map();for(const path of ['/chat/badges/global','/chat/badges?broadcaster_id='+this.broadcaster.id])try{for(const set of (await this.helix(path)).data||[])for(const v of set.versions||[])images.set(set.set_id+'/'+v.id,{src:v.image_url_4x||v.image_url_2x,title:v.title});}catch{}this.badges=images;}
 async loadRewards(){try{const rewards=new Map();for(const r of (await this.helix('/channel_points/custom_rewards?broadcaster_id='+this.broadcaster.id)).data||[])rewards.set(r.id,{title:r.title,cost:r.cost,color:r.background_color,image:r.image?.url_4x||r.default_image?.url_4x});this.rewards=rewards;}catch{}}
 open(url,generation){
  let socket;try{socket=new this.Socket(url);}catch{this.timer('retry',()=>this.reconnect(),10000);return;}
  const previous=this.socket;this.socket=socket;let keepalive=40000;
  const watchdog=()=>this.timer('keepalive',()=>{if(this.socket===socket)this.reconnect();},keepalive+10000);
  socket.addEventListener('message',async event=>{if(generation!==this.generation)return;let m;try{m=JSON.parse(String(event.data));}catch{return;}const type=m.metadata?.message_type;watchdog();
   if(type==='session_welcome'){keepalive=(m.payload.session.keepalive_timeout_seconds||30)*1000;const resumed=previous&&previous!==socket;this.session=m.payload.session.id;if(resumed){previous.close();}else await this.subscribe(generation);watchdog();}
   else if(type==='session_reconnect'){this.open(m.payload.session.reconnect_url,generation);}
   else if(type==='notification'){const id=m.metadata.message_id;if(this.seen.has(id))return;this.seen.add(id);while(this.seen.size>2000)this.seen.delete(this.seen.values().next().value);this.dispatch(m.payload.subscription.type,m.payload.event);}
   else if(type==='revocation'){this.failed=[...new Set([...this.failed,m.payload.subscription.type])];}
  });
  socket.addEventListener('close',()=>{if(this.socket===socket&&generation===this.generation){this.session=null;this.timer('retry',()=>this.reconnect(),5000+this.random()*5000);}});
 }
 async subscribe(generation){
  const b={broadcaster_user_id:this.broadcaster.id},types=[['channel.channel_points_custom_reward_redemption.add',b],['channel.channel_points_custom_reward.update',b],['channel.poll.begin',b],['channel.poll.progress',b],['channel.poll.end',b]];
  this.subscribed=[];this.failed=[];
  for(const [type,condition] of types){if(generation!==this.generation)return;try{await this.helix('/eventsub/subscriptions',{method:'POST',body:{type,version:'1',condition,transport:{method:'websocket',session_id:this.session}}});this.subscribed.push(type);}catch{this.failed.push(type);}}
 }
 dispatch(type,e){
  // A reward edited on Twitch (title, cost, cooldown, paused) is passed on so Studio stays in sync.
  if(type==='channel.channel_points_custom_reward.update'&&e?.id){this.onRewardChange(rewardInfo(e));return;}
  if(type==='channel.channel_points_custom_reward_redemption.add'){if(e?.reward?.title)this.onRedemption({id:String(e.id||''),user:e.user_name||e.user_login||'Someone',userId:e.user_id||'',title:e.reward.title,text:String(e.user_input||'')});const data=redemption(e,this.rewards);if(data)this.onMessage(data);}
  else if(type.startsWith('channel.poll.')){const p=poll(e,type);if(p)this.onPoll(p);}
 }
 // Viewer count from Helix, about every 90-110 s.
 async refreshViewers(generation){if(generation!==this.generation||!this.broadcaster)return;try{const s=(await this.helix('/streams?user_id='+this.broadcaster.id)).data?.[0];this.viewers={live:!!s,viewers:s?s.viewer_count:null,updatedAt:this.now(),error:null};}catch(error){this.viewers={live:null,viewers:null,updatedAt:this.now(),error:errorText(error,'Twitch').slice(0,120)};}this.timer('viewers',()=>this.refreshViewers(generation),90000+this.random()*20000);}

 // ---- Actions (official endpoints only) ----
 async sendChat(text){
  if(!this.ready)return {status:'failed',detail:'Connect Twitch in Studio to send messages.'};
  try{const r=(await this.helix('/chat/messages',{method:'POST',body:{broadcaster_id:this.broadcaster.id,sender_id:this.auth.user_id,message:text}})).data?.[0];return r?.is_sent?{status:'submitted',detail:'Sent'}:{status:'failed',detail:r?.drop_reason?.message||'Twitch did not accept the message.'};}
  catch(error){return {status:'unknown',detail:errorText(error,'Twitch')+' Check chat before sending again.'};}
 }
 async createPoll({question,choices,duration}){
  if(!this.ready)return {status:'failed',detail:'Connect Twitch in Studio to run polls.'};if(!this.isBroadcaster)return {status:'failed',detail:'Only the channel owner can run Twitch polls.'};
  try{const p=(await this.helix('/polls',{method:'POST',body:{broadcaster_id:this.broadcaster.id,title:question,choices:choices.map(title=>({title})),duration}})).data?.[0];if(!p)return {status:'unknown',detail:'Twitch did not confirm the poll. Check the channel before trying again.'};const mapped=poll(p,'channel.poll.begin');if(mapped)this.onPoll(mapped);return {status:'submitted',detail:'Poll started'};}
  catch(error){return {status:/affiliate|partner/i.test(String(error.message))?'failed':'unknown',detail:errorText(error,'Twitch')};}
 }
 async endPoll(id){
  if(!this.ready||!this.isBroadcaster)return {status:'failed',detail:'Connect Twitch as the channel owner to end polls.'};
  try{await this.helix('/polls',{method:'PATCH',body:{broadcaster_id:this.broadcaster.id,id,status:'TERMINATED'}});return {status:'submitted',detail:'Poll ended'};}
  catch(error){return {status:'unknown',detail:errorText(error,'Twitch')+' Check the channel before trying again.'};}
 }
}

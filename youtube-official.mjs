// Official YouTube connection: Google sign-in for desktop apps (loopback + PKCE) and the YouTube Data API.
// Reads chat through YouTube's official live chat stream and sends chat, runs polls and reads viewer counts.
// Custom emojis arrive as :name: text; youtube-merge.mjs adds their images from the signed-out chat page.
import {randomBytes,createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {dirname} from 'node:path';
// A Google "Desktop app" client. Google treats installed-app secrets as not confidential.
export const YOUTUBE_CLIENT_ID='342478247598-7kgcd51fiav8fml8tuoseqq4c32mejlf.apps.googleusercontent.com';
export const YOUTUBE_CLIENT_SECRET='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';
export const YOUTUBE_SCOPE='https://www.googleapis.com/auth/youtube.force-ssl';
export const youtubeRedirectUri='http://127.0.0.1:3927/oauth/youtube/callback';
const API='https://www.googleapis.com/youtube/v3/',TOKEN='https://oauth2.googleapis.com/token';
const reasons={quotaExceeded:'The YouTube API daily quota is used up. It resets at midnight Pacific time.',liveChatEnded:'This live chat has ended.',liveChatDisabled:'Live chat is turned off for this stream.',forbidden:'Your account is not allowed to do this on this channel.',insufficientPermissions:'Sign in with the channel owner or a moderator account.',accessNotConfigured:'Enable YouTube Data API v3 in the Google Cloud project.',liveStreamingNotEnabled:'Live streaming is not enabled on this YouTube channel.',preconditionCheckFailed:'An active poll is already pinned in this chat. End it first.',rateLimitExceeded:'YouTube asked to slow down. Try again in a moment.'};
export const sourceKeys=['youtube','youtubeShorts'];

export class YouTubeOfficial{
 constructor({file,clientId=YOUTUBE_CLIENT_ID,clientSecret=YOUTUBE_CLIENT_SECRET,request=fetch,now=Date.now,schedule=setTimeout,cancel=clearTimeout,random=Math.random,onPoll=()=>{},onAuth=()=>{},onMessage=()=>{}}){
  Object.assign(this,{file,clientId,clientSecret,request,now,schedule,cancel,random,onPoll,onAuth,onMessage});
  this.auth=null;this.pending=null;this.videos={};this.chats={};this.viewers={};this.polls={};this.error=null;this.timers={};this.generation=0;this.streams={};
 }
 get configured(){return !!this.clientId;}
 get connected(){return !!this.auth?.refresh_token;}
 async load(){try{this.auth=JSON.parse(await readFile(this.file,'utf8'));}catch{this.auth=null;}}
 async save(){await mkdir(dirname(this.file),{recursive:true});await writeFile(this.file,JSON.stringify(this.auth),{mode:0o600});}
 timer(name,fn,ms){this.cancel(this.timers[name]);this.timers[name]=this.schedule(()=>{this.timers[name]=null;return fn();},ms);}
 status(){return {configured:this.configured,connected:this.connected,channel:this.auth?.channel||null,ready:this.connected,error:this.error,chats:Object.fromEntries(sourceKeys.map(k=>[k,{video:this.videos[k]||'',live:!!this.chats[k]}]))};}

 // ---- Sign-in: Google opens in the default browser and returns to this local server. ----
 startSignIn(){
  if(!this.configured)throw Error('This build of Bubblecast has no Google client configured.');
  const verifier=randomBytes(48).toString('base64url'),state=randomBytes(32).toString('base64url');this.pending={state,verifier,until:this.now()+600000};this.error=null;
  return {url:'https://accounts.google.com/o/oauth2/v2/auth?'+new URLSearchParams({client_id:this.clientId,redirect_uri:youtubeRedirectUri,response_type:'code',scope:YOUTUBE_SCOPE,state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',access_type:'offline',prompt:'consent select_account'})};
 }
 async token(fields){const r=await this.request(TOKEN,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:this.clientId,client_secret:this.clientSecret,...fields}),signal:AbortSignal.timeout(15000)});let body={};try{body=await r.json();}catch{}return {ok:r.ok&&!!body.access_token,body};}
 async callback(params){
  const p=this.pending;this.pending=null;
  if(!p||p.until<this.now()||params.get('state')!==p.state)throw Error('Sign-in expired or did not match. Start Connect YouTube again.');
  if(params.get('error'))throw Error('Google sign-in was cancelled.');
  const {ok,body}=await this.token({grant_type:'authorization_code',code:params.get('code')||'',redirect_uri:youtubeRedirectUri,code_verifier:p.verifier});
  if(!ok)throw Error('Google sign-in did not finish. Try Connect YouTube again.');
  if(!String(body.scope||'').split(' ').includes(YOUTUBE_SCOPE))throw Error('YouTube access was not granted. Allow it when Google asks.');
  if(!body.refresh_token)throw Error('Google did not grant lasting access. Remove Bubblecast at myaccount.google.com/permissions and connect again.');
  this.auth={access_token:body.access_token,refresh_token:body.refresh_token,expires_at:this.now()+body.expires_in*1000};
  try{const me=(await this.api('channels',{query:{part:'snippet',mine:'true'}})).items?.[0];this.auth.channel=me?{id:me.id,title:me.snippet.title}:null;}catch{}
  await this.save();this.refreshChats();this.onAuth();
 }
 async access(){
  if(!this.auth)throw Error('Connect YouTube in Studio first.');
  if(this.auth.expires_at-this.now()<60000){const {ok,body}=await this.token({grant_type:'refresh_token',refresh_token:this.auth.refresh_token});if(!ok){await this.forget('YouTube sign-in ended. Connect YouTube again.');throw Error(this.error);}Object.assign(this.auth,{access_token:body.access_token,expires_at:this.now()+body.expires_in*1000});await this.save();}
  return this.auth.access_token;
 }
 async forget(error=null){this.stopStreams();this.auth=null;this.pending=null;this.error=error;this.chats={};this.viewers={};for(const name of Object.keys(this.timers))this.cancel(this.timers[name]);await rm(this.file,{force:true});this.onAuth();}
 async disconnect(){const token=this.auth?.refresh_token;await this.forget();if(token)try{await this.request('https://oauth2.googleapis.com/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token}),signal:AbortSignal.timeout(10000)});}catch{}}
 async api(resource,{method='GET',query={},body}={}){
  const token=await this.access();
  const r=await this.request(API+resource+'?'+new URLSearchParams(query),{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
  if(r.status===204)return {};let json={};try{json=await r.json();}catch{}
  if(!r.ok){const reason=json.error?.errors?.[0]?.reason;const error=Error(reasons[reason]||json.error?.message||'YouTube returned HTTP '+r.status);error.reason=reason;throw error;}
  return json;
 }

 // ---- Live chats and viewers: one videos.list call (1 unit) per stream about every 90-110 s. ----
 configure(videos){const next=Object.fromEntries(sourceKeys.map(k=>[k,String(videos?.[k]||'')]).filter(([,v])=>/^[\w-]{11}$/.test(v)));if(JSON.stringify(next)===JSON.stringify(this.videos))return;this.videos=next;this.stopStreams();this.chats={};this.viewers={};this.refreshChats();}
 refreshChats(){const generation=++this.generation;this.cancel(this.timers.chats);if(this.connected&&Object.keys(this.videos).length)this.timer('chats',()=>this.pollChats(generation),1000);}
 async pollChats(generation){
  if(generation!==this.generation||!this.connected)return;
  try{const ids=Object.values(this.videos);const items=(await this.api('videos',{query:{part:'liveStreamingDetails',id:ids.join(',')}})).items||[];
   for(const [key,video] of Object.entries(this.videos)){const d=items.find(i=>i.id===video)?.liveStreamingDetails;const live=!!d?.activeLiveChatId&&!d.actualEndTime;this.chats[key]=live?d.activeLiveChatId:null;this.readChat(key);this.viewers[key]={live,viewers:live&&d.concurrentViewers!=null?Number(d.concurrentViewers):null,updatedAt:this.now(),error:null};}
   this.error=null;
  }catch(error){this.error=String(error.message||error);}
  this.timer('chats',()=>this.pollChats(generation),90000+this.random()*20000);
 }
 // ---- Reading chat: YouTube's official server-streaming endpoint (5 units per connection, not per message). ----
 reading(key){return !!this.streams[key];}
 stopStreams(){for(const key of Object.keys(this.streams))this.stopStream(key);}
 stopStream(key){const stream=this.streams[key];if(!stream)return;stream.stopped=true;stream.abort.abort();this.cancel(this.timers['stream-'+key]);delete this.streams[key];}
 readChat(key){const chat=this.chats[key],current=this.streams[key];if(current?.chat===chat)return;this.stopStream(key);if(!chat||!this.connected)return;this.streams[key]={chat,token:'',since:this.now(),failures:0,abort:new AbortController()};this.openStream(key);}
 async openStream(key){
  const stream=this.streams[key];if(!stream||stream.stopped)return;
  try{
   const token=await this.access();const r=await this.request(API+'liveChat/messages/stream?'+new URLSearchParams({liveChatId:stream.chat,part:'id,snippet,authorDetails',...(stream.token?{pageToken:stream.token}:{})}),{headers:{Authorization:'Bearer '+token},signal:stream.abort.signal});
   if(!r.ok){let json={};try{json=await r.json();}catch{}const reason=json.error?.errors?.[0]?.reason;const error=Error(reasons[reason]||json.error?.message||'YouTube chat returned HTTP '+r.status);error.reason=reason;throw error;}
   const parser=new JsonObjects();for await(const chunk of r.body){for(const page of parser.push(chunk)){if(stream.stopped)return;stream.failures=0;this.accept(key,stream,page);}}
   if(stream.stopped)return;this.timer('stream-'+key,()=>this.openStream(key),1000+this.random()*1000);
  }catch(error){
   if(stream.stopped)return;this.error=String(error.message||error);
   if(['liveChatEnded','liveChatDisabled','liveChatNotFound','forbidden','quotaExceeded','insufficientPermissions'].includes(error.reason)){if(error.reason!=='quotaExceeded')this.chats[key]=null;delete this.streams[key];return;}
   if(error.reason==='pageTokenInvalid')stream.token='';stream.failures++;this.timer('stream-'+key,()=>this.openStream(key),Math.min(60000,2000*2**Math.min(stream.failures,5))+this.random()*1000);
  }
 }
 accept(key,stream,page){
  // The first connection replays recent history; only messages posted after Bubblecast started reading are shown.
  if(page.nextPageToken)stream.token=page.nextPageToken;
  for(const item of page.items||[]){if(Date.parse(item.snippet?.publishedAt||0)<stream.since-2000)continue;const message=chatMessage(item,key);if(message)this.onMessage(message);const p=item.snippet?.pollDetails&&youtubePoll(item,key);if(p)this.onPoll(p);}
  if(page.activePollItem){const p=youtubePoll(page.activePollItem,key);if(p)this.onPoll(p);}
  if(page.offlineAt){this.chats[key]=null;this.stopStream(key);}
 }
 chatFor(key){const chat=this.chats[key];if(!chat)throw Error(this.videos[key]?'This YouTube stream is not live, or its chat is off.':'Add this YouTube stream in Connections.');return chat;}

 // ---- Actions (official endpoints only) ----
 async sendChat(key,text){
  if(!this.connected)return {status:'failed',detail:'Connect YouTube in Studio to send messages.'};
  try{await this.api('liveChat/messages',{method:'POST',query:{part:'snippet'},body:{snippet:{liveChatId:this.chatFor(key),type:'textMessageEvent',textMessageDetails:{messageText:text}}}});return {status:'submitted',detail:'Sent'};}
  catch(error){return {status:error.reason||/not live|Add this/.test(error.message)?'failed':'unknown',detail:String(error.message||error)+(error.reason?'':' Check chat before sending again.')};}
 }
 async createPoll(key,{question,choices}){
  if(!this.connected)return {status:'failed',detail:'Connect YouTube in Studio to run polls.'};
  try{const m=await this.api('liveChat/messages',{method:'POST',query:{part:'snippet'},body:{snippet:{liveChatId:this.chatFor(key),type:'pollEvent',pollDetails:{metadata:{questionText:question,options:choices.map(optionText=>({optionText}))}}}}});
   if(!m.id)return {status:'unknown',detail:'YouTube did not confirm the poll. Check the chat before trying again.'};this.polls[key]=m.id;
   this.onPoll({platform:'youtube',sourceKey:key,id:m.id,question,status:'active',choices:choices.map((text,i)=>({id:String(i),text,votes:null,percent:null}))});return {status:'submitted',detail:'Poll started'};}
  catch(error){return {status:error.reason||/not live|Add this/.test(error.message)?'failed':'unknown',detail:String(error.message||error)};}
 }
 // Ends the poll this app started; YouTube identifies polls by their chat message id.
 async endPoll(key,pollId){
  if(!this.connected)return {status:'failed',detail:'Connect YouTube in Studio to end polls.'};
  const id=this.polls[key]||pollId;if(!id)return {status:'failed',detail:'Bubblecast did not start this poll. End it on YouTube.'};
  try{await this.api('liveChat/messages/transition',{method:'POST',query:{id,status:'closed',part:'snippet'}});delete this.polls[key];return {status:'submitted',detail:'Poll ended'};}
  catch(error){return {status:error.reason?'failed':'unknown',detail:String(error.message||error)+(error.reason?'':' Check the chat before trying again.')};}
 }
}

// Splits a streamed JSON response (an array or a run of objects) into complete top-level objects.
export class JsonObjects{
 constructor(){this.buffer='';this.decoder=new TextDecoder();}
 push(chunk){
  this.buffer+=typeof chunk==='string'?chunk:this.decoder.decode(chunk,{stream:true});const out=[];let depth=0,start=-1,quoted=false,escaped=false,consumed=0;
  for(let i=0;i<this.buffer.length;i++){const c=this.buffer[i];
   if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}
   if(c==='"'){quoted=true;continue;}
   if(c==='{'){if(depth++===0)start=i;}else if(c==='}'&&depth>0&&--depth===0){try{out.push(JSON.parse(this.buffer.slice(start,i+1)));}catch{}consumed=i+1;}
  }
  this.buffer=depth?this.buffer.slice(start>=consumed?start:consumed):'';return out;
 }
}
const text=value=>[{type:'text',text:String(value||'')}];
// Maps a liveChatMessage resource to Bubblecast's chat message model.
export function chatMessage(item,sourceKey='youtube'){
 const s=item?.snippet||{},a=item?.authorDetails||{},type=s.type;
 if(type==='messageDeletedEvent')return {platform:'youtube',sourceKey,action:'delete',id:s.messageDeletedDetails?.deletedMessageId||''};
 if(type==='userBannedEvent')return {platform:'youtube',sourceKey,action:'delete',id:'',userId:s.userBannedDetails?.bannedUserDetails?.channelId||''};
 const base={id:item.id,sourceId:item.id,platform:'youtube',sourceKey,user:a.displayName||'YouTube viewer',userId:a.channelId||s.authorChannelId||'',parts:[],badges:[],sourceTime:Date.parse(s.publishedAt)||Date.now()};
 if(!item?.id)return null;
 if(type==='textMessageEvent')return {...base,parts:text(s.textMessageDetails?.messageText??s.displayMessage)};
 if(type==='superChatEvent')return {...base,parts:s.superChatDetails?.userComment?text(s.superChatDetails.userComment):[],event:{kind:'superchat',title:s.superChatDetails?.amountDisplayString||'Super Chat'}};
 if(type==='superStickerEvent')return {...base,event:{kind:'superchat',title:s.superStickerDetails?.amountDisplayString||'Super Sticker'}};
 if(type==='newSponsorEvent')return {...base,event:{kind:'membership',title:s.newSponsorDetails?.isUpgrade?'Upgraded membership':'New member'+(s.newSponsorDetails?.memberLevelName?' · '+s.newSponsorDetails.memberLevelName:'')}};
 if(type==='memberMilestoneChatEvent'){const d=s.memberMilestoneChatDetails||{};return {...base,parts:d.userComment?text(d.userComment):[],event:{kind:'membership',title:'Member for '+(d.memberMonth||1)+(d.memberMonth===1?' month':' months')}};}
 if(type==='membershipGiftingEvent'){const n=s.membershipGiftingDetails?.giftMembershipsCount||1;return {...base,event:{kind:'giftmembership',title:'Gifted '+n+(n===1?' membership':' memberships')}};}
 return null;
}
// Maps a poll message to the shared poll model; YouTube reports per-option tallies while the poll runs.
export function youtubePoll(item,sourceKey='youtube'){
 const d=item?.snippet?.pollDetails,m=d?.metadata;if(!item?.id||!m?.questionText||!Array.isArray(m.options))return null;
 const votes=m.options.map(o=>o.tally==null?null:Number(o.tally)),total=votes.every(Number.isFinite)?votes.reduce((a,b)=>a+b,0):null;
 return {platform:'youtube',sourceKey,id:item.id,question:m.questionText,status:d.status==='closed'?'closed':'active',choices:m.options.map((o,i)=>({id:String(i),text:o.optionText,votes:votes[i],percent:total?votes[i]/total*100:null}))};
}

// Official YouTube connection: Google sign-in for desktop apps (loopback + PKCE) and the YouTube Data API.
// Used only for actions as the streamer (sending chat, polls) and viewer counts. Chat itself is read by the
// helper from YouTube's live chat page while signed out, which keeps custom emojis and uses no API quota.
import {randomBytes,createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {dirname} from 'node:path';
// A Google "Desktop app" client. Google treats installed-app secrets as not confidential.
export const YOUTUBE_CLIENT_ID='';
export const YOUTUBE_CLIENT_SECRET='';
export const YOUTUBE_SCOPE='https://www.googleapis.com/auth/youtube.force-ssl';
export const youtubeRedirectUri='http://127.0.0.1:3927/oauth/youtube/callback';
const API='https://www.googleapis.com/youtube/v3/',TOKEN='https://oauth2.googleapis.com/token';
const reasons={quotaExceeded:'The YouTube API daily quota is used up. It resets at midnight Pacific time.',liveChatEnded:'This live chat has ended.',liveChatDisabled:'Live chat is turned off for this stream.',forbidden:'Your account is not allowed to do this on this channel.',insufficientPermissions:'Sign in with the channel owner or a moderator account.',accessNotConfigured:'Enable YouTube Data API v3 in the Google Cloud project.',liveStreamingNotEnabled:'Live streaming is not enabled on this YouTube channel.',preconditionCheckFailed:'An active poll is already pinned in this chat. End it first.',rateLimitExceeded:'YouTube asked to slow down. Try again in a moment.'};
export const sourceKeys=['youtube','youtubeShorts'];

export class YouTubeOfficial{
 constructor({file,clientId=YOUTUBE_CLIENT_ID,clientSecret=YOUTUBE_CLIENT_SECRET,request=fetch,now=Date.now,schedule=setTimeout,cancel=clearTimeout,random=Math.random,onPoll=()=>{},onAuth=()=>{}}){
  Object.assign(this,{file,clientId,clientSecret,request,now,schedule,cancel,random,onPoll,onAuth});
  this.auth=null;this.pending=null;this.videos={};this.chats={};this.viewers={};this.polls={};this.error=null;this.timers={};this.generation=0;
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
 async forget(error=null){this.auth=null;this.pending=null;this.error=error;this.chats={};this.viewers={};for(const name of Object.keys(this.timers))this.cancel(this.timers[name]);await rm(this.file,{force:true});this.onAuth();}
 async disconnect(){const token=this.auth?.refresh_token;await this.forget();if(token)try{await this.request('https://oauth2.googleapis.com/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token}),signal:AbortSignal.timeout(10000)});}catch{}}
 async api(resource,{method='GET',query={},body}={}){
  const token=await this.access();
  const r=await this.request(API+resource+'?'+new URLSearchParams(query),{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
  if(r.status===204)return {};let json={};try{json=await r.json();}catch{}
  if(!r.ok){const reason=json.error?.errors?.[0]?.reason;const error=Error(reasons[reason]||json.error?.message||'YouTube returned HTTP '+r.status);error.reason=reason;throw error;}
  return json;
 }

 // ---- Live chats and viewers: one videos.list call (1 unit) per stream about every 90-110 s. ----
 configure(videos){const next=Object.fromEntries(sourceKeys.map(k=>[k,String(videos?.[k]||'')]).filter(([,v])=>/^[\w-]{11}$/.test(v)));if(JSON.stringify(next)===JSON.stringify(this.videos))return;this.videos=next;this.chats={};this.viewers={};this.refreshChats();}
 refreshChats(){const generation=++this.generation;this.cancel(this.timers.chats);if(this.connected&&Object.keys(this.videos).length)this.timer('chats',()=>this.pollChats(generation),1000);}
 async pollChats(generation){
  if(generation!==this.generation||!this.connected)return;
  try{const ids=Object.values(this.videos);const items=(await this.api('videos',{query:{part:'liveStreamingDetails',id:ids.join(',')}})).items||[];
   for(const [key,video] of Object.entries(this.videos)){const d=items.find(i=>i.id===video)?.liveStreamingDetails;const live=!!d?.activeLiveChatId&&!d.actualEndTime;this.chats[key]=live?d.activeLiveChatId:null;this.viewers[key]={live,viewers:live&&d.concurrentViewers!=null?Number(d.concurrentViewers):null,updatedAt:this.now(),error:null};}
   this.error=null;
  }catch(error){this.error=String(error.message||error);}
  this.timer('chats',()=>this.pollChats(generation),90000+this.random()*20000);
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

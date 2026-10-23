// Official Kick connection: OAuth 2.1 with PKCE against the streamer's own Kick app, opened in the helper session
// and returned to this local server. Used for account actions only: sending chat, live status and viewer count.
// Kick delivers chat and events through webhooks, which need a public server, so chat keeps being read from
// Kick's public chat connection in the helper. Kick polls have no API and stay in the signed-in Kick page.
import {errorText} from './net-errors.mjs';
import {randomBytes,createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {dirname} from 'node:path';
export const KICK_SCOPES=['user:read','channel:read','chat:write'];
export const kickRedirectUri='http://localhost:3927/oauth/kick/callback';
const ID='https://id.kick.com/oauth/',API='https://api.kick.com/public/v1/';

export class KickOfficial{
 constructor({file,request=fetch,now=Date.now,schedule=setTimeout,cancel=clearTimeout,random=Math.random,onAuth=()=>{}}){
  Object.assign(this,{file,request,now,schedule,cancel,random,onAuth});
  this.app={clientId:'',clientSecret:''};this.auth=null;this.pending=null;this.channel='';this.enabled=true;this.target=null;this.viewers=null;this.error=null;this.timer=null;this.generation=0;
 }
 setApp(app={}){const next={clientId:String(app.clientId||''),clientSecret:String(app.clientSecret||'')};const changed=next.clientId!==this.app.clientId;this.app=next;return changed;}
 get configured(){return !!(this.app.clientId&&this.app.clientSecret);}
 get connected(){return !!this.auth?.refresh_token;}
 async load(){try{this.auth=JSON.parse(await readFile(this.file,'utf8'));}catch{this.auth=null;}if(this.auth&&this.auth.client_id!==this.app.clientId)this.auth=null;}
 async save(){await mkdir(dirname(this.file),{recursive:true});await writeFile(this.file,JSON.stringify(this.auth),{mode:0o600});}
 status(){return {configured:this.configured,connected:this.connected,user:this.auth?.user||null,ready:this.connected&&!!this.target,channel:this.channel,error:this.error};}

 // ---- Sign-in ----
 startSignIn(){
  if(!this.configured)throw Error('Add your Kick app’s client ID and secret first. See the setup guide.');
  const verifier=randomBytes(48).toString('base64url'),state=randomBytes(32).toString('base64url');this.pending={state,verifier,until:this.now()+600000};this.error=null;
  return {url:ID+'authorize?'+new URLSearchParams({client_id:this.app.clientId,response_type:'code',redirect_uri:kickRedirectUri,state,scope:KICK_SCOPES.join(' '),code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'})};
 }
 async token(fields){const r=await this.request(ID+'token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:this.app.clientId,client_secret:this.app.clientSecret,...fields}),signal:AbortSignal.timeout(15000)});let body={};try{body=await r.json();}catch{}return {ok:r.ok&&!!body.access_token,body};}
 async callback(params){
  const p=this.pending;this.pending=null;
  if(!p||p.until<this.now()||params.get('state')!==p.state)throw Error('Sign-in expired or did not match. Start Connect Kick again.');
  if(params.get('error'))throw Error('Kick sign-in was cancelled.');
  const {ok,body}=await this.token({grant_type:'authorization_code',code:params.get('code')||'',redirect_uri:kickRedirectUri,code_verifier:p.verifier});
  if(!ok)throw Error('Kick sign-in did not finish. Check your app’s client secret and redirect URL, then try again.');
  const granted=String(body.scope||'').split(/\s+/);if(!KICK_SCOPES.every(s=>granted.includes(s)))throw Error('Kick did not grant every permission. Allow them all when Kick asks.');
  if(!body.refresh_token)throw Error('Kick did not grant lasting access. Try Connect Kick again.');
  this.auth={client_id:this.app.clientId,access_token:body.access_token,refresh_token:body.refresh_token,expires_at:this.now()+(Number(body.expires_in)||3600)*1000};
  try{const me=(await this.api('users')).data?.[0];this.auth.user=me?{id:me.user_id,name:me.name}:null;}catch{}
  await this.save();this.refresh();this.onAuth();
 }
 async access(){
  if(!this.auth)throw Error('Connect Kick in Studio first.');
  if(this.auth.expires_at-this.now()<60000){const {ok,body}=await this.token({grant_type:'refresh_token',refresh_token:this.auth.refresh_token});if(!ok){await this.forget('Kick sign-in ended. Connect Kick again.');throw Error(this.error);}Object.assign(this.auth,{access_token:body.access_token,refresh_token:body.refresh_token||this.auth.refresh_token,expires_at:this.now()+(Number(body.expires_in)||3600)*1000});await this.save();}
  return this.auth.access_token;
 }
 async forget(error=null){this.cancel(this.timer);this.auth=null;this.pending=null;this.target=null;this.viewers=null;this.error=error;await rm(this.file,{force:true});this.onAuth();}
 async disconnect(){const token=this.auth?.refresh_token;await this.forget();if(token)try{await this.request(ID+'revoke?'+new URLSearchParams({token,token_hint_type:'refresh_token'}),{method:'POST',signal:AbortSignal.timeout(10000)});}catch{}}
 async api(path,{method='GET',query,body}={}){
  const token=await this.access();
  const r=await this.request(API+path+(query?'?'+new URLSearchParams(query):''),{method,headers:{Authorization:'Bearer '+token,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
  let json={};try{json=await r.json();}catch{}
  if(!r.ok){const error=Error(r.status===401?'Kick sign-in ended. Connect Kick again.':r.status===403?'Your Kick account is not allowed to do this in this chat.':r.status===429?'Kick asked to slow down. Try again in a moment.':json.message||'Kick returned HTTP '+r.status);error.status=r.status;throw error;}
  return json;
 }

 // ---- Channel, live status and viewers: one channels call about every 90-110 s. ----
 configure(channel,{enabled=true}={}){const next=String(channel||'').toLowerCase();if(next===this.channel&&enabled===this.enabled){if(this.connected&&enabled&&!this.timer)this.refresh();return;}this.enabled=enabled;this.channel=next;this.target=null;this.viewers=null;this.refresh();}
 refresh(){const generation=++this.generation;this.cancel(this.timer);if(this.connected&&this.enabled)this.timer=this.schedule(()=>this.poll(generation),1000);}
 async poll(generation){
  if(generation!==this.generation||!this.connected||!this.enabled)return;
  try{const own=!this.channel;if(own&&!this.auth.user?.id)throw Error('Kick did not identify your account. Enter a channel or reconnect Kick.');
   const c=(await this.api('channels',{query:own?{broadcaster_user_id:this.auth.user.id}:{slug:this.channel}})).data?.[0];if(generation!==this.generation||!this.auth)return;if(!c)throw Error('Kick channel '+(this.channel||'for your account')+' was not found.');
   if(own){if(!/^[a-z0-9][a-z0-9_-]{0,49}$/.test(c.slug||''))throw Error('Kick did not return your channel name. Enter a channel manually.');if(Number(c.broadcaster_user_id)!==Number(this.auth.user.id))throw Error('Kick returned a different account channel. Enter a channel manually.');this.auth.channel=c.slug;this.channel=c.slug;await this.save();this.onAuth();if(generation!==this.generation)return;}

   this.target=Number(c.broadcaster_user_id)||null;const live=c.stream?.is_live===true;this.viewers={live,viewers:live&&Number.isFinite(Number(c.stream?.viewer_count))?Number(c.stream.viewer_count):null,updatedAt:this.now(),error:null};this.error=null;
  }catch(error){this.error=errorText(error,'Kick');if(error.status===401)return;}
  if(generation===this.generation)this.timer=this.schedule(()=>this.poll(generation),90000+Math.floor(this.random()*20000));
 }

 // ---- Sending: one attempt. A send whose result is unknown is never retried. ----
 async sendChat(text){
  if(!this.connected)return {status:'failed',detail:'Connect Kick in Studio to send messages.'};
  if(!this.target)return {status:'failed',detail:'Kick has not found this channel yet. Try again in a moment.'};
  if([...text].length>500)return {status:'failed',detail:'Kick messages can be at most 500 characters.'};
  try{await this.access();}catch(error){return {status:'failed',detail:errorText(error,'Kick')};}
  try{const r=await this.api('chat',{method:'POST',body:{type:'user',broadcaster_user_id:this.target,content:text}});return r.data?.is_sent===false?{status:'failed',detail:'Kick did not accept the message.'}:{status:'submitted',detail:'Sent through the Kick API.'};}
  catch(error){return error.status?{status:'failed',detail:String(error.message)}:{status:'unknown',detail:'Kick did not answer. Check chat before sending again.'};}
 }
}

import {safeMedia} from './core.mjs';
const unescapeTag=s=>s.replace(/\\([s:nr\\])/g,(_,c)=>({s:' ',':':';',n:'\n',r:'\r','\\':'\\'}[c]));
export function parseIRC(line){
 const match=line.match(/^(?:@([^ ]+) )?(?::([^ ]+) )?([A-Z0-9]+)(?: (.*))?$/);if(!match)return null;
 const [,rawTags='',prefix='',command,rest='']=match,tags=Object.fromEntries(rawTags.split(';').filter(Boolean).map(tag=>{const at=tag.indexOf('=');return [at<0?tag:tag.slice(0,at),at<0?'':unescapeTag(tag.slice(at+1))];}));
 const trailing=rest.startsWith(':')?0:rest.indexOf(' :'),params=(trailing===0?[]:(trailing<0?rest:rest.slice(0,trailing)).split(' ').filter(Boolean));
 return {tags,prefix,command,params,text:trailing<0?'':rest.slice(trailing+(trailing===0?1:2))};
}
export function twitchParts(text,tags){
 const chars=[...text],ranges=[];
 for(const entry of (tags.emotes||'').split('/')){const [id,positions]=entry.split(':');if(!/^[\w-]+$/.test(id)||!positions)continue;for(const range of positions.split(',')){const [start,end]=range.split('-').map(Number);ranges.push({start,end,type:'image',src:`https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/3.0`,large:false});}}
 for(const gif of (tags.gifs||'').split(',')){const [position,,url]=gif.split('|'),src=safeMedia(url);if(!src)continue;const [start,end]=position.split('-').map(Number);ranges.push({start,end,type:'image',src,large:true});}
 let cursor=0;const parts=[];for(const range of ranges.sort((a,b)=>a.start-b.start)){if(!Number.isInteger(range.start)||!Number.isInteger(range.end)||range.start<cursor||range.end<range.start||range.end>=chars.length)continue;if(range.start>cursor)parts.push({type:'text',text:chars.slice(cursor,range.start).join('')});parts.push({type:range.type,src:range.src,large:range.large,alt:chars.slice(range.start,range.end+1).join('')});cursor=range.end+1;}if(cursor<chars.length)parts.push({type:'text',text:chars.slice(cursor).join('')});return parts;
}
// USERNOTICE lines carry subs, gifts and raids, with Twitch's own readable system-msg.
// Single gifts that belong to a gift bomb are dropped; the bomb itself is shown once.
const noticeKinds={sub:'sub',resub:'resub',subgift:'giftsub',submysterygift:'giftbomb',giftpaidupgrade:'sub',primepaidupgrade:'sub',anongiftpaidupgrade:'sub',raid:'raid',viewermilestone:'watchstreak'};
export function twitchNotice(p){
 const kind=noticeKinds[p.tags['msg-id']];if(!kind||!p.tags.id)return null;
 if(kind==='giftsub'&&p.tags['msg-param-community-gift-id'])return null;
 const amount=kind==='giftbomb'?Number(p.tags['msg-param-mass-gift-count']):kind==='raid'?Number(p.tags['msg-param-viewerCount']):kind==='resub'?Number(p.tags['msg-param-cumulative-months']):0;
 return {id:p.tags.id,sourceId:p.tags.id,user:p.tags['display-name']||p.tags.login||'Someone',userId:p.tags['user-id']||'',userColor:p.tags.color||'',parts:p.text?twitchParts(p.text,p.tags):[],event:{kind,title:p.tags['system-msg']||'',amount}};
}
const bodyKey=m=>m.user.toLowerCase()+':'+m.parts.map(p=>p.type==='text'?p.text:p.alt||'').join('').replace(/\s+/g,' ').trim();
const bounded=(map,key,value)=>{map.set(key,value);while(map.size>5000)map.delete(map.keys().next().value);};
// The page remains an artwork source. Match its delayed rows in FIFO order,
// including repeated identical messages, without replaying them as new chat.
export class TwitchMerge{
 constructor({now=Date.now,users={}}={}){this.now=now;this.users=users;this.irc=[];this.dom=[];this.aliases=new Map();this.native=new Map();this.badgeKeys=new Map();this.metadata=new Map();this.lastPageDelayMs=null;}
 prune(){const cutoff=this.now()-60000;this.irc=this.irc.filter(e=>!e.matched&&e.at>=cutoff).slice(-5000);this.dom=this.dom.filter(e=>!e.matched&&e.at>=cutoff).slice(-5000);}
 fromIRC(m,badgeKey){
  this.prune();if(this.native.has(m.id))return null;
  const key=bodyKey(m),before=this.dom.find(e=>e.key===key&&!e.matched),cached=this.users[m.user.toLowerCase()];
  m={...m,badges:m.badges?.length?m.badges:cached&&(!cached.badgeKey||cached.badgeKey===badgeKey)?cached.badges:[]};if(before){before.matched=true;m.id=before.id;m.action='update';m.badges=before.badges;}
  else this.irc.push({key,id:m.id,at:this.now(),badgeKey,matched:false});
  bounded(this.native,m.sourceId,m.id);bounded(this.badgeKeys,m.id,badgeKey);bounded(this.metadata,m.id,{userId:m.userId,userColor:m.userColor});return m;
 }
 fromDOM(raw){
  if(!raw.user||!Array.isArray(raw.parts))return raw;this.prune();
  const row=raw.id||raw.sourceId,known=this.aliases.get(row),key=bodyKey(raw),fast=this.irc.find(e=>e.key===key&&!e.matched);
  if(Array.isArray(raw.badges)){this.users[raw.user.toLowerCase()]={badges:raw.badges.slice(0,20),badgeKey:this.badgeKeys.get(known||fast?.id||row)};const names=Object.keys(this.users);if(names.length>2000)delete this.users[names[0]];}
  if(known){const meta=this.metadata.get(known)||{};return {...raw,id:known,action:'update',userId:raw.userId||meta.userId||'',userColor:raw.userColor||meta.userColor||''};}
  if(fast){fast.matched=true;this.lastPageDelayMs=this.now()-fast.at;bounded(this.aliases,row,fast.id);const meta=this.metadata.get(fast.id)||{};return {...raw,id:fast.id,action:'update',userId:raw.userId||meta.userId||'',userColor:raw.userColor||meta.userColor||''};}
  if(raw.action!=='update'){bounded(this.aliases,row,raw.id);this.dom.push({key,id:raw.id,at:this.now(),badges:raw.badges||[],matched:false});}return raw;
 }
}
export class TwitchLive{
 constructor({onMessage,onState=()=>{},Socket=WebSocket,merge=new TwitchMerge(),schedule=setTimeout,cancel=clearTimeout,now=Date.now,lookupRewards=null,reward=null,badgeImages=null}){Object.assign(this,{onMessage,onState,Socket,merge,schedule,cancel,now,lookupRewards,reward,badgeImages});this.rewards=new Map();this.channel='';this.socket=null;this.timer=null;this.ready=false;this.attempt=0;}
 configure(channel){channel=String(channel||'').toLowerCase();if(!/^[a-z0-9_]{1,25}$/.test(channel))channel='';if(channel===this.channel)return;this.stop();this.channel=channel;if(channel){this.connect();this.loadRewards();}}
 // Reward titles come from the channel's public reward list; redemption chat lines only carry an id.
 async loadRewards(){if(!this.lookupRewards||!this.channel)return;const channel=this.channel;try{const rewards=await this.lookupRewards(channel);if(this.channel===channel&&rewards instanceof Map){this.rewards=rewards;this.rewardsAt=this.now();}}catch{}}
 stop(){this.channel='';this.cancel(this.timer);this.timer=null;const socket=this.socket;this.socket=null;this.ready=false;socket?.close();this.onState(false);}
 connect(){
  if(!this.channel)return;const channel=this.channel;let socket;try{socket=new this.Socket('wss://irc-ws.chat.twitch.tv:443');}catch{this.retry();return;}this.socket=socket;
  socket.addEventListener('open',()=>{if(this.socket!==socket)return;for(const command of ['CAP REQ :twitch.tv/tags twitch.tv/commands','NICK justinfan'+Math.floor(100000+Math.random()*900000),'JOIN #'+channel])socket.send(command);});
  socket.addEventListener('message',event=>{if(this.socket!==socket)return;for(const line of String(event.data).split('\r\n')){const p=parseIRC(line);if(!p)continue;if(p.command==='PING'){socket.send('PONG :'+p.text);continue;}if(p.command==='RECONNECT'){socket.close();continue;}if(!p.params.includes('#'+channel))continue;
   if(p.command==='ROOMSTATE'||p.command==='JOIN'){this.ready=true;this.attempt=0;this.onState(true);}
   const observedAt=this.now(),base={platform:'twitch',sourceKey:'twitch',captureState:'listening',observedAt,capturedAt:observedAt};
   if(p.command==='PRIVMSG'&&p.tags.id&&!p.text.startsWith('\x01ACTION ')){const rewardId=p.tags['custom-reward-id'],rewardInfo=rewardId?this.reward?.(rewardId)||this.rewards.get(rewardId):null;if(rewardId&&!rewardInfo&&this.lookupRewards&&this.now()-(this.rewardsAt||0)>60000)this.loadRewards();const badges=this.badgeImages?.(p.tags.badges,p.tags['badge-info']);const m=this.merge.fromIRC({...base,id:p.tags.id,sourceId:p.tags.id,user:p.tags['display-name']||p.prefix.split('!')[0],userId:p.tags['user-id']||'',userColor:p.tags.color||'',parts:twitchParts(p.text,p.tags),...(badges?.length?{badges}:{}),...(rewardId?{event:{kind:'redemption',title:rewardInfo?.title||'Channel points',amount:rewardInfo?.cost,color:rewardInfo?.color}}:{})},p.tags.badges||'');if(m)this.onMessage(m);}
   if(p.command==='USERNOTICE'){const notice=twitchNotice(p);if(notice)this.onMessage({...base,...notice,badges:this.badgeImages?.(p.tags.badges,p.tags['badge-info'])||[]});}
   if(p.command==='CLEARMSG')this.onMessage({...base,action:'delete',id:p.tags['target-msg-id']||''});
   if(p.command==='CLEARCHAT')this.onMessage({...base,...(p.tags['target-user-id']?{action:'delete',id:'',userId:p.tags['target-user-id']}:{action:'clear'})});
  }});
  // Closing a socket that failed to connect fires another error, so close it only once.
  socket.addEventListener('error',()=>{if(this.socket===socket&&!socket.closing){socket.closing=true;socket.close();}});
  socket.addEventListener('close',()=>{if(this.socket!==socket)return;this.socket=null;this.ready=false;this.onState(false);this.retry();});
 }
 retry(){if(!this.channel)return;this.cancel(this.timer);this.timer=this.schedule(()=>this.connect(),Math.min(30000,1000*2**Math.min(this.attempt++,5)));}
}

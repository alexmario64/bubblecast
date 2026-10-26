import {gunzipSync} from 'node:zlib';
import {safeMedia} from './core.mjs';
const bounded=(map,key,value)=>{map.set(key,value);while(map.size>5000)map.delete(map.keys().next().value);};
const semantic=m=>m.user.toLowerCase()+':'+m.parts.map(p=>p.type==='text'?p.text:p.alt||'').join('').replace(/\s+/g,' ').trim();
function sameBody(a,b){if(a.user.toLowerCase()!==b.user.toLowerCase())return false;if(semantic(a)===semantic(b))return true;if([a,b].some(m=>m.parts.some(p=>p.type==='text'&&p.text.trim())))return false;const left=a.parts.filter(p=>p.type!=='text'),right=b.parts.filter(p=>p.type!=='text');if(!left.length||left.length!==right.length)return false;return left.every((p,i)=>{if(p.type!==right[i].type)return false;if(p.src===right[i].src)return true;try{const x=new URL(p.src),y=new URL(right[i].src);return /(^|\.)tiktokcdn(?:-us|-eu)?\.com$/.test(x.hostname)&&/(^|\.)tiktokcdn(?:-us|-eu)?\.com$/.test(y.hostname)&&x.pathname===y.pathname;}catch{return false;}});}
export class NetworkMerge{
 constructor({now=Date.now}={}){this.now=now;this.messages=new Map();this.aliases=new Map();this.networkRows=[];this.pageRows=[];this.ignored=new Set();this.lastPageDelayMs=null;}
 baseline(id){this.ignored.add(id);while(this.ignored.size>5000)this.ignored.delete(this.ignored.values().next().value);}
 prune(){const cutoff=this.now()-60000;for(const key of ['networkRows','pageRows'])this[key]=this[key].filter(r=>!r.matched&&r.at>=cutoff).slice(-5000);}
 network(raw){
  if(this.ignored.has(raw.id))return null;this.prune();const existing=this.messages.get(raw.id);if(existing)return {...raw,id:existing.id,action:'update'};
  // Structured support has a native event identity; empty event bodies must not merge with chat.
  if(raw.support){bounded(this.messages,raw.id,raw);return raw;}
  const key=semantic(raw),page=this.pageRows.find(r=>!r.matched&&(r.key===key||sameBody(r.message,raw)));let m={...raw};if(page){page.matched=true;m.id=page.id;m.action='update';}else this.networkRows.push({key,id:m.id,at:this.now(),matched:false,message:raw});
  bounded(this.messages,raw.id,m);return m;
 }
 page(raw){
  const alias=this.aliases.get(raw.id);if(raw.action==='delete')return {...raw,id:alias||raw.id};
  if(!raw.user||!Array.isArray(raw.parts))return raw;if(this.ignored.has(raw.id))return null;this.prune();
  const direct=this.messages.get(raw.id)||[...this.messages.values()].find(m=>m.id===alias),key=semantic(raw),pending=this.networkRows.find(r=>!r.matched&&(direct?r.id===direct.id:r.key===key||sameBody(r.message,raw)));
  const id=alias||direct?.id||pending?.id;
  if(id){if(pending)pending.matched=true;bounded(this.aliases,raw.id,id);if(pending)this.lastPageDelayMs=this.now()-pending.at;const metadata=direct||[...this.messages.values()].find(m=>m.id===id)||{};return {...raw,id,action:'update',userId:raw.userId||metadata.userId||'',badges:raw.badges?.length?raw.badges:metadata.badges||[]};}
  if(raw.action!=='update'){bounded(this.aliases,raw.id,raw.id);this.pageRows.push({key,id:raw.id,at:this.now(),matched:false,message:raw});}return raw;
 }
}
const text=value=>value?.simpleText||value?.runs?.map(r=>r.text||'').join('')||'';
const image=value=>{const items=value?.thumbnails||[];return [...items].reverse().map(t=>safeMedia(t.url?.startsWith('//')?'https:'+t.url:t.url)).find(Boolean)||null;};
function runs(value){const parts=[];for(const run of value?.runs||[]){if(typeof run.text==='string')parts.push({type:'text',text:run.text});else if(run.emoji){const e=run.emoji,src=image(e.image),alt=e.shortcuts?.[0]||e.image?.accessibility?.accessibilityData?.label||e.emojiId||'emote';if(src)parts.push({type:'image',src,alt,large:false});else parts.push({type:'text',text:alt});}}if(!parts.length&&value?.simpleText)parts.push({type:'text',text:value.simpleText});return parts;}
export function youtubeActions(payload,sourceKey='youtube'){
 const continuation=payload?.continuationContents?.liveChatContinuation;if(!continuation||typeof continuation!=='object')return null;const actions=continuation.actions||[];if(!Array.isArray(actions))return null;const results=[];
 for(const action of actions){
  if(action.replayChatItemAction)continue;
  const removal=action.markChatItemAsDeletedAction||action.removeChatItemAction;if(removal){results.push({platform:'youtube',sourceKey,action:'delete',id:removal.targetItemId||''});continue;}
  const authorRemoval=action.markChatItemsByAuthorAsDeletedAction;if(authorRemoval){results.push({platform:'youtube',sourceKey,action:'delete',id:'',userId:authorRemoval.externalChannelId});continue;}
  const replacement=action.replaceChatItemAction,wrapper=action.addChatItemAction?.item||replacement?.replacementItem;
  const gifts=wrapper?.liveChatSponsorshipsGiftPurchaseAnnouncementRenderer,giftHeader=gifts?.header?.liveChatSponsorshipsHeaderRenderer;
  const renderer=wrapper?.liveChatTextMessageRenderer||wrapper?.liveChatPaidMessageRenderer||wrapper?.liveChatMembershipItemRenderer||wrapper?.liveChatPaidStickerRenderer||(giftHeader&&{...giftHeader,id:gifts.id,authorExternalChannelId:gifts.authorExternalChannelId,timestampUsec:gifts.timestampUsec});if(!renderer)continue;
  const user=text(renderer.authorName),id=renderer.id||replacement?.targetItemId;if(!id||!user)continue;
  // Paid messages, memberships and gifted memberships are stream events.
  const argb=n=>Number.isFinite(n)?'#'+(n&0xffffff).toString(16).padStart(6,'0'):undefined;
  const event=wrapper.liveChatPaidMessageRenderer||wrapper.liveChatPaidStickerRenderer?{kind:'superchat',title:text(renderer.purchaseAmountText),color:argb(renderer.bodyBackgroundColor??renderer.backgroundColor)}:wrapper.liveChatMembershipItemRenderer?{kind:'membership',title:text(renderer.headerPrimaryText)||text(renderer.headerSubtext)}:giftHeader?{kind:'giftmembership',title:text(renderer.primaryText)}:null;
  let parts=runs(event?.kind==='membership'?renderer.message:renderer.message||renderer.headerSubtext||renderer.primaryText);if(event?.kind==='giftmembership')parts=[];
  if(renderer.sticker){const src=image(renderer.sticker);if(src)parts.push({type:'image',src,alt:renderer.sticker.accessibility?.accessibilityData?.label||'sticker',large:true});}
  if(!parts.length&&!event)continue;
  const badges=(renderer.authorBadges||[]).map(b=>{const badge=b.liveChatAuthorBadgeRenderer||{};return {src:image(badge.customThumbnail||badge.thumbnail),alt:badge.tooltip||badge.accessibility?.accessibilityData?.label||'Badge'};}).filter(b=>b.src);
  results.push({id,sourceId:id,platform:'youtube',sourceKey,user,userId:renderer.authorExternalChannelId||'',parts,badges,...(event?{event}:{}),sourceTime:Number(renderer.timestampUsec)/1000,...(replacement?{action:'update'}:{})});
 }return results;
}
// Small bounded protobuf reader for the incoming TikTok webcast schema. Unknown
// fields are skipped, 64-bit IDs stay strings, and malformed data falls back to DOM.
export function protobuf(bytes){
 const b=Buffer.from(bytes),fields=new Map();if(b.length>8*1024*1024)throw Error('Frame too large');let pos=0,count=0;
 const integer=()=>{let n=0n;for(let shift=0n;shift<70n;shift+=7n){if(pos>=b.length)throw Error('Truncated integer');const v=b[pos++];n|=BigInt(v&127)<<shift;if(!(v&128))return n;}throw Error('Invalid integer');};
 while(pos<b.length){if(++count>50000)throw Error('Too many fields');const tag=integer(),number=Number(tag>>3n),wire=Number(tag&7n);if(!number)throw Error('Invalid field');let value;
  if(wire===0)value=integer();else if(wire===2){const length=Number(integer());if(!Number.isSafeInteger(length)||length<0||pos+length>b.length)throw Error('Truncated field');value=b.subarray(pos,pos+length);pos+=length;}else if(wire===1||wire===5){const length=wire===1?8:4;if(pos+length>b.length)throw Error('Truncated fixed field');value=b.subarray(pos,pos+length);pos+=length;}else throw Error('Unsupported field');
  const list=fields.get(number)||[];list.push(value);fields.set(number,list);
 }return fields;
}
const all=(f,n)=>f.get(n)||[],first=(f,n)=>all(f,n)[0],str=(f,n)=>{const v=first(f,n);return Buffer.isBuffer(v)?v.toString('utf8'):v?.toString()||'';},num=(f,n)=>Number(first(f,n)||0n),child=(f,n)=>protobuf(first(f,n)||Buffer.alloc(0));
const tikImage=f=>all(f,1).map(v=>safeMedia(v.toString())).find(Boolean)||null;
function tikBadges(user){
 const badges=[];for(const raw of all(user,64)){const badge=protobuf(raw);if(first(badge,11)===0n)continue;const combine=child(badge,23),label=str(child(badge,12),5)||str(child(combine,3),2)||str(combine,4);const src=tikImage(child(child(badge,20),2))||tikImage(child(combine,2));if(src)badges.push({src,alt:label?'Level '+label:'Badge',...(label?{label}:{})});}
 for(const raw of all(user,21)){const src=tikImage(protobuf(raw));if(src&&!badges.some(b=>b.src===src))badges.push({src,alt:'Badge'});}return badges.slice(0,20);
}
function repeatedIds(fields,number){const ids=[];for(const value of all(fields,number)){if(typeof value==='bigint'){ids.push(value.toString());continue;}if(!Buffer.isBuffer(value))continue;let offset=0;while(offset<value.length){let n=0n,complete=false;for(let shift=0n;shift<70n&&offset<value.length;shift+=7n){const b=value[offset++];n|=BigInt(b&127)<<shift;if(!(b&128)){complete=true;break;}}if(!complete)throw Error('Invalid packed IDs');ids.push(n.toString());}}return ids;}
function tikMessage(method,payload,nativeId){
 const m=protobuf(payload),common=child(m,1),id=str(common,2)||nativeId,sourceTime=num(common,4)*1000;
 if(method==='WebcastImDeleteMessage'){const events=[];for(const id of repeatedIds(m,2))events.push({platform:'tiktok',sourceKey:'tiktok',action:'delete',id});for(const userId of repeatedIds(m,3))events.push({platform:'tiktok',sourceKey:'tiktok',action:'delete',id:'',userId});return events;}
 // Decode only support already delivered by the native socket. Never request gifts or history.
 // Field numbers: TikTokLiveJava webcast.proto/data.proto, pinned in docs/HANDOFF.md.
 if(['WebcastGiftMessage','WebcastSubNotifyMessage'].includes(method)){
  const u=child(m,method==='WebcastGiftMessage'?7:2),user=str(u,3)||str(u,38),userId=str(u,1)||str(u,1028);
  if(!user||!id)return [];
  const base={id,sourceId:id,platform:'tiktok',sourceKey:'tiktok',user,userId,parts:[],badges:tikBadges(u),sourceTime};
  if(method==='WebcastSubNotifyMessage'){
   // Active subscriptions only. Refunds, cancellations, grace-period notices and joins do not count.
   if(![1,2].includes(num(m,8)))return [];
   return [{...base,event:{kind:'sub',title:'Subscription',amount:1},support:{metric:'subscriptions',amount:1}}];
  }
  const gift=child(m,15),type=first(gift,11),amount=num(m,5);
  if(type===undefined||type===1n&&num(m,9)!==1||!Number.isSafeInteger(amount)||amount<=0||amount>100000)return [];
  const group=str(m,11),room=str(common,3),giftId=str(m,2)||str(gift,5);
  // A streak's final frame may repeat with another message ID. Use its native group identity.
  if(type===1n){if(!group||group==='0'||!room||!userId||!giftId)return [];base.id='gift:'+room+':'+group+':'+userId+':'+giftId;}
  const src=tikImage(child(gift,1)),name=str(gift,16)||'TikTok gift';if(src)base.parts=[{type:'image',src,alt:name,large:false}];
  return [{...base,event:{kind:'gift',title:name,amount},support:{metric:'tiktokGifts',amount}}];
 }
 if(!['WebcastChatMessage','WebcastEmoteChatMessage'].includes(method))return [];
 const userData=child(m,2),user=str(userData,3)||str(userData,38),userId=str(userData,1)||str(userData,1028);if(!user||!id)return [];
 let parts=[];if(method==='WebcastChatMessage'){// Inline emote formats that cannot be mapped safely use the page fallback.
  if(all(m,13).length)return [];const content=str(m,3);if(content)parts.push({type:'text',text:content});
 }else for(const raw of all(m,3)){const emote=protobuf(raw),src=tikImage(child(emote,2));if(src)parts.push({type:'image',src,alt:str(emote,1)||'emote',large:false});}
 return parts.length?[{id,sourceId:id,platform:'tiktok',sourceKey:'tiktok',user,userId,parts,badges:tikBadges(userData),sourceTime}]:[];
}
export function tiktokPayload(bytes,{push=true}={}){
 let payload=Buffer.from(bytes);if(push){const frame=protobuf(payload);payload=first(frame,8);if(!Buffer.isBuffer(payload))return null;}
 if(payload[0]===31&&payload[1]===139)payload=gunzipSync(payload,{maxOutputLength:8*1024*1024});
 const response=protobuf(payload),messages=[];let recognised=false;
 for(const raw of all(response,1)){if(!Buffer.isBuffer(raw))continue;const envelope=protobuf(raw),method=str(envelope,1);if(!method.startsWith('Webcast'))continue;recognised=true;if(num(envelope,6))continue;const body=first(envelope,2);if(Buffer.isBuffer(body))messages.push(...tikMessage(method,body,str(envelope,3)));}
 return recognised?messages:null;
}
export class NetworkFeed{
 constructor({platform,sourceKey,onMessage,now=Date.now}){Object.assign(this,{platform,sourceKey,onMessage,now});this.startedAt=now();this.merge=new NetworkMerge({now});this.ready=false;this.batches=0;this.lastSourceDelayMs=null;}
 accept(messages,{baseline=false}={}){if(!Array.isArray(messages))return;this.ready=true;this.batches++;for(const raw of messages){const m={...raw,platform:this.platform,sourceKey:this.sourceKey};if(!m.action&&(baseline||Number.isFinite(m.sourceTime)&&m.sourceTime<this.startedAt)){this.merge.baseline(m.id);continue;}if(!m.action&&!this.merge.messages.has(m.id)&&Number.isFinite(m.sourceTime)&&m.sourceTime>0)this.lastSourceDelayMs=Math.max(0,this.now()-m.sourceTime);const result=m.action==='delete'||m.action==='clear'?m:this.merge.network(m);if(result)this.onMessage({...result,captureState:'listening',observedAt:this.now(),capturedAt:this.now()});}}
 page(raw){return this.merge.page(raw);}
}

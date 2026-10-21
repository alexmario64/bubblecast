import {normalize,sameMediaSource,eventKinds} from './core.mjs';
const semantic=parts=>parts.map(p=>p.type==='text'?p.text:p.alt||'').join('').replace(/\s+/g,' ').trim();
const appearance=m=>JSON.stringify([m.user,m.userId,m.userColor,m.parts,m.badges]);
// Updates may change artwork, but must never introduce a new chat message.
export class MessageRelay {
 constructor(){this.seen=new Map();this.aliases=new Map();this.emotes=new Map();}
 ingest(raw,settings){
  // Keep bots in the shared stream for the reading dock; overlays filter locally.
  const message=normalize(raw,{...settings,filterBots:false,eventsShown:eventKinds});if(!message)return null;
  const prefix=message.sourceKey+':';const sourceId=typeof raw.sourceId==='string'?raw.sourceId.slice(0,200):'';
  for(const p of message.parts)if(p.type==='image'&&!p.large&&p.alt&&!/\s/.test(p.alt)&&/\.(?:betterttv\.net|7tv\.app|frankerfacez\.com)$/.test(new URL(p.src).hostname))this.emotes.set(prefix+p.alt,{...p});
  while(this.emotes.size>5000)this.emotes.delete(this.emotes.keys().next().value);
  if(settings?.bttv!==false){const resolved=[];for(const p of message.parts)for(const part of p.type==='text'?p.text.split(/(\s+)/).filter(Boolean).map(text=>this.emotes.get(prefix+text)||{type:'text',text}):[p]){const last=resolved.at(-1);if(part.type==='text'&&last?.type==='text')last.text+=part.text;else resolved.push({...part});}message.parts=resolved;}
  const alias=this.aliases.get(prefix+sourceId)||this.aliases.get(prefix+message.id);
  if(alias)message.id=alias;
  const key=prefix+message.id,known=this.seen.has(key);
  if(sourceId&&(known||raw.action!=='update'))this.aliases.set(prefix+sourceId,message.id);
  while(this.aliases.size>10000)this.aliases.delete(this.aliases.keys().next().value);
  if(raw.action==='update'){
   if(!known)return null;
   const previous=this.seen.get(key);if(semantic(previous.parts)===semantic(message.parts)&&previous.parts.filter(p=>p.type!=='text').length>message.parts.filter(p=>p.type!=='text').length)message.parts=previous.parts;
   message.parts=message.parts.map((part,index)=>{const old=previous.parts[index];return part.type==='image'&&old?.type==='image'&&sameMediaSource(old.src,part.src)?{...part,src:old.src}:part;});
   if(previous.event&&!message.event)message.event=previous.event;
   if(appearance(previous)===appearance(message))return null;
   this.seen.set(key,message);return {type:'update',message};
  }
  if(known)return null;
  this.seen.set(key,message);
  while(this.seen.size>5000)this.seen.delete(this.seen.keys().next().value);
  return {type:'message',message};
 }
}

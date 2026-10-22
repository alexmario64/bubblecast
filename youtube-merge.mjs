// Joins YouTube's two chat sources. The official stream delivers each message instantly but sends custom
// emojis as :name: text and no badges; the signed-out chat page delivers the same message seconds later
// with emoji images and badges. Page copies only upgrade the API message in place, never add a new row.
// Emoji images and each chatter's badges are remembered, so repeat emojis and chatters show them instantly.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
const shortcut=/^:[^:\s]+:$/;
// Letters and digits only: standard emoji are unicode in the API but images on the page.
const words=parts=>parts.map(p=>p.type==='text'?p.text.replace(/:[^:\s]+:/g,' '):'').join('').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
export class YouTubeMerge{
 constructor({file,now=Date.now,schedule=setTimeout}={}){Object.assign(this,{file,now,schedule});this.emojis=new Map();this.badges=new Map();this.recent=[];this.pending=[];this.saving=null;}
 async load(){try{for(const [name,src] of Object.entries(JSON.parse(await readFile(this.file,'utf8'))))if(shortcut.test(name)&&typeof src==='string')this.emojis.set(name,src);}catch{}}
 save(){if(!this.file||this.saving)return;this.saving=this.schedule(async()=>{this.saving=null;try{await mkdir(dirname(this.file),{recursive:true});await writeFile(this.file,JSON.stringify(Object.fromEntries(this.emojis)));}catch{}},2000);}
 // Swaps :name: for emoji images already seen on the page.
 withEmojis(parts){const out=[];for(const p of parts)for(const piece of p.type==='text'?p.text.split(/(:[^:\s]+:)/).filter(Boolean):[p]){const part=typeof piece==='string'?(this.emojis.has(piece)?{type:'image',src:this.emojis.get(piece),alt:piece,large:false}:{type:'text',text:piece}):piece;const last=out.at(-1);if(part.type==='text'&&last?.type==='text')last.text+=part.text;else out.push(part);}return out;}
 learn(parts){let changed=false;for(const p of parts)if(p.type==='image'&&shortcut.test(p.alt||'')&&this.emojis.get(p.alt)!==p.src){this.emojis.set(p.alt,p.src);changed=true;}while(this.emojis.size>2000)this.emojis.delete(this.emojis.keys().next().value);if(changed)this.save();}
 prune(){const cutoff=this.now()-90000;this.recent=this.recent.filter(r=>r.at>=cutoff&&!r.matched);this.pending=this.pending.filter(p=>p.at>=this.now()-15000);}
 upgrade(entry,page){entry.matched=true;return {...entry.message,parts:page.parts?.length?page.parts:entry.message.parts,badges:page.badges||[],action:'update'};}
 // An API message: returns it with known emojis, plus an upgrade if its page copy arrived first.
 api(message){
  this.prune();const out={...message,parts:this.withEmojis(message.parts||[]),badges:message.badges?.length?message.badges:this.badges.get(message.userId)||[]},entry={message:out,key:message.sourceKey+'\n'+message.userId+'\n'+words(message.parts||[]),at:this.now(),matched:false};
  const early=this.pending.findIndex(p=>p.key===entry.key);if(early>=0){const [page]=this.pending.splice(early,1);return {message:out,updates:[this.upgrade(entry,page.message)]};}
  this.recent.push(entry);return {message:out,updates:[]};
 }
 // A page message: teaches emoji images and upgrades the matching API message, oldest first.
 page(message){
  this.prune();this.learn(message.parts||[]);if(message.userId){this.badges.delete(message.userId);this.badges.set(message.userId,message.badges||[]);while(this.badges.size>2000)this.badges.delete(this.badges.keys().next().value);}const key=message.sourceKey+'\n'+message.userId+'\n'+words(message.parts||[]);
  const entry=this.recent.find(r=>!r.matched&&r.key===key);if(entry)return [this.upgrade(entry,message)];
  this.pending.push({key,message,at:this.now()});return [];
 }
}

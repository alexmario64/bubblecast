// Kick's native chat socket delivers new messages; page rows only enrich metadata.
// Never load or replay chat history through this parser.
import {safeMedia} from '../core.mjs';
export function kickFrame(value){
 let envelope;try{envelope=typeof value==='string'?JSON.parse(value):value;}catch{return null;}
 if(!envelope||typeof envelope!=='object')return null;
 if(envelope.event==='pusher_internal:subscription_succeeded'&&/^chatrooms\.\d+\.v2$/.test(envelope.channel||''))return [];
 if(!['App\\Events\\ChatMessageEvent','chat.message.sent'].includes(envelope.event)||!/^chatrooms\.\d+\.v2$/.test(envelope.channel||''))return null;
 let m;try{m=typeof envelope.data==='string'?JSON.parse(envelope.data):envelope.data;}catch{return null;}
 if(!m||!m.sender||typeof m.content!=='string'||m.content.length>20000)return null;
 const id=String(m.id||m.message_id||''),user=String(m.sender.username||'');if(!id||!user)return null;
 const parts=[];let at=0;for(const match of m.content.matchAll(/\[emote:(\d+):([^\]\r\n]{1,100})\]/g)){if(match.index>at)parts.push({type:'text',text:m.content.slice(at,match.index)});parts.push({type:'image',src:'https://files.kick.com/emotes/'+match[1]+'/fullsize',alt:match[2]});at=match.index+match[0].length;}if(at<m.content.length)parts.push({type:'text',text:m.content.slice(at)});
 const badges=(m.sender.identity?.badges||[]).filter(b=>safeMedia(b.image_url||b.src)).map(b=>({src:b.image_url||b.src,alt:b.text||b.type||'Badge'}));
 return [{id,sourceId:id,platform:'kick',sourceKey:'kick',user,userId:String(m.sender.id||m.sender.user_id||''),parts,badges,sourceTime:Date.parse(m.created_at)}];
}

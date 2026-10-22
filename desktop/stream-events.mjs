// Kick channel events from the page's realtime socket, turned into event messages.
const json=value=>{if(typeof value!=='string')return value&&typeof value==='object'?value:null;try{return JSON.parse(value);}catch{return null;}};
export function kickEvent(frame){
 const envelope=json(frame),pub=envelope?.push?.pub?.data||envelope,name=pub?.event,data=json(pub?.data);
 if(!name||!data)return null;
 if(name==='KicksGifted'&&data.gift_transaction_id&&data.sender?.username){
  const gift=data.gift||{},amount=Number(gift.amount)||0,message=String(data.message||'').trim();
  return {platform:'kick',sourceKey:'kick',id:'kicks-'+data.gift_transaction_id,user:data.sender.username,userId:String(data.sender.id||''),parts:message?[{type:'text',text:message}]:[],event:{kind:'gift',title:(gift.name||'Kicks gift')+(amount>1?' ×'+amount:''),amount}};
 }
 return null;
}

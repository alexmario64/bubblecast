// Kick channel events from the page's realtime socket, turned into event messages.
const json=value=>{if(typeof value!=='string')return value&&typeof value==='object'?value:null;try{return JSON.parse(value);}catch{return null;}};
export function kickEvent(frame){
 const envelope=json(frame),pub=envelope?.push?.pub?.data||envelope,name=pub?.event,data=json(pub?.data);
 if(!name||!data)return null;
 if(name==='KicksGifted'&&data.gift_transaction_id&&data.sender?.username){
  const gift=data.gift||{},amount=Number(gift.amount)||0,message=String(data.message||'').trim();
  return {platform:'kick',sourceKey:'kick',id:'kicks-'+data.gift_transaction_id,user:data.sender.username,userId:String(data.sender.id||''),parts:message?[{type:'text',text:message}]:[],event:{kind:'gift',title:(gift.name||'Kicks gift')+(amount>1?' ×'+amount:''),amount},...(Number.isSafeInteger(amount)&&amount>0&&amount<=1e9?{support:{metric:'kicks',amount}}:{})};
 }
 const type=name.split('\\').at(-1);
 if(['SubscriptionEvent','GiftedSubscriptionsEvent'].includes(type)&&typeof data.id==='string'&&data.id){
  const gifted=type==='GiftedSubscriptionsEvent',user=gifted?data.gifter_username:data.username;
  const recipients=data.gifted_usernames,amount=gifted&&Array.isArray(recipients)?recipients.length:gifted?0:1;
  if(typeof user!=='string'||!user||!Number.isSafeInteger(amount)||amount<=0||amount>100000)return null;
  return {platform:'kick',sourceKey:'kick',id:'subscription-'+data.id,user,parts:[],event:{kind:gifted?'giftbomb':'sub',title:gifted?'Gifted subscriptions':'Subscription',amount},support:{metric:'subscriptions',amount}};
 }
 return null;
}

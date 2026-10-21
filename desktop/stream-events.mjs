// Stream events that arrive outside regular chat lines, turned into event messages.
// Twitch: the signed-in popout chat's event socket (hermes) delivers channel-point
// redemptions. Redemptions with text also reach IRC chat, so only text-free ones
// are taken here. Kick: channel events on the page's realtime socket.
const json=value=>{if(typeof value!=='string')return value&&typeof value==='object'?value:null;try{return JSON.parse(value);}catch{return null;}};
export function twitchHermesEvent(frame){
 const message=json(json(frame)?.notification?.pubsub);if(message?.type!=='reward-redeemed')return null;
 const redemption=message.data?.redemption,reward=redemption?.reward,user=redemption?.user;
 if(!redemption?.id||!reward?.title||!user||String(redemption.user_input||'').trim())return null;
 return {platform:'twitch',sourceKey:'twitch',id:'reward-'+redemption.id,user:user.display_name||user.login||'Someone',userId:String(user.id||''),parts:[],event:{kind:'redemption',title:reward.title,amount:reward.cost,color:reward.background_color,image:reward.image?.url_4x||reward.default_image?.url_4x}};
}
export function kickEvent(frame){
 const envelope=json(frame),pub=envelope?.push?.pub?.data||envelope,name=pub?.event,data=json(pub?.data);
 if(!name||!data)return null;
 if(name==='KicksGifted'&&data.gift_transaction_id&&data.sender?.username){
  const gift=data.gift||{},amount=Number(gift.amount)||0,message=String(data.message||'').trim();
  return {platform:'kick',sourceKey:'kick',id:'kicks-'+data.gift_transaction_id,user:data.sender.username,userId:String(data.sender.id||''),parts:message?[{type:'text',text:message}]:[],event:{kind:'gift',title:(gift.name||'Kicks gift')+(amount>1?' ×'+amount:''),amount}};
 }
 return null;
}

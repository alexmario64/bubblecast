import {test} from 'node:test';
import assert from 'node:assert/strict';
import {kickEvent} from '../desktop/stream-events.mjs';
import {parseIRC,twitchNotice,TwitchLive} from '../twitch-live.mjs';
import {youtubeActions} from '../network-chat.mjs';
import {settings,normalize,eventKinds} from '../core.mjs';
import {MessageRelay} from '../relay.mjs';
const notice=(tags,text='')=>parseIRC('@'+Object.entries({id:'n1','display-name':'Viewer','user-id':'42',...tags}).map(([k,v])=>k+'='+v).join(';')+' :tmi.twitch.tv USERNOTICE #channel'+(text?' :'+text:''));
test('Twitch notices become sub, resub, gift bomb and raid events with Twitch system text',()=>{
 const sub=twitchNotice(notice({'msg-id':'sub','system-msg':'Viewer\\ssubscribed\\sat\\sTier\\s1.'}));assert.deepEqual(sub.event,{kind:'sub',title:'Viewer subscribed at Tier 1.',amount:0});assert.equal(sub.user,'Viewer');assert.deepEqual(sub.parts,[]);
 const resub=twitchNotice(notice({'msg-id':'resub','msg-param-cumulative-months':'14','system-msg':'Viewer\\ssubscribed\\sfor\\s14\\smonths!'},'love this stream'));assert.equal(resub.event.kind,'resub');assert.equal(resub.event.amount,14);assert.equal(resub.parts[0].text,'love this stream');
 assert.equal(twitchNotice(notice({'msg-id':'subgift','msg-param-community-gift-id':'123'})),null,'single gifts inside a gift bomb are not shown separately');
 assert.equal(twitchNotice(notice({'msg-id':'subgift','system-msg':'Viewer\\sgifted\\sa\\ssub!'})).event.kind,'giftsub');
 const bomb=twitchNotice(notice({'msg-id':'submysterygift','msg-param-mass-gift-count':'5','system-msg':'Viewer\\sis\\sgifting\\s5\\ssubs!'}));assert.deepEqual([bomb.event.kind,bomb.event.amount],['giftbomb',5]);
 assert.equal(twitchNotice(notice({'msg-id':'raid','msg-param-viewerCount':'120'})).event.amount,120);
 assert.equal(twitchNotice(notice({'msg-id':'announcement'})),null);
});
test('Twitch chat redemptions carry the reward title from the channel reward list',async()=>{
 const sent=[],messages=[];class Socket{constructor(){this.listeners={};Socket.last=this;}addEventListener(k,f){this.listeners[k]=f;}send(s){sent.push(s);}close(){}}
 const live=new TwitchLive({onMessage:m=>messages.push(m),Socket,schedule:()=>0,cancel:()=>{},lookupRewards:async()=>new Map([['w1',{title:'Hydrate!',cost:300,color:'#00C7AC'}]])});
 live.configure('channel');await new Promise(r=>setTimeout(r,0));
 Socket.last.listeners.message({data:'@id=m1;display-name=Viewer;custom-reward-id=w1 :viewer!viewer@tmi PRIVMSG #channel :drink water\r\n'});
 assert.deepEqual(messages[0].event,{kind:'redemption',title:'Hydrate!',amount:300,color:'#00C7AC'});assert.equal(messages[0].parts[0].text,'drink water');live.stop();
});
test('Kick gifts become events and unrelated frames are ignored',()=>{
 const frame=JSON.stringify({push:{channel:'channel_1',pub:{data:{event:'KicksGifted',data:JSON.stringify({gift_transaction_id:'g1',message:'',sender:{id:9,username:'kickfan'},gift:{name:'Hell Yeah',amount:3}})}}}});
 assert.deepEqual(kickEvent(frame),{platform:'kick',sourceKey:'kick',id:'kicks-g1',user:'kickfan',userId:'9',parts:[],event:{kind:'gift',title:'Hell Yeah ×3',amount:3}});
 assert.equal(kickEvent(JSON.stringify({push:{pub:{data:{event:'KicksLeaderboardUpdated',data:'{}'}}}})),null);
 assert.equal(kickEvent('not json'),null);
});
test('YouTube Super Chats, memberships and gifted memberships are tagged as events',()=>{
 const author={authorName:{simpleText:'Fan'},authorExternalChannelId:'UC1',timestampUsec:'1000'};
 const payload={continuationContents:{liveChatContinuation:{actions:[
  {addChatItemAction:{item:{liveChatPaidMessageRenderer:{...author,id:'p1',purchaseAmountText:{simpleText:'$5.00'},bodyBackgroundColor:4294947584,message:{runs:[{text:'great stream'}]}}}}},
  {addChatItemAction:{item:{liveChatPaidMessageRenderer:{...author,id:'p2',purchaseAmountText:{simpleText:'$2.00'}}}}},
  {addChatItemAction:{item:{liveChatMembershipItemRenderer:{...author,id:'m1',headerSubtext:{runs:[{text:'Welcome to the club!'}]}}}}},
  {addChatItemAction:{item:{liveChatSponsorshipsGiftPurchaseAnnouncementRenderer:{id:'g1',authorExternalChannelId:'UC1',timestampUsec:'1000',header:{liveChatSponsorshipsHeaderRenderer:{authorName:{simpleText:'Fan'},primaryText:{runs:[{text:'Gifted 5 memberships'}]}}}}}}}]}}};
 const [paid,quiet,member,gifts]=youtubeActions(payload);
 assert.deepEqual(paid.event,{kind:'superchat',title:'$5.00',color:'#ffb300'});assert.equal(paid.parts[0].text,'great stream');
 assert.equal(quiet.event.title,'$2.00');assert.deepEqual(quiet.parts,[]);
 assert.deepEqual(member.event,{kind:'membership',title:'Welcome to the club!'});
 assert.deepEqual(gifts.event,{kind:'giftmembership',title:'Gifted 5 memberships'});assert.equal(gifts.user,'Fan');
});
test('overlays show only enabled event kinds while the relay keeps every event',()=>{
 const raw={id:'e1',platform:'twitch',user:'Viewer',parts:[],event:{kind:'follow',title:'Viewer followed',color:'bad'}};
 assert.equal(settings({}).eventsShown.includes('follow'),false);assert.equal(normalize(raw,settings({})),null);
 assert.deepEqual(normalize(raw,settings({eventsShown:'follow sub'})).event,{kind:'follow',title:'Viewer followed'});
 assert.equal(normalize({...raw,event:{kind:'bogus'}},settings({})),null,'unknown kinds are plain messages, and empty plain messages are dropped');
 assert.equal(new MessageRelay().ingest(raw,settings({})).message.event.kind,'follow');
 assert.deepEqual(settings({eventsShown:['sub','nope','raid']}).eventsShown,['sub','raid']);assert.ok(eventKinds.includes('redemption'));
});
test('chat-connection messages use official badges and reward details when signed in',()=>{const messages=[];class Socket{constructor(){this.listeners={};Socket.last=this;}addEventListener(k,f){this.listeners[k]=f;}send(){}close(){}}
 const live=new TwitchLive({onMessage:m=>messages.push(m),Socket,schedule:()=>0,cancel:()=>{},reward:id=>id==='w1'?{title:'Hydrate!',cost:300,color:'#00C7AC'}:null,badgeImages:tag=>tag?[{src:'https://static-cdn.jtvnw.net/badges/v1/b/3',alt:'Broadcaster'}]:[]});live.configure('channel');
 Socket.last.listeners.message({data:'@id=m1;display-name=Viewer;badges=broadcaster/1;custom-reward-id=w1;gifs=0-4||https://media.giphy.com/media/abc/giphy.gif :viewer!viewer@tmi PRIVMSG #channel :hello\r\n'});
 assert.deepEqual(messages[0].badges,[{src:'https://static-cdn.jtvnw.net/badges/v1/b/3',alt:'Broadcaster'}]);assert.deepEqual(messages[0].event,{kind:'redemption',title:'Hydrate!',amount:300,color:'#00C7AC'});assert.equal(messages[0].parts[0].type,'image','GIFs from the chat connection are kept');live.stop();});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {gzipSync} from 'node:zlib';
import {youtubeActions,tiktokPayload,protobuf,NetworkMerge,NetworkFeed} from '../network-chat.mjs';
import {attachNetworkCapture} from '../desktop/network-capture.mjs';
import {MessageRelay} from '../relay.mjs';
import {defaults} from '../core.mjs';
const message=(id,content='hello')=>({id,sourceId:id,platform:'youtube',sourceKey:'youtube',user:'Full Name',userId:'user-id',parts:[{type:'text',text:content}],badges:[]});
const yt=(id,time=2000000)=>({id,authorName:{simpleText:'Full Name'},authorExternalChannelId:'user-id',timestampUsec:String(time*1000),message:{runs:[{text:'hello '},{emoji:{emojiId:'dance',shortcuts:[':dance:'],image:{thumbnails:[{url:'https://yt3.ggpht.com/dance.gif'}]}}}]},authorBadges:[{liveChatAuthorBadgeRenderer:{tooltip:'Member',customThumbnail:{thumbnails:[{url:'https://yt3.ggpht.com/member.png'}]}}}]});
const batch=(...items)=>({continuationContents:{liveChatContinuation:{actions:items.map(item=>({addChatItemAction:{item:{liveChatTextMessageRenderer:item}}}))}}});
test('an empty YouTube continuation arms capture before the next new message',()=>{assert.deepEqual(youtubeActions({continuationContents:{liveChatContinuation:{continuations:[]}}}),[]);const events=[],feed=new NetworkFeed({platform:'youtube',sourceKey:'youtube',now:()=>1000,onMessage:m=>events.push(m)});feed.accept([],{baseline:true});feed.accept([{...message('new'),sourceTime:1100}]);assert.equal(events.length,1);});
test('YouTube incoming actions include full names, native animated media, custom badges and independent Shorts source',()=>{
 const [m]=youtubeActions(batch(yt('new')),'youtubeShorts');assert.equal(m.user,'Full Name');assert.equal(m.sourceKey,'youtubeShorts');assert.equal(m.parts[1].src,'https://yt3.ggpht.com/dance.gif');assert.equal(m.badges[0].alt,'Member');assert.equal(m.sourceTime,2000000);assert.equal(youtubeActions({}),null);
});
test('YouTube stickers and scoped moderation parse without replay/system notices',()=>{
 const payload={continuationContents:{liveChatContinuation:{actions:[{addChatItemAction:{item:{liveChatPaidStickerRenderer:{...yt('sticker'),message:undefined,sticker:{thumbnails:[{url:'https://yt3.ggpht.com/sticker.gif'}]}}}}},{markChatItemAsDeletedAction:{targetItemId:'delete'}},{markChatItemsByAuthorAsDeletedAction:{externalChannelId:'banned'}},{replayChatItemAction:{actions:[]}}]}}};const events=youtubeActions(payload,'youtubeShorts');assert.equal(events.length,3);assert.equal(events[0].parts[0].large,true);assert.equal(events[1].id,'delete');assert.equal(events[2].userId,'banned');assert.ok(events.every(m=>m.sourceKey==='youtubeShorts'));
});
test('YouTube first batch and older rows stay ignored, later messages forward immediately',()=>{
 let now=1000;const events=[],feed=new NetworkFeed({platform:'youtube',sourceKey:'youtube',now:()=>now,onMessage:m=>events.push(m)});feed.accept([{...message('history'),sourceTime:900}],{baseline:true});assert.equal(feed.page(message('history')),null);now=2000;feed.accept([{...message('also-old'),sourceTime:900},{...message('new'),sourceTime:1900}]);assert.equal(events.length,1);assert.equal(events[0].id,'new');assert.equal(events[0].observedAt,2000);
});
test('network and page streams merge to one message in either arrival order and preserve native user IDs/badges',()=>{
 const merge=new NetworkMerge(),relay=new MessageRelay(),raw={...message('network'),badges:[{src:'https://yt3.ggpht.com/member.png',alt:'Member'}]};assert.equal(relay.ingest(merge.network(raw),defaults).type,'message');const update=merge.page({...message('random-page-id'),userId:'',badges:[]});assert.equal(update.id,'network');assert.equal(update.userId,'user-id');assert.equal(update.badges.length,1);relay.ingest(update,defaults);assert.equal(relay.seen.size,1);
 const other=new NetworkMerge();other.page(message('page-first','next'));const late=other.network(message('network-late','next'));assert.equal(late.id,'page-first');assert.equal(late.action,'update');
});
test('intentional duplicate text pairs FIFO and expired page enrichment cannot revive retired overlay IDs',()=>{
 let now=1000;const merge=new NetworkMerge({now:()=>now});merge.network(message('one'));merge.network(message('two'));now=3000;assert.equal(merge.page(message('page-one')).id,'one');assert.equal(merge.page({...message('page-one'),action:'update'}).id,'one');assert.equal(merge.page(message('page-two')).id,'two');assert.equal(merge.lastPageDelayMs,2000);assert.equal(merge.page({action:'delete',id:'page-one'}).id,'one');
});
const v=n=>{n=BigInt(n);const bytes=[];do{let b=Number(n&127n);n>>=7n;if(n)b|=128;bytes.push(b);}while(n);return Buffer.from(bytes);};
const integer=(n,value)=>Buffer.concat([v(n*8),v(value)]),field=(n,value)=>{const b=Buffer.isBuffer(value)?value:Buffer.from(value);return Buffer.concat([v(n*8+2),v(b.length),b]);},proto=(...items)=>Buffer.concat(items),img=url=>field(1,url);
const tikUser=()=>proto(integer(1,987654321012345678n),field(3,'Full TikTok Nickname'),field(38,'viewer'),field(64,proto(field(12,field(5,'6')),field(23,proto(field(2,img('https://p16-webcast.tiktokcdn.com/badge.png')),field(4,'6'))))));
const common=id=>proto(integer(2,id),integer(4,2000));
const chat=(id=123n)=>proto(field(1,common(id)),field(2,tikUser()),field(3,'hello'));
const envelope=(method,payload,{history=false}={})=>proto(field(1,method),field(2,payload),integer(3,123),integer(6,history?1:0));
const response=(...messages)=>proto(...messages.map(m=>field(1,m)));
const push=(payload,compress=false)=>field(8,compress?gzipSync(payload):payload);
test('TikTok gzip frames preserve 64-bit IDs, full nicknames and real badge image/level',()=>{
 const [m]=tiktokPayload(push(response(envelope('WebcastChatMessage',chat())),true));assert.equal(m.id,'123');assert.equal(m.userId,'987654321012345678');assert.equal(m.user,'Full TikTok Nickname');assert.equal(m.badges[0].label,'6');assert.equal(m.badges[0].src,'https://p16-webcast.tiktokcdn.com/badge.png');assert.equal(m.parts[0].text,'hello');
});
test('TikTok frames ignore historical comments and gift/like/join notices',()=>{
 const events=tiktokPayload(push(response(envelope('WebcastChatMessage',chat(),{history:true}),envelope('WebcastGiftMessage',Buffer.alloc(0)),envelope('WebcastMemberMessage',Buffer.alloc(0)))));assert.deepEqual(events,[]);
});
test('TikTok emote messages keep original animated image URLs and packed moderation IDs',()=>{
 const emote=proto(field(1,common(124)),field(2,tikUser()),field(3,proto(field(1,'dance'),field(2,img('https://p16-webcast.tiktokcdn.com/dance.gif')))));
 const removal=proto(field(2,proto(v(123),v(124))),field(3,v(987654321012345678n)));
 const events=tiktokPayload(push(response(envelope('WebcastEmoteChatMessage',emote),envelope('WebcastImDeleteMessage',removal))));assert.equal(events[0].parts[0].src,'https://p16-webcast.tiktokcdn.com/dance.gif');assert.deepEqual(events.slice(1).map(m=>m.id||m.userId),['123','124','987654321012345678']);
});
test('malformed or oversized TikTok protobuf fails safely instead of allocating arbitrary frames',()=>{
 assert.throws(()=>protobuf(Buffer.from([10,255])));assert.throws(()=>protobuf(Buffer.alloc(8*1024*1024+1)));assert.equal(tiktokPayload(field(1,'not a push frame')),null);
});
class Debugger extends EventEmitter{constructor(){super();this.responses=new Map();this.attached=false;this.calls=[];}attach(){this.attached=true;}isAttached(){return this.attached;}detach(){this.attached=false;this.emit('detach');}async sendCommand(method,params){this.calls.push([method,params]);if(method==='Network.getResponseBody')return this.responses.get(params.requestId);return {};}}
const tick=()=>new Promise(setImmediate);
test('YouTube network observer processes only live-chat endpoints and the two inputs stay independent',async()=>{
 let now=1000;const debug=new Debugger(),events=[],capture=attachNetworkCapture({debugger:debug},{platform:'youtube',sourceKey:'youtubeShorts',now:()=>now,onMessage:m=>events.push(m)});
 const receive=async(id,payload,url='https://www.youtube.com/youtubei/v1/live_chat/get_live_chat')=>{debug.responses.set(id,{body:JSON.stringify(payload),base64Encoded:false});debug.emit('message',{},'Network.responseReceived',{requestId:id,response:{url}});debug.emit('message',{},'Network.loadingFinished',{requestId:id});await tick();};
 await receive('baseline',batch(yt('old',900)));assert.equal(events.length,0);now=2000;await receive('new',batch(yt('new',1900)));assert.equal(events.length,1);assert.equal(events[0].sourceKey,'youtubeShorts');await receive('evil',batch(yt('evil')),'https://evil.test/youtubei/v1/live_chat/get_live_chat');assert.equal(events.length,1);await receive('replay',batch(yt('replay')),'https://www.youtube.com/youtubei/v1/live_chat/get_live_chat_replay');assert.equal(events.length,1);capture.stop();assert.equal(debug.attached,false);assert.equal(debug.listenerCount('message'),0);
});
test('TikTok websocket receiver accepts only the source webcast socket and falls back if detached',()=>{
 const debug=new Debugger(),events=[],capture=attachNetworkCapture({debugger:debug},{platform:'tiktok',sourceKey:'tiktok',now:()=>1000000,onMessage:m=>events.push(m)});debug.emit('message',{},'Network.webSocketCreated',{requestId:'socket',url:'wss://webcast-ws.tiktok.com/webcast/im/push/v2/'});debug.emit('message',{},'Network.webSocketFrameReceived',{requestId:'socket',response:{opcode:2,payloadData:push(response(envelope('WebcastChatMessage',chat()))).toString('base64')}});assert.equal(events.length,1);assert.equal(capture.feed.ready,true);debug.emit('detach');assert.equal(capture.feed.ready,false);capture.stop();
});

test('a YouTube page reload establishes a new baseline instead of replaying restored rows',async()=>{
 let now=1000;const debug=new Debugger(),contents=new EventEmitter();contents.debugger=debug;const events=[],capture=attachNetworkCapture(contents,{platform:'youtube',sourceKey:'youtube',now:()=>now,onMessage:m=>events.push(m)});
 const receive=async(id,item)=>{debug.responses.set(id,{body:JSON.stringify(batch(item)),base64Encoded:false});debug.emit('message',{},'Network.responseReceived',{requestId:id,response:{url:'https://www.youtube.com/youtubei/v1/live_chat/get_live_chat'}});debug.emit('message',{},'Network.loadingFinished',{requestId:id});await tick();};
 await receive('first',yt('baseline',900));now=2000;await receive('live',yt('live',1900));assert.equal(events.length,1);contents.emit('did-start-navigation',{},'https://www.youtube.com/live_chat?v=abcdefghijk',false,true);await receive('restored',yt('restored',1800));assert.equal(events.length,1);assert.equal(capture.feed.page({...message('restored'),action:'update'}),null);capture.stop();assert.equal(contents.listenerCount('did-start-navigation'),0);
});
test('bad network payloads keep the page capture usable and never forward partial data',async()=>{
 const debug=new Debugger(),errors=[],events=[],capture=attachNetworkCapture({debugger:debug},{platform:'youtube',sourceKey:'youtube',onMessage:m=>events.push(m),onError:e=>errors.push(e)});debug.responses.set('bad',{body:'invalid json',base64Encoded:false});debug.emit('message',{},'Network.responseReceived',{requestId:'bad',response:{url:'https://www.youtube.com/youtubei/v1/live_chat/get_live_chat'}});debug.emit('message',{},'Network.loadingFinished',{requestId:'bad'});await tick();assert.equal(capture.feed.ready,false);assert.equal(events.length,0);assert.equal(errors.length,1);assert.equal(capture.feed.page(message('page-fallback')).id,'page-fallback');capture.stop();
});

test('TikTok emote ID versus rendered aria label does not duplicate the same media',()=>{
 const merge=new NetworkMerge(),a={...message('native'),platform:'tiktok',sourceKey:'tiktok',parts:[{type:'image',src:'https://p16-webcast.tiktokcdn.com/asset/dance.gif?token=one',alt:'123456',large:false}]};merge.network(a);const update=merge.page({...a,id:'page-id',parts:[{...a.parts[0],src:'https://p19-webcast.tiktokcdn.com/asset/dance.gif?token=two',alt:'dance'}]});assert.equal(update.id,'native');assert.equal(update.action,'update');const different=merge.page({...a,id:'different',parts:[{...a.parts[0],src:'https://p19-webcast.tiktokcdn.com/asset/other.gif',alt:'other'}]});assert.equal(different.id,'different');assert.notEqual(different.action,'update');
});

test('duplicate YouTube batches never inflate first-arrival source latency',()=>{
 let now=1000;const feed=new NetworkFeed({platform:'youtube',sourceKey:'youtube',now:()=>now,onMessage(){}}),m={...message('one'),sourceTime:1800};now=2000;feed.accept([m]);assert.equal(feed.lastSourceDelayMs,200);now=9000;feed.accept([m]);assert.equal(feed.lastSourceDelayMs,200);
});

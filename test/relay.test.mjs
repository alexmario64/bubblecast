import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MessageRelay} from '../relay.mjs';
import {defaults} from '../core.mjs';
const msg=(id,text)=>({id,platform:'twitch',user:'DemoStreamer',parts:[{type:'text',text}]});
test('shared relay retains common and custom bots for the dock with overlay filtering enabled',()=>{const relay=new MessageRelay();for(const [i,user] of ['Nightbot','Fossabot','CustomBot'].entries()){const event=relay.ingest({...msg('bot'+i,'announcement'),user},{...defaults,filterBots:true,ignoredBots:['CustomBot']});assert.equal(event.type,'message');assert.equal(event.message.user,user);}});
test('native Twitch emote scale and frame-marker changes cannot restart the same animation',()=>{const relay=new MessageRelay(),image={type:'image',src:'https://static-cdn.jtvnw.net/emoticons/v2/example/default/dark/1.0#e=0',alt:'dance'};const first=relay.ingest({...msg('one',''),parts:[image]},defaults);assert.ok(first.message.parts[0].src.endsWith('/3.0'));assert.equal(relay.ingest({...msg('one',''),action:'update',parts:[{...image,src:image.src.replace('1.0#e=0','2.0#e=1')}]},defaults),null);});
test('same native IDs from two YouTube streams stay separate through updates',()=>{const relay=new MessageRelay(),normal={...msg('same','normal'),platform:'youtube'},shorts={...normal,sourceKey:'youtubeShorts',parts:[{type:'text',text:'shorts'}]};assert.equal(relay.ingest(normal,defaults).type,'message');assert.equal(relay.ingest(shorts,defaults).type,'message');const update=relay.ingest({...shorts,action:'update',userColor:'',parts:[{type:'text',text:'shorts updated'}]},defaults);assert.equal(update.message.sourceKey,'youtubeShorts');assert.equal(relay.seen.size,2);assert.equal(relay.ingest(normal,defaults),null);});
test('resolved channel BTTV artwork survives raw-code updates and resolves future codes',()=>{const relay=new MessageRelay(),image={type:'image',src:'https://cdn.betterttv.net/emote/channel-emote/3x.webp',alt:'POGSLIDE'};relay.ingest({...msg('one',''),parts:[image]},defaults);const update=relay.ingest({...msg('one','POGSLIDE'),action:'update'},defaults);assert.equal(update,null);assert.equal(relay.seen.get('twitch:one').parts[0].type,'image');const next=relay.ingest(msg('two','POGSLIDE'),defaults);assert.equal(next.type,'message');assert.equal(next.message.parts[0].src,image.src);assert.equal(relay.ingest(msg('three','POGSLIDE'),{...defaults,bttv:false}).message.parts[0].type,'text');});
test('native emote artwork cannot be downgraded to its text alt on refresh',()=>{const relay=new MessageRelay();relay.ingest({...msg('one',''),parts:[{type:'image',src:'https://static-cdn.jtvnw.net/emoticons/v2/425618/default/dark/3.0',alt:'LUL'}]},defaults);const patch=relay.ingest({...msg('one','LUL'),action:'update'},defaults);assert.equal(patch,null);assert.equal(relay.seen.get('twitch:one').parts[0].type,'image');});
test('a late enhancer ID cannot replay the previous message when a new message arrives',()=>{
 const relay=new MessageRelay();const first=relay.ingest(msg('temporary-id','something'),defaults);
 const late=relay.ingest({...msg('TWITCH:late-id','something'),action:'update',badges:[{src:'https://static-cdn.jtvnw.net/badges/v1/channel-subscriber/3',alt:'Subscriber'}]},defaults);
 const second=relay.ingest(msg('second-id','something else'),defaults);
 assert.equal(first.type,'message');assert.equal(late,null);assert.equal(second.type,'message');assert.equal(relay.seen.size,2);
});
test('known artwork updates remain updates and do not introduce chat',()=>{
 const relay=new MessageRelay();relay.ingest(msg('one','hi'),defaults);const patch=relay.ingest({...msg('one','hi'),action:'update',badges:[{src:'https://static-cdn.jtvnw.net/badges/v1/channel-subscriber/1',alt:'71-Month Subscriber'}]},defaults);assert.equal(patch.type,'update');assert.equal(patch.message.id,'one');assert.equal(patch.message.badges[0].alt,'71-Month Subscriber');assert.equal(relay.seen.size,1);
});
test('retries are suppressed while intentionally repeated text with different IDs is retained',()=>{
 const relay=new MessageRelay();assert.equal(relay.ingest(msg('one','hi'),defaults).type,'message');assert.equal(relay.ingest(msg('one','hi'),defaults),null);assert.equal(relay.ingest(msg('two','hi'),defaults).type,'message');
});
test('updates cannot resurrect messages forgotten after the relay capacity is reached',()=>{
 const relay=new MessageRelay();for(let i=0;i<5001;i++)relay.ingest(msg(String(i),'hello'),defaults);assert.equal(relay.seen.size,5000);assert.equal(relay.ingest({...msg('0','hello'),action:'update'},defaults),null);
});
test('a recreated Twitch row with its late native ID cannot become a fresh message',()=>{
 const relay=new MessageRelay();relay.ingest(msg('first-local-id','previous'),defaults);
 assert.equal(relay.ingest({...msg('first-local-id','previous'),action:'update',sourceId:'TWITCH:native-id'},defaults),null);
 assert.equal(relay.ingest({...msg('TWITCH:native-id','previous'),sourceId:'TWITCH:native-id'},defaults),null);
 assert.equal(relay.ingest({...msg('next-id','new message'),sourceId:'TWITCH:next'},defaults).type,'message');
});

test('identical repeated updates produce no repaint events while real metadata changes still forward',()=>{const relay=new MessageRelay(),raw=msg('one','hello');relay.ingest(raw,defaults);for(let i=0;i<5;i++)assert.equal(relay.ingest({...raw,action:'update'},defaults),null);assert.equal(relay.ingest({...raw,userColor:'#ff5858',action:'update'},defaults).type,'update');});

test('Twitch GIF-to-WebP hydration retains the first source without emitting a restart update',()=>{
 const relay=new MessageRelay(),gif={type:'image',large:true,alt:'[Nintendo GIF]',src:'https://media3.giphy.com/media/OZ1VAPExqf1G40bBAt/giphy.gif?cid=first&rid=giphy.gif'};
 relay.ingest({...msg('giphy',''),parts:[gif]},defaults);
 assert.equal(relay.ingest({...msg('giphy',''),action:'update',parts:[{...gif,src:gif.src.replaceAll('.gif','.webp')}]},defaults),null);
 const changed=relay.ingest({...msg('giphy',''),action:'update',userColor:'#ff0000',parts:[{...gif,src:gif.src.replaceAll('.gif','.webp')}]},defaults);
 assert.equal(changed.type,'update');assert.equal(changed.message.parts[0].src,gif.src);
 const different=relay.ingest({...msg('giphy',''),action:'update',parts:[{...gif,src:gif.src.replace('OZ1VAPExqf1G40bBAt','DifferentAsset')}]},defaults);
 assert.ok(different.message.parts[0].src.includes('DifferentAsset'));
});
test('a native copy that adds support to a row the page showed first is reported once for counting',()=>{
 const relay=new MessageRelay(),row={...msg('row','Cheer100 hype'),platform:'twitch',sourceKey:'twitch'};
 assert.equal(relay.ingest(row,defaults).type,'message');
 const native=relay.ingest({...row,action:'update',support:{metric:'bits',amount:100}},defaults);
 assert.equal(native.type,'support','same appearance: counted but not repainted');assert.deepEqual(native.message.support,{metric:'bits',amount:100});
 assert.equal(relay.ingest({...row,action:'update',support:{metric:'bits',amount:100}},defaults),null,'the same support is not reported again');
 const other={...msg('other','Cheer50'),platform:'twitch',sourceKey:'twitch'};relay.ingest(other,defaults);
 const changed=relay.ingest({...other,action:'update',userColor:'#123456',support:{metric:'bits',amount:50}},defaults);assert.equal(changed.type,'update');assert.equal(changed.supportAdded,true);
});

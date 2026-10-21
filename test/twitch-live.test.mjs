import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseIRC,twitchParts,TwitchMerge,TwitchLive} from '../twitch-live.mjs';
import {MessageRelay} from '../relay.mjs';
import {defaults} from '../core.mjs';
const raw=(id,text='hello')=>({id,sourceId:id,platform:'twitch',user:'DemoStreamer',userColor:'#ff0000',userId:'12345678',parts:[{type:'text',text}]});
test('IRC parser preserves escaped full names, URLs with equals and message colons',()=>{
 const m=parseIRC('@display-name=Full\\sName;custom=a=b :viewer!v@tmi PRIVMSG #alex :hello: world');assert.equal(m.tags['display-name'],'Full Name');assert.equal(m.tags.custom,'a=b');assert.equal(m.text,'hello: world');assert.deepEqual(m.params,['#alex']);assert.equal(parseIRC('PING :tmi.twitch.tv').text,'tmi.twitch.tv');
});
test('native emotes use Unicode code point ranges and animated default artwork',()=>{
 const parts=twitchParts('😀 Kappa hi Kappa',{emotes:'25:2-6,11-15'});assert.deepEqual(parts.map(p=>p.text||p.alt),['😀 ','Kappa',' hi ','Kappa']);assert.ok(parts[1].src.endsWith('/25/default/dark/3.0'));
});
test('GIF tag renders the documented image with text around it; unsafe and invalid ranges stay literal',()=>{
 const text='a [YAY] z',url='https://media4.giphy.com/media/ABC/giphy.gif?cid=x&rid=giphy.gif';const parts=twitchParts(text,{gifs:'2-6|ABC|'+url});assert.equal(parts[1].src,url);assert.equal(parts[1].alt,'[YAY]');assert.equal(parts[1].large,true);assert.deepEqual(twitchParts(text,{gifs:'2-6|x|http://localhost/a',emotes:'25:99-100'}),[{type:'text',text}]);
});
test('delayed page rows and all subsequent updates enrich one direct message',()=>{
 let now=1000;const merge=new TwitchMerge({now:()=>now}),relay=new MessageRelay();const direct=merge.fromIRC(raw('irc'));assert.equal(relay.ingest(direct,defaults).type,'message');now+=4100;const page={...raw('dom'),badges:[{src:'https://static-cdn.jtvnw.net/badges/v1/sub/3',alt:'Subscriber'}]};const update=merge.fromDOM(page);assert.equal(update.id,'irc');assert.equal(update.action,'update');assert.equal(relay.ingest(update,defaults).type,'update');assert.equal(merge.lastPageDelayMs,4100);const enriched=merge.fromDOM({...page,action:'update',userId:'',userColor:''});assert.equal(enriched.userId,'12345678');assert.equal(enriched.userColor,'#ff0000');assert.equal(relay.ingest(merge.fromDOM({...page,action:'update'}),defaults),null);assert.equal(relay.seen.size,1);assert.equal(merge.fromIRC(raw('irc')),null);
});
test('intentionally repeated identical messages pair FIFO without collapsing new messages',()=>{
 const merge=new TwitchMerge();merge.fromIRC(raw('first'));merge.fromIRC(raw('second'));assert.equal(merge.fromDOM(raw('page1')).id,'first');assert.equal(merge.fromDOM(raw('page1')).id,'first');assert.equal(merge.fromDOM(raw('page2')).id,'second');
});
test('page-first delivery and socket reconnect fallback cannot duplicate the later direct message',()=>{
 const merge=new TwitchMerge(),relay=new MessageRelay();assert.equal(relay.ingest(merge.fromDOM(raw('page')),defaults).type,'message');assert.equal(merge.fromIRC(raw('direct')).id,'page');assert.equal(relay.ingest(merge.fromIRC(raw('next','new')),defaults).type,'message');assert.equal(merge.fromDOM({...raw('page'),action:'update'}).id,'page');assert.equal(merge.fromDOM(raw('newpage','new')).id,'next');
});
test('actual badge cache is reused only for the same viewer and badge metadata',()=>{
 const merge=new TwitchMerge();merge.fromIRC(raw('one'),'subscriber/12');const badge={src:'https://static-cdn.jtvnw.net/badges/v1/real-sub/3',alt:'Subscriber'};merge.fromDOM({...raw('page'),badges:[badge]});assert.deepEqual(merge.fromIRC(raw('two'),'subscriber/12').badges,[badge]);assert.deepEqual(merge.fromIRC(raw('three'),'subscriber/24').badges,[]);assert.deepEqual(merge.fromIRC({...raw('other'),user:'OtherViewer'},'subscriber/12').badges,[]);
});
test('old pending rows expire and aliases stay bounded',()=>{
 let now=0;const merge=new TwitchMerge({now:()=>now});merge.fromIRC(raw('old'));now=61000;assert.equal(merge.fromDOM(raw('new')).id,'new');assert.equal(merge.irc.length,0);
});
class FakeSocket extends EventTarget{
 static instances=[];constructor(url){super();this.url=url;this.sent=[];this.closed=false;FakeSocket.instances.push(this);}send(s){this.sent.push(s);}close(){this.closed=true;this.dispatchEvent(new Event('close'));}receive(s){this.dispatchEvent(new MessageEvent('message',{data:s}));}
}
function fixture(){const messages=[],timers=[],states=[];const live=new TwitchLive({Socket:FakeSocket,onMessage:m=>messages.push(m),onState:s=>states.push(s),schedule:(f,ms)=>{const item={f,ms};timers.push(item);return item;},cancel:item=>{if(item)item.cancelled=true;}});return {live,messages,timers,states};}
test('direct listener joins read-only, handles PING, parses native metadata, and never sends a chat message',()=>{
 const f=fixture();f.live.configure('DemoStreamer');const socket=f.live.socket;socket.dispatchEvent(new Event('open'));assert.equal(socket.sent.length,3);assert.equal(socket.sent[2],'JOIN #demostreamer');socket.receive(':tmi.twitch.tv ROOMSTATE #demostreamer\r\nPING :tmi.twitch.tv');assert.equal(f.live.ready,true);assert.equal(socket.sent.at(-1),'PONG :tmi.twitch.tv');socket.receive('@id=native;display-name=Full\\sName;user-id=42;color=#AABBCC;emotes=25:0-4 :user!u@tmi PRIVMSG #demostreamer :Kappa');assert.equal(f.messages[0].user,'Full Name');assert.equal(f.messages[0].userColor,'#AABBCC');assert.equal(f.messages[0].parts[0].alt,'Kappa');assert.ok(socket.sent.every(s=>!s.startsWith('PRIVMSG')));f.live.stop();
});
test('deletion and clears use native IDs and foreign channel messages are rejected',()=>{
 const f=fixture();f.live.configure('demostreamer');const s=f.live.socket;s.receive('@id=no :v!v PRIVMSG #other :ignore');s.receive('@target-msg-id=gone :tmi CLEARMSG #demostreamer :bad');s.receive('@target-user-id=42 :tmi CLEARCHAT #demostreamer :viewer');s.receive(':tmi CLEARCHAT #demostreamer');assert.equal(f.messages.length,3);assert.equal(f.messages[0].id,'gone');assert.equal(f.messages[1].userId,'42');assert.equal(f.messages[2].action,'clear');f.live.stop();
});
test('disconnect reconnects with backoff; stopping or changing channel retires the old socket',()=>{
 const f=fixture();f.live.configure('first');const old=f.live.socket;old.close();assert.equal(f.timers[0].ms,1000);f.timers[0].f();assert.notEqual(f.live.socket,old);f.live.configure('second');const active=f.live.socket;old.receive('@id=old :v!v PRIVMSG #first :stale');assert.equal(f.messages.length,0);f.live.stop();assert.equal(active.closed,true);assert.equal(f.live.channel,'');assert.equal(f.live.ready,false);
});

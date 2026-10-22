import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {YouTubeMerge,pageEmojis} from '../youtube-merge.mjs';
const emoji='https://yt3.ggpht.com/happy=w48-h48-c-k-nd';
const api=(id,text,userId='UCa')=>({id,sourceId:id,platform:'youtube',sourceKey:'youtube',user:'Viewer',userId,parts:[{type:'text',text}],badges:[]});
const page=(id,parts,userId='UCa')=>({id,sourceId:id,platform:'youtube',sourceKey:'youtube',user:'Viewer',userId,parts,badges:[{src:'https://yt3.ggpht.com/member',alt:'Member'}]});
test('page copies upgrade the instant API message with emoji images and badges, without adding rows',()=>{
 let now=0;const merge=new YouTubeMerge({now:()=>now,schedule:()=>0});
 const first=merge.api(api('LCC.1','hi :yt-happy: 😀'));assert.deepEqual(first.message.parts,[{type:'text',text:'hi :yt-happy: '},{type:'image',src:'https://fonts.gstatic.com/s/e/notoemoji/15.1/1f600/72.png',alt:'😀',large:false}],'unknown custom emojis stay text until seen; standard emojis use YouTube\'s Noto images');
 now=9000;const [update]=merge.page(page('Ch1',[{type:'text',text:'hi '},{type:'image',src:emoji,alt:':yt-happy:'},{type:'text',text:' '},{type:'image',src:'https://www.youtube.com/s/gaming/emoji/grin.png',alt:':grinning_face:'}]));
 assert.equal(update.id,'LCC.1');assert.equal(update.action,'update');assert.equal(update.parts[1].src,emoji);assert.equal(update.badges[0].alt,'Member');
 assert.deepEqual(merge.page(page('Ch1',[{type:'text',text:'hi'}])),[],'a page copy never creates a new message');
 const later=merge.api(api('LCC.2','again :yt-happy:'));assert.deepEqual(later.message.parts,[{type:'text',text:'again '},{type:'image',src:emoji,alt:':yt-happy:',large:false}],'learned emojis show instantly');assert.equal(later.message.badges[0].alt,'Member','a returning chatter gets their badges instantly');
});
test('a page copy that arrives first is applied when the API message comes; other authors never match',()=>{
 let now=0;const merge=new YouTubeMerge({now:()=>now,schedule:()=>0});
 assert.deepEqual(merge.page(page('Ch2',[{type:'text',text:'Same words'}],'UCb')),[]);
 assert.equal(merge.api(api('LCC.3','same words','UCa')).updates.length,0);
 const {updates}=merge.api(api('LCC.4','Same words!','UCb'));assert.equal(updates[0].id,'LCC.4');
 now=200000;assert.deepEqual(merge.page(page('Ch3',[{type:'text',text:'same words'}])),[],'old API messages are forgotten');
});
test('learned emojis are saved locally and loaded on start',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'bubblecast-'));t.after(()=>rm(dir,{recursive:true,force:true}));const file=join(dir,'youtube-emojis.json');let save;
 const merge=new YouTubeMerge({file,schedule:fn=>{save=fn;return 1;}});merge.page(page('Ch4',[{type:'image',src:emoji,alt:':yt-happy:'}]));await save();
 assert.deepEqual(JSON.parse(await readFile(file,'utf8')),{':yt-happy:':emoji});
 const next=new YouTubeMerge({file});await next.load();assert.equal(next.withEmojis([{type:'text',text:':yt-happy:'}])[0].src,emoji);
});
test('a saved live_chat page yields every custom emoji shortcode with its largest image',()=>{
 const data={contents:{liveChatRenderer:{emojis:[{emojiId:'UC/a',shortcuts:[':yt:'],image:{thumbnails:[{url:'https://yt3.ggpht.com/a=w24'},{url:'https://yt3.ggpht.com/a=w48'}]},isCustomEmoji:true},{emojiId:'😀',shortcuts:[':grinning:'],image:{thumbnails:[{url:'https://x/g'}]}}],actions:[{emoji:{shortcuts:[':hand-pink-waving:'],image:{thumbnails:[{url:'https://yt3.ggpht.com/h=w48'}]},isCustomEmoji:true}}]}}};
 const html=`<script>var x=1;</script><script nonce="n">window["ytInitialData"] = ${JSON.stringify(data)};</script>`;
 assert.deepEqual(pageEmojis(html),[[':yt:','https://yt3.ggpht.com/a=w48'],[':hand-pink-waving:','https://yt3.ggpht.com/h=w48']]);
 assert.deepEqual(pageEmojis('<html>watch page</html>'),[]);
});
test('standard emojis link YouTube\'s Noto image by code point, keeping text symbols as text',async()=>{
 const {notoUrl}=await import('../youtube-merge.mjs'),base='https://fonts.gstatic.com/s/e/notoemoji/15.1/';
 assert.equal(notoUrl('❤️'),base+'2764/72.png');assert.equal(notoUrl('👋🏽'),base+'1f44b_1f3fd/72.png');assert.equal(notoUrl('❤‍🔥'),base+'2764_200d_1f525/72.png');
 assert.equal(notoUrl('©'),'');assert.equal(notoUrl('a'),'');
 const merge=new YouTubeMerge({schedule:()=>0});assert.deepEqual(merge.api(api('LCC.9','gg👋🏽👋🏽 ©')).message.parts.map(p=>p.type==='text'?p.text:p.alt),['gg','👋🏽','👋🏽',' ©']);
});

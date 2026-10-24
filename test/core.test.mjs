import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaults,settings,normalize,safeMedia,badgeMedia,isIgnoredUser,hiddenInDock,dockThemeOf} from '../core.mjs';
const msg=text=>({id:'one',user:'alice',platform:'twitch',parts:[{type:'text',text}]});
test('Twitch emote resolution and frame-fragment hydration use one stable high-resolution animated source',()=>{const base='https://static-cdn.jtvnw.net/emoticons/v2/emotesv2_example/default/dark/';for(const src of [base+'1.0#e=0',base+'2.0#e=1',base+'3.0'])assert.equal(normalize({...msg(''),parts:[{type:'image',src,alt:'dance'}]}).parts[0].src,base+'3.0');const custom='https://cdn.betterttv.net/emote/custom/3x.gif#custom';assert.equal(normalize({...msg(''),parts:[{type:'image',src:custom,alt:'custom'}]}).parts[0].src,custom);});
test('native Twitch username color survives normalization and untrusted CSS is rejected',()=>{assert.equal(normalize({...msg('hello'),userColor:'#A13BFF'}).userColor,'#a13bff');for(const userColor of ['red;display:none','url(https://example.com)','var(--accent)',null,{}])assert.equal(normalize({...msg('hello'),userColor}).userColor,'');for(const platform of ['youtube','tiktok'])assert.equal(normalize({...msg('hello'),platform,userColor:'#123456'}).userColor,'');});
test('TikTok preserves full names, native media, and displayed badge labels',()=>{const raw={...msg('hello'),platform:'tiktok',user:'My Full TikTok Nickname 💚',parts:[{type:'image',src:'https://p16-webcast.tiktokcdn.com/emotes/dance.gif',alt:'dance'}],badges:[{src:'https://p16-webcast.tiktokcdn.com/webcast-va/grade_badge_icon_lite_lv5_v1.png~tplv-obj.image',alt:'Level 6',label:'6'}]};const m=normalize(raw);assert.equal(m.platform,'tiktok');assert.equal(m.user,raw.user);assert.equal(m.parts[0].src,raw.parts[0].src);assert.equal(m.badges[0].label,'6');assert.equal(safeMedia('https://tiktokcdn.com.evil.test/emote.gif'),null);assert.equal(normalize({...raw,user:'Fossabot'}),null);});
test('hides named chat bots on both platforms regardless of capitalization',()=>{for(const platform of ['twitch','youtube'])for(const user of ['StreamElements','Nightbot','Fossabot',' FOSSABOT ','@Fossabot','Streamlabs','Moobot','Fossabot','WizeBot','Botrix','Sery_Bot','SoundAlerts'])assert.equal(normalize({...msg('bot announcement'),platform,user}),null,user);});
test('bot-name mentions and similar viewer names still display',()=>{for(const user of ['nightbotFan','Fossabot640','robotlover'])assert.equal(normalize({...msg('hello Nightbot and Fossabot'),user}).user,user);});
test('custom ignored bots save as a deduplicated list and filter exact senders on either platform',()=>{const s=settings({ignoredBots:' @MyCustomBot, otherbot\nMYCUSTOMBOT; YouTube Bot'});assert.deepEqual(s.ignoredBots,['mycustombot','otherbot','youtube bot']);assert.deepEqual(settings(s).ignoredBots,s.ignoredBots);for(const platform of ['twitch','youtube'])assert.equal(normalize({...msg('announcement'),platform,user:'MyCustomBot'},s),null);assert.ok(normalize({...msg('mycustombot said hi'),user:'mycustombotFan'},s));assert.ok(normalize({...msg('hello'),user:'MyCustomBot'},settings({ignoredBots:[]})));});
test('custom bot settings reject malformed values and bound large lists',()=>{assert.deepEqual(settings({ignoredBots:{bad:true}}).ignoredBots,[]);assert.deepEqual(settings({ignoredBots:[null,42,' @Bot ']}).ignoredBots,['bot']);assert.equal(settings({ignoredBots:Array.from({length:250},(_,i)=>'bot'+i)}).ignoredBots.length,200);});
test('strips URLs, bare domains, emails, and obfuscated common domains',()=>{
 for(const url of ['https://evil.com/path?q=x','www.example.net','discord.gg/invite','example.com','a@example.org','evil[.]com','evil (dot) com'])assert.equal(normalize(msg('hello '+url),defaults).parts[0].text.trim(),'hello',url);
});
test('link-only messages disappear and mixed messages can be dropped',()=>{
 assert.equal(normalize(msg('https://example.com')),null);
 assert.equal(normalize(msg('hey example.com'),{...defaults,linkMode:'drop'}),null);
 assert.equal(normalize(msg('example.com'),{...defaults,linkMode:'show'}).parts[0].text,'example.com');
});
test('filters a URL divided across adjacent rendered text fragments',()=>{
 assert.equal(normalize({...msg(''),parts:[{type:'text',text:'https:'},{type:'text',text:'//example.com'}]}),null);
});
test('unicode, emoji, and literal HTML survive as text',()=>{
 const t='hola 💚 こんにちは <script>alert(1)</script>';assert.equal(normalize(msg(t)).parts[0].text,t);
});
test('animated image and video URLs retain their exact media source',()=>{
 const parts=[{type:'image',src:'https://cdn.betterttv.net/emote/abc/3x',alt:'dance'},{type:'video',src:'https://media.tenor.com/example.mp4',large:true}];
 assert.deepEqual(normalize({...msg(''),parts}).parts.map(p=>p.src),parts.map(p=>p.src));
});
test('rejects script URLs, local files and unrelated media hosts',()=>{
 for(const s of ['javascript:alert(1)','file:///C:/secret','http://cdn.betterttv.net/x','https://cdn.betterttv.net.evil.com/x','https://example.com/x'])assert.equal(safeMedia(s),null);
});
test('retains badge metadata and both platform identities',()=>{
 const m=normalize({...msg('hi'),platform:'youtube',badges:[{src:'https://yt3.ggpht.com/badge',alt:'Member'}]});assert.equal(m.platform,'youtube');assert.equal(m.badges[0].alt,'Member');
});
test('bounds settings and ignores unknown/invalid values',()=>{
 const s=settings({direction:'up',maxMessages:500,width:1,duration:-1,accent:'red',badges:false,twitchId:'123',unknown:1});assert.equal(s.maxMessages,20);assert.equal(s.width,240);assert.equal(s.duration,3);assert.equal(s.direction,'left');assert.equal(s.badges,false);assert.equal(s.twitchId,'123');assert.equal(s.unknown,undefined);
});
test('preserves full long display names and multiple native badges',()=>{
 const user='This is my complete YouTube display name with spaces and emoji 💚 '.repeat(2);const badges=[{src:'https://static-cdn.jtvnw.net/badges/v1/subscriber/3',alt:'Subscriber'},{src:'https://static-cdn.jtvnw.net/badges/v1/vip/3',alt:'VIP'}];
 const m=normalize({...msg('hello'),user,badges});assert.equal(m.user,user);assert.equal(m.badges.length,2);
});
test('upgrades the actual channel subscriber badge artwork without changing its identity',()=>{
 const original='https://static-cdn.jtvnw.net/badges/v1/2526bab3-6d02-4a55-85f5-9955187d8fb1/1';
 const m=normalize({...msg('hi'),badges:[{src:original,alt:'71-Month Subscriber (4-Year Badge)'}]});
 assert.equal(m.badges[0].src,original.slice(0,-1)+'3');assert.equal(m.badges[0].fallback,original);assert.equal(m.badges[0].alt,'71-Month Subscriber (4-Year Badge)');
 assert.equal(normalize(m).badges[0].fallback,original);
});
test('4K scaling settings preserve direction and validate badge and float size bounds',()=>{
 const s=settings({resolution:'2160',direction:'right',badgeSize:999,floatAmount:-1,floatMotion:false});assert.equal(s.resolution,'2160');assert.equal(s.direction,'right');assert.equal(s.badgeSize,36);assert.equal(s.floatAmount,0);assert.equal(s.floatMotion,false);assert.equal(settings({resolution:'invalid'}).resolution,'2160');
 assert.equal(badgeMedia('javascript:alert(1)'),null);
});
test('overlay bot switch defaults on and disabling it admits common and custom bots',()=>{assert.equal(settings({}).filterBots,true);const s=settings({filterBots:false,ignoredBots:['CustomBot']});assert.equal(settings(s).filterBots,false);for(const user of ['Nightbot','Fossabot','CustomBot'])assert.ok(normalize({...msg('hello'),user},s));});
test('interface schemes retain the original default and validate the red alternative',()=>{assert.equal(settings({}).uiTheme,'rose');assert.equal(settings({uiTheme:'red'}).uiTheme,'red');assert.equal(settings({uiTheme:'unknown'}).uiTheme,'rose');});
test('poll overlay settings are bounded and fall back to safe defaults',()=>{
 const s=settings({pollWidth:'5000',pollFontSize:2,pollResultSeconds:'',pollPosition:'nowhere',pollAnimation:'pop',pollColors:'custom',pollAccent:'#ABCDEF',pollBar:'red',pollShowVotes:false,pollLiveLabel:'  Vote   now, chat! This label is far too long ',pollFinalLabel:'   '});
 assert.equal(s.pollWidth,900);assert.equal(s.pollFontSize,14);assert.equal(s.pollResultSeconds,15);assert.equal(s.pollPosition,'bottom-left');assert.equal(s.pollAnimation,'pop');assert.equal(s.pollColors,'custom');assert.equal(s.pollAccent,'#ABCDEF');assert.equal(s.pollBar,'#21b8df');assert.equal(s.pollShowVotes,false);assert.equal(s.pollLiveLabel,'Vote now, chat! This lab');assert.equal(s.pollFinalLabel,'Final results');
});
test('overlay font accepts installed family names and rejects CSS injection',()=>{assert.equal(settings({}).fontFamily,'Komika Axis');assert.equal(settings({fontFamily:' "Comic  Sans MS" '}).fontFamily,'Comic Sans MS');for(const bad of ['x;}body{display:none','a,b','<b>','',null])assert.equal(settings({fontFamily:bad}).fontFamily,'Komika Axis');});
test('bots stay off stream unless switched on and stay in the dock unless switched off',()=>{const s=settings({ignoredBots:'TrueBot64',overlayShownBots:['@Nightbot'],dockHiddenBots:'TRUEBOT64'});assert.deepEqual(s.overlayShownBots,['nightbot']);assert.equal(isIgnoredUser('Nightbot',s),false);assert.equal(isIgnoredUser('TrueBot64',s),true);assert.equal(isIgnoredUser('StreamElements',s),true);assert.equal(hiddenInDock('TrueBot64',s),true);assert.equal(hiddenInDock('Nightbot',s),false);assert.equal(hiddenInDock('viewer',{...s,dockHiddenBots:['viewer']}),false);assert.equal(isIgnoredUser('TrueBot64',{...s,filterBots:false}),false);assert.ok(normalize({...msg('hi'),user:'Nightbot'},s));assert.equal(normalize({...msg('hi'),user:'TrueBot64'},s),null);});
test('interface theme accepts rose, red, midnight and white only',()=>{for(const theme of ['rose','red','midnight','white'])assert.equal(settings({uiTheme:theme}).uiTheme,theme);assert.equal(settings({uiTheme:'neon'}).uiTheme,'rose');});
test('the dock matches the app theme unless it has its own',()=>{assert.equal(settings({}).dockTheme,'app');assert.equal(dockThemeOf(settings({uiTheme:'red'})),'red');assert.equal(dockThemeOf(settings({uiTheme:'red',dockTheme:'midnight'})),'midnight');assert.equal(settings({dockTheme:'neon'}).dockTheme,'app');});
test('YouTube Noto emoji images survive normalize for the dock and overlay',()=>{const src='https://fonts.gstatic.com/s/e/notoemoji/15.1/1f600/72.png';const m=normalize({...msg('hi'),platform:'youtube',parts:[{type:'image',src,alt:'😀',large:false}]});assert.equal(m.parts[0].src,src);assert.equal(safeMedia('https://gstatic.com.evil.test/x.png'),null);});
test('the overlay chat style is bubbles by default and accepts only bubbles or classic',()=>{
 assert.equal(settings({}).chatStyle,'bubbles');assert.equal(settings({chatStyle:'classic'}).chatStyle,'classic');assert.equal(settings({chatStyle:'neon'}).chatStyle,'bubbles');
});
test('the text-to-speech card can be hidden, placed and sized, within limits',()=>{
 const d=settings({});assert.deepEqual([d.ttsCard,d.ttsCardPosition,d.ttsCardSize],[true,'top',100]);
 const s=settings({ttsCard:false,ttsCardPosition:'bottom',ttsCardSize:500});assert.deepEqual([s.ttsCard,s.ttsCardPosition,s.ttsCardSize],[false,'bottom',160]);
 assert.equal(settings({ttsCardPosition:'left'}).ttsCardPosition,'top');
});
test('chat and text-to-speech styles accept bubbles, classic and modern',()=>{
 assert.equal(settings({chatStyle:'modern'}).chatStyle,'modern');assert.equal(settings({ttsCardStyle:'modern'}).ttsCardStyle,'modern');assert.equal(settings({ttsCardStyle:'neon'}).ttsCardStyle,'bubbles');
});
test('without found YouTube streams, the channel’s live page is read: the one entered, or the connected account’s',async()=>{
 const {sourceConfig,withFoundVideos}=await import('../source-config.mjs');
 assert.equal(sourceConfig({youtubeChannel:'https://www.youtube.com/@TrueAlex/live'}).youtubeChannel,'@TrueAlex');
 assert.equal(sourceConfig({youtubeChannel:'UCabcdefghijklmnopqrstuv'}).youtubeChannel,'channel/UCabcdefghijklmnopqrstuv');
 assert.throws(()=>sourceConfig({youtubeChannel:'https://evil.example/@x'}),/youtube\.com/);
 assert.equal(withFoundVideos(sourceConfig({youtubeChannel:'@truealex'}),[]).urls.youtube,'https://www.youtube.com/@truealex/live');
 assert.equal(withFoundVideos(sourceConfig({}),[],'UCabcdefghijklmnopqrstuv').urls.youtube,'https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv/live');
 assert.match(withFoundVideos(sourceConfig({youtubeChannel:'@truealex'}),[{video:'abcdefghijk',slot:'youtube'}]).urls.youtube,/live_chat\?v=abcdefghijk/,'found streams win');
});
test('with the YouTube API available, no fallback page is opened; without it, the channel page is',async()=>{
 const {sourceConfig,withFoundVideos}=await import('../source-config.mjs');const saved=sourceConfig({youtubeChannel:'@truealex'});
 assert.equal(withFoundVideos(saved,[],'UCabcdefghijklmnopqrstuv',false).urls.youtube,'','the API is used instead');
 assert.equal(withFoundVideos(saved,[],'UCabcdefghijklmnopqrstuv',true).urls.youtube,'https://www.youtube.com/@truealex/live');
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {speechText,Speech} from '../tts.mjs';
import {settings,normalize,viewerRoles} from '../core.mjs';
import {chatMessage} from '../youtube-official.mjs';
const on=extra=>settings({ttsEnabled:true,...extra});
const msg=(text,extra={})=>({platform:'twitch',user:'SampleViewer',userId:'1',parts:[{type:'text',text}],...extra});
test('the command reads what follows it, and plain chat is ignored unless asked',()=>{
 assert.equal(speechText(msg('!tts hello everyone'),on()),'SampleViewer said: hello everyone');
 assert.equal(speechText(msg('!TTS Hola'),on({ttsReadName:false})),'Hola');
 assert.equal(speechText(msg('hello'),on()),null);assert.equal(speechText(msg('!ttsx hi'),on()),null);
 assert.equal(speechText(msg('hello'),on({ttsReadAll:true})),'SampleViewer said: hello');
 assert.equal(speechText(msg('!say hi'),on({ttsCommand:'!say'})),'SampleViewer said: hi');
 assert.equal(speechText(msg('!tts hola'),on(),'es'),'SampleViewer dijo: hola');
 assert.equal(speechText(msg('!tts hi'),settings({})),null,'off by default');assert.equal(speechText(msg('!tts hi'),on({ttsTwitch:false})),null,'per platform');
});
test('only the chosen roles can use the command; the broadcaster always can',()=>{
 const s=on({ttsEveryone:false,ttsSubscribers:false,ttsVips:false,ttsMods:true});
 assert.equal(speechText(msg('!tts hi'),s),null);
 assert.ok(speechText(msg('!tts hi',{roles:['moderator']}),s));assert.equal(speechText(msg('!tts hi',{roles:['vip']}),s),null);
 assert.ok(speechText(msg('!tts hi',{roles:['broadcaster']}),on({ttsEveryone:false,ttsSubscribers:false,ttsVips:false,ttsMods:false})));
 assert.ok(speechText(msg('!tts hi',{roles:['subscriber']}),on({ttsEveryone:false,ttsSubscribers:true})));
});
test('a Twitch channel point reward with the chosen name reads the viewer’s text',()=>{
 const red=(title,text)=>msg(text,{event:{kind:'redemption',title}});
 assert.equal(speechText(red('TTS','read this please'),on({ttsReward:'tts'})),'SampleViewer said: read this please');
 assert.equal(speechText(red('Hydrate','drink water'),on({ttsReward:'TTS'})),null,'other rewards stay quiet');
 assert.equal(speechText(red('TTS','x'),on({ttsReward:''})),null);
 assert.equal(speechText({...msg(''),parts:[],event:{kind:'raid',title:'SampleViewer raided with 12 viewers.'}},on({ttsEvents:true})),'SampleViewer raided with 12 viewers.');
});
test('links are dropped, long text is cut, stretched letters are shortened and emotes are not read',()=>{
 assert.equal(speechText(msg('!tts look https://example.com now'),on({ttsReadName:false})),'look now');
 assert.equal(speechText(msg('!tts nooooooooo'),on({ttsReadName:false})),'nooo');
 assert.equal(speechText({...msg('!tts hi '),parts:[{type:'text',text:'!tts hi '},{type:'image',src:'https://cdn.betterttv.net/emote/a/3x',alt:'Kappa'}]},on({ttsReadName:false})),'hi');
 const long=speechText(msg('!tts '+'word '.repeat(100)),on({ttsReadName:false,ttsMaxLength:40}));assert.ok(long.length<=41&&long.endsWith('…'));
});
test('roles come from each platform’s flags and badges',()=>{
 assert.deepEqual(viewerRoles({badges:[{alt:'Moderator'},{alt:'12-Month Subscriber'}]}),['moderator','subscriber']);
 assert.deepEqual(viewerRoles({badges:[{alt:'Moderator',src:'x'}]}).includes('moderator'),true,'TikTok moderator badge');
 assert.deepEqual(viewerRoles({badges:[{alt:'vip'},{alt:'broadcaster'}]}),['broadcaster','vip'],'Kick badge types');
 const yt=chatMessage({id:'m1',snippet:{type:'textMessageEvent',textMessageDetails:{messageText:'!tts hola'},publishedAt:new Date().toISOString()},authorDetails:{displayName:'Viewer',channelId:'UC1',isChatModerator:true,isChatSponsor:true}});
 assert.deepEqual(normalize(yt,settings({})).roles,['moderator','subscriber']);
});
test('speech is voiced one at a time, respects the per-viewer wait and hands audio to the /tts pages',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'bubblecast-tts-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const spoken=[],sent=[];let now=0;const engine={voices:async()=>[{name:'Sabina',lang:'es-MX'}],speak:async job=>{spoken.push(job.text);}};
 const speech=new Speech({emit:(type,data)=>sent.push([type,data]),engine,dir,now:()=>now,keepMs:10});const s=on({ttsCooldown:10});
 assert.ok(speech.consider(normalize(msg('!tts uno'),s),s));assert.ok(!speech.consider(normalize(msg('!tts dos'),s),s),'wait between messages');
 now=11000;assert.ok(speech.consider(normalize(msg('!tts tres'),s),s));
 await new Promise(r=>setTimeout(r,20));
 assert.deepEqual(spoken,['SampleViewer said: uno','SampleViewer said: tres']);assert.equal(sent.length,2);assert.equal(sent[0][0],'tts');assert.match(sent[0][1].url,/^\/api\/tts\/audio\//);assert.equal(sent[0][1].volume,80);
 await speech.voices();assert.equal(speech.lang({...s,ttsVoice:'Sabina'}),'es');
 speech.skip();assert.equal(sent.at(-1)[0],'tts-skip');
});
// Runs the real voice engine on the Windows test machine (Windows speech through PowerShell).
test('Windows lists its voices and speaks to a WAV file',{skip:process.platform!=='win32'&&'Windows only'},async t=>{
 const {engines}=await import('../tts.mjs');const {readFile}=await import('node:fs/promises');
 const dir=await mkdtemp(join(tmpdir(),'bubblecast-tts-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const voices=await engines.voices();assert.ok(voices.length>0,'at least one Windows voice');assert.ok(voices.every(v=>v.name));
 const out=join(dir,'hello.wav');await engines.speak({text:'Hola, "esto" & $(ningún) comando; `funciona`.',voice:voices[0].name,rate:0,out,input:join(dir,'hello.txt')});
 const wav=await readFile(out);assert.equal(wav.subarray(0,4).toString(),'RIFF');assert.ok(wav.length>10000,'audio was written');
});
test('bad words are never spoken: the message is skipped, or the words removed, and tricks don’t get through',async()=>{
 const {hasBadWords,removeBadWords}=await import('../bad-words.mjs');
 for(const t of ['f*ck this','f**k','sh#t','p*ta','f u c k','p-u-t-a','fսck','рuta','𝓯𝓾𝓬𝓴','ｆｕｃｋ','fu​ck','fuuuuck','sh1t','p3ndejo','cabrón','que coño','HDP','m!erda','$hit','b1tch'])assert.ok(hasBadWords(t),t);
 for(const t of ['hola a todos','Dickens is great','class assignment','computadora','disputa','cumple feliz','pitbull','scunthorpe','titanic','a e i o u','5 stars!','que onda?','i love this game','1-2-3 go'])assert.ok(!hasBadWords(t),t);
 assert.ok(hasBadWords('my troll phrase','troll\nother'),'streamer words');assert.equal(removeBadWords('vamos f*ck yeah'),'vamos yeah');
 assert.equal(speechText(msg('!tts what the f*ck'),on()),null,'skipped by default');
 assert.equal(speechText(msg('!tts vamos f*ck amigos'),on({ttsBadWords:'remove',ttsReadName:false})),'vamos amigos');
 assert.equal(speechText(msg('!tts please kill yourself'),on({ttsBadWords:'remove'})),null,'phrases always skip');
 assert.equal(speechText({...msg('!tts hola'),user:'Pendejo123'},on()),null,'offensive names are not read');
 assert.equal(speechText(msg('!tts what the f*ck'),on({ttsBadWords:'off',ttsReadName:false})),'what the f*ck');
});

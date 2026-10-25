import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {readFile} from 'node:fs/promises';
import {diagnosticSnapshot} from '../../diagnostics.mjs';
import {defaults,knownBots} from '../../core.mjs';
const root=new URL('../../public/',import.meta.url);
const status={settings:{...defaults,ignoredBots:['MyBot']},bridge:{},traffic:{twitch:{received:12}},sources:{configured:true,enabled:true,twitchChannel:'test',youtubeVideo:'normal',urls:{twitch:'t',youtube:'y'}},collector:{active:true,accounts:{youtube:{signedIn:true,canSend:false}}},youtube:{configured:true,connected:true,channel:{title:'My channel'}}};
async function studio(t,hash='',translate=false){
 const w=new Window({url:'http://127.0.0.1:3927/'+hash});t.after(()=>w.happyDOM.abort());w.document.write(await readFile(new URL('index.html',root),'utf8'));
 if(translate)w.eval(await readFile(new URL('i18n.js',root),'utf8'));
 const calls=[];w.fetch=async(url,options)=>{calls.push([url,options]);return {ok:true,json:async()=>url==='/api/pair'?{token:'test'}:url==='/api/status'?structuredClone(status):url==='/api/settings'?JSON.parse(options.body):{}};};
 const connections=(await readFile(new URL('connections.js',root),'utf8')).replace('export function','function');
 const code='const knownBots='+JSON.stringify(knownBots)+';'+(await readFile(new URL('app.js',root),'utf8')).replace(/^import[^\n]*\n/gm,'');await w.eval('(async()=>{'+connections+'\n'+code+'})()');
 const saved=()=>calls.filter(([url])=>url==='/api/settings').map(([,o])=>JSON.parse(o.body));
 return {w,doc:w.document,calls,saved};
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
test('studio loads settings, connection controls and account identity without requiring an available chat',async t=>{
 const {doc,calls}=await studio(t);
 assert.equal(doc.querySelector('#studioStatus').textContent,'Background app connected');assert.equal(doc.querySelector('#helperBanner').hidden,true);assert.equal(doc.querySelector('#account-youtube').textContent,'Connected as My channel');assert.equal(doc.querySelector('#youtubeConnect').textContent,'Disconnect');
 assert.equal(doc.querySelector('#page-overview').hidden,false);assert.equal(doc.querySelector('#twitchStatus').textContent,'Waiting for stream');assert.equal(doc.querySelector('#nav-kick').dataset.state,'off');assert.equal(doc.querySelector('#connectionCount').textContent,'2');assert.match(doc.querySelector('#platformList').textContent,/12 msgs/);
 assert.equal(doc.querySelector('#youtubeVideo').value,'normal');assert.equal(doc.querySelector('#googleClientFile'),null);assert.ok(!calls.some(([url])=>url==='/api/youtube/config'));
});
test('studio routes pages from the URL hash and marks the current section',async t=>{
 const {w,doc}=await studio(t,'#polls');
 assert.equal(doc.querySelector('#page-polls').hidden,false);assert.equal(doc.querySelector('#page-overview').hidden,true);assert.ok(doc.querySelector('[data-page-link="polls"]').classList.contains('current'));
 w.location.hash='#connections';w.dispatchEvent(new w.HashChangeEvent('hashchange'));
 assert.equal(doc.querySelector('#page-connections').hidden,false);assert.equal(doc.querySelector('#page-polls').hidden,true);assert.equal(doc.querySelector('[data-page-link="connections"]').getAttribute('aria-current'),'page');
});
test('studio autosaves edits once after a pause and keeps unsaved poll colors disabled while matching chat',async t=>{
 const {doc,saved}=await studio(t,'#polls');
 assert.equal(doc.querySelector('[name=pollColors][value=chat]').checked,true);assert.equal(doc.querySelector('[name=pollAccent]').disabled,true);
 const width=doc.querySelector('[name=pollWidth]');width.value='600';width.dispatchEvent(new doc.defaultView.Event('input',{bubbles:true}));width.value='640';width.dispatchEvent(new doc.defaultView.Event('input',{bubbles:true}));
 assert.equal(doc.querySelector('output[data-for=pollWidth]').textContent,'640 px');assert.equal(saved().length,0);
 const custom=doc.querySelector('[name=pollColors][value=custom]');custom.checked=true;custom.dispatchEvent(new doc.defaultView.Event('change',{bubbles:true}));assert.equal(doc.querySelector('[name=pollAccent]').disabled,false);
 await wait(520);assert.equal(saved().length,1);assert.equal(saved()[0].pollWidth,640);assert.equal(saved()[0].pollColors,'custom');assert.match(doc.querySelector('.save-state').textContent,/Saved/);
});
test('studio lists built-in and custom bots with separate stream and dock visibility',async t=>{
 const {doc,saved}=await studio(t,'#chat');const ev=type=>new doc.defaultView.Event(type,{bubbles:true});
 const rows=()=>[...doc.querySelectorAll('#botTable .bot-row:not(.head)')],row=name=>rows().find(r=>r.querySelector('.bot-name').firstChild.textContent===name);
 assert.ok(row('Nightbot').textContent.includes('Built-in'));assert.ok(row('MyBot'));
 assert.equal(row('Nightbot').querySelectorAll('input')[0].checked,false);assert.equal(row('Nightbot').querySelectorAll('input')[1].checked,true);
 doc.querySelector('#botName').value='@TrueBot64';doc.querySelector('#addBot').click();doc.querySelector('#botName').value='truebot64';doc.querySelector('#addBot').click();assert.equal(rows().filter(r=>/truebot64/i.test(r.textContent)).length,1);
 const [stream]=row('TrueBot64').querySelectorAll('input');stream.checked=true;stream.onchange();const dock=row('Nightbot').querySelectorAll('input')[1];dock.checked=false;dock.onchange();
 row('MyBot').querySelector('.bot-remove').click();
 await wait(520);const last=saved().at(-1);assert.equal(last.ignoredBots,'TrueBot64');assert.equal(last.overlayShownBots,'TrueBot64');assert.equal(last.dockHiddenBots,'Nightbot');assert.equal(last.filterBots,true);
 const filter=doc.querySelector('[name=filterBots]');filter.checked=false;filter.dispatchEvent(ev('change'));assert.ok(rows().every(r=>r.querySelectorAll('input')[0].checked&&r.querySelectorAll('input')[0].disabled));
});
test('Connect Twitch starts official sign-in and shows the activation code',async t=>{
 const {w,doc,calls}=await studio(t,'#connections');w.open=()=>null;
 const original=w.fetch,pending={userCode:'ABCD1234',verificationUri:'https://www.twitch.tv/activate?device-code=ABCD1234',expiresAt:Date.now()+1800000};let started=false;w.fetch=async(url,options)=>{if(url==='/api/twitch/connect'){started=true;calls.push([url,options]);return {ok:true,json:async()=>pending};}const r=await original(url,options);if(url!=='/api/status'||!started)return r;const body=await r.json();return {ok:true,json:async()=>({...body,twitch:{connected:false,pending}})};};
 assert.equal(doc.querySelector('#twitchConnect').textContent,'Connect Twitch');assert.match(doc.querySelector('#account-twitch').textContent,/Read-only chat/);
 await doc.querySelector('#twitchConnect').onclick();
 assert.ok(calls.some(([url])=>url==='/api/twitch/connect'));assert.equal(doc.querySelector('#twitchCode').hidden,false);assert.equal(doc.querySelector('#twitchUserCode').textContent,'ABCD1234');assert.match(doc.querySelector('#twitchActivate').href,/twitch\.tv\/activate/);
});
test('your own app keys are saved per platform and the secret is never shown back',async t=>{
 const {doc,calls}=await studio(t);const box=doc.querySelector('[data-app="kick"]');
 box.querySelector('[name=clientId]').value='01KICKAPP';box.querySelector('[name=clientSecret]').value='kick-secret';box.querySelector('[data-save-app]').click();await wait(20);
 const sent=calls.find(([url,o])=>url==='/api/apps'&&o?.method==='POST');assert.deepEqual(JSON.parse(sent[1].body),{platform:'kick',clientId:'01KICKAPP',clientSecret:'kick-secret'});
 assert.equal(box.querySelector('[name=clientSecret]').value,'','the secret field is cleared after saving');
 const connect=doc.querySelector('#kickConnect');assert.equal(connect.textContent,'Add Kick app','without a Kick app, Connect leads to its keys');box.open=false;connect.click();await wait(5);assert.equal(box.open,true,'the Kick app section opens');assert.ok(!calls.some(([url])=>url==='/api/kick/connect'),'no sign-in starts without keys');assert.match(doc.querySelector('#account-kick-api').textContent,/Add your Kick app/);assert.equal(doc.querySelector('#account-kick').textContent,'Connect Kick for chat and polls.');
});

test('Studio keeps automatic channels out of manual fields and saves blank overrides',async t=>{
 const prior=status.sources;status.sources={configured:true,enabled:true,twitchChannel:'owner',kickChannel:'kick-owner',entered:{twitchChannel:'',kickChannel:''},urls:{twitch:'t',kick:'k'}};
 t.after(()=>{status.sources=prior;});const {doc,w,calls}=await studio(t,'#connections');await wait(20);
 assert.equal(doc.querySelector('#twitchChannel').value,'');assert.equal(doc.querySelector('#kickChannel').value,'');
 doc.querySelector('#saveConnections').click();await wait(20);const call=calls.find(([url,o])=>url==='/api/sources'&&o?.method==='POST');assert.ok(call);const body=JSON.parse(call[1].body);assert.equal(body.twitchChannel,'');assert.equal(body.kickChannel,'');
});
test('Connect Kick queues one helper flow without opening a separate browser or poll login',async t=>{
 const prior=status.kick;status.kick={configured:true,connected:false};t.after(()=>{status.kick=prior;});const {doc,w,calls}=await studio(t,'#connections');await wait(20);let opened=0;w.open=()=>{opened++;};
 await doc.querySelector('#kickConnect').onclick();assert.equal(calls.filter(([url])=>url==='/api/kick/connect').length,1);assert.equal(opened,0);assert.equal(doc.querySelector('[data-setup-signin="kick"]'),null);assert.equal(doc.querySelector('#kickDisconnect').hidden,true);
});
test('found YouTube streams are listed by title and a format choice is sent once',async t=>{
 const saved=status.youtube;status.youtube={...saved,candidates:[{video:'kkkkkkkkkkk',title:'Evening Stream',live:false,receiving:true,format:'',hidden:false},{video:'ppppppppppp',title:'Channel Live Stream',live:false,receiving:false,format:'',hidden:true}]};t.after(()=>{status.youtube=saved;});
 const {w,doc,calls}=await studio(t);await wait(20);const list=doc.querySelector('#youtubeStreams');
 assert.equal(list.hidden,false);const rows=[...list.querySelectorAll('li')];assert.equal(rows.length,2);assert.equal(rows[0].querySelector('.stream-title').textContent,'Evening Stream');assert.equal(rows[0].querySelector('.stream-state').textContent,'Receiving video');assert.equal(rows[1].querySelector('select').value,'hide');
 const select=rows[0].querySelector('select');select.value='vertical';select.dispatchEvent(new w.Event('change'));await wait(20);
 const sent=calls.filter(([url,o])=>url==='/api/youtube/stream'&&o?.method==='POST');assert.equal(sent.length,1);assert.deepEqual(JSON.parse(sent[0][1].body),{video:'kkkkkkkkkkk',choice:'vertical'});
});

test('Studio shows per-platform diagnostics and missing detection, channel and log failures safely',async t=>{
 const prior=status.diagnostics;status.diagnostics={...diagnosticSnapshot({sources:{urls:{tiktok:'t',kick:'k'}},collector:{active:true,accounts:{tiktok:{signedIn:false}},errors:{kick:'private detail'}},traffic:{tiktok:{received:7,displayed:4,lastMessageAt:Date.now()}},obs:{checkedAt:Date.now(),websocket:'unavailable',browserAt:Date.now(),browserStreaming:true}}),log:{error:true}};
 t.after(()=>{status.diagnostics=prior;});const {doc}=await studio(t);
 const rows=[...doc.querySelectorAll('#diagnosticPlatforms li')];assert.equal(rows.length,4);
 assert.match(rows[2].textContent,/Receiving chat.*Not signed in.*Received: 7.*Shown: 4/);assert.match(rows[3].textContent,/Capture or connection error/);assert.ok(!doc.querySelector('#diagnosticPlatforms').textContent.includes('private detail'));
 assert.match(doc.querySelector('#diagnosticObs').textContent,/OBS: Streaming.*Aitum: Not detected.*OBS browser.*WebSocket unavailable/);
 assert.match(doc.querySelector('#diagnosticYouTube').textContent,/Add a YouTube channel.*No check yet/);assert.equal(doc.querySelector('#diagnosticLog').textContent,'Local log could not be written.');
});

test('Studio diagnostics render their first status in Spanish with live counts',async t=>{
 const prior=status.diagnostics,language=status.settings.language;status.settings.language='es';status.diagnostics=diagnosticSnapshot({sources:{urls:{tiktok:'t'}},collector:{active:true,accounts:{tiktok:{signedIn:false}}},traffic:{tiktok:{received:7,displayed:4,lastMessageAt:Date.now()}}});
 t.after(()=>{status.diagnostics=prior;status.settings.language=language;});const {doc}=await studio(t,'',true);
 assert.match(doc.querySelector('#diagnosticPlatforms').textContent,/Recibidos: 7.*Mostrados: 4/);assert.match(doc.querySelector('#diagnosticYouTube').textContent,/No se encontró ninguno/);assert.match(doc.querySelector('#diagnosticLog').textContent,/Registro local/);
});

test('no-app YouTube exposes its channel and explicit discovery control; configured sign-out keeps the API policy',async t=>{
 const prior={youtube:status.youtube,diagnostics:status.diagnostics};status.youtube={configured:false,connected:false,readMode:'page'};status.diagnostics=diagnosticSnapshot({sources:{youtubeChannel:'@example'},collector:{active:true},trigger:{blocked:'none',series:{state:'scheduled',attempt:1,nextAt:Date.now()+20000}}});
 t.after(()=>{status.youtube=prior.youtube;status.diagnostics=prior.diagnostics;});const {doc,calls}=await studio(t,'#connections');
 assert.equal(doc.querySelector('#youtubeChannelField').hidden,false);assert.match(doc.querySelector('#account-youtube').textContent,/Read-only YouTube chat/);assert.match(doc.querySelector('#youtubeDiscoveryNote').textContent,/Stream checks scheduled.*Next check/);
 await doc.querySelector('#youtubeCheck').onclick();assert.equal(calls.filter(([url])=>url==='/api/youtube/check').length,1);assert.ok(!calls.some(([url])=>url==='/api/youtube/connect'));
 status.youtube={configured:true,connected:false,readMode:'signin'};status.diagnostics=diagnosticSnapshot({trigger:{blocked:'signin-required'}});const signedOut=await studio(t,'#connections');assert.equal(signedOut.doc.querySelector('#youtubeSlow').hidden,true);assert.equal(signedOut.doc.querySelector('#youtubeCheck').disabled,true);
});

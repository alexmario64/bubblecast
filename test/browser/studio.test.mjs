import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {readFile} from 'node:fs/promises';
import {defaults,knownBots} from '../../core.mjs';
const root=new URL('../../public/',import.meta.url);
const status={settings:{...defaults,ignoredBots:['MyBot']},bridge:{},traffic:{twitch:{received:12}},sources:{configured:true,enabled:true,twitchChannel:'test',youtubeVideo:'normal',urls:{twitch:'t',youtube:'y'}},collector:{active:true,accounts:{youtube:{signedIn:true,canSend:false}}}};
async function studio(t,hash=''){
 const w=new Window({url:'http://127.0.0.1:3927/'+hash});t.after(()=>w.happyDOM.abort());w.document.write(await readFile(new URL('index.html',root),'utf8'));
 const calls=[];w.fetch=async(url,options)=>{calls.push([url,options]);return {ok:true,json:async()=>url==='/api/pair'?{token:'test'}:url==='/api/status'?structuredClone(status):url==='/api/settings'?JSON.parse(options.body):{}};};
 const connections=(await readFile(new URL('connections.js',root),'utf8')).replace('export function','function');
 const code='const knownBots='+JSON.stringify(knownBots)+';'+(await readFile(new URL('app.js',root),'utf8')).replace(/^import[^\n]*\n/gm,'');await w.eval('(async()=>{'+connections+'\n'+code+'})()');
 const saved=()=>calls.filter(([url])=>url==='/api/settings').map(([,o])=>JSON.parse(o.body));
 return {w,doc:w.document,calls,saved};
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
test('studio loads settings, connection controls and account identity without requiring an available chat',async t=>{
 const {doc,calls}=await studio(t);
 assert.equal(doc.querySelector('#studioStatus').textContent,'Background app connected');assert.equal(doc.querySelector('#helperBanner').hidden,true);assert.equal(doc.querySelector('#account-youtube').textContent,'Signed in · chat not available');
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

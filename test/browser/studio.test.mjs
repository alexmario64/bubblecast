import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {readFile} from 'node:fs/promises';
import {defaults} from '../../core.mjs';
const root=new URL('../../public/',import.meta.url);
test('studio loads settings, connection controls and account identity without requiring an available chat',async t=>{
 const w=new Window({url:'http://127.0.0.1:3927/'});t.after(()=>w.happyDOM.abort());w.document.write(await readFile(new URL('index.html',root),'utf8'));
 const calls=[];w.fetch=async(url,options)=>{calls.push([url,options]);return {ok:true,json:async()=>url==='/api/pair'?{token:'test'}:url==='/api/status'?{settings:defaults,bridge:{},sources:{configured:true,enabled:true,twitchChannel:'test',youtubeVideo:'normal',urls:{twitch:'t',youtube:'y'}},collector:{active:true,accounts:{youtube:{signedIn:true,canSend:false}}}}:{}};};
 const connections=(await readFile(new URL('connections.js',root),'utf8')).replace('export function','function');
 const code=(await readFile(new URL('app.js',root),'utf8')).replace(/^import[^\n]*\n/gm,'');await w.eval('(async()=>{'+connections+'\n'+code+'})()');
 assert.equal(w.document.querySelector('#studioStatus').textContent,'Background app connected');assert.equal(w.document.querySelector('#account-youtube').textContent,'Signed in · chat not available');
 w.document.querySelector('[data-tab="connect"]').click();assert.equal(w.document.querySelector('#connect').hidden,false);assert.equal(w.document.querySelector('#style').hidden,true);assert.equal(w.document.querySelector('#youtubeVideo').value,'normal');assert.equal(w.document.querySelector('#googleClientFile'),null);assert.ok(!calls.some(([url])=>url==='/api/youtube/config'));
});

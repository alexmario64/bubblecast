import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {diagnosticSnapshot} from '../../diagnostics.mjs';
const root=new URL('../../public/',import.meta.url),script=await readFile(new URL('connection-status.js',root),'utf8');
async function fixture(t,file){const w=new Window();t.after(()=>w.happyDOM.abort());w.document.write(await readFile(new URL(file,root),'utf8'));w.eval(script);return {w,doc:w.document,shared:w.bubblecastConnections};}
for(const file of ['index.html','dock.html']){
 test(file+' loads the shared connection presenter and all common controls',async t=>{
  const {doc,shared}=await fixture(t,file);assert.ok(doc.querySelector('script[src="/connection-status.js"]'));for(const id of [...shared.sourceIds,'youtubeSlow','youtubeDiscoveryNote','youtubeCheck','youtubeStreams','diagnosticPlatforms','diagnosticObs','diagnosticYouTube','diagnosticPages','diagnosticLog'])assert.ok(doc.querySelector('#'+id),id+' missing in '+file);
 });
 test(file+' syncs clean saved fields, preserves drafts including a cleared field, and reconciles late save results',async t=>{
  const {doc,shared}=await fixture(t,file),get=id=>doc.querySelector('#'+id);shared.syncSources(doc,{entered:{youtubeChannel:'@original',tiktokChannel:'original'}});get('youtubeChannel').value='';shared.syncSources(doc,{entered:{youtubeChannel:'@elsewhere',tiktokChannel:'updated'}});assert.equal(get('youtubeChannel').value,'');assert.equal(get('tiktokChannel').value,'updated');assert.deepEqual({...shared.sourceValues(doc,{changedOnly:true})},{youtubeChannel:''});
  const submitted=shared.sourceValues(doc);get('youtubeChannel').value='@typed-while-saving';shared.syncSources(doc,{entered:{youtubeChannel:'',tiktokChannel:'updated'}},{submitted});assert.equal(get('youtubeChannel').value,'@typed-while-saving');assert.equal(get('youtubeChannel').dataset.connectionSaved,'');assert.deepEqual({...shared.sourceValues(doc,{changedOnly:true})},{youtubeChannel:'@typed-while-saving'});
 });
 test(file+' displays shared missing-channel, OBS, TikTok and quota diagnostics without private error details',async t=>{
  const {doc,shared}=await fixture(t,file);const d=diagnosticSnapshot({sources:{urls:{tiktok:'t'}},collector:{active:true,accounts:{tiktok:{signedIn:false}},errors:{tiktok:'synthetic-private-detail'}},obs:{checkedAt:Date.now(),websocket:'unavailable'},trigger:{blocked:'missing-channel'}});shared.paintDiagnostics(doc,d);assert.equal(doc.querySelector('#youtubeCheck').disabled,true);assert.match(doc.querySelector('#diagnosticObs').textContent,/Not detected.*WebSocket unavailable/);assert.match(doc.querySelector('#diagnosticYouTube').textContent,/Add a YouTube channel/);assert.match(doc.querySelector('#diagnosticPlatforms').textContent,/Sign in to TikTok/);assert.ok(!doc.body.textContent.includes('synthetic-private-detail'));
 });
}
test('shared policy offers the page reader only without an app or after quota exhaustion',async t=>{
 const {shared}=await fixture(t,'dock.html');assert.equal(shared.youtubeState({configured:false}).page,true);assert.equal(shared.youtubeState({configured:true,connected:false,readMode:'signin'}).page,false);assert.equal(shared.youtubeState({configured:true,connected:true,readMode:'api'}).page,false);assert.equal(shared.youtubeState({configured:true,quotaUntil:Date.now()+1000,readMode:'page'}).page,true);
});

test('format labels change language and back while an unchanged status keeps the same controls',async t=>{
 const {w,doc,shared}=await fixture(t,'dock.html');w.eval(await readFile(new URL('i18n.js',root),'utf8'));const list=doc.querySelector('#youtubeStreams'),y={candidates:[{video:'fixture',title:'Example',formatSource:'obs-main',live:true}]},actions={post:()=>assert.fail('unrequested action'),refresh:()=>{},onError:()=>{}};
 shared.paintStreams(list,y,actions);const control=list.querySelector('select');shared.paintStreams(list,y,actions);assert.equal(list.querySelector('select'),control);w.bubblecastI18n.setLanguage('es');shared.paintStreams(list,y,actions);assert.match(list.textContent,/Coincide con la clave principal de OBS/);w.bubblecastI18n.setLanguage('en');shared.paintStreams(list,y,actions);assert.match(list.textContent,/Matched OBS main key/);
});

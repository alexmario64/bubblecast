// Real Chromium pages + real Bubblecast server processes on one isolated random loopback port.
// The fixture disables external requests/sockets; the browser blocks every other origin as well.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {isolatedServer} from '../server-fixture.mjs';
import {defaults} from '../../core.mjs';
const poll={id:'fixture-poll',platform:'kick',sourceKey:'kick',question:'Choose a fixture',status:'active',choices:[{text:'Alpha',votes:3},{text:'Beta',votes:1}]};
test('chat, TTS and poll browser sources recover from a real server restart without a page/cache refresh', {timeout:60000},async t=>{
 const server=await isolatedServer(t,{browser:true}),browser=await chromium.launch();t.after(()=>browser.close());
 const context=await browser.newContext(),errors=[],requests=[],foreign=[];
 await context.route('**/*',route=>{const url=route.request().url();if(url.startsWith(server.url+'/'))return route.continue();foreign.push(url);return route.abort('blockedbyclient');});
 await context.addInitScript(()=>{
  window.__loads=crypto.randomUUID();window.__opens=0;window.__heartbeats=0;
  const Native=window.EventSource;window.EventSource=class extends Native{constructor(...args){super(...args);this.addEventListener('open',()=>window.__opens++);this.addEventListener('heartbeat',()=>window.__heartbeats++);}};
  window.Audio=class{play(){return Promise.resolve();}pause(){}};
 });
 const paths=['/overlay','/tts','/poll-overlay'],pages=await Promise.all(paths.map(()=>context.newPage()));
 for(const page of pages){page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));}
 await Promise.all(pages.map((page,i)=>page.goto(server.url+paths[i],{waitUntil:'domcontentloaded'})));
 await Promise.all(pages.map(page=>page.waitForFunction(()=>window.__opens===1&&window.__heartbeats>=1)));
 const loads=await Promise.all(pages.map(page=>page.evaluate(()=>window.__loads)));
 const post=async(path,data)=>{const {token}=await (await server.request('/api/pair')).json();const res=await server.request(path,{method:'POST',headers:{'content-type':'application/json','x-bubblecast-token':token},body:JSON.stringify(data)});assert.equal(res.status,200,await res.clone().text());return res.json();};
 await post('/api/settings',{...defaults,duration:120});
 const message=id=>({platform:'tiktok',id,user:'Fixture Viewer',parts:[{type:'text',text:id}]});
 await post('/api/test',message('before-restart'));await pages[0].locator('.body').filter({hasText:'before-restart'}).waitFor();
 await post('/api/bridge',{platform:'kick',sourceKey:'kick',action:'poll',poll});await pages[2].getByText('Choose a fixture').waitFor();
 await server.broadcast('tts',{id:'before-tts',platform:'tiktok',user:'Fixture Voice',text:'Before restart',duration:60,url:'/fixture-audio'});await pages[1].getByText('Before restart',{exact:true}).waitFor();
 // Observe a real periodic heartbeat in addition to the initial one, with no chat needed.
 await pages[0].waitForFunction(()=>window.__heartbeats>=2,{},{timeout:20000});
 const imageNode=await pages[0].locator('.message').elementHandle(),ttsNode=await pages[1].locator('.tts-card').elementHandle();
 await server.stop();
 await writeFile(join(server.dir,'settings.json'),JSON.stringify({...defaults,duration:120,accent:'#123456',pollColors:'chat',ttsCardStyle:'modern'}));
 await server.restart();
 await Promise.all(pages.map(page=>page.waitForFunction(()=>window.__opens>=2)));
 await pages[0].waitForFunction(()=>document.querySelector('#chat').style.getPropertyValue('--accent')==='#123456');
 await pages[1].waitForFunction(()=>document.querySelector('#stage').style.getPropertyValue('--accent')==='#123456'&&document.querySelector('#cards').classList.contains('modern'));
 await pages[2].waitForFunction(()=>document.querySelector('#pollOverlay').style.getPropertyValue('--accent')==='#123456');
 await pages[2].getByText('Choose a fixture').waitFor(); // persisted poll snapshot is restored on connect
 assert.equal(await imageNode.evaluate(node=>node.isConnected),true);assert.equal(await ttsNode.evaluate(node=>node.isConnected),true);assert.equal(await pages[1].locator('.tts-card').count(),1,'reconnection never replays TTS');
 assert.deepEqual(await Promise.all(pages.map(page=>page.evaluate(()=>window.__loads))),loads,'the same documents recovered');
 await post('/api/test',message('after-restart'));await pages[0].getByText('after-restart',{exact:true}).waitFor();
 await server.broadcast('tts-skip',{});await server.broadcast('tts',{id:'after-tts',platform:'tiktok',user:'Fixture Voice',text:'After restart',duration:60,url:'/fixture-audio'});await pages[1].getByText('After restart',{exact:true}).waitFor();
 await post('/api/bridge',{platform:'kick',sourceKey:'kick',action:'poll',poll:{...poll,choices:[{text:'Alpha',votes:8},{text:'Beta',votes:2}]}});await pages[2].getByText('10 counted votes',{exact:false}).waitFor();
 assert.ok(requests.filter(url=>url===server.url+'/api/settings').length>=6,'all three pages fetch settings on both connections');
 assert.deepEqual(errors,[]);assert.deepEqual(foreign,[]);assert.ok(!requests.some(url=>/\/api\/(?:collector\/control|chat\/send|polls\/(?:create|end)|youtube\/check)/.test(url)),'transport recovery never queues account actions or platform discovery');
});

test('all three real browser sources recover after HTTP 204 or 403 permanently closes their EventSource',{timeout:45000},async t=>{
 const server=await isolatedServer(t,{browser:true}),browser=await chromium.launch();t.after(()=>browser.close());const context=await browser.newContext();
 await context.route('**/*',route=>route.request().url().startsWith(server.url+'/')?route.continue():route.abort('blockedbyclient'));
 const {token}=await (await server.request('/api/pair')).json();const saved=await server.request('/api/settings',{method:'POST',headers:{'content-type':'application/json','x-bubblecast-token':token},body:JSON.stringify({...defaults,accent:'#456789'})});assert.equal(saved.status,200);
 for(const status of [204,403])await t.test('HTTP '+status,async()=>{
  const pages=await Promise.all(['/overlay','/tts','/poll-overlay'].map(async path=>{
   const page=await context.newPage();let attempts=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/api/events',route=>++attempts===1?route.fulfill({status,body:''}):route.continue());
   await page.goto(server.url+path,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>{const el=document.querySelector('#chat')||document.querySelector('#stage')||document.querySelector('#pollOverlay');return el.style.getPropertyValue('--accent')==='#456789';});
   assert.ok(attempts>=2,path+' explicitly replaced the closed EventSource');assert.deepEqual(errors,[]);return page;
  }));await Promise.all(pages.map(page=>page.close()));
 });
});

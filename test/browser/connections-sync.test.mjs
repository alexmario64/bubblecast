// Both actual interfaces against isolated local state; all external traffic is blocked.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {isolatedServer} from '../server-fixture.mjs';

test('settings and channel patches require pairing and preserve fields saved by the other view',async t=>{
 const server=await isolatedServer(t),{token}=await(await server.request('/api/pair')).json();
 const write=(path,data,paired=true)=>server.request('/api/'+path,{method:'PATCH',headers:{'content-type':'application/json',...(paired?{'x-bubblecast-token':token}:{})},body:JSON.stringify(data)});
 assert.equal((await write('settings',{language:'es'},false)).status,401);assert.equal((await write('sources',{youtubeChannel:'@not-saved'},false)).status,401);
 assert.equal((await write('settings',{accent:'#123456',pollWidth:640})).status,200);
 const saved=await(await write('settings',{language:'es',dockTheme:'red'})).json();assert.equal(saved.accent,'#123456');assert.equal(saved.pollWidth,640);assert.equal(saved.language,'es');
 await write('sources',{youtubeChannel:'@fixture-channel',kickChannel:'fixturekick'});const sources=await(await write('sources',{tiktokChannel:'fixturetiktok'})).json();assert.equal(sources.entered.youtubeChannel,'@fixture-channel');assert.equal(sources.entered.kickChannel,'fixturekick');assert.equal(sources.entered.tiktokChannel,'fixturetiktok');
 await server.restart();const restored=await(await server.request('/api/status')).json();assert.equal(restored.settings.language,'es');assert.equal(restored.settings.accent,'#123456');assert.equal(restored.sources.entered.youtubeChannel,'@fixture-channel');
 assert.deepEqual((await server.networkCalls()).calls,[],'offline state synchronization never probes a platform');
});

test('Studio and dock synchronize saved connections and settings both ways, preserve drafts and mounted panes, and recover after restart',{timeout:60000},async t=>{
 const server=await isolatedServer(t,{browser:true}),browser=await chromium.launch();t.after(()=>browser.close());const context=await browser.newContext(),foreign=[],errors=[],writes=[];
 await context.route('**/*',route=>{const url=route.request().url();if(url.startsWith(server.url+'/'))return route.continue();if(url.startsWith('https://static-cdn.jtvnw.net/badges/'))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg"/>'});foreign.push(url);return route.abort('blockedbyclient');});
 await context.addInitScript(()=>{localStorage.setItem('bubblecast-guide-seen','1');window.__documentId=crypto.randomUUID();window.__settingsPosts=0;window.__sourceCount=0;const Native=window.EventSource;window.EventSource=class extends Native{constructor(...args){super(...args);window.__sourceCount++;}};const original=window.fetch;window.fetch=(url,options)=>{if(url==='/api/settings'&&options?.method==='PATCH')window.__settingsPosts++;return original(url,options).then(async response=>{if(url==='/api/status'){window.__statusReads=(window.__statusReads||0)+1;window.__lastStatus=(await response.clone().json()).settings.uiTheme;}return response;});};});
 const studio=await context.newPage(),dock=await context.newPage();for(const page of [studio,dock]){page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(['POST','PATCH'].includes(r.method()))writes.push(r.url());});}
 await Promise.all([studio.goto(server.url+'/#connections'),dock.goto(server.url+'/dock')]);
 await studio.locator('#youtubeChannelField').waitFor({state:'visible'});await dock.locator('#connections').click();await dock.locator('#youtubeChannelField').waitFor({state:'visible'});
 await studio.locator('#youtubeChannel').fill('@from-studio');await studio.locator('#saveConnections').click();await dock.waitForFunction(()=>document.querySelector('#youtubeChannel').value==='@from-studio');
 await dock.locator('#youtubeChannel').fill('@from-dock');await dock.locator('#sources button[type=submit]').click();await studio.waitForFunction(()=>document.querySelector('#youtubeChannel').value==='@from-dock');
 // Keep a local draft while another saved field arrives. The next save must not revert that field.
 await studio.locator('#youtubeChannel').fill('@unsaved-draft');await dock.locator('#tiktokChannel').fill('fixtureviewer');await dock.locator('#sources button[type=submit]').click();await studio.waitForFunction(()=>document.querySelector('#tiktokChannel').value==='fixtureviewer');assert.equal(await studio.locator('#youtubeChannel').inputValue(),'@unsaved-draft');
 await studio.locator('#saveConnections').click();await dock.waitForFunction(()=>document.querySelector('#youtubeChannel').value==='@unsaved-draft');
 // First complete a Studio autosave, then change language from the dock (the old stuck timer lost this update).
 await studio.goto(server.url+'/#appearance');await studio.locator('[name=uiTheme][value=white]').check();await studio.waitForFunction(()=>window.__settingsPosts>=1&&[...document.querySelectorAll('.save-state')].some(e=>e.textContent==='Saved'));
 await dock.locator('#dockLanguage').selectOption('es');await studio.waitForFunction(()=>document.documentElement.lang==='es');assert.equal(await studio.locator('[name=uiTheme][value=white]').isChecked(),true);
 await studio.locator('[name=language][value=en]').check();await dock.waitForFunction(()=>document.documentElement.lang==='en');await studio.waitForFunction(()=>[...document.querySelectorAll('.save-state')].some(e=>e.textContent==='Saved'));
 // Changes to connections/status must leave chat iframe sessions and the separate poll pane mounted.
 await dock.locator('#closeConnections').click();await dock.locator('#dockLayout').selectOption('columns');await dock.locator('#togglePollPane').click();const frames=await dock.locator('.chat-pane iframe').elementHandles();assert.ok(frames.length>=2);await dock.waitForFunction(()=>[...document.querySelectorAll('.chat-pane iframe')].every(f=>!!f.contentWindow.bubblecastConnections));assert.equal(await dock.evaluate(()=>window.__sourceCount),1);for(const frame of frames)assert.equal(await frame.evaluate(node=>node.contentWindow.__sourceCount),0,'pane shares the root event stream');
 const documents=await Promise.all([studio,dock].map(page=>page.evaluate(()=>window.__documentId)));
 await server.stop();await server.restart();await dock.waitForFunction(()=>document.querySelector('#connection').dataset.state==='ok');
 const {token}=await(await server.request('/api/pair')).json();const response=await server.request('/api/settings',{method:'PATCH',headers:{'content-type':'application/json','x-bubblecast-token':token},body:JSON.stringify({uiTheme:'midnight'})});assert.equal(response.status,200);assert.equal((await response.json()).uiTheme,'midnight');
 await Promise.all([studio,dock].map(async page=>{try{await page.waitForFunction(()=>document.body.dataset.theme==='midnight',{},{timeout:10000});}catch(e){throw Error('server='+JSON.stringify((await(await server.request('/api/status')).json()).settings.uiTheme)+' '+page.url()+' '+JSON.stringify(await page.evaluate(()=>({theme:document.body.dataset.theme,saved:document.querySelector('.save-state')?.textContent,connection:document.querySelector('#connection')?.textContent,studio:document.querySelector('#studioStatus')?.textContent,reads:window.__statusReads,last:window.__lastStatus})))+' '+e.message);}}));
 assert.deepEqual(await Promise.all([studio,dock].map(page=>page.evaluate(()=>window.__documentId))),documents);assert.equal(await dock.locator('#pollResultsPane').isVisible(),true);for(const frame of frames)assert.equal(await frame.evaluate(node=>node.isConnected),true);
 assert.deepEqual(errors,[]);assert.deepEqual(foreign,[]);assert.ok(!writes.some(url=>/\/api\/(?:collector\/control|chat\/send|polls\/(?:create|end)|youtube\/check)/.test(url)),'synchronization never causes platform actions or discovery');assert.deepEqual((await server.networkCalls()).calls,[]);
});

// Production Electron shutdown orchestration, using inert local dependencies only.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const code=await readFile(new URL('../desktop/main.cjs',import.meta.url),'utf8'),require=createRequire(import.meta.url);
function helper({ownServer=true,fetch=async()=>({ok:true,json:async()=>({status:'paused',token:'fixture'})})}={}){
 const calls=[],app=new EventEmitter(),windows=new Map([['fixture',{capture:{stop:()=>calls.push('stop capture')},win:{isDestroyed:()=>false,destroy:()=>calls.push('destroy window')}}]]);
 const quit=()=>{calls.push('quit');app.emit('before-quit',{preventDefault:()=>calls.push('prevent quit')});};app.quit=quit;
 const context=vm.createContext({app,windows,ownServer,quitPending:false,quitReady:false,quitting:false,serverModule:{pauseSubathonForShutdown:()=>calls.push('save paused')},base:'http://127.0.0.1:3927',fetch,AbortSignal,require,dialog:{showErrorBox:()=>calls.push('pause error')},request:async()=>calls.push('collector stopped')});
 vm.runInContext(code.slice(code.indexOf('async function pauseExternalSubathon('),code.indexOf('app.whenReady().then(')),context);
 return {calls,app,quit,context};
}
const flush=()=>new Promise(setImmediate);
test('closing the Studio window does not stop the timer; exiting the owning helper saves before destroying windows',()=>{
 const h=helper();h.app.emit('window-all-closed');assert.deepEqual(h.calls,[]);h.quit();assert.deepEqual(h.calls,['quit','save paused','stop capture','destroy window','collector stopped']);assert.equal(h.context.quitting,true);
});
test('external server pause is confirmed before exit; repeated Quit clicks send only one request',async()=>{
 let resolve;const requests=[],h=helper({ownServer:false,fetch:async(url,options)=>{requests.push({url,options});if(url.endsWith('/api/pair'))return {ok:true,json:async()=>({token:'fixture'})};await new Promise(r=>{resolve=r;});return {ok:true,json:async()=>({status:'paused'})};}});
 h.quit();h.quit();await flush();assert.equal(requests.length,2);assert.ok(requests.every(r=>r.options.signal));assert.equal(JSON.parse(requests[1].options.body).action,'pause');assert.ok(!h.calls.includes('destroy window'));resolve();await flush();assert.equal(requests.length,2);assert.ok(h.calls.includes('destroy window'));
});
test('unconfirmed external pause leaves Bubblecast open and shows an error; a deliberate retry can quit',async()=>{
 let fail=true,posts=0;const h=helper({ownServer:false,fetch:async url=>{if(url.endsWith('/api/pair'))return {ok:true,json:async()=>({token:'fixture'})};posts++;if(fail)throw Error('Timed out');return {ok:true,json:async()=>({status:'paused'})};}});
 h.quit();await flush();assert.equal(posts,1);assert.ok(h.calls.includes('pause error'));assert.ok(!h.calls.includes('destroy window'));assert.equal(h.context.quitting,false);fail=false;h.quit();await flush();assert.equal(posts,2);assert.ok(h.calls.includes('destroy window'));
});
test('a separate server that has already stopped does not block quitting',async()=>{
 const h=helper({ownServer:false,fetch:async()=>{throw Object.assign(Error('fetch failed'),{cause:{code:'ECONNREFUSED'}});}});
 h.quit();await flush();await flush();assert.ok(!h.calls.includes('pause error'));assert.ok(h.calls.includes('destroy window'));
});

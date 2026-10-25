import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
const script=await readFile(new URL('../../public/event-stream.js',import.meta.url),'utf8');
function fixture(t,{fetcher=async()=>({ok:true,json:async()=>({accent:'#123456'})}),storage,construct=()=>{}}={}){
 const w=new Window({url:'http://127.0.0.1:3927/overlay'});t.after(()=>w.happyDOM.abort());let time=1000000,reloads=0,watch,id=0;const timers=new Map(),sources=[],fetches=[];
 class Source{constructor(url){construct();this.url=url;this.listeners={};this.readyState=0;sources.push(this);}addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}emit(type,data={}){if(type==='open')this.readyState=1;for(const fn of this.listeners[type]||[])fn({data:JSON.stringify(data)});}close(){this.closed=true;this.readyState=2;}}
 w.eval(script);const events=w.bubblecastEvents.connect({EventSource:Source,fetcher:(...a)=>{fetches.push(a);return fetcher(...a);},now:()=>time,later:(fn,ms)=>{timers.set(++id,{fn,at:time+ms,ms});return id;},clearLater:n=>timers.delete(n),repeat:fn=>{watch=fn;return 1;},clearRepeat:()=>{watch=null;},reload:()=>reloads++,storage:storage||w.sessionStorage});
 const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
 const advance=async ms=>{time+=ms;for(const [key,timer] of [...timers])if(timer.at<=time){timers.delete(key);timer.fn();}await flush();};
 return {w,events,sources,fetches,timers,flush,advance,watch:()=>watch?.(),get reloads(){return reloads;}};
}
test('each open requests fresh settings and a late GET cannot replace newer SSE settings',async t=>{
 let finish;const f=fixture(t,{fetcher:()=>new Promise(r=>{finish=r;})}),seen=[];f.events.addEventListener('settings',e=>seen.push(JSON.parse(e.data)));
 f.sources[0].emit('open');assert.equal(f.fetches[0][0],'/api/settings');assert.equal(f.fetches[0][1].cache,'no-store');f.sources[0].emit('settings',{accent:'#abcdef'});finish({ok:true,json:async()=>({accent:'#111111'})});await f.flush();assert.deepEqual(seen,[{accent:'#abcdef'}]);
});
test('closed and reconnecting errors create exactly one replacement with all handlers retained',async t=>{
 const f=fixture(t),seen=[];f.events.addEventListener('message',e=>seen.push(JSON.parse(e.data)));const old=f.sources[0];old.emit('error');old.emit('error');f.watch();assert.equal(f.timers.size,1);assert.equal(old.closed,true);
 await f.advance(999);assert.equal(f.sources.length,1);await f.advance(1);assert.equal(f.sources.length,2);f.sources[1].emit('open');await f.flush();f.sources[1].emit('message',{id:'new'});old.emit('message',{id:'late'});assert.deepEqual(seen,[{id:'new'}]);assert.equal(f.fetches.length,1);
});
test('an OPEN but silent source reconnects after 45 seconds; healthy heartbeats keep a quiet stream alive',async t=>{
 const f=fixture(t);f.sources[0].emit('open');await f.flush();await f.advance(44000);f.watch();assert.equal(f.sources[0].closed,undefined);f.sources[0].emit('heartbeat');await f.advance(44000);f.watch();assert.equal(f.sources.length,1);await f.advance(1000);f.watch();assert.equal(f.sources[0].closed,true);await f.advance(1000);assert.equal(f.sources.length,2);
});
test('a permanently CLOSED source without an error event is detected by the watchdog',async t=>{
 const f=fixture(t);f.sources[0].readyState=2;f.watch();await f.advance(1000);assert.equal(f.sources.length,2);
});
test('retries back off and repeated HTTP/transport failure reloads only after a reachable local settings response',async t=>{
 let online=false;const f=fixture(t,{fetcher:async()=>{if(!online)throw Error('offline');return {ok:true,json:async()=>({})};}});
 for(const delay of [1000,2000,4000,8000,10000]){f.sources.at(-1).emit('error');assert.equal([...f.timers.values()][0].ms,delay);await f.advance(delay);}
 assert.equal(f.reloads,0);online=true;f.sources.at(-1).emit('error');await f.advance(10000);assert.equal(f.reloads,1);
});
test('reload cooldown survives a new document and storage failures do not stop reconnection',async t=>{
 for(const storage of [{getItem:()=>String(1000000),setItem:()=>assert.fail('cooldown')},{getItem(){throw Error('storage disabled');},setItem(){throw Error('storage disabled');}}]){
  const f=fixture(t,{storage});for(const delay of [1000,2000,4000,8000,10000]){f.sources.at(-1).emit('error');await f.advance(delay);}assert.equal(f.reloads,0);assert.equal(f.sources.length,6);
 }
});
test('a healthy 45-second connection resets backoff rather than eventually reloading a recovered stream',async t=>{
 const f=fixture(t);f.sources[0].emit('error');await f.advance(1000);f.sources[1].emit('open');await f.flush();await f.advance(45000);f.sources[1].emit('heartbeat');f.sources[1].emit('error');assert.equal([...f.timers.values()][0].ms,1000);await f.advance(1000);assert.equal(f.reloads,0);
});
test('pagehide closes the transport, cancels timers and rejects late settings and messages',async t=>{
 let finish;const f=fixture(t,{fetcher:()=>new Promise(r=>{finish=r;})}),seen=[];f.events.addEventListener('settings',e=>seen.push(e));f.sources[0].emit('open');f.w.dispatchEvent(new f.w.Event('pagehide'));assert.equal(f.sources[0].closed,true);assert.equal(f.fetches[0][1].signal.aborted,true);finish({ok:true,json:async()=>({})});await f.flush();await f.advance(60000);f.watch();assert.equal(f.sources.length,1);assert.equal(seen.length,0);
});
test('settings failures and malformed snapshots preserve the transport and do not dispatch invalid settings',async t=>{
 for(const response of [{ok:false,json:async()=>({})},{ok:true,json:async()=>null},{ok:true,json:async()=>[]},{ok:true,json:async()=>{throw Error('bad JSON');}}]){const f=fixture(t,{fetcher:async()=>response}),seen=[];f.events.addEventListener('settings',e=>seen.push(e));f.sources[0].emit('open');await f.flush();assert.equal(seen.length,0);assert.equal(f.sources[0].closed,undefined);}
});
test('a stalled settings request is aborted at five seconds and close cancels a pending retry',async t=>{
 const f=fixture(t,{fetcher:()=>new Promise(()=>{})});f.sources[0].emit('open');await f.advance(5000);assert.equal(f.fetches[0][1].signal.aborted,true);f.sources[0].emit('error');f.events.close();await f.advance(60000);assert.equal(f.sources.length,1);
});

test('a constructor failure retries instead of leaving a permanently disconnected overlay',async t=>{
 let calls=0;const f=fixture(t,{construct:()=>{if(++calls===1)throw Error('temporarily unavailable');}});assert.equal(f.sources.length,0);await f.advance(1000);assert.equal(f.sources.length,1);
});
test('late settings from an older connection cannot overwrite the new connection',async t=>{
 const pending=[],f=fixture(t,{fetcher:()=>new Promise(r=>pending.push(r))}),seen=[];f.events.addEventListener('settings',e=>seen.push(JSON.parse(e.data)));f.sources[0].emit('open');f.sources[0].emit('error');await f.advance(1000);f.sources[1].emit('open');pending[1]({ok:true,json:async()=>({accent:'new'})});await f.flush();pending[0]({ok:true,json:async()=>({accent:'old'})});await f.flush();assert.deepEqual(seen,[{accent:'new'}]);
});
test('handler registration stays single across reconnects and all recovery requests remain read-only on localhost',async t=>{
 const f=fixture(t);let calls=0;const handler=()=>calls++;f.events.addEventListener('tts',handler);f.events.addEventListener('tts',handler);
 f.sources[0].emit('tts');f.sources[0].emit('error');await f.advance(1000);f.sources[1].emit('open');await f.flush();f.sources[1].emit('tts');assert.equal(calls,2);
 assert.ok(f.sources.every(s=>s.url==='/api/events'));assert.ok(f.fetches.every(([url,options])=>url==='/api/settings'&&options.method===undefined));
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {YouTubePoll} from '../desktop/youtube-poll.mjs';
const seed={url:'https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?prettyPrint=false',body:{context:{client:{clientName:'WEB',visitorData:'visitor'}},continuation:'first'},headers:{'X-YouTube-Client-Name':'1',Cookie:'never copy',Authorization:'never copy'}};
const payload=cursor=>({continuationContents:{liveChatContinuation:{continuations:[{invalidationContinuationData:{continuation:cursor,timeoutMs:10000}}]}}});
function fixture(request,now=()=>0){const timers=[],messages=[],errors=[],calls=[];const poll=new YouTubePoll({now,request:async(...args)=>{calls.push(args);return request(...args);},onPayload:p=>messages.push(p),onError:e=>errors.push(e),schedule:(f,ms)=>{const timer={f,ms};timers.push(timer);return timer;},cancel:timer=>{if(timer)timer.cancelled=true;}});return {poll,timers,messages,errors,calls};}
test('YouTube independent reader follows continuations on a bounded 200 ms cadence without waiting for page timers',async()=>{
 const f=fixture(async()=>({ok:true,json:async()=>payload('next')}));f.poll.seed(seed);assert.equal(f.timers[0].ms,0);await f.timers[0].f();assert.equal(f.messages.length,1);assert.equal(f.poll.body.continuation,'next');assert.equal(f.timers.at(-1).ms,200);assert.equal(f.calls[0][1].headers.Cookie,undefined);assert.equal(f.calls[0][1].headers.Authorization,undefined);assert.equal(f.calls[0][1].headers['X-YouTube-Client-Name'],'1');assert.equal(seed.body.continuation,'first');f.poll.stop();
});
test('YouTube 429 honors Retry-After and does not advance the cursor or forward content',async()=>{
 const f=fixture(async()=>({ok:false,status:429,headers:{get:()=> '300'}}));f.poll.seed(seed);await f.timers[0].f();assert.equal(f.timers.at(-1).ms,300000);assert.equal(f.messages.length,0);assert.equal(f.poll.body.continuation,'first');assert.ok(f.errors[0]);f.poll.stop();
});
test('invalid or ended chat responses back off instead of sending requests every second',async()=>{
 const f=fixture(async()=>({ok:true,json:async()=>({})}));f.poll.seed(seed);await f.timers[0].f();assert.equal(f.timers.at(-1).ms,30000);assert.equal(f.messages.length,0);f.poll.stop();
});
test('disconnect aborts the in-flight fetch and ignores late data',async()=>{
 let finish;const f=fixture(()=>new Promise(resolve=>finish=resolve));f.poll.seed(seed);const pending=f.timers[0].f();f.poll.stop();assert.equal(f.calls[0][1].signal.aborted,true);finish({ok:true,json:async()=>payload('late')});await pending;assert.equal(f.messages.length,0);assert.equal(f.poll.running,false);assert.ok(f.timers.every(t=>t.cancelled||t.ms===0));
});
test('pollers remain independent for normal and Shorts streams',async()=>{
 const a=fixture(async()=>({ok:true,json:async()=>payload('normal-next')})),b=fixture(async()=>({ok:true,json:async()=>payload('shorts-next')}));a.poll.seed(seed);b.poll.seed({...seed,body:{...seed.body,continuation:'shorts'}});await a.timers[0].f();await b.timers[0].f();assert.equal(a.poll.body.continuation,'normal-next');assert.equal(b.poll.body.continuation,'shorts-next');a.poll.stop();assert.equal(b.poll.running,true);b.poll.stop();
});
test('unrelated endpoints and malformed seed data cannot start a poller',()=>{
 const f=fixture(()=>{throw Error('must not fetch');});for(const value of [{...seed,url:'https://evil.test/youtubei/v1/live_chat/get_live_chat'},{...seed,url:'http://www.youtube.com/youtubei/v1/live_chat/get_live_chat'},{...seed,body:{context:{}}}])f.poll.seed(value);assert.equal(f.poll.running,false);assert.equal(f.calls.length,0);
});

test('request duration counts toward cadence, with a minimum breather for slow responses',async()=>{
 for(const [duration,expected] of [[80,120],[250,50]]){let clock=0;const f=fixture(async()=>{clock+=duration;return {ok:true,json:async()=>payload('next')};},()=>clock);f.poll.seed(seed);await f.timers[0].f();assert.equal(f.timers.at(-1).ms,expected);f.poll.stop();}
});
test('network failures back off instead of retrying at the fast success cadence',async()=>{
 const f=fixture(async()=>{throw Error('offline');});f.poll.seed(seed);await f.timers[0].f();assert.equal(f.timers.at(-1).ms,2000);await f.timers.at(-1).f();assert.equal(f.timers.at(-1).ms,4000);f.poll.stop();
});

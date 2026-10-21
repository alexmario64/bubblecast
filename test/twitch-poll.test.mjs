import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TwitchPoll,POLL_QUERY} from '../desktop/twitch-poll.mjs';
const active={platform:'twitch',id:'known-poll',status:'active'};
const response=status=>({ok:true,json:async()=>({data:{poll:{id:'known-poll',title:'Test',status,choices:[{id:'a',title:'One',votes:{total:3}},{id:'b',title:'Two',votes:{total:1}}]}}})});
function setup(request){const timers=[],polls=[],calls=[];const reader=new TwitchPoll({request:async(...a)=>{calls.push(a);return request(...a);},onPoll:p=>polls.push(p),schedule:(f,ms)=>{const t={f,ms};timers.push(t);return t;},cancel:t=>{if(t)t.cancelled=true;}});return {reader,timers,polls,calls};}
test('known Twitch poll is read without credentials, updated and stopped on final status',async()=>{
 const f=setup(()=>response('TERMINATED'));f.reader.follow(active);assert.equal(f.timers.length,0);f.reader.client({'Client-ID':'native-public-client',Authorization:'never copy',Cookie:'never copy'});await f.timers[0].f();assert.equal(f.polls[0].status,'terminated');assert.equal(f.polls[0].choices[0].percent,75);assert.equal(f.calls[0][1].headers.Authorization,undefined);assert.equal(f.calls[0][1].headers.Cookie,undefined);assert.equal(JSON.parse(f.calls[0][1].body).variables.id,active.id);assert.ok(POLL_QUERY.startsWith('query '));assert.equal(f.reader.timer,null);
});
test('poll requests remain sequential and respect Retry-After on throttling',async()=>{
 const f=setup(()=>({ok:false,status:429,headers:{get:()=> '120'}}));f.reader.follow(active);f.reader.client({'client-id':'public'});await f.timers[0].f();assert.equal(f.timers.at(-1).ms,120000);f.reader.stop();
});
test('stopping poll reader aborts in-flight fetch and ignores late response',async()=>{
 let finish;const f=setup(()=>new Promise(r=>finish=r));f.reader.follow(active);f.reader.client({'client-id':'public'});const pending=f.timers[0].f();f.reader.stop();finish(response('COMPLETED'));await pending;assert.equal(f.polls.length,0);assert.equal(f.calls[0][1].signal.aborted,true);
});

test('unauthenticated poll lookups stop instead of retrying forever',async()=>{const f=setup(()=>({ok:true,json:async()=>({errors:[{message:'unauthenticated'}]})}));f.reader.follow(active);f.reader.client({'client-id':'public'});await f.timers[0].f();assert.equal(f.reader.denied,true);assert.equal(f.reader.timer,null);const count=f.timers.length;f.reader.client({'client-id':'public'});f.reader.follow(active);assert.equal(f.timers.length,count);});

test('valid native platform authorization is used only for the same read-only endpoint and cleared on sign-out',async()=>{const f=setup(()=>response('COMPLETED'));f.reader.follow(active);f.reader.client({'client-id':'native','Authorization':'OAuth native_session_token_1234'});await f.timers[0].f();assert.equal(f.calls[0][0],'https://gql.twitch.tv/gql');assert.equal(f.calls[0][1].headers.Authorization,'OAuth native_session_token_1234');f.reader.client({'client-id':'native'});assert.equal(f.reader.authorization,null);});

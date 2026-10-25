import {test} from 'node:test';
import assert from 'node:assert/strict';
import {YouTubeDiscovery,youtubeReadMode} from '../youtube-discovery.mjs';

function fixture(check=async()=>{}){
 let now=100000,slots={main:false,vertical:false};const jobs=[],calls=[];
 const d=new YouTubeDiscovery({now:()=>now,check:async reason=>{calls.push({at:now,reason});await check();},filled:expected=>(!expected.main||slots.main)&&(!expected.vertical||slots.vertical),schedule:(fn,delay)=>{const h={fn,at:now+delay};jobs.push(h);return h;},cancel:h=>{h.cancelled=true;}});
 const advance=async ms=>{const target=now+ms;for(;;){const j=jobs.filter(j=>!j.cancelled&&!j.ran&&j.at<=target).sort((a,b)=>a.at-b.at)[0];if(!j)break;now=j.at;j.ran=true;await j.fn();}now=target;};
 return {d,calls,slots,advance,jobs};
}
test('stream-start checks run at +20, +60, +120 and +240 seconds and then stop permanently',async()=>{
 const f=fixture();f.d.update({main:true});await f.advance(1000000);
 assert.deepEqual(f.calls.map(c=>c.at-100000),[20000,60000,120000,240000]);assert.equal(f.d.status().state,'exhausted');
 for(let i=0;i<100;i++){f.d.update({main:true});await f.advance(30000);}assert.equal(f.calls.length,4);
});
test('checks stop when the expected slots fill, and a later Aitum start has its own bounded series',async()=>{
 const f=fixture();f.d.update({main:true});await f.advance(20000);f.slots.main=true;f.d.settle();await f.advance(400000);assert.equal(f.calls.length,1);assert.equal(f.d.status().state,'complete');
 f.d.update({main:true,vertical:true});await f.advance(20000);assert.equal(f.calls.length,2);f.slots.vertical=true;f.d.settle();await f.advance(400000);assert.equal(f.calls.length,2);
});
test('idle/recording reports spend nothing; stopping cancels pending checks, and a fresh start works',async()=>{
 const f=fixture();for(let i=0;i<100;i++){f.d.update({main:false,vertical:false});await f.advance(30000);}assert.equal(f.calls.length,0);
 f.d.update({vertical:true});await f.advance(10000);f.d.update({});await f.advance(400000);assert.equal(f.calls.length,0);
 f.d.update({main:true});await f.advance(20000);assert.equal(f.calls.length,1);
});
test('failed checks remain bounded and filling only one of two slots keeps the remaining attempts',async()=>{
 const f=fixture(async()=>{throw Error('synthetic failure');});f.d.update({main:true,vertical:true});f.slots.main=true;await f.advance(400000);assert.equal(f.calls.length,4);assert.equal(f.d.status().state,'exhausted');
});
test('API-first policy permits page reading only with no app or exhausted quota',()=>{
 const now=1000;
 assert.equal(youtubeReadMode({configured:false,connected:false},now),'page');
 assert.equal(youtubeReadMode({configured:true,connected:true},now),'api');
 assert.equal(youtubeReadMode({configured:true,connected:false},now),'signin');
 assert.equal(youtubeReadMode({configured:true,connected:true,quotaUntil:2000},now),'page');
 assert.equal(youtubeReadMode({configured:true,connected:true,quotaUntil:1000},now),'api');
});
test('a stalled lookup never overlaps or adds attempts beyond the four deadlines',async()=>{
 const jobs=[];let finish,calls=0;const d=new YouTubeDiscovery({check:()=>{calls++;return new Promise(r=>{finish=r;});},filled:()=>false,schedule:fn=>{jobs.push(fn);return fn;},cancel:()=>{}});
 d.update({main:true});const first=jobs[0]();await jobs[1]();await jobs[2]();await jobs[3]();assert.equal(calls,1);assert.equal(d.status().state,'exhausted');finish();await first;assert.equal(d.status().state,'exhausted');assert.equal(jobs.length,4);
});
test('finishing a cancelled lookup cannot complete a later output-start series',async()=>{
 const jobs=[];let finish;const d=new YouTubeDiscovery({check:()=>new Promise(r=>{finish=r;}),filled:()=>false,schedule:fn=>{jobs.push(fn);return fn;},cancel:()=>{}});
 d.update({main:true});const old=jobs[0]();d.update({});d.update({vertical:true});finish();await old;assert.equal(d.status().state,'scheduled');assert.deepEqual(d.status().expected,{horizontal:false,vertical:true});assert.equal(jobs.length,8);
});
test('previous-stream slots cannot stop a new start series before a current confirmation',async()=>{
 let now=100000,confirmed=90000;const jobs=[];const d=new YouTubeDiscovery({now:()=>now,check:async()=>{confirmed=now;},filled:(_expected,since)=>confirmed>=since,schedule:fn=>{jobs.push(fn);return fn;},cancel:()=>{}});
 d.update({main:true});assert.equal(d.status().state,'scheduled');now+=20000;await jobs[0]();assert.equal(d.status().state,'complete');
});

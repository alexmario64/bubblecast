import {test} from 'node:test';
import assert from 'node:assert/strict';
import {launchSharedPoll} from '../desktop/shared-poll.mjs';
const job=()=>({createdAt:Date.now(),spec:{question:'Next?',choices:['Mario','Zelda'],duration:120},urls:{twitch:'twitch',kick:'kick',youtube:'youtube',youtubeShorts:'shorts'}});
test('one preparation failure prevents every native Create click',async()=>{
 let publishes=0;const results=await launchSharedPoll(job(),{prepare:async key=>{if(key==='kick')throw Error('No moderator permission');},publish:async()=>publishes++,confirm:async()=>true});
 assert.equal(publishes,0);assert.equal(results.kick.detail,'No moderator permission');assert.ok(Object.values(results).every(r=>r.status==='failed'));
});
test('all selected platforms publish once after all preparations finish, and confirm independently',async()=>{
 const prepared=new Set(),published=[];const results=await launchSharedPoll(job(),{prepare:async key=>prepared.add(key),publish:async key=>{assert.equal(prepared.size,4);published.push(key);return {ok:true};},confirm:async key=>key!=='youtubeShorts'});
 assert.equal(new Set(published).size,4);assert.equal(published.length,4);assert.equal(results.youtube.status,'submitted');assert.equal(results.youtubeShorts.status,'unknown');
});
test('expired shared requests never prepare or publish',async()=>{
 let touched=false;const result=await launchSharedPoll({...job(),createdAt:0},{prepare:async()=>touched=true,publish:async()=>touched=true,confirm:async()=>true});assert.equal(touched,false);assert.ok(Object.values(result).every(r=>r.status==='failed'));
});
test('failed preparation rolls back every owned draft without publishing or retrying',async()=>{
 const cleaned=[];const result=await launchSharedPoll(job(),{prepare:async key=>{if(key==='kick')throw Error('No creator form');},cleanup:async key=>{cleaned.push(key);return {ok:true};},publish:async()=>assert.fail('Must not publish'),confirm:async()=>true});
 assert.equal(cleaned.length,4);assert.match(result.twitch.detail,/cleared its draft/);assert.equal(result.kick.detail,'No creator form');
});

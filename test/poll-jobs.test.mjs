import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PollJobs,pollSpecification} from '../poll-jobs.mjs';
const request={requestId:'poll-request-123',question:'Next game?',choices:['Mario','Zelda'],duration:120,targets:['twitch','kick','youtube','youtubeShorts']};
const urls=Object.fromEntries(request.targets.map(k=>[k,'https://example.com/'+k]));
test('shared poll validates the strictest selected platform limits and distinct answers',()=>{
 assert.deepEqual(pollSpecification(request),{question:'Next game?',choices:['Mario','Zelda'],duration:120});
 for(const change of [{question:'a'.repeat(61)},{choices:['a']},{choices:['A','a']},{choices:['x'.repeat(26),'b']},{duration:5}])assert.throws(()=>pollSpecification({...request,...change}));
});
test('poll submission freezes all destinations and reuses an existing request without requeuing',()=>{
 const jobs=new PollJobs();const first=jobs.enqueue(request,urls);assert.equal(first.fresh,true);assert.equal(jobs.enqueue(request,urls).fresh,false);urls.twitch='https://example.com/changed';assert.notEqual(first.job.urls.twitch,urls.twitch);assert.equal(Object.keys(jobs.claim(request.requestId).results).length,4);
});
test('an active poll blocks the whole shared launch and preserves other platforms',()=>{
 const jobs=new PollJobs();assert.throws(()=>jobs.enqueue(request,urls,[{sourceKey:'kick',status:'active'}]),/End the active/);assert.equal(jobs.jobs.size,0);
});
test('Kick minimum answer length rejects the whole request before Twitch can be queued',()=>{
 const jobs=new PollJobs(),short={...request,choices:['1','2'],targets:['twitch','kick']};assert.throws(()=>jobs.enqueue(short,urls),/at least 2 characters/);assert.equal(jobs.jobs.size,0);
 const twitch=jobs.enqueue({...short,requestId:'twitch-only-123',targets:['twitch']},urls);assert.equal(twitch.fresh,true);
});

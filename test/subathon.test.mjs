import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Subathon,subathonSupport} from '../subathon.mjs';
import {normalize,defaults} from '../core.mjs';
import {chatMessage} from '../youtube-official.mjs';
async function fixture(t){const dir=await mkdtemp(join(tmpdir(),'bubblecast-subathon-'));t.after(()=>rm(dir,{recursive:true,force:true}));let now=0,wall=1000000;const options={file:join(dir,'subathon.json'),now:()=>now,wall:()=>wall},timer=new Subathon(options);let n=0;return {timer,options,dir,advance:ms=>{now+=ms;wall+=ms;},wallOnly:ms=>{wall+=ms;},command:(action,args={})=>timer.command({id:'request-'+(++n),action,...args})};}
const message=(id,event,support)=>({id,platform:'twitch',user:'Fixture',parts:[],event,...(support?{support}:{})});
test('subathon only counts while running, pauses explicitly, and cannot revive after ending',async t=>{
 const f=await fixture(t);f.advance(60000);assert.equal(f.timer.snapshot().remainingMs,3600000);f.command('start');f.advance(5000);assert.equal(f.timer.snapshot().remainingMs,3595000);f.command('pause');f.advance(100000);assert.equal(f.timer.snapshot().remainingMs,3595000);f.command('resume');f.advance(1000);f.command('end');f.advance(10000);assert.equal(f.timer.snapshot().remainingMs,3594000);assert.throws(()=>f.command('resume'));assert.throws(()=>f.command('support',{metric:'money',amount:2}));
});
test('closing saves the exact remaining time; reopening after hours restores paused, never subtracting downtime',async t=>{
 const f=await fixture(t);f.command('start');f.advance(12345);f.timer.pauseForShutdown();const saved=f.timer.snapshot().remainingMs;f.advance(86400000);const next=new Subathon(f.options);next.load();assert.equal(next.snapshot().status,'paused');assert.equal(next.snapshot().remainingMs,saved);f.advance(10000);assert.equal(next.snapshot().remainingMs,saved);
});
test('a forced exit restores the last small checkpoint paused; stale checkpoints cannot undo a later adjustment',async t=>{
 const f=await fixture(t);f.command('start');f.advance(1000);f.timer.checkpoint();f.advance(800);let next=new Subathon(f.options);next.load();assert.equal(next.snapshot().remainingMs,3599000);assert.equal(next.snapshot().status,'paused');f.command('adjust',{seconds:600});const expected=f.timer.snapshot().remainingMs;next=new Subathon(f.options);next.load();assert.equal(next.snapshot().remainingMs,expected);
});
test('wall-clock adjustments do not alter elapsed time, and expiry remains ended after restart',async t=>{
 const f=await fixture(t);f.command('settings',{patch:{initialSeconds:2}});f.command('start');f.wallOnly(10000000);assert.equal(f.timer.snapshot().remainingMs,2000);f.advance(2100);assert.equal(f.timer.snapshot().status,'ended');f.timer.checkpoint();const next=new Subathon(f.options);next.load();assert.equal(next.snapshot().status,'ended');assert.equal(next.snapshot().remainingMs,0);
});
test('support rules count resubs once, gift bundles by quantity, and enforce the remaining-time cap',async t=>{
 const f=await fixture(t);f.command('settings',{patch:{automatic:true,capSeconds:3700}});assert.equal(f.timer.accept(message('before',{kind:'sub'})),false);f.command('start');assert.equal(f.timer.accept(message('resub',{kind:'resub',amount:24})),true);assert.equal(f.timer.snapshot().counters.subscriptions,1);assert.equal(f.timer.snapshot().remainingMs,3700000);f.timer.accept(message('bundle',{kind:'giftbomb',amount:10}));assert.equal(f.timer.snapshot().counters.subscriptions,11);assert.equal(f.timer.snapshot().addedMs,100000);f.command('pause');f.advance(10000);f.timer.accept(message('paused',{kind:'sub'}));assert.equal(f.timer.snapshot().status,'paused');assert.equal(f.timer.snapshot().counters.subscriptions,12);
});
test('duplicate event IDs and repeated command IDs cannot add time twice, including after restart',async t=>{
 const f=await fixture(t);f.command('settings',{patch:{automatic:true}});f.command('start');const m=message('unique-native',{kind:'sub'});f.timer.accept(m);f.timer.accept(m);const request={id:'manual-id-123',action:'support',metric:'money',amount:25};f.timer.command(request);f.timer.command(request);const expected=f.timer.snapshot();const next=new Subathon(f.options);next.load();assert.equal(next.accept(m),false);next.command(request);assert.deepEqual(next.snapshot().counters,expected.counters);assert.equal(next.snapshot().remainingMs,expected.remainingMs);const stored=await readFile(f.options.file,'utf8');assert.ok(!stored.includes('unique-native'));assert.ok(!stored.includes('Fixture'));
});
test('money uses structured quantities and matching currency; plain chat, milestones and malformed counts are ignored',async t=>{
 const f=await fixture(t);f.command('settings',{patch:{automatic:true}});f.command('start');for(const m of [message('a',{kind:'superchat',title:'$500'}),message('b',{kind:'membership',title:'Member for 12 months'}),message('c',{kind:'giftbomb',amount:NaN}),message('d',null,{metric:'money',amount:100,currency:'EUR'}),message('e',null,{metric:'bits',amount:Infinity}),message('f',null,{metric:'money',amount:25})])assert.equal(f.timer.accept(m),false);
 f.timer.accept(message('usd',null,{metric:'money',amount:25.5,currency:'USD'}));f.timer.accept(message('bits',null,{metric:'bits',amount:150}));assert.deepEqual(f.timer.snapshot().counters,{subscriptions:0,bits:150,money:25.5,tiktokGifts:0,kicks:0});assert.equal(f.timer.snapshot().addedMs,1620000);assert.throws(()=>f.command('settings',{patch:{currency:'EUR'}}));
});
test('goals, configuration, visibility and manual counters persist; reset clears totals but keeps rules and goals',async t=>{
 const f=await fixture(t);f.command('settings',{patch:{title:'Community night',initialSeconds:7200,visible:false}});f.command('goal-add',{title:'Game night',metric:'subscriptions',target:10});f.command('start');f.command('support',{metric:'subscriptions',amount:10});let next=new Subathon(f.options);next.load();assert.equal(next.snapshot().config.title,'Community night');assert.equal(next.snapshot().config.visible,false);assert.equal(next.snapshot().goals.length,1);assert.equal(next.snapshot().counters.subscriptions,10);f.command('reset');assert.equal(f.timer.snapshot().status,'idle');assert.equal(f.timer.snapshot().remainingMs,7200000);assert.equal(f.timer.snapshot().counters.subscriptions,0);assert.equal(f.timer.snapshot().goals.length,1);
});
test('invalid actions are atomic and a failed checkpoint pauses instead of continuing unsaved',async t=>{
 const f=await fixture(t),before=f.timer.snapshot();assert.throws(()=>f.command('settings',{patch:{title:'Changed',capSeconds:1}}));assert.equal(f.timer.snapshot().config.title,before.config.title);assert.throws(()=>f.command('goal-add',{title:'Bad',metric:'money',target:-1}));assert.throws(()=>f.command('unknown'));assert.throws(()=>f.timer.command({id:'bad',action:'start'}));f.command('start');await writeFile(join(f.dir,'blocked'),'x');f.timer.file=join(f.dir,'blocked','state');f.advance(1000);f.timer.checkpoint();assert.equal(f.timer.snapshot().status,'paused');assert.match(f.timer.snapshot().error,/could not be saved/);
});
test('corrupt saved state reports a local error and does not overwrite the original',async t=>{
 const f=await fixture(t);await writeFile(f.options.file,'{broken');f.timer.load();assert.match(f.timer.snapshot().error,/could not be read/);assert.throws(()=>f.command('start'));assert.equal(await readFile(f.options.file,'utf8'),'{broken');
});
test('YouTube structured paid and gift quantities survive normalization; upgrades and milestone posts are not new subscriptions',()=>{
 const item=(type,extra)=>({id:'yt-native',snippet:{type,publishedAt:new Date().toISOString(),...extra},authorDetails:{displayName:'Fixture'}});
 const paid=normalize(chatMessage(item('superChatEvent',{superChatDetails:{amountDisplayString:'US$ 25.50',amountMicros:'25500000',currency:'USD'}})),defaults);assert.deepEqual(subathonSupport(paid),{metric:'money',amount:25.5,currency:'USD'});
 const gifts=normalize(chatMessage(item('membershipGiftingEvent',{membershipGiftingDetails:{giftMembershipsCount:5}})),defaults);assert.deepEqual(subathonSupport(gifts),{metric:'subscriptions',amount:5});
 const member=normalize(chatMessage(item('newSponsorEvent',{newSponsorDetails:{}})),defaults);assert.equal(subathonSupport(member).amount,1);
 for(const raw of [item('newSponsorEvent',{newSponsorDetails:{isUpgrade:true}}),item('memberMilestoneChatEvent',{memberMilestoneChatDetails:{memberMonth:12}}),item('membershipGiftingEvent',{membershipGiftingDetails:{}}),item('membershipGiftingEvent',{membershipGiftingDetails:{giftMembershipsCount:0}})])assert.equal(subathonSupport(normalize(chatMessage(raw),defaults)),null);
});

test('all four platforms contribute to one timer using independent gift rules and platform-scoped deduplication',async t=>{
 const f=await fixture(t);f.command('settings',{patch:{automatic:true,tiktokGiftSeconds:5,kicksSeconds:30}});f.command('start');
 const events=[{platform:'twitch',support:{metric:'bits',amount:100}},{platform:'youtube',support:{metric:'money',amount:2,currency:'USD'}},{platform:'tiktok',support:{metric:'tiktokGifts',amount:4}},{platform:'kick',support:{metric:'kicks',amount:500}}];
 for(const e of events){const m={...e,id:'same-id',user:'Fixture',parts:[{type:'text',text:'Support'}]};assert.equal(f.timer.accept(normalize(m,defaults)),true);assert.equal(f.timer.accept(normalize(m,defaults)),false);}
 assert.deepEqual(f.timer.snapshot().counters,{subscriptions:0,bits:100,money:2,tiktokGifts:4,kicks:500});assert.equal(f.timer.snapshot().addedMs,350000);
 const next=new Subathon(f.options);next.load();assert.deepEqual(next.snapshot().counters,f.timer.snapshot().counters);assert.equal(next.snapshot().status,'paused');
 f.command('goal-add',{title:'Gift goal',metric:'tiktokGifts',target:4});f.command('goal-add',{title:'Kicks goal',metric:'kicks',target:500});assert.equal(f.timer.snapshot().goals.length,2);
});
test('malformed fractional support is ignored without pausing, and gift units cannot cross platforms',async t=>{
 const f=await fixture(t);f.command('settings',{patch:{automatic:true}});f.command('start');
 for(const support of [{metric:'subscriptions',amount:1.5},{metric:'bits',amount:0.5},{metric:'tiktokGifts',amount:5},{metric:'kicks',amount:500}])assert.equal(f.timer.accept(message('bad',null,support)),false);
 assert.equal(f.timer.snapshot().status,'running');assert.equal(f.timer.snapshot().error,'');assert.throws(()=>f.command('support',{metric:'tiktokGifts',amount:0.5}),/whole number/);
});

test('manual adjustments respect the cap, accumulate only added time, and cannot go below zero',async t=>{
 const f=await fixture(t);f.command('settings',{patch:{initialSeconds:600,capSeconds:900}});f.command('start');f.command('adjust',{seconds:600});assert.equal(f.timer.snapshot().remainingMs,900000);assert.equal(f.timer.snapshot().addedMs,300000);f.command('adjust',{seconds:-1000});assert.equal(f.timer.snapshot().remainingMs,0);assert.equal(f.timer.snapshot().status,'ended');assert.equal(f.timer.snapshot().addedMs,300000);
});
test('invalid saved goals stop loading safely rather than breaking every connected control surface',async t=>{
 const f=await fixture(t);f.command('goal-add',{title:'Goal',metric:'money',target:10});const d=JSON.parse(await readFile(f.options.file,'utf8'));d.goals[0].metric='not-a-counter';const original=JSON.stringify(d);await writeFile(f.options.file,original);const next=new Subathon(f.options);next.load();assert.equal(next.snapshot().blocked,true);assert.throws(()=>next.command({id:'restart-fixture',action:'start'}));assert.equal(await readFile(f.options.file,'utf8'),original);
});

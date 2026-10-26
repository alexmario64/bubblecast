import {test} from 'node:test';
import assert from 'node:assert/strict';
import {streamKeyFingerprint,aitumKeyFingerprints,matchStreamKey,pageCandidates,OutputStarts} from '../youtube-slot-matching.mjs';
import {assignSlots} from '../youtube-official.mjs';
const main=streamKeyFingerprint('fixture-main-private'),vertical=streamKeyFingerprint('fixture-vertical-private');
test('stream keys have stable, case-sensitive local digests and empty/malformed inputs never match',()=>{
 assert.match(main,/^sha256:[a-f0-9]{64}$/);assert.equal(streamKeyFingerprint(' fixture-main-private '),main);assert.notEqual(main,streamKeyFingerprint('FIXTURE-main-private'));for(const v of [null,{},'', '   ','x'.repeat(4097)])assert.equal(streamKeyFingerprint(v),'');assert.ok(!main.includes('fixture-main-private'));
});
test('matching distinguishes main, vertical, unknown and a key reused by both outputs',()=>{
 assert.equal(matchStreamKey(main,{main:[main],vertical:[vertical]}),'horizontal');assert.equal(matchStreamKey(vertical,{main:[main],vertical:[vertical]}),'vertical');assert.equal(matchStreamKey(main,{main:[main],vertical:[main]}),'ambiguous');assert.equal(matchStreamKey('raw-not-a-digest',{main:['raw-not-a-digest']}),'');assert.equal(matchStreamKey(main,{}),'');
});
test('Aitum config reads enabled outputs on portrait canvases and returns no raw credentials',()=>{
 const config={canvas:[{width:1080,height:1920,stream_outputs:[{stream_key:'fixture-vertical-private',enabled:true},{stream_key:'disabled',enabled:false},{stream_key:'missing-enabled'},{stream_key:'fixture-vertical-private',enabled:true}]},{width:1920,height:1080,stream_outputs:[{stream_key:'landscape',enabled:true}]},null]};
 assert.deepEqual(aitumKeyFingerprints(config),[vertical]);assert.deepEqual(aitumKeyFingerprints({canvas:{}}),[]);assert.deepEqual(aitumKeyFingerprints(null),[]);
});
test('legacy Aitum single-output settings are supported without restoring disabled modern outputs',()=>{
 const old={canvas:[{width:720,height:1280,stream_server:'rtmp://fixture.invalid/live',stream_key:'fixture-vertical-private'}]};assert.deepEqual(aitumKeyFingerprints(old),[vertical]);old.canvas[0].stream_outputs=[{enabled:false,stream_key:'disabled'}];assert.deepEqual(aitumKeyFingerprints(old),[]);
});
test('known formats reserve their slots before an earlier unknown placeholder',()=>{
 assert.deepEqual(assignSlots([{video:'unknown'},{video:'main',format:'horizontal'}]).map(c=>[c.video,c.slot]),[['main','youtube'],['unknown','youtubeShorts']]);
 assert.deepEqual(assignSlots([{video:'unknown'},{video:'shorts',format:'vertical'}]).map(c=>[c.video,c.slot]),[['unknown','youtube'],['shorts','youtubeShorts']]);
});
test('no-API fallback uses aspect ratio ahead of output order and manual choice ahead of aspect',()=>{
 const c=pageCandidates([{video:'v',vertical:true},{video:'h',vertical:false}],{outputs:{main:true,vertical:true},starts:{main:2000,vertical:1000}});assert.deepEqual(assignSlots(c).map(x=>[x.video,x.slot]),[['h','youtube'],['v','youtubeShorts']]);
 assert.equal(pageCandidates([{video:'v',vertical:true}],{formats:{v:'horizontal'}})[0].format,'horizontal');
});
test('a vertical-first stream keeps its slot when main later starts and metadata becomes incomplete',()=>{
 const first=assignSlots(pageCandidates([{video:'v',vertical:null}],{outputs:{vertical:true}}));assert.equal(first[0].slot,'youtubeShorts');
 const next=assignSlots(pageCandidates([{video:'h',vertical:null},{video:'v',vertical:null}],{prior:first,outputs:{main:true,vertical:true}}));assert.deepEqual(next.map(x=>[x.video,x.slot]),[['h','youtube'],['v','youtubeShorts']]);
});
test('two unknown shapes use broadcast chronology and OBS/Aitum output start order rather than listing order',()=>{
 const videos=[{video:'new',startedAt:2000},{video:'old',startedAt:1000}],c=pageCandidates(videos,{outputs:{main:true,vertical:true},starts:{vertical:100,main:200}});assert.deepEqual(assignSlots(c).map(x=>[x.video,x.slot]),[['new','youtube'],['old','youtubeShorts']]);assert.ok(c.every(x=>x.formatSource==='output-start'));
});
test('simultaneous starts or missing broadcast times remain unknown rather than claiming an exact match',()=>{
 for(const videos of [[{video:'a'},{video:'b'}],[{video:'a',startedAt:1000},{video:'b',startedAt:1000}]])assert.ok(pageCandidates(videos,{outputs:{main:true,vertical:true},starts:{main:100,vertical:100}}).every(c=>c.formatSource==='unknown'));
});
test('output chronology tracks real start edges, preserves order through repeated reports and resets after stopping',()=>{
 const o=new OutputStarts();o.update({vertical:true},100);o.update({main:true,vertical:true},200);o.update({main:true,vertical:true},300);assert.deepEqual(o.starts,{vertical:100,main:200});o.update({},400);assert.deepEqual(o.starts,{});o.update({main:true},500);assert.deepEqual(o.starts,{main:500});
});

test('duplicate fallback video IDs cannot claim both main and Shorts slots',()=>{
 const c=pageCandidates([{video:'same'},{video:'same'},{video:'other'}],{});assert.equal(c.length,2);assert.deepEqual(assignSlots(c).map(c=>c.video),['same','other']);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {groupPollResults,mountPollBoard} from '../../public/poll-board.mjs';
const poll=(sourceKey,choices=[{text:'Yes',votes:3,percent:75},{text:'No',votes:1,percent:25}])=>({sourceKey,platform:sourceKey.startsWith('youtube')?'youtube':sourceKey,id:sourceKey+'-poll',question:'Next game?',choices,status:'active'});
function fixture(t){const w=new Window();t.after(()=>w.happyDOM.abort());w.document.body.innerHTML='<section id="polls"></section>';const calls=[];let allowed=['twitch','kick','youtube','youtubeShorts'];const board=mountPollBoard({document:w.document,storage:w.localStorage,matchesFilter:key=>allowed.includes(key),post:async(path,data)=>{calls.push([path,data]);return {id:'end-job',results:Object.fromEntries(data.targets.map(k=>[k,{status:'submitted',detail:'Poll ended on the platform.'}]))};}});return {w,board,calls,filter:keys=>{allowed=keys;board.filter();}};}
test('combined totals sum answer counts by label, never average percentages or invent YouTube counts',()=>{
 const results=groupPollResults([poll('twitch'),poll('kick',[{text:'No',votes:6,percent:60},{text:'Yes',votes:4,percent:40}]),poll('youtube',[{text:'Yes',votes:null,percent:80},{text:'No',votes:null,percent:20}])]);
 assert.equal(results.length,1);assert.equal(results[0].totalVotes,14);assert.equal(results[0].choices[0].votes,7);assert.equal(results[0].choices[0].percent,50);assert.equal(results[0].missing[0].sourceKey,'youtube');
 assert.equal(groupPollResults([poll('youtube',[{text:'Yes',votes:null},{text:'No',votes:null}])])[0].choices[0].votes,null);
 assert.equal(groupPollResults([poll('twitch'),{...poll('kick'),question:'Different?'}]).length,2);
});
test('combined and separate views preserve live results and remember the chosen mode',t=>{
 const f=fixture(t);f.board.update(poll('twitch'));f.board.update(poll('kick'));assert.equal(f.w.document.querySelectorAll('.poll-card').length,1);assert.match(f.w.document.querySelector('.poll-card').textContent,/8 total votes/);
 const separate=f.w.document.querySelectorAll('.poll-view-switch button')[1];separate.click();assert.equal(f.w.document.querySelectorAll('.poll-card').length,2);assert.equal(f.w.localStorage.getItem('bubblecast-poll-view'),'separate');
 f.filter(['kick']);assert.equal(f.w.document.querySelectorAll('.poll-card').length,2,'poll pane is independent of the chat filter');f.board.open();assert.equal(f.w.document.querySelector('#pollResultsPane').hidden,false);
});
test('End all dispatches all visible exact poll IDs once and retains per-destination outcomes',async t=>{
 const f=fixture(t);for(const source of ['twitch','kick','youtubeShorts'])f.board.update(poll(source));
 await f.w.document.querySelector('.poll-end-all').onclick();assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0][1].targets,['twitch','kick','youtubeShorts']);assert.equal(f.calls[0][1].pollIds.youtubeShorts,'youtubeShorts-poll');
 await f.w.document.querySelector('.poll-end-all').onclick();assert.equal(f.calls.length,1);assert.match(f.w.document.querySelector('.poll-end-feedback').textContent,/YouTube Shorts Live/);
});
test('final results stay visible after platform cleanup and votes update without replacing progress elements',t=>{
 const f=fixture(t),p=poll('kick');f.board.update(p);const card=f.w.document.querySelector('.poll-card'),bar=card.querySelector('progress');card.open=false;
 f.board.update({...p,choices:[{text:'Yes',votes:4,percent:80},{text:'No',votes:1,percent:20}]});assert.equal(card.querySelector('progress'),bar);assert.equal(bar.value,80);assert.equal(card.open,false);
 f.board.update({...p,status:'completed',closedAt:Date.now()});f.board.remove('kick',p.id);assert.equal(f.w.document.querySelector('.poll-pane-empty').hidden,true);assert.match(card.textContent,/Results/);assert.equal(card.querySelector('.poll-end-controls button'),null);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {groupPollResults,pollOverlayCard} from '../../public/poll-overlay-view.mjs';
test('poll overlay combines exact counts, labels YouTube percentages, and renders no controls or unsafe markup',t=>{
 const w=new Window();t.after(()=>w.happyDOM.abort());const polls=['twitch','kick','youtube'].map(sourceKey=>({id:sourceKey,sourceKey,platform:sourceKey,question:'<img src=x onerror=alert(1)>',status:'active',choices:[{text:'Yes',votes:sourceKey==='youtube'?null:3,percent:75},{text:'No',votes:sourceKey==='youtube'?null:1,percent:25}]}));
 const card=pollOverlayCard(w.document,groupPollResults(polls)[0]);assert.equal(card.querySelector('img'),null);assert.equal(card.querySelector('button'),null);assert.equal(card.querySelectorAll('.poll-platform').length,3);assert.match(card.textContent,/8 counted votes/);assert.match(card.textContent,/YouTube Live · Percentages/);assert.equal(card.querySelector('.poll-overlay-meter span').style.width,'75%');
 const ended=pollOverlayCard(w.document,groupPollResults(polls.map(p=>({...p,status:'completed'})))[0]);assert.match(ended.textContent,/Final results/);
});
test('poll overlay card honors display options, custom labels and leader highlight',t=>{
 const w=new Window();t.after(()=>w.happyDOM.abort());const polls=[{id:'t',sourceKey:'twitch',platform:'twitch',question:'Next?',status:'active',choices:[{text:'Kart',votes:6,percent:60},{text:'Zelda',votes:4,percent:40}]}];
 const card=pollOverlayCard(w.document,groupPollResults(polls)[0],{showVotes:false,showPlatforms:false,showFooter:false,liveLabel:'Vote now!'});
 assert.equal(card.querySelector('.poll-platform'),null);assert.equal(card.querySelector('.poll-overlay-note'),null);assert.equal(card.querySelector('.poll-overlay-label').textContent,'Vote now!');assert.equal(card.querySelector('.poll-overlay-value').textContent,'60%');assert.equal(card.querySelectorAll('.leading').length,1);assert.match(card.querySelector('.leading').textContent,/Kart/);
 const bare=pollOverlayCard(w.document,groupPollResults(polls)[0],{showVotes:false,showPercent:false,highlightLeader:false});assert.equal(bare.querySelector('.poll-overlay-value'),null);assert.equal(bare.querySelector('.leading'),null);
 const final=pollOverlayCard(w.document,groupPollResults(polls.map(p=>({...p,status:'completed'})))[0],{finalLabel:'Winner!'});assert.ok(final.classList.contains('final'));assert.equal(final.querySelector('.poll-overlay-label').textContent,'Winner!');
});

import {Window} from 'happy-dom';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mountPollComposer} from '../../public/poll-compose.mjs';
const html=await readFile(new URL('../../public/dock.html',import.meta.url),'utf8');
function setup(t){const w=new Window();t.after(()=>w.happyDOM.abort());w.document.write(html);const calls=[],started=[];const composer=mountPollComposer({document:w.document,onStarted:result=>started.push(result),getFeeds:()=>['twitch','youtubeShorts'],post:async(path,data)=>{calls.push([path,data]);return {id:'request',results:Object.fromEntries(data.targets.map(key=>[key,{status:'submitted',detail:'Confirmed'}]))};}});composer.update({sources:{urls:{twitch:'t',youtube:'y',youtubeShorts:'s',kick:'k'}},collector:{active:true,pollCreation:true,accounts:Object.fromEntries(['twitch','youtube','youtubeShorts','kick'].map(key=>[key,{signedIn:key!=='kick',canSend:false}]))}});return {w,calls,composer,started};}
test('poll targets follow receiving filters, keep the two YouTube destinations independent, and allow signed-in offline accounts',async t=>{
 const f=setup(t),doc=f.w.document;doc.querySelector('#newPoll').click();assert.equal(doc.querySelector('#pollComposer').open,true);
 assert.deepEqual([...doc.querySelectorAll('#pollTargets input:checked')].map(e=>e.value),['twitch','youtubeShorts']);assert.equal(doc.querySelector('#pollTargets input[value=kick]').disabled,true);assert.equal(doc.querySelector('#pollTargets input[value=youtube]').disabled,false);
 doc.querySelector('#pollQuestion').value='Next?';doc.querySelector('#pollAnswer1').value='Mario';doc.querySelector('#pollAnswer2').value='Zelda';assert.equal(f.calls.length,0);
 await doc.querySelector('#pollCreateForm').onsubmit({preventDefault(){}});assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0][1].targets,['twitch','youtubeShorts']);assert.equal(f.started.length,1);assert.deepEqual(f.started[0].draft.targets,['twitch','youtubeShorts']);assert.equal(doc.querySelector('#pollComposer').open,false);assert.equal(doc.querySelector('#pollQuestion').value,'');assert.equal(doc.querySelector('#startSharedPoll').disabled,false);
 await doc.querySelector('#pollCreateForm').onsubmit({preventDefault(){}});assert.equal(f.calls.length,1);
});
test('Enter while drafting and invalid identical answers never start a poll',async t=>{
 const f=setup(t),doc=f.w.document,input=doc.querySelector('#pollQuestion');const key=new f.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});input.dispatchEvent(key);assert.equal(key.defaultPrevented,true);
 input.value='Next?';doc.querySelector('#pollAnswer1').value='Mario';doc.querySelector('#pollAnswer2').value='mario';doc.querySelector('#pollTargets input[value=twitch]').checked=true;await doc.querySelector('#pollCreateForm').onsubmit({preventDefault(){}});assert.equal(f.calls.length,0);
});
test('selecting Kick blocks one-character answers locally before a shared request is sent',async t=>{
 const f=setup(t),doc=f.w.document;f.composer.update({sources:{urls:{twitch:'t',kick:'k'}},collector:{active:true,pollCreation:true,accounts:{twitch:{signedIn:true},kick:{signedIn:true}}}});doc.querySelector('#pollTargets input[value=kick]').checked=true;doc.querySelector('#pollTargets input[value=twitch]').checked=true;doc.querySelector('#pollQuestion').value='Next?';doc.querySelector('#pollAnswer1').value='1';doc.querySelector('#pollAnswer2').value='2';await doc.querySelector('#pollCreateForm').onsubmit({preventDefault(){}});assert.equal(f.calls.length,0);assert.match(doc.querySelector('#pollCreateStatus').textContent,/at least 2 characters/);
});

test('Kick answer hint and minimum length follow destination selection',t=>{
 const f=setup(t),doc=f.w.document,kick=doc.querySelector('#pollTargets input[value=kick]');
 assert.equal(doc.querySelector('#pollAnswerHint').hidden,true);
 kick.checked=true;kick.dispatchEvent(new f.w.Event('input',{bubbles:true}));
 assert.equal(doc.querySelector('#pollAnswerHint').hidden,false);assert.equal(doc.querySelector('#pollAnswer1').minLength,2);
 kick.checked=false;kick.dispatchEvent(new f.w.Event('input',{bubbles:true}));
 assert.equal(doc.querySelector('#pollAnswerHint').hidden,true);assert.equal(doc.querySelector('#pollAnswer1').minLength,1);
});

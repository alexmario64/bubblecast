import {Window} from 'happy-dom';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pollDraftAction,prepareNativePoll,publishNativePoll,openNativePoll} from '../../desktop/native-poll.mjs';
const spec={question:'Next game?',choices:['Mario','Zelda'],duration:120};
function fixture(t,platform){
 const w=new Window();t.after(()=>w.happyDOM.abort());w.HTMLElement.prototype.getClientRects=()=>[{}];
 w.document.body.innerHTML=platform==='kick'?'<form><input data-testid="poll-subject" placeholder="Enter poll subject"><input placeholder="Option 1"><input placeholder="Option 2"><select><option value="30">30 seconds</option><option value="120">2 minutes</option></select><select id="resultsDuration"><option value="15">15 seconds</option><option value="120">2 minutes</option></select><button type="button" data-testid="create-poll-submit">Create</button></form>':platform==='twitch'?'<form><label id="q">Question</label><input aria-labelledby="q"><label id="a">Responses (Minimum 2)</label>'+Array.from({length:5},()=>'<input aria-labelledby="a">').join('')+'<label id="d">Duration</label><select aria-labelledby="d"><option value="1">1m</option><option value="2">2m</option></select><button type="button" aria-label="Start Poll">Start Poll</button></form>':'<yt-live-chat-poll-creation-renderer><input aria-label="Question"><input placeholder="Option 1"><input placeholder="Option 2"><button>Ask your community</button></yt-live-chat-poll-creation-renderer>';
 let clicks=0;w.document.querySelector('button').onclick=e=>{e.preventDefault();clicks++;};
 const contents={executeJavaScript:async code=>w.eval(code),insertText:async text=>{const input=w.document.activeElement;input.value=text;input.dispatchEvent(new w.Event('input',{bubbles:true}));}};
 return {w,contents,clicks:()=>clicks};
}
for(const platform of ['kick'])test(platform+' native draft prepares the complete question and answers without publishing early',async t=>{
 const f=fixture(t,platform);await prepareNativePoll(f.contents,platform,spec,{pause:async()=>{}});assert.equal(f.clicks(),0);
 if(platform==='kick')assert.equal(f.w.document.querySelector('#resultsDuration').value,'15');
 assert.equal((await publishNativePoll(f.contents,platform,spec)).ok,true);assert.equal(f.clicks(),1);
});
test('native user drafts and changed answers are preserved and never published',async t=>{
 const f=fixture(t,'kick');f.w.document.querySelector('input').value='Existing question';await assert.rejects(prepareNativePoll(f.contents,'kick',spec),/existing native poll draft/);assert.equal(f.clicks(),0);
 f.w.document.querySelector('input').value='';await prepareNativePoll(f.contents,'kick',spec,{pause:async()=>{}});f.w.document.querySelector('[placeholder="Option 2"]').value='Changed by user';assert.equal((await publishNativePoll(f.contents,'kick',spec)).ok,false);assert.equal(f.clicks(),0);
});
test('disabled Create and missing poll controls fail without clicking other forms',async t=>{
 const f=fixture(t,'kick');await prepareNativePoll(f.contents,'kick',spec,{pause:async()=>{}});f.w.document.querySelector('button').disabled=true;assert.equal((await publishNativePoll(f.contents,'kick',spec)).ok,false);f.w.document.body.innerHTML='<input placeholder="Search"><button>Create</button>';assert.equal(f.w.eval('('+pollDraftAction.toString()+')("kick","inspect",'+JSON.stringify(spec)+')').ok,false);assert.equal(f.clicks(),0);
});
test('preparation itself rejects a disabled native Create button before the shared publish phase',async t=>{
 const f=fixture(t,'kick');f.w.document.querySelector('button').disabled=true;
 await assert.rejects(prepareNativePoll(f.contents,'kick',spec,{pause:async()=>{}}),/Start\/Create button is disabled/);assert.equal(f.clicks(),0);
});
test('rollback clears only the owned untouched draft and preserves user edits',async t=>{
 const f=fixture(t,'kick'),owned={...spec,owner:'job-123'};await prepareNativePoll(f.contents,'kick',owned,{pause:async()=>{}});
 assert.equal((await f.contents.executeJavaScript('('+pollDraftAction.toString()+')('+JSON.stringify('kick')+',"rollback",'+JSON.stringify(owned)+')')).ok,true);assert.ok([...f.w.document.querySelectorAll('input')].every(e=>!e.value));assert.equal(f.clicks(),0);
 await prepareNativePoll(f.contents,'kick',owned,{pause:async()=>{}});f.w.document.querySelector('input').value='User changed this';
 assert.equal((await f.contents.executeJavaScript('('+pollDraftAction.toString()+')('+JSON.stringify('kick')+',"rollback",'+JSON.stringify(owned)+')')).ok,false);assert.equal(f.w.document.querySelector('input').value,'User changed this');
});
test('Kick short answers are rejected before writing and a native validation response is reported as a failure after one click',async t=>{
 const f=fixture(t,'kick');await assert.rejects(prepareNativePoll(f.contents,'kick',{...spec,choices:['1','2']}),/at least 2 characters/);assert.ok([...f.w.document.querySelectorAll('input')].every(e=>!e.value));
 await prepareNativePoll(f.contents,'kick',spec,{pause:async()=>{}});let clicks=0;f.w.document.querySelector('button').onclick=()=>{clicks++;const input=f.w.document.querySelector('[placeholder="Option 1"]');input.setAttribute('aria-invalid','true');input.setAttribute('aria-describedby','option-error');const error=f.w.document.createElement('p');error.id='option-error';error.textContent='Option labels need to be at least 2 characters long.';f.w.document.querySelector('form').append(error);};
 const result=await publishNativePoll(f.contents,'kick',spec,{pause:async()=>{}});assert.equal(result.ok,false);assert.match(result.detail,/Option labels/);assert.equal(clicks,1);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {nativeEndPoll,endNativePoll,endSharedPoll,nativePollEndState,confirmPollEnded} from '../../desktop/end-poll.mjs';
import {PollEndJobs} from '../../poll-jobs.mjs';
const poll={sourceKey:'kick',id:'one',question:'Next game?',status:'active',choices:[{text:'Mario'},{text:'Zelda'}]};
test('YouTube end confirmation recognizes native removal before delayed capture without clicking again',async t=>{
 const f=fixture(t,'<yt-live-chat-renderer><yt-live-chat-message-input-renderer></yt-live-chat-message-input-renderer></yt-live-chat-renderer>');Object.defineProperty(f.w.document,'readyState',{value:'complete'});let relayed=0,reads=0;
 const contents={executeJavaScript:async code=>{reads++;return f.w.eval(code);}};
 assert.equal(await confirmPollEnded(contents,'youtube',poll,{getCurrent:async()=>poll,onEnded:async p=>{relayed++;assert.equal(p.status,'completed');},pause:async()=>{}}),true);assert.equal(relayed,1);assert.equal(reads,2);
 f.w.document.querySelector('yt-live-chat-renderer').remove();assert.equal(await confirmPollEnded(contents,'youtube',poll,{getCurrent:async()=>poll,pause:async()=>{},attempts:3}),false,'an unloaded or navigated page is not confirmation');
});
test('YouTube hidden/collapsed active polls are not mistaken for completed polls',async t=>{
 const f=fixture(t,'<yt-live-chat-renderer><yt-live-chat-message-input-renderer></yt-live-chat-message-input-renderer><yt-live-chat-poll-renderer hidden><div id="poll-question">Next game?</div></yt-live-chat-poll-renderer></yt-live-chat-renderer>');Object.defineProperty(f.w.document,'readyState',{value:'complete'});
 const state=()=>f.w.eval('('+nativePollEndState.toString()+')('+JSON.stringify(poll)+')');assert.equal(state().absent,false);assert.equal(state().ended,false);
 f.w.document.querySelector('yt-live-chat-poll-renderer').data={status:'ENDED'};assert.equal(state().ended,true);
});
function fixture(t,html){const w=new Window();t.after(()=>w.happyDOM.abort());w.HTMLElement.prototype.getClientRects=()=>[{}];w.document.body.innerHTML=html;return {w,run:(platform,action='end')=>w.eval('('+nativeEndPoll.toString()+')('+[platform,poll,action].map(v=>JSON.stringify(v)).join(',')+')')};}
test('end requests bind exact poll IDs, freeze targets, and do not queue stale or inactive polls',()=>{
 const jobs=new PollEndJobs(),raw={requestId:'end-test-123',targets:['kick'],pollIds:{kick:'one'}};
 assert.throws(()=>jobs.enqueue({...raw,pollIds:{kick:'old'}},{kick:'url'},[poll]));
 assert.throws(()=>jobs.enqueue(raw,{kick:'url'},[{...poll,status:'completed'}]));
 const {job}=jobs.enqueue(raw,{kick:'url'},[poll]);assert.equal(job.polls.kick.id,'one');assert.equal(jobs.enqueue(raw,{kick:'changed'},[]).fresh,false);
});
test('Kick delete is scoped to the matching poll and never touches unrelated Delete buttons',t=>{
 const f=fixture(t,'<button id="outside" aria-label="Delete"></button><div id="channel-chatroom"><section><h3 data-testid="poll-title">Next game?</h3><button id="end" title="Delete"></button><div data-testid="poll-option-list"></div></section></div>');let clicked=0;f.w.document.querySelector('#end').onclick=()=>clicked++;f.w.document.querySelector('#outside').onclick=()=>assert.fail('unrelated delete');
 assert.equal(f.run('kick').ok,true);assert.equal(clicked,1);f.w.document.querySelector('h3').textContent='New poll';assert.equal(f.run('kick').ok,false);assert.equal(clicked,1);
});
test('YouTube expanded Spanish finalize and collapsed menu each use one end click',async t=>{
 const f=fixture(t,'<yt-live-chat-poll-renderer><div id="poll-question">Next game?</div><button aria-label="Finalizar encuesta">Finalizar encuesta</button></yt-live-chat-poll-renderer>');let clicks=0;f.w.document.querySelector('button').onclick=()=>clicks++;
 assert.equal(f.run('youtube').ok,true);assert.equal(clicks,1);
 f.w.document.querySelector('button').outerHTML='<button aria-label="More options"></button>';f.w.document.querySelector('button').onclick=()=>{const item=f.w.document.createElement('div');item.setAttribute('role','menuitem');item.textContent='Finalizar encuesta';item.onclick=()=>clicks++;f.w.document.body.append(item);};
 const result=await endNativePoll({executeJavaScript:async code=>f.w.eval(code)},'youtube',poll,{pause:async()=>{}});assert.equal(result.ok,true);assert.equal(clicks,2);
});
test('Kick’s real unlabeled poll-delete-button is recognized without clicking collapse or page controls',t=>{
 const f=fixture(t,'<button data-testid="poll-delete-button" id="outside"></button><div id="channel-chatroom"><section><h3 data-testid="poll-title">Next game?</h3><button data-testid="poll-delete-button" id="delete"></button><button data-testid="poll-expand-collapse-button" id="collapse"></button><div data-testid="poll-option-list"></div></section></div>');let clicks=0;
 f.w.document.querySelector('#delete').onclick=()=>clicks++;for(const id of ['#outside','#collapse'])f.w.document.querySelector(id).onclick=()=>assert.fail('wrong control');
 assert.equal(f.run('kick','inspect').ok,true);assert.equal(clicks,0);assert.equal(f.run('kick').ok,true);assert.equal(clicks,1);
 f.w.document.querySelector('#delete').disabled=true;assert.equal(f.run('kick').ok,false);assert.equal(clicks,1);
});
test('Twitch sends only endpoll, and a failed native action cannot report ended',async()=>{
 let sent;await endNativePoll({},'twitch',poll,{send:async(...args)=>{sent=args;return {status:'submitted'};}});assert.equal(sent[2],'/endpoll');
 const job={createdAt:Date.now(),urls:{kick:'url'},polls:{kick:poll}};let confirms=0;
 const result=await endSharedPoll(job,{end:async()=>({ok:false,detail:'No permission'}),confirm:async()=>{confirms++;return true;}});assert.equal(result.kick.status,'failed');assert.equal(confirms,0);
 const uncertain=await endSharedPoll(job,{end:async()=>({ok:true}),confirm:async()=>false});assert.equal(uncertain.kick.status,'unknown');
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {readFile} from 'node:fs/promises';
const code=await readFile(new URL('../../desktop/poll-capture.js',import.meta.url),'utf8');
test('real YouTube poll markup captures options and percentage updates',async t=>{
 const w=new Window({url:'https://www.youtube.com/live_chat?v=test'});t.after(()=>w.happyDOM.abort());
 const messages=[];w.bubblecastCapture={send:(v,cb)=>{messages.push(v.data);cb({ok:true});}};
 w.document.body.innerHTML='<yt-live-chat-poll-renderer><span class="metadata"><span>1 votes</span></span><div id="poll-question">Pick?</div><yt-live-chat-poll-choice><span id="label-text">One</span><span id="vote-percentage-text">100%</span></yt-live-chat-poll-choice><yt-live-chat-poll-choice><span id="label-text">Two</span><span id="vote-percentage-text">0%</span></yt-live-chat-poll-choice></yt-live-chat-poll-renderer>';
 w.eval(code);assert.equal(messages.length,1);assert.equal(messages[0].poll.choices[0].percent,100);assert.equal(messages[0].poll.totalLabel,'1 votes');
 w.document.querySelector('#vote-percentage-text').textContent='50%';await new Promise(r=>setTimeout(r,10));assert.equal(messages.at(-1).poll.choices[0].percent,50);assert.equal(messages.at(-1).poll.id,messages[0].poll.id);
});

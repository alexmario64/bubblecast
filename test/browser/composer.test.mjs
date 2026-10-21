import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {pageComposer,submitChat} from '../../desktop/chat-composer.mjs';
function fixture(t,html){const w=new Window();w.document.body.innerHTML=html;w.HTMLElement.prototype.getClientRects=function(){return this.hidden?[]:[{}];};t.after(()=>w.happyDOM.abort());return {w,contents:{executeJavaScript:async code=>w.eval(code),insertText:async text=>{const el=w.document.activeElement;el.textContent=text;el.dispatchEvent(new w.Event('input',{bubbles:true}));}}};}
test('native Twitch composer sends only the complete inserted text and confirms cleared draft',async t=>{const {w,contents}=fixture(t,'<div contenteditable="true" tabindex="0" data-a-target="chat-input"></div><button data-a-target="chat-send-button">Chat</button>');const input=w.document.querySelector('[contenteditable]'),sent=[];w.document.querySelector('button').onclick=()=>{sent.push(input.textContent);input.textContent='';};const result=await submitChat(contents,'twitch','Hi <everyone>',{pause:async()=>{}});assert.deepEqual(sent,['Hi <everyone>']);assert.equal(result.status,'submitted');});
test('YouTube signed-out chat is identified without reading account credentials',async t=>{const {w}=fixture(t,'<yt-live-chat-message-input-renderer><a id="sign-in-button">Sign in</a></yt-live-chat-message-input-renderer>');const state=w.eval('('+pageComposer.toString()+')("youtube")');assert.equal(state.state,'signed-out');assert.equal(state.draft,false);});
for(const editable of ['', 'true', 'plaintext-only'])test(`YouTube native editor accepts contenteditable=${JSON.stringify(editable)} and reveals Send after typing`,async t=>{
 const {w,contents}=fixture(t,`<yt-live-chat-message-input-renderer><yt-live-chat-text-input-field-renderer id="input"><div id="input" contenteditable="${editable}" tabindex="0"></div></yt-live-chat-text-input-field-renderer><div id="send-button" hidden><button disabled aria-disabled="true">Send</button></div></yt-live-chat-message-input-renderer>`);
 const input=w.document.querySelector('[contenteditable]'),holder=w.document.querySelector('#send-button'),button=holder.querySelector('button'),sent=[];
 input.addEventListener('input',()=>{holder.hidden=false;button.disabled=false;button.setAttribute('aria-disabled','false');});button.onclick=()=>{sent.push(input.textContent);input.textContent='';};
 assert.equal(w.eval('('+pageComposer.toString()+')("youtube")').state,'ready');
 const result=await submitChat(contents,'youtube','YouTube message',{pause:async()=>{}});assert.equal(result.status,'submitted');assert.deepEqual(sent,['YouTube message']);
});
test('YouTube noneditable field never receives text or clicks Send',async t=>{
 const {contents}=fixture(t,'<yt-live-chat-message-input-renderer><div id="input" contenteditable="false" tabindex="0"></div><div id="send-button"><button>Send</button></div></yt-live-chat-message-input-renderer>');let inserts=0;contents.insertText=async()=>inserts++;assert.equal((await submitChat(contents,'youtube','hello')).status,'failed');assert.equal(inserts,0);
});
test('TikTok room composer accepts plaintext-only input and clicks the native Send div once',async t=>{
 const {w,contents}=fixture(t,'<div data-e2e="live-chat-input-container"><div data-e2e="room-chat-input-field" contenteditable="plaintext-only" tabindex="0"></div><div data-e2e="room-chat-send-btn" style="visibility:hidden;cursor:not-allowed"></div></div>');
 const input=w.document.querySelector('[contenteditable]'),button=w.document.querySelector('[data-e2e="room-chat-send-btn"]'),sent=[];
 input.addEventListener('input',()=>{button.style.visibility='visible';button.style.cursor='pointer';});button.onclick=()=>{sent.push(input.textContent);input.textContent='';};
 assert.equal((await submitChat(contents,'tiktok','TikTok message',{pause:async()=>{}})).status,'submitted');assert.deepEqual(sent,['TikTok message']);
});
test('TikTok invisible or restricted Send control cannot be clicked',async t=>{
 const {w}=fixture(t,'<div data-e2e="room-chat-input-field" contenteditable="plaintext-only" tabindex="0">hello</div><div data-e2e="room-chat-send-btn" style="visibility:hidden;cursor:not-allowed"></div>');const button=w.document.querySelector('[data-e2e="room-chat-send-btn"]');let clicks=0;button.onclick=()=>clicks++;const submit=()=>w.eval('('+pageComposer.toString()+')("tiktok","submit","hello")');assert.equal(submit().ok,false);button.style.visibility='visible';assert.equal(submit().ok,false);assert.equal(clicks,0);
});
test('TikTok background native Send accepts an enabled CSS-invisible control once',async t=>{
 const {w,contents}=fixture(t,'<div data-e2e="room-chat-input-field" contenteditable="plaintext-only" tabindex="0"></div><div data-e2e="room-chat-send-btn" style="visibility:hidden;cursor:not-allowed"></div>');
 const input=w.document.querySelector('[contenteditable]'),button=w.document.querySelector('[data-e2e="room-chat-send-btn"]');let clicks=0,waits=0;
 button.onclick=()=>{clicks++;input.textContent='';};
 const result=await submitChat(contents,'tiktok','hello',{pause:async()=>{if(++waits===3)button.style.cursor='pointer';}});
 assert.equal(result.status,'submitted');assert.equal(clicks,1);assert.equal(button.style.visibility,'hidden');
});
test('TikTok hidden ancestors and disabled native controls remain blocked even with pointer cursor',async t=>{
 const {w}=fixture(t,'<div data-e2e="room-chat-input-field" contenteditable="plaintext-only" tabindex="0">hello</div><div hidden><div data-e2e="room-chat-send-btn" style="visibility:hidden;cursor:pointer"></div></div>');
 const button=w.document.querySelector('[data-e2e="room-chat-send-btn"]');let clicks=0;button.onclick=()=>clicks++;
 const submit=()=>w.eval('('+pageComposer.toString()+')(' + JSON.stringify('tiktok')+',"submit","hello")');
 assert.equal(submit().ok,false);button.parentElement.hidden=false;button.setAttribute('aria-disabled','true');assert.equal(submit().ok,false);assert.equal(clicks,0);
});
test('disabled send buttons and existing source drafts never click Send',async t=>{const {w,contents}=fixture(t,'<div contenteditable="true" tabindex="0" data-a-target="chat-input">existing</div><button data-a-target="chat-send-button" disabled>Chat</button>');let clicks=0;w.document.querySelector('button').onclick=()=>clicks++;assert.equal((await submitChat(contents,'twitch','hello',{pause:async()=>{}})).status,'failed');assert.equal(clicks,0);assert.equal(w.document.querySelector('[contenteditable]').textContent,'existing');});
test('uncleared platform composer is unconfirmed, not silently retried',async t=>{const {w,contents}=fixture(t,'<div contenteditable="true" tabindex="0" data-a-target="chat-input"></div><button data-a-target="chat-send-button">Chat</button>');let clicks=0;w.document.querySelector('button').onclick=()=>clicks++;const result=await submitChat(contents,'twitch','hello',{pause:async()=>{}});assert.equal(result.status,'unknown');assert.equal(clicks,1);});

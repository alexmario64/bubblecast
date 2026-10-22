import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {pageComposer,submitChat} from '../../desktop/chat-composer.mjs';
function fixture(t,html){const w=new Window();w.document.body.innerHTML=html;w.HTMLElement.prototype.getClientRects=function(){return this.hidden?[]:[{}];};t.after(()=>w.happyDOM.abort());return {w,contents:{executeJavaScript:async code=>w.eval(code),insertText:async text=>{const el=w.document.activeElement;el.textContent=text;el.dispatchEvent(new w.Event('input',{bubbles:true}));}}};}
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
test('disabled send buttons and existing source drafts never click Send',async t=>{const {w,contents}=fixture(t,'<div contenteditable="true" tabindex="0" data-testid="chat-input">existing</div><button id="send-message-button" disabled>Chat</button>');let clicks=0;w.document.querySelector('button').onclick=()=>clicks++;assert.equal((await submitChat(contents,'kick','hello',{pause:async()=>{}})).status,'failed');assert.equal(clicks,0);assert.equal(w.document.querySelector('[contenteditable]').textContent,'existing');});
test('uncleared platform composer is unconfirmed, not silently retried',async t=>{const {w,contents}=fixture(t,'<div contenteditable="true" tabindex="0" data-testid="chat-input"></div><button id="send-message-button">Chat</button>');let clicks=0;w.document.querySelector('button').onclick=()=>clicks++;const result=await submitChat(contents,'kick','hello',{pause:async()=>{}});assert.equal(result.status,'unknown');assert.equal(clicks,1);});

import {Window} from 'happy-dom';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pageComposer,submitChat} from '../../desktop/chat-composer.mjs';
const code=await readFile(new URL('../../desktop/kick-capture.js',import.meta.url),'utf8');
test('observed Kick virtual rows enrich native messages without replaying startup history or duplicating capture',async t=>{
 const w=new Window({url:'https://kick.com/creator'});t.after(()=>w.happyDOM.abort());const sent=[];w.bubblecastCapture={send:m=>sent.push(m.data)};
 w.document.body.innerHTML='<div data-testid="chatroom-messages"><div data-index="1"><div><div><div><div><img alt="3-Month Subscriber" src="https://files.kick.com/channel_subscriber_badges/1/original.png"><button title="Full Kick Viewer" data-prevent-expand="true">Full Kick Viewer</button></div><span>:</span></div><span>Hello <img alt="HYPERCLAP" src="https://files.kick.com/emotes/4148074/fullsize"></span></div></div></div></div>';
 w.eval(code);w.eval(code);await new Promise(r=>setTimeout(r,20));assert.equal(sent.length,1);assert.equal(sent[0].action,'update');assert.equal(sent[0].user,'Full Kick Viewer');assert.equal(sent[0].parts[1].alt,'HYPERCLAP');assert.equal(sent[0].badges[0].alt,'3-Month Subscriber');
});
test('observed Kick Lexical editor uses native insertion and sends once with draft protection',async t=>{
 const w=new Window();t.after(()=>w.happyDOM.abort());w.HTMLElement.prototype.getClientRects=()=>[{}];w.document.body.innerHTML='<div data-testid="chat-input" contenteditable="true" tabindex="0"><p><br></p></div><button id="send-message-button">Chat</button>';
 let clicked=0;const input=w.document.querySelector('[contenteditable]');w.document.querySelector('button').onclick=()=>{clicked++;input.textContent='';};const contents={executeJavaScript:async code=>w.eval(code),insertText:async text=>{input.textContent=text;input.dispatchEvent(new w.Event('input',{bubbles:true}));}};
 assert.equal((await submitChat(contents,'kick','Kick message',{pause:async()=>{}})).status,'submitted');assert.equal(clicked,1);input.textContent='Existing draft';assert.equal((await submitChat(contents,'kick','Other',{pause:async()=>{}})).status,'failed');assert.equal(input.textContent,'Existing draft');assert.equal(clicked,1);
});

test('Kick native fallback suppresses startup rows then emits each new virtual row once',async t=>{
 const w=new Window({url:'https://kick.com/creator'});t.after(()=>w.happyDOM.abort());const sent=[];w.bubblecastCapture={send:m=>sent.push(m.data)};const row=(i,text)=>`<div data-index="${i}"><div><div><div><button title="Viewer" data-prevent-expand="true">Viewer</button></div><span>:</span></div><span>${text}</span></div></div>`;
 w.document.body.innerHTML='<div data-testid="chatroom-messages">'+row(0,'Old message')+'</div>';w.eval(code);await new Promise(r=>setTimeout(r,800));const list=w.document.querySelector('[data-testid="chatroom-messages"]');list.insertAdjacentHTML('beforeend',row(1,'New message'));await new Promise(r=>setTimeout(r,25));assert.equal(sent.filter(m=>!m.action).length,1);assert.equal(sent.find(m=>!m.action).parts[0].text,'New message');list.insertAdjacentHTML('beforeend',row(2,'New message'));await new Promise(r=>setTimeout(r,25));assert.equal(sent.filter(m=>!m.action).length,2);assert.ok(sent.filter(m=>!m.action).every(m=>m.parts[0].text!=='Old message'));
});

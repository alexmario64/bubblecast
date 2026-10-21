import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
const code=await readFile(new URL('../../desktop/youtube-live-mode.js',import.meta.url),'utf8');
const tick=()=>new Promise(r=>setTimeout(r,20));
function setup(t,label='Top chat'){const w=new Window();t.after(()=>w.happyDOM.abort());w.document.body.innerHTML='<div id="live-chat-view-selector-sub-menu"><button id="label"><span id="label-text">'+label+'</span></button><tp-yt-paper-listbox><a><span class="item">Top chat</span></a><a><span class="item">Live chat</span></a></tp-yt-paper-listbox></div>';const reports=[],timers=[];w.setTimeout=f=>timers.push(f);w.bubblecastCapture={send(m,reply){reports.push(m.data.chatMode);reply?.({ok:true});}};let opens=0,changes=0;w.document.querySelector('#label').onclick=()=>opens++;w.document.querySelectorAll('a')[1].onclick=()=>{changes++;w.document.querySelector('#label-text').textContent='Live chat';};return {w,reports,timers,counts:()=>({opens,changes})};}
test('background YouTube mode selects unfiltered Live chat once and reports the change',async t=>{const f=setup(t);f.w.eval(code);await tick();assert.deepEqual(f.reports,['switching','live']);assert.deepEqual(f.counts(),{opens:1,changes:1});f.w.document.body.append(f.w.document.createElement('div'));await tick();assert.deepEqual(f.counts(),{opens:1,changes:1});});
test('already selected Live chat is left in place and never rebaselined',t=>{const f=setup(t,'Live chat');f.w.eval(code);assert.deepEqual(f.reports,['live']);assert.deepEqual(f.counts(),{opens:0,changes:0});});
test('unknown menu markup keeps page fallback available without repeated clicks',t=>{const f=setup(t);f.w.document.querySelector('tp-yt-paper-listbox').remove();f.w.eval(code);f.timers[0]();assert.deepEqual(f.reports,['page-default']);assert.equal(f.counts().changes,0);});

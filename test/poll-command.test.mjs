import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openPollCommand} from '../desktop/poll-command.mjs';
test('Kick opener uses one native Enter sequence in the existing browser session',async()=>{
 const events=[],calls=[];const contents={executeJavaScript:async code=>{calls.push(code);if(code.includes('"check"'))return {unchanged:false};return {ok:true,x:20,y:30};},focus:()=>events.push('focus'),insertText:async text=>events.push(text),debugger:{isAttached:()=>true,sendCommand:async(method,event)=>events.push(method==='Input.dispatchKeyEvent'?[method,event.type,event.key,event.text||'']:method==='Input.dispatchMouseEvent'?[method,event.type]:[method,event.enabled])}};
 assert.equal((await openPollCommand(contents,'kick',{pause:async()=>{}})).status,'submitted');assert.equal(events.filter(e=>Array.isArray(e)&&e[0]==='Input.dispatchKeyEvent'&&e[1]==='keyDown'&&e[2]!=='Enter').map(e=>e[3]).join(''),'/poll');assert.equal(events.filter(e=>Array.isArray(e)&&e[1]==='keyDown'&&e[2]==='Enter').length,1);assert.deepEqual(events.at(-1),['Emulation.setFocusEmulationEnabled',false]);assert.ok(calls.some(c=>c.includes('focus-poll-command')));
});
test('Kick existing unrelated drafts stop native input before any insertion or Enter',async()=>{
 let touched=false;const result=await openPollCommand({executeJavaScript:async code=>code.includes('"check"')?{unchanged:false}:{ok:false,detail:'Existing draft'},insertText:async()=>touched=true,debugger:{isAttached:()=>true,sendCommand:async()=>touched=true}},'kick');assert.equal(result.status,'failed');assert.equal(touched,false);
});
test('native input failure restores page focus emulation and never sends Enter',async()=>{
 const events=[];const contents={focus(){},executeJavaScript:async code=>code.includes('"check"')?{unchanged:false}:{ok:true,x:20,y:30},debugger:{isAttached:()=>true,sendCommand:async(method,event)=>{events.push([method,event]);if(method==='Input.dispatchMouseEvent')throw Error('Closed renderer');}}};
 await assert.rejects(openPollCommand(contents,'kick',{pause:async()=>{}}),/Closed renderer/);assert.deepEqual(events.at(-1),['Emulation.setFocusEmulationEnabled',{enabled:false}]);assert.equal(events.some(([,event])=>event.key==='Enter'),false);
});

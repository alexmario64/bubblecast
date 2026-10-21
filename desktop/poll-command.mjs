import {pageComposer,submitChat} from './chat-composer.mjs';
export async function openPollCommand(contents,platform,{pause=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 if(platform!=='kick')return submitChat(contents,platform,'/poll',{pause});
 const run=action=>contents.executeJavaScript('('+pageComposer.toString()+')('+JSON.stringify(platform)+','+JSON.stringify(action)+',"/poll")');
 const before=await run('check');
 if(!before.unchanged){const focused=await run('focus');if(!focused.ok)return {status:'failed',detail:focused.detail};}
 // Reuse the helper's existing DevTools session. Browser input events reach
 // Kick's command handler in hidden capture pages without stealing OBS focus.
 if(!contents.debugger?.isAttached())return {status:'failed',detail:'Kick native input is unavailable. Refresh its source before trying again.'};
 await contents.debugger.sendCommand('Emulation.setFocusEmulationEnabled',{enabled:true});
 try{
  contents.focus();const point=await run('poll-command-point');if(!point.ok)return {status:'failed',detail:point.detail};
  if(!Number.isFinite(point.x)||!Number.isFinite(point.y))return {status:'failed',detail:'Kick’s native editor could not be focused safely.'};
  await contents.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});
  await contents.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1});
  if(before.unchanged){
   const selected=await run('select-poll-command');if(!selected.ok)return {status:'failed',detail:selected.detail};
   await contents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyDown',key:'Backspace',code:'Backspace',windowsVirtualKeyCode:8,nativeVirtualKeyCode:8});
   await contents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyUp',key:'Backspace',code:'Backspace',windowsVirtualKeyCode:8,nativeVirtualKeyCode:8});
   const cleared=await run('check');if(!cleared.cleared)return {status:'failed',detail:'Kick did not clear the old poll command. No new command was submitted.'};
  }
  const empty=await run('focus');if(!empty.ok)return {status:'failed',detail:empty.detail};
  // Kick's Lexical command state must receive the native typing sequence.
  // Bulk insertText can update its DOM without updating the submitted state.
  for(const char of '/poll'){
   const code=char==='/'?'Slash':'Key'+char.toUpperCase(),vk=char==='/'?191:char.toUpperCase().charCodeAt(0);
   await contents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyDown',key:char,code,text:char,unmodifiedText:char,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk});
   await contents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyUp',key:char,code,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk});
   await pause(30);
  }
  const focused=await run('focus-poll-command');if(!focused.ok)return {status:'failed',detail:focused.detail};
  await contents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});
  await contents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});
  await pause(100);
 }finally{await contents.debugger.sendCommand('Emulation.setFocusEmulationEnabled',{enabled:false}).catch(()=>{});}
 return {status:'submitted',detail:'Native poll command dispatched; waiting for the creator.'};
}

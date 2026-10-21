// Scoped to the exact poll shown in the dock. Never click generic page Delete controls.
export function nativeEndPoll(platform,poll,action='end'){
 const visible=e=>!!e&&!!e.getClientRects().length&&!e.closest('[hidden],[aria-hidden="true"]')&&getComputedStyle(e).visibility!=='hidden';
 const text=e=>e?.textContent?.trim()||'';
 let root;
 if(platform==='kick'){
  const title=[...document.querySelectorAll('#channel-chatroom [data-testid="poll-title"]')].find(e=>visible(e)&&text(e)===poll.question);
  root=title;for(let i=0;i<5&&root&&!root.querySelector('[data-testid="poll-option-list"]');i++)root=root.parentElement;
 }else{
  root=[...document.querySelectorAll('yt-live-chat-poll-renderer,yt-live-chat-banner-poll-renderer')].find(e=>visible(e)&&text(e.querySelector('#poll-question,#question'))===poll.question);
 }
 if(!root)return {ok:false,detail:'The matching native poll is not visible. Refresh its source before trying again.'};
 const buttons=[...root.querySelectorAll('button,[role="button"],yt-icon-button')].filter(visible);
 const name=e=>(e.getAttribute('aria-label')||e.getAttribute('title')||(e.getAttribute('aria-describedby')||'').split(' ').map(id=>text(document.getElementById(id))).join(' ').trim()||text(e)).trim();
 const finish=/^(?:End poll|End the poll|Finalize poll|Finalizar encuesta|Finalizar la encuesta|Terminar encuesta)$/i;
 if(platform==='kick'){
  const button=buttons.find(e=>e.matches('[data-testid="poll-delete-button"]'))||buttons.find(e=>/^(?:Delete|Delete poll|Remove poll|Eliminar|Eliminar encuesta)$/i.test(name(e))||e.querySelector('svg.lucide-trash,svg.lucide-trash-2,[data-lucide="trash-2"]'));
  if(!button)return {ok:false,detail:'Bubblecast could not find Kick’s Delete control on this poll. Refresh the source and try again.'};
  if(button.disabled||button.getAttribute('aria-disabled')==='true')return {ok:false,detail:'Kick has disabled the Delete control for this poll.'};
  if(action!=='inspect')button.click();return {ok:true,clicked:action!=='inspect'};
 }
 const end=buttons.find(e=>finish.test(name(e)));
 if(end){if(end.disabled||end.getAttribute('aria-disabled')==='true')return {ok:false,detail:'YouTube’s End poll button is disabled.'};if(action!=='inspect')end.click();return {ok:true,clicked:action!=='inspect'};}
 // The collapsed YouTube poll exposes the same action through its own menu.
 if(action==='menu'){
  const items=[...document.querySelectorAll('yt-live-chat-menu-service-item-renderer,[role="menuitem"]')].filter(visible).filter(e=>finish.test(text(e))||finish.test(e.getAttribute('aria-label')||''));
  if(items.length===1){items[0].click();return {ok:true,clicked:true};}return {ok:false,detail:'YouTube’s End poll menu item is unavailable.'};
 }
 const menu=buttons.find(e=>/more|menu|opciones|más|acciones/i.test(name(e))||e.closest('#menu'));
 if(!menu)return {ok:false,detail:'YouTube’s poll menu is unavailable. Expand the native poll and try again.'};
 if(action!=='inspect')menu.click();return {ok:true,opened:true};
}

export async function endNativePoll(contents,platform,poll,{send,pause=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 if(platform==='twitch')return send(contents,'twitch','/endpoll');
 const run=action=>contents.executeJavaScript('('+nativeEndPoll.toString()+')('+[platform,poll,action].map(v=>JSON.stringify(v)).join(',')+')');
 const result=await run('end');if(!result.opened)return result;
 await pause(180);return run('menu');
}

// YouTube removes its live poll before the capture observer's disappearance
// grace period expires. Confirm that native transition without clicking again.
export function nativePollEndState(poll){
 const roots=[...document.querySelectorAll('yt-live-chat-poll-renderer,yt-live-chat-banner-poll-renderer')];
 const matching=roots.find(e=>{const data=e.data||{},header=data.header?.pollHeaderRenderer||data.header||data;const question=e.querySelector('#poll-question,#question')?.textContent?.trim()||header.pollQuestion?.simpleText||header.pollQuestion?.runs?.map(r=>r.text||'').join('');return question===poll.question;});
 const ready=document.readyState==='complete'&&!!document.querySelector('yt-live-chat-renderer')&&!!document.querySelector('yt-live-chat-message-input-renderer');
 if(!matching)return {ready,absent:true,ended:false};
 const data=matching.data||{},header=data.header?.pollHeaderRenderer||data.header||data;
 const state=[header.liveChatPollType,data.status,matching.querySelector('#status')?.textContent,...[...matching.querySelectorAll('.metadata')].map(e=>e.textContent)].join(' ');
 return {ready,absent:false,ended:/\b(?:ENDED|CLOSED|COMPLETED)\b|poll ended|encuesta finalizada|encuesta terminada/i.test(state)};
}

export async function confirmPollEnded(contents,platform,poll,{getCurrent,onEnded=async()=>{},pause=ms=>new Promise(r=>setTimeout(r,ms)),attempts=48}={}){
 let absent=0;
 for(let i=0;i<attempts;i++){
  const current=await getCurrent();if(!current||current.id!==poll.id||current.status!=='active')return true;
  if(platform==='youtube'){
   const state=await contents.executeJavaScript('('+nativePollEndState.toString()+')('+JSON.stringify(poll)+')');
   absent=state.ready&&state.absent?absent+1:0;
   if(state.ready&&(state.ended||absent>=2)){await onEnded({...current,status:'completed'});return true;}
  }
  await pause(250);
 }
 return false;
}

export async function endSharedPoll(job,{end,confirm,now=Date.now}){
 return Object.fromEntries(await Promise.all(Object.keys(job.urls).map(async key=>{
  if(now()-job.createdAt>25000)return [key,{status:'failed',detail:'End-poll request expired. Nothing was changed.'}];
  try{const result=await end(key,job.urls[key],job.polls[key]);if(result?.ok===false||result?.status==='failed')return [key,{status:'failed',detail:result.detail}];return [key,await confirm(key,job.polls[key])?{status:'submitted',detail:'Poll ended on the platform.'}:{status:'unknown',detail:'End was requested once. The platform has not confirmed it; check before trying again.'}];}
  catch{return [key,{status:'unknown',detail:'Could not confirm the end action. Check the platform before trying again.'}];}
 })));
}

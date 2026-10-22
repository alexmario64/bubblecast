// Scoped to the exact poll shown in the dock. Never click generic page Delete controls.
export function nativeEndPoll(platform,poll,action='end'){
 const visible=e=>!!e&&!!e.getClientRects().length&&!e.closest('[hidden],[aria-hidden="true"]')&&getComputedStyle(e).visibility!=='hidden';
 const text=e=>e?.textContent?.trim()||'';
 const title=platform==='kick'?[...document.querySelectorAll('#channel-chatroom [data-testid="poll-title"]')].find(e=>visible(e)&&text(e)===poll.question):null;
 let root=title;for(let i=0;i<5&&root&&!root.querySelector('[data-testid="poll-option-list"]');i++)root=root.parentElement;
 if(!root)return {ok:false,detail:'The matching native poll is not visible. Refresh its source before trying again.'};
 const buttons=[...root.querySelectorAll('button,[role="button"]')].filter(visible);
 const name=e=>(e.getAttribute('aria-label')||e.getAttribute('title')||(e.getAttribute('aria-describedby')||'').split(' ').map(id=>text(document.getElementById(id))).join(' ').trim()||text(e)).trim();
 const button=buttons.find(e=>e.matches('[data-testid="poll-delete-button"]'))||buttons.find(e=>/^(?:Delete|Delete poll|Remove poll|Eliminar|Eliminar encuesta)$/i.test(name(e))||e.querySelector('svg.lucide-trash,svg.lucide-trash-2,[data-lucide="trash-2"]'));
 if(!button)return {ok:false,detail:'Bubblecast could not find Kick’s Delete control on this poll. Refresh the source and try again.'};
 if(button.disabled||button.getAttribute('aria-disabled')==='true')return {ok:false,detail:'Kick has disabled the Delete control for this poll.'};
 if(action!=='inspect')button.click();return {ok:true,clicked:action!=='inspect'};
}

export async function endNativePoll(contents,platform,poll){
 const run=action=>contents.executeJavaScript('('+nativeEndPoll.toString()+')('+[platform,poll,action].map(v=>JSON.stringify(v)).join(',')+')');
 return run('end');
}

export async function confirmPollEnded(contents,platform,poll,{getCurrent,onEnded=async()=>{},pause=ms=>new Promise(r=>setTimeout(r,ms)),attempts=48}={}){
 for(let i=0;i<attempts;i++){
  const current=await getCurrent();if(!current||current.id!==poll.id||current.status!=='active')return true;
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

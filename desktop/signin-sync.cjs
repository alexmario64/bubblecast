// Synchronize the shared persistent session while a sign-in window is open.
// Observe cookie metadata only. Never inspect or log credential values.
module.exports=function watchSignIn({session,refresh,setTimer=setTimeout,clearTimer=clearTimeout,delay=1200}){
 let timer=null,stopped=false;
 const schedule=()=>{if(stopped)return;clearTimer(timer);timer=setTimer(async()=>{timer=null;if(stopped)return;try{await session.cookies.flushStore();if(!stopped)await refresh();}catch{}},delay);};
 let authenticated=null;
 session.cookies.get({url:'https://kick.com',name:'session_token'}).then(cookies=>{if(!stopped&&authenticated===null)authenticated=cookies.length>0;}).catch(()=>{});
 const changed=(_event,cookie,cause,removed)=>{const domain=String(cookie?.domain||'').replace(/^\./,'');if((domain==='kick.com'||domain.endsWith('.kick.com'))&&cookie?.name==='session_token'&&cause!=='overwrite'){const present=!removed;if(authenticated!==present){authenticated=present;schedule();}}};
 session.cookies.on('changed',changed);
 return {schedule,stop(){stopped=true;clearTimer(timer);session.cookies.removeListener('changed',changed);}};
};

// Guide Kick page login and official OAuth through the same persistent helper session.
// Cookie values are never read, copied or logged. Only the presence of the login cookie matters.
module.exports=function connectKick({win,url,allowedSignInURL,onReady=()=>{},setTimer=setTimeout,clearTimer=clearTimeout}){
 const authorize=new URL(url),callback=new URL(authorize.searchParams.get('redirect_uri')||'');
 if(authorize.origin!=='https://id.kick.com'||authorize.pathname!=='/oauth/authorize'||callback.href!=='http://localhost:3927/oauth/kick/callback'||!authorize.searchParams.get('state'))throw Error('Invalid Kick authorization request.');
 const contents=win.webContents,ses=contents.session,state=authorize.searchParams.get('state');let phase='page',stopped=false;
 const isCallback=value=>{try{const u=new URL(value);return u.origin===callback.origin&&u.pathname===callback.pathname&&u.searchParams.get('state')===state;}catch{return false;}};
 const allowed=value=>allowedSignInURL(value,'kick')||isCallback(value);
 const stop=()=>{if(stopped)return;stopped=true;clearTimer(expiry);ses.cookies.removeListener('changed',changed);contents.removeListener('did-finish-load',loaded);};
 const navigate=async()=>{if(stopped||phase!=='page'||win.isDestroyed())return;const cookies=await ses.cookies.get({url:'https://kick.com',name:'session_token'});if(stopped||phase!=='page'||!cookies.length)return;phase='oauth';await ses.cookies.flushStore();await contents.loadURL(authorize.href);};
 const changed=(_event,cookie,_cause,removed)=>{const domain=String(cookie?.domain||'').replace(/^\./,'');if(!removed&&cookie?.name==='session_token'&&(domain==='kick.com'||domain.endsWith('.kick.com')))navigate().catch(()=>{});};
 const loaded=()=>{if(isCallback(contents.getURL())){phase='done';stop();onReady();}else if(phase==='page')navigate().catch(()=>{});};
 const expiry=setTimer(stop,600000);ses.cookies.on('changed',changed);contents.on('did-finish-load',loaded);win.once('closed',stop);
 return {allowed,stop,async start(){await contents.loadURL('https://kick.com/');await navigate();}};
};

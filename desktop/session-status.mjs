export function accountState(platform,cookies,composer={}){
 const names={twitch:['auth-token'],youtube:['LOGIN_INFO','SID','__Secure-1PSID','__Secure-3PSID'],tiktok:['sessionid','sessionid_ss'],kick:['session_token']}[platform]||[];
 const domains=platform==='youtube'?['youtube.com','google.com']:platform==='twitch'?['twitch.tv']:platform==='kick'?['kick.com']:['tiktok.com'];
 const signedIn=platform==='kick'&&composer.signedIn===false?false:composer.signedIn===true||cookies.some(cookie=>{const domain=String(cookie.domain||'').replace(/^\./,'');return names.includes(cookie.name)&&domains.some(d=>domain===d||domain.endsWith('.'+d));});
 const canSend=signedIn&&composer.state==='ready';
 return {state:canSend?'ready':signedIn?'unavailable':'signed-out',signedIn,canSend,detail:canSend?'Signed in and ready to send.':signedIn?'Account connected. Waiting for an available live chat.':'Reading chat without an account. Sign in only to send.'};
}

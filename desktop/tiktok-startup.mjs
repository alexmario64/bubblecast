import {accountState} from './session-status.mjs';

const sessions=new WeakMap();
const unknownSession=()=>({state:'unavailable',signedIn:null,canSend:false,detail:'TikTok session could not be checked yet.'});
// Read cookie metadata independently of the renderer. A stalled page must not hide a missing session.
// Keep only the account state, never cookie objects or values, on the source or in status reports.
export async function refreshTikTokSession(source,{timeoutMs=400}={}){
 if(source.platform!=='tiktok'||source.win.isDestroyed())return;
 let task=sessions.get(source);
 if(!task){task=Promise.resolve().then(()=>source.win.webContents.session.cookies.get({})).then(cookies=>{
  const metadata=cookies.map(({name,domain,value,session,expirationDate})=>({name,domain,present:!!value,session,expirationDate}));
  return accountState('tiktok',metadata);
 }).catch(unknownSession).then(state=>source.tiktokSession=state).finally(()=>sessions.delete(source));sessions.set(source,task);}
 let timer;try{return await Promise.race([task,new Promise(resolve=>{timer=setTimeout(()=>resolve(source.tiktokSession=unknownSession()),timeoutMs);})]);}finally{clearTimeout(timer);}
}
export function tikTokAccount(source,composer={}){
 const session=source.tiktokSession||unknownSession();
 return session.signedIn===null?session:accountState('tiktok',[],{...composer,signedIn:session.signedIn});
}

// Windows may defer the live room until its native window has been shown once. Activate it outside
// every connected display, without focus/taskbar presence, then return it to its original hidden bounds.
// Manage cancels this cleanup before showing the user's window, so a late timer cannot hide it.
export function warmTikTokWindow(source,screen,{setTimer=setTimeout,clearTimer=clearTimeout}={}){
 const win=source.win;
 if(source.platform!=='tiktok'||source.tiktokStartup||win.isDestroyed())return;
 source.tiktokStartup='painting';
 if(win.isVisible()){source.tiktokStartup='user-opened';return;}
 let bounds,restored=false,timer;
 const restore=()=>{if(restored)return;restored=true;clearTimer(timer);if(win.isDestroyed())return;win.hide();if(bounds)win.setBounds(bounds);win.setFocusable(true);};
 source.cancelTikTokWarmup=()=>{restore();if(source.tiktokStartup==='painting')source.tiktokStartup='user-opened';};
 win.once('closed',restore);
 try{
  bounds=win.getBounds();const displays=screen.getAllDisplays();if(!displays.length)throw Error('No display geometry');
  const right=Math.max(...displays.map(d=>d.bounds.x+d.bounds.width));
  win.setSkipTaskbar(true);win.setFocusable(false);win.setBounds({...bounds,x:right+128,y:Math.min(...displays.map(d=>d.bounds.y))});win.showInactive();
  timer=setTimer(()=>{try{restore();if(source.tiktokStartup==='painting')source.tiktokStartup='painted';}catch{source.tiktokStartup='failed';}},300);
 }catch{source.tiktokStartup='failed';try{restore();}catch{}}
}

// Signal only after the native receiver has established its history baseline.
export async function signalTikTokBaseline(source){
 if(source.platform!=='tiktok'||!source.capture?.feed.ready||source.pageBaselineNotified||source.win.isDestroyed())return;
 const actual=new URL(source.win.webContents.getURL()),expected=new URL(source.url);
 if(actual.origin!==expected.origin||actual.pathname!==expected.pathname)return;
 await source.win.webContents.executeJavaScript('window.__bubblecastTikTokBaselineReady=true;window.dispatchEvent(new Event("bubblecast-tiktok-baseline-ready"));');
 source.pageBaselineNotified=true;
}

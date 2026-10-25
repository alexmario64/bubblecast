// Exercise the actual Electron orchestration with inert windows; no Electron runtime or network.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {EventEmitter} from 'node:events';
import {readFile} from 'node:fs/promises';
import {warmTikTokWindow,refreshTikTokSession,tikTokAccount,signalTikTokBaseline} from '../desktop/tiktok-startup.mjs';
import {responsiveAccounts} from '../desktop/responsive-accounts.mjs';
import {accountState} from '../desktop/session-status.mjs';
const code=await readFile(new URL('../desktop/main.cjs',import.meta.url),'utf8');
function helper(){
 const instances=[],events=[],windows=new Map(),signins=new Map(),timers=[];
 class BrowserWindow extends EventEmitter{
  constructor(options){super();this.options=options;this.visible=!!options.show;this.bounds={x:10,y:10,width:900,height:900};this.webContents=new EventEmitter();Object.assign(this.webContents,{session:{cookies:{get:async()=>{events.push('cookies');return [];},flushStore:async()=>events.push('flush')}},setAudioMuted:v=>{this.muted=v;},setWindowOpenHandler(){},getURL:()=>this.url||'about:blank',executeJavaScript:async script=>{events.push(script);return {state:'unavailable'};},reload:()=>events.push('reload')});instances.push(this);}
  loadURL(url){events.push('load');this.url=url;return Promise.resolve();}isDestroyed(){return !!this.destroyed;}destroy(){this.destroyed=true;this.emit('closed');}getBounds(){return {...this.bounds};}setBounds(b){this.bounds=b;}setSkipTaskbar(){}setFocusable(){}isVisible(){return this.visible;}hide(){this.visible=false;}showInactive(){events.push('paint');this.visible=true;}isMinimized(){return false;}show(){this.visible=true;}focus(){events.push('focus');}
 }
 const context=vm.createContext({BrowserWindow,windows,signins,labels:{tiktok:'TikTok',kick:'Kick'},partitionFor:p=>'persist:bubblecast-'+p,join:(...p)=>p.join('/'),__dirname:'fixture',quitting:false,appIcon:'fixture',URL,Promise,
  screen:{getAllDisplays:()=>[{bounds:{x:0,y:0,width:1920,height:1080}}]},
  warmTikTokWindow:(source,screen)=>warmTikTokWindow(source,screen,{setTimer:fn=>{timers.push(fn);return timers.length;},clearTimer(){}}),refreshTikTokSession,tikTokAccount,signalTikTokBaseline,responsiveAccounts,accountState,
  scripts:{tiktokPlayer:'player-script',tiktok:'capture-script'},pageComposer:()=>({state:'unavailable'}),attachNetworkCapture:()=>({feed:{ready:false},diagnostics:{},stop:()=>events.push('stop')}),trayMenu(){},relayMessage(){},log(){return Promise.resolve();},allowedSignInURL:()=>true,abortedNavigation:()=>false,navigationCode:()=>0,
  session:{fromPartition:()=>({cookies:{flushStore:async()=>events.push('flush')}})}
 });
 for(const [start,end] of [['function showSource(','async function pollEditor('],['async function syncSources(','ipcMain.handle(']]){const a=code.indexOf(start),b=code.indexOf(end,a);assert.ok(a>=0&&b>a);vm.runInContext(code.slice(a,b),context);}
 return {context,windows,instances,events,timers,signins};
}
const config={configured:true,enabled:true,urls:{tiktok:'https://www.tiktok.com/@example/live'}};
test('source startup checks cookies before navigation, paints without Manage and never recreates an unchanged room',async()=>{
 const h=helper();await h.context.syncSources(config);const win=h.instances[0];assert.equal(win.options.paintWhenInitiallyHidden,true);assert.equal(win.options.webPreferences.backgroundThrottling,false);assert.equal(win.muted,true);assert.deepEqual(h.events,['cookies','load']);
 assert.equal(h.windows.get('tiktok').tiktokSession.signedIn,false);win.webContents.emit('did-finish-load');await new Promise(r=>setImmediate(r));assert.deepEqual(h.events.slice(2),['paint','player-script','capture-script']);assert.ok(!h.events.includes('focus'));h.timers[0]();assert.equal(win.visible,false);
 await h.context.syncSources(config);assert.equal(h.instances.length,1);assert.equal(h.events.filter(x=>x==='load').length,1);
 win.webContents.emit('did-finish-load');await new Promise(r=>setImmediate(r));assert.equal(h.events.filter(x=>x==='paint').length,1);assert.ok(!h.events.includes('reload'));
});
test('actual Manage handler cancels pending cleanup and leaves the window visible at its original bounds',async()=>{
 const h=helper();await h.context.syncSources(config);const win=h.instances[0];win.webContents.emit('did-finish-load');await new Promise(r=>setImmediate(r));h.context.showSource('tiktok');h.timers[0]();assert.equal(win.visible,true);assert.equal(win.bounds.x,10);assert.ok(h.events.includes('focus'));
});
test('account heartbeat reports a missing TikTok session even if the native baseline renderer hangs',async()=>{
 const h=helper();await h.context.syncSources(config);const source=h.windows.get('tiktok');source.capture.feed.ready=true;source.win.webContents.executeJavaScript=()=>new Promise(()=>{});
 // Use the production fallback with a short fixture deadline.
 h.context.responsiveAccounts=(entries,inspect,options)=>responsiveAccounts(entries,inspect,{...options,timeoutMs:5});const state=await h.context.accountStates();assert.equal(state.tiktok.signedIn,false);assert.equal(state.tiktok.state,'signed-out');
});
test('closing TikTok sign-in or its child preserves the active room and startup baseline without reload',async()=>{
 const h=helper();await h.context.syncSources(config);const source=h.windows.get('tiktok');source.pageBaselineNotified=true;h.context.signIn('tiktok');const signin=h.signins.get('tiktok'),child=new EventEmitter();child.webContents=new EventEmitter();child.webContents.setWindowOpenHandler=()=>{};signin.webContents.emit('did-create-window',child);child.emit('closed');signin.emit('closed');await new Promise(r=>setImmediate(r));assert.ok(!h.events.includes('reload'));assert.ok(h.events.includes('flush'));assert.equal(source.pageBaselineNotified,true);assert.equal(h.windows.get('tiktok'),source);
});
test('disconnect destroys the source and pending warmup cannot touch or recreate it',async()=>{
 const h=helper();await h.context.syncSources(config);h.instances[0].webContents.emit('did-finish-load');await new Promise(r=>setImmediate(r));await h.context.syncSources({configured:true,enabled:false});const count=h.events.length;h.timers[0]();assert.equal(h.instances[0].destroyed,true);assert.equal(h.windows.size,0);assert.equal(h.events.length,count);assert.ok(h.events.includes('stop'));
});

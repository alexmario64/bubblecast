import {test} from 'node:test';
import assert from 'node:assert/strict';
import {signalTikTokBaseline} from '../desktop/tiktok-startup.mjs';
const fixture=()=>{const scripts=[];return {scripts,source:{platform:'tiktok',url:'https://www.tiktok.com/@example/live',capture:{feed:{ready:false}},win:{isDestroyed:()=>false,webContents:{getURL:()=> 'https://www.tiktok.com/@example/live',executeJavaScript:async script=>scripts.push(script)}}}};};
test('TikTok page reader is signaled once per native baseline and again after navigation reset',async()=>{const {source,scripts}=fixture();await signalTikTokBaseline(source);assert.equal(scripts.length,0);source.capture.feed.ready=true;await signalTikTokBaseline(source);await signalTikTokBaseline(source);assert.equal(scripts.length,1);source.pageBaselineNotified=false;await signalTikTokBaseline(source);assert.equal(scripts.length,2);});
test('TikTok signal cannot run on another platform or a redirected sign-in page',async()=>{const {source,scripts}=fixture();source.capture.feed.ready=true;source.win.webContents.getURL=()=> 'https://www.tiktok.com/login';await signalTikTokBaseline(source);source.platform='youtube';source.win.webContents.getURL=()=>source.url;await signalTikTokBaseline(source);assert.equal(scripts.length,0);});

import {EventEmitter} from 'node:events';
import {warmTikTokWindow,refreshTikTokSession,tikTokAccount} from '../desktop/tiktok-startup.mjs';
import {responsiveAccounts} from '../desktop/responsive-accounts.mjs';
function nativeWindow(){
 const win=new EventEmitter(),events=[],original={x:-1200,y:40,width:900,height:900};let bounds={...original},visible=false,destroyed=false;
 Object.assign(win,{isDestroyed:()=>destroyed,isVisible:()=>visible,getBounds:()=>({...bounds}),setBounds:b=>{bounds={...b};events.push(['bounds',b]);},setSkipTaskbar:v=>events.push(['taskbar',v]),setFocusable:v=>events.push(['focusable',v]),showInactive:()=>{visible=true;events.push(['showInactive']);},hide:()=>{visible=false;events.push(['hide']);},destroy:()=>{destroyed=true;win.emit('closed');}});
 let timer;const source={platform:'tiktok',win},screen={getAllDisplays:()=>[{bounds:{x:-1920,y:0,width:1920,height:1080}},{bounds:{x:0,y:-100,width:3840,height:2160}}]},clock={setTimer:fn=>{timer=fn;return 1;},clearTimer:()=>{}};
 return {win,source,screen,clock,events,original,fire:()=>timer?.()};
}
test('TikTok paints off-screen once without focus, taskbar presence, navigation or a Manage click',()=>{
 const f=nativeWindow();warmTikTokWindow(f.source,f.screen,f.clock);
 assert.equal(f.win.isVisible(),true);assert.ok(f.win.getBounds().x>3840);assert.equal(f.source.tiktokStartup,'painting');
 assert.deepEqual(f.events.slice(0,2),[['taskbar',true],['focusable',false]]);
 f.fire();assert.equal(f.win.isVisible(),false);assert.deepEqual(f.win.getBounds(),f.original);assert.equal(f.source.tiktokStartup,'painted');
 const count=f.events.length;warmTikTokWindow(f.source,f.screen,f.clock);assert.equal(f.events.length,count);
});
test('Manage during warmup restores bounds before showing and cannot be hidden by a late callback',()=>{
 const f=nativeWindow();warmTikTokWindow(f.source,f.screen,f.clock);f.source.cancelTikTokWarmup();assert.deepEqual(f.win.getBounds(),f.original);f.win.showInactive();
 const count=f.events.length;f.fire();assert.equal(f.win.isVisible(),true);assert.equal(f.events.length,count);assert.equal(f.source.tiktokStartup,'user-opened');
});
test('a window already opened by the user is never moved or hidden by warmup',()=>{
 const f=nativeWindow();f.win.showInactive();const count=f.events.length;warmTikTokWindow(f.source,f.screen,f.clock);assert.equal(f.events.length,count);assert.equal(f.source.tiktokStartup,'user-opened');
});
test('window destruction, another platform and repeated loads cannot leave a warmup timer acting on a dead window',()=>{
 const f=nativeWindow();warmTikTokWindow(f.source,f.screen,f.clock);f.win.destroy();const count=f.events.length;f.fire();assert.equal(f.events.length,count);
 const other=nativeWindow();other.source.platform='kick';warmTikTokWindow(other.source,other.screen,other.clock);assert.equal(other.events.length,0);
});
test('activation failure restores the hidden window and reports a finite failure without retrying',()=>{
 const f=nativeWindow();f.win.showInactive=()=>{throw Error('fixture startup failure');};warmTikTokWindow(f.source,f.screen,f.clock);
 assert.equal(f.source.tiktokStartup,'failed');assert.deepEqual(f.win.getBounds(),f.original);assert.equal(f.win.isVisible(),false);const count=f.events.length;warmTikTokWindow(f.source,f.screen,f.clock);assert.equal(f.events.length,count);
});
const cookie=()=>({name:'sessionid',domain:'.tiktok.com',value:'fixture-private-value',session:true});
function sessionSource(get){return {platform:'tiktok',win:{isDestroyed:()=>false,webContents:{session:{cookies:{get}}}}};}
test('missing TikTok session is known before page inspection and cannot be overridden by an unsigned editor',async()=>{
 const source=sessionSource(async()=>[]);await refreshTikTokSession(source);assert.equal(tikTokAccount(source,{state:'ready',signedIn:true}).signedIn,false);assert.equal(tikTokAccount(source,{state:'ready'}).canSend,false);
});
test('TikTok cookie metadata accepts both session names and valid domains without exposing values',async()=>{
 for(const name of ['sessionid','sessionid_ss']){const source=sessionSource(async()=>[{...cookie(),name,domain:'www.tiktok.com'}]);await refreshTikTokSession(source);assert.equal(tikTokAccount(source).signedIn,true);assert.equal(tikTokAccount(source,{state:'ready'}).canSend,true);assert.ok(!JSON.stringify(source.tiktokSession).includes('fixture-private-value'));}
});
test('empty, expired, unrelated and lookalike-domain cookies never count as a TikTok session',async()=>{
 for(const c of [{...cookie(),value:''},{...cookie(),session:false,expirationDate:Date.now()/1000-1},{...cookie(),domain:'tiktok.com.attacker.invalid'},{...cookie(),name:'other'}]){const source=sessionSource(async()=>[c]);await refreshTikTokSession(source);assert.equal(source.tiktokSession.signedIn,false);}
 const source=sessionSource(async()=>[{...cookie(),session:false,expirationDate:Date.now()/1000+600}]);await refreshTikTokSession(source);assert.equal(source.tiktokSession.signedIn,true);
});
test('cookie deletion and later sign-in update status without any page navigation',async()=>{
 let cookies=[cookie()];const source=sessionSource(async()=>cookies);await refreshTikTokSession(source);assert.equal(source.tiktokSession.signedIn,true);cookies=[];await refreshTikTokSession(source);assert.equal(source.tiktokSession.signedIn,false);cookies=[cookie()];await refreshTikTokSession(source);assert.equal(source.tiktokSession.signedIn,true);
});
test('cookie read failures stay unknown and recover rather than reporting a false missing session',async()=>{
 let fail=true;const source=sessionSource(async()=>{if(fail)throw Error('private failure');return [];});await refreshTikTokSession(source);assert.equal(source.tiktokSession.signedIn,null);assert.ok(!JSON.stringify(source.tiktokSession).includes('private failure'));fail=false;await refreshTikTokSession(source);assert.equal(source.tiktokSession.signedIn,false);
});
test('a hung cookie query is bounded and single-flight, with a late result still usable',async()=>{
 let finish,calls=0;const source=sessionSource(()=>{calls++;return new Promise(r=>{finish=r;});});
 await refreshTikTokSession(source,{timeoutMs:5});await refreshTikTokSession(source,{timeoutMs:5});assert.equal(calls,1);assert.equal(source.tiktokSession.signedIn,null);finish([cookie()]);await new Promise(r=>setImmediate(r));assert.equal(source.tiktokSession.signedIn,true);
});
test('a stalled renderer uses current cookie state rather than a stale signed-in inspection',async()=>{
 const source=sessionSource(async()=>[]);await refreshTikTokSession(source);const options={timeoutMs:5,fallback:s=>tikTokAccount(s)};
 const result=await responsiveAccounts([['tiktok',source]],()=>new Promise(()=>{}),options);assert.equal(result.tiktok.signedIn,false);assert.equal(result.tiktok.canSend,false);
 source.tiktokSession={state:'unavailable',signedIn:true,canSend:false};const updated=await responsiveAccounts([['tiktok',source]],()=>assert.fail('overlapping inspection'),options);assert.equal(updated.tiktok.signedIn,true);assert.equal(updated.tiktok.canSend,false);
});
test('renderer inspection failure also retains independently checked missing-session state',async()=>{
 const source=sessionSource(async()=>[]);await refreshTikTokSession(source);const result=await responsiveAccounts([['tiktok',source]],()=>{throw Error('renderer gone');},{fallback:s=>tikTokAccount(s)});assert.equal(result.tiktok.signedIn,false);
});

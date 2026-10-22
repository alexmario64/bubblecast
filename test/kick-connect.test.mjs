import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
import {allowedSignInURL} from '../desktop/auth-navigation.mjs';
const connectKick=createRequire(import.meta.url)('../desktop/kick-connect.cjs');
const auth='https://id.kick.com/oauth/authorize?client_id=fixture&state=expected&redirect_uri='+encodeURIComponent('http://localhost:3927/oauth/kick/callback');
function fixture(signedIn=false){
 const cookies=new EventEmitter(),contents=new EventEmitter(),win=new EventEmitter(),loads=[],timers=[];let ready=0,flushes=0,current='';
 cookies.get=async()=>signedIn?[{name:'session_token',domain:'.kick.com'}]:[];cookies.flushStore=async()=>{flushes++;};
 contents.session={cookies};contents.getURL=()=>current;contents.loadURL=async url=>{loads.push(url);current=url;};win.webContents=contents;win.isDestroyed=()=>false;
 const flow=connectKick({win,url:auth,allowedSignInURL,onReady:()=>ready++,setTimer:fn=>{const h={fn};timers.push(h);return h;},clearTimer:h=>{h.cancelled=true;}});
 return {flow,win,contents,cookies,loads,timers,get ready(){return ready;},get flushes(){return flushes;},login(){signedIn=true;cookies.emit('changed',{}, {name:'session_token',domain:'.kick.com'},'explicit',false);},setURL:url=>{current=url;}};
}
const flush=async()=>{await new Promise(resolve=>setImmediate(resolve));};
test('Kick connects its page and OAuth in one window using the existing session',async()=>{
 const f=fixture(true);await f.flow.start();assert.deepEqual(f.loads,['https://kick.com/',auth]);assert.equal(f.flushes,1);
 f.setURL('http://localhost:3927/oauth/kick/callback?state=expected&code=fixture');f.contents.emit('did-finish-load');assert.equal(f.ready,1);assert.equal(f.cookies.listenerCount('changed'),0);assert.equal(f.timers[0].cancelled,true);
});
test('Kick waits for page login and starts authorization once without replaying it',async()=>{
 const f=fixture();await f.flow.start();assert.deepEqual(f.loads,['https://kick.com/']);
 f.cookies.emit('changed',{}, {name:'session_token',domain:'evil.test'},'explicit',false);await flush();assert.equal(f.loads.length,1);
 f.login();f.login();await flush();assert.deepEqual(f.loads,['https://kick.com/',auth]);assert.equal(f.flushes,1);f.flow.stop();
});
test('only this OAuth attempt may navigate to the local callback',()=>{
 const f=fixture();assert.equal(f.flow.allowed('https://id.kick.com/oauth/authorize'),true);assert.equal(f.flow.allowed('http://localhost:3927/oauth/kick/callback?state=expected&code=fixture'),true);
 for(const url of ['http://localhost:3927/api/pair?state=expected','http://localhost:3927/oauth/kick/callback?state=wrong','http://localhost:3928/oauth/kick/callback?state=expected','https://kick.com.evil.test','http://kick.com/'])assert.equal(f.flow.allowed(url),false,url);
 f.setURL('http://localhost:3927/oauth/kick/callback?state=wrong');f.contents.emit('did-finish-load');assert.equal(f.ready,0);f.flow.stop();
});
test('closing or expiring a Kick connection prevents later cookie changes from opening OAuth',async()=>{
 for(const close of [f=>f.win.emit('closed'),f=>f.timers[0].fn()]){const f=fixture();await f.flow.start();close(f);f.login();await flush();assert.equal(f.loads.length,1);assert.equal(f.cookies.listenerCount('changed'),0);}
});
test('Kick helper refuses an unrelated authorization server or callback before opening pages',()=>{
 const f=fixture();for(const url of ['https://evil.test/oauth/authorize?redirect_uri=http://localhost:3927/oauth/kick/callback',auth.replace('state=expected','state='),auth.replace(encodeURIComponent('http://localhost:3927/oauth/kick/callback'),encodeURIComponent('http://evil.test/callback'))])assert.throws(()=>connectKick({win:f.win,url,allowedSignInURL}),/Invalid Kick/);f.flow.stop();
});

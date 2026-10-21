import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import watchSignIn from '../desktop/signin-sync.cjs';
test('Kick sign-in session refreshes capture before the window closes and debounces cookie updates',async()=>{
 const cookies=new EventEmitter();let flushed=0,refreshed=0,pending;cookies.flushStore=async()=>flushed++;cookies.get=async()=>[];
 const watch=watchSignIn({session:{cookies},refresh:async()=>refreshed++,setTimer:fn=>(pending=fn),clearTimer:()=>{pending=null;}});
 cookies.emit('changed',{}, {name:'guest',domain:'.unrelated.com'});cookies.emit('changed',{}, {name:'analytics',domain:'.kick.com'});assert.equal(pending,undefined);
 cookies.emit('changed',{}, {name:'session_token',domain:'kick.com'});cookies.emit('changed',{}, {name:'session_token',domain:'kick.com'});
 await pending();assert.equal(flushed,1);assert.equal(refreshed,1);pending=null;cookies.emit('changed',{}, {name:'kick_session',domain:'.kick.com'});cookies.emit('changed',{}, {name:'session_token',domain:'.kick.com'});assert.equal(pending,null);watch.stop();assert.equal(cookies.listenerCount('changed'),0);
});
test('closing sign-in cancels pending refresh without disrupting source capture',async()=>{
 const cookies=new EventEmitter();let pending,refreshed=0;cookies.flushStore=async()=>{};cookies.get=async()=>[];
 const watch=watchSignIn({session:{cookies},refresh:async()=>refreshed++,setTimer:fn=>(pending=fn),clearTimer:()=>{}});
 watch.schedule();watch.stop();await pending();assert.equal(refreshed,0);
});

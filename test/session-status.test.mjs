import {test} from 'node:test';
import assert from 'node:assert/strict';
import {accountState} from '../desktop/session-status.mjs';
test('signed-in account remains signed in while stream chat is unavailable',()=>{const result=accountState('youtube',[{name:'SID',domain:'.google.com'}],{state:'unavailable'});assert.equal(result.signedIn,true);assert.equal(result.canSend,false);assert.equal(result.state,'unavailable');});
test('authenticated session and ready composer enable sending',()=>{assert.equal(accountState('twitch',[{name:'auth-token',domain:'.twitch.tv'}],{state:'ready'}).canSend,true);assert.equal(accountState('youtube',[],{state:'ready',signedIn:true}).canSend,true);});
test('unrelated cookies or unsigned editors do not become connected accounts',()=>{assert.equal(accountState('twitch',[],{state:'ready'}).signedIn,false);assert.equal(accountState('youtube',[{name:'SID',domain:'.evilgoogle.com'}],{state:'ready'}).signedIn,false);});

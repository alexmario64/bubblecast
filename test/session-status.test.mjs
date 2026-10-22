import {test} from 'node:test';
import assert from 'node:assert/strict';
import {accountState} from '../desktop/session-status.mjs';
test('signed-in account remains signed in while stream chat is unavailable',()=>{const result=accountState('kick',[{name:'session_token',domain:'.kick.com'}],{state:'unavailable'});assert.equal(result.signedIn,true);assert.equal(result.canSend,false);assert.equal(result.state,'unavailable');});
test('authenticated session and ready composer enable sending',()=>{assert.equal(accountState('tiktok',[{name:'sessionid',domain:'.tiktok.com'}],{state:'ready'}).canSend,true);assert.equal(accountState('kick',[],{state:'ready',signedIn:true}).canSend,true);});
test('unrelated cookies or unsigned editors do not become connected accounts',()=>{assert.equal(accountState('twitch',[],{state:'ready'}).signedIn,false);assert.equal(accountState('youtube',[{name:'SID',domain:'.evilgoogle.com'}],{state:'ready'}).signedIn,false);});

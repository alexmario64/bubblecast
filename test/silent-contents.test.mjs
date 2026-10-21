import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {silenceContents} from '../desktop/silent-contents.cjs';
import {abortedNavigation,navigationCode} from '../desktop/navigation-errors.mjs';
class Contents extends EventEmitter{setAudioMuted(value){this.muted=value;this.calls=(this.calls||0)+1;}isDestroyed(){return !!this.destroyed;}}
test('all app contents are muted immediately and again after navigation or media playback',()=>{const c=new Contents();silenceContents(c);assert.equal(c.muted,true);for(const event of ['did-start-loading','did-start-navigation','media-started-playing']){c.muted=false;c.emit(event);assert.equal(c.muted,true);}c.muted=false;c.emit('audio-state-changed',{}, {audible:true});assert.equal(c.muted,true);});
test('sign-in popups inherit silence and duplicate global hooks do not multiply listeners',()=>{const parent=new Contents(),child=new Contents();silenceContents(parent);parent.emit('did-create-window',{webContents:child});assert.equal(child.muted,true);const listeners=child.listenerCount('media-started-playing');silenceContents(child);assert.equal(child.listenerCount('media-started-playing'),listeners);child.destroyed=true;const calls=child.calls;child.emit('media-started-playing');assert.equal(child.calls,calls);});
test('normal navigation replacement is not treated as a sign-in failure',()=>{assert.equal(abortedNavigation({errno:-3}),true);assert.equal(abortedNavigation(new Error('ERR_ABORTED (-3) loading a replaced page')),true);assert.equal(abortedNavigation({code:'ERR_CONNECTION_REFUSED'}),false);assert.equal(navigationCode({code:'ERR_CONNECTION_REFUSED'}),'ERR_CONNECTION_REFUSED');});

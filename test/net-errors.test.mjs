import {test} from 'node:test';
import assert from 'node:assert/strict';
import {errorText} from '../net-errors.mjs';
test('network failures name the platform and say Bubblecast keeps retrying; other messages pass through',()=>{
 assert.equal(errorText(new TypeError('fetch failed'),'Kick'),'Could not reach Kick. Check your internet connection; Bubblecast keeps retrying.');
 const timeout=new DOMException('The operation was aborted due to timeout','TimeoutError');assert.equal(errorText(timeout,'YouTube'),'YouTube did not answer in time. Bubblecast keeps retrying.');
 assert.equal(errorText(Error('The YouTube API daily quota is used up.'),'YouTube'),'The YouTube API daily quota is used up.');assert.equal(errorText('plain','Twitch'),'plain');
});

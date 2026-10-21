import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {readFile} from 'node:fs/promises';
const code=await readFile(new URL('../../desktop/tiktok-player.js',import.meta.url),'utf8');
test('background TikTok player starts existing and newly mounted video silently, once',async t=>{const w=new Window();t.after(()=>w.happyDOM.abort());let plays=0;w.HTMLVideoElement.prototype.play=function(){assert.equal(this.muted,true);plays++;return Promise.resolve();};w.document.body.innerHTML='<video></video>';w.eval(code);w.eval(code);assert.equal(plays,1);w.document.body.insertAdjacentHTML('beforeend','<video></video>');await new Promise(r=>setTimeout(r,20));assert.equal(plays,2);for(const video of w.document.querySelectorAll('video')){assert.equal(video.muted,true);assert.equal(video.autoplay,true);}});

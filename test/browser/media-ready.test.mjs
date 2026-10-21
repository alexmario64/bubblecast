import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {prepareMedia,patchElement} from '../../public/render-patch.mjs';
const tick=()=>new Promise(setImmediate);
test('a GIF remains concealed through partial load until its first frame is decoded',async t=>{
 const w=new Window();t.after(()=>w.happyDOM.abort());const img=w.document.createElement('img');let finish;img.decode=()=>new Promise(resolve=>finish=resolve);prepareMedia(img);img.src='https://media.giphy.com/a.webp';w.document.body.append(img);
 assert.ok(img.hasAttribute('data-media-loading'));img.dispatchEvent(new w.Event('load'));assert.ok(img.hasAttribute('data-media-loading'));finish();await tick();assert.equal(img.hasAttribute('data-media-loading'),false);
});
test('ready GIFs never become hidden again during late badge/color updates',async t=>{
 const w=new Window();t.after(()=>w.happyDOM.abort());const body=w.document.createElement('div'),img=prepareMedia(w.document.createElement('img'));img.src='https://media.giphy.com/a.webp';img.decode=async()=>{};body.append(img);w.document.body.append(body);img.dispatchEvent(new w.Event('load'));await tick();const desired=w.document.createElement('div'),replacement=prepareMedia(w.document.createElement('img'));replacement.src=img.src;desired.append(replacement);patchElement(body,desired);assert.equal(body.firstChild,img);assert.equal(img.hasAttribute('data-media-loading'),false);
});
test('an in-flight GIF keeps its loading state and original decode listener during updates',async t=>{
 const w=new Window();t.after(()=>w.happyDOM.abort());const body=w.document.createElement('div'),img=prepareMedia(w.document.createElement('img'));img.src='https://media.giphy.com/a.webp';img.decode=async()=>{};body.append(img);const desired=body.cloneNode(true);desired.firstChild.removeAttribute('data-media-loading');patchElement(body,desired);assert.ok(img.hasAttribute('data-media-loading'));img.dispatchEvent(new w.Event('load'));await tick();assert.equal(img.hasAttribute('data-media-loading'),false);
});
test('video waits for decoded data and does not appear on metadata alone',async t=>{
 const w=new Window();t.after(()=>w.happyDOM.abort());const video=prepareMedia(w.document.createElement('video'));video.dispatchEvent(new w.Event('loadedmetadata'));assert.ok(video.hasAttribute('data-media-loading'));video.dispatchEvent(new w.Event('loadeddata'));assert.equal(video.hasAttribute('data-media-loading'),false);
});
test('a browser decode rejection after successful load cannot leave the media hidden forever',async t=>{
 const w=new Window();t.after(()=>w.happyDOM.abort());const img=prepareMedia(w.document.createElement('img'));img.decode=async()=>{throw Error('decode unsupported');};img.dispatchEvent(new w.Event('load'));await tick();assert.equal(img.hasAttribute('data-media-loading'),false);
});

test('the captured Giphy format switch never replaces, hides, or writes src on the playing GIF',async t=>{
 const w=new Window();t.after(()=>w.happyDOM.abort());const body=w.document.createElement('div'),gif=prepareMedia(w.document.createElement('img'));gif.src='https://media3.giphy.com/media/OZ1VAPExqf1G40bBAt/giphy.gif?cid=one&rid=giphy.gif';gif.decode=async()=>{};body.append(gif);w.document.body.append(body);gif.dispatchEvent(new w.Event('load'));await tick();
 const desired=w.document.createElement('div'),webp=prepareMedia(w.document.createElement('img'));webp.src='https://media0.giphy.com/media/OZ1VAPExqf1G40bBAt/giphy.webp?cid=two&rid=giphy.webp';desired.append(webp);let writes=0;const set=gif.setAttribute.bind(gif);gif.setAttribute=(name,value)=>{if(name==='src')writes++;set(name,value);};
 patchElement(body,desired);assert.equal(body.firstChild,gif);assert.equal(writes,0);assert.equal(gif.hasAttribute('data-media-loading'),false);assert.ok(gif.src.includes('giphy.gif'));
});
test('unrelated GIFs and static previews remain different media',async()=>{
 const {sameMediaSource}=await import('../../core.mjs');const gif='https://media3.giphy.com/media/SameID/giphy.gif';
 assert.equal(sameMediaSource(gif,gif.replace('SameID','OtherID')),false);
 assert.equal(sameMediaSource(gif,gif.replace('giphy.gif','giphy_s.gif')),false);
 assert.equal(sameMediaSource(gif,gif.replace('giphy.com','giphy.com.evil.test')),false);
 assert.equal(sameMediaSource(gif,gif.replace('https:','http:')),false);
 assert.equal(sameMediaSource('https://cdn.betterttv.net/a.gif','https://cdn.betterttv.net/a.webp'),false);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isolatedServer} from './server-fixture.mjs';
process.env.BUBBLECAST_TIKTOK_RELOAD_MS='150';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function setup(t){
 const server=await isolatedServer(t),{token}=await(await server.request('/api/pair')).json();
 const post=async(path,body)=>{const r=await server.request(path,{method:'POST',headers:{'content-type':'application/json','x-bubblecast-token':token},body:JSON.stringify(body)});assert.equal(r.status,200,path);return r.json();};
 const commands=async()=>(await(await server.request('/api/collector/commands',{headers:{'x-bubblecast-token':token}})).json()).commands;
 await post('/api/sources',{tiktokChannel:'samplestreamer'});await post('/api/collector/status',{active:true});await commands();
 return {post,commands};
}
test('a TikTok page opened while offline is reloaded once after the stream starts',async t=>{
 const {post,commands}=await setup(t);
 await post('/api/obs/streaming',{streaming:true});assert.deepEqual(await commands(),[],'not at the instant OBS starts');
 await wait(400);assert.deepEqual(await commands(),[{action:'refresh',sourceKey:'tiktok'}]);
 await post('/api/obs/streaming',{streaming:true});await wait(400);assert.deepEqual(await commands(),[],'repeated status reports never reload again');
});
test('TikTok chat that is already arriving is never reloaded',async t=>{
 const {post,commands}=await setup(t);
 await post('/api/bridge',{platform:'tiktok',sourceKey:'tiktok',transport:'desktop',id:'tt-1',user:'Viewer',parts:[{type:'text',text:'hola'}]});
 await post('/api/obs/streaming',{streaming:true});await wait(400);assert.deepEqual(await commands(),[]);
});
test('stopping the stream before the delay cancels the reload',async t=>{
 const {post,commands}=await setup(t);
 await post('/api/obs/streaming',{streaming:true});await post('/api/obs/streaming',{streaming:false});await wait(400);assert.deepEqual(await commands(),[]);
});

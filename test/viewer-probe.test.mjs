import {test} from 'node:test';
import assert from 'node:assert/strict';
import {viewerProbe} from '../desktop/viewer-probe.mjs';
// Runs the page-side probe with a fake page location and network.
async function probe(platform,href,respond,ytcfg){const saved={location:globalThis.location,window:globalThis.window,fetch:globalThis.fetch},calls=[];globalThis.location=new URL(href);globalThis.window={ytcfg};globalThis.fetch=async(url,options)=>{calls.push([String(url),options]);return {json:async()=>respond(String(url),options)};};try{return {result:await viewerProbe(platform),calls};}finally{Object.assign(globalThis,saved);}}
test('YouTube reads "watching now" for live streams and treats lifetime views as offline',async()=>{const cfg={get:k=>({INNERTUBE_API_KEY:'key',INNERTUBE_CONTEXT:{client:{}}})[k]};const entity=e=>()=>({frameworkUpdates:{entityBatchUpdate:{mutations:[{payload:{viewCountEntity:e}}]}}});
 const live=await probe('youtube','https://www.youtube.com/live_chat?v=abc',entity({viewCount:{runs:[{text:'5,670'},{text:' personas mirando ahora'}]}}),cfg);assert.deepEqual(live.result,{live:true,viewers:5670});assert.equal(JSON.parse(live.calls[0][1].body).videoId,'abc');
 assert.deepEqual((await probe('youtube','https://www.youtube.com/live_chat?v=abc',entity({viewCount:{simpleText:'651,847,112 views'},viewCountNumber:'651847112'}),cfg)).result,{live:false,viewers:null});
 assert.deepEqual((await probe('youtube','https://www.youtube.com/live_chat?v=abc',()=>({actions:[{updateViewershipAction:{viewCount:{videoViewCountRenderer:{originalViewCount:'1234',isLive:true}}}}]}),cfg)).result,{live:true,viewers:1234});
 assert.equal((await probe('youtube','https://www.youtube.com/live_chat?v=abc',()=>({}),undefined)).result.live,null);});
test('Kick and TikTok read their channel room data and report offline channels',async()=>{
 const kick=await probe('kick','https://kick.com/somechannel',()=>({livestream:{viewer_count:85142}}));assert.deepEqual(kick.result,{live:true,viewers:85142});assert.match(kick.calls[0][0],/\/api\/v2\/channels\/somechannel$/);
 assert.deepEqual((await probe('kick','https://kick.com/somechannel',()=>({livestream:null}))).result,{live:false,viewers:null});
 const tiktok=await probe('tiktok','https://www.tiktok.com/@creator/live',()=>({data:{user:{status:2},liveRoom:{status:2,liveRoomStats:{userCount:1520}}}}));assert.deepEqual(tiktok.result,{live:true,viewers:1520});assert.match(tiktok.calls[0][0],/uniqueId=creator/);
 assert.deepEqual((await probe('tiktok','https://www.tiktok.com/@creator/live',()=>({data:{user:{status:4},liveRoom:{status:4,liveRoomStats:{userCount:1}}}}))).result,{live:false,viewers:null});
 const failed=await probe('kick','https://kick.com/somechannel',()=>{throw Error('blocked');});assert.equal(failed.result.live,null);assert.match(failed.result.error,/blocked/);});

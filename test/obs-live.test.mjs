import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reportObsStreaming} from '../public/obs-live.mjs';
const settle=async()=>{for(let i=0;i<10;i++)await new Promise(r=>setImmediate(r));};
test('pages inside OBS report its streaming state; pages outside OBS report nothing',async()=>{
 const sent=[],target=new EventTarget();let streaming=false,check;
 const fetcher=async(url,options)=>{if(url==='/api/pair')return {json:async()=>({token:'t'})};sent.push({url,token:options.headers['X-Bubblecast-Token'],...JSON.parse(options.body)});return {status:200};};
 assert.equal(reportObsStreaming({obs:undefined,target,fetcher}),false);
 assert.equal(reportObsStreaming({obs:{getStatus:cb=>cb({streaming})},target,fetcher,repeat:fn=>{check=fn;}}),true);await settle();
 streaming=true;check();await settle();target.dispatchEvent(new Event('obsStreamingStopped'));await settle();
 assert.deepEqual(sent,[{url:'/api/obs/streaming',token:'t',streaming:false},{url:'/api/obs/streaming',token:'t',streaming:true},{url:'/api/obs/streaming',token:'t',streaming:false}]);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setupObs,obsStreams} from '../obs.mjs';
const config={server_enabled:true,server_port:4455,auth_required:true,server_password:'local-test'};
function fixture({existing=false,streaming=false,vertical=null,serviceKey='',serviceFailure=false}={}){const calls=[];class Socket extends EventTarget{
 constructor(){super();queueMicrotask(()=>this.receive({op:0,d:{rpcVersion:1,authentication:{salt:'salt',challenge:'challenge'}}}));}
 receive(m){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(m)}));}
 send(raw){const m=JSON.parse(raw);calls.push(m);if(m.op===1)return queueMicrotask(()=>this.receive({op:2,d:{}}));const t=m.d.requestType;let response={};if(t==='GetStreamStatus')response={outputActive:streaming};if(t==='CallVendorRequest')response={responseData:vertical===null?{}:{streaming:vertical}};if(t==='GetStreamServiceSettings')response={streamServiceSettings:{key:serviceKey}};if(t==='GetRecordStatus')response={outputActive:false};if(t==='GetCurrentProgramScene')response={currentProgramSceneName:'Scene'};if(t==='GetInputList')response={inputs:existing?[{inputName:'Bubblecast · Twitch + YouTube'}]:[]};if(t==='GetInputSettings')response={inputSettings:{url:'http://127.0.0.1:3927/overlay'}};if(t==='GetSceneItemList')response={sceneItems:[{sourceName:'Bubblecast · Twitch + YouTube',sceneItemId:1}]};if(t==='CreateInput')response={sceneItemId:1};if(t==='GetVideoSettings')response={baseWidth:1920,baseHeight:1080};queueMicrotask(()=>this.receive({op:7,d:{requestId:m.d.requestId,requestStatus:{result:!(serviceFailure&&t==='GetStreamServiceSettings'),comment:'fixture private failure'},responseData:response}}));}
 close(){this.dispatchEvent(new Event('close'));}
 }return {Socket,calls};}
test('creates the browser source using authenticated OBS RPC',async()=>{const f=fixture();const result=await setupObs({configOverride:config,Socket:f.Socket});assert.equal(result.scene,'Scene');assert.ok(f.calls[0].d.authentication);const create=f.calls.find(c=>c.d.requestType==='CreateInput');assert.equal(create.d.requestData.inputSettings.url,'http://127.0.0.1:3927/overlay');assert.equal(create.d.requestData.inputSettings.width,3840);});
test('existing overlay setup is idempotent and preserves its transform',async()=>{const f=fixture({existing:true});await setupObs({configOverride:config,Socket:f.Socket});assert.ok(!f.calls.some(c=>['CreateInput','SetSceneItemTransform'].includes(c.d.requestType)));});
test('does not add sources during a live stream',async()=>{const f=fixture({streaming:true});await assert.rejects(setupObs({configOverride:config,Socket:f.Socket}),/Stop streaming/);assert.ok(!f.calls.some(c=>c.d.requestType==='CreateInput'));});
test('requires enabled, authenticated OBS server',async()=>{await assert.rejects(setupObs({configOverride:{server_enabled:false}}),/Enable WebSocket/);await assert.rejects(setupObs({configOverride:{server_enabled:true,auth_required:false}}),/Enable authentication/);});

test('stream detection distinguishes an unavailable Aitum response from a detected idle output',async()=>{
 for(const vertical of [null,false,true]){const f=fixture({streaming:true,vertical});const s=await obsStreams({configOverride:config,Socket:f.Socket});assert.equal(s.streaming,true);assert.equal(s.vertical,vertical===true);assert.equal(s.verticalDetected,vertical!==null);assert.ok(f.calls.every(c=>!c.d.requestType||['GetStreamStatus','CallVendorRequest'].includes(c.d.requestType)));}
});

import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {streamKeyFingerprint} from '../youtube-slot-matching.mjs';
test('a bounded OBS key inspection reads main RPC and the Windows-compatible Aitum config path without returning raw keys',async t=>{
 const folder=await mkdtemp(join(tmpdir(),'bubblecast-obs-'));t.after(()=>rm(folder,{recursive:true,force:true}));const dir=join(folder,'plugin_config','vertical-canvas');await mkdir(dir,{recursive:true});await writeFile(join(dir,'config.json'),JSON.stringify({canvas:[{width:1080,height:1920,stream_outputs:[{stream_key:'fixture-vertical-secret',enabled:true}]}]}));
 const f=fixture({streaming:true,vertical:true,serviceKey:'fixture-main-secret'}),s=await obsStreams({configOverride:config,Socket:f.Socket,folder,includeKeys:true});assert.deepEqual(s.keys,{main:[streamKeyFingerprint('fixture-main-secret')],vertical:[streamKeyFingerprint('fixture-vertical-secret')]});assert.ok(!JSON.stringify(s).includes('fixture-main-secret'));assert.ok(!JSON.stringify(s).includes('fixture-vertical-secret'));assert.equal(f.calls.filter(c=>c.d.requestType==='GetStreamServiceSettings').length,1);assert.ok(f.calls.every(c=>!c.d.requestType||['GetStreamStatus','CallVendorRequest','GetStreamServiceSettings'].includes(c.d.requestType)));
});
test('ordinary status polling and offline recording never read output keys',async()=>{
 for(const [streaming,includeKeys] of [[true,false],[false,true]]){const f=fixture({streaming,vertical:false,serviceKey:'fixture-private'}),s=await obsStreams({configOverride:config,Socket:f.Socket,includeKeys});assert.equal(f.calls.some(c=>c.d.requestType==='GetStreamServiceSettings'),false);if(includeKeys)assert.deepEqual(s.keys,{main:[],vertical:[]});else assert.equal(s.keys,undefined);}
});
test('missing Aitum config and a rejected main-key RPC preserve live detection without leaking errors',async()=>{
 const f=fixture({streaming:true,vertical:true,serviceFailure:true}),s=await obsStreams({configOverride:config,Socket:f.Socket,folder:join(tmpdir(),'bubblecast-missing-obs-fixture'),includeKeys:true});assert.equal(s.streaming,true);assert.equal(s.vertical,true);assert.deepEqual(s.keys,{main:[],vertical:[]});assert.ok(!JSON.stringify(s).includes('fixture private failure'));
});

test('a stale Aitum config is ignored when the vendor is missing, even while the main stream runs',async t=>{
 const folder=await mkdtemp(join(tmpdir(),'bubblecast-stale-aitum-'));t.after(()=>rm(folder,{recursive:true,force:true}));const dir=join(folder,'plugin_config','vertical-canvas');await mkdir(dir,{recursive:true});await writeFile(join(dir,'config.json'),JSON.stringify({canvas:[{width:1080,height:1920,stream_outputs:[{stream_key:'fixture-old-vertical',enabled:true}]}]}));const f=fixture({streaming:true,vertical:null,serviceKey:'fixture-main'}),s=await obsStreams({configOverride:config,Socket:f.Socket,folder,includeKeys:true});assert.equal(s.verticalDetected,false);assert.deepEqual(s.keys,{main:[streamKeyFingerprint('fixture-main')],vertical:[]});
});

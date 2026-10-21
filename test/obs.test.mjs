import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setupObs} from '../obs.mjs';
const config={server_enabled:true,server_port:4455,auth_required:true,server_password:'local-test'};
function fixture({existing=false,streaming=false}={}){const calls=[];class Socket extends EventTarget{
 constructor(){super();queueMicrotask(()=>this.receive({op:0,d:{rpcVersion:1,authentication:{salt:'salt',challenge:'challenge'}}}));}
 receive(m){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(m)}));}
 send(raw){const m=JSON.parse(raw);calls.push(m);if(m.op===1)return queueMicrotask(()=>this.receive({op:2,d:{}}));const t=m.d.requestType;let response={};if(t==='GetStreamStatus')response={outputActive:streaming};if(t==='GetRecordStatus')response={outputActive:false};if(t==='GetCurrentProgramScene')response={currentProgramSceneName:'Scene'};if(t==='GetInputList')response={inputs:existing?[{inputName:'Bubblecast · Twitch + YouTube'}]:[]};if(t==='GetInputSettings')response={inputSettings:{url:'http://127.0.0.1:3927/overlay'}};if(t==='GetSceneItemList')response={sceneItems:[{sourceName:'Bubblecast · Twitch + YouTube',sceneItemId:1}]};if(t==='CreateInput')response={sceneItemId:1};if(t==='GetVideoSettings')response={baseWidth:1920,baseHeight:1080};queueMicrotask(()=>this.receive({op:7,d:{requestId:m.d.requestId,requestStatus:{result:true},responseData:response}}));}
 close(){this.dispatchEvent(new Event('close'));}
 }return {Socket,calls};}
test('creates the browser source using authenticated OBS RPC',async()=>{const f=fixture();const result=await setupObs({configOverride:config,Socket:f.Socket});assert.equal(result.scene,'Scene');assert.ok(f.calls[0].d.authentication);const create=f.calls.find(c=>c.d.requestType==='CreateInput');assert.equal(create.d.requestData.inputSettings.url,'http://127.0.0.1:3927/overlay');assert.equal(create.d.requestData.inputSettings.width,3840);});
test('existing overlay setup is idempotent and preserves its transform',async()=>{const f=fixture({existing:true});await setupObs({configOverride:config,Socket:f.Socket});assert.ok(!f.calls.some(c=>['CreateInput','SetSceneItemTransform'].includes(c.d.requestType)));});
test('does not add sources during a live stream',async()=>{const f=fixture({streaming:true});await assert.rejects(setupObs({configOverride:config,Socket:f.Socket}),/Stop streaming/);assert.ok(!f.calls.some(c=>c.d.requestType==='CreateInput'));});
test('requires enabled, authenticated OBS server',async()=>{await assert.rejects(setupObs({configOverride:{server_enabled:false}}),/Enable WebSocket/);await assert.rejects(setupObs({configOverride:{server_enabled:true,auth_required:false}}),/Enable authentication/);});

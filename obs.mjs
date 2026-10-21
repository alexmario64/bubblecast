import {createHash,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
export async function setupObs({configOverride,Socket=WebSocket,resolution='2160'}={}){
 let config=configOverride;try{config??=JSON.parse(await readFile(join(process.env.APPDATA,'obs-studio/plugin_config/obs-websocket/config.json'),'utf8'));}catch{throw Error('In OBS, open Tools → WebSocket Server Settings and enable the server with authentication.');}
 if(!config.server_enabled)throw Error('In OBS: Tools → WebSocket Server Settings → Enable WebSocket server → Apply. Keep authentication enabled, then retry.');
 if(!config.auth_required)throw Error('Enable authentication in OBS WebSocket Server Settings, then retry.');
 const socket=new Socket('ws://127.0.0.1:'+Number(config.server_port||4455));const pending=new Map();
 const hash=s=>createHash('sha256').update(s).digest('base64');
 try{
 await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{reject(Error('OBS connection timed out.'));socket.close();},8000);socket.addEventListener('error',()=>{clearTimeout(timeout);reject(Error('Cannot connect to OBS WebSocket. Check its server settings.'));});socket.addEventListener('message',e=>{let m;try{m=JSON.parse(e.data);}catch{return;}
 if(m.op===0){const a=m.d.authentication;socket.send(JSON.stringify({op:1,d:{rpcVersion:1,eventSubscriptions:0,...(a?{authentication:hash(hash(String(config.server_password||'')+a.salt)+a.challenge)}:{})}}));}
 if(m.op===2){clearTimeout(timeout);resolve();}
 if(m.op===7){const p=pending.get(m.d.requestId);if(p){pending.delete(m.d.requestId);m.d.requestStatus.result?p.resolve(m.d.responseData||{}):p.reject(Error(m.d.requestStatus.comment||'OBS request failed.'));}}
 });socket.addEventListener('close',()=>{clearTimeout(timeout);reject(Error('OBS rejected the connection. Check authentication settings.'));for(const p of pending.values())p.reject(Error('OBS disconnected.'));pending.clear();});});
 const rpc=(requestType,requestData={})=>new Promise((resolve,reject)=>{const requestId=randomUUID(),timer=setTimeout(()=>{pending.delete(requestId);reject(Error('OBS request timed out.'));},8000);pending.set(requestId,{resolve:x=>{clearTimeout(timer);resolve(x);},reject:e=>{clearTimeout(timer);reject(e);}});socket.send(JSON.stringify({op:6,d:{requestType,requestId,requestData}}));});
 const {outputActive:streaming}=await rpc('GetStreamStatus');const {outputActive:recording}=await rpc('GetRecordStatus');if(streaming||recording)throw Error('Stop streaming and recording before installing the overlay.');
 const {currentProgramSceneName:scene}=await rpc('GetCurrentProgramScene');const {inputs}=await rpc('GetInputList');const name='Bubblecast · Twitch + YouTube';const existing=inputs.find(i=>i.inputName===name);let id;
 if(existing){const settings=await rpc('GetInputSettings',{inputName:name});if(settings.inputSettings?.url!=='http://127.0.0.1:3927/overlay')throw Error('A different source already uses the Bubblecast name. Rename it before retrying.');const list=await rpc('GetSceneItemList',{sceneName:scene});id=list.sceneItems.find(i=>i.sourceName===name)?.sceneItemId;if(id==null)id=(await rpc('CreateSceneItem',{sceneName:scene,sourceName:name,sceneItemEnabled:true})).sceneItemId;}
 else {const height=['1080','1440','2160'].includes(String(resolution))?Number(resolution):2160;id=(await rpc('CreateInput',{sceneName:scene,inputName:name,inputKind:'browser_source',inputSettings:{url:'http://127.0.0.1:3927/overlay',width:Math.round(height*16/9),height,shutdown:false,restart_when_active:false},sceneItemEnabled:true})).sceneItemId;}
 // Do not reposition a source already present in this scene.
 if(!existing){await rpc('SetSceneItemTransform',{sceneName:scene,sceneItemId:id,sceneItemTransform:{positionX:0,positionY:0}});}
 return {ok:true,scene,source:name};
 }finally{socket.close();}
}

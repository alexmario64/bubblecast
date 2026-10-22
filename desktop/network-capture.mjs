import {kickFrame} from './kick-chat.mjs';
import {kickEvent} from './stream-events.mjs';
import {extractPolls} from '../polls.mjs';
import {NetworkFeed,youtubeActions,tiktokPayload} from '../network-chat.mjs';
function allowedURL(value,platform,socket=false){try{const u=new URL(value);if(platform==='kick')return socket&&u.protocol==='wss:'&&(/(^|\.)pusher\.com$/.test(u.hostname)||/(^|\.)platform\.kick\.com$/.test(u.hostname)||u.hostname==='websockets.kick.com');if(platform==='youtube')return u.protocol==='https:'&&['www.youtube.com','youtube.com'].includes(u.hostname)&&u.pathname==='/youtubei/v1/live_chat/get_live_chat';return (socket?u.protocol==='wss:':u.protocol==='https:')&&/(^|\.)(tiktok\.com|tiktokv\.com|tiktokcdn\.com)$/.test(u.hostname)&&/^\/webcast\/im\/(?:push|fetch)(?:\/|$)/.test(u.pathname);}catch{return false;}}
export function attachNetworkCapture(contents,{platform,sourceKey,onMessage,onError=()=>{},now=Date.now}){
 const feed=new NetworkFeed({platform,sourceKey,onMessage,now}),debug=contents.debugger,requests=new Map(),sockets=new Set(),diagnostics={responses:0,paths:[],sockets:[],events:[],wire:[],http:[],attached:false};let stopped=false,needsBaseline=true;
 const publishPolls=payload=>{for(const poll of extractPolls(payload,platform,sourceKey)){onMessage({action:'poll',platform,sourceKey,poll});}};
 const youtubePayload=payload=>{publishPolls(payload);const messages=youtubeActions(payload,sourceKey);feed.accept(messages,{baseline:needsBaseline});if(messages!==null)needsBaseline=false;};
  const navigate=(_event,_url,_inPlace,mainFrame)=>{if(mainFrame){feed.startedAt=now();feed.ready=false;needsBaseline=true;requests.clear();sockets.clear();}};contents.on?.('did-start-navigation',navigate);
 const report=error=>{if(!stopped)onError(error);};
 const listener=async(_event,method,params)=>{if(stopped)return;try{
  if(platform==='kick'&&method==='Network.webSocketCreated'){try{const host=new URL(params.url).hostname;if(!diagnostics.sockets.includes(host))diagnostics.sockets.push(host);}catch{}}
  if(platform==='kick'&&method==='Network.responseReceived'){try{const u=new URL(params.response?.url);if(u.hostname==='kick.com'&&u.pathname.includes('/api/')&&diagnostics.http.length<20)diagnostics.http.push({path:u.pathname,status:params.response.status});}catch{}}
  if(platform==='kick'&&method==='Network.webSocketFrameReceived'&&diagnostics.wire.length<8){const data=params.response?.payloadData||'';let keys=[];try{keys=Object.keys(JSON.parse(params.response.opcode===2?Buffer.from(data,'base64').toString():data));}catch{}diagnostics.wire.push({opcode:params.response?.opcode,length:data.length,keys});}
  if(platform==='kick'&&method==='Network.webSocketFrameReceived'&&params.response?.opcode===1){try{const event=JSON.parse(params.response.payloadData).event;if(typeof event==='string'&&!diagnostics.events.includes(event))diagnostics.events.push(event.slice(0,100));}catch{}}
  if(method==='Network.responseReceived'){diagnostics.responses++;try{const u=new URL(params.response?.url);if(/(^|\.)(youtube\.com|tiktok\.com|tiktokv\.com|kick\.com)$/.test(u.hostname)&&!diagnostics.paths.includes(u.pathname))diagnostics.paths=[...diagnostics.paths,u.pathname].slice(-12);}catch{}}
  if(method==='Network.responseReceived'&&allowedURL(params.response?.url,platform)){if(requests.size>=1000)requests.delete(requests.keys().next().value);requests.set(params.requestId,{at:now()});}
  if(method==='Network.loadingFailed')requests.delete(params.requestId);
  if(method==='Network.loadingFinished'&&requests.has(params.requestId)){
   requests.delete(params.requestId);const result=await debug.sendCommand('Network.getResponseBody',{requestId:params.requestId});if(stopped||result.body.length>12*1024*1024)return;
   const bytes=Buffer.from(result.body,result.base64Encoded?'base64':'utf8');
   if(platform==='youtube')youtubePayload(JSON.parse(bytes.toString('utf8').replace(/^\)\]\}'\s*/,'')));
   else {const messages=tiktokPayload(bytes,{push:false});feed.accept(messages,{baseline:needsBaseline});if(messages!==null)needsBaseline=false;}
  }
  if(['tiktok','kick'].includes(platform)&&method==='Network.webSocketCreated'&&allowedURL(params.url,platform,true))sockets.add(params.requestId);
  if(platform==='kick'&&method==='Network.webSocketFrameReceived'&&sockets.has(params.requestId)&&[1,2].includes(params.response?.opcode)&&params.response.payloadData?.length<1024*1024){const frame=params.response.opcode===2?Buffer.from(params.response.payloadData,'base64').toString('utf8'):params.response.payloadData,event=kickEvent(frame);if(event)onMessage({...event,observedAt:now(),capturedAt:now()});const messages=kickFrame(frame);if(Array.isArray(messages)&&!feed.ready)contents.executeJavaScript('window.__bubblecastKickNetworkReady=true').catch(report);feed.accept(messages);}
  if(method==='Network.webSocketClosed')sockets.delete(params.requestId);
  if(platform==='tiktok'&&method==='Network.webSocketFrameReceived'&&sockets.has(params.requestId)&&params.response?.opcode===2){const data=params.response.payloadData;if(typeof data==='string'&&data.length<12*1024*1024)feed.accept(tiktokPayload(Buffer.from(data,'base64')));}
 }catch(error){report(error);}};
 const detached=()=>{diagnostics.attached=false;feed.ready=false;requests.clear();sockets.clear();};
 try{debug.attach('1.3');diagnostics.attached=true;debug.on('message',listener);debug.on('detach',detached);debug.sendCommand('Network.enable',{maxTotalBufferSize:16*1024*1024,maxResourceBufferSize:8*1024*1024}).catch(report);}catch(error){report(error);}
 return {feed,diagnostics,beginBaseline(){feed.startedAt=now();needsBaseline=true;},stop(){stopped=true;contents.removeListener?.('did-start-navigation',navigate);feed.ready=false;requests.clear();sockets.clear();debug.removeListener('message',listener);debug.removeListener('detach',detached);try{if(debug.isAttached())debug.detach();}catch{}}};
}

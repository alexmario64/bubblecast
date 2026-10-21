export const YOUTUBE_POLL_CADENCE_MS=200;
function nextCursor(payload){const continuations=payload?.continuationContents?.liveChatContinuation?.continuations||[];for(const item of continuations)for(const key of ['invalidationContinuationData','timedContinuationData','reloadContinuationData'])if(typeof item[key]?.continuation==='string')return item[key].continuation;return null;}
export class YouTubePoll{
 constructor({request,onPayload,onError=()=>{},schedule=setTimeout,cancel=clearTimeout,now=Date.now}){Object.assign(this,{request,onPayload,onError,schedule,cancel,now});this.running=false;this.generation=0;this.failures=0;this.requests=0;this.lastDelayMs=null;}
 seed({url,body,headers={}}){if(this.running||typeof body?.continuation!=='string'||!body.context)return;let u;try{u=new URL(url);}catch{return;}if(u.protocol!=='https:'||!['www.youtube.com','youtube.com'].includes(u.hostname)||u.pathname!=='/youtubei/v1/live_chat/get_live_chat')return;
  this.stop();this.running=true;this.url=url;this.body={context:structuredClone(body.context),continuation:body.continuation};this.headers={'Content-Type':'application/json',Origin:'https://www.youtube.com',Referer:'https://www.youtube.com/live_chat'};
  for(const [name,value] of Object.entries(headers))if(['x-youtube-client-name','x-youtube-client-version','x-goog-visitor-id'].includes(name.toLowerCase())&&typeof value==='string')this.headers[name]=value;
  const client=this.body.context.client||{};if(!Object.keys(this.headers).some(k=>k.toLowerCase()==='x-youtube-client-name')&&client.clientName==='WEB')this.headers['X-YouTube-Client-Name']='1';if(client.clientVersion)this.headers['X-YouTube-Client-Version']=String(client.clientVersion);if(client.visitorData)this.headers['X-Goog-Visitor-Id']=String(client.visitorData);
  this.timer=this.schedule(()=>this.poll(this.generation),0);
 }
 stop(){this.running=false;this.generation++;this.cancel(this.timer);this.controller?.abort();this.controller=null;}
 async poll(generation){if(!this.running||generation!==this.generation)return;let delay=null;const started=this.now();const controller=new AbortController();this.controller=controller;const timeout=this.schedule(()=>controller.abort(),15000);
  try{this.requests++;const response=await this.request(this.url,{method:'POST',headers:this.headers,body:JSON.stringify(this.body),signal:this.controller.signal});if(!this.running||generation!==this.generation)return;
   if(!response.ok){const retry=response.headers?.get?.('retry-after');const seconds=Number(retry);delay=Math.min(2147483647,Math.max(5000,Number.isFinite(seconds)&&seconds>0?seconds*1000:Math.max(0,Date.parse(retry)-this.now())||5000*2**Math.min(this.failures++,4)));throw Error('YouTube chat returned HTTP '+response.status);}
   const payload=await response.json();if(!this.running||generation!==this.generation)return;const cursor=nextCursor(payload);if(!cursor){delay=30000;throw Error('YouTube did not return a live chat continuation');}
   this.body.continuation=cursor;const visitor=payload.responseContext?.visitorData;if(visitor&&this.body.context.client)this.body.context.client.visitorData=visitor;
   this.failures=0;this.lastDelayMs=this.now()-started;this.onPayload(payload);this.onError(null);
  }catch(error){if(this.running&&generation===this.generation){if(delay===null)delay=Math.min(30000,2000*2**Math.min(this.failures++,4));this.onError(error);}}
  finally{this.cancel(timeout);if(this.running&&generation===this.generation)this.timer=this.schedule(()=>this.poll(generation),delay??Math.max(50,YOUTUBE_POLL_CADENCE_MS-(this.now()-started)));}
 }
}

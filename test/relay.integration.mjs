// Run with a local Bubblecast server: node test/relay.integration.mjs
import assert from 'node:assert/strict';
const base='http://127.0.0.1:3927';
assert.equal((await fetch(base)).status,200);
assert.equal((await fetch(base+'/api/pair',{headers:{Origin:'https://unrelated.example'}})).status,403);
assert.equal((await fetch(base+'/api/bridge',{method:'POST',body:'{}'})).status,401);
const {token}=await(await fetch(base+'/api/pair')).json();
const post=(path,data)=>fetch(base+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json','X-Bubblecast-Token':token},body:JSON.stringify(data)});
const control=new AbortController();const response=await fetch(base+'/api/events',{signal:control.signal});
let received='';const decoder=new TextDecoder();const reader=response.body.getReader();
const pump=(async()=>{try{while(true){const {value,done}=await reader.read();if(done)break;received+=decoder.decode(value);}}catch{}})();
const prefix='verify-'+crypto.randomUUID();
for(const platform of ['twitch','youtube']){
 const m={id:prefix+platform,platform,user:'relay-test',parts:[{type:'text',text:'hello https://example.com'}]};
 assert.equal((await post('test',m)).status,200);await post('test',m);
}
await post('test',{id:prefix+'hidden',platform:'youtube',user:'relay-test',parts:[{type:'text',text:'https://example.com'}]});
await post('test',{id:prefix+'twitch',platform:'twitch',action:'update',user:'relay-test',parts:[{type:'text',text:'hello refreshed'}],badges:[{src:'https://static-cdn.jtvnw.net/badges/v1/custom/1',alt:'Custom Subscriber'}]});
await new Promise(r=>setTimeout(r,150));control.abort();await pump;
assert.equal((received.match(/event: message/g)||[]).length,2,'both sources delivered once');
assert.equal((received.match(/event: update/g)||[]).length,1,'late media patches the existing bubble');
assert.ok(received.includes('"text":"hello "'),'URL removed before relay');
assert.ok(!received.includes('example.com'),'URL not exposed to source');
assert.ok(!received.includes(prefix+'hidden'),'link-only chat suppressed');
console.log('Relay verified: HTTP, origin/auth checks, Twitch + YouTube SSE, duplicate prevention, link filtering.');

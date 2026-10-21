import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=name=>fs.readFileSync(new URL('../extension/'+name,import.meta.url),'utf8');
test('Chrome startup clears stale tab identities without opening chat or fetching services',async()=>{
 let startup;const stored={managedSources:{configured:true,urls:{twitch:'https://www.twitch.tv/popout/alex/chat?popout='}},managedTabs:{twitch:{id:123}}};
 const context=vm.createContext({chrome:{runtime:{onMessage:{addListener(){}},onStartup:{addListener(f){startup=f;}},onInstalled:{addListener(){throw Error('No installation auto-start allowed');}}},storage:{local:{async set(value){Object.assign(stored,value);}}}},fetch(){throw Error('Startup must not connect');}});
 context.importScripts=()=>vm.runInContext(read('sources.js'),context);vm.runInContext(read('background.js'),context);await startup();assert.equal(Object.keys(stored.managedTabs).length,0);assert.equal(stored.managedSources.configured,true);
});
test('setup page pairing and periodic reconnect never open chat; Save still does',async()=>{
 const handlers={},messages=[];let interval,sourceEvent;
 const context=vm.createContext({window:{addEventListener:(name,f)=>handlers[name]=f,dispatchEvent(){}},document:{addEventListener:(name,f)=>handlers[name]=f},setInterval:f=>interval=f,CustomEvent:class{},EventSource:class{addEventListener(name,f){if(name==='sources')sourceEvent=f;}},chrome:{runtime:{id:'test-bridge',sendMessage(message,reply){messages.push(message.type);reply({ok:true,reconnected:true});}}},fetch:async()=>({ok:true,json:async()=>({configured:true,urls:{twitch:'https://www.twitch.tv/popout/alex/chat?popout='}})})});
 vm.runInContext(read('pair.js'),context);handlers.DOMContentLoaded();interval();handlers['bubblecast-pair']();await new Promise(setImmediate);assert.deepEqual(messages,['pair','pair','pair']);
 handlers['bubblecast-connect-sources']();await new Promise(setImmediate);assert.equal(messages.at(-1),'configureSources');sourceEvent();await new Promise(setImmediate);assert.equal(messages.filter(x=>x==='configureSources').length,2);
});

function pairingFixture(sendMessage){
 const handlers={},notices=[],runtime={id:'test-bridge',sendMessage};let interval,cleared=0,closed=0;
 const context=vm.createContext({window:{addEventListener:(name,f)=>handlers[name]=f,removeEventListener:name=>delete handlers[name],dispatchEvent:event=>notices.push(event.type)},document:{addEventListener:(name,f)=>handlers[name]=f,removeEventListener:name=>delete handlers[name]},setInterval:f=>{interval=f;return 7;},clearInterval:id=>{assert.equal(id,7);cleared++;},CustomEvent:class{constructor(type){this.type=type;}},EventSource:class{addEventListener(){}close(){closed++;}},chrome:{runtime},fetch:async()=>({ok:true,json:async()=>({configured:true})})});
 vm.runInContext(read('pair.js'),context);return {runtime,handlers,notices,tick:()=>interval(),stats:()=>({cleared,closed})};
}
test('invalidated send retires the old pairing loop without throwing or repeated retries',()=>{
 let calls=0;const f=pairingFixture(()=>{calls++;throw Error('Extension context invalidated.');});const initial=f.handlers.DOMContentLoaded;
 assert.doesNotThrow(initial);assert.doesNotThrow(f.tick);assert.doesNotThrow(initial);assert.equal(calls,1);assert.deepEqual(f.stats(),{cleared:1,closed:1});assert.deepEqual(f.notices,['bubblecast-bridge-reload-needed']);assert.equal(f.handlers['bubblecast-pair'],undefined);
});
test('context invalidation during an asynchronous reply also stops cleanly',()=>{
 let reply;const f=pairingFixture((message,callback)=>reply=callback);f.handlers.DOMContentLoaded();Object.defineProperty(f.runtime,'lastError',{get(){throw Error('Extension context invalidated.');}});
 assert.doesNotThrow(()=>reply({ok:true}));assert.deepEqual(f.stats(),{cleared:1,closed:1});assert.deepEqual(f.notices,['bubblecast-bridge-reload-needed']);
});
test('temporary local server outages keep the pairing retry loop available',()=>{
 let calls=0;const f=pairingFixture((message,reply)=>{calls++;reply({ok:false,error:'Local app unavailable'});});f.handlers.DOMContentLoaded();f.tick();assert.equal(calls,2);assert.deepEqual(f.stats(),{cleared:0,closed:0});assert.deepEqual(f.notices,[]);
});
test('missing runtime after extension reload is handled without sending',()=>{
 const f=pairingFixture(()=>assert.fail('Must not use a retired runtime'));delete f.runtime.id;assert.doesNotThrow(f.tick);assert.deepEqual(f.stats(),{cleared:1,closed:1});
});

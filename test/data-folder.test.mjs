import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)),base='http://127.0.0.1:3927';
const up=()=>fetch(base+'/api/status',{signal:AbortSignal.timeout(1000)}).then(r=>r.ok,()=>false);
// The installed app points BUBBLECAST_DATA at the user's app data folder; saving must land there.
test('an installed server saves channels and settings in its data folder',async t=>{
 if(await up())return t.skip('another Bubblecast server is using port 3927');
 const dir=await mkdtemp(join(tmpdir(),'bubblecast-data-'));
 const server=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,BUBBLECAST_DATA:dir},stdio:'ignore'});
 t.after(async()=>{server.kill();await new Promise(r=>server.once('exit',r));await rm(dir,{recursive:true,force:true});});
 const deadline=Date.now()+10000;while(!await up()){assert.ok(Date.now()<deadline,'server did not start');await new Promise(r=>setTimeout(r,100));}
 const {token}=await (await fetch(base+'/api/pair')).json();
 const post=async(path,body)=>{const r=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json','x-bubblecast-token':token},body:JSON.stringify(body)});assert.equal(r.status,200,path+': '+await r.clone().text());return r.json();};
 await post('/api/sources',{twitchChannel:'samplestreamer'});
 assert.match(await readFile(join(dir,'sources.json'),'utf8'),/samplestreamer/);
 const settings=await (await fetch(base+'/api/settings')).json();await post('/api/settings',settings);
 await readFile(join(dir,'settings.json'),'utf8');
 assert.equal((await (await fetch(base+'/api/status')).json()).youtube.live,false,'YouTube waits for OBS');
 assert.equal((await post('/api/obs/streaming',{streaming:true})).live,true);assert.equal((await (await fetch(base+'/api/status')).json()).youtube.live,true);
 await post('/api/sources',{enabled:true,youtubeChannel:'@example'});
 const found=(await post('/api/youtube/page-live',{videos:[{video:'abcdefghijk',vertical:true},{video:'bcdefghijkl',vertical:false}]})).found;
 assert.deepEqual(found.map(f=>[f.slot,f.video]),[['youtube','bcdefghijkl'],['youtubeShorts','abcdefghijk']],'the page fallback fills both slots by shape');
 const urls=(await (await fetch(base+'/api/sources')).json()).urls;assert.match(urls.youtubeShorts,/v=abcdefghijk/);
 await post('/api/youtube/page-live',{videos:[]});assert.equal((await (await fetch(base+'/api/sources')).json()).urls.youtube,'https://www.youtube.com/@example/live','back to the channel page when nothing is live');
});

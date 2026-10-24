import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {Updates,newer,downloadAllowed,RELEASES} from '../updates.mjs';
import {downloadUpdate} from '../desktop/updater.mjs';
const base='https://github.com/alexmario64/bubblecast/releases/download/';
const release=(v,{sha=true}={})=>({tag_name:'v'+v,html_url:'https://github.com/alexmario64/bubblecast/releases/tag/v'+v,assets:[{name:`Bubblecast-Setup-${v}.exe`,browser_download_url:`${base}v${v}/Bubblecast-Setup-${v}.exe`},...(sha?[{name:`Bubblecast-Setup-${v}.exe.sha256`,browser_download_url:`${base}v${v}/Bubblecast-Setup-${v}.exe.sha256`}]:[]),{name:'Bubblecast-Setup.exe',browser_download_url:`${base}v${v}/Bubblecast-Setup.exe`}]});
const github=(body,calls=[])=>async(url)=>{calls.push(url);return {ok:true,json:async()=>body};};
test('versions compare by number, not text',()=>{
 assert.ok(newer('1.28.0','1.27.2'));assert.ok(newer('1.10.0','1.9.9'));assert.ok(!newer('1.27.2','1.27.2'));assert.ok(!newer('1.27.1','1.27.2'));
});
test('an installed copy sees a newer release it can install; a checkout only hears about it',async()=>{
 const calls=[];const app=new Updates({current:'1.27.2',packaged:true,request:github(release('1.28.0'),calls)});
 const s=await app.check();assert.deepEqual([s.available,s.installable,s.latest],[true,true,'1.28.0']);assert.equal(calls[0],RELEASES);
 assert.deepEqual(app.job(),{version:'1.28.0',installer:base+'v1.28.0/Bubblecast-Setup-1.28.0.exe',checksum:base+'v1.28.0/Bubblecast-Setup-1.28.0.exe.sha256'});
 const source=new Updates({current:'1.27.2',packaged:false,request:github(release('1.28.0'))});const t=await source.check();assert.deepEqual([t.available,t.installable],[true,false]);assert.equal(source.job(),null);
});
test('a release without a checksum, or the same version, is never installed',async()=>{
 const noSum=new Updates({current:'1.27.2',packaged:true,request:github(release('1.28.0',{sha:false}))});assert.equal((await noSum.check()).installable,false);assert.equal(noSum.job(),null);
 const same=new Updates({current:'1.28.0',packaged:true,request:github(release('1.28.0'))});const s=await same.check();assert.deepEqual([s.available,s.installable],[false,false]);
});
test('checks are spaced out unless asked, and failures are reported, not thrown',async()=>{
 let now=0;const calls=[];const app=new Updates({current:'1.27.2',request:github(release('1.28.0'),calls),now:()=>now});
 await app.check();await app.check();assert.equal(calls.length,1);now=7*3600000;await app.check();assert.equal(calls.length,2);await app.check(true);assert.equal(calls.length,3);
 const down=new Updates({current:'1.27.2',request:async()=>({ok:false,status:403,json:async()=>({})})});const s=await down.check(true);assert.match(s.error,/HTTP 403/);assert.equal(s.available,false);
});
test('only this project’s release downloads are accepted',()=>{
 assert.ok(downloadAllowed(base+'v1.28.0/Bubblecast-Setup-1.28.0.exe'));
 for(const bad of ['https://github.com/someone/bubblecast/releases/download/v1.28.0/Bubblecast-Setup-1.28.0.exe','https://example.com/Bubblecast-Setup-1.28.0.exe',base+'v1.28.0/other.exe','http://github.com/alexmario64/bubblecast/releases/download/v1.28.0/Bubblecast-Setup-1.28.0.exe'])assert.ok(!downloadAllowed(bad),bad);
});
test('an update is saved only when it matches its checksum',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'bubblecast-update-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const exe=Buffer.from('installer bytes'),sum=createHash('sha256').update(exe).digest('hex');const job={version:'1.28.0',installer:base+'v1.28.0/Bubblecast-Setup-1.28.0.exe',checksum:base+'v1.28.0/Bubblecast-Setup-1.28.0.exe.sha256',dir};
 const serve=(s)=>async url=>({ok:true,text:async()=>s+'  Bubblecast-Setup-1.28.0.exe\n',arrayBuffer:async()=>exe.buffer.slice(exe.byteOffset,exe.byteOffset+exe.length)});
 const path=await downloadUpdate({...job,request:serve(sum)});assert.deepEqual(await readFile(path),exe);
 await assert.rejects(downloadUpdate({...job,request:serve('0'.repeat(64))}),/did not match/);
 await assert.rejects(downloadUpdate({...job,installer:'https://example.com/Bubblecast-Setup-1.28.0.exe',request:serve(sum)}),/not a Bubblecast release/);
 await assert.rejects(downloadUpdate({...job,checksum:base+'v1.27.0/Bubblecast-Setup-1.27.0.exe.sha256',request:serve(sum)}),/not a Bubblecast release/);
});

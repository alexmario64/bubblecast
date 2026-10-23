import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {withDock,addObsDock,obsConfigFolder,dockUrl} from '../obs-dock.mjs';
const docks=text=>JSON.parse(text.split(/\r?\n/).find(l=>l.startsWith('ExtraBrowserDocks=')).slice('ExtraBrowserDocks='.length));
test('the dock is added to the BasicWindow section and other settings are kept',()=>{
 const text='[General]\nName=Untitled\n\n[BasicWindow]\nGeometry=abc\n\n[Other]\nKey=1\n';
 const next=withDock(text,{uuid:'u1'});assert.deepEqual(docks(next),[{title:'Bubblecast',url:dockUrl,uuid:'u1'}]);
 assert.match(next,/\[BasicWindow\]\nGeometry=abc\nExtraBrowserDocks=.*\n\n\[Other\]\nKey=1\n$/);assert.match(next,/^\[General\]\nName=Untitled\n/);
});
test('existing custom docks are kept, Windows line endings and the byte order mark survive',()=>{
 const text='\uFEFF[BasicWindow]\r\nExtraBrowserDocks=[{"title":"Alerts","url":"https://example.com/alerts","uuid":"a"}]\r\n';
 const next=withDock(text,{uuid:'u2'});assert.ok(next.startsWith('\uFEFF[BasicWindow]\r\n'));assert.ok(!/[^\r]\n/.test(next));
 assert.deepEqual(docks(next).map(d=>d.title),['Alerts','Bubblecast']);
});
test('a dock already pointing at Bubblecast is not added twice, and a missing section is created',()=>{
 assert.equal(withDock(`[BasicWindow]\nExtraBrowserDocks=[{"title":"Chat","url":"${dockUrl}/","uuid":"x"}]\n`),null);
 const next=withDock('[General]\nName=Untitled\n',{uuid:'u3'});assert.match(next,/^\[General\]\nName=Untitled\n\n\[BasicWindow\]\nExtraBrowserDocks=/);
 assert.match(withDock('',{uuid:'u4'}),/^\[BasicWindow\]\nExtraBrowserDocks=.*\n$/);
});
test('unreadable dock settings are left alone',()=>{
 assert.throws(()=>withDock('[BasicWindow]\nExtraBrowserDocks=not json\n'),/could not read/);
});
test('the OBS config folder follows each platform',()=>{
 assert.equal(obsConfigFolder({APPDATA:'C:\\Users\\Streamer\\AppData\\Roaming'},'win32'),join('C:\\Users\\Streamer\\AppData\\Roaming','obs-studio'));
 assert.equal(obsConfigFolder({HOME:'/Users/streamer'},'darwin'),join('/Users/streamer','Library','Application Support','obs-studio'));
 assert.equal(obsConfigFolder({},'win32'),'');
});
test('the dock is only written while OBS is closed, into user.ini when present',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'bubblecast-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 assert.equal((await addObsDock({folder:join(dir,'missing'),running:async()=>false})).status,'no-obs');
 await mkdir(join(dir,'obs'));const folder=join(dir,'obs');await writeFile(join(folder,'user.ini'),'[BasicWindow]\n');await writeFile(join(folder,'global.ini'),'[General]\n');
 assert.equal((await addObsDock({folder,running:async()=>true})).status,'obs-running');assert.equal(await readFile(join(folder,'user.ini'),'utf8'),'[BasicWindow]\n');
 assert.equal((await addObsDock({folder,running:async()=>false})).status,'added');assert.equal(docks(await readFile(join(folder,'user.ini'),'utf8')).length,1);assert.equal(await readFile(join(folder,'global.ini'),'utf8'),'[General]\n');
 assert.equal((await addObsDock({folder,running:async()=>false})).status,'present');
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DockHistory} from '../dock-history.mjs';
import {defaults} from '../core.mjs';
const message=(id,sourceKey='youtube')=>({id,platform:'youtube',sourceKey,user:'Viewer',userId:'viewer',parts:[{type:'text',text:id}]});
test('dock history keeps both YouTube feeds and patches only the matching source',()=>{const h=new DockHistory();h.accept('message',message('same'));h.accept('message',message('same','youtubeShorts'));h.accept('update',{...message('same','youtubeShorts'),parts:[{type:'text',text:'updated'}]});assert.equal(h.snapshot(defaults).length,2);assert.equal(h.snapshot(defaults)[0].parts[0].text,'same');assert.equal(h.snapshot(defaults)[1].parts[0].text,'updated');});
test('dock history bounds retained rows and updates cannot resurrect retired history',()=>{const h=new DockHistory(2);for(const id of ['a','b','c'])h.accept('message',message(id));h.accept('update',message('a'));assert.deepEqual(h.snapshot(defaults).map(m=>m.id),['b','c']);});
test('moderation deletes are scoped to their YouTube feed and clear empties history',()=>{const h=new DockHistory();h.accept('message',message('same'));h.accept('message',message('same','youtubeShorts'));h.accept('delete',{id:'same',platform:'youtube',sourceKey:'youtubeShorts'});assert.equal(h.snapshot(defaults).length,1);assert.equal(h.snapshot(defaults)[0].sourceKey,'youtube');h.accept('clear',{});assert.equal(h.snapshot(defaults).length,0);});
test('dock history keeps bot messages regardless of overlay exclusions',()=>{const h=new DockHistory();h.accept('message',message('a'));assert.equal(h.snapshot({...defaults,ignoredBots:['Viewer']}).length,1);});

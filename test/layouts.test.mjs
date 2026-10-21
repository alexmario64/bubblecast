import test from 'node:test';
import assert from 'node:assert/strict';
import {overlayLayout} from '../public/layouts.mjs';
import {defaults} from '../core.mjs';
test('standard layout retains configured 4K scaling and preview scale',()=>{assert.equal(overlayLayout(defaults,'standard',3840,2160).scale,2);assert.equal(overlayLayout(defaults,'standard',800,600,true).scale,1);});
test('portrait scales by width instead of inheriting landscape resolution',()=>{const p=overlayLayout({...defaults,resolution:'1080'},'vertical',1080,1920);assert.equal(p.scale,2);assert.equal(p.settings.width,480);assert.equal(p.settings.maxMessages,4);assert.equal(p.maxHeight,390);assert.ok((p.settings.width+2*p.edge)*p.scale<=1080);const hi=overlayLayout(defaults,'vertical',2160,3840);assert.equal(hi.scale,4);});
test('webcam layout fits compact source and preserves badges and full-name settings',()=>{const p=overlayLayout({...defaults,maxMessages:7},'webcam',800,480);assert.equal(p.settings.maxMessages,3);assert.equal(p.settings.fontSize,20);assert.equal(p.settings.badges,true);assert.ok((p.settings.width+2*p.edge)*p.scale<=800);assert.ok(p.maxHeight*p.scale<480);});
test('layout transforms do not mutate shared settings and respect lower message limits',()=>{const original={...defaults,maxMessages:1,direction:'right',floatMotion:false};const p=overlayLayout(original,'vertical',1080,1920);assert.equal(p.settings.maxMessages,1);assert.equal(p.settings.direction,'right');assert.equal(p.settings.floatMotion,false);assert.equal(original.width,defaults.width);});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {runtimeTarget,electronVersion} from '../desktop/runtime.mjs';
test('Windows runtime stays the x64 Electron build used by the VBS launcher',()=>{const t=runtimeTarget('win32','arm64','C:/b/.local/electron');assert.equal(t.archive,`electron-v${electronVersion}-win32-x64.zip`);assert.match(t.binary,/electron\.exe$/);});
test('macOS runtime matches the CPU and launches the app bundle binary',()=>{assert.equal(runtimeTarget('darwin','arm64','/b').archive,`electron-v${electronVersion}-darwin-arm64.zip`);assert.equal(runtimeTarget('darwin','x64','/b').archive,`electron-v${electronVersion}-darwin-x64.zip`);assert.equal(runtimeTarget('darwin','arm64','/b').binary,join('/b','Electron.app','Contents','MacOS','Electron'));assert.throws(()=>runtimeTarget('linux','x64'),/Windows/);});

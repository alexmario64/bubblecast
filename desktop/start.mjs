import {access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {runtimeTarget} from './runtime.mjs';
const {binary}=runtimeTarget();
try{await access(binary);}catch{console.error('Run pnpm install:background once before starting background capture.');process.exit(1);}
// Terminals inside VS Code export ELECTRON_RUN_AS_NODE, which would start Electron as plain Node.
const {ELECTRON_RUN_AS_NODE,...env}=process.env;
spawn(binary,[fileURLToPath(new URL('.',import.meta.url))],{detached:true,stdio:'ignore',windowsHide:true,env}).unref();
console.log('Bubblecast background helper started. Quit it from its tray/menu bar icon.');

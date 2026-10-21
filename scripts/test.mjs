import {readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
const root=fileURLToPath(new URL('../test/',import.meta.url));
async function discover(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const path=join(dir,e.name);if(e.isDirectory())out.push(...await discover(path));else if(e.name.endsWith('.test.mjs'))out.push(path);}return out;}
const child=spawn(process.execPath,['--test',...await discover(root)],{stdio:'inherit'});child.on('error',error=>{console.error(error.message);process.exitCode=1;});child.on('exit',code=>{process.exitCode=code??1;});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),skip=new Set(['.git','node_modules','.local']);
async function files(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){if(skip.has(e.name))continue;const path=join(dir,e.name);if(e.isDirectory())out.push(...await files(path));else out.push(path);}return out;}
// Project rule (AGENTS.md): PHP is never used anywhere in Bubblecast.
test('the repository contains no PHP files or embedded PHP code',async()=>{
 const all=await files(root),php=all.filter(f=>/\.(php\d?|phtml|phar)$/i.test(f));assert.deepEqual(php,[],'PHP files are not allowed');
 const opening=['<','?php'].join('');
 for(const f of all.filter(f=>/\.(m?js|cjs|html|css|json|md|yml|lua|cmd|vbs)$/i.test(f))){if((await readFile(f,'utf8')).includes(opening))assert.fail('Embedded PHP found in '+f.slice(root.length));}
});

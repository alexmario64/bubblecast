import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {dirname} from 'node:path';
function dpapi(text,decrypt=false){return new Promise((resolve,reject)=>{
 const prefix="$null=[Reflection.Assembly]::LoadWithPartialName('System.Security');";
 const script=prefix+(decrypt?'$b=[Convert]::FromBase64String([Console]::In.ReadToEnd());[Console]::Out.Write([Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))':'$b=[Text.Encoding]::UTF8.GetBytes([Console]::In.ReadToEnd());[Console]::Out.Write([Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))');
 const p=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,stdio:['pipe','pipe','pipe']});let out='';p.stdout.setEncoding('utf8');p.stdout.on('data',s=>out+=s);p.stderr.resume();p.on('error',()=>reject(Error('Windows credential encryption is unavailable.')));p.on('close',c=>c===0?resolve(out):reject(Error('Could not read or encrypt local credentials.')));p.stdin.end(text);
});}
export function secureStore(path){return {async read(){try{return JSON.parse(await dpapi(await readFile(path,'utf8'),true));}catch(e){if(e.code==='ENOENT')return {};throw e;}},async write(value){await mkdir(dirname(path),{recursive:true});await writeFile(path,await dpapi(JSON.stringify(value)),{mode:0o600});},async clear(){await rm(path,{force:true});}};}

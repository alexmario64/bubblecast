import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
function dpapi(text,decrypt=false){return new Promise((resolve,reject)=>{
 const prefix="$null=[Reflection.Assembly]::LoadWithPartialName('System.Security');";
 const script=prefix+(decrypt?'$b=[Convert]::FromBase64String([Console]::In.ReadToEnd());[Console]::Out.Write([Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))':'$b=[Text.Encoding]::UTF8.GetBytes([Console]::In.ReadToEnd());[Console]::Out.Write([Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))');
 const p=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,stdio:['pipe','pipe','pipe']});let out='';p.stdout.setEncoding('utf8');p.stdout.on('data',s=>out+=s);p.stderr.resume();p.on('error',()=>reject(Error('Windows credential encryption is unavailable.')));p.on('close',c=>c===0?resolve(out):reject(Error('Could not read or encrypt local credentials.')));p.stdin.end(text);
});}
const service='bubblecast-secure-store';
function security(args,input){return new Promise((resolve,reject)=>{const p=spawn('/usr/bin/security',args,{stdio:['pipe','pipe','pipe']});let out='';p.stdout.setEncoding('utf8');p.stdout.on('data',s=>out+=s);p.stderr.resume();p.on('error',()=>reject(Error('macOS Keychain is unavailable.')));p.on('close',code=>resolve({code,out}));p.stdin.end(input||'');});}
// The key is written through security's interactive stdin so it never appears in process arguments.
export const macKeychain={
 async get(account){const {code,out}=await security(['find-generic-password','-s',service,'-a',account,'-w']);if(code===44)return null;if(code!==0)throw Error('Could not read the Bubblecast key from macOS Keychain.');return out.trim();},
 async set(account,key){const {code}=await security(['-i'],`add-generic-password -U -s ${service} -a ${account} -w ${key}\n`);if(code!==0)throw Error('Could not save the Bubblecast key to macOS Keychain.');}
};
// macOS: AES-256-GCM file encryption with a per-file key held in the login Keychain.
function keychainCipher(path,keychain){const account=createHash('sha256').update(resolve(path)).digest('hex').slice(0,32);
 const key=async create=>{let hex=await keychain.get(account);if(!/^[0-9a-f]{64}$/.test(hex||'')){if(!create)throw Error('The macOS Keychain key for local credentials is missing.');hex=randomBytes(32).toString('hex');await keychain.set(account,hex);}return Buffer.from(hex,'hex');};
 return {
  async encrypt(text){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',await key(true),iv),data=Buffer.concat([cipher.update(text,'utf8'),cipher.final()]);return 'keychain-v1:'+Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64');},
  async decrypt(text){const [label,body]=text.trim().split(':');if(label!=='keychain-v1'||!body)throw Error('Local credentials were saved on a different system. Reconnect on this computer.');const raw=Buffer.from(body,'base64'),decipher=createDecipheriv('aes-256-gcm',await key(false),raw.subarray(0,12));decipher.setAuthTag(raw.subarray(12,28));return Buffer.concat([decipher.update(raw.subarray(28)),decipher.final()]).toString('utf8');}
 };}
export function secureStore(path,{platform=process.platform,keychain=macKeychain}={}){const cipher=platform==='darwin'?keychainCipher(path,keychain):{encrypt:text=>dpapi(text),decrypt:text=>dpapi(text,true)};return {async read(){try{return JSON.parse(await cipher.decrypt(await readFile(path,'utf8')));}catch(e){if(e.code==='ENOENT')return {};throw e;}},async write(value){await mkdir(dirname(path),{recursive:true});await writeFile(path,await cipher.encrypt(JSON.stringify(value)),{mode:0o600});},async clear(){await rm(path,{force:true});}};}

// Adds the Bubblecast chat dock to OBS as a custom browser dock. OBS keeps custom docks in its config folder
// (user.ini on OBS 31+, global.ini before) under [BasicWindow] ExtraBrowserDocks, a JSON list of
// {title, url, uuid}. OBS rewrites that file when it exits, so it must only be edited while OBS is closed.
import {readFile,writeFile,access} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
export const dockUrl='http://127.0.0.1:3927/dock';
const exists=path=>access(path).then(()=>true,()=>false);
export function obsConfigFolder(env=process.env,platform=process.platform){
 if(platform==='win32')return env.APPDATA?join(env.APPDATA,'obs-studio'):'';
 if(platform==='darwin')return env.HOME?join(env.HOME,'Library','Application Support','obs-studio'):'';
 return env.HOME?join(env.HOME,'.config','obs-studio'):'';
}
export function obsRunning({platform=process.platform,run=execFile}={}){
 return new Promise(resolve=>{if(platform!=='win32'){run('pgrep',['-x','obs'],error=>resolve(!error));return;}
  run('tasklist',['/FI','IMAGENAME eq obs64.exe','/NH'],(error,stdout)=>resolve(!error&&/obs64\.exe/i.test(String(stdout))));});
}
// Returns the ini text with the dock added, or null when a dock for this URL is already there.
export function withDock(text,{title='Bubblecast',url=dockUrl,uuid=randomUUID()}={}){
 const bom=text.startsWith('﻿')?'﻿':'',eol=text.includes('\r\n')?'\r\n':'\n',lines=text.slice(bom.length).split(/\r?\n/);
 let section=lines.findIndex(l=>/^\s*\[BasicWindow\]\s*$/.test(l));
 if(section<0){if(lines.length&&lines.at(-1)==='')lines.pop();lines.push(...(lines.length?['']:[]),'[BasicWindow]');section=lines.length-1;}
 let end=lines.findIndex((l,i)=>i>section&&/^\s*\[.*\]\s*$/.test(l));if(end<0)end=lines.length;
 const at=lines.findIndex((l,i)=>i>section&&i<end&&/^ExtraBrowserDocks=/.test(l));
 let docks=[];if(at>=0){try{const parsed=JSON.parse(lines[at].slice('ExtraBrowserDocks='.length));if(Array.isArray(parsed))docks=parsed;else throw Error();}catch{throw Error('OBS has custom docks Bubblecast could not read. Add the dock in OBS instead: Docks → Custom Browser Docks.');}}
 if(docks.some(d=>String(d?.url||'').replace(/\/$/,'')===url))return null;
 const line='ExtraBrowserDocks='+JSON.stringify([...docks,{title,url,uuid}]);
 if(at>=0)lines[at]=line;else{let insert=end;while(insert>section+1&&lines[insert-1]==='')insert--;lines.splice(insert,0,line);}
 const out=lines.join(eol);return bom+out+(out.endsWith(eol)?'':eol);
}
// Adds the dock if OBS is installed and closed. Never touches OBS while it runs.
export async function addObsDock({folder=obsConfigFolder(),running=obsRunning,title,url}={}){
 if(!folder||!(await exists(folder)))return {status:'no-obs',detail:'OBS was not found on this computer. Install OBS, open it once, then try again.'};
 if(await running())return {status:'obs-running',detail:'Close OBS, then add the dock again. OBS overwrites its settings when it closes.'};
 const file=await exists(join(folder,'user.ini'))?join(folder,'user.ini'):join(folder,'global.ini');
 let text='';try{text=await readFile(file,'utf8');}catch{}
 const next=withDock(text,{title,url});if(next===null)return {status:'present',detail:'The Bubblecast dock is already in OBS.'};
 await writeFile(file,next,'utf8');return {status:'added',detail:'Added the Bubblecast dock to OBS. Open OBS and find it under Docks.'};
}

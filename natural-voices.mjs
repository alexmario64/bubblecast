// Natural voices: Piper (MIT, github.com/rhasspy/piper), a neural voice engine that runs on this computer,
// with voices from huggingface.co/rhasspy/piper-voices. The engine and each voice are downloaded once from
// Studio and checked against the SHA-256 fingerprints below before use. Only voices whose licenses allow
// use on monetized streams are listed. The engine's macOS build is broken upstream, so this is Windows only.
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,writeFile,rm,rename,access} from 'node:fs/promises';
import {join} from 'node:path';

export const ENGINE={win32:{url:'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip',sha256:'f3c58906402b24f3a96d92145f58acba6d86c9b5db896d207f78dc80811efcea',size:22477236,exe:['piper','piper.exe']}};
export const VOICES=[
 {id:'es_MX-claude-high',name:'Claude',label:'Español (México)',lang:'es',license:'Apache 2.0',credit:"",model:{url:'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_MX/claude/high/es_MX-claude-high.onnx',sha256:'3ef40a71ea63852cd8ab7e6fa7d2ecdcfa67a0b47c9c48e3f10e02ee02083ea0',size:63122309},config:{url:'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_MX/claude/high/es_MX-claude-high.onnx.json',sha256:'1afc81f703c0e4cb3b4d7c0dca096b8b54a98806807f0170cf5eb5557723c12d',size:4963}},
 {id:'es_MX-ald-medium',name:'Ald',label:'Español (México)',lang:'es',license:'Public domain',credit:"",model:{url:'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_MX/ald/medium/es_MX-ald-medium.onnx',sha256:'019b3803293c93e34a206dd2e53a3889209a514e786fd7144f7b70196c579b63',size:63201294},config:{url:'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_MX/ald/medium/es_MX-ald-medium.onnx.json',sha256:'5a71498158e04afc8099bfd019c7e87c68eb9d042505a2b1a87e5c1ac2b1a61d',size:4878}},
 {id:'es_AR-daniela-high',name:'Daniela',label:'Español (Argentina)',lang:'es',license:'CC BY-SA 4.0',credit:"Voice “Daniela” by the Piper project, CC BY-SA 4.0",model:{url:'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_AR/daniela/high/es_AR-daniela-high.onnx',sha256:'7ceb1fc0dab349418c5b54a639ae9ee595212d7c9ea422220d8419163d5cc985',size:114199011},config:{url:'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_AR/daniela/high/es_AR-daniela-high.onnx.json',sha256:'aedbf69647e1d754c62ecf8e0366ca5f16af3e768e3c6b5329af6eb6bde3852b',size:7248}},
 {id:'es_ES-davefx-medium',name:'Davefx',label:'Español (España)',lang:'es',license:'CC0',credit:"",model:{url:'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/davefx/medium/es_ES-davefx-medium.onnx',sha256:'6658b03b1a6c316ee4c265a9896abc1393353c2d9e1bca7d66c2c442e222a917',size:63201294},config:{url:'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/davefx/medium/es_ES-davefx-medium.onnx.json',sha256:'0e0dda87c732f6f38771ff274a6380d9252f327dca77aa2963d5fbdf9ec54842',size:4817}},
 {id:'es_ES-sharvard-medium',name:'Sharvard',label:'Español (España)',lang:'es',license:'CC BY 3.0',credit:"Voice “Sharvard” by the Piper project, CC BY 3.0",model:{url:'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/sharvard/medium/es_ES-sharvard-medium.onnx',sha256:'40febfb1679c69a4505ff311dc136e121e3419a13a290ef264fdf43ddedd0fb1',size:76733615},config:{url:'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/sharvard/medium/es_ES-sharvard-medium.onnx.json',sha256:'7438c9b699c72b0c3388dae1b68d3f364dc66a2150fe554a1c11f03372957b2c',size:4903}},
 {id:'en_US-ljspeech-high',name:'LJSpeech',label:'English (US)',lang:'en',license:'Public domain',credit:"",model:{url:'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ljspeech/high/en_US-ljspeech-high.onnx',sha256:'5d4f08ba6a2a48c44592eed3ce56bf85e9de3dd4e20df90541ae68a8310c029a',size:114199011},config:{url:'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ljspeech/high/en_US-ljspeech-high.onnx.json',sha256:'7e1f4634af596d83cca997fb7a931ba80b70f8a316a2655ee69c55365e0ace14',size:4970}},
 {id:'en_US-kristin-medium',name:'Kristin',label:'English (US)',lang:'en',license:'Public domain',credit:"",model:{url:'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/kristin/medium/en_US-kristin-medium.onnx',sha256:'5849957f929cbf720c258f8458692d6103fff2f0e3d3b19c8259474bb06a18d4',size:63531379},config:{url:'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/kristin/medium/en_US-kristin-medium.onnx.json',sha256:'5681426d4aead22195de70531eeeeddb46493cfaffc5764b2ea3db73428b651c',size:4968}},
 {id:'en_US-joe-medium',name:'Joe',label:'English (US)',lang:'en',license:'CC0',credit:"",model:{url:'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/joe/medium/en_US-joe-medium.onnx',sha256:'58afce0321b8d9c46d7cdf9c16500cc55a793b4220212dba6b70fb788b3baf06',size:63201294},config:{url:'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/joe/medium/en_US-joe-medium.onnx.json',sha256:'3d6d5410b3795cb1950595247ef8f06190719e6fdbfa3a2356d8ec368e1aad33',size:4794}}
];
const exists=p=>access(p).then(()=>true,()=>false);
async function download({url,sha256},request){const r=await request(url,{signal:AbortSignal.timeout(900000)});if(!r.ok)throw Error('Download failed: HTTP '+r.status);
 const data=Buffer.from(await r.arrayBuffer());if(createHash('sha256').update(data).digest('hex')!==sha256)throw Error('The download did not match its fingerprint.');return data;}
function unpack(archive,dir){return new Promise((resolve,reject)=>{const child=spawn('tar',['-xf',archive,'-C',dir],{windowsHide:true,stdio:'ignore'});child.on('error',reject);child.on('close',code=>code===0?resolve():reject(Error('Could not unpack the voice engine.')));});}

export class NaturalVoices{
 constructor({dir,platform=process.platform,request=fetch,run=spawn,voices=VOICES,engine=ENGINE}){Object.assign(this,{dir,platform,request,run,voices,engine});this.jobs=new Map();}
 get supported(){return !!this.engine[this.platform];}
 engineExe(){return join(this.dir,...this.engine[this.platform].exe);}
 async installed(id){return (await exists(join(this.dir,'voices',id+'.onnx')))&&(await exists(join(this.dir,'voices',id+'.onnx.json')));}
 async list(){return Promise.all(this.voices.map(async v=>({id:v.id,name:v.name,label:v.label,lang:v.lang,license:v.license,credit:v.credit,size:v.model.size,installed:this.supported&&await this.installed(v.id),job:this.jobs.has(v.id)?{stage:this.jobs.get(v.id).stage,detail:this.jobs.get(v.id).detail||''}:null})));}
 // Downloads the engine (once) and the voice; files are only moved into place after their fingerprints match.
 install(id){const v=this.voices.find(v=>v.id===id);if(!v)throw Error('Unknown voice.');if(!this.supported)throw Error('Natural voices need the Windows app.');
  if(this.jobs.get(id)?.stage==='downloading')return this.jobs.get(id).done;const job={stage:'downloading'};this.jobs.set(id,job);
  return job.done=(async()=>{try{await mkdir(join(this.dir,'voices'),{recursive:true});
   if(!await exists(this.engineExe())){const e=this.engine[this.platform],zip=join(this.dir,'engine.zip');await writeFile(zip,await download(e,this.request));await unpack(zip,this.dir);await rm(zip,{force:true});if(!await exists(this.engineExe()))throw Error('The voice engine was not where expected.');}
   for(const [part,ext] of [[v.config,'.onnx.json'],[v.model,'.onnx']]){const data=await download(part,this.request),file=join(this.dir,'voices',id+ext);await writeFile(file+'.part',data);await rename(file+'.part',file);}
   this.jobs.delete(id);}
  catch(e){this.jobs.set(id,{stage:'failed',detail:String(e.message||e)});}})();}
 async remove(id){if(!this.voices.some(v=>v.id===id))throw Error('Unknown voice.');for(const ext of ['.onnx','.onnx.json'])await rm(join(this.dir,'voices',id+ext),{force:true});}
 // Speaks text into a WAV file. The text goes in through stdin; rate -10..10 maps to Piper's length scale.
 speak({id,text,rate,out}){return new Promise((resolve,reject)=>{if(!this.voices.some(v=>v.id===id))return reject(Error('Unknown voice.'));
  const child=this.run(this.engineExe(),['--model',join(this.dir,'voices',id+'.onnx'),'--output_file',out,'--length_scale',String(Math.max(.5,Math.min(1.6,1-rate*.04))),'--speaker','0'],{windowsHide:true,stdio:['pipe','ignore','pipe']});
  let err='';const timer=setTimeout(()=>{child.kill();reject(Error('The voice took too long.'));},30000);
  child.stderr?.on('data',d=>err+=d);child.on('error',e=>{clearTimeout(timer);reject(e);});child.on('close',code=>{clearTimeout(timer);code===0?resolve():reject(Error(err.trim().split('\n').pop()||'The natural voice failed.'));});
  child.stdin.end(text.replace(/\s+/g,' ')+'\n','utf8');});}
}

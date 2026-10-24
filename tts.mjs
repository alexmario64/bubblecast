// Text to speech: turns chat into spoken audio with the computer's own voices (Windows speech, macOS say),
// one message at a time, for the /tts browser source to play through OBS. Chat text reaches the voice engine
// through a temporary file and environment variables, never a command line.
import {spawn} from 'node:child_process';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';

const platformKey={twitch:'ttsTwitch',youtube:'ttsYoutube',tiktok:'ttsTiktok',kick:'ttsKick'};
const same=(a,b)=>String(a||'').trim().toLowerCase()===String(b||'').trim().toLowerCase();
// What a message should say, or null. `m` is a normalized chat message, `s` the settings.
export function speechText(m,s,lang='en'){
 if(!s.ttsEnabled||!m||!s[platformKey[m.platform]])return null;
 let text=(m.parts||[]).filter(p=>p.type==='text').map(p=>p.text).join(' ');
 text=text.replace(/https?:\/\/\S+|www\.\S+/gi,' ').replace(/(\S)\1{3,}/g,'$1$1$1').replace(/\s+/g,' ').trim();
 const roles=m.roles||[],named=t=>s.ttsReadName?(lang==='es'?`${m.user} dice: `:`${m.user} says: `)+t:t;
 const cap=t=>t.length>s.ttsMaxLength?t.slice(0,s.ttsMaxLength).replace(/\s+\S*$/,'')+'…':t;
 if(m.event){
  // A channel point reward with the chosen name reads what the viewer typed.
  if(m.event.kind==='redemption'&&s.ttsReward&&same(m.event.title,s.ttsReward))return text?named(cap(text)):null;
  if(!s.ttsEvents)return null;return cap([m.event.title,text].filter(Boolean).join('. '));
 }
 const allowed=roles.includes('broadcaster')||s.ttsEveryone||s.ttsSubscribers&&roles.includes('subscriber')||s.ttsVips&&roles.includes('vip')||s.ttsMods&&roles.includes('moderator');
 if(!allowed)return null;
 const command=s.ttsCommand.toLowerCase(),lower=text.toLowerCase();
 if(s.ttsCommandOn&&(lower===command||lower.startsWith(command+' ')))text=text.slice(command.length).trim();
 else if(!s.ttsReadAll)return null;
 return text?named(cap(text)):null;
}

// ---- Voice engines ----
const PS_SPEAK=`Add-Type -AssemblyName System.Speech
$s=New-Object System.Speech.Synthesis.SpeechSynthesizer
if($env:BC_VOICE){try{$s.SelectVoice($env:BC_VOICE)}catch{}}
$s.Rate=[int]$env:BC_RATE
$s.SetOutputToWaveFile($env:BC_OUT)
$s.Speak([IO.File]::ReadAllText($env:BC_IN,[Text.Encoding]::UTF8))
$s.Dispose()`;
const PS_VOICES=`Add-Type -AssemblyName System.Speech
$s=New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.GetInstalledVoices()|Where-Object{$_.Enabled}|ForEach-Object{$_.VoiceInfo.Name+'|'+$_.VoiceInfo.Culture.Name}`;
function run(cmd,args,env={},timeout=20000){return new Promise((resolve,reject)=>{const child=spawn(cmd,args,{env:{...process.env,...env},windowsHide:true,stdio:['ignore','pipe','pipe']});let out='',err='';const timer=setTimeout(()=>{child.kill();reject(Error('The voice took too long.'));},timeout);
 child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);child.on('error',e=>{clearTimeout(timer);reject(e);});child.on('close',code=>{clearTimeout(timer);code===0?resolve(out):reject(Error(err.trim().split('\n')[0]||'The voice engine failed.'));});});}
const powershell=script=>['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command',script];
export const engines={
 async voices(platform=process.platform){
  if(platform==='win32')return (await run('powershell.exe',powershell(PS_VOICES))).split(/\r?\n/).map(l=>l.trim()).filter(Boolean).map(l=>{const [name,lang]=l.split('|');return {name,lang:lang||''};});
  if(platform==='darwin')return (await run('say',['-v','?'])).split('\n').map(l=>l.match(/^(.+?)\s{2,}([a-z]{2}[_-][A-Z]{2})\s/)).filter(Boolean).map(m=>({name:m[1].trim(),lang:m[2].replace('_','-')}));
  return [];
 },
 async speak({text,voice,rate,out,input,platform=process.platform}){
  await writeFile(input,text,'utf8');
  if(platform==='win32')return run('powershell.exe',powershell(PS_SPEAK),{BC_IN:input,BC_OUT:out,BC_VOICE:voice||'',BC_RATE:String(rate)});
  if(platform==='darwin')return run('say',['-o',out,'--file-format=WAVE','--data-format=LEI16@22050','-r',String(Math.round(180*(1+rate/12))),...(voice?['-v',voice]:[]),'-f',input]);
  throw Error('Text to speech needs Windows or macOS.');
 },
};

// ---- The queue: one message is voiced at a time and handed to the /tts pages. ----
export class Speech{
 constructor({emit,engine=engines,dir=join(tmpdir(),'bubblecast-tts'),now=Date.now,keepMs=300000}){Object.assign(this,{emit,engine,dir,now,keepMs});this.queue=[];this.busy=false;this.files=new Map();this.recent=new Map();this.voiceList=null;this.error=null;}
 async voices(){if(!this.voiceList)try{this.voiceList=await this.engine.voices();}catch(e){this.error=String(e.message||e);return [];}return this.voiceList;}
 // Spanish voices say "dice", others "says".
 lang(s){const v=this.voiceList?.find(v=>v.name===s.ttsVoice);return (v?.lang||s.language||'en').slice(0,2);}
 consider(m,s){const text=speechText(m,s,this.lang(s));if(!text)return false;
  const key=m.platform+':'+(m.userId||m.user),t=this.now();
  const last=this.recent.get(key);if(!m.event&&!(m.roles||[]).includes('broadcaster')&&s.ttsCooldown&&last!==undefined&&t-last<s.ttsCooldown*1000)return false;
  this.recent.set(key,t);while(this.recent.size>2000)this.recent.delete(this.recent.keys().next().value);
  this.enqueue(text,m,s);return true;}
 test(s){this.enqueue(this.lang(s)==='es'?'Hola, esta es la voz de Bubblecast.':'Hi, this is the Bubblecast voice.',{user:'Bubblecast',platform:'test'},s);}
 enqueue(text,m,s){if(this.queue.length>=10)this.queue.shift();this.queue.push({id:randomUUID(),text,user:m.user,platform:m.platform,voice:s.ttsVoice,rate:s.ttsRate,volume:s.ttsVolume});this.pump();}
 skip(){this.emit('tts-skip',{});}
 file(id){return this.files.get(id)||null;}
 async pump(){if(this.busy)return;const job=this.queue.shift();if(!job)return;this.busy=true;
  try{await mkdir(this.dir,{recursive:true});const out=join(this.dir,job.id+'.wav'),input=join(this.dir,job.id+'.txt');
   try{await this.engine.speak({text:job.text,voice:job.voice,rate:job.rate,out,input});}finally{rm(input,{force:true}).catch(()=>{});}
   this.files.set(job.id,out);this.error=null;
   this.emit('tts',{id:job.id,url:'/api/tts/audio/'+job.id,text:job.text,user:job.user,platform:job.platform,volume:job.volume});
   setTimeout(()=>{this.files.delete(job.id);rm(out,{force:true}).catch(()=>{});},this.keepMs).unref?.();
  }catch(e){this.error='Text to speech failed: '+(e.message||e);}
  finally{this.busy=false;this.pump();}}
}

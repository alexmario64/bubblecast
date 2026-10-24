import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile,readFile,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {NaturalVoices,VOICES,ENGINE} from '../natural-voices.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const exists=p=>access(p).then(()=>true,()=>false);
const model=Buffer.from('model bytes'),config=Buffer.from('{"audio":{"sample_rate":22050}}');
const voice={id:'es_TEST-sample-medium',name:'Sample',label:'Español (Prueba)',lang:'es',license:'CC0',credit:'',model:{url:'https://huggingface.co/x/model.onnx',sha256:sha(model),size:model.length},config:{url:'https://huggingface.co/x/model.onnx.json',sha256:sha(config),size:config.length}};
async function setup(t,files={}){const dir=await mkdtemp(join(tmpdir(),'bubblecast-natural-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 // The engine is already in place, so only the voice is downloaded.
 await mkdir(join(dir,'piper'),{recursive:true});await writeFile(join(dir,'piper','piper.exe'),'');
 const request=async url=>({ok:true,arrayBuffer:async()=>{const b=files[url]??(url.endsWith('.json')?config:model);return b.buffer.slice(b.byteOffset,b.byteOffset+b.length);}});
 return {dir,voices:new NaturalVoices({dir,platform:'win32',request,voices:[voice],engine:ENGINE})};}
test('only voices whose licenses allow monetized streams are listed, each with pinned fingerprints',()=>{
 assert.ok(VOICES.some(v=>v.lang==='es')&&VOICES.some(v=>v.lang==='en'));
 for(const v of VOICES){assert.match(v.model.sha256,/^[a-f0-9]{64}$/);assert.match(v.config.sha256,/^[a-f0-9]{64}$/);assert.ok(!/NC/.test(v.license),v.id);assert.ok(v.model.url.startsWith('https://huggingface.co/rhasspy/piper-voices/'));}
 assert.match(ENGINE.win32.sha256,/^[a-f0-9]{64}$/);assert.ok(ENGINE.win32.url.startsWith('https://github.com/rhasspy/piper/releases/download/'));
 assert.equal(new NaturalVoices({dir:'x',platform:'darwin'}).supported,false,'the macOS engine build is broken upstream');
});
test('a voice is installed only when both files match their fingerprints',async t=>{
 const ok=await setup(t);await ok.voices.install(voice.id);assert.ok(await ok.voices.installed(voice.id));assert.deepEqual(await readFile(join(ok.dir,'voices',voice.id+'.onnx')),model);
 const bad=await setup(t,{[voice.model.url]:Buffer.from('tampered')});await bad.voices.install(voice.id);
 assert.equal(await bad.voices.installed(voice.id),false);assert.ok(!await exists(join(bad.dir,'voices',voice.id+'.onnx')));
 const [row]=await bad.voices.list();assert.equal(row.job.stage,'failed');assert.match(row.job.detail,/fingerprint/);
 await ok.voices.remove(voice.id);assert.equal(await ok.voices.installed(voice.id),false);
});
test('speaking sends the text through stdin, never as an argument',async t=>{
 const {dir}=await setup(t);const calls=[];
 const run=(cmd,args)=>{const child=new EventEmitter();child.stderr=new EventEmitter();let input='';child.stdin={end:(text)=>{input=text;setTimeout(()=>child.emit('close',0),1);}};calls.push({cmd,args,get input(){return input;}});return child;};
 const voices=new NaturalVoices({dir,platform:'win32',run,voices:[voice],engine:ENGINE});
 await voices.speak({id:voice.id,text:'Hola $(whoami) & `rm` "todo"',rate:5,out:join(dir,'out.wav')});
 assert.equal(calls[0].cmd,join(dir,'piper','piper.exe'));assert.ok(!calls[0].args.some(a=>a.includes('Hola')),'text is not on the command line');
 assert.equal(calls[0].input,'Hola $(whoami) & `rm` "todo"\n');assert.equal(calls[0].args[calls[0].args.indexOf('--length_scale')+1],'0.8');
 await assert.rejects(voices.speak({id:'nope',text:'x',rate:0,out:'x'}),/Unknown voice/);
});
// Downloads the real engine and a Spanish voice on the Windows test machine and speaks with them.
test('Windows downloads Piper and a Spanish voice and speaks Spanish',{skip:process.platform!=='win32'&&'Windows only',timeout:600000},async t=>{
 const dir=process.env.BUBBLECAST_PIPER_CACHE||await mkdtemp(join(tmpdir(),'bubblecast-piper-'));
 const voices=new NaturalVoices({dir});const id='es_MX-claude-high';await voices.install(id);const [row]=(await voices.list()).filter(v=>v.id===id);assert.equal(row.installed,true,row.job?.detail);
 const out=join(dir,'hola.wav');await voices.speak({id,text:'¡Hola a todos! Bienvenidos al stream.',rate:0,out});
 const wav=await readFile(out);assert.equal(wav.subarray(0,4).toString(),'RIFF');assert.ok(wav.length>20000,'audio was written');
});

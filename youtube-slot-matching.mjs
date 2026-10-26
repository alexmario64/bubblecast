import {createHash} from 'node:crypto';
// Keys are compared locally by a stable digest. No raw ingestion key is stored or passed to callers.
export function streamKeyFingerprint(value){return typeof value==='string'&&value.trim()&&value.length<=4096?'sha256:'+createHash('sha256').update(value.trim()).digest('hex'):'';}
export const validFingerprint=value=>/^sha256:[a-f0-9]{64}$/.test(value||'');
export const validFormat=value=>['horizontal','vertical'].includes(value);
export function matchStreamKey(fingerprint,outputs={}){
 if(!validFingerprint(fingerprint))return '';
 const main=outputs.main?.includes(fingerprint),vertical=outputs.vertical?.includes(fingerprint);
 return main&&vertical?'ambiguous':main?'horizontal':vertical?'vertical':'';
}
// Aitum's config schema comes from its SaveSettings/SaveStreamOutputs implementation. Older versions
// have one stream_server/stream_key pair; current ones store enabled stream_outputs under canvas[].
export function aitumKeyFingerprints(config){
 const canvases=Array.isArray(config?.canvas)?config.canvas:[],keys=[];
 for(const canvas of canvases.slice(0,16)){
  if(!(canvas?.height>canvas?.width))continue;
  const outputs=Array.isArray(canvas.stream_outputs)&&canvas.stream_outputs.length?canvas.stream_outputs:canvas.stream_server?[{stream_key:canvas.stream_key,enabled:true}]:[];
  for(const output of outputs.slice(0,32)){if(output?.enabled!==true)continue;const key=streamKeyFingerprint(output.stream_key);if(key&&!keys.includes(key))keys.push(key);}
 }
 return keys;
}

// Page-only discovery has no ingestion identity. Keep known slots, use real aspect ratios first,
// and break ties by independently observed output/broadcast start order when both are available.
export class OutputStarts{
 constructor(){this.outputs={};this.starts={};}
 update(outputs,now){
  if(!outputs.main&&!outputs.vertical)this.starts={};
  for(const key of ['main','vertical'])if(outputs[key]&&!this.outputs[key])this.starts[key]=now;
  this.outputs={...outputs};
 }
}
export function pageCandidates(videos,{formats={},hidden=[],prior=[],outputs={},starts={}}={}){
 const seen=new Set(),candidates=videos.filter(v=>v&&!seen.has(v.video)&&seen.add(v.video)).map(v=>{
  const remembered=prior.find(p=>p.video===v.video),manual=formats[v.video];
  const format=validFormat(manual)?manual:typeof v.vertical==='boolean'?(v.vertical?'vertical':'horizontal'):validFormat(remembered?.format)?remembered.format:'';
  return {video:v.video,title:String(v.title||'').slice(0,120),hidden:hidden.includes(v.video),format,formatSource:validFormat(manual)?'manual':typeof v.vertical==='boolean'?'aspect':format?'previous-slot':'unknown',startedAt:Number.isFinite(v.startedAt)&&v.startedAt>0?v.startedAt:0};
 });
 const available=['main','vertical'].filter(key=>outputs[key]&&!candidates.some(c=>!c.hidden&&c.format===(key==='main'?'horizontal':'vertical')));
 const unknown=candidates.filter(c=>!c.hidden&&!c.format);
 if(available.length===1&&unknown.length===1){unknown[0].format=available[0]==='main'?'horizontal':'vertical';unknown[0].formatSource='output-start';}
 else if(available.length===2&&unknown.length===2&&starts.main>0&&starts.vertical>0&&starts.main!==starts.vertical&&unknown.every(c=>c.startedAt>0)&&unknown[0].startedAt!==unknown[1].startedAt){
  available.sort((a,b)=>starts[a]-starts[b]);unknown.sort((a,b)=>a.startedAt-b.startedAt);for(let i=0;i<2;i++){unknown[i].format=available[i]==='main'?'horizontal':'vertical';unknown[i].formatSource='output-start';}
 }
 return candidates;
}

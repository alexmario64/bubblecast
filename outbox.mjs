export const destinations=['twitch','youtube','youtubeShorts','tiktok','kick'];
export class Outbox {
 constructor({now=Date.now}={}){this.now=now;this.jobs=new Map();}
 enqueue(data,urls){
  const id=typeof data.requestId==='string'&&/^[a-zA-Z0-9-]{8,80}$/.test(data.requestId)?data.requestId:null;if(!id)throw Error('Invalid message request.');
  if(this.jobs.has(id))return {job:this.jobs.get(id),fresh:false};
  const text=typeof data.text==='string'?data.text.trim():'';
  if(!text||[...text].length>500||/[\r\n\x00-\x08\x0b-\x1f]/.test(text))throw Error('Enter a single message of up to 500 characters.');
  if(text.startsWith('/'))throw Error('Send chat commands directly on the platform.');
  const targets=[...new Set(Array.isArray(data.targets)?data.targets:[])];
  if(!targets.length||targets.some(k=>!destinations.includes(k)||!urls[k]))throw Error('Choose a configured chat destination.');
  if(targets.some(k=>k.startsWith('youtube'))&&[...text].length>200)throw Error('YouTube messages must be 200 characters or fewer.');
  const job={id,text,createdAt:this.now(),results:Object.fromEntries(targets.map(k=>[k,{status:'queued',detail:'Waiting for helper'}])),urls:Object.fromEntries(targets.map(k=>[k,urls[k]]))};
  this.jobs.set(id,job);while(this.jobs.size>100)this.jobs.delete(this.jobs.keys().next().value);return {job,fresh:true};
 }
 claim(id){const job=this.jobs.get(id);if(!job)return null;for(const result of Object.values(job.results))if(result.status==='queued')Object.assign(result,{status:'sending',detail:'Submitting to platform'});return job;}
 result(id,target,result){const job=this.jobs.get(id),entry=job?.results[target];if(!entry||!['queued','sending'].includes(entry.status))return null;entry.status=['submitted','failed','unknown'].includes(result.status)?result.status:'unknown';entry.detail=String(result.detail||'').slice(0,250);return job;}
 get(id){const job=this.jobs.get(id);if(!job)return null;if(this.now()-job.createdAt>30000)for(const r of Object.values(job.results))if(['queued','sending'].includes(r.status))Object.assign(r,{status:'unknown',detail:'No confirmation from helper. Check chat before sending again.'});return job;}
 public(job){if(!job)return null;return {id:job.id,createdAt:job.createdAt,results:job.results};}
}

import {Outbox} from './outbox.mjs';
export const pollDestinations=['twitch','kick','youtube','youtubeShorts'];
export function pollSpecification(raw){
 const question=typeof raw.question==='string'?raw.question.trim():'';const choices=Array.isArray(raw.choices)?raw.choices.map(v=>typeof v==='string'?v.trim():''):[];const duration=Number(raw.duration||120);
 if(!question||[...question].length>60||/[\r\n\x00-\x1f]/.test(question))throw Error('Enter a poll question of up to 60 characters.');
 if(choices.length!==2||choices.some(v=>!v||[...v].length>25||/[\r\n\x00-\x1f]/.test(v)))throw Error('Add two answers, each up to 25 characters.');
 if(Array.isArray(raw.targets)&&raw.targets.includes('kick')&&choices.some(v=>[...v].length<2))throw Error('Kick requires each poll answer to contain at least 2 characters. No poll was queued.');
 if(new Set(choices.map(v=>v.toLowerCase())).size!==choices.length)throw Error('Use a different answer for each choice.');
 if(![120,180,300].includes(duration))throw Error('Choose a supported poll duration.');return {question,choices,duration};
}
export class PollJobs extends Outbox{
 enqueue(raw,urls,activePolls=[]){
  const id=typeof raw.requestId==='string'&&/^[a-zA-Z0-9-]{8,80}$/.test(raw.requestId)?raw.requestId:null;if(!id)throw Error('Invalid poll request.');if(this.jobs.has(id))return {job:this.jobs.get(id),fresh:false};
  const spec=pollSpecification(raw),targets=[...new Set(Array.isArray(raw.targets)?raw.targets:[])];if(!targets.length||targets.some(k=>!pollDestinations.includes(k)||!urls[k]))throw Error('Choose connected Twitch, Kick, or YouTube destinations.');
  const busy=activePolls.find(p=>targets.includes(p.sourceKey)&&p.status==='active');if(busy)throw Error('End the active '+busy.sourceKey+' poll before starting another.');
  const job={id,spec,createdAt:this.now(),urls:Object.fromEntries(targets.map(k=>[k,urls[k]])),results:Object.fromEntries(targets.map(k=>[k,{status:'queued',detail:'Preparing native poll controls'}]))};this.jobs.set(id,job);while(this.jobs.size>50)this.jobs.delete(this.jobs.keys().next().value);return {job,fresh:true};
 }
 get(id){const job=super.get(id);if(job)for(const result of Object.values(job.results))if(result.status==='unknown'&&result.detail.startsWith('No confirmation from helper.'))result.detail='No poll confirmation from helper. Check the platform before creating another.';return job;}
 public(job){return job?{...super.public(job),spec:job.spec}:null;}
}

export class PollEndJobs extends Outbox{
 enqueue(raw,urls,activePolls=[]){
  const id=typeof raw.requestId==='string'&&/^[a-zA-Z0-9-]{8,80}$/.test(raw.requestId)?raw.requestId:null;if(!id)throw Error('Invalid end-poll request.');if(this.jobs.has(id))return {job:this.jobs.get(id),fresh:false};
  const targets=[...new Set(Array.isArray(raw.targets)?raw.targets:[])];if(!targets.length||targets.some(k=>!pollDestinations.includes(k)||!urls[k]))throw Error('Choose a connected poll destination.');
  for(const other of this.jobs.values())if(targets.some(key=>other.polls?.[key]?.id===raw.pollIds?.[key]&&['queued','sending'].includes(this.get(other.id)?.results[key]?.status)))throw Error('Ending this poll is already in progress. Wait for its result.');
  const selected=targets.map(key=>activePolls.find(p=>p.sourceKey===key&&p.id===raw.pollIds?.[key]&&p.status==='active'));if(selected.some(p=>!p))throw Error('The active poll changed. Refresh before ending it.');
  const job={id,createdAt:this.now(),urls:Object.fromEntries(targets.map(k=>[k,urls[k]])),polls:Object.fromEntries(selected.map(p=>[p.sourceKey,p])),results:Object.fromEntries(targets.map(k=>[k,{status:'queued',detail:'Waiting to end poll'}]))};this.jobs.set(id,job);while(this.jobs.size>50)this.jobs.delete(this.jobs.keys().next().value);return {job,fresh:true};
 }
}

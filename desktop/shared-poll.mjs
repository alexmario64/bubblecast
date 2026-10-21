// Prepare every destination before publishing any of them. No automatic retries.
export async function launchSharedPoll(job,{prepare,publish,confirm,cleanup,now=Date.now}){
 const keys=Object.keys(job.urls),results={};
 if(now()-job.createdAt>30000)return Object.fromEntries(keys.map(k=>[k,{status:'failed',detail:'Poll request expired. Nothing was started.'}]));
 const prepared=await Promise.all(keys.map(async key=>{try{await prepare(key,job.urls[key],job.spec);return [key,true];}catch(e){results[key]={status:'failed',detail:String(e.message||e)};return [key,false];}}));
 if(prepared.some(([,ok])=>!ok)){
  const cleaned=await Promise.all(keys.map(async key=>{try{return [key,cleanup?(await cleanup(key,job.urls[key],job.spec))?.ok===true:false];}catch{return [key,false];}}));
  for(const [key,ok] of prepared)if(ok)results[key]={status:'failed',detail:cleaned.find(([k])=>k===key)?.[1]?'Another destination could not be prepared. Nothing started; Bubblecast cleared its draft.':'Prepared, but another destination could not be prepared. No poll was started. The native draft was preserved.'};
  return results;
 }
 // Every publish attempt is dispatched together, once. Partial launches cannot
 // be rolled back safely; report each result instead of resubmitting.
 await Promise.all(keys.map(async key=>{try{const result=await publish(key,job.urls[key],job.spec);if(result?.ok===false){results[key]={status:'failed',detail:result.detail};return;}results[key]=await confirm(key,job.spec)?{status:'submitted',detail:'Active poll confirmed on the platform.'}:{status:'unknown',detail:'Create was clicked once. The platform has not confirmed the poll; check before trying again.'};}catch(e){results[key]={status:'unknown',detail:'No confirmation. Check this platform before trying again.'};}}));
 return results;
}

const pending=new WeakMap(),last=new WeakMap();
export async function responsiveAccounts(entries,inspect,{timeoutMs=1200,fallback=()=>null}={}){
 return Object.fromEntries(await Promise.all(entries.map(async([key,source])=>{
  let task=pending.get(source);if(!task){task=Promise.resolve().then(()=>inspect(source)).catch(()=>fallback(source)||({state:'unavailable',signedIn:null,canSend:false,detail:'Waiting for chat to finish loading.'})).then(result=>{last.set(source,result);return result;}).finally(()=>pending.delete(source));pending.set(source,task);}
  let timer;const timeout=new Promise(resolve=>{timer=setTimeout(()=>resolve(fallback(source)||{...last.get(source),state:'unavailable',signedIn:last.get(source)?.signedIn??null,canSend:false,detail:'Chat page is taking too long to respond. Refresh this source in Connections.'}),timeoutMs);});
  try{return [key,await Promise.race([task,timeout])];}finally{clearTimeout(timer);}
 })));
}

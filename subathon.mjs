import {readFileSync,writeFileSync,mkdirSync,renameSync} from 'node:fs';
import {dirname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';

const MAX=30*86400,metrics=['subscriptions','bits','money','tiktokGifts','kicks'];
export const subathonDefaults={title:'Subathon',initialSeconds:3600,capSeconds:86400,automatic:false,subscriptionSeconds:180,bitsSeconds:60,moneySeconds:60,tiktokGiftSeconds:10,kicksSeconds:60,currency:'USD',visible:true};
const number=(value,min,max)=>{if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw Error('Enter a number within the allowed range.');return value;};
const label=value=>String(value??'').trim().slice(0,100);
function configuration(patch,previous=subathonDefaults){
 const c={...previous};
 for(const [k,v] of Object.entries(patch||{})){
  if(k==='title'){if(!label(v))throw Error('Enter a title.');c.title=label(v);}
  else if(['initialSeconds','capSeconds'].includes(k))c[k]=Math.round(number(v,1,MAX));
  else if(['subscriptionSeconds','bitsSeconds','moneySeconds','tiktokGiftSeconds','kicksSeconds'].includes(k))c[k]=number(v,0,86400);
  else if(['automatic','visible'].includes(k)){if(typeof v!=='boolean')throw Error('Invalid switch.');c[k]=v;}
  else if(k==='currency'){if(!/^[A-Z]{3}$/.test(v))throw Error('Use a three-letter currency code.');c.currency=v;}
  else throw Error('Unknown subathon setting.');
 }
 if(c.initialSeconds>c.capSeconds)throw Error('The starting time must fit within the time limit.');
 return c;
}
// Quantities come from structured events, never from parsing chat text or currency display strings.
export function subathonSupport(m){
 if(!m||!['twitch','youtube','kick','tiktok'].includes(m.platform)||!m.id)return null;
 const s=m.support;
 if(s&&metrics.includes(s.metric)&&Number.isFinite(s.amount)&&s.amount>0&&s.amount<=1e9){
  if(s.metric==='money'&&!/^[A-Z]{3}$/.test(s.currency||''))return null;
  if(s.metric!=='money'&&!Number.isInteger(s.amount))return null;
  if(s.metric==='tiktokGifts'&&m.platform!=='tiktok'||s.metric==='kicks'&&m.platform!=='kick')return null;
  return {metric:s.metric,amount:s.amount,...(s.metric==='money'?{currency:s.currency}:{})};
 }
 const e=m.event;
 if(['sub','resub','giftsub'].includes(e?.kind))return {metric:'subscriptions',amount:1};
 if(e?.kind==='giftbomb'&&Number.isSafeInteger(e.amount)&&e.amount>0&&e.amount<=100000)return {metric:'subscriptions',amount:e.amount};
 return null;
}
export class Subathon{
 constructor({file,now=()=>performance.now(),wall=Date.now,onChange=()=>{}}={}){
  Object.assign(this,{file,now,wall,onChange});this.at=now();this.error='';this.blocked=false;
  this.data={session:randomUUID(),revision:0,status:'idle',remainingMs:3600000,config:{...subathonDefaults},counters:{subscriptions:0,bits:0,money:0,tiktokGifts:0,kicks:0},addedMs:0,goals:[],seen:[],requests:[],lastAddition:null,savedAt:0};
 }
 load(){
  if(!this.file)return;
  try{const d=JSON.parse(readFileSync(this.file,'utf8'));d.config=configuration(d.config);number(d.remainingMs,0,MAX*1000);if(!['idle','running','paused','ended'].includes(d.status)||!Array.isArray(d.goals)||!Array.isArray(d.seen)||!Array.isArray(d.requests)||!d.session)throw Error();for(const k of metrics)number(d.counters[k],0,1e12);number(d.addedMs,0,Number.MAX_SAFE_INTEGER);if(d.goals.length>12||d.goals.some(g=>!g||typeof g.id!=='string'||typeof g.title!=='string'||!metrics.includes(g.metric)||!Number.isFinite(g.target)||g.target<=0||g.target>1e9))throw Error();this.data=d;
   try{const clock=JSON.parse(readFileSync(this.file+'.clock','utf8'));if(clock.session===d.session&&clock.revision===d.revision)d.remainingMs=number(clock.remainingMs,0,MAX*1000);}catch{}
   if(d.status==='running')d.status=d.remainingMs>0?'paused':'ended';this.at=this.now();
  }catch(e){if(e.code!=='ENOENT'){this.error='Subathon data could not be read.';this.blocked=true;}}
 }
 settle(){const at=this.now();if(this.data.status==='running'){this.data.remainingMs=Math.max(0,this.data.remainingMs-Math.max(0,at-this.at));if(!this.data.remainingMs){this.data.status='ended';this.needsCheckpoint=true;}}this.at=at;}
 snapshot(){this.settle();const {seen,requests,savedAt,...data}=this.data;return structuredClone({...data,error:this.error,blocked:this.blocked,at:this.wall()});}
 write(file,data){if(!file)return;mkdirSync(dirname(file),{recursive:true});writeFileSync(file+'.tmp',JSON.stringify(data),{mode:0o600});renameSync(file+'.tmp',file);}
 save(){this.data.savedAt=this.wall();this.data.revision++;this.write(this.file,this.data);this.needsCheckpoint=false;}
 checkpoint(){
  if(this.data.status!=='running'&&!this.needsCheckpoint)return;
  this.settle();try{this.write(this.file&&this.file+'.clock',{session:this.data.session,revision:this.data.revision,remainingMs:this.data.remainingMs});if(this.data.status==='ended')this.save();this.error='';}
  catch{this.data.status='paused';this.error='Subathon could not be saved. Timer paused.';}
  this.onChange(this.snapshot());
 }
 pauseForShutdown(){if(this.data.status!=='running')return;this.settle();if(this.data.status==='running')this.data.status='paused';try{this.save();}catch{this.error='Subathon could not be saved. Timer paused.';}this.onChange(this.snapshot());}
 transact(change){
  if(this.blocked)throw Error(this.error);this.settle();const before=structuredClone(this.data);
  try{change();this.save();this.error='';}catch(e){this.data=before;throw e;}
  const s=this.snapshot();this.onChange(s);return s;
 }
 add(metric,amount){
  number(amount,0.01,1e9);if(!metrics.includes(metric))throw Error('Choose a support counter.');if(metric!=='money'&&!Number.isInteger(amount))throw Error('Use a whole number for this counter.');
  const d=this.data,c=d.config,seconds=metric==='subscriptions'?c.subscriptionSeconds:metric==='bits'?c.bitsSeconds/100:metric==='tiktokGifts'?c.tiktokGiftSeconds:metric==='kicks'?c.kicksSeconds/100:c.moneySeconds;
  d.counters[metric]=Math.min(1e12,d.counters[metric]+amount);
  const added=Math.min(amount*seconds*1000,Math.max(0,c.capSeconds*1000-d.remainingMs));d.remainingMs+=added;d.addedMs+=added;
  d.lastAddition={id:randomUUID(),metric,amount,addedMs:added,at:this.wall()};
 }
 accept(message){
  this.settle();const d=this.data;if(!d.config.automatic||!['running','paused'].includes(d.status)||message?.id?.startsWith('demo-'))return false;
  const s=subathonSupport(message);if(!s||s.metric==='money'&&s.currency!==d.config.currency)return false;
  const id=createHash('sha256').update(message.platform+':'+message.id).digest('hex');if(d.seen.includes(id))return false;
  try{this.transact(()=>{this.add(s.metric,s.amount);d.seen.push(id);d.seen=d.seen.slice(-5000);});return true;}catch{this.error='Subathon could not be saved. Timer paused.';this.data.status='paused';this.onChange(this.snapshot());return false;}
 }
 command({id,action,...args}={}){
  if(typeof id!=='string'||!/^[\w-]{8,100}$/.test(id))throw Error('A subathon action needs a request ID.');
  if(this.data.requests.includes(id))return this.snapshot();
  return this.transact(()=>{
   const d=this.data;
   if(action==='settings'){
    const next=configuration(args.patch,d.config);if(next.currency!==d.config.currency&&d.counters.money)throw Error('Reset the subathon before changing currency.');d.config=next;d.remainingMs=Math.min(d.remainingMs,next.capSeconds*1000);if(d.status==='idle')d.remainingMs=next.initialSeconds*1000;
   }else if(action==='start'){if(d.status!=='idle')throw Error('Reset the subathon before starting a new one.');d.status='running';}
   else if(action==='pause'){if(d.status==='running')d.status='paused';}
   else if(action==='resume'){if(d.status!=='paused'||d.remainingMs<=0)throw Error('There is no paused time to resume.');d.status='running';}
   else if(action==='end')d.status='ended';
   else if(action==='reset'){d.session=randomUUID();d.status='idle';d.remainingMs=d.config.initialSeconds*1000;d.counters={subscriptions:0,bits:0,money:0,tiktokGifts:0,kicks:0};d.addedMs=0;d.lastAddition=null;}
   else if(action==='adjust'){if(!['running','paused'].includes(d.status))throw Error('Start the subathon before adjusting time.');const prior=d.remainingMs;d.remainingMs=Math.max(0,Math.min(d.config.capSeconds*1000,d.remainingMs+number(args.seconds,-MAX,MAX)*1000));d.addedMs+=Math.max(0,d.remainingMs-prior);if(!d.remainingMs)d.status='ended';}
   else if(action==='support'){if(!['running','paused'].includes(d.status))throw Error('Start the subathon before recording support.');this.add(args.metric,args.amount);}
   else if(action==='goal-add'){if(d.goals.length>=12)throw Error('Use at most 12 goals.');if(!metrics.includes(args.metric)||!label(args.title))throw Error('Enter a goal title and counter.');d.goals.push({id:randomUUID(),title:label(args.title),metric:args.metric,target:number(args.target,0.01,1e9)});}
   else if(action==='goal-remove')d.goals=d.goals.filter(g=>g.id!==args.goalId);
   else throw Error('Unknown subathon action.');
   d.requests=[...d.requests,id].slice(-200);
  });
 }
}

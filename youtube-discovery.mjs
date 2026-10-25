export function youtubeReadMode({configured,connected,quotaUntil=0},now=Date.now()){
 return !configured||quotaUntil>now?'page':connected?'api':'signin';
}

// One finite series per output-start edge. OBS status reports may repeat forever; they must never
// restart an exhausted series. Aitum starting while the main output is already live is a new edge.
export class YouTubeDiscovery{
 constructor({check,filled,now=Date.now,schedule=setTimeout,cancel=clearTimeout,delays=[20000,60000,120000,240000]}){
  Object.assign(this,{check,filled,now,schedule,cancel,delays});this.outputs={main:false,vertical:false};this.timers=[];this.generation=0;this.busy=false;this.state='idle';this.attempt=0;this.startedAt=0;this.nextAt=0;
 }
 update(outputs){
  const next={main:outputs.main===true,vertical:outputs.vertical===true},started=next.main&&!this.outputs.main||next.vertical&&!this.outputs.vertical;this.outputs=next;
  if(!next.main&&!next.vertical){if(this.state!=='idle')this.stop('stopped');return;}
  if(started)this.start();else this.settle();
 }
 start(){
  this.stop('scheduled');this.startedAt=this.now();this.attempt=0;const generation=this.generation;
  if(this.settle())return;
  this.timers=this.delays.map((delay,index)=>({at:this.startedAt+delay,handle:this.schedule(()=>this.run(generation,index),delay)}));this.nextAt=this.timers[0]?.at||0;
 }
 stop(state){for(const t of this.timers)this.cancel(t.handle);this.timers=[];this.nextAt=0;this.generation++;this.state=state;}
 settle(){if((this.outputs.main||this.outputs.vertical)&&this.filled(this.outputs,this.startedAt)){this.stop('complete');return true;}return false;}
 async run(generation,index){
  if(generation!==this.generation||this.settle())return;
  this.nextAt=this.timers[index+1]?.at||0;
  if(this.busy){if(!this.nextAt)this.state='exhausted';return;}
  this.busy=true;this.state='checking';this.attempt++;
  try{await this.check('stream-start');}catch{}finally{this.busy=false;}
  if(generation!==this.generation||this.settle())return;
  this.state=this.nextAt?'scheduled':'exhausted';
 }
 status(){return {state:this.state,attempt:this.attempt,startedAt:this.startedAt,nextAt:this.nextAt,expected:{horizontal:this.outputs.main,vertical:this.outputs.vertical}};}
}

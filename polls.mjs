const str=v=>typeof v==='string'?v.slice(0,500):'';
const number=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
export function normalizePoll(raw){
 if(!['twitch','youtube','kick'].includes(raw?.platform))return null;
 const sourceKey=raw.platform==='kick'?'kick':raw.platform==='twitch'?'twitch':raw.sourceKey==='youtubeShorts'?'youtubeShorts':'youtube';
 const id=str(raw.id),question=str(raw.question),choices=(Array.isArray(raw.choices)?raw.choices:[]).slice(0,10).map((c,i)=>({id:str(c.id)||String(i),text:str(c.text),votes:number(c.votes),percent:number(c.percent)===null?null:Math.min(100,number(c.percent))}));
 if(!id||!question||choices.length<2||choices.some(c=>!c.text))return null;
 const known=choices.every(c=>c.votes!==null),sum=known?choices.reduce((n,c)=>n+c.votes,0):null;
 if(known)for(const c of choices)c.percent=sum>0?c.votes/sum*100:0;
 return {platform:raw.platform,sourceKey,id,question,choices,status:['active','completed','terminated','closed','unavailable'].includes(raw.status)?raw.status:'active',totalVotes:number(raw.totalVotes)??sum,totalLabel:str(raw.totalLabel),endsAt:Number.isFinite(raw.endsAt)?raw.endsAt:null};
}
export class PollStore{
 constructor({now=Date.now,retentionMs=8000}={}){this.polls=new Map();this.retired=new Set();this.now=now;this.retentionMs=retentionMs;}
 prune(){const removed=[];for(const [key,p] of this.polls)if(p.closedAt!==undefined&&this.now()-p.closedAt>=this.retentionMs){this.polls.delete(key);this.retired.add(key+':'+p.id);removed.push({sourceKey:key,id:p.id});}while(this.retired.size>1000)this.retired.delete(this.retired.values().next().value);return removed;}
 accept(raw){const p=normalizePoll(raw);if(!p)return null;if(this.retired.has(p.sourceKey+':'+p.id))return null;const old=this.polls.get(p.sourceKey);if(old&&p.id.startsWith('dom:')&&old.question===p.question&&old.choices.map(c=>c.text).join('|')===p.choices.map(c=>c.text).join('|'))p.id=old.id;
 if(old?.id===p.id){const changedPercent=p.choices.some(c=>c.percent!==null&&old.choices.find(o=>o.id===c.id||o.text===c.text)?.percent!==c.percent);for(const c of p.choices){const before=old.choices.find(o=>o.id===c.id||o.text===c.text);if(before){if(c.percent===null||c.percent===before.percent)c.votes??=before.votes;c.percent??=before.percent;}}if(!changedPercent)p.totalVotes??=old.totalVotes;p.totalLabel||=old.totalLabel;if(['completed','terminated'].includes(old.status)&&!['completed','terminated'].includes(p.status))return null;if(JSON.stringify({...old,updatedAt:undefined,closedAt:undefined})===JSON.stringify(p))return null;}p.updatedAt=this.now();if(['completed','terminated','closed','unavailable'].includes(p.status))p.closedAt=old?.id===p.id&&old.closedAt!==undefined?old.closedAt:this.now();this.polls.set(p.sourceKey,p);return p;}
 clear(){this.polls.clear();this.retired.clear();}
 snapshot(){return [...this.polls.values()].filter(p=>p.closedAt===undefined||this.now()-p.closedAt<this.retentionMs);}
}
const text=v=>typeof v==='string'?v:v?.simpleText||v?.runs?.map(r=>r.text||'').join('')||'';
export function extractPolls(payload,platform,sourceKey=platform){
 const out=[],stack=[payload];let count=0;
 while(stack.length&&count++<20000){const n=stack.pop();if(!n||typeof n!=='object')continue;
 if(platform==='twitch'&&Array.isArray(n.choices)&&(n.__typename==='Poll'||n.title&&n.status&&n.id)){
  const state=String(n.status||'').toUpperCase();const p=normalizePoll({platform,sourceKey,id:n.id,question:n.title,status:/COMPLETED|ARCHIVED/.test(state)?'completed':/TERMINATED|MODERATED|INVALID/.test(state)?'terminated':'active',choices:n.choices.map(c=>({id:c.id,text:c.title||c.text,votes:c.totalVotes??c.votes?.total??(typeof c.votes==='number'?c.votes:null)})),totalVotes:n.totalVotes,endsAt:Date.parse(n.endsAt||n.endedAt)});if(p)out.push(p);
 }
 if(platform==='youtube'){
  const r=n.liveChatPollRenderer||n.liveChatBannerPollRenderer;
  if(r){const poll=r.poll?.pollRenderer||r.pollRenderer||r,header=r.header?.liveChatPollHeaderRenderer||r.header?.pollHeaderRenderer||r.header||r;const p=normalizePoll({platform,sourceKey,id:poll.liveChatPollId||r.liveChatPollId||r.id||r.liveChatPollStateEntityKey,question:text(header.pollQuestion||r.pollQuestion),status:/ENDED|CLOSED/.test(header.liveChatPollType||r.status||'')?'completed':'active',totalLabel:text(poll.totalVotes||header.metadataText),choices:(poll.choices||r.pollChoices||[]).map(c=>({id:c.pollOptionId||c.id,text:text(c.text),percent:typeof c.voteRatioIfNotSelected==='number'?c.voteRatioIfNotSelected*100:null}))});if(p)out.push(p);}
 }
 for(const v of Object.values(n)){if(v&&typeof v==='object')stack.push(v);else if(platform==='twitch'&&typeof v==='string'&&v.length<1048576&&/^[{[]/.test(v)){try{stack.push(JSON.parse(v));}catch{}}}
 }
 return out;
}

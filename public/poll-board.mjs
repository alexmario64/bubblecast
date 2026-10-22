const labels={twitch:'Twitch',kick:'Kick',youtube:'YouTube Live',youtubeShorts:'YouTube Shorts Live'};
const active=p=>p.status==='active';
const identity=p=>p.sourceKey+':'+p.id;
const normalized=s=>s.trim().toLocaleLowerCase();
const validPoll=p=>p&&Object.hasOwn(labels,p.sourceKey)&&typeof p.id==='string'&&typeof p.question==='string'&&p.question.trim()&&Array.isArray(p.choices)&&p.choices.length>=2&&p.choices.every(c=>typeof c.text==='string'&&c.text.trim());
export function groupPollResults(polls){
 const groups=new Map();
 for(const poll of polls){
  if(!validPoll(poll))continue;
  const key=JSON.stringify([normalized(poll.question),poll.choices.map(c=>normalized(c.text)).sort(),poll.groupId||'']);
  if(!groups.has(key))groups.set(key,{key,question:poll.question,polls:[],choices:poll.choices.map(c=>({text:c.text,votes:0,percent:null}))});
  groups.get(key).polls.push(poll);
 }
 for(const group of groups.values()){
  const counted=group.polls.filter(p=>p.choices.every(c=>Number.isFinite(c.votes)));
  group.counted=counted.length;group.missing=group.polls.filter(p=>!counted.includes(p));
  for(const choice of group.choices)choice.votes=counted.reduce((n,p)=>n+(p.choices.find(c=>normalized(c.text)===normalized(choice.text))?.votes||0),0);
  group.totalVotes=group.choices.reduce((n,c)=>n+c.votes,0);
  for(const choice of group.choices){choice.percent=counted.length?(group.totalVotes?choice.votes/group.totalVotes*100:0):null;if(!counted.length)choice.votes=null;}
 }
 return [...groups.values()];
}

export function mountPollBoard({document,storage,post}){
 const setTimer=(fn,ms)=>document.defaultView.setTimeout(fn,ms),clearTimer=id=>document.defaultView.clearTimeout(id);
 const area=document.querySelector('#polls'),records=new Map(),cards=new Map(),dismissed=new Set(),operations=new Map(),timers=new Map(),pendingGroups=new Map();
 let noticeTimer,mode='combined';try{mode=storage.getItem('bubblecast-poll-view')==='separate'?'separate':'combined';}catch{}
 const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
 const toolbar=el('div','poll-toolbar'),heading=el('strong','','Polls'),switcher=el('div','poll-view-switch');switcher.setAttribute('aria-label','Poll results view');
 const toggles=[];for(const [value,text] of [['combined','Combined'],['separate','By platform']]){const button=el('button','',text);button.type='button';button.onclick=()=>{mode=value;try{storage.setItem('bubblecast-poll-view',mode);}catch{}render();};switcher.append(button);toggles.push([value,button]);}
 const endAll=el('button','poll-end-all','End all');endAll.type='button';endAll.title='End every active poll in this chat view';toolbar.append(heading,switcher,endAll);
 const content=el('div','poll-board-cards'),announcement=el('p','poll-board-notice');announcement.setAttribute('role','status');
 const strip=el('div','poll-strip'),openResults=el('button','poll-strip-open'),stripText=el('span','poll-strip-text'),stripTitle=el('strong'),stripMeta=el('small'),stripLogos=el('span','panel-platforms'),stripEnd=el('button','poll-strip-end','End all');openResults.type='button';stripEnd.type='button';stripText.append(stripTitle,stripMeta);openResults.append(stripLogos,stripText,el('span','poll-strip-chevron','Results ›'));strip.append(openResults,stripEnd);area.append(strip,announcement);
 const view=document.defaultView,embedded=document.body.classList.contains('dock-pane')&&view.parent!==view;
 const pane=el('aside','poll-results-pane');pane.id='pollResultsPane';pane.hidden=true;pane.setAttribute('aria-label','Poll results');
 const paneHead=el('div','poll-results-heading'),paneTitle=el('strong','','Polls'),newPoll=el('button','poll-pane-new','New poll'),close=el('button','','×');newPoll.type='button';newPoll.onclick=()=>document.querySelector('#newPoll')?.click();close.type='button';close.setAttribute('aria-label','Close poll pane');paneHead.append(paneTitle,newPoll,close);const paneBody=el('div','poll-results-body'),empty=el('p','poll-pane-empty','No polls yet. Start a poll here or on a platform.');paneBody.append(empty,content);const footer=el('div','poll-pane-footer'),overlayLink=el('a','','Preview overlay ↗'),copyOverlay=el('button','','Copy overlay URL');overlayLink.href='/poll-overlay?preview=1';overlayLink.target='_blank';overlayLink.rel='noopener';copyOverlay.type='button';copyOverlay.onclick=async()=>{try{await view.navigator.clipboard.writeText(view.location.origin+'/poll-overlay');copyOverlay.textContent='Copied ✓';setTimer(()=>copyOverlay.textContent='Copy overlay URL',1800);}catch{announcement.textContent='OBS Browser source: '+view.location.origin+'/poll-overlay';}};footer.append(overlayLink,copyOverlay);pane.append(paneHead,toolbar,announcement,paneBody,footer);
 const shell=el('div','dock-chat-and-polls'),chatRegion=el('div','dock-chat-region'),divider=el('div','poll-pane-divider');divider.hidden=true;divider.tabIndex=0;divider.setAttribute('role','separator');divider.setAttribute('aria-label','Resize poll pane');divider.setAttribute('aria-orientation','vertical');const single=document.querySelector('#singleView'),workspace=document.querySelector('#chatWorkspace');if(single){single.before(shell);chatRegion.append(single);if(workspace)chatRegion.append(workspace);}else{area.before(shell);for(const id of ['polls','scroll','jump','composer']){const node=document.getElementById(id);if(node)chatRegion.append(node);}}shell.append(chatRegion,divider,pane);
 const toggle=el('button','toggle-poll-pane','Polls');toggle.id='togglePollPane';toggle.type='button';toggle.setAttribute('aria-controls',pane.id);toggle.setAttribute('aria-expanded','false');const tools=document.querySelector('.layout-tools')||document.querySelector('.chat-tools');if(tools)tools.append(toggle);else shell.before(toggle);
 function show(open=true){if(embedded){view.parent.postMessage({type:'bubblecast-show-polls'},view.location.origin);return;}pane.hidden=!open;divider.hidden=!open;shell.classList.toggle('poll-pane-open',open);toggle.setAttribute('aria-expanded',String(open));if(open)render();}
 toggle.onclick=()=>show(pane.hidden);close.onclick=()=>show(false);openResults.onclick=()=>show(true);
 view.addEventListener('message',event=>{if(!embedded&&event.origin===view.location.origin&&event.data?.type==='bubblecast-show-polls'&&[...document.querySelectorAll('iframe')].some(frame=>frame.contentWindow===event.source))show(true);});
 let ratio=.44;try{const saved=Number(storage.getItem('bubblecast-poll-pane-ratio'));if(saved>=.25&&saved<=.65)ratio=saved;}catch{}const resize=value=>{ratio=Math.max(.25,Math.min(.65,value));shell.style.setProperty('--poll-pane-share',ratio*100+'%');try{storage.setItem('bubblecast-poll-pane-ratio',String(ratio));}catch{}};resize(ratio);
 let dragId;divider.onpointerdown=event=>{dragId=event.pointerId;divider.setPointerCapture?.(dragId);shell.classList.add('resizing');event.preventDefault();};divider.onpointermove=event=>{if(dragId!==event.pointerId)return;const rect=shell.getBoundingClientRect(),vertical=rect.width<620;resize(vertical?(rect.bottom-event.clientY)/rect.height:(rect.right-event.clientX)/rect.width);};const stop=()=>{dragId=undefined;shell.classList.remove('resizing');};divider.onpointerup=stop;divider.onpointercancel=stop;divider.onkeydown=event=>{if(['ArrowLeft','ArrowUp','ArrowRight','ArrowDown'].includes(event.key)){event.preventDefault();resize(ratio+(['ArrowLeft','ArrowUp'].includes(event.key)?.05:-.05));}};

 function visiblePolls(){return [...records.values()].filter(p=>!dismissed.has(identity(p)));}
 function opFor(p){return operations.get(identity(p));}
 async function endPolls(selected){
  const targets=selected.filter(p=>active(p)&&!['queued','sending','unknown','submitted'].includes(opFor(p)?.status));if(!targets.length)return;
  for(const p of targets)operations.set(identity(p),{status:'sending',detail:'Ending…'});render();
  try{
   let job=await post('polls/end',{requestId:crypto.randomUUID(),targets:targets.map(p=>p.sourceKey),pollIds:Object.fromEntries(targets.map(p=>[p.sourceKey,p.id]))});
   for(let i=0;i<76;i++){
    for(const p of targets)if(job.results?.[p.sourceKey])operations.set(identity(p),job.results[p.sourceKey]);render();
    if(!Object.values(job.results||{}).some(r=>['queued','sending'].includes(r.status)))break;
    await new Promise(r=>setTimeout(r,400));job=await post('polls/end/status',{id:job.id});if(job.error)throw Error(job.error);
   }
   for(const p of targets)if(['sending','queued'].includes(opFor(p)?.status))operations.set(identity(p),{status:'unknown',detail:'End result unconfirmed. Check the platform before trying again.'});
  }catch(error){for(const p of targets)operations.set(identity(p),{status:'unknown',detail:error.message+' No automatic retry was attempted.'});}
  render();
 }
 endAll.onclick=()=>endPolls(visiblePolls());stripEnd.onclick=endAll.onclick;
 function paintChoices(choices,existing){const list=existing||el('ol','poll-choices');for(let i=0;i<choices.length;i++){const c=choices[i];let row=list.children[i];if(!row){row=el('li');row.append(el('span'),el('span'));list.append(row);}row.children[0].textContent=c.text;row.children[1].textContent=(c.percent==null?'—':Math.round(c.percent)+'%')+(c.votes!=null?' · '+c.votes.toLocaleString()+(c.votes===1?' vote':' votes'):'');let bar=row.querySelector('progress');if(c.percent!=null){if(!bar){bar=el('progress');bar.max=100;row.append(bar);}bar.value=c.percent;bar.setAttribute('aria-label',c.text);}else bar?.remove();}while(list.children.length>choices.length)list.lastElementChild.remove();return list;}

 function render(){
  const polls=visiblePolls(),groups=mode==='combined'?groupPollResults(polls):polls.map(p=>({...groupPollResults([p])[0],key:identity(p)}));
  for(const [value,button] of toggles)button.setAttribute('aria-pressed',String(mode===value));
  const available=polls.filter(p=>active(p)),pending=available.some(p=>['queued','sending'].includes(opFor(p)?.status));endAll.hidden=available.length<2;endAll.disabled=pending||available.every(p=>['unknown','submitted'].includes(opFor(p)?.status));const endText=pending?'Ending…':'End all';if(endAll.textContent!==endText)endAll.textContent=endText;
  stripEnd.hidden=endAll.hidden;stripEnd.disabled=endAll.disabled;if(stripEnd.textContent!==endText)stripEnd.textContent=endText;
  const titleText=groups.length===1?groups[0].question:groups.length+' polls';if(stripTitle.textContent!==titleText)stripTitle.textContent=titleText;stripMeta.textContent=(available.length?available.length+' live':'Final results')+' · '+polls.length+(polls.length===1?' chat':' chats');stripLogos.replaceChildren(...[...new Set(polls.map(p=>p.platform))].map(platform=>{const logo=el('span','platform-mark '+platform);logo.setAttribute('aria-hidden','true');return logo;}));
  const kept=new Set();for(const group of groups){
   const key=group.key,shared=group.polls.length>1;kept.add(key);let card=cards.get(key);if(!card){card=el('details','poll-card');card.open=true;cards.set(key,card);content.append(card);}else if(card.parentElement!==content)content.append(card);
   const groupActive=group.polls.some(active);card.dataset.platform=shared?'combined':group.polls[0].platform;card.dataset.pollId=group.polls[0].id;
   const signature=JSON.stringify([mode,group,group.polls.map(opFor)]);if(card.dataset.signature===signature)continue;card.dataset.signature=signature;
   const summary=el('summary','',shared?(group.polls.length+' chats · '+(groupActive?'Live poll':'Results')):((labels[group.polls[0].sourceKey]||group.polls[0].platform)+' · Poll · '+(groupActive?'Live':'Results')));
   for(const platform of [...new Set(group.polls.map(p=>p.platform))]){const logo=el('span','platform-mark '+platform);logo.setAttribute('aria-hidden','true');summary.prepend(logo);}
   const dismiss=el('button','poll-dismiss','×');dismiss.type='button';dismiss.setAttribute('aria-label','Dismiss poll');dismiss.title='Hide these results from this dock';dismiss.onclick=()=>{for(const p of group.polls)dismissed.add(identity(p));render();};
   const title=el('h3','',group.question),chips=el('div','poll-platform-chips');for(const p of group.polls){const chip=el('span','',labels[p.sourceKey]+' · '+(active(p)?'Live':'Ended'));chips.append(chip);}
   const combined=shared&&mode==='combined',choices=combined?group.choices:group.polls[0].choices,choiceList=paintChoices(choices,card.querySelector(':scope > .poll-choices'));
   const note=el('p','poll-note',combined?(group.missing.length?'Combined counts · '+group.counted+' of '+group.polls.length+' chats. Other results below.':group.totalVotes.toLocaleString()+' total votes across '+group.polls.length+' chats.'):(group.polls[0].totalVotes!=null?group.polls[0].totalVotes.toLocaleString()+' total votes':group.polls[0].totalLabel||(group.counted?group.totalVotes.toLocaleString()+' total votes':'Results appear when shared by the platform')));
   const breakdown=el('div','poll-percent-breakdown');if(combined)for(const p of group.missing){const section=el('div');section.append(el('strong','',labels[p.sourceKey]+' · Platform percentages'),paintChoices(p.choices));breakdown.append(section);}
   const controls=el('div','poll-end-controls'),feedback=el('div','poll-end-feedback');feedback.setAttribute('role','status');
   const statuses=group.polls.map(p=>[p,opFor(p)]).filter(([,op])=>op);for(const [p,op] of statuses)feedback.append(el('p','',labels[p.sourceKey]+' · '+op.detail));
   if(groupActive){const button=el('button','',group.polls.some(p=>opFor(p)?.status==='failed')?'Retry failed ends':shared?'End on all platforms':'End poll');button.type='button';button.disabled=group.polls.filter(active).every(p=>opFor(p)&&opFor(p).status!=='failed')||group.polls.some(p=>['queued','sending'].includes(opFor(p)?.status));if(button.disabled)button.textContent=group.polls.some(p=>['queued','sending'].includes(opFor(p)?.status))?'Ending…':'Check results';button.onclick=()=>endPolls(group.polls);controls.append(button);}
   const controlKey=JSON.stringify([group.polls.map(p=>[identity(p),p.status]),statuses]);const oldControls=card.querySelector('.poll-end-controls');controls.append(feedback);card.replaceChildren(summary,dismiss,title,chips,choiceList,note,breakdown,oldControls&&card.dataset.controlKey===controlKey?oldControls:controls);card.dataset.controlKey=controlKey;
  }
  for(const [key,card] of cards)if(!kept.has(key))card.remove();while(cards.size>40){const oldest=[...cards.keys()].find(key=>!kept.has(key));if(!oldest)break;cards.delete(oldest);}area.hidden=true;empty.hidden=groups.length>0;toolbar.hidden=!groups.length;const toggleText='Polls'+(available.length?' · '+available.length:'');if(toggle.textContent!==toggleText)toggle.textContent=toggleText;
 }
 function update(p,{snapshot=false}={}){
  if(!validPoll(p))return;const closing=!active(p),age=Date.now()-(p.closedAt||p.updatedAt||Date.now());if(closing&&(snapshot||!records.has(p.sourceKey))&&age>=8000)return;
  if(closing&&age>=300000)return;const old=records.get(p.sourceKey);if(old?.id!==p.id){clearTimer(timers.get(p.sourceKey));timers.delete(p.sourceKey);}const pending=pendingGroups.get(p.sourceKey);if(pending&&active(p)&&normalized(p.question)===normalized(pending.question)&&JSON.stringify(p.choices.map(c=>normalized(c.text)).sort())===pending.choices){p={...p,groupId:pending.id};pendingGroups.delete(p.sourceKey);}else if(old?.id===p.id&&old.groupId)p={...p,groupId:old.groupId};records.set(p.sourceKey,p);
  if(closing&&!timers.has(p.sourceKey))timers.set(p.sourceKey,setTimer(()=>{if(records.get(p.sourceKey)?.id===p.id){records.delete(p.sourceKey);render();}timers.delete(p.sourceKey);},Math.max(0,300000-age)));render();
 }
 return {update,filter:render,open:()=>show(true),remove(source,id){const p=records.get(source);if(p?.id===id&&active(p))update({...p,status:'closed',closedAt:Date.now()});},reset(polls=[]){for(const timer of timers.values())clearTimer(timer);timers.clear();records.clear();for(const p of polls)update(p,{snapshot:true});render();},launched({draft,results,id}){for(const source of draft.targets){const pending={id:id||'launch-'+Date.now(),question:draft.question,choices:JSON.stringify(draft.choices.map(normalized).sort())};pendingGroups.set(source,pending);const p=records.get(source);if(p&&active(p))update(p);}announcement.textContent='Poll started · '+Object.keys(results).map(k=>labels[k]).join(', ');clearTimer(noticeTimer);noticeTimer=setTimer(()=>{announcement.textContent='';render();},8000);render();show(true);},clearNotice(){announcement.textContent='';render();}};
}

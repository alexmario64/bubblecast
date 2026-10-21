export function mountPollComposer({document,post,getFeeds,onStarted=()=>{}}){
 const $=s=>document.querySelector(s),dialog=$('#pollComposer'),form=$('#pollCreateForm'),targets=$('#pollTargets'),results=$('#pollCreateResults'),message=$('#pollCreateStatus');
 const labels={twitch:'Twitch',kick:'Kick',youtube:'YouTube Live',youtubeShorts:'YouTube Shorts'};
 let status={},busy=false,attempt=null;
 for(const [key,label] of Object.entries(labels)){
  const row=document.createElement('label'),input=document.createElement('input'),logo=document.createElement('span'),text=document.createElement('span'),note=document.createElement('small');
  input.type='checkbox';input.value=key;logo.className='origin '+(key.startsWith('youtube')?'youtube':key);logo.setAttribute('aria-hidden','true');const icon=document.createElement('span');icon.className='origin-logo';logo.append(icon);text.textContent=label;note.dataset.pollAccount=key;row.append(input,logo,text,note);targets.append(row);
 }
 function answerLimits(){const kick=!!targets.querySelector('input[value="kick"]:checked');for(const id of ['#pollAnswer1','#pollAnswer2'])$(id).minLength=kick?2:1;$('#pollAnswerHint').hidden=!kick;}
 function update(next){status=next;for(const input of targets.querySelectorAll('input')){const key=input.value,connected=!!status.sources?.urls?.[key]&&status.sources?.enabled!==false,account=status.collector?.accounts?.[key];input.disabled=busy||!connected||account?.signedIn!==true;targets.querySelector(`[data-poll-account="${key}"]`).textContent=!connected?'Add connection':account?.signedIn?'Signed in':'Sign in required';}$('#startSharedPoll').disabled=busy||!status.collector?.active||!status.collector?.pollCreation||!!attempt;answerLimits();}
 $('#newPoll').onclick=()=>{if(!dialog.open){for(const input of targets.querySelectorAll('input'))if(!attempt)input.checked=!input.disabled&&getFeeds().includes(input.value);answerLimits();dialog.showModal();}};
 $('#closePollComposer').onclick=()=>{if(!busy)dialog.close();};dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
 form.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.matches('input'))event.preventDefault();});
 form.addEventListener('input',()=>{if(!busy){attempt=null;message.textContent='';results.replaceChildren();update(status);}});
 const paint=job=>{results.replaceChildren();for(const [key,result] of Object.entries(job.results||{})){const item=document.createElement('li');item.textContent=labels[key]+' · '+({queued:'Waiting',sending:'Preparing / starting',submitted:'Started',failed:'Not started',unknown:'Check platform'}[result.status]||result.status)+' — '+(result.detail||'');item.dataset.result=result.status;results.append(item);}};
 const delay=ms=>new Promise(r=>setTimeout(r,ms));
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||attempt)return;
  const draft={question:$('#pollQuestion').value.trim(),choices:[$('#pollAnswer1').value.trim(),$('#pollAnswer2').value.trim()],duration:Number($('#sharedPollDuration').value),targets:[...targets.querySelectorAll('input:checked:not(:disabled)')].map(e=>e.value)};
  if(!draft.targets.length){message.textContent='Select at least one signed-in destination.';return;}
  if(draft.targets.includes('kick')&&draft.choices.some(v=>[...v].length<2)){message.textContent='Kick requires each answer to contain at least 2 characters. Nothing was started.';return;}
  if(!draft.question||draft.choices.some(v=>!v)||draft.choices[0].toLowerCase()===draft.choices[1].toLowerCase()){message.textContent='Enter a question and two different answers.';return;}
  busy=true;$('#startSharedPoll').textContent='Starting…';form.setAttribute('aria-busy','true');$('#closePollComposer').disabled=true;$('#pollDraftFields').disabled=true;update(status);attempt=crypto.randomUUID();message.textContent='Preparing every selected platform before starting…';
  try{
   let job=await post('polls/create',{...draft,requestId:attempt});paint(job);
   for(let i=0;i<90&&Object.values(job.results||{}).some(r=>['queued','sending'].includes(r.status));i++){await delay(400);job=await post('polls/create/status',{id:job.id});if(job.error)throw Error(job.error);paint(job);}
   const states=Object.values(job.results||{});if(states.length&&states.every(r=>r.status==='failed'))attempt=null;message.textContent=states.length&&states.every(r=>r.status==='submitted')?'Poll started on every selected destination.':states.some(r=>r.status==='unknown')?'Some results are unconfirmed. Check those platforms before starting another poll.':states.some(r=>r.status==='submitted')?'Some polls started; other destinations failed. Check the results before starting another poll.':'No shared poll was started. Check each destination below.';
   if(states.length&&states.every(r=>r.status==='submitted')){dialog.close();onStarted({draft,results:job.results,id:job.id});attempt=null;for(const id of ['#pollQuestion','#pollAnswer1','#pollAnswer2'])$(id).value='';results.replaceChildren();message.textContent='';}
  }catch(error){message.textContent=error.message+' No automatic retry was attempted.';}
  finally{busy=false;$('#startSharedPoll').textContent='Start poll';form.removeAttribute('aria-busy');$('#closePollComposer').disabled=false;$('#pollDraftFields').disabled=false;update(status);}
 };
 return {update};
}

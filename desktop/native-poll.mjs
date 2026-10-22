// Native creator UI only. Opening these controls never publishes a poll.
function pollFormAction(platform,action='inspect',opened=[]){
 const visible=e=>!!e&&!!e.getClientRects().length&&!e.closest('[hidden],[aria-hidden="true"]')&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden';
 const buttons=[...document.querySelectorAll('button,[role="button"],[role="menuitem"],tp-yt-paper-item,yt-list-item-view-model,yt-live-chat-menu-service-item-renderer')].filter(visible);
 const fields=[...document.querySelectorAll('input:not([type="hidden"]),textarea,[contenteditable]')].filter(visible);
 const describe=e=>({tag:e.tagName,label:e.getAttribute('aria-label')||'',placeholder:e.getAttribute('placeholder')||'',name:e.getAttribute('name')||'',id:e.id||'',type:e.type||'',target:e.getAttribute('data-a-target')||e.getAttribute('data-testid')||''});
 if(action==='inspect')return {fields:fields.map(describe),selects:[...document.querySelectorAll('select')].filter(visible).map(e=>({...describe(e),options:[...e.options].map(o=>({value:o.value,label:o.textContent}))})),buttons:buttons.map(e=>({text:e.textContent.trim().slice(0,80),label:e.getAttribute('aria-label')||'',target:e.getAttribute('data-a-target')||e.getAttribute('data-testid')||''}))};
 if(action==='open'){
  if(platform==='youtube'&&[...document.querySelectorAll('yt-live-chat-poll-editor-panel-renderer,yt-live-chat-poll-creation-renderer,yt-live-chat-poll-creator-renderer')].some(visible))return {ok:true,ready:true};
  const question=fields.find(e=>/question|poll-title|poll.subject/i.test([e.getAttribute('aria-label'),e.getAttribute('placeholder'),e.getAttribute('name'),e.getAttribute('data-a-target'),e.getAttribute('data-testid'),...(e.getAttribute('aria-labelledby')||'').split(' ').map(id=>document.getElementById(id)?.textContent||'')].join(' ')));
  if(question)return {ok:true,ready:true};
  const matches=platform==='youtube'?[/^Start a poll(?:\s|$)/i,/^Create a poll$/i,/^Engage with your audience$/i]:[/^New Poll$/i,/^Create a New Poll$/i];
  for(const pattern of matches){const control=pattern.source;if(opened.includes(control))continue;const button=buttons.find(e=>pattern.test(e.getAttribute('aria-label')||'')||pattern.test(e.textContent.trim()));if(button){button.click();return {ok:true,opened:true,control};}}
  return {ok:false,detail:'Native poll controls are not available for this account or channel.'};
 }
}
export async function openNativePoll(contents,platform,{pause=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 const opened=[];const run=()=>contents.executeJavaScript('('+pollFormAction.toString()+')('+JSON.stringify(platform)+',"open",'+JSON.stringify(opened)+')');
 // The native menu and form mount asynchronously after the opener. A missing
 // control on the first animation frame is not a permanent permission failure.
 let last;for(let i=0;i<12;i++){last=await run();if(last.ready)return last;if(last.control)opened.push(last.control);await pause(150);}return {ok:false,detail:last?.detail||'The platform did not expose a poll question field.'};
}

// Native controls discovered by accessible labels, with exact Kick test IDs
// and Twitch labels verified against the creator forms. No field values leave
// this page; comparisons return booleans only.
export function pollDraftAction(platform,action,spec={},field=''){
 const visible=e=>!!e&&!!e.getClientRects().length&&!e.closest('[hidden],[aria-hidden="true"]')&&getComputedStyle(e).visibility!=='hidden';
 const label=e=>[e.getAttribute('aria-label'),e.getAttribute('placeholder'),e.getAttribute('data-testid'),...[...(e.labels||[])].map(l=>l.textContent),...(e.getAttribute('aria-labelledby')||'').split(' ').map(id=>document.getElementById(id)?.textContent||'')].join(' ');
 const value=e=>e?('value' in e?e.value:e.textContent).trim():'';
 const all=(selector,root=document)=>{const result=[],roots=root.shadowRoot?[root,root.shadowRoot]:[root];while(roots.length){const current=roots.pop();result.push(...current.querySelectorAll(selector));for(const e of current.querySelectorAll('*'))if(e.shadowRoot)roots.push(e.shadowRoot);}return result;};
 const within=(root,e)=>{while(e){if(root.contains(e))return true;e=e.getRootNode()?.host;}return false;};
 const candidates=all('input:not([type=hidden]),textarea,[contenteditable],[role=textbox]').filter(visible);
 const questions=candidates.filter(e=>/question|poll.subject|ask a question/i.test(label(e)));
 if(questions.length!==1)return action==='validation'?{ok:true,formPresent:false}:{ok:false,detail:'The native poll question is unavailable. Open the platform poll creator with an owner or authorized moderator account.'};
 const question=questions[0],scope=platform==='youtube'?document.querySelector('yt-live-chat-poll-editor-panel-renderer')||question.closest('yt-live-chat-poll-creation-renderer,yt-live-chat-poll-creator-renderer,[role="dialog"]')||document:question.closest('form,[role="dialog"]')||document;
 if(action==='validation'){
  const invalid=all('[aria-invalid="true"]',scope).filter(visible);
  const descriptions=invalid.flatMap(e=>[e.getAttribute('aria-errormessage'),e.getAttribute('aria-describedby')].filter(Boolean).join(' ').split(/\s+/)).map(id=>document.getElementById(id)?.textContent?.trim()).filter(Boolean);
  const alerts=all('[role="alert"]',scope).filter(visible).map(e=>e.textContent.trim()).filter(Boolean);
  const messages=[...new Set([...descriptions,...alerts])];
  return {ok:true,formPresent:true,rejected:invalid.length>0||messages.length>0,detail:messages.join(' ').slice(0,220)||'The platform rejected one or more poll fields.'};
 }
 // YouTube defers answer-field layout in hidden helper windows. These exact
 // editor children can exist before they have client rects; focus lays them
 // out. Restrict this exception to the identified native poll editor.
 const answerReady=e=>!!e&&!e.closest('[hidden],[aria-hidden="true"]')&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden';
 const youtubeAnswers=platform==='youtube'?all('yt-live-chat-poll-editor-input',scope).map(host=>all('input:not([type=hidden]),textarea,[contenteditable],[role=textbox]',host).find(answerReady)).filter(e=>e&&e!==question):[];
 const choices=youtubeAnswers.length>=2?youtubeAnswers:candidates.filter(e=>e!==question&&within(scope,e)&&/responses|option\s*\d*|answer/i.test(label(e)));
 const button=all('button,[role=button]',scope).find(e=>visible(e)&&(e.getAttribute('data-testid')==='create-poll-submit'||/^(Start Poll|Create Poll|Ask your community)$/i.test(e.getAttribute('aria-label')||e.textContent.trim())));
 if(choices.length<2||!button)return {ok:false,detail:'The platform poll answers or Create control could not be identified safely.'};
 const fields=[question,...choices],expected=[spec.question,...(spec.choices||[])];
 const youtubeDefault=platform==='youtube'&&!value(question)&&choices.length===2&&choices.every((e,i)=>value(e)===['Yes','No'][i]);
 const timer=platform==='youtube'?null:[...scope.querySelectorAll('select')].find(e=>[...e.options].some(o=>/minutes?|^\d+m$/.test(o.textContent)));
 const duration=timer?[...timer.options].find(o=>{const text=o.textContent.trim(),seconds=/seconds?/.test(text)?Number(o.value):/minutes?|^\d+m$/.test(text)?Number(o.value)*(platform==='twitch'?60:1):NaN;return seconds===spec.duration;}):null;
 if(action==='inspect')return {ok:true,blank:fields.every(e=>!value(e))||youtubeDefault,choiceCount:choices.length,timed:platform==='youtube'||!!duration};
 if(action==='focus'){
  const index=Number(field);if(!Number.isInteger(index)||index<0||index>=expected.length||!fields[index])return {ok:false,detail:'Poll field changed.'};
  const replaceDefault=platform==='youtube'&&index>0&&question.dataset.bubblecastPollOwner===spec.owner&&value(fields[index])===['Yes','No'][index-1];
  if(value(fields[index])&&!replaceDefault)return {ok:false,detail:'The native poll has an existing draft. Nothing was overwritten.'};
  fields[index].focus();if(replaceDefault){if(typeof fields[index].select==='function')fields[index].select();else{const range=document.createRange();range.selectNodeContents(fields[index]);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);}}return {ok:true};
 }
 if(action==='duration'){
  if(platform==='youtube')return {ok:true};
  if(!duration)return {ok:false,detail:'The selected poll duration is not available on this platform.'};
  const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;setter.call(timer,duration.value);timer.dispatchEvent(new Event('change',{bubbles:true}));return {ok:true};
 }
 if(action==='own'){
  if(fields.some(e=>value(e))&&!youtubeDefault)return {ok:false,detail:'There is an existing native poll draft. Nothing was overwritten.'};
  question.dataset.bubblecastPollOwner=spec.owner;question.dataset.bubblecastPollBaseline=JSON.stringify(fields.map(value));return {ok:true};
 }
 if(action==='rollback'){
  if(!spec.owner||question.dataset.bubblecastPollOwner!==spec.owner)return {ok:true};
  let baseline=[];try{baseline=JSON.parse(question.dataset.bubblecastPollBaseline||'[]');}catch{}
  if(fields.some((e,i)=>value(e)&&value(e)!==expected[i]&&value(e)!==baseline[i]))return {ok:false,detail:'The native draft was edited and has been preserved.'};
  const cancel=[...scope.querySelectorAll('button')].find(e=>visible(e)&&(e.getAttribute('data-testid')==='cancel-poll'||/^Cancel$/i.test(e.getAttribute('aria-label')||e.textContent.trim())));
  if(cancel)cancel.click();else for(const e of fields){if('value' in e){const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,'');}else e.textContent='';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}
  delete question.dataset.bubblecastPollOwner;delete question.dataset.bubblecastPollBaseline;return {ok:true};
 }
 const matches=expected.every((v,i)=>value(fields[i])===v)&&fields.slice(expected.length).every(e=>!value(e));
 if(platform==='kick'&&spec.choices?.some(v=>[...v.trim()].length<2))return {ok:false,detail:'Kick requires each answer to contain at least 2 characters. Nothing was started.'};
 if(!matches)return {ok:false,detail:'The platform did not accept the complete poll draft. Nothing was started.'};
 if(platform!=='youtube'&&(!duration||timer.value!==duration.value))return {ok:false,detail:'The platform did not accept the duration.'};
 if(action==='check')return button.disabled||button.getAttribute('aria-disabled')==='true'?{ok:false,detail:'The native Start/Create button is disabled. The platform has not accepted the fields or your account lacks poll permission.'}:{ok:true};
 if(action==='publish'){
  if(button.disabled||button.getAttribute('aria-disabled')==='true')return {ok:false,detail:'The platform has disabled poll creation. Check account permissions.'};
  button.click();return {ok:true};
 }
 return {ok:false,detail:'Unknown poll action.'};
}

export async function prepareNativePoll(contents,platform,spec,{signal,pause=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 if(platform==='kick'&&spec.choices.some(v=>[...v.trim()].length<2))throw Error('Kick requires each answer to contain at least 2 characters. Nothing was started.');
 const run=(action,field='')=>contents.executeJavaScript('('+pollDraftAction.toString()+')('+[platform,action,spec,field].map(v=>JSON.stringify(v)).join(',')+')');
 const initial=await run('inspect');if(!initial.ok)throw Error(initial.detail);if(!initial.blank)throw Error('There is an existing native poll draft. Nothing was overwritten.');if(!initial.timed)throw Error('The selected duration is not supported here.');
 if(spec.owner){const owned=await run('own');if(!owned.ok)throw Error(owned.detail);}
 for(const [i,text] of [spec.question,...spec.choices].entries()){
  signal?.throwIfAborted();const result=await run('focus',i);signal?.throwIfAborted();if(!result.ok)throw Error(result.detail);await contents.insertText(text);await pause(80);
 }
 signal?.throwIfAborted();const duration=await run('duration');if(!duration.ok)throw Error(duration.detail);await pause(100);
 const checked=await run('check');if(!checked.ok)throw Error(checked.detail);
}

export async function publishNativePoll(contents,platform,spec,{pause=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 const run=action=>contents.executeJavaScript('('+pollDraftAction.toString()+')('+[platform,action,spec].map(v=>JSON.stringify(v)).join(',')+')');
 const result=await run('publish');if(!result.ok||platform!=='kick')return result;
 for(let i=0;i<3;i++){await pause(100);const validation=await run('validation');if(validation.rejected)return {ok:false,detail:'The platform rejected the poll: '+validation.detail};if(!validation.formPresent)break;}
 return result;
}

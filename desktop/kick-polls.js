(()=>{
 if(window.__bubblecastKickPollObserver)return;window.__bubblecastKickPollObserver=true;
 const seed=window.__bubblecastPollSeed;let current=seed?.platform==='kick'?seed:null,last='',missingSince=null;
 const text=el=>el?.textContent?.trim()||'';
 const shape=p=>JSON.stringify([p.question,p.choices.map(c=>c.text)]);
 function send(poll){const fingerprint=JSON.stringify(poll);if(last===fingerprint)return;last=fingerprint;window.bubblecastCapture.send({type:'chat',data:{platform:'kick',sourceKey:'kick',action:'poll',poll}},r=>{if(!r?.ok&&last===fingerprint)last='';});}
 function scan(){
  const title=document.querySelector('#channel-chatroom [data-testid="poll-title"]');
  if(!title||title.closest('[hidden],[aria-hidden="true"]')){if(current){missingSince??=Date.now();if(Date.now()-missingSince>=1500){send({...current,status:'closed'});current=null;}}return;}
  missingSince=null;const question=text(title);if(!question)return;
  let card=title;for(let i=0;i<5&&card&&!card.querySelector('[data-testid="poll-option-list"]');i++)card=card.parentElement;
  const nodes=card?[...card.querySelectorAll('[data-testid="poll-option-list"] [role="radio"]')]:[];
  const choices=nodes.map((node,i)=>{const values=[...node.querySelectorAll('span[title]')].map(s=>{const value=s.getAttribute('title').replace(/[,\s\u202f]/g,'');return /^\d+(?:\.\d+)?$/.test(value)?Number(value):null;});return {id:node.getAttribute('value')||node.id||String(i),text:node.getAttribute('title')||text(node.querySelector('label')),percent:values[0]??null,votes:values[1]??null};});
  const statusText=text(title.previousElementSibling);const progress=card?.lastElementChild?.firstElementChild?.style?.transform?.match(/^scaleX\(([\d.]+)\)$/);const ended=/results|ended|closed|completed|finished|finalizad|terminad/i.test(statusText)||progress&&Number(progress[1])===0;
  // Collapsing the native card may unmount options; preserve the known result.
  if(choices.length<2){if(current?.question===question&&ended){current={...current,status:'completed'};send(current);}return;}
  const candidate={platform:'kick',sourceKey:'kick',question,choices,status:ended?'completed':'active'};
  const same=current&&shape(current)===shape(candidate)&&(!['closed','completed','terminated'].includes(current.status)||ended);
  candidate.id=same?current.id:card.getAttribute('data-poll-id')||'kick-dom:'+crypto.randomUUID();
  current=candidate;send(current);
 }
 let scheduled=false;new MutationObserver(()=>{if(!scheduled){scheduled=true;queueMicrotask(()=>{scheduled=false;scan();});}}).observe(document.documentElement,{subtree:true,childList:true,characterData:true});scan();setInterval(scan,500);
})();

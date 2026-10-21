(()=>{
 if(window.__bubblecastPollObserver)return;window.__bubblecastPollObserver=true;
 const platform=location.hostname.includes('twitch')?'twitch':'youtube';
 const selector=platform==='youtube'?'yt-live-chat-poll-renderer,yt-live-chat-banner-poll-renderer':'[data-test-selector="poll-card"],[data-test-selector="poll-body"],[data-a-target="poll-card"],.poll-widget';
 let scheduled=false,last='',previous=window.__bubblecastPollSeed||null,missingSince=0;
 const text=el=>el?.textContent?.trim()||'';
 function send(poll){const fingerprint=JSON.stringify(poll);if(fingerprint===last)return;window.bubblecastCapture.send({type:'chat',data:{platform,action:'poll',poll}},r=>{if(r?.ok)last=fingerprint;});}
 function scan(){scheduled=false;const el=[...document.querySelectorAll(selector)].find(e=>!e.closest('[hidden]'));if(!el){if(previous){if(!missingSince)missingSince=Date.now();if(Date.now()-missingSince>10000)send({...previous,status:'closed'});}return;}missingSince=0;
 const data=el.data||{},header=data.header?.pollHeaderRenderer||data.header||data;
 const question=text(el.querySelector('#poll-question,#question,[data-test-selector="poll-title"],[data-a-target="poll-title"],.poll-title'))||header.pollQuestion?.simpleText||header.pollQuestion?.runs?.map(r=>r.text||'').join('')||'';
 const nodes=[...el.querySelectorAll('yt-live-chat-poll-choice,yt-live-chat-poll-choice-renderer,yt-poll-choice,[data-test-selector="poll-choice"],[data-a-target="poll-choice"],.poll-choice')];
 const choices=nodes.map((node,i)=>{const percentText=text(node.querySelector('#vote-percentage-text,#vote-percentage,#percentage,[data-test-selector="poll-choice-percentage"],.poll-choice__percentage'));const match=percentText.match(/([\d]+(?:[.,]\d+)?)\s*%/);return {id:node.getAttribute('data-id')||String(i),text:text(node.querySelector('#label-text,#text,#label,[data-test-selector="poll-choice-title"],.poll-choice__title'))||text(node).replace(/\d+(?:[.,]\d+)?\s*%/g,'').trim(),percent:match?Number(match[1].replace(',','.')):null};});
 if(!question||choices.length<2)return;
 const id=data.liveChatPollId||data.liveChatPollStateEntityKey||data.id||el.getAttribute('data-poll-id')||'dom:'+question+'|'+choices.map(c=>c.text).join('|');
 const statusText=text(el.querySelector('#status,[data-test-selector="poll-status"],.poll-status'))+' '+[...el.querySelectorAll('.metadata')].map(text).join(' ');
 const status=/ended|complete|finalizada|terminada/i.test(statusText)?'completed':'active';
 previous={id,question,choices,status,totalLabel:text(el.querySelector('#total-votes,[data-test-selector="poll-total-votes"]'))||[...el.querySelectorAll('.metadata span')].map(text).find(t=>/votes|votos/i.test(t))||''};send(previous);
 }
 const observer=new MutationObserver(()=>{if(!scheduled){scheduled=true;queueMicrotask(scan);}});observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});scan();setInterval(scan,2000);
})();

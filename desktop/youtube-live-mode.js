(()=>{
 let opened=false,selected=false,finished=false;
 const report=(chatMode,reply)=>{if(window.bubblecastCapture)window.bubblecastCapture.send({type:'chat',data:{action:'heartbeat',chatMode}},reply);else reply?.();};
 function check(){
  if(finished)return;const menu=document.querySelector('#live-chat-view-selector-sub-menu');if(!menu)return;
  const label=menu.querySelector('#label-text')?.textContent.trim()||'';
  if(/^(live chat|chat en vivo)$/i.test(label)){finished=true;observer.disconnect();report('live');return;}
  if(selected)return;
  if(!opened){const button=menu.querySelector('#label');if(!button)return;opened=true;button.click();}
  const options=[...menu.querySelectorAll('tp-yt-paper-listbox > a')];const live=options.find(a=>/^(live chat|chat en vivo)$/i.test(a.querySelector('.item')?.textContent.trim()||''))||(options.length===2?options[1]:null);
  if(live){selected=true;report('switching',()=>{if(live.isConnected)live.click();});}
 }
 const observer=new MutationObserver(check);observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['aria-selected']});check();setTimeout(()=>{observer.disconnect();if(!finished)report('page-default');},10000);
})();

// Text-to-speech browser source: plays spoken chat one message at a time and shows nothing. In OBS, tick
// "Control audio via OBS" so it gets its own volume slider. A normal browser tab needs one click first.
const queue=[],hint=document.getElementById('hint');let current=null;
const events=new EventSource('/api/events');
events.addEventListener('tts',e=>{queue.push(JSON.parse(e.data));while(queue.length>10)queue.shift();next();});
events.addEventListener('tts-skip',()=>{if(current){current.pause();finish(current);}});
function finish(a){if(current!==a)return;current=null;next();}
function next(){if(current||!queue.length)return;const item=queue.shift(),a=new Audio(item.url);a.volume=Math.max(0,Math.min(1,(item.volume??80)/100));current=a;
 a.onended=()=>finish(a);a.onerror=()=>finish(a);
 a.play().catch(()=>{current=null;queue.unshift(item);hint.hidden=false;});}
hint.onclick=()=>{hint.hidden=true;next();};

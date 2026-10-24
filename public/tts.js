// Text-to-speech overlay: plays each spoken message and shows its card (Studio sets whether the card shows,
// where and how big). One message at a time; skipping stops it. In OBS, tick "Control audio via OBS" on /tts for its own volume slider. A normal browser tab
// needs one click before it may play sound.
const preview=new URLSearchParams(location.search).has('preview');
const cards=document.getElementById('cards'),cooldownBox=document.getElementById('cooldown'),hint=document.getElementById('hint'),queue=[];let current=null,settings={language:'en'};
const words={en:{tts:'Text to speech',waiting:n=>'+'+n+' waiting',hint:'Click to turn on text to speech',ready:(r,n)=>(r?'“'+r+'”':'Text to speech')+' available in '+n+' s'},es:{tts:'Texto a voz',waiting:n=>'+'+n+' en cola',hint:'Haz clic para activar el texto a voz',ready:(r,n)=>(r?'«'+r+'»':'Texto a voz')+' disponible en '+n+' s'}};
const t=()=>words[settings.language==='es'?'es':'en'];
const logos={twitch:'/logos/twitch.png',youtube:'/logos/youtube.svg',tiktok:'/logos/tiktok.svg',kick:'/logos/kick.svg'};
const speaker='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const gift='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7S10 3 7.5 4.5 9 7 12 7s3.5-1 4.5-2.5S12 7 12 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
function fit(){const portrait=innerHeight>innerWidth;document.body.classList.toggle('portrait',portrait);document.documentElement.style.setProperty('--scale',portrait?innerWidth/1080:Math.min(innerWidth/1920,innerHeight/1080));}
addEventListener('resize',fit);fit();
// Colors, font and size go on the stage so the card and the countdown share them.
function applySettings(s){settings={...settings,...s};const c=document.getElementById('stage').style;for(const [k,v] of [['--accent',s.accent],['--bubble',s.bubble],['--text',s.text]])if(/^#[0-9a-f]{6}$/i.test(v||''))c.setProperty(k,v);
 if(s.fontFamily)c.setProperty('--font','"'+String(s.fontFamily).replace(/["\\]/g,'')+'"');
 // Classic uses a clean sans-serif like the classic chat, unless another font is picked in Studio.
 c.setProperty('--classic-font',!s.fontFamily||s.fontFamily==='Komika Axis'?'Inter':'"'+String(s.fontFamily).replace(/["\\]/g,'')+'"');
 cards.hidden=s.ttsCard===false;cards.className=(['top','middle','bottom'].includes(s.ttsCardPosition)?s.ttsCardPosition:'top')+(s.ttsCardStyle==='classic'?' classic':s.ttsCardStyle==='modern'?' classic modern':'');cooldownBox.className=cards.className;if(Number.isFinite(+s.ttsCardSize))c.setProperty('--size',+s.ttsCardSize/100);hint.textContent=t().hint;paintQueue();}
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}
function card(item){const root=el('div','tts-card'),float=el('div','float'),pill=el('div','pill');
 if(logos[item.platform]){const logo=el('img','logo');logo.src=logos[item.platform];logo.alt='';pill.append(logo);}
 if(item.badges?.length){const b=el('span','badges');for(const x of item.badges){const i=el('img');i.src=x.src;i.alt=x.alt||'';i.onerror=()=>i.remove();b.append(i);}pill.append(b);}
 const name=el('span','name',item.user);if(/^#[0-9a-f]{6}$/i.test(item.color||''))name.style.color=item.color;pill.append(name);
 const tag=el('span','tag');tag.innerHTML=item.reward?gift:speaker;tag.append(item.reward||t().tts);pill.append(tag);
 const body=el('div','body'),waves=el('div','waves');waves.setAttribute('aria-hidden','true');for(let i=0;i<5;i++)waves.append(el('i'));
 const bar=el('div','bar');bar.append(el('i'));const end=tag.cloneNode(true);end.className='tag tag-end';body.append(waves,el('p','text',item.display||item.text),end,bar);
 float.append(pill,body);root.append(float);root.style.setProperty('--duration',Math.max(1,item.duration||4)+'s');return root;}
function paintQueue(){if(!current)return;current.card.querySelector('.queue')?.remove();if(queue.length)current.card.querySelector('.pill').append(el('span','queue',t().waiting(queue.length)));}
function finish(entry){if(current!==entry)return;current=null;clearTimeout(entry.timer);entry.audio?.pause();const c=entry.card;c.classList.remove('speaking');c.classList.add('leaving');setTimeout(()=>c.remove(),460);setTimeout(next,250);}
function next(){if(current||!queue.length)return;const item=queue.shift(),entry={item,card:card(item)};current=entry;cards.append(entry.card);paintQueue();
 const start=()=>{entry.card.classList.add('speaking');entry.timer=setTimeout(()=>finish(entry),(Math.max(1,item.duration||4)+.6)*1000);};
 if(preview){start();return;}
 const a=new Audio(item.url);a.volume=Math.max(0,Math.min(1,(item.volume??80)/100));entry.audio=a;a.onended=()=>finish(entry);a.onerror=()=>finish(entry);
 a.play().then(start).catch(()=>{entry.card.remove();current=null;queue.unshift(item);hint.hidden=false;});}
hint.onclick=()=>{hint.hidden=true;next();};
const events=new EventSource('/api/events');
let ready;const settingsLoaded=new Promise(r=>ready=r);
events.addEventListener('settings',e=>{applySettings(JSON.parse(e.data));ready();});
events.addEventListener('tts',e=>{queue.push(JSON.parse(e.data));while(queue.length>10)queue.shift();paintQueue();next();});
events.addEventListener('tts-skip',()=>{if(current)finish(current);});
// The shared wait: a countdown chip (with the reward's name when one is linked) while no message is showing.
let cooldown={until:0,reward:''},cooldownStart=0;
events.addEventListener('tts-cooldown',e=>{cooldown=JSON.parse(e.data);cooldownStart=Date.now();tick();});
function tick(){const left=Math.ceil((cooldown.until-Date.now())/1000),show=left>0&&!current&&settings.ttsCard!==false&&!preview;
 cooldownBox.hidden=!show;if(show){cooldownBox.querySelector('.cd-text').textContent=t().ready(cooldown.reward,left);const total=Math.max(1,(cooldown.until-cooldownStart)/1000);cooldownBox.querySelector('.cd-bar i').style.transform='scaleX('+Math.max(0,(cooldown.until-Date.now())/1000/total)+')';}}
setInterval(tick,250);
// ?preview=1 shows sample cards, for Studio and for checking the look without a live chat.
if(preview){const samples=[{platform:'twitch',user:'PixelPanda',color:'#ff6b6b',display:'¡Hola a todos! Este stream está buenísimo',duration:4.5},{platform:'youtube',user:'LunaRose',color:'#7ad7ff',display:'Hello from YouTube!',duration:3},{platform:'kick',user:'KickFan99',color:'#9dff7a',reward:'TTS',display:'Leí esto con puntos del canal',duration:3.5}];
 let i=0;const loop=()=>{queue.push({...samples[i++%samples.length],id:'p'+i});next();};settingsLoaded.then(()=>{loop();setInterval(()=>{if(queue.length<2)loop();},2600);});}

import {defaults,fontStack} from '/core.mjs';
const root=document.querySelector('#subathonOverlay'),q=s=>root.querySelector(s),clock=window.bubblecastSubathon.clock,preview=new URLSearchParams(location.search).has('preview');
const labels={subscriptions:'Subscriptions',bits:'Bits',money:'Money',tiktokGifts:'TikTok gifts',kicks:'Kicks'},logos={bits:'/logos/twitch.png',tiktokGifts:'/logos/tiktok.svg',kicks:'/logos/kick.svg'},t=s=>window.bubblecastI18n.translate(s);
const sample={status:'running',remainingMs:8*3600000+36*60000+3000,addedMs:3*3600000,config:{title:'Our community subathon',visible:true,currency:'USD'},counters:{subscriptions:128,bits:7420,money:80.85,tiktokGifts:42,kicks:0},goals:[{id:'a',title:'Community game night',metric:'subscriptions',target:100},{id:'b',title:'Choose the next challenge',metric:'bits',target:10000},{id:'c',title:'A special celebration',metric:'money',target:500}],lastAddition:null};
let data=null,received=0,connected=false,lastId=null,settings={...defaults},shown='';
const amount=(metric,value)=>value.toLocaleString(undefined,{maximumFractionDigits:2,notation:value>=100000?'compact':'standard'})+(metric==='money'?' '+data.config.currency:'');
const unit=metric=>metric==='money'?'':' '+t(labels[metric]);
function style(s){settings={...defaults,...s};window.bubblecastI18n.setLanguage(settings.language);root.style.setProperty('--font',fontStack(settings.fontFamily)+",'Komika Axis',sans-serif");if(data)render();}
function look(c){
 const own=c.overlayColors==='custom';
 root.style.setProperty('--accent',own?c.overlayAccent:settings.accent);root.style.setProperty('--card',own?c.overlayCard:settings.bubble);root.style.setProperty('--ink',own?c.overlayText:settings.text);
 root.style.setProperty('--size',(c.overlaySize||100)/100);
 root.className='layout-'+(c.overlayLayout||'card')+' position-'+(c.overlayPosition||'left')+(c.overlayStatus===false?' no-status':'')+' '+data.status;
}
function chip(metric){
 const el=document.createElement('span'),n=document.createElement('b'),name=document.createElement('small');el.className='so-chip';
 if(logos[metric]){const img=document.createElement('img');img.src=logos[metric];img.alt='';el.append(img);}
 n.textContent=amount(metric,data.counters[metric]);el.setAttribute('aria-label',n.textContent+unit(metric));name.textContent=metric==='money'?'':t(labels[metric]);el.append(n);if(name.textContent)el.append(name);return el;
}
function goal(g,label){
 const el=document.createElement('div'),row=document.createElement('div'),name=document.createElement('span'),count=document.createElement('small'),bar=document.createElement('div'),fill=document.createElement('i'),current=data.counters[g.metric];
 el.className='so-goal'+(current>=g.target?' done':'');row.className='so-goal-row';bar.className='so-bar';name.textContent=g.title;name.dataset.i18nSkip='';
 count.textContent=amount(g.metric,Math.min(current,g.target))+' / '+amount(g.metric,g.target)+unit(g.metric);fill.style.width=Math.min(100,current/g.target*100)+'%';bar.append(fill);row.append(name,count);
 if(label){const top=document.createElement('div');top.className='so-goal-label';top.textContent=t('Next goal');el.append(top);}
 el.append(row,bar);return el;
}
function render(){
 if(!data)return;const c=data.config;root.hidden=!c.visible||data.status==='idle';look(c);q('.so-title').textContent=c.title;
 const used=Object.keys(labels).filter(m=>c.overlayCounters==='all'||c.overlayCounters!=='none'&&data.counters[m]>0);
 q('.so-counters').replaceChildren(...(c.overlayCounters==='none'?[]:used.map(chip)));
 const done=data.goals.filter(g=>data.counters[g.metric]>=g.target),next=data.goals.find(g=>data.counters[g.metric]<g.target),goals=[];
 if(c.overlayGoals==='all')goals.push(...data.goals.map(g=>goal(g,false)));
 else if(c.overlayGoals!=='none'){if(next)goals.push(goal(next,true));if(done.length){const note=document.createElement('div');note.className='so-done';note.textContent='✓ '+done.length+' '+t(done.length===1?'goal reached':'goals reached');goals.push(note);}}
 q('.so-goals').replaceChildren(...goals);
 const a=data.lastAddition,toast=q('.so-toast');
 if(a&&a.id!==lastId&&c.overlayAdditions!==false&&Date.now()-a.at<6000){toast.querySelector('strong').textContent='+'+clock(a.addedMs).replace(/^00:/,'');toast.querySelector('span').textContent=amount(a.metric,a.amount)+unit(a.metric);toast.classList.remove('show');void toast.offsetWidth;toast.classList.add('show');}
 lastId=a?.id;paint();
}
function paint(){
 if(!data)return;const stale=!preview&&(!connected||data.status==='running'&&performance.now()-received>3500);
 root.classList.toggle('stale',stale);
 q('.so-status span').textContent=t(stale?'Reconnecting…':{running:'Running',paused:'Paused',ended:'Subathon ended',idle:'Ready to start'}[data.status]);
 const text=clock(data.remainingMs-(data.status==='running'&&!stale?Math.min(1500,performance.now()-received):0));
 if(text!==shown){shown=text;q('.so-clock').replaceChildren(...[...text].map(ch=>{const s=document.createElement('span');s.className=ch===':'?'c':'d';s.textContent=ch;return s;}));}
}
const layoutParam=new URLSearchParams(location.search).get('layout');let draftLook=['card','bar','timer'].includes(layoutParam)?{overlayLayout:layoutParam}:{};
function accept(s){if(!s?.config)return;data=preview?{...sample,config:{...sample.config,...s.config,...draftLook,title:s.config.title||sample.config.title,visible:true}}:s;received=performance.now();connected=true;render();}
// Studio's embedded preview reads the saved state once and then follows Studio's messages, so it never
// takes one of the browser's few connections from the real overlays.
const embedded=preview&&window.parent!==window;
if(embedded)Promise.all(['/api/settings','/api/subathon'].map(u=>fetch(u,{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null))).then(([s,state])=>{if(s)style(s);if(state)accept(state);});
else{const events=window.bubblecastEvents.connect();events.addEventListener('settings',e=>style(JSON.parse(e.data)));events.addEventListener('subathon',e=>accept(JSON.parse(e.data)));events.addEventListener('error',()=>{if(!preview){connected=false;paint();}});}
const tick=setInterval(paint,250);window.addEventListener('pagehide',()=>clearInterval(tick),{once:true});style(settings);
// The preview shows sample numbers with the saved look, and keeps the look current while Studio edits it.
if(preview){window.addEventListener('message',e=>{if(e.origin!==location.origin||e.data?.type!=='bubblecast-subathon-look'||typeof e.data.look!=='object')return;draftLook=e.data.look;data.config={...data.config,...draftLook};render();});accept({config:{}});}

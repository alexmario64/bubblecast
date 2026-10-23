// Guided setup in Studio: a chapter per platform plus OBS. Each step shows a drawn, animated picture of the
// screen it describes, the page to open and the values to copy. The last step of a chapter works through
// Studio's own controls, so saving keys and connecting behave exactly as on the Connections page.
// Opens by itself the first time nothing is connected; afterwards from "Setup guide" in the sidebar.
(()=>{
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const store={get:k=>{try{return localStorage.getItem(k);}catch{return null;}},set:(k,v)=>{try{localStorage.setItem(k,v);}catch{}}};
const motion=()=>!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ---- Pictures. A simplified window; elements with data-do run in order: the cursor moves to each and
// clicks it, types its data-type text, or ticks it. data-reveal shows an element once the step with that
// data-key is done. Sample values (data-i18n-skip) stay as written in every language. ----
// Kick's site is in English, so its pictures keep Kick's own labels.
const win=(url,body,cls='')=>`<div class="sg-window ${cls}"><div class="sg-bar"><i></i><i></i><i></i><span class="sg-url" data-i18n-skip>${esc(url)}</span></div><div class="sg-screen"${/\bsg-kick\b/.test(cls)?' data-i18n-skip':''}>${body}</div><span class="sg-cursor" aria-hidden="true"></span></div>`;
const app=(title,body,cls='')=>`<div class="sg-window sg-app ${cls}"><div class="sg-bar"><i></i><i></i><i></i><span class="sg-url">${esc(title)}</span></div><div class="sg-screen">${body}</div><span class="sg-cursor" aria-hidden="true"></span></div>`;
const attrs=({key,reveal,cls=''}={})=>(key?` data-key="${key}"`:'')+(reveal?` data-reveal="${reveal}"`:'')+(cls?` class="${cls}"`:'');
const click=(label,o={})=>`<span class="sg-btn ${o.primary?'primary':''} ${o.link?'link':''}" data-do="click"${attrs(o)}>${esc(label)}</span>`;
const plain=(label,o={})=>`<span class="sg-btn ${o.primary?'primary':''}"${attrs(o)}>${esc(label)}</span>`;
const type=(label,value,o={})=>`<div class="sg-field"${attrs(o)}><span>${esc(label)}</span><span class="sg-input" data-do="type" data-type="${esc(value)}"${o.key?` data-key="${o.key}"`:''} data-i18n-skip></span></div>`;
const shown=(label,value,o={})=>`<div class="sg-field"${attrs(o)}><span>${esc(label)}</span><span class="sg-input filled" data-i18n-skip>${esc(value)}</span></div>`;
const tick=(label,o={})=>`<span class="sg-check ${o.on?'on':''} ${o.radio?'radio':''}" ${o.static?'':'data-do="tick"'}${attrs(o)}>${esc(label)}</span>`;
const box=(inner,o={})=>`<div class="sg-box ${o.cls||''}"${attrs({key:o.key,reveal:o.reveal})}>${inner}</div>`;
const h=t=>`<p class="sg-heading">${esc(t)}</p>`;
const note=t=>`<p class="sg-small">${esc(t)}</p>`;
const row=(...items)=>`<div class="sg-row">${items.join('')}</div>`;
const side=(items,active)=>`<div class="sg-side">${items.map(i=>i===active?click(i,{key:'side',cls:'sg-nav'}):`<span class="sg-nav">${esc(i)}</span>`).join('')}</div>`;
const sample={email:'you@example.com',clientId:'1234-abc.apps.googleusercontent.com'};

// ---- What each step says, shows and offers. ----
const kickRedirect='http://localhost:3927/oauth/kick/callback',scope='https://www.googleapis.com/auth/youtube.force-ssl';
const chapters=[
 {id:'welcome',title:'Welcome',logo:'/favicon.svg',steps:[
  {title:'Let’s set up Bubblecast',text:['This guide connects your platforms and adds Bubblecast to OBS. It takes about 20 minutes, and you only do it once.','Skip any platform you don’t stream on. You can close the guide any time and come back from Setup guide in the sidebar.'],
   picture:`<div class="sg-hero"><img src="/logos/twitch.png" alt=""><img src="/logos/youtube.png" alt=""><img src="/logos/tiktok.svg" alt=""><img src="/logos/kick.svg" alt=""><span class="sg-bubble">One chat for every platform</span></div>`}]},
 {id:'twitch',title:'Twitch',logo:'/logos/twitch.png',done:()=>connected('#account-twitch'),steps:[
  {title:'Connect Twitch',text:['Click Connect Twitch below. Bubblecast shows a short code.','Open twitch.tv/activate, type the code, then click Activate and Authorize. Bubblecast connects on its own a few seconds later.'],
   picture:win('twitch.tv/activate',h('Activate your device')+type('Enter the code shown in Bubblecast','KQXW-BHTP')+row(click('Activate',{primary:true,key:'act'}))+box(h('Bubblecast wants to access your account')+row(click('Authorize',{primary:true})),{reveal:'act'}),'sg-twitch'),
   action:'twitch'}]},
 {id:'youtube',title:'YouTube',logo:'/logos/youtube.png',done:()=>connected('#account-youtube'),steps:[
  {title:'Why your own Google app?',text:['YouTube gives every app 10,000 units a day. With your own free Google app, that allowance is yours alone.','Bubblecast only reads YouTube while OBS is streaming, so a normal stream uses a small part of it. Setting up the app takes about 10 minutes.'],
   picture:`<div class="sg-meter"><span class="sg-meter-label">Daily YouTube quota</span><div class="sg-meter-bar"><i></i></div><span class="sg-small">Used only while you’re live</span></div>`},
  {title:'Create a Google Cloud project',text:['Open Google Cloud and sign in with any Google account. Accept the terms if asked.','Click the project picker at the top, then New project. Name it Bubblecast and click Create. Make sure the new project is selected afterwards.'],
   open:{label:'Open Google Cloud',url:'https://console.cloud.google.com/projectcreate'},copy:[['Project name','Bubblecast']],
   picture:win('console.cloud.google.com',row(`<span class="sg-brand">Google Cloud</span>`,click('Select a project',{key:'pick',cls:'sg-picker'}))+box(click('New project',{key:'new',primary:true}),{reveal:'pick',cls:'sg-menu'})+box(type('Project name','Bubblecast')+row(click('Create',{primary:true})),{reveal:'new'}))},
  {title:'Turn on the YouTube API',text:['In your project, open the API Library and search for YouTube Data API v3.','Open it and click Enable.'],
   open:{label:'Open the YouTube API page',url:'https://console.cloud.google.com/apis/library/youtube.googleapis.com'},copy:[['API name','YouTube Data API v3']],
   picture:win('console.cloud.google.com/apis/library',side(['APIs & Services','Library','Credentials'],'')+box(type('Search for APIs','YouTube Data API v3',{key:'find'})+box(click('YouTube Data API v3',{key:'res',cls:'sg-result'}),{reveal:'find'})+box(row(click('Enable',{primary:true})),{reveal:'res'}),{cls:'sg-main'}),'sg-split')},
  {title:'Describe your app to Google',text:['Open Branding in Google Auth Platform and click Get started.','Use Bubblecast as the app name and your email for support and contact. Choose External as the audience, then finish.'],
   open:{label:'Open Branding',url:'https://console.cloud.google.com/auth/branding'},copy:[['App name','Bubblecast']],
   picture:win('console.cloud.google.com/auth/branding',h('App information')+type('App name','Bubblecast')+type('User support email',sample.email)+row(tick('Internal',{radio:true,static:true}),tick('External',{radio:true}))+type('Contact email',sample.email)+row(click('Create',{primary:true})))},
  {title:'Allow access to YouTube',text:['Open Data access and click Add or remove scopes.','Paste the YouTube permission below into the filter, tick it, click Update, then Save.'],
   open:{label:'Open Data access',url:'https://console.cloud.google.com/auth/scopes'},copy:[['YouTube permission',scope]],
   picture:win('console.cloud.google.com/auth/scopes',h('Data access')+row(click('Add or remove scopes',{key:'add'}))+box(type('Filter','youtube.force-ssl')+tick('…/auth/youtube.force-ssl')+row(click('Update',{primary:true})),{reveal:'add',cls:'sg-panel'}))},
  {title:'Publish the app',text:['Open Audience and click Publish app, then Confirm. The status changes to In production.','If you skip this, Google signs you out every 7 days. Google doesn’t need to review your own app.'],
   open:{label:'Open Audience',url:'https://console.cloud.google.com/auth/audience'},
   picture:win('console.cloud.google.com/auth/audience',h('Publishing status')+row(`<span class="sg-badge">Testing</span>`,click('Publish app',{primary:true,key:'pub'}))+box(row(click('Confirm',{primary:true,key:'ok'})),{reveal:'pub',cls:'sg-panel'})+box(row(`<span class="sg-badge good">In production</span>`),{reveal:'ok'}))},
  {title:'Create your app keys',text:['Open Clients and click Create client.','Choose Desktop app as the application type, name it Bubblecast and click Create. Keep the window with the Client ID and Client secret open for the next step.'],
   open:{label:'Open Clients',url:'https://console.cloud.google.com/auth/clients/create'},copy:[['Client name','Bubblecast']],
   picture:win('console.cloud.google.com/auth/clients',type('Application type','Desktop app')+type('Name','Bubblecast')+row(click('Create',{primary:true,key:'made'}))+box(h('OAuth client created')+shown('Client ID',sample.clientId)+shown('Client secret','GOCSPX-••••••••')+row(click('Download JSON',{link:true}),click('OK',{primary:true})),{reveal:'made',cls:'sg-panel'}))},
  {title:'Paste the Google keys and connect',text:['Paste the Client ID and Client secret, then click Save. Click Connect YouTube and sign in with the Google account that owns your channel.','Google warns that it hasn’t verified the app. That’s expected for your own app: click Advanced, then Go to Bubblecast, then Continue.'],
   picture:win('accounts.google.com',h('Google hasn’t verified this app')+note('The app is requesting access to sensitive info in your Google Account.')+row(click('Advanced',{link:true,key:'adv'}),plain('Back to safety',{primary:true}))+box(click('Go to Bubblecast (unsafe)',{link:true,key:'go'}),{reveal:'adv'})+box(row(click('Continue',{primary:true})),{reveal:'go'})),
   action:'youtube'}]},
 {id:'kick',title:'Kick',logo:'/logos/kick.svg',done:()=>connected('#account-kick-api'),steps:[
  {title:'Open Kick’s developer settings',text:['Sign in to Kick with the account you stream with. Kick only lets you create apps once two-factor authentication is on (Settings → Security).','Open Settings → Developer and click Create new.'],
   open:{label:'Open Kick developer settings',url:'https://kick.com/settings/developer'},
   picture:win('kick.com/settings/developer',side(['Profile','Security','Developer'],'Developer')+box(h('Apps')+row(click('Create new',{primary:true})),{reveal:'side',cls:'sg-main'}),'sg-split sg-dark sg-kick')},
  {title:'Name the app and set its redirect',text:['Name it Bubblecast and add a short description.','Copy the redirect URL below exactly, with no slash at the end.'],
   copy:[['App name','Bubblecast'],['Description','Local chat companion for my stream'],['Redirect URL',kickRedirect]],
   picture:win('kick.com/settings/developer',type('Application Name','Bubblecast')+type('App Description','Local chat companion for my stream')+type('Redirect URL',kickRedirect),'sg-dark sg-kick')},
  {title:'Choose its permissions',text:['Tick Read user information, Read channel information and Write to Chat feed. Leave webhooks and everything else off.','Then create the app.'],
   picture:win('kick.com/settings/developer',tick('Read user information',{on:true,static:true})+tick('Read channel information')+tick('Write to Chat feed')+tick('Enable webhooks',{static:true})+row(click('Create App',{primary:true})),'sg-dark sg-kick')},
  {title:'Paste the Kick keys and connect',text:['Copy the Client ID and Client secret from your new Kick app, paste them below and click Save.','Click Connect Kick. Sign in to Kick in the window that opens if asked, then allow access.'],
   picture:win('id.kick.com',h('Bubblecast wants to')+tick('Read user information',{on:true,static:true})+tick('Read channel information',{on:true,static:true})+tick('Write to Chat feed',{on:true,static:true})+row(click('Allow access',{primary:true})),'sg-dark sg-kick'),
   action:'kick'}]},
 {id:'tiktok',title:'TikTok LIVE',logo:'/logos/tiktok.svg',done:()=>!!$('#tiktokChannel')?.value.trim(),steps:[
  {title:'Add your TikTok handle',text:['TikTok has no app to set up. Type your @handle below and click Save, and Bubblecast reads your LIVE chat.','To send messages to TikTok from the dock, also click Sign in and log in to TikTok in the window that opens.'],
   picture:app('Bubblecast Studio',`<div class="sg-card">${row('<img src="/logos/tiktok.svg" alt="">',h('TikTok LIVE'))+type('Creator','@yourhandle')+row(click('Save',{primary:true}),plain('Sign in'))}</div>`),
   action:'tiktok'}]},
 {id:'obs',title:'OBS',logo:'/logo-glyph.svg',done:()=>store.get('bubblecast-guide-obs')==='done',steps:[
  {title:'Add the chat dock',text:['Close OBS, then click Add dock below. Bubblecast adds itself to OBS’s Docks menu.','Open OBS again and turn on Bubblecast under Docks if it isn’t showing.'],
   picture:app('OBS Studio',row(`<span class="sg-nav">File</span>`,`<span class="sg-nav">Edit</span>`,click('Docks',{key:'docks',cls:'sg-nav'}),`<span class="sg-nav">Tools</span>`)+box(tick('Scenes',{on:true,static:true})+tick('Sources',{on:true,static:true})+tick('Bubblecast'),{reveal:'docks',cls:'sg-menu'}),'sg-dark'),
   action:'dock'},
  {title:'Let Bubblecast add overlays',text:['In OBS, open Tools → WebSocket Server Settings. Tick Enable WebSocket server and Enable Authentication, then click Apply.','Back here, click Add overlay. The chat overlay is added to your current scene.'],
   picture:app('OBS Studio',row(`<span class="sg-nav">Docks</span>`,click('Tools',{key:'tools',cls:'sg-nav'}))+box(click('WebSocket Server Settings',{key:'ws'}),{reveal:'tools',cls:'sg-menu'})+box(tick('Enable WebSocket server')+tick('Enable Authentication')+row(click('Apply',{primary:true})),{reveal:'ws',cls:'sg-panel'}),'sg-dark'),
   action:'overlay'},
  {title:'More overlays',text:['The poll overlay and the vertical chat are Browser sources too. In OBS, click + under Sources, choose Browser, and paste a link below.','Studio → Chat overlay and Poll overlay change how they look.'],
   copy:[['Poll overlay','http://127.0.0.1:3927/poll-overlay'],['Vertical chat','http://127.0.0.1:3927/overlay?layout=vertical']],
   picture:app('OBS Studio',h('Sources')+row(click('+',{key:'plus'}))+box(click('Browser',{key:'br'}),{reveal:'plus',cls:'sg-menu'})+box(type('URL','http://127.0.0.1:3927/poll-overlay')+row(click('OK',{primary:true})),{reveal:'br',cls:'sg-panel'}),'sg-dark'),
   action:'finish'}]}
];
function connected(sel){return !!$(sel)?.classList.contains('connected');}

// ---- Final-step controls. They copy values into Studio's own fields and press its buttons. ----
const actions={
 twitch:()=>`<div class="sg-act"><button type="button" class="button primary" data-press="#twitchConnect" data-hide-when="#account-twitch">Connect Twitch</button><span class="sg-status" data-mirror="#account-twitch"></span></div><div class="sg-code" data-show-if="#twitchCode"><span>Code</span><strong data-mirror="#twitchUserCode" data-i18n-skip></strong><a class="button" href="https://www.twitch.tv/activate" target="_blank" rel="noopener">twitch.tv/activate <span aria-hidden="true">↗</span></a></div>`,
 youtube:()=>keys('youtube','Client ID','Client secret','Save Google app','#youtubeConnect','Connect YouTube','#account-youtube'),
 kick:()=>keys('kick','Client ID','Client secret','Save Kick app','#kickConnect','Connect Kick','#account-kick-api'),
 tiktok:()=>`<div class="sg-act"><label class="field">Creator<input data-guide="tiktok" placeholder="@handle or LIVE link" spellcheck="false"></label><button type="button" class="button primary" data-guide-save="tiktok">Save</button><button type="button" class="button" data-press="[data-setup-signin=tiktok]">Sign in</button></div>`,
 dock:()=>`<div class="sg-act"><button type="button" class="button primary" data-press="#installDock">Add dock</button><span class="sg-status" data-mirror="#dockMessage"></span></div>`,
 overlay:()=>`<div class="sg-act"><button type="button" class="button primary" data-press="#installObs">Add overlay</button><span class="sg-status" data-mirror="#obsMessage"></span></div>`,
 finish:()=>`<div class="sg-act"><button type="button" class="button primary" data-guide-finish>Finish setup</button></div>`
};
function keys(p,idLabel,secretLabel,save,connect,connectLabel,status){return `<div class="sg-keys"><label class="field">${idLabel}<input data-guide-key="clientId" spellcheck="false" autocomplete="off"></label><label class="field">${secretLabel}<input data-guide-key="clientSecret" type="password" spellcheck="false" autocomplete="off"></label></div><div class="sg-act"><button type="button" class="button" data-guide-save="${p}">${save}</button><button type="button" class="button primary" data-press="${connect}" data-needs-keys="${p}" data-hide-when="${status}">${connectLabel}</button><span class="sg-status" data-mirror="${status}"></span></div>`;}

// ---- The dialog. ----
let root,chapter=0,step=0,timer=null,animation=0;
function build(){
 root=document.createElement('div');root.className='sg-layer';root.hidden=true;
 root.innerHTML=`<div class="sg-scrim" data-guide-close></div><div class="sg" role="dialog" aria-modal="true" aria-labelledby="sgTitle"><aside class="sg-chapters"><p class="sg-kicker">Setup guide</p><ol></ol></aside><section class="sg-main-pane"><header class="sg-head"><span class="sg-count"></span><button type="button" class="sg-close" data-guide-close aria-label="Close setup guide">×</button></header><h2 id="sgTitle"></h2><div class="sg-body"><div class="sg-text"></div><div class="sg-picture"></div></div><div class="sg-extras"></div><footer class="sg-foot"><button type="button" class="button subtle" data-guide-back>Back</button><span class="sg-dots"></span><button type="button" class="button primary" data-guide-next>Next</button></footer></section></div>`;
 document.body.append(root);
 root.addEventListener('click',onClick);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!root.hidden)close();});
}
function onClick(e){
 const t=e.target.closest('button,[data-guide-close],[data-chapter]');if(!t)return;
 if(t.matches('[data-guide-close]'))return close();
 if(t.dataset.chapter){chapter=Number(t.dataset.chapter);step=0;return render();}
 if(t.matches('[data-guide-back]')){if(step)step--;else if(chapter){chapter--;step=chapters[chapter].steps.length-1;}return render();}
 if(t.matches('[data-guide-next]')){if(step<chapters[chapter].steps.length-1)step++;else if(chapter<chapters.length-1){chapter++;step=0;}else return close();return render();}
 if(t.dataset.sgCopy!==undefined){const value=t.querySelector('code')?.textContent||'';const done=()=>{t.classList.add('copied');setTimeout(()=>t.classList.remove('copied'),1400);};navigator.clipboard?.writeText(value).then(done,()=>{});return;}
 if(t.dataset.press){const target=$(t.dataset.press);if(target&&!target.disabled)target.click();return;}
 if(t.dataset.guideSave==='tiktok'){const input=$('#tiktokChannel'),value=root.querySelector('[data-guide=tiktok]').value.trim();if(input){input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}$('#saveConnections')?.click();return;}
 if(t.dataset.guideSave){const box=document.querySelector('[data-app="'+t.dataset.guideSave+'"]');if(!box)return;for(const name of ['clientId','clientSecret']){const v=root.querySelector('[data-guide-key="'+name+'"]').value.trim();if(v||name==='clientSecret')box.querySelector('[name='+name+']').value=v;}box.querySelector('[data-save-app]')?.click();root.querySelector('[data-guide-key=clientSecret]').value='';return;}
 if(t.matches('[data-guide-finish]')){store.set('bubblecast-guide-obs','done');return close();}
}
function render(){
 const c=chapters[chapter],s=c.steps[step];
 root.querySelector('.sg-chapters ol').innerHTML=chapters.map((x,i)=>`<li><button type="button" data-chapter="${i}" class="${i===chapter?'current':''} ${x.done?.()?'done':''}"${i===chapter?' aria-current="step"':''}><img src="${x.logo}" alt=""><span>${esc(x.title)}</span>${x.done?'<i aria-hidden="true"></i>':''}</button></li>`).join('');
 root.querySelector('.sg-count').textContent=c.steps.length>1?'Step '+(step+1)+' of '+c.steps.length:c.title;
 root.querySelector('#sgTitle').textContent=s.title;
 root.querySelector('.sg-text').innerHTML=s.text.map(p=>`<p>${esc(p)}</p>`).join('');
 root.querySelector('.sg-picture').innerHTML=s.picture||'';
 root.querySelector('.sg-extras').innerHTML=(s.open?`<a class="button sg-open" href="${esc(s.open.url)}" target="_blank" rel="noopener">${esc(s.open.label)} <span aria-hidden="true">↗</span></a>`:'')+(s.copy||[]).map(([label,value])=>`<button type="button" class="sg-copy" data-sg-copy><span>${esc(label)}</span><code data-i18n-skip>${esc(value)}</code><b>Copy</b></button>`).join('')+(s.action?actions[s.action]():'');
 const last=chapter===chapters.length-1&&step===c.steps.length-1;
 root.querySelector('[data-guide-back]').disabled=!chapter&&!step;root.querySelector('[data-guide-next]').textContent=last?'Done':step===c.steps.length-1?'Next: '+chapters[chapter+1].title:'Next';
 root.querySelector('.sg-dots').innerHTML=c.steps.length>1?c.steps.map((_,i)=>`<i class="${i===step?'on':''}"></i>`).join(''):'';
 const tiktok=root.querySelector('[data-guide=tiktok]');if(tiktok)tiktok.value=$('#tiktokChannel')?.value||'';
 sync();animate(root.querySelector('.sg-picture'));
}
// Mirrors Studio's live state (connection labels, codes, saved keys) into the open step.
function sync(){
 if(!root||root.hidden)return;
 for(const el of root.querySelectorAll('[data-mirror]')){const from=$(el.dataset.mirror);const text=from?.textContent||'';if(el.textContent!==text)el.textContent=text;el.classList.toggle('connected',!!from?.classList.contains('connected'));}
 for(const el of root.querySelectorAll('[data-show-if]'))el.hidden=!!$(el.dataset.showIf)?.hidden;
 // Once connected, Studio's Connect button turns into Disconnect, so the guide stops offering it.
 for(const el of root.querySelectorAll('[data-hide-when]'))el.hidden=connected(el.dataset.hideWhen);
 for(const el of root.querySelectorAll('[data-needs-keys]')){const button=$(el.dataset.press);el.disabled=!button||button.dataset.state==='setup';}
 root.querySelectorAll('.sg-chapters button').forEach((b,i)=>b.classList.toggle('done',!!chapters[i].done?.()));
}

// ---- Animation: move the cursor to each action, press it, then type or tick. Loops until the step changes. ----
function animate(stage){
 const id=++animation,screen=stage.querySelector('.sg-window');if(!screen)return;
 const cursor=screen.querySelector('.sg-cursor'),acts=[...screen.querySelectorAll('[data-do]')],reveals=[...screen.querySelectorAll('[data-reveal]')];
 const finish=a=>{a.classList.add('sg-done');if(a.dataset.do==='type')a.textContent=a.dataset.type;if(a.dataset.do==='tick')a.classList.add('on');const key=a.dataset.key||a.closest('[data-key]')?.dataset.key;if(key)for(const r of reveals)if(r.dataset.reveal===key)r.classList.add('sg-shown');};
 if(!motion()){acts.forEach(finish);cursor.hidden=true;return;}
 const live=()=>id===animation&&stage.isConnected&&!root.hidden;
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const reset=()=>{for(const a of acts){a.classList.remove('sg-done','sg-press');if(a.dataset.do==='type')a.textContent='';if(a.dataset.do==='tick')a.classList.remove('on');}for(const r of reveals)r.classList.remove('sg-shown');cursor.style.transform='translate(85%,85%)';};
 (async()=>{while(live()){reset();await sleep(800);for(const a of acts){if(!live())return;const s=screen.getBoundingClientRect(),r=a.getBoundingClientRect();cursor.style.transform=`translate(${r.left-s.left+Math.min(r.width/2,48)}px,${r.top-s.top+r.height/2}px)`;await sleep(800);if(!live())return;a.classList.add('sg-press');await sleep(200);a.classList.remove('sg-press');
  if(a.dataset.do==='type'){for(const ch of a.dataset.type){if(!live())return;a.textContent+=ch;await sleep(38);}}finish(a);await sleep(450);}await sleep(2600);}})();
}

function open(id,options={}){if(!root)build();const i=chapters.findIndex(c=>c.id===id);chapter=i<0?0:i;step=0;root.hidden=false;document.documentElement.classList.add('sg-open');render();clearInterval(timer);timer=setInterval(sync,700);if(options.focus!==false)root.querySelector('[data-guide-next]').focus();}
function close(){if(!root)return;root.hidden=true;animation++;clearInterval(timer);document.documentElement.classList.remove('sg-open');store.set('bubblecast-guide-seen','1');}
window.bubblecastGuide={open,close,chapters};
for(const link of document.querySelectorAll('[data-open-guide]'))link.addEventListener('click',e=>{e.preventDefault();open(link.dataset.openGuide||'welcome');});
// First visit: open on its own once Studio knows nothing is connected yet.
if(!store.get('bubblecast-guide-seen'))setTimeout(()=>{if(store.get('bubblecast-guide-seen')||!$('#studioStatus'))return;const any=['#account-twitch','#account-youtube','#account-kick-api'].some(connected)||!!$('#tiktokChannel')?.value.trim();if(!any)open('welcome',{focus:false});},2500);
})();

import {initConnections} from '/connections.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],form=$('#settings');
const platforms=['twitch','youtube','tiktok','kick'],names={twitch:'Twitch',youtube:'YouTube',tiktok:'TikTok LIVE',kick:'Kick'},logos={twitch:'/logos/twitch.png',youtube:'/logos/youtube.png',tiktok:'/logos/tiktok.svg',kick:'/logos/kick.svg'};
const sourceIds=['twitchChannel','youtubeVideo','youtubeShortsVideo','tiktokChannel','kickChannel'];
let token='',state={},loaded=false,saveTimer=null,demoTimer=null,index=0,sourceFieldsLoaded=false,lastStatus=null;
const store={get(k){try{return localStorage.getItem(k);}catch{return null;}},set(k,v){try{localStorage.setItem(k,v);}catch{}}};
async function api(path,data){const post=()=>fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json','X-Bubblecast-Token':token},body:JSON.stringify(data)});let r=await post();if(r.status===401){token=(await(await fetch('/api/pair')).json()).token;r=await post();}if(!r.ok)throw Error((await r.json()).error);return r.json();}

// Toasts: confirmations fade on their own; problems stay until dismissed.
function toast(text,type='info'){const host=$('#toasts');if(!host)return;const el=document.createElement('div');el.className='toast '+type;el.setAttribute('role',type==='error'?'alert':'status');const msg=document.createElement('span');msg.textContent=text;const close=document.createElement('button');close.type='button';close.className='toast-close';close.setAttribute('aria-label','Dismiss');close.textContent='×';const dismiss=()=>{el.classList.add('leaving');setTimeout(()=>el.remove(),220);};close.onclick=dismiss;el.append(msg,close);host.append(el);while(host.children.length>4)host.firstElementChild.remove();if(type!=='error')setTimeout(dismiss,2600);}
function feedback(text){toast(text);}

// Pages
const pages=['overview','connections','chat','polls','dock','obs'];
function route(){const page=pages.includes(location.hash.slice(1))?location.hash.slice(1):'overview';for(const section of $$('[data-page]'))section.hidden=section.dataset.page!==page;for(const link of $$('[data-page-link]')){const current=link.dataset.pageLink===page;link.classList.toggle('current',current);if(current)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}const lazy=$('#page-'+page+' iframe[data-src]');if(lazy){lazy.src=lazy.dataset.src;lazy.removeAttribute('data-src');}document.title=(page==='overview'?'':$('#page-'+page+' h1').textContent+' · ')+'Bubblecast Studio';$('main')?.scrollTo?.(0,0);}
window.addEventListener('hashchange',route);

// Settings: every change previews instantly and saves shortly after.
function fill(s){state=s;for(const el of form.elements){if(!el.name||!(el.name in s))continue;const v=s[el.name];if(el.type==='checkbox')el.checked=v===true;else if(el.type==='radio')el.checked=el.value===String(v);else el.value=Array.isArray(v)?v.join('\n'):v;}applyTheme(s.uiTheme);outputs();renderBots();syncPollColors();}
function collect(){const data={...state};for(const el of form.elements){if(!el.name)continue;if(el.type==='checkbox')data[el.name]=el.checked;else if(el.type==='radio'){if(el.checked)data[el.name]=el.value;}else if(el.type==='range'||el.type==='number')data[el.name]=Number(el.value);else data[el.name]=el.value;}return data;}
function applyTheme(theme){document.body.dataset.theme=theme==='red'?'red':'rose';}
function outputs(){for(const out of $$('output[data-for]'))out.textContent=form.elements[out.dataset.for].value+(out.dataset.unit||'');for(const range of $$('input[type=range]'))range.style.setProperty('--fill',(range.value-range.min)/(range.max-range.min)*100+'%');const resolution=collect().resolution||'2160',size={'2160':'3840 × 2160','1440':'2560 × 1440','1080':'1920 × 1080'}[resolution];$('#canvasSize').textContent={'2160':'4K · 50%','1440':'1440p · 75%','1080':'1080p · 100%'}[resolution];$('#obsSizeHint').textContent=size+' · transparent';fontStatus();}
function syncPollColors(){const custom=collect().pollColors==='custom',box=$('#pollCustomColors');box.classList.toggle('collapsed',!custom);for(const input of box.querySelectorAll('input'))input.disabled=!custom;}
function preview(data){for(const frame of [$('#preview'),$('#pollPreview')])try{frame.contentWindow?.postMessage({type:'bubblecast-preview-settings',settings:data},location.origin);}catch{}}
function saveState(text,type=''){for(const el of $$('.save-state')){el.textContent=text;el.dataset.state=type;}}
function changed(){if(!loaded)return;const draft=collect();applyTheme(draft.uiTheme);outputs();syncPollColors();preview(draft);saveState('Editing…');clearTimeout(saveTimer);saveTimer=setTimeout(save,450);}
async function save(){clearTimeout(saveTimer);try{saveState('Saving…');state=await api('settings',collect());saveState('Saved','ok');store.set('bubblecast-styled','1');steps();}catch(e){saveState('Not saved','error');toast('Settings were not saved: '+e.message,'error');}}
form.addEventListener('input',e=>{if(e.target.name)changed();});form.addEventListener('change',e=>{if(e.target.name&&e.target.type!=='text')changed();});
form.onsubmit=e=>{e.preventDefault();if(location.hash==='#connections')saveSources().catch(sourceError);};
for(const frame of [$('#preview'),$('#pollPreview')])frame.addEventListener('load',()=>{if(loaded)preview(collect());});
for(const radio of $$('[name=pollPreviewState]'))radio.onchange=()=>{$('#pollPreview').src='/poll-overlay?preview=1&fit=1'+(radio.value==='final'?'&state=final':'');};

// Ignored bots: chips over the saved newline list.
function botList(){return [...new Set($('#ignoredBots').value.split(/[,;\r\n]+/).map(n=>n.trim().replace(/^@/,'')).filter(Boolean))];}
function setBots(list){$('#ignoredBots').value=list.join('\n');renderBots();changed();}
function renderBots(){const host=$('#botChips');host.replaceChildren();const list=botList();if(!list.length){const empty=document.createElement('span');empty.className='chips-empty';empty.textContent='No extra bots yet.';host.append(empty);}for(const name of list){const chip=document.createElement('span');chip.className='chip';chip.textContent=name;const remove=document.createElement('button');remove.type='button';remove.setAttribute('aria-label','Remove '+name);remove.textContent='×';remove.onclick=()=>setBots(botList().filter(n=>n!==name));chip.append(remove);host.append(chip);}}
function addBot(){const input=$('#botName'),name=input.value.trim().replace(/^@/,'');if(!name)return;const list=botList();if(!list.some(n=>n.toLowerCase()===name.toLowerCase()))setBots([...list,name]);input.value='';input.focus();}
$('#addBot').onclick=addBot;$('#botName').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addBot();}});

// Connections
async function saveSources(enabled=true){const values=Object.fromEntries(sourceIds.map(id=>[id,$('#'+id).value]));const sources=await api('sources',{...values,enabled});for(const id of sourceIds){$('#'+id).value=sources[id]||'';store.set(id,$('#'+id).value);}window.dispatchEvent(new CustomEvent('bubblecast-connect-sources'));toast(enabled?'Connections saved. Loading your chats…':'All sources disconnected.','success');}
function sourceError(e){toast(e.message,'error');}
$('#saveConnections').onclick=()=>saveSources().catch(sourceError);
$('#stopSources').onclick=()=>saveSources(false).catch(sourceError);
for(const id of sourceIds){$('#'+id).value=store.get(id)||'';$('#'+id).addEventListener('input',e=>store.set(id,e.target.value));$('#'+id).addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();saveSources().catch(sourceError);}});}
window.addEventListener('bubblecast-save-selected-source',()=>saveSources().catch(sourceError));
window.addEventListener('bubblecast-sources-status',e=>{try{const result=JSON.parse(e.detail);if(result.error)toast(result.error,'error');}catch{}});
window.addEventListener('bubblecast-paired',()=>toast('Browser bridge paired.','success'));
window.addEventListener('bubblecast-bridge-reload-needed',()=>toast('The browser bridge was reloaded. Refresh this page to reconnect.','error'));

// Test bubbles and copying
const samples=[['DemoStreamer','welcome to the stream!','twitch'],['lunarose','hello from YouTube ♡','youtube'],['TikTok friend','hello from TikTok LIVE!','tiktok'],['mossy','FeelsGoodMan','twitch'],['kickfan','hi from Kick!','kick'],['My Complete YouTube Display Name','full names belong in the spotlight ✨','youtube'],['nightowl','check this out https://example.com','twitch'],['peach','💛💛💛','youtube'],['danceparty','SourPls','twitch']];
const demoBadges=[{src:'https://static-cdn.jtvnw.net/badges/v1/2526bab3-6d02-4a55-85f5-9955187d8fb1/3',alt:'4-Year Subscriber'},{src:'https://static-cdn.jtvnw.net/badges/v1/5527c58c-fb7d-422d-b71b-f309dcb85cc1/3',alt:'Broadcaster'}];
async function test(quiet=false){const [user,text,platform]=samples[index++%samples.length];try{await api('test',{id:crypto.randomUUID(),platform,user,badges:user==='DemoStreamer'?demoBadges:[],parts:[{type:'text',text}]});if(!quiet)toast('Test bubble sent to your overlays.','success');}catch(e){toast(e.message,'error');}}
$('#test').onclick=()=>test(true);for(const b of $$('[data-test-message]'))b.onclick=()=>test();
$('#demo').onclick=()=>{if(demoTimer){clearInterval(demoTimer);demoTimer=null;$('#demo').textContent='Play demo';$('#demo').classList.remove('active');}else{test(true);demoTimer=setInterval(()=>test(true),2500);$('#demo').textContent='Stop demo';$('#demo').classList.add('active');}};
$('#clear').onclick=()=>api('clear',{}).catch(e=>toast(e.message,'error'));
for(const button of $$('[data-copy]'))button.onclick=async()=>{const url=location.origin+button.dataset.copy;try{await navigator.clipboard.writeText(url);toast('Copied '+url,'success');const label=button.querySelector('span')||button,before=label.textContent;if(!button.classList.contains('quick')){label.textContent='Copied ✓';setTimeout(()=>label.textContent=before,1600);}}catch{toast('Copy this URL: '+url);}store.set('bubblecast-obs','1');steps();};

// Live status
function steps(){const status=lastStatus,done={connect:!!status?.sources?.configured&&platforms.some(p=>status.sources?.urls?.[p]||p==='youtube'&&status.sources?.urls?.youtubeShorts),obs:store.get('bubblecast-obs')==='1',style:store.get('bubblecast-styled')==='1'};for(const [k,v] of Object.entries(done))$('#step-'+k)?.classList.toggle('done',v);$('#setupGuide').hidden=Object.values(done).every(Boolean);}
function platformState(j,p){const configured=!!(j.sources?.enabled!==false&&(j.sources?.urls?.[p]||p==='youtube'&&j.sources?.urls?.youtubeShorts)),live=Date.now()-(j.bridge?.[p]||0)<25000;return live?'live':configured?'waiting':'off';}
function accountText(account){return account?.signedIn===true?(account.canSend?'Signed in · ready to send':'Signed in · chat not available'):account?.signedIn===false?'Not signed in · reading chat':'Read-only chat';}
function channelText(j,p){const s=j.sources||{};return p==='twitch'?s.twitchChannel:p==='youtube'?[s.youtubeVideo,s.youtubeShortsVideo].filter(Boolean).join(' + '):p==='tiktok'?s.tiktokChannel:s.kickChannel;}
const stateLabel={live:'Receiving chat',waiting:'Waiting for stream',off:'Not connected'};
function paintPlatforms(j){const list=$('#platformList');list.replaceChildren();let connected=0;for(const p of platforms){const st=platformState(j,p),account=j.collector?.accounts?.[p];if(st!=='off')connected++;
 const pill=$('#'+p+'Status');pill.textContent=stateLabel[st];pill.dataset.state=st;
 const nav=$('#nav-'+p);nav.dataset.state=st;nav.title=names[p]+' · '+stateLabel[st];
 const label=$('#account-'+p);label.textContent=accountText(account);label.classList.toggle('connected',account?.signedIn===true);const button=$('[data-setup-signin="'+p+'"]');button.textContent=account?.signedIn?'Manage account':'Sign in';button.disabled=!j.collector?.active;
 const row=document.createElement('li');row.dataset.state=st;const logo=document.createElement('img');logo.src=logos[p];logo.alt='';const text=document.createElement('div');const title=document.createElement('strong');title.textContent=names[p];const sub=document.createElement('span');sub.textContent=channelText(j,p)||'Not set up';text.append(title,sub);const badge=document.createElement('span');badge.className='pill';badge.dataset.state=st;badge.textContent=stateLabel[st];const count=document.createElement('span');count.className='count';const received=j.traffic?.[p]?.received||0;count.textContent=received?received+' msgs':'';row.append(logo,text,count,badge);list.append(row);}
 $('#connectionCount').textContent=connected?String(connected):'';}
async function status(){try{const j=await(await fetch('/api/status')).json();lastStatus=j;
 if(!loaded){fill(j.settings);loaded=true;}else if((j.settings.uiTheme||'rose')!==(state.uiTheme||'rose')&&!saveTimer){state.uiTheme=j.settings.uiTheme;fill({...collect(),uiTheme:j.settings.uiTheme});}
 const online=!!j.collector?.active;$('#studioStatus').textContent=online?'Background app connected':'Background app offline';$('#helperChip').dataset.state=online?'online':'offline';$('#helperBanner').hidden=online;
 paintPlatforms(j);
 if(!sourceFieldsLoaded){if(j.sources?.configured)for(const id of sourceIds)$('#'+id).value=j.sources[id]||'';sourceFieldsLoaded=true;}
 $('#sourceFeedback').textContent=j.sources?.enabled===false?'Sources are disconnected. Save connections to reconnect.':'';steps();
}catch{$('#studioStatus').textContent='Server not responding';$('#helperChip').dataset.state='offline';}}
// Fonts: any installed family. A family is installed when it changes text metrics versus a generic fallback.
function fontAvailable(name){try{const c=document.createElement('canvas').getContext('2d');if(!c)return null;const sample='mmmmmmmmmmlli1WQ@#Aa';return ['monospace','serif','sans-serif'].some(base=>{c.font='40px '+base;const width=c.measureText(sample).width;c.font='40px "'+name+'",'+base;return c.measureText(sample).width!==width;});}catch{return null;}}
function fontStatus(){const name=form.elements.fontFamily.value.replace(/["'`]/g,'').trim()||'Komika Axis',ok=fontAvailable(name),status=$('#fontStatus');$('#fontSample').style.fontFamily='"'+name+'","Arial Rounded MT Bold",sans-serif';status.textContent=ok===null?'':ok?name+' is installed on this computer ✓':name+' isn’t installed on this computer, so overlays use a fallback. Install it on the PC that runs OBS too.';status.dataset.state=ok===false?'missing':'ok';}
if('queryLocalFonts' in window){$('#browseFonts').hidden=false;$('#browseFonts').onclick=async()=>{try{const families=[...new Set((await window.queryLocalFonts()).map(f=>f.family))].sort((a,b)=>a.localeCompare(b));$('#fontOptions').replaceChildren(...families.map(family=>{const option=document.createElement('option');option.value=family;return option;}));toast(families.length+' installed fonts added to the font list.','success');form.elements.fontFamily.select();}catch{toast('Font access was not allowed. You can still type a font name.','error');}};}

token=(await(await fetch('/api/pair')).json()).token;window.dispatchEvent(new CustomEvent('bubblecast-pair',{detail:token}));route();await status();setInterval(status,4000);initConnections(api,toast);

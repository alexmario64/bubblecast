export const defaults={direction:'left',accent:'#21b8df',bubble:'#f3f7f8',text:'#33464e',fontSize:24,duration:18,maxMessages:7,width:420,badgeSize:24,floatAmount:9,resolution:'2160',floatMotion:true,badges:true,platforms:true,linkMode:'strip',fontFamily:'Komika Axis',bttv:true,twitchId:'',filterBots:true,ignoredBots:[],overlayShownBots:[],dockHiddenBots:[],uiTheme:'rose',pollColors:'chat',pollAccent:'#21b8df',pollBubble:'#f3f7f8',pollText:'#33464e',pollBar:'#21b8df',pollPosition:'bottom-left',pollAnimation:'slide',pollWidth:420,pollFontSize:24,pollBarHeight:8,pollResultSeconds:15,pollShowVotes:true,pollShowPercent:true,pollShowPlatforms:true,pollShowFooter:true,pollHighlightLeader:true,pollFloatMotion:true,pollLiveLabel:'Live poll',pollFinalLabel:'Final results'};
// CSS family names only: no quotes, commas or markup.
export function fontFamily(value){const name=typeof value==='string'?value.replace(/["'`]/g,'').replace(/\s+/g,' ').trim():'';return /^[\p{L}\p{N} ._&+-]{1,60}$/u.test(name)?name:'';}
export const fontStack=name=>'"'+(fontFamily(name)||'Komika Axis')+'"';
export const pollPositions=['bottom-left','bottom-right','top-left','top-right','center'];
// Built-in bots, as shown in settings. Matching ignores case and a leading @.
export const knownBots=['StreamElements','Nightbot','Streamlabs','Moobot','Fossabot','WizeBot','Botrix','Sery_Bot','SoundAlerts','PretzelRocks','Botisimo','MixItUpBot','Firebot'];
const hiddenBotNames=new Set(['streamelements','stream elements','nightbot','night bot','streamlabs','moobot','fossabot','wizebot','botrix','sery_bot','soundalerts','pretzelrocks','botisimo','mixitupbot','firebot']);
const senderName=user=>user.trim().replace(/^@/,'').trim().toLowerCase();
function ignoredNames(value){const names=typeof value==='string'?value.slice(0,60000).split(/[,;\r\n]+/):Array.isArray(value)?value:[];return [...new Set(names.filter(n=>typeof n==='string').map(n=>senderName(n).slice(0,256)).filter(Boolean))].slice(0,200);}
export function isBot(user,s=defaults){const name=senderName(user);return hiddenBotNames.has(name)||ignoredNames(s.ignoredBots).includes(name);}
// Stream overlays hide bots unless a bot is switched on for the stream.
export function isIgnoredUser(user,s=defaults){if(s.filterBots===false)return false;return isBot(user,s)&&!ignoredNames(s.overlayShownBots).includes(senderName(user));}
// The dock shows bots unless a bot is switched off for the dock.
export function hiddenInDock(user,s=defaults){return isBot(user,s)&&ignoredNames(s.dockHiddenBots).includes(senderName(user));}
export function settings(input={}) {
 const s={...defaults};
 if(['rose','red'].includes(input.uiTheme))s.uiTheme=input.uiTheme;
 for(const k of ['direction','linkMode']) if((k==='direction'?['left','right']:['strip','drop','show']).includes(input[k])) s[k]=input[k];
 if(['1080','1440','2160'].includes(String(input.resolution)))s.resolution=String(input.resolution);
 for(const k of ['accent','bubble','text']) if(/^#[a-f0-9]{6}$/i.test(input[k])) s[k]=input[k];
 for(const [k,min,max] of [['fontSize',14,40],['duration',3,180],['maxMessages',1,20],['width',240,800],['badgeSize',16,36],['floatAmount',0,12]]) if(Number.isFinite(+input[k]))s[k]=Math.max(min,Math.min(max,+input[k]));
 for(const k of ['badges','platforms','bttv','floatMotion','filterBots']) if(typeof input[k]==='boolean')s[k]=input[k];
 if(['chat','custom'].includes(input.pollColors))s.pollColors=input.pollColors;
 if(pollPositions.includes(input.pollPosition))s.pollPosition=input.pollPosition;
 if(['slide','pop','fade'].includes(input.pollAnimation))s.pollAnimation=input.pollAnimation;
 for(const k of ['pollAccent','pollBubble','pollText','pollBar']) if(/^#[a-f0-9]{6}$/i.test(input[k])) s[k]=input[k];
 for(const [k,min,max] of [['pollWidth',280,900],['pollFontSize',14,40],['pollBarHeight',4,20],['pollResultSeconds',3,120]]) if(input[k]!==''&&input[k]!=null&&Number.isFinite(+input[k]))s[k]=Math.round(Math.max(min,Math.min(max,+input[k])));
 for(const k of ['pollShowVotes','pollShowPercent','pollShowPlatforms','pollShowFooter','pollHighlightLeader','pollFloatMotion']) if(typeof input[k]==='boolean')s[k]=input[k];
 for(const k of ['pollLiveLabel','pollFinalLabel']) if(typeof input[k]==='string'&&input[k].trim())s[k]=input[k].replace(/\s+/g,' ').trim().slice(0,24);
 s.fontFamily=fontFamily(input.fontFamily)||defaults.fontFamily;
 s.twitchId=/^\d{1,20}$/.test(input.twitchId)?input.twitchId:'';s.ignoredBots=ignoredNames(input.ignoredBots);s.overlayShownBots=ignoredNames(input.overlayShownBots);s.dockHiddenBots=ignoredNames(input.dockHiddenBots);return s;
}
// Match ordinary URLs, bare domains, email addresses, and common obfuscated links.
export const links=/(?:https?:\/\/|www\.)[^\s<>]+|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:[\p{L}\d-]+\s*(?:\.|\[\.\]|\(dot\))\s*)+(?:com|net|org|gg|tv|io|co|dev|app|xyz|live|me|be|edu|gov|uk|de|fr|jp|ru|info|link|ly|ai|us|ca|au|it|es|br|in|to|cc|biz|online|site|store|tech|social)(?:\/[^\s<>]*)?/giu;
export function safeMedia(value){try{const u=new URL(value);return u.protocol==='https:'&&/^(?:[\w-]+\.)*(?:jtvnw\.net|twitchcdn\.net|twitch\.tv|kick\.com|kickcdn\.com|ytimg\.com|ggpht\.com|googleusercontent\.com|youtube\.com|tiktokcdn\.com|tiktokcdn-us\.com|tiktokcdn-eu\.com|betterttv\.net|7tv\.app|frankerfacez\.com|giphy\.com|tenor\.com)$/.test(u.hostname)?u.href:null;}catch{return null;}}
// Twitch hydrates Giphy's original GIF into an animated WebP shortly after
// insertion. Both URLs refer to the same rendition; keep playback continuous.
export function sameMediaSource(a,b){
 if(a===b)return true;
 const giphy=value=>{try{const u=new URL(value);if(u.protocol!=='https:'||!/^media\d*\.giphy\.com$/.test(u.hostname))return null;const m=u.pathname.match(/^\/media\/([a-zA-Z0-9]+)\/(giphy)\.(gif|webp)$/);return m?m[1]+':'+m[2]:null;}catch{return null;}};
 const key=giphy(a);return key!==null&&key===giphy(b);
}
export function badgeMedia(value){const safe=safeMedia(value);if(!safe)return null;const u=new URL(safe);if(u.hostname.endsWith('jtvnw.net')&&u.pathname.includes('/badges/v1/'))u.pathname=u.pathname.replace(/\/[123]$/,'/3');if(/(?:ggpht|googleusercontent)\.com$/.test(u.hostname))u.pathname=u.pathname.replace(/=s\d+/, '=s96');return u.href;}
export function normalize(raw,s=defaults){
 if(!['twitch','youtube','tiktok','kick'].includes(raw?.platform)||typeof raw.user!=='string'||!Array.isArray(raw.parts))return null;
 if(isIgnoredUser(raw.user,s))return null;
 const parts=[];let hasLink=false;
 const merged=[];for(const p of raw.parts.slice(0,150)){if(!p||typeof p!=='object')continue;const last=merged.at(-1);if(p.type==='text'&&last?.type==='text')last.text+=String(p.text||'');else merged.push({...p,text:p.type==='text'?String(p.text||''):undefined});}
 for(const p of merged){
  if(p.type==='text') {let t=String(p.text||'').slice(0,3000);links.lastIndex=0;if(links.test(t))hasLink=true;links.lastIndex=0;if(s.linkMode!=='show')t=t.replace(links,'');if(t)parts.push({type:'text',text:t});}
  else if(['image','video'].includes(p.type)){let src=safeMedia(p.src);if(src&&p.type==='image'&&!p.large){const url=new URL(src);if(url.hostname==='static-cdn.jtvnw.net'&&/^\/emoticons\/v2\/[^/]+\/(?:default|static|animated)\/(?:dark|light)\/[123]\.0$/.test(url.pathname)){url.pathname=url.pathname.replace(/\/[123]\.0$/,'/3.0');url.hash='';src=url.href;}}if(src)parts.push({type:p.type,src,alt:String(p.alt||'').slice(0,100),large:!!p.large});}
 }
 if(s.linkMode==='drop'&&hasLink||!parts.some(p=>p.type!=='text'||p.text.trim()))return null;
 return {id:String(raw.id||crypto.randomUUID()).slice(0,200),platform:raw.platform,sourceKey:raw.platform==='youtube'&&raw.sourceKey==='youtubeShorts'?'youtubeShorts':raw.platform,user:raw.user.slice(0,256),userColor:raw.platform==='twitch'&&/^#[a-f0-9]{6}$/i.test(raw.userColor)?raw.userColor.toLowerCase():'',userId:String(raw.userId||'').slice(0,100),parts,badges:(Array.isArray(raw.badges)?raw.badges:[]).slice(0,20).map(b=>({src:badgeMedia(b.src),fallback:safeMedia(b.fallback||b.src),alt:String(b.alt||'badge').slice(0,80),...(b.label?{label:String(b.label).slice(0,16)}:{})})).filter(b=>b.src),time:Date.now()};
}

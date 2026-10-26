// Captures every Bubblecast page with Playwright for visual review.
// Usage: pnpm screenshots [name-filter …]   →   .local/screenshots/*.png
// --offline serves synthetic Studio fixtures and local assets without contacting any server.
// Uses the running local server, or starts one for the duration of the run.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),out=root+'.local/screenshots/',base='http://127.0.0.1:3927';
const desktop={width:1440,height:960},dockNarrow={width:440,height:860},dockWide={width:1180,height:780},canvas={width:1280,height:720};
const studioPages=['overview','connections','appearance','chat','polls','tts','subathon','dock','obs'];
const shots=[
 ...[{name:'studio-subathon-narrow-spanish',path:'/#subathon',viewport:{width:360,height:880}},{name:'dock-subathon-spanish',path:'/dock',viewport:{width:320,height:880},click:'#openSubathon'},{name:'subathon-overlay-spanish',path:'/subathon-overlay?preview=1',viewport:canvas,transparent:true}].map(s=>({...s,language:'es',offlineOnly:true,full:true})),
 {name:'studio-subathon-settings-spanish',path:'/#subathon',viewport:{width:360,height:880},language:'es',offlineOnly:true,reveal:'.sub-configuration',full:true},
 {name:'dock-subathon-settings-spanish',path:'/dock',viewport:{width:320,height:880},language:'es',offlineOnly:true,click:'#openSubathon',reveal:'.sub-configuration'},
 {name:'dock-subathon-desktop',path:'/dock',viewport:desktop,click:'#openSubathon',offlineOnly:true},
 {name:'subathon-overlay',path:'/subathon-overlay?preview=1',viewport:canvas,transparent:true,offlineOnly:true},
 {name:'subathon-overlay-bar',path:'/subathon-overlay?preview=1&layout=bar',viewport:canvas,transparent:true,offlineOnly:true},
 {name:'subathon-overlay-classic',path:'/subathon-overlay?preview=1&style=classic',viewport:canvas,transparent:true,offlineOnly:true},
 {name:'subathon-overlay-modern',path:'/subathon-overlay?preview=1&style=modern',viewport:canvas,transparent:true,offlineOnly:true},
 {name:'subathon-overlay-modern-bar',path:'/subathon-overlay?preview=1&style=modern&layout=bar&position=bottom-center',viewport:canvas,transparent:true,offlineOnly:true},
 {name:'subathon-overlay-classic-split',path:'/subathon-overlay?preview=1&style=classic&split=1&position=top-right',viewport:canvas,transparent:true,offlineOnly:true},
 {name:'subathon-overlay-modern-split',path:'/subathon-overlay?preview=1&style=modern&split=1&position=bottom-right',viewport:canvas,transparent:true,offlineOnly:true},
 {name:'subathon-overlay-part-goal',path:'/subathon-overlay?preview=1&style=modern&part=goal',viewport:{width:640,height:240},transparent:true,offlineOnly:true},
 {name:'subathon-overlay-alone',path:'/subathon-overlay?preview=1&alone=1',viewport:canvas,transparent:true,offlineOnly:true},
 {name:'subathon-overlay-classic-alone',path:'/subathon-overlay?preview=1&alone=1&style=classic&position=top-right',viewport:canvas,transparent:true,offlineOnly:true},
 {name:'subathon-overlay-timer',path:'/subathon-overlay?preview=1&layout=timer',viewport:canvas,transparent:true,offlineOnly:true},
 {name:'studio-subathon-overlay-look',path:'/#subathon',viewport:desktop,offlineOnly:true,reveal:'.sub-look',scroll:'.sub-overlay-link'},
 ...['rose','red','midnight','white'].flatMap(theme=>studioPages.map(page=>({name:`studio-${page}-${theme}`,path:'/#'+page,viewport:desktop,theme,full:true}))),
 ...studioPages.map(page=>({name:`studio-${page}-spanish`,path:'/#'+page,viewport:desktop,language:'es',offlineOnly:true,full:true})),
 ...[{name:'studio-youtube-no-app',viewport:desktop},{name:'studio-youtube-no-app-narrow',viewport:{width:420,height:880}},{name:'studio-youtube-no-app-spanish',viewport:desktop,language:'es'}].map(s=>({...s,path:'/#connections',scenario:'no-app',offlineOnly:true,full:true})),
 ...[{name:'studio-tiktok-session',viewport:desktop},{name:'studio-tiktok-session-narrow',viewport:{width:420,height:880}},{name:'studio-tiktok-session-spanish',viewport:desktop,language:'es'}].map(s=>({...s,path:'/#connections',offlineOnly:true,scroll:'[data-platform="tiktok"]',full:true})),
 ...[...['rose','red','midnight','white'].map(theme=>({name:'studio-youtube-key-matches-'+theme,viewport:desktop,theme})),{name:'studio-youtube-key-matches-narrow',viewport:{width:420,height:880}},{name:'studio-youtube-key-matches-spanish',viewport:desktop,language:'es'}].map(s=>({...s,path:'/#connections',scenario:'key-matches',offlineOnly:true,scroll:'#youtubeStreams',full:true})),
 {name:'studio-diagnostics-narrow',path:'/#overview',viewport:{width:420,height:880},scroll:'.diagnostics-card'},
 {name:'studio-diagnostics-spanish',path:'/#overview',viewport:desktop,language:'es',full:true},
 {name:'studio-overview-narrow',path:'/#overview',viewport:{width:420,height:880}},
 ...['rose','red','midnight','white'].flatMap(theme=>[{name:`dock-${theme}`,path:'/dock?preview=1',viewport:dockNarrow,theme},{name:`dock-wide-${theme}`,path:'/dock?preview=1',viewport:dockWide,theme}]),
 ...['no-app','key-matches'].flatMap(scenario=>['rose','red','midnight','white','spanish'].map(theme=>({name:`dock-connections-${scenario}-${theme}`,path:'/dock?preview=1',viewport:{width:360,height:880},scenario,theme:theme==='spanish'?'rose':theme,language:theme==='spanish'?'es':'en',offlineOnly:true,click:'#connections'}))),
 ...[{name:'dock-connections-unavailable-desktop',viewport:desktop},{name:'dock-connections-unavailable-compact',viewport:{width:320,height:880}}].map(s=>({...s,path:'/dock',scenario:'unavailable',offlineOnly:true,click:'#connections'})),
 {name:'dock-connections-compact-spanish',path:'/dock',viewport:{width:320,height:880},language:'es',scenario:'no-app',offlineOnly:true,click:'#connections'},
 ...['en','es'].map(language=>({name:`dock-diagnostics-${language}`,path:'/dock',viewport:{width:360,height:880},language,offlineOnly:true,click:'#connections',reveal:'.diagnostics-card'})),
 {name:'dock-connections',path:'/dock?preview=1',viewport:dockNarrow,click:'#connections'},
 {name:'dock-new-poll',path:'/dock?preview=1',viewport:dockNarrow,click:'#newPoll'},
 {name:'dock-bots',path:'/dock?preview=1',viewport:dockNarrow,click:'#botMenuButton'},
 {name:'studio-bots',path:'/#chat',viewport:desktop,scroll:'#botGroup'},
 {name:'dock-focus-view',path:'/dock?preview=1',viewport:dockNarrow,focus:'#dockLayout'},
 {name:'dock-poll-pane',path:'/dock?preview=1',viewport:dockWide,click:'#togglePollPane'},
 {name:'dock-columns',path:'/dock?preview=1',viewport:dockWide,select:['#dockLayout','columns'],wait:2000},
 {name:'overlay-chat',path:'/overlay?showcase=1',viewport:canvas,transparent:true,wait:2500},
 {name:'overlay-poll-live',path:'/poll-overlay?preview=1',viewport:canvas,transparent:true},
 {name:'overlay-poll-final',path:'/poll-overlay?preview=1&state=final',viewport:canvas,transparent:true}
];
const offline=process.argv.includes('--offline'),filters=process.argv.slice(2).filter(a=>a!=='--offline'),selected=shots.filter(s=>(!s.offlineOnly||offline)&&(!filters.length||filters.some(f=>s.name.includes(f))));
async function up(){try{return (await fetch(base+'/api/status',{signal:AbortSignal.timeout(1500)})).ok;}catch{return false;}}
let server=null,problems=0;
if(!offline&&!await up()){server=spawn(process.execPath,['server.mjs'],{cwd:root,stdio:'ignore'});for(let i=0;i<50&&!await up();i++)await new Promise(r=>setTimeout(r,200));if(!await up())throw Error('Could not start the local server on port 3927.');}
await mkdir(out,{recursive:true});
const browser=await chromium.launch();
try{
 for(const shot of selected){
  const page=await browser.newPage({viewport:shot.viewport,deviceScaleFactor:2,reducedMotion:'reduce'});
  if(offline)await (await import('../test/browser/offline-studio.mjs')).offlineStudio(page,{language:shot.language,scenario:shot.scenario});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().startsWith('Failed to load resource'))errors.push(m.text());});
  // A missing Komika Axis font is reported in the UI, not a page error.
  page.on('response',r=>{if(r.status()>=400&&!r.url().includes('/fonts/')&&!(shot.scenario==='unavailable'&&r.status()===503&&new URL(r.url()).pathname==='/api/status'))errors.push(r.status()+' '+r.url());});
  // The setup guide would open over Studio on a fresh browser profile.
  await page.addInitScript(()=>{try{localStorage.setItem('bubblecast-guide-seen','1');}catch{}});
  await page.goto(base+shot.path,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(shot.wait||1200);
  // Theme is a saved setting; override it in the page only so nothing is written.
  if(shot.theme)await page.evaluate(theme=>{document.body.dataset.theme=theme;},shot.theme);
  if(shot.scroll){await page.locator(shot.scroll).scrollIntoViewIfNeeded().catch(()=>{});await page.waitForTimeout(400);}
  if(shot.focus){await page.keyboard.press('Tab');await page.focus(shot.focus).catch(()=>{});await page.waitForTimeout(300);}
  if(shot.click){await page.click(shot.click).catch(()=>{});await page.waitForTimeout(500);}
  if(shot.reveal)await page.locator(shot.reveal).evaluate(el=>{el.open=true;el.scrollIntoView({block:'center'});});
  if(shot.select){await page.selectOption(...shot.select).catch(()=>{});await page.waitForTimeout(1500);}
  await page.screenshot({path:out+shot.name+'.png',omitBackground:!!shot.transparent,fullPage:!!shot.full});
  await page.close();console.log(errors.length?'⚠':'✓',shot.name);for(const e of errors)console.log('   ',e);problems+=errors.length;
 }
}finally{await browser.close();server?.kill();}
console.log(`${selected.length} screenshots in ${out}`);if(problems){console.log(problems+' page errors');process.exitCode=1;}

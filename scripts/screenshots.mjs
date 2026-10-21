// Captures every Bubblecast page with Playwright for visual review.
// Usage: pnpm screenshots [name-filter …]   →   .local/screenshots/*.png
// Uses the running local server, or starts one for the duration of the run.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),out=root+'.local/screenshots/',base='http://127.0.0.1:3927';
const desktop={width:1440,height:960},dockNarrow={width:440,height:860},dockWide={width:1180,height:780},canvas={width:1280,height:720};
const studioPages=['overview','connections','chat','polls','dock','obs'];
const shots=[
 ...['rose','red'].flatMap(theme=>studioPages.map(page=>({name:`studio-${page}-${theme}`,path:'/#'+page,viewport:desktop,theme}))),
 {name:'studio-overview-narrow',path:'/#overview',viewport:{width:420,height:880}},
 ...['rose','red'].flatMap(theme=>[{name:`dock-${theme}`,path:'/dock?preview=1',viewport:dockNarrow,theme},{name:`dock-wide-${theme}`,path:'/dock?preview=1',viewport:dockWide,theme}]),
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
const filters=process.argv.slice(2),selected=shots.filter(s=>!filters.length||filters.some(f=>s.name.includes(f)));
async function up(){try{return (await fetch(base+'/api/status',{signal:AbortSignal.timeout(1500)})).ok;}catch{return false;}}
let server=null,problems=0;
if(!await up()){server=spawn(process.execPath,['server.mjs'],{cwd:root,stdio:'ignore'});for(let i=0;i<50&&!await up();i++)await new Promise(r=>setTimeout(r,200));if(!await up())throw Error('Could not start the local server on port 3927.');}
await mkdir(out,{recursive:true});
const browser=await chromium.launch();
try{
 for(const shot of selected){
  const page=await browser.newPage({viewport:shot.viewport,deviceScaleFactor:2,reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().startsWith('Failed to load resource'))errors.push(m.text());});
  // A missing Komika Axis font is reported in the UI, not a page error.
  page.on('response',r=>{if(r.status()>=400&&!r.url().includes('/fonts/'))errors.push(r.status()+' '+r.url());});
  await page.goto(base+shot.path,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(shot.wait||1200);
  // Theme is a saved setting; override it in the page only so nothing is written.
  if(shot.theme)await page.evaluate(theme=>{document.body.dataset.theme=theme;},shot.theme);
  if(shot.scroll){await page.locator(shot.scroll).scrollIntoViewIfNeeded().catch(()=>{});await page.waitForTimeout(400);}
  if(shot.focus){await page.keyboard.press('Tab');await page.focus(shot.focus).catch(()=>{});await page.waitForTimeout(300);}
  if(shot.click){await page.click(shot.click).catch(()=>{});await page.waitForTimeout(500);}
  if(shot.select){await page.selectOption(...shot.select).catch(()=>{});await page.waitForTimeout(1500);}
  await page.screenshot({path:out+shot.name+'.png',omitBackground:!!shot.transparent});
  await page.close();console.log(errors.length?'⚠':'✓',shot.name);for(const e of errors)console.log('   ',e);problems+=errors.length;
 }
}finally{await browser.close();server?.kill();}
console.log(`${selected.length} screenshots in ${out}`);if(problems){console.log(problems+' page errors');process.exitCode=1;}

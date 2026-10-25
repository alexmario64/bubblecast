import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {Window} from 'happy-dom';
import {readYouTubeStreams,readYouTubeStreamShape,discoverYouTubePages} from '../../desktop/youtube-page.mjs';
import {sourceConfig,withFoundVideos} from '../../source-config.mjs';
const channel='https://www.youtube.com/@example/live',main='aaaaaaaaaaa',shorts='bbbbbbbbbbb',ended='ccccccccccc';
const listing={contents:{items:[
 {videoRenderer:{videoId:main,title:{runs:[{text:'Main'}]},thumbnailOverlays:[{thumbnailOverlayTimeStatusRenderer:{style:'LIVE'}}]}},
 {lockupViewModel:{contentId:shorts,metadata:{lockupMetadataViewModel:{title:{content:'Vertical'}}},contentImage:{thumbnailViewModel:{overlays:[{thumbnailOverlayBadgeViewModel:{thumbnailBadges:[{thumbnailBadgeViewModel:{badgeStyle:'THUMBNAIL_BADGE_STYLE_LIVE'}}]}}]}}}},
 {videoRenderer:{videoId:ended,title:{simpleText:'Old LIVE stream'},thumbnailOverlays:[{thumbnailOverlayTimeStatusRenderer:{style:'DEFAULT'}}]}},
 {videoRenderer:{videoId:'ddddddddddd',upcomingEventData:{startTime:'9999999999'},badges:[{metadataBadgeRenderer:{style:'BADGE_STYLE_TYPE_LIVE_NOW'}}]}}
]}};
function page(t,{list=listing,player={},html=''}={}){const w=new Window();t.after(()=>w.happyDOM.abort());w.ytInitialData=list;w.ytInitialPlayerResponse=player;w.document.body.innerHTML=html;return w;}
const evaluate=(w,fn)=>JSON.parse(JSON.stringify(w.eval('('+fn.toString()+')()')));
test('the Streams reader finds live renderer and lockup variants while excluding replays and upcoming cards',t=>{
 const w=page(t);assert.deepEqual(evaluate(w,readYouTubeStreams),[{video:main,title:'Main'},{video:shorts,title:'Vertical'}]);w.ytInitialData=null;assert.equal(evaluate(w,readYouTubeStreams),null);
});
test('watch metadata distinguishes live, ended and unknown instead of treating a missing isLive as ended',t=>{
 const w=page(t,{player:{videoDetails:{videoId:main,isLiveContent:true},microformat:{playerMicroformatRenderer:{liveBroadcastDetails:{isLiveNow:true}}},streamingData:{adaptiveFormats:[{width:1920,height:1080}]}}});
 assert.equal(evaluate(w,readYouTubeStreamShape).live,true);assert.equal(evaluate(w,readYouTubeStreamShape).vertical,false);
 w.ytInitialPlayerResponse={videoDetails:{videoId:shorts,isLiveContent:true}};assert.equal(evaluate(w,readYouTubeStreamShape).live,null);
 w.ytInitialPlayerResponse.microformat={playerMicroformatRenderer:{liveBroadcastDetails:{endTimestamp:'2026-10-24T10:00:00Z'}}};assert.equal(evaluate(w,readYouTubeStreamShape).live,false);
});
test('fallback discovery keeps live-listed streams with incomplete watch metadata and returns real chat URLs',async()=>{
 const calls=[],videos=await discoverYouTubePages({channel,probe:async(url)=>{calls.push(url);return url.endsWith('/streams')?[{video:main,title:'Main'},{video:shorts,title:'Vertical'}]:url.includes(main)?{live:null,vertical:false}:{live:null,vertical:true};}});
 const found=videos.map(v=>({...v,slot:v.vertical?'youtubeShorts':'youtube'})),sources=withFoundVideos(sourceConfig({youtubeChannel:'@example'}),found);
 assert.match(sources.urls.youtube,/live_chat\?v=aaaaaaaaaaa/);assert.match(sources.urls.youtubeShorts,/live_chat\?v=bbbbbbbbbbb/);assert.equal(calls.length,3);
});
test('an empty listing keeps existing chats until their watch pages confirm they ended',async()=>{
 const current=[{video:main,title:'Current',vertical:false}];
 const probe=ended=>async url=>url.endsWith('/streams')?[]:url===channel?{live:null}:ended?{live:false}:null;
 assert.equal((await discoverYouTubePages({channel,current,probe:probe(false)}))[0].video,main);
 assert.deepEqual(await discoverYouTubePages({channel,current,probe:probe(true)}),[]);
 await assert.rejects(discoverYouTubePages({channel,probe:async()=>null}),/could not be read/);
 await assert.rejects(discoverYouTubePages({channel:'https://evil.example/live',probe:async()=>assert.fail('must not probe')}),/Set a YouTube channel/);
});
test('the helper uses disposable muted probes and leaves existing chat windows untouched',async t=>{
 const instances=[],sent=[];
 class BrowserWindow{
  constructor(options){this.options=options;this.w=page(t);this.webContents={setAudioMuted:value=>{this.muted=value;},executeJavaScript:script=>Promise.resolve(this.w.eval(script))};instances.push(this);}
  async loadURL(url){this.url=url;this.w.ytInitialData=url.endsWith('/streams')?listing:null;this.w.ytInitialPlayerResponse=url.includes('/watch?')?{videoDetails:{videoId:new URL(url).searchParams.get('v'),isLiveContent:true,title:'Fixture'},streamingData:{adaptiveFormats:[url.includes(main)?{width:1920,height:1080}:{width:1080,height:1920}]}}:{};}
  isDestroyed(){return !!this.destroyed;}destroy(){this.destroyed=true;}
 }
 const code=await readFile(new URL('../../desktop/main.cjs',import.meta.url),'utf8'),start=code.indexOf('async function youtubeProbe('),end=code.indexOf('async function tick()',start);assert.ok(start>0&&end>start);
 const existing={loadURL:()=>assert.fail('existing chat navigated'),reload:()=>assert.fail('existing chat reloaded')};
 const context=vm.createContext({BrowserWindow,partitionFor:()=> 'fixture-reader',discoverYouTubePages,request:async(path,data)=>{sent.push({path,data});return {};},Date,setTimeout,clearTimeout,windows:new Map([['youtube',existing]])});
 vm.runInContext(code.slice(start,end),context);
 await context.youtubeCheck({id:'fixture',channel,until:Date.now()+55000,current:[]});
 assert.equal(sent.length,1);assert.equal(sent[0].path,'/api/youtube/page-live');assert.equal(sent[0].data.videos.length,2);assert.ok(instances.every(w=>w.destroyed&&w.muted&&w.options.show===false));assert.equal(instances.length,3);
 await context.youtubeCheck({id:'expired',channel,until:Date.now()-1,current:[]});assert.equal(instances.length,3);
});
test('malformed and duplicate listing items cannot create extra or invalid stream destinations',async()=>{
 const videos=await discoverYouTubePages({channel,probe:async url=>url.endsWith('/streams')?[null,{video:'bad'},{video:main},{video:main},{video:shorts}]:{live:null}});
 assert.deepEqual(videos.map(v=>v.video),[main,shorts]);
});
test('a hung probe is destroyed at its deadline and cannot leave the helper waiting indefinitely',async()=>{
 let timeout,destroyed=false;class BrowserWindow{constructor(){this.webContents={setAudioMuted(){}};}loadURL(){return new Promise(()=>{});}isDestroyed(){return destroyed;}destroy(){destroyed=true;}}
 const code=await readFile(new URL('../../desktop/main.cjs',import.meta.url),'utf8'),start=code.indexOf('async function youtubeProbe('),end=code.indexOf('let youtubeChecking',start);
 const context=vm.createContext({BrowserWindow,partitionFor:()=> 'fixture-reader',Date,setTimeout:fn=>{timeout=fn;return 1;},clearTimeout(){}});vm.runInContext(code.slice(start,end),context);
 const pending=context.youtubeProbe('https://www.youtube.com/@example/streams','null',Date.now()+1000);timeout();assert.equal(await pending,null);assert.equal(destroyed,true);
});

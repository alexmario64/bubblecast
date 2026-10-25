// These two readers are serialized into a hidden, signed-out YouTube page by the helper. They only
// inspect the loaded page; they never issue requests, reload chat or sign in.
export function readYouTubeStreams(){
 const out=[],seen=new Set();let visited=0;
 const live=o=>{if(!o||typeof o!=='object')return false;for(const [key,value] of Object.entries(o)){if(['style','badgeStyle'].includes(key)&&['LIVE','BADGE_STYLE_TYPE_LIVE_NOW','THUMBNAIL_BADGE_STYLE_LIVE'].includes(value))return true;if(value&&typeof value==='object'&&live(value))return true;}return false;};
 const title=r=>r.title?.simpleText||r.title?.runs?.map(v=>v.text||'').join('')||r.metadata?.lockupMetadataViewModel?.title?.content||'';
 const walk=o=>{if(!o||typeof o!=='object'||++visited>20000||out.length>=4)return;
  for(const key of ['videoRenderer','gridVideoRenderer','lockupViewModel']){const r=o[key],video=r&&(r.videoId||r.contentId);if(/^[\w-]{11}$/.test(video||'')&&!seen.has(video)&&!r.upcomingEventData&&live(r)){seen.add(video);out.push({video,title:String(title(r)).slice(0,120)});}}
  for(const v of Object.values(o))walk(v);
 };walk(window.ytInitialData);return window.ytInitialData&&typeof window.ytInitialData==='object'?out:null;
}
export function readYouTubeStreamShape(){
 const p=window.ytInitialPlayerResponse||{},d=p.videoDetails||{},b=p.microformat?.playerMicroformatRenderer?.liveBroadcastDetails||{},canonical=document.querySelector('link[rel=canonical]')?.href||'',meta=document.querySelector('meta[itemprop=isLiveBroadcast]')?.content?.toLowerCase()==='true',ended=!!(b.endTimestamp||document.querySelector('meta[itemprop=endDate]'));
 const live=ended?false:b.isLiveNow===true||d.isLive===true||meta?true:b.isLiveNow===false||d.isLiveContent===false?false:null;
 const f=(p.streamingData?.adaptiveFormats||[]).find(f=>f.width>0&&f.height>0);
 return {video:d.videoId||canonical.match(/[?&]v=([\w-]{11})/)?.[1]||'',live,title:String(d.title||'').slice(0,120),vertical:f?f.height>f.width:null};
}

// At most two new streams plus two existing chats. Existing chats are kept until the page explicitly
// says they ended, including when a short-lived empty channel listing or a probe failure hides them.
export async function discoverYouTubePages({channel,current=[],probe}){
 if(!/^https:\/\/www\.youtube\.com\/(?:@[\w.-]{3,30}|channel\/UC[\w-]{22})\/live$/.test(channel))throw Error('Set a YouTube channel in Connections.');
 const shapeScript='('+readYouTubeStreamShape.toString()+')()',list=await probe(channel.replace(/\/live$/,'/streams'),'('+readYouTubeStreams.toString()+')()');
 let candidates=(Array.isArray(list)?list:[]).filter(v=>/^[\w-]{11}$/.test(v?.video||''));
 if(!candidates.length){const fallback=await probe(channel,shapeScript);if(fallback?.live===true&&/^[\w-]{11}$/.test(fallback.video||''))candidates=[fallback];else if(list===null&&fallback?.live==null)throw Error('YouTube channel page could not be read.');}
 const known=current.filter(v=>/^[\w-]{11}$/.test(v?.video||'')).slice(0,2),ids=[...new Set([...known.map(v=>v.video),...[...new Set(candidates.map(v=>v.video))].slice(0,2)])];
 const videos=[];
 for(const video of ids){const prior=known.find(v=>v.video===video),listed=candidates.find(v=>v.video===video),shape=await probe('https://www.youtube.com/watch?v='+video,shapeScript);
  if(shape?.live===false)continue;
  if(prior||listed)videos.push({video,title:shape?.title||listed?.title||prior?.title||'',vertical:shape?.vertical??prior?.vertical??null});
 }
 return videos;
}

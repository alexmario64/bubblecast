// Runs inside a platform's own page (stringified by the helper) and reads the
// live viewer count the way that site's web app does. Read-only; never posts
// chat or changes anything. Returns {live, viewers} or {live:null, error}.
export async function viewerProbe(platform){
 const timeout=ms=>AbortSignal.timeout(ms);
 const count=value=>{const n=Number(String(value??'').replace(/[^\d]/g,''));return Number.isFinite(n)&&String(value??'').match(/\d/)?n:null;};
 try{
  if(platform==='youtube'){
   const videoId=new URLSearchParams(location.search).get('v'),cfg=window.ytcfg;
   const key=cfg?.get?.('INNERTUBE_API_KEY'),context=cfg?.get?.('INNERTUBE_CONTEXT');
   if(!videoId||!key||!context)return {live:null,error:'YouTube page is not ready.'};
   const r=await fetch('/youtubei/v1/updated_metadata?prettyPrint=false&key='+encodeURIComponent(key),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({context,videoId}),signal:timeout(8000)});
   const json=await r.json();
   // Current format: a view count entity. Live streams carry "N watching now" text;
   // ended videos carry a viewCountNumber with lifetime views instead.
   const entity=(json?.frameworkUpdates?.entityBatchUpdate?.mutations||[]).map(m=>m.payload?.viewCountEntity).find(Boolean);
   if(entity)return entity.viewCountNumber!=null?{live:false,viewers:null}:{live:true,viewers:count(entity.viewCount?.runs?.[0]?.text??entity.viewCount?.simpleText)};
   const renderer=(json?.actions||[]).map(a=>a.updateViewershipAction?.viewCount?.videoViewCountRenderer).find(Boolean);
   if(!renderer)return {live:false,viewers:null};
   return {live:renderer.isLive!==false,viewers:count(renderer.originalViewCount)??count(renderer.viewCount?.runs?.[0]?.text??renderer.viewCount?.simpleText)};
  }
  if(platform==='kick'){
   const slug=location.pathname.split('/').filter(Boolean)[0];
   const r=await fetch('/api/v2/channels/'+encodeURIComponent(slug),{headers:{Accept:'application/json'},signal:timeout(8000)});
   const stream=(await r.json())?.livestream;
   return stream?{live:true,viewers:count(stream.viewer_count)}:{live:false,viewers:null};
  }
  if(platform==='tiktok'){
   const handle=(location.pathname.match(/\/@([^/]+)/)||[])[1];
   if(!handle)return {live:null,error:'TikTok page is not ready.'};
   const r=await fetch('/api-live/user/room/?aid=1988&sourceType=54&uniqueId='+encodeURIComponent(handle),{signal:timeout(8000)});
   const data=(await r.json())?.data,room=data?.liveRoom,live=data?.user?.status===2||room?.status===2;
   return live?{live:true,viewers:count(room?.liveRoomStats?.userCount)}:{live:false,viewers:null};
  }
  return {live:null,error:'Unknown platform.'};
 }catch(error){return {live:null,error:String(error?.message||error).slice(0,120)};}
}

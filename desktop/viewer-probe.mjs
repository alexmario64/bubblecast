// Runs inside a platform's own page (stringified by the helper) and reads the
// live viewer count the way that site's web app does. Read-only; never posts
// chat or changes anything. Returns {live, viewers} or {live:null, error}.
export async function viewerProbe(platform){
 const timeout=ms=>AbortSignal.timeout(ms);
 const count=value=>{const n=Number(String(value??'').replace(/[^\d]/g,''));return Number.isFinite(n)&&String(value??'').match(/\d/)?n:null;};
 try{
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

// Exercise the real server on an OS-assigned local port, with an empty data folder and no external
// network access. Keep production Host validation intact; the test sends the canonical Host header.
import http from 'node:http';
const realNow=Date.now;let clockOffset=0;Date.now=()=>realNow()+clockOffset;process.on('message',m=>{if(Number.isFinite(m.advance)){clockOffset+=m.advance;process.send?.({advanced:true});}});
globalThis.fetch=async url=>{
 if(process.env.BUBBLECAST_TEST_YOUTUBE){
  const u=new URL(url),ids=['aaaaaaaaaaa','bbbbbbbbbbb'];
  if(u.origin==='https://www.googleapis.com'){
   if(u.pathname.endsWith('/liveBroadcasts'))return Response.json({items:ids.map(id=>({id,snippet:{title:'Fixture'},status:{lifeCycleStatus:'live'}}))});
   if(u.pathname.endsWith('/videos'))return Response.json({items:ids.map(id=>({id,liveStreamingDetails:{activeLiveChatId:'chat-'+id}}))});
   if(u.pathname.endsWith('/liveChat/messages/stream'))return Response.json({error:{errors:[{reason:process.env.BUBBLECAST_TEST_YOUTUBE==='forbidden'?'forbidden':'quotaExceeded'}]}},{status:403});
  }
 }
 throw Error('External requests are disabled in the server fixture.');
};
globalThis.WebSocket=class{constructor(){throw Error('External sockets are disabled in the server fixture.');}};
const listen=http.Server.prototype.listen;
http.Server.prototype.listen=function(_port,host,callback){
 this.once('listening',()=>console.log('BUBBLECAST_TEST_PORT='+this.address().port));
 return listen.call(this,0,host,callback);
};
await import('../../server.mjs');

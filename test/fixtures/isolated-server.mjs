// Exercise the real server on an OS-assigned local port, with an empty data folder and no external
// network access. Keep production Host validation intact; the test sends the canonical Host header.
import http from 'node:http';
const realNow=Date.now;let clockOffset=0;Date.now=()=>realNow()+clockOffset;process.on('message',m=>{if(Number.isFinite(m.advance)){clockOffset+=m.advance;process.send?.({advanced:true});}});
const networkCalls=[];process.on('message',m=>{if(m.networkCalls)process.send?.({calls:networkCalls});});
globalThis.fetch=async url=>{
 networkCalls.push(String(url));
 if(process.env.BUBBLECAST_TEST_YOUTUBE){
  const u=new URL(url),ids=['aaaaaaaaaaa','bbbbbbbbbbb'];
  if(u.origin==='https://www.googleapis.com'){
   if(u.pathname.endsWith('/liveBroadcasts'))return Response.json({items:ids.map(id=>({id,snippet:{title:'Fixture'},status:{lifeCycleStatus:'live'},...(process.env.BUBBLECAST_TEST_YOUTUBE==='keys'?{contentDetails:{boundStreamId:id===ids[0]?'vertical-id':'main-id'}}:{})}))});
   if(u.pathname.endsWith('/liveStreams'))return Response.json({items:[{id:'vertical-id',status:{streamStatus:'active'},cdn:{ingestionInfo:{streamName:'fixture-vertical-ingestion-private'}}},{id:'main-id',status:{streamStatus:'active'},cdn:{ingestionInfo:{streamName:'fixture-main-ingestion-private'}}}]});
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
 return listen.call(this,Number(process.env.BUBBLECAST_TEST_PORT)||0,host,callback);
};
// Only this isolated browser fixture accepts its random loopback port. Production Host/Origin
// validation stays unchanged. Track SSE responses so tests can inject synthetic TTS without voices.
if(process.env.BUBBLECAST_TEST_BROWSER){
 const create=http.createServer,streams=new Set();
 http.createServer=function(handler){return create.call(this,(req,res)=>{
  const origin='http://127.0.0.1:'+req.socket.localPort;
  if(req.headers.host==='127.0.0.1:'+req.socket.localPort){req.headers.host='127.0.0.1:3927';if(req.headers.origin===origin)req.headers.origin='http://127.0.0.1:3927';}
  if(req.url==='/api/events'){streams.add(res);res.on('close',()=>streams.delete(res));}
  return handler(req,res);
 });};
 process.on('message',m=>{if(m.broadcast){const {type,data}=m.broadcast;for(const res of streams)res.write('event: '+type+'\ndata: '+JSON.stringify(data)+'\n\n');process.send?.({broadcast:true});}});
}
await import('../../server.mjs');

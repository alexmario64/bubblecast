import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export async function isolatedServer(t,{youtubeFixture=false,browser=false}={}){
 const dir=await mkdtemp(join(tmpdir(),'bubblecast-data-')),root=fileURLToPath(new URL('..',import.meta.url));
 if(youtubeFixture){await mkdir(join(dir,'.local'),{recursive:true});const clientId='fixture.apps.googleusercontent.com';await writeFile(join(dir,'.local','app-keys.json'),JSON.stringify({youtube:{clientId,clientSecret:'fixture-secret'}}));await writeFile(join(dir,'.local','youtube-auth.json'),JSON.stringify({client_id:clientId,refresh_token:'fixture-refresh',access_token:'fixture-access',expires_at:Date.now()+3600000,channel:{id:'UCabcdefghijklmnopqrstuv',title:'Fixture'}}));}
 let server,port=0;
 const stop=async()=>{if(server&&server.exitCode===null&&server.signalCode===null){const exited=new Promise(r=>server.once('exit',r));server.kill();await exited;}};
 const start=async()=>{
  server=spawn(process.execPath,['test/fixtures/isolated-server.mjs'],{cwd:root,env:{...process.env,BUBBLECAST_DATA:dir,BUBBLECAST_TEST_YOUTUBE:youtubeFixture===true?'quota':youtubeFixture||'',BUBBLECAST_TEST_PORT:String(port),BUBBLECAST_TEST_BROWSER:browser?'1':''},stdio:['ignore','pipe','pipe','ipc']});let output='';
  port=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Isolated server did not start: '+output)),10000);server.on('error',e=>{clearTimeout(timer);reject(e);});server.stderr.on('data',s=>{output+=s;});server.stdout.on('data',s=>{output+=s;const m=output.match(/BUBBLECAST_TEST_PORT=(\d+)/);if(m){clearTimeout(timer);resolve(Number(m[1]));}});server.once('exit',()=>{clearTimeout(timer);reject(Error('Isolated server exited: '+output));});});
 };
 t.after(async()=>{await stop();await rm(dir,{recursive:true,force:true});});await start();
 const request=(path,options={})=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port,path,method:options.method||'GET',headers:{...options.headers,Host:'127.0.0.1:3927'}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:res.headers})));res.on('error',reject);});req.on('error',reject);if(options.body)req.write(options.body);req.end();});
 const advance=ms=>new Promise((resolve,reject)=>{server.once('message',resolve);server.send({advance:ms},e=>{if(e)reject(e);});});
 const broadcast=(type,data)=>new Promise((resolve,reject)=>{server.once('message',resolve);server.send({broadcast:{type,data}},e=>{if(e)reject(e);});});
 return {dir,request,advance,broadcast,url:'http://127.0.0.1:'+port,stop,restart:async()=>{await stop();await start();}};
}

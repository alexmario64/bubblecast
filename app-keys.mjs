// Each streamer registers their own Google and Kick apps, so every install has its own API quota.
// The keys stay in .local/app-keys.json on this computer and are never sent anywhere but the platform.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
const rules={youtube:{id:/^[\w-]+\.apps\.googleusercontent\.com$/,name:'Google client ID'},kick:{id:/^[\w-]{6,100}$/,name:'Kick client ID'}};
export class AppKeys{
 constructor({file}){this.file=file;this.keys={youtube:{clientId:'',clientSecret:''},kick:{clientId:'',clientSecret:''}};}
 async load(){try{const saved=JSON.parse(await readFile(this.file,'utf8'));for(const p of Object.keys(rules))if(saved?.[p])this.keys[p]={clientId:String(saved[p].clientId||''),clientSecret:String(saved[p].clientSecret||'')};}catch{}}
 get(platform){return this.keys[platform];}
 // Secrets are never sent back to the page, only whether one is saved.
 public(){return Object.fromEntries(Object.entries(this.keys).map(([p,k])=>[p,{clientId:k.clientId,hasSecret:!!k.clientSecret}]));}
 async set(platform,{clientId,clientSecret}){
  const rule=rules[platform];if(!rule)throw Error('Unknown platform.');
  const id=String(clientId||'').trim(),secret=String(clientSecret??'').trim(),current=this.keys[platform];
  if(id&&!rule.id.test(id))throw Error('That does not look like a '+rule.name+'.');
  if(secret&&(secret.length>200||/\s/.test(secret)))throw Error('That client secret is not valid.');
  this.keys[platform]={clientId:id,clientSecret:id?(secret||(id===current.clientId?current.clientSecret:'')):''};
  await mkdir(dirname(this.file),{recursive:true});await writeFile(this.file,JSON.stringify(this.keys),{mode:0o600});
  return this.keys[platform];
 }
}

// Checks GitHub for a newer Bubblecast release: at most every few hours, or when Studio asks. Only GitHub is
// contacted. An installed copy (packaged Windows app) can then ask the background app to install it.
export const RELEASES='https://api.github.com/repos/alexmario64/bubblecast/releases/latest';
const DOWNLOADS=/^https:\/\/github\.com\/alexmario64\/bubblecast\/releases\/download\/v\d+\.\d+\.\d+\/Bubblecast-Setup-\d+\.\d+\.\d+\.exe(?:\.sha256)?$/;
// True when version a is newer than b (both "major.minor.patch").
export function newer(a,b){const pa=String(a).split('.').map(Number),pb=String(b).split('.').map(Number);for(let i=0;i<3;i++){const x=pa[i]||0,y=pb[i]||0;if(x!==y)return x>y;}return false;}
export const downloadAllowed=url=>DOWNLOADS.test(String(url||''));

export class Updates{
 constructor({current,packaged=false,request=fetch,now=Date.now,every=6*3600000}){Object.assign(this,{current,packaged,request,now,every});this.info=null;this.checked=false;this.checkedAt=0;this.error=null;this.progress=null;this.checking=null;}
 status(){const i=this.info,available=!!i&&newer(i.version,this.current);
  return {current:this.current,packaged:this.packaged,checkedAt:this.checked?this.checkedAt:null,error:this.error,latest:i?.version||null,available,installable:available&&this.packaged&&!!i.installer&&!!i.checksum,page:i?.page||null,progress:this.progress};}
 // Returns the cached answer unless it is older than `every`, or `force` is set.
 async check(force=false){
  if(!force&&this.checked&&this.now()-this.checkedAt<this.every)return this.status();
  if(this.checking)return this.checking;
  this.checking=(async()=>{
   try{const r=await this.request(RELEASES,{headers:{Accept:'application/vnd.github+json','User-Agent':'Bubblecast'},signal:AbortSignal.timeout(15000)});
    if(!r.ok)throw Error('GitHub returned HTTP '+r.status);const j=await r.json();const version=String(j.tag_name||'').replace(/^v/,'');
    if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('the latest release has no version number');
    const asset=name=>{const url=j.assets?.find(a=>a.name===name)?.browser_download_url;return downloadAllowed(url)?url:null;};
    this.info={version,installer:asset(`Bubblecast-Setup-${version}.exe`),checksum:asset(`Bubblecast-Setup-${version}.exe.sha256`),page:typeof j.html_url==='string'&&j.html_url.startsWith('https://github.com/alexmario64/bubblecast/')?j.html_url:null};
    this.error=null;
   }catch(e){this.error='Could not check for updates: '+(e?.message||e);}
   this.checkedAt=this.now();this.checked=true;this.checking=null;return this.status();
  })();
  return this.checking;
 }
 // What the background app needs to install the latest release, or null if there is nothing to install.
 job(){const s=this.status();return s.installable?{version:this.info.version,installer:this.info.installer,checksum:this.info.checksum}:null;}
 report(stage,detail=''){if(!['downloading','installing','failed'].includes(stage))return;this.progress={stage,detail:String(detail).slice(0,300),at:this.now()};}
}

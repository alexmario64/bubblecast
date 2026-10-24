// Downloads a Bubblecast installer from the project's GitHub releases and checks it against the release's
// SHA-256 checksum file before saving it. Nothing is saved or run when anything doesn't match.
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {downloadAllowed} from '../updates.mjs';
async function fetchOk(request,url){const r=await request(url,{signal:AbortSignal.timeout(600000)});if(!r.ok)throw Error('Download failed: HTTP '+r.status);return r;}
export async function downloadUpdate({version,installer,checksum,dir,request=fetch}){
 if(!/^\d+\.\d+\.\d+$/.test(version||'')||!downloadAllowed(installer)||!downloadAllowed(checksum)||!installer.endsWith(`/v${version}/Bubblecast-Setup-${version}.exe`)||checksum!==installer+'.sha256')throw Error('The update address was not a Bubblecast release.');
 const expected=(await (await fetchOk(request,checksum)).text()).trim().split(/\s+/)[0].toLowerCase();
 if(!/^[a-f0-9]{64}$/.test(expected))throw Error('The release has no valid checksum.');
 const data=Buffer.from(await (await fetchOk(request,installer)).arrayBuffer());
 if(createHash('sha256').update(data).digest('hex')!==expected)throw Error('The downloaded installer did not match its checksum.');
 const path=join(dir,`Bubblecast-Setup-${version}.exe`);await writeFile(path,data);return path;
}

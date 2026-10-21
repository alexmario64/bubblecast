import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
export const electronVersion='44.9.0';
export const runtimeFolder=fileURLToPath(new URL('../.local/electron/',import.meta.url));
// Windows is the streaming target; macOS runs the same helper for development.
export function runtimeTarget(platform=process.platform,arch=process.arch,folder=runtimeFolder){
 if(platform==='win32')return {platform,archive:`electron-v${electronVersion}-win32-x64.zip`,binary:join(folder,'electron.exe')};
 if(platform==='darwin'){const cpu=arch==='arm64'?'arm64':'x64';return {platform,archive:`electron-v${electronVersion}-darwin-${cpu}.zip`,binary:join(folder,'Electron.app','Contents','MacOS','Electron')};}
 throw Error('The background helper supports Windows (streaming) and macOS (development).');
}

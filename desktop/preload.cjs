const {contextBridge,ipcRenderer,webFrame}=require('electron');
// TikTok stops following a LIVE in a page it thinks nobody is watching, and Bubblecast's capture windows are
// hidden. Report the page as visible so a new stream connects without opening the window.
if(/(^|\.)tiktok\.com$/.test(location.hostname))webFrame.executeJavaScript(`(()=>{for(const [k,v] of [['visibilityState','visible'],['hidden',false],['webkitVisibilityState','visible'],['webkitHidden',false]])Object.defineProperty(Document.prototype,k,{configurable:true,get:()=>v});Document.prototype.hasFocus=()=>true;document.addEventListener('visibilitychange',e=>e.stopImmediatePropagation(),true);})()`).catch(()=>{});
contextBridge.exposeInMainWorld('bubblecastCapture',{send:(envelope,reply)=>{ipcRenderer.invoke('bubblecast-chat',envelope).then(result=>reply?.(result)).catch(error=>reply?.({ok:false,error:error.message}));}});

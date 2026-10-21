const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('bubblecastCapture',{send:(envelope,reply)=>{ipcRenderer.invoke('bubblecast-chat',envelope).then(result=>reply?.(result)).catch(error=>reply?.({ok:false,error:error.message}));}});

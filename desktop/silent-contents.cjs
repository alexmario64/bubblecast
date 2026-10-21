const installed=new WeakSet();
function silenceContents(contents){
 if(!contents||installed.has(contents))return;installed.add(contents);
 const mute=()=>{if(!contents.isDestroyed?.())contents.setAudioMuted(true);};
 mute();
 for(const event of ['did-start-loading','did-start-navigation','media-started-playing'])contents.on(event,mute);
 contents.on('audio-state-changed',(_event,state)=>{if(state?.audible)mute();});
 contents.on('did-create-window',child=>silenceContents(child.webContents));
}
module.exports={silenceContents};

(()=>{
 if(window.__bubblecastTikTokPlayer)return;window.__bubblecastTikTokPlayer=true;
 const attempted=new WeakSet();
 function start(){for(const video of document.querySelectorAll('video')){video.muted=true;video.autoplay=true;video.playsInline=true;if(!attempted.has(video)){attempted.add(video);video.play().catch(()=>{});}}}
 const observer=new MutationObserver(start);observer.observe(document.documentElement,{childList:true,subtree:true});start();
 window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
})();

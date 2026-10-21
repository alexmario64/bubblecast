globalThis.BubblecastSourceManager=class {
 constructor(api){this.api=api;this.queue=Promise.resolve();}
 configure(config){const job=this.queue.then(()=>this.apply(config));this.queue=job.catch(()=>{});return job;}
 async apply(config){
  if(!config?.configured)return {ok:true,configured:false};
  const urls={twitch:String(config.urls?.twitch||''),youtube:String(config.urls?.youtube||''),youtubeShorts:String(config.urls?.youtubeShorts||''),tiktok:String(config.urls?.tiktok||'')};
  if(urls.twitch&&!/^https:\/\/www\.twitch\.tv\/popout\/[a-z0-9_]{1,25}\/chat\?popout=$/.test(urls.twitch))throw Error('Invalid Twitch source URL');
  if(urls.youtube&&!/^https:\/\/www\.youtube\.com\/live_chat\?v=[\w-]{11}&is_popout=1$/.test(urls.youtube))throw Error('Invalid YouTube source URL');
  if(urls.youtubeShorts&&!/^https:\/\/www\.youtube\.com\/live_chat\?v=[\w-]{11}&is_popout=1$/.test(urls.youtubeShorts))throw Error('Invalid YouTube Shorts source URL');
  if(urls.youtubeShorts===urls.youtube)urls.youtubeShorts='';
  if(config.captureMode==='desktop')for(const key of Object.keys(urls))urls[key]='';
  if(urls.tiktok&&!/^https:\/\/www\.tiktok\.com\/@[a-z0-9_](?:[a-z0-9_.]{0,22}[a-z0-9_])?\/live$/.test(urls.tiktok))throw Error('Invalid TikTok source URL');
  const saved=await this.api.storage.local.get(['managedTabs']);const managed={...(saved.managedTabs||{})},version=this.api.runtime?.getManifest?.().version||'';
  await this.api.storage.local.set({managedSources:config});
  for(const platform of ['twitch','youtube','youtubeShorts','tiktok']){
   const url=urls[platform],previous=managed[platform];
   if(!url){if(previous?.id!=null){try{await this.api.tabs.remove(previous.id);}catch{}}delete managed[platform];continue;}
   let tab=null;if(previous?.id!=null){try{tab=await this.api.tabs.get(previous.id);}catch{}}
   if(tab){await this.api.tabs.update(tab.id,{...(previous.url!==url?{url}:{}),muted:true,autoDiscardable:false});if(previous.url===url&&(tab.discarded||version&&previous.version!==version))await this.api.tabs.reload(tab.id);}
   else{tab=await this.api.tabs.create({url,active:false});await this.api.tabs.update(tab.id,{muted:true,autoDiscardable:false});}
   managed[platform]={id:tab.id,url,version};
   await this.api.storage.local.set({managedTabs:managed});
  }
  await this.api.storage.local.set({managedTabs:managed});
  return {ok:true,configured:true,enabled:config.enabled!==false,twitch:!!managed.twitch,youtube:!!managed.youtube,youtubeShorts:!!managed.youtubeShorts,tiktok:!!managed.tiktok};
 }
 async sourceKey(platform,tabId){const saved=await this.api.storage.local.get(['managedSources','managedTabs']);if(!saved.managedSources?.configured)return platform;return (platform==='youtube'?['youtube','youtubeShorts']:[platform]).find(key=>saved.managedSources.urls?.[key]&&saved.managedTabs?.[key]?.id===tabId)||null;}
 async accepts(platform,tabId){return !!await this.sourceKey(platform,tabId);}
 async restore(){const {managedSources}=await this.api.storage.local.get('managedSources');return managedSources?this.configure(managedSources):{ok:true,configured:false};}
};

function youtubeId(value){let id=String(value||'').trim();if(id.includes('://')){let u;try{u=new URL(id);}catch{throw Error('Enter a YouTube live-video link.');}if(!['www.youtube.com','youtube.com','youtu.be'].includes(u.hostname)||u.protocol!=='https:')throw Error('Use an HTTPS YouTube live-video link.');id=u.hostname==='youtu.be'?u.pathname.split('/').filter(Boolean)[0]||'':u.searchParams.get('v')||(/^\/(?:live|shorts)\//.test(u.pathname)?u.pathname.split('/')[2]:'');if(!id)throw Error('Use the video’s watch/live link, rather than a YouTube channel page.');}if(id&&!/^[\w-]{11}$/.test(id))throw Error('Enter a valid YouTube live-video link or 11-character video ID.');return id;}
export function sourceConfig(input={}){
 let twitchChannel=String(input.twitchChannel||'').trim().toLowerCase(),youtubeVideo=youtubeId(input.youtubeVideo),youtubeShortsVideo=youtubeId(input.youtubeShortsVideo),tiktokChannel=String(input.tiktokChannel||'').trim().toLowerCase();
 if(twitchChannel.includes('://')){let u;try{u=new URL(twitchChannel);}catch{throw Error('Enter a Twitch channel name or twitch.tv channel link.');}if(!['twitch.tv','www.twitch.tv'].includes(u.hostname)||u.protocol!=='https:')throw Error('Use an HTTPS twitch.tv channel link.');twitchChannel=u.pathname.split('/').filter(Boolean)[0]||'';}
 if(twitchChannel&&!/^[a-z0-9_]{1,25}$/.test(twitchChannel))throw Error('Enter a valid Twitch channel name.');
 if(tiktokChannel.includes('://')){let u;try{u=new URL(tiktokChannel);}catch{throw Error('Enter a TikTok @handle or full LIVE link.');}if(!['www.tiktok.com','tiktok.com'].includes(u.hostname)||u.protocol!=='https:')throw Error('Use an HTTPS tiktok.com @handle/live link.');const match=u.pathname.match(/^\/@([a-z0-9_.]{1,24})(?:\/live)?\/?$/);if(!match)throw Error('Use a TikTok profile or LIVE link, rather than a video or short sharing link.');tiktokChannel=match[1];}
 tiktokChannel=tiktokChannel.replace(/^@/,'');if(tiktokChannel&&!/^[a-z0-9_](?:[a-z0-9_.]{0,22}[a-z0-9_])?$/.test(tiktokChannel))throw Error('Enter a valid TikTok @handle.');
 let kickChannel=String(input.kickChannel||'').trim().toLowerCase().replace(/^@/,'');
 if(kickChannel.includes('://')){let u;try{u=new URL(kickChannel);}catch{throw Error('Enter a Kick channel or channel link.');}if(u.protocol!=='https:'||!['kick.com','www.kick.com'].includes(u.hostname)||!/^\/[a-z0-9_-]+\/?$/.test(u.pathname))throw Error('Use an HTTPS kick.com channel link.');kickChannel=u.pathname.split('/')[1];}
 if(kickChannel&&!/^[a-z0-9][a-z0-9_-]{0,49}$/.test(kickChannel))throw Error('Enter a valid Kick channel name.');
 const enabled=input.enabled!==false;
 return {configured:true,enabled,twitchChannel,youtubeVideo,youtubeShortsVideo,tiktokChannel,kickChannel,urls:{kick:enabled&&kickChannel?'https://kick.com/'+kickChannel:'',twitch:enabled&&twitchChannel?'https://www.twitch.tv/popout/'+twitchChannel+'/chat?popout=':'',youtube:enabled&&youtubeVideo?'https://www.youtube.com/live_chat?v='+youtubeVideo+'&is_popout=1':'',youtubeShorts:enabled&&youtubeShortsVideo&&youtubeShortsVideo!==youtubeVideo?'https://www.youtube.com/live_chat?v='+youtubeShortsVideo+'&is_popout=1':'',tiktok:enabled&&tiktokChannel?'https://www.tiktok.com/@'+tiktokChannel+'/live':''}};
}

// With no YouTube links entered, the streams found on the connected channel fill the YouTube slots.
export function withFoundVideos(saved,found){if(!saved.enabled||saved.youtubeVideo||saved.youtubeShortsVideo||!found?.length)return {...saved,youtubeFound:[]};const [first,second]=found;
 return {...saved,configured:true,youtubeFound:found,urls:{...saved.urls,youtube:'https://www.youtube.com/live_chat?v='+first.video+'&is_popout=1',youtubeShorts:second?'https://www.youtube.com/live_chat?v='+second.video+'&is_popout=1':''}};}

// Account channels are runtime defaults. Never save them as manual overrides.
export function withAccountChannels(saved,{twitch='',kick=''}={}){
 const entered=Object.fromEntries(['twitchChannel','youtubeVideo','youtubeShortsVideo','tiktokChannel','kickChannel'].map(key=>[key,saved[key]||'']));
 const next=sourceConfig({...saved,twitchChannel:saved.twitchChannel||twitch,kickChannel:saved.kickChannel||kick});
 return {...next,configured:!!(saved.configured||twitch||kick),entered};
}

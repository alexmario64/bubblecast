function youtubeId(value){let id=String(value||'').trim();if(id.includes('://')){let u;try{u=new URL(id);}catch{throw Error('Enter a YouTube live-video link.');}if(!['www.youtube.com','youtube.com','youtu.be'].includes(u.hostname)||u.protocol!=='https:')throw Error('Use an HTTPS YouTube live-video link.');id=u.hostname==='youtu.be'?u.pathname.split('/').filter(Boolean)[0]||'':u.searchParams.get('v')||(/^\/(?:live|shorts)\//.test(u.pathname)?u.pathname.split('/')[2]:'');if(!id)throw Error('Use the video’s watch/live link, rather than a YouTube channel page.');}if(id&&!/^[\w-]{11}$/.test(id))throw Error('Enter a valid YouTube live-video link or 11-character video ID.');return id;}
// A YouTube channel for reading chat without the API: @handle, a youtube.com/@handle or /channel/UC… link.
function youtubeChannelPath(value){let v=String(value||'').trim();if(!v)return '';if(v.includes('://')){let u;try{u=new URL(v);}catch{throw Error('Enter a YouTube @handle or channel link.');}if(!['www.youtube.com','youtube.com','m.youtube.com'].includes(u.hostname)||u.protocol!=='https:')throw Error('Use an HTTPS youtube.com channel link.');v=u.pathname;}
 v=v.replace(/^\/+|\/+$/g,'').replace(/\/(?:live|streams|videos|featured)$/,'');
 if(/^channel\/UC[\w-]{22}$/.test(v))return v;if(/^UC[\w-]{22}$/.test(v))return 'channel/'+v;const h=v.replace(/^@/,'');if(/^[\w.-]{3,30}$/.test(h))return '@'+h;throw Error('Enter a YouTube @handle or channel link.');}
export const youtubeLivePage=path=>'https://www.youtube.com/'+path+'/live';
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
 const youtubeChannel=youtubeChannelPath(input.youtubeChannel);
 return {configured:true,enabled,twitchChannel,youtubeVideo,youtubeShortsVideo,youtubeChannel,tiktokChannel,kickChannel,urls:{kick:enabled&&kickChannel?'https://kick.com/'+kickChannel:'',twitch:enabled&&twitchChannel?'https://www.twitch.tv/popout/'+twitchChannel+'/chat?popout=':'',youtube:enabled&&youtubeVideo?'https://www.youtube.com/live_chat?v='+youtubeVideo+'&is_popout=1':'',youtubeShorts:enabled&&youtubeShortsVideo&&youtubeShortsVideo!==youtubeVideo?'https://www.youtube.com/live_chat?v='+youtubeShortsVideo+'&is_popout=1':'',tiktok:enabled&&tiktokChannel?'https://www.tiktok.com/@'+tiktokChannel+'/live':''}};
}

// With no YouTube links entered, the streams found on the connected channel fill their assigned YouTube slots.
// With nothing found through the API (quota used up, no Google app, not live yet), the channel's live page is read
// instead: the channel entered, or the connected YouTube account's channel.
export function withFoundVideos(saved,found,accountChannel=''){if(!saved.enabled||saved.youtubeVideo||saved.youtubeShortsVideo)return {...saved,youtubeFound:[]};
 if(!found?.length){const path=saved.youtubeChannel||(/^UC[\w-]{22}$/.test(accountChannel)?'channel/'+accountChannel:'');return {...saved,youtubeFound:[],...(path?{configured:true,urls:{...saved.urls,youtube:youtubeLivePage(path)}}:{})};}const url=slot=>{const f=found.find(f=>f.slot===slot);return f?'https://www.youtube.com/live_chat?v='+f.video+'&is_popout=1':'';};
 return {...saved,configured:true,youtubeFound:found,urls:{...saved.urls,youtube:url('youtube'),youtubeShorts:url('youtubeShorts')}};}

// Account channels are runtime defaults. Never save them as manual overrides.
export function withAccountChannels(saved,{twitch='',kick=''}={}){
 const entered=Object.fromEntries(['twitchChannel','youtubeVideo','youtubeShortsVideo','youtubeChannel','tiktokChannel','kickChannel'].map(key=>[key,saved[key]||'']));
 const next=sourceConfig({...saved,twitchChannel:saved.twitchChannel||twitch,kickChannel:saved.kickChannel||kick});
 return {...next,configured:!!(saved.configured||twitch||kick),entered};
}

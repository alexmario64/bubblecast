// Shared connection presenters for Studio and the dock. Keep platform policy and status copy here.
(()=>{
 const platforms=['twitch','youtube','tiktok','kick'],names={twitch:'Twitch',youtube:'YouTube',tiktok:'TikTok LIVE',kick:'Kick'};
 const tr=text=>window.bubblecastI18n?.translate?.(text)??text;
 const sourceIds=['twitchChannel','youtubeChannel','youtubeVideo','youtubeShortsVideo','tiktokChannel','kickChannel'];
 function youtubeState(y={}){const quota=!!y.quotaUntil,page=y.readMode?y.readMode==='page':!y.configured||quota;
  return {page,quota,description:quota?'The YouTube quota is used up. Reading continues from the public chat page until it resets; sending and polls are unavailable.':'Enter your YouTube channel below to read chat without a Google app. Sending messages and running polls need your Google app.',account:y.connected?'Connected as '+(y.channel?.title||'your channel')+(y.live===false?' · reads chat while OBS is live':''):y.configured?'Not connected · connect to read chat, send messages, run polls and see viewers':'Read-only YouTube chat'};
 }
 function tiktokAccount(account){return account?.signedIn===true?(account.canSend?'Signed in · ready to send':'Signed in · chat not available'):account?.signedIn===false?'Sign in to TikTok · reading chat':'Read-only chat';}
 function syncSources(root,sources,{submitted}={}){const saved=sources?.entered||sources||{};
  for(const id of sourceIds){const input=root.querySelector('#'+id);if(!input)continue;const before=input.dataset.connectionSaved;
   if(input.value===(submitted?.[id]??before??''))input.value=String(saved[id]||'');input.dataset.connectionSaved=String(saved[id]||'');
  }
 }
function sourceValues(root,{changedOnly=false}={}){return Object.fromEntries(sourceIds.map(id=>[id,root.querySelector('#'+id)]).filter(([,input])=>input&&(!changedOnly||input.value!==(input.dataset.connectionSaved??''))).map(([id,input])=>[id,input.value]));}
function paintDiagnostics(root,d){
 const $=s=>root.querySelector(s);if(!d)return;
 const states={disabled:'Sources disconnected','not-configured':'Not set up',waiting:'Waiting for chat',receiving:'Receiving chat',connected:'Chat connected','helper-offline':'Background app offline',error:'Capture or connection error','signin-required':'Connect YouTube in Connections'};
 const routes={irc:'Twitch chat',api:'YouTube API',network:'Network capture',page:'Page capture',none:'No capture yet'};
 const sessions={'signed-in':'Signed in','signed-out':'Not signed in',unknown:'Session not checked'};
 const list=$('#diagnosticPlatforms');list.replaceChildren();
 for(const p of platforms){const row=d.platforms?.[p];if(!row)continue;const li=document.createElement('li'),name=document.createElement('strong'),detail=document.createElement('span');name.textContent=names[p];li.dataset.state=row.state;
 const when=row.lastMessageAt?new Date(row.lastMessageAt).toLocaleTimeString():tr('No messages yet');
 const startup={painting:'Starting hidden window',painted:'Hidden window started',failed:'Hidden window could not start','user-opened':'Window opened'};
 detail.textContent=[tr(p==='tiktok'&&row.state==='signin-required'?'Sign in to TikTok':states[row.state]||'Waiting for chat'),tr(routes[row.route]||'No capture yet'),tr(p==='tiktok'&&row.session==='signed-out'&&row.state!=='signin-required'?'Sign in to TikTok':sessions[row.session]||'Session not checked'),...(startup[row.startup]?[tr(startup[row.startup])]:[]),tr('Received')+': '+row.received,tr('Shown')+': '+row.displayed,tr('Last message')+': '+when].join(' · ');li.append(name,detail);list.append(li);}
 const obs=d.obs||{},on=value=>tr(value===true?'Streaming':value===false?'Not streaming':'Not detected'),paths={both:'WebSocket + OBS browser',websocket:'WebSocket',browser:'OBS browser',none:'No detection path'};
 $('#diagnosticObs').textContent=['OBS: '+on(obs.main),'Aitum: '+on(obs.vertical),tr(paths[obs.path]||'No detection path'),obs.websocket==='unavailable'?tr('OBS WebSocket unavailable'):null].filter(Boolean).join(' · ');
 const y=d.youtube||{},checks={idle:'No check yet',checking:'Checking',complete:'Check finished',error:'Check failed'},latest=(y.api?.startedAt||0)>=(y.page?.startedAt||0)?y.api:y.page;
 const blocked={disabled:'Sources disconnected','manual-links':'Using your stream links','signin-required':'Connect YouTube in Connections','missing-channel':'Add a YouTube channel or connect YouTube in Connections.','helper-offline':'Start the background app to read YouTube page chat.'};
 const series=y.series||{},seriesLabels={idle:'Waiting for a stream-start trigger',scheduled:'Stream checks scheduled',checking:'Checking',complete:'Expected streams found',exhausted:'Automatic checks finished',stopped:'Stream checks stopped'},seriesText=tr(blocked[y.blocked]||seriesLabels[series.state]||'Waiting for a stream-start trigger')+(series.nextAt?' · '+tr('Next check')+': '+new Date(series.nextAt).toLocaleTimeString():'');
 if($('#youtubeDiscoveryNote'))$('#youtubeDiscoveryNote').textContent=seriesText;if($('#youtubeCheck'))$('#youtubeCheck').disabled=y.blocked&&y.blocked!=='none'||series.state==='checking';
 const yt=[!y.channel&&!y.slots?.horizontal&&!y.slots?.vertical?tr('Add a YouTube channel or connect YouTube in Connections.'):null,y.app&&!y.connected?tr('Connect YouTube in Connections'):null,y.quotaExhausted?tr('YouTube quota used up'):null,tr('YouTube slots')+': '+([y.slots?.horizontal?tr('Horizontal'):null,y.slots?.vertical?tr('Vertical'):null].filter(Boolean).join(' + ')||tr('None found')),tr(y.trigger==='stream-start'?'Stream-start check':y.trigger==='dock-send'?'Dock-send check':y.trigger==='manual'?'Manual check':'Waiting for a stream-start trigger'),y.route==='api'?tr('YouTube API'):y.route==='page'?tr('Page capture'):null,tr(checks[latest?.state]||'No check yet')+(latest?.finishedAt?' · '+new Date(latest.finishedAt).toLocaleTimeString()+' · '+tr('Found')+': '+latest.found:'')];
 $('#diagnosticYouTube').textContent=[...yt,seriesText,tr('Attempts')+': '+(series.attempt||0)+' / 4'].filter(Boolean).join(' · ');
 const lastPaint=Math.max(0,...Object.values(d.overlays?.lastPaint||{}));$('#diagnosticPages').textContent=tr('Live page connections')+': '+(d.overlays?.clients||0)+' · '+tr('Last page paint')+': '+(lastPaint?new Date(lastPaint).toLocaleTimeString():tr('Not detected'));
 $('#diagnosticLog').textContent=tr(d.log?.error?'Local log could not be written.':'Local log: .local/diagnostics.log');$('#diagnosticLog').classList.toggle('diagnostic-error',!!d.log?.error);
}
function paintStreams(list,y,{post,refresh,onError}){const streams=y.candidates||[],key=JSON.stringify([window.bubblecastI18n?.language||'en',streams]);if(list.dataset.key===key)return;list.dataset.key=key;list.hidden=!streams.length;list.replaceChildren();
 for(const c of streams){const row=document.createElement('li'),name=document.createElement('span'),state=document.createElement('span'),choice=document.createElement('select');name.className='stream-title';name.textContent=c.title||c.video;name.title=c.title||'';state.className='stream-state';const matched={'obs-main':'Matched OBS main key','aitum-vertical':'Matched Aitum Vertical key','remembered-key':'Remembered stream key',manual:'Manual format',ambiguous:'Same key on both outputs',unknown:'Stream key not matched'};state.textContent=[tr(c.live?'Live':c.receiving?'Receiving video':'Not live yet'),...(matched[c.formatSource]?[tr(matched[c.formatSource])]:[])].join(' · ');
  for(const [value,text] of [['auto','Automatic'],['horizontal','Horizontal'],['vertical','Vertical'],['hide','Hide']]){const o=document.createElement('option');o.value=value;o.textContent=text;choice.append(o);}
  choice.value=c.hidden?'hide':c.formatSource&&c.formatSource!=='manual'?'auto':c.format||'auto';choice.setAttribute('aria-label','Format for '+(c.title||c.video));choice.onchange=async()=>{choice.disabled=true;try{await post('youtube/stream',{video:c.video,choice:choice.value});await refresh();}catch(e){onError(e.message);}finally{choice.disabled=false;}};
  row.append(name,state,choice);list.append(row);}}

 window.bubblecastConnections={youtubeState,tiktokAccount,paintDiagnostics,paintStreams,syncSources,sourceValues,sourceIds};
})();

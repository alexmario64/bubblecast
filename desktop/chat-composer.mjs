// Runs only inside the configured platform's own top-level source page.
// Returns no cookies, tokens, passwords, or private account data.
export function pageComposer(platform,action='inspect',expected=''){
 const visible=el=>{if(!el||el.closest('[hidden],[aria-hidden="true"]')||!el.getClientRects().length)return false;const style=getComputedStyle(el);return style.visibility!=='hidden'&&style.visibility!=='collapse'&&style.display!=='none';};
 const pick=selector=>[...document.querySelectorAll(selector)].find(visible);
 const selectors={
  kick:{input:'[data-testid="chat-input"][contenteditable="true"],#chat-input-wrapper textarea',send:'#send-message-button',login:'[data-testid="login-button"]'},
  twitch:{input:'[data-a-target="chat-input"][contenteditable="true"],.chat-wysiwyg-input__editor[contenteditable="true"],textarea[data-a-target="chat-input"]',send:'[data-a-target="chat-send-button"]',login:'[data-a-target="login-button"]'},
  youtube:{input:'yt-live-chat-message-input-renderer #input:is([contenteditable=""],[contenteditable="true"],[contenteditable="plaintext-only"])',send:'yt-live-chat-message-input-renderer #send-button button,yt-live-chat-message-input-renderer #send-button yt-button-shape button',login:'yt-live-chat-message-input-renderer #sign-in-button,yt-live-chat-renderer a[href*="accounts.google.com/ServiceLogin"]'},
  tiktok:{input:'[data-e2e="room-chat-input-field"]:is([contenteditable=""],[contenteditable="true"],[contenteditable="plaintext-only"]),[data-e2e="chat-input"] [contenteditable="true"],[data-e2e="chat-input"][contenteditable="true"],[data-e2e="comment-input"][contenteditable="true"],textarea[data-e2e="chat-input"]',send:'[data-e2e="room-chat-send-btn"],[data-e2e="chat-send-button"],[data-e2e="chat-send"],[data-e2e="comment-post"]',login:'[data-e2e="top-login-button"]'}
 };
 const config=selectors[platform];if(!config)return {state:'unavailable',detail:'Unsupported platform'};
 const input=pick(config.input),login=pick(config.login)||(platform==='kick'?[...document.querySelectorAll('button')].find(el=>visible(el)&&/^(log in|sign in)$/i.test(el.textContent.trim())):null);
 // TikTok leaves its enabled native Send div CSS-invisible in a background
 // window. Its pointer cursor changes only once the editor accepts the draft.
 // Keep this exception confined to that exact control and native ready state.
 const hiddenTikTokSend=platform==='tiktok'?[...document.querySelectorAll('[data-e2e="room-chat-send-btn"]')].find(el=>!el.closest('[hidden],[aria-hidden="true"]')&&el.getClientRects().length&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).cursor==='pointer'):null;
 const button=pick(config.send)||hiddenTikTokSend;
 const content=el=>el?('value' in el?el.value:el.textContent).replace(/\uFEFF/g,'').trim():'';
 const state=login?'signed-out':!input||input.getAttribute('aria-disabled')==='true'||input.disabled?'unavailable':'ready';
 const nativeSignedIn=platform==='kick'?(login?false:document.querySelector('[data-testid="user-menu"],[data-testid="user-avatar"],button[aria-label="Open user menu"]')?true:null):platform==='youtube'&&typeof window.ytcfg?.get?.('LOGGED_IN')==='boolean'?window.ytcfg.get('LOGGED_IN'):null;
 const info={state,signedIn:nativeSignedIn,detail:state==='ready'?'Chat composer ready':state==='signed-out'?'Sign in to send messages':!input?'The message field was not found on the connected chat page. Refresh this source in Connections.':'The platform has disabled this chat’s message field.',draft:!!content(input),maxLength:input?.maxLength>0?input.maxLength:null};
 if(action==='inspect')return info;
 if(state!=='ready')return {...info,ok:false};
 if(action==='poll-command-point'&&platform==='kick'){
  if(content(input)&&content(input)!=='/poll')return {ok:false,detail:'There is an unrelated native draft. Nothing was changed.'};
  input.scrollIntoView({block:'nearest',inline:'nearest'});const r=input.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
  if(r.width<1||r.height<1||x<0||y<0||x>=innerWidth||y>=innerHeight)return {ok:false,detail:'Kick’s native editor is outside the capture viewport.'};
  return {ok:true,x,y};
 }
 if(action==='select-poll-command'&&platform==='kick'){
  if(content(input)!=='/poll')return {ok:false,detail:'The native draft changed. Nothing was cleared.'};input.focus();const range=document.createRange();range.selectNodeContents(input);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);return {ok:true};
 }
 if(action==='focus-poll-command'&&platform==='kick'){
  if(content(input)!=='/poll')return {ok:false,detail:'The poll command changed. Nothing was submitted.'};input.focus();
  return {ok:true};
 }
 if(action==='focus'){
  if(content(input))return {ok:false,detail:'There is an unsent draft in the platform chat. Clear it there first.'};
  input.focus();return {ok:true,maxLength:info.maxLength};
 }
 if(action==='submit'||action==='ready'){
  if(content(input)!==expected.trim())return {ok:false,detail:'The platform did not accept the complete text. No send was attempted.'};
  if(!button||button.disabled||button.getAttribute('aria-disabled')==='true'||getComputedStyle(button).cursor==='not-allowed')return {ok:false,detail:'The platform Send button is unavailable. Check chat restrictions or sign in.'};
  if(action==='submit')button.click();return {ok:true};
 }
 if(action==='check')return {ok:true,cleared:!content(input),unchanged:content(input)===expected.trim()};
 return {ok:false,detail:'Unknown composer action'};
}

export async function submitChat(contents,platform,text,{pause=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 const evaluate=(action,expected='')=>contents.executeJavaScript('('+pageComposer.toString()+')('+JSON.stringify(platform)+','+JSON.stringify(action)+','+JSON.stringify(expected)+')');
 const before=await evaluate('focus');if(!before.ok)return {status:'failed',detail:before.detail||'Sign in to this chat first.'};
 if(before.maxLength&&text.length>before.maxLength)return {status:'failed',detail:'Message exceeds this chat’s character limit.'};
 await contents.insertText(text);await pause(100);
 if(platform==='tiktok')for(let i=0;i<5;i++){const ready=await evaluate('ready',text);if(ready.ok)break;await pause(100);}
 const sent=await evaluate('submit',text);if(!sent.ok)return {status:'failed',detail:sent.detail};
 for(let i=0;i<12;i++){await pause(150);const check=await evaluate('check',text);if(check.cleared)return {status:'submitted',detail:'Submitted through your signed-in chat session. Platform delivery is not independently confirmed.'};}
 return {status:'unknown',detail:'Send was clicked, but the platform did not confirm it. Check chat before retrying.'};
}

export async function sendToTargets(job,resolveSource,send=submitChat){
 return Object.fromEntries(await Promise.all(Object.entries(job.urls).map(async([key,url])=>{
  if(Date.now()-job.createdAt>30000)return [key,{status:'failed',detail:'Message expired before sending.'}];
  const source=resolveSource(key);if(!source||source.url!==url||source.win.isDestroyed())return [key,{status:'failed',detail:'This chat connection changed or closed. Nothing was sent.'}];
  try{const current=new URL(source.win.webContents.getURL()),expected=new URL(url);if(current.origin!==expected.origin||current.pathname!==expected.pathname||current.searchParams.get('v')!==expected.searchParams.get('v'))return [key,{status:'failed',detail:'Chat is on a sign-in page or a different stream.'}];return [key,await send(source.win.webContents,source.platform,job.text)];}catch{return [key,{status:'unknown',detail:'The chat window stopped responding. Check chat before retrying.'}];}
 })));
}

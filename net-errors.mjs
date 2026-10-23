// Turns Node's low-level network errors into messages a streamer can act on. Every caller already retries.
export function errorText(error,platform){
 const message=String(error?.message||error||'');
 if(error?.name==='TimeoutError'||error?.name==='AbortError'&&/timeout/i.test(message)||/aborted due to timeout/i.test(message))return platform+' did not answer in time. Bubblecast keeps retrying.';
 if(error instanceof TypeError&&/^fetch failed$/i.test(message)||/^fetch failed$/i.test(message))return 'Could not reach '+platform+'. Check your internet connection; Bubblecast keeps retrying.';
 return message;
}

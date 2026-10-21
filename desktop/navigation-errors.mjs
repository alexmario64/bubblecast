export function abortedNavigation(error){return error?.errno===-3||error?.code==='ERR_ABORTED'||/\bERR_ABORTED\b/.test(String(error?.message||''));}
export function navigationCode(error){return String(error?.code||error?.errno||'LOAD_FAILED').replace(/[^A-Z0-9_-]/gi,'').slice(0,30);}

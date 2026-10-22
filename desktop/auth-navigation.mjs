export function allowedSignInURL(value,platform){
 try{const u=new URL(value);if(u.protocol!=='https:')return false;const domains={tiktok:['tiktok.com','google.com'],kick:['kick.com','google.com']}[platform]||[];return domains.some(d=>u.hostname===d||u.hostname.endsWith('.'+d));}catch{return false;}
}

// One-time import: node scripts/import-youtube-emojis.mjs ~/Downloads/live_chat.html
// Reads the saved page locally and adds its emojis to .local/youtube-emojis.json. Nothing is fetched.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {pageEmojis} from '../youtube-merge.mjs';
const file=process.argv[2];if(!file){console.error('Usage: node scripts/import-youtube-emojis.mjs <saved live_chat.html>');process.exit(1);}
const store=join(dirname(fileURLToPath(import.meta.url)),'..','.local','youtube-emojis.json');
const emojis=pageEmojis(await readFile(file,'utf8'));
if(!emojis.length){console.error('No emojis found. Save the page at youtube.com/live_chat?v=<video> (Page Source), not the watch page.');process.exit(1);}
let known={};try{known=JSON.parse(await readFile(store,'utf8'));}catch{}
const merged={...known,...Object.fromEntries(emojis)};
await mkdir(dirname(store),{recursive:true});await writeFile(store,JSON.stringify(merged));
console.log(`Imported ${emojis.length} YouTube emojis (${Object.keys(merged).length} saved). Restart Bubblecast to use them.`);

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {readFile} from 'node:fs/promises';
const root=new URL('../../public/',import.meta.url),code=await readFile(new URL('i18n.js',root),'utf8');
// Names, URLs, units and brand words that read the same in Spanish.
const same=new Set(['Bubblecast','Twitch','YouTube','TikTok','Kick','TikTok LIVE','Shorts','YouTube Live','YouTube Shorts Live','Komika Axis','4K','1440p','1080p','4K · 50%','/dock','twitch.tv/activate','http://localhost:3927/oauth/kick/callback','….apps.googleusercontent.com','Overlays','Bots','Bot','Raids','Final','English','Español','!tts','/tts','VIPs']);
async function page(t,file){const w=new Window({url:'http://127.0.0.1:3927/'});t.after(()=>w.happyDOM.abort());w.document.write(await readFile(new URL(file,root),'utf8'));w.eval(code);return w;}
const flush=w=>new Promise(r=>w.setTimeout(r,0));
function visible(w){const out=[];const walk=n=>{for(const c of n.childNodes){if(c.nodeType===3){const t=c.textContent.replace(/\s+/g,' ').trim();if(t&&/[A-Za-z]/.test(t)&&!['SCRIPT','STYLE'].includes(c.parentNode?.tagName))out.push(t);}else if(c.nodeType===1&&!['SCRIPT','STYLE'].includes(c.tagName)){for(const a of ['placeholder','title','aria-label']){const v=c.getAttribute(a);if(v&&/[A-Za-z]/.test(v))out.push(v);}walk(c);}}};walk(w.document.body);return out;}
for(const file of ['index.html','dock.html'])test(file+' has a Spanish translation for every visible text',async t=>{
 const w=await page(t,file),english=visible(w);w.bubblecastI18n.setLanguage('es');const spanish=visible(w);
 const missing=english.filter((text,i)=>text===spanish[i]&&!same.has(text));assert.deepEqual(missing,[]);assert.equal(w.document.documentElement.lang,'es');
});
test('text the page adds later is translated, chat stays as written, and English comes back',async t=>{
 const w=await page(t,'index.html'),label=w.document.querySelector('#account-youtube');w.bubblecastI18n.setLanguage('es');
 label.textContent='Connected as Live';await flush(w);assert.equal(label.textContent,'Conectado como Live');
 label.textContent='Sending as SampleStreamer · finding channel';await flush(w);assert.equal(label.textContent,'Enviando como SampleStreamer · buscando el canal');
 const input=w.document.querySelector('#youtubeVideo');assert.equal(input.placeholder,'Se encuentra solo');
 w.bubblecastI18n.setLanguage('en');assert.equal(label.textContent,'Sending as SampleStreamer · finding channel');assert.equal(input.placeholder,'Found automatically');
 const dock=await page(t,'dock.html');dock.bubblecastI18n.setLanguage('es');const row=dock.document.createElement('div');row.className='chat-row';row.textContent='Send';dock.document.querySelector('#messages').append(row);await flush(dock);assert.equal(row.textContent,'Send','a viewer typing "Send" is not translated');
});

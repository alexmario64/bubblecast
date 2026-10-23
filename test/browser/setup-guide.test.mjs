import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {readFile} from 'node:fs/promises';
const root=new URL('../../public/',import.meta.url);
const [html,i18n,guide]=await Promise.all(['index.html','i18n.js','setup-guide.js'].map(f=>readFile(new URL(f,root),'utf8')));
// Studio without its app script; the guide opens on demand and pictures show their finished state.
async function studio(t){
 const w=new Window({url:'http://127.0.0.1:3927/'});t.after(()=>w.happyDOM.abort());w.document.write(html.replace(/<script[^>]*><\/script>/g,''));
 w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});w.localStorage.setItem('bubblecast-guide-seen','1');
 w.eval(i18n);w.eval(guide);return w;
}
const flush=w=>new Promise(r=>w.setTimeout(r,0));
// Names, brand words and sample values that read the same in Spanish.
const same=new Set(['Twitch','YouTube','TikTok LIVE','Kick','OBS','Bubblecast','Google Cloud','OBS Studio','YouTube Data API v3','…/auth/youtube.force-ssl','URL','OK']);
function visible(w){const out=[];const walk=n=>{for(const c of n.childNodes){if(c.nodeType===3){const t=c.textContent.replace(/\s+/g,' ').trim();if(t&&/[A-Za-z]/.test(t))out.push(t);}else if(c.nodeType===1&&!c.closest('[data-i18n-skip]')&&!c.hidden){for(const a of ['placeholder','title','aria-label']){const v=c.getAttribute(a);if(v&&/[A-Za-z]/.test(v))out.push(v);}walk(c);}}};walk(w.document.querySelector('.sg-layer'));return out;}
test('every step of the setup guide is in Spanish, apart from names and sample values',async t=>{
 const w=await studio(t),g=w.bubblecastGuide;const missing=new Set();
 for(const chapter of g.chapters)for(let i=0;i<chapter.steps.length;i++){
  w.bubblecastI18n.setLanguage('en');g.open(chapter.id,{focus:false});for(let k=0;k<i;k++)w.document.querySelector('[data-guide-next]').click();await flush(w);
  const english=visible(w);w.bubblecastI18n.setLanguage('es');await flush(w);const spanish=visible(w);
  english.forEach((text,k)=>{if(text===spanish[k]&&!same.has(text))missing.add(text);});
 }
 assert.deepEqual([...missing],[]);
});
test('the guide walks every chapter in order and remembers it was seen',async t=>{
 const w=await studio(t),g=w.bubblecastGuide,doc=w.document;w.localStorage.clear();
 g.open('welcome',{focus:false});const titles=[];const total=g.chapters.reduce((n,c)=>n+c.steps.length,0);
 for(let i=0;i<total;i++){titles.push(doc.querySelector('#sgTitle').textContent);doc.querySelector('[data-guide-next]').click();}
 assert.equal(titles.length,total);assert.equal(new Set(titles).size,total,'every step has its own title');
 assert.equal(doc.querySelector('.sg-layer').hidden,true,'Done closes the guide');assert.equal(w.localStorage.getItem('bubblecast-guide-seen'),'1');
});
test('the final steps save keys and connect through Studio’s own controls',async t=>{
 const w=await studio(t),g=w.bubblecastGuide,doc=w.document;const pressed=[];
 doc.querySelector('[data-save-app="youtube"]').addEventListener('click',()=>pressed.push(['save',doc.querySelector('[data-app="youtube"] [name=clientId]').value,doc.querySelector('[data-app="youtube"] [name=clientSecret]').value]));
 const connect=doc.querySelector('#youtubeConnect');connect.dataset.state='setup';connect.addEventListener('click',()=>pressed.push(['connect']));
 g.open('youtube',{focus:false});const steps=g.chapters.find(c=>c.id==='youtube').steps.length;for(let k=1;k<steps;k++)doc.querySelector('[data-guide-next]').click();
 const button=doc.querySelector('.sg [data-press="#youtubeConnect"]');await new Promise(r=>w.setTimeout(r,800));assert.equal(button.disabled,true,'Connect waits for saved keys');
 doc.querySelector('[data-guide-key=clientId]').value='123-abc.apps.googleusercontent.com';doc.querySelector('[data-guide-key=clientSecret]').value='GOCSPX-sample';doc.querySelector('[data-guide-save=youtube]').click();
 assert.deepEqual(pressed,[['save','123-abc.apps.googleusercontent.com','GOCSPX-sample']]);assert.equal(doc.querySelector('[data-guide-key=clientSecret]').value,'','the secret leaves the guide once saved');
 connect.dataset.state='idle';await new Promise(r=>w.setTimeout(r,800));assert.equal(button.disabled,false);button.click();assert.deepEqual(pressed.at(-1),['connect']);
 doc.querySelector('#account-youtube').textContent='Connected as Sample channel';doc.querySelector('#account-youtube').classList.add('connected');await new Promise(r=>w.setTimeout(r,800));
 assert.equal(doc.querySelector('.sg [data-mirror="#account-youtube"]').textContent,'Connected as Sample channel');assert.equal(button.hidden,true,'Connect is not offered once connected, since Studio’s button then disconnects');assert.ok(doc.querySelector('.sg-chapters [data-chapter="2"]').classList.contains('done'));
});
test('Studio links to the guide instead of GitHub',async()=>{
 assert.ok(!/github\.com/.test(html),'no GitHub links in Studio');assert.match(html,/data-open-guide="youtube"/);assert.match(html,/data-open-guide="kick"/);assert.match(html,/data-open-guide="welcome"/);
});

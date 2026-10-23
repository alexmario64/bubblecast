import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {readFile} from 'node:fs/promises';
const code=await readFile(new URL('../../public/tooltip.js',import.meta.url),'utf8');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
test('hovering shows one themed tooltip instead of the system one, and the title comes back afterwards',async t=>{
 const w=new Window();t.after(()=>w.happyDOM.abort());w.document.body.innerHTML='<button id="chip" title="Evening Stream"><span>YouTube</span></button><button id="plain">Send</button>';w.eval(code);
 const chip=w.document.querySelector('#chip'),inner=chip.querySelector('span'),over=(el,from=null)=>el.dispatchEvent(new w.PointerEvent('pointerover',{bubbles:true,pointerType:'mouse',relatedTarget:from}));
 over(inner);await wait(380);const tip=w.document.querySelector('.bc-tooltip');
 assert.equal(tip.textContent,'Evening Stream');assert.equal(chip.hasAttribute('title'),false,'the system tooltip is suppressed while ours shows');assert.equal(chip.getAttribute('aria-describedby'),'bc-tooltip');
 inner.dispatchEvent(new w.PointerEvent('pointerout',{bubbles:true,relatedTarget:w.document.querySelector('#plain')}));
 assert.equal(chip.getAttribute('title'),'Evening Stream','the title is restored');assert.equal(tip.classList.contains('visible'),false);assert.equal(chip.hasAttribute('aria-describedby'),false);
 over(w.document.querySelector('#plain'));await wait(380);assert.equal(tip.classList.contains('visible'),false,'elements without a title get no tooltip');
});
test('a quick pass over an element does not flash a tooltip, and touch never shows one',async t=>{
 const w=new Window();t.after(()=>w.happyDOM.abort());w.document.body.innerHTML='<a id="link" title="Open Studio">Studio</a><p id="away">x</p>';w.eval(code);
 const link=w.document.querySelector('#link');link.dispatchEvent(new w.PointerEvent('pointerover',{bubbles:true,pointerType:'mouse'}));await wait(100);
 w.document.querySelector('#away').dispatchEvent(new w.PointerEvent('pointerover',{bubbles:true,pointerType:'mouse'}));await wait(380);
 assert.equal(w.document.querySelector('.bc-tooltip'),null);assert.equal(link.getAttribute('title'),'Open Studio');
 link.dispatchEvent(new w.PointerEvent('pointerover',{bubbles:true,pointerType:'touch'}));await wait(380);assert.equal(w.document.querySelector('.bc-tooltip'),null);
});

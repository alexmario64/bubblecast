import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {readFile} from 'node:fs/promises';
const code=await readFile(new URL('../../public/select.js',import.meta.url),'utf8');
function page(t,html){const w=new Window({url:'http://127.0.0.1:3927/'});t.after(()=>w.happyDOM.abort());w.document.body.innerHTML=html;w.requestAnimationFrame=f=>setTimeout(f,0);w.eval(code);return w;}
const html='<label><span>Bad words</span><select name="mode"><option value="skip">Skip</option><option value="remove">Remove</option><option value="off">Off</option></select></label>';
test('every select gets a themed button and menu while the real select keeps its value',async t=>{
 const w=page(t,html),doc=w.document,select=doc.querySelector('select'),button=doc.querySelector('.bc-select-button');
 assert.ok(button);assert.equal(button.textContent,'Skip');assert.equal(button.getAttribute('aria-label'),'Bad words');
 let changes=0;select.addEventListener('change',()=>changes++);
 button.click();const menu=doc.querySelector('.bc-select-menu');assert.ok(menu);assert.equal(menu.querySelectorAll('[role=option]').length,3);assert.equal(button.getAttribute('aria-expanded'),'true');
 menu.querySelectorAll('[role=option]')[1].click();assert.equal(select.value,'remove');assert.equal(changes,1);assert.equal(button.textContent,'Remove');assert.equal(button.getAttribute('aria-expanded'),'false');
 select.value='off';assert.equal(button.textContent,'Off','values set from code show up');
});
test('the keyboard opens the menu, moves through options, picks one and Escape closes',async t=>{
 const w=page(t,html),doc=w.document,select=doc.querySelector('select'),button=doc.querySelector('.bc-select-button');
 button.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));assert.ok(doc.querySelector('.bc-select-menu'));
 doc.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));doc.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));assert.equal(select.value,'remove');
 button.click();doc.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(button.getAttribute('aria-expanded'),'false');
 button.click();doc.dispatchEvent(new w.KeyboardEvent('keydown',{key:'o',bubbles:true}));doc.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));assert.equal(select.value,'off','typing jumps to an option');
});
test('selects added later are themed too, and option groups show their headings',async t=>{
 const w=page(t,''),doc=w.document;const s=doc.createElement('select');s.innerHTML='<optgroup label="Natural voices"><option>Claude</option></optgroup><optgroup label="System voices"><option>Paulina</option></optgroup>';doc.body.append(s);
 await new Promise(r=>setTimeout(r,10));const button=doc.querySelector('.bc-select-button');assert.ok(button);button.click();
 assert.deepEqual([...doc.querySelectorAll('.bc-select-group')].map(g=>g.textContent),['Natural voices','System voices']);
});

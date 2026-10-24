// Themed dropdowns for Studio and the dock. Every <select> gets a button and a menu drawn with the app's
// colors; the real select stays in the page (visually hidden) so forms, change events, translations and
// tests keep working. Selects added later, and values set from code, are picked up automatically.
(()=>{
let open=null;
const label=s=>s.options[s.selectedIndex]?.textContent||s.options[0]?.textContent||'';
function enhance(select){
 if(select.dataset.themed||select.multiple||select.size>1||select.hidden)return;select.dataset.themed='1';
 const wrap=document.createElement('span');wrap.className='bc-select';select.before(wrap);wrap.append(select);
 const button=document.createElement('button');button.type='button';button.className='bc-select-button';button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');
 const text=document.createElement('span');text.className='bc-select-label';const caret=document.createElementNS('http://www.w3.org/2000/svg','svg');caret.setAttribute('viewBox','0 0 24 24');caret.setAttribute('aria-hidden','true');caret.classList.add('bc-select-caret');caret.innerHTML='<path d="m7 10 5 5 5-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>';
 button.append(text,caret);wrap.append(button);
 const labelled=select.getAttribute('aria-label')||(select.id&&document.querySelector('label[for="'+select.id+'"]')?.textContent)||select.closest('label')?.querySelector('span')?.textContent||'';if(labelled)button.setAttribute('aria-label',labelled.trim());
 select.tabIndex=-1;select.setAttribute('aria-hidden','true');
 const sync=()=>{text.textContent=label(select);button.disabled=select.disabled;};sync();
 // Values set from code don't fire change, so the setters refresh the label too.
 for(const prop of ['value','selectedIndex']){const d=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,prop);Object.defineProperty(select,prop,{configurable:true,get(){return d.get.call(this);},set(v){d.set.call(this,v);sync();}});}
 select.addEventListener('change',sync);new MutationObserver(sync).observe(select,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['disabled','selected','label']});
 button.addEventListener('click',()=>open?.select===select?close():show(select,button));
 button.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp','Enter',' '].includes(e.key)){e.preventDefault();if(open?.select!==select)show(select,button);}});
}
function show(select,button){close();const menu=document.createElement('div');menu.className='bc-select-menu';menu.setAttribute('role','listbox');if(button.getAttribute('aria-label'))menu.setAttribute('aria-label',button.getAttribute('aria-label'));
 const items=[];for(const node of select.children){const group=node.tagName==='OPTGROUP';if(group){const h=document.createElement('div');h.className='bc-select-group';h.textContent=node.label;menu.append(h);}
  for(const o of group?node.children:[node]){if(o.tagName!=='OPTION')continue;const item=document.createElement('div');item.className='bc-select-option';item.setAttribute('role','option');item.textContent=o.textContent;item.dataset.index=o.index;
   item.setAttribute('aria-selected',String(o.selected));if(o.disabled)item.setAttribute('aria-disabled','true');item.addEventListener('click',()=>{if(!o.disabled)pick(o.index);});item.addEventListener('mousemove',()=>focus(items.indexOf(item)));menu.append(item);items.push(item);}}
 document.body.append(menu);open={select,button,menu,items,active:-1,typed:'',typedAt:0};button.setAttribute('aria-expanded','true');button.classList.add('open');
 place();focus(Math.max(0,items.findIndex(i=>i.getAttribute('aria-selected')==='true')));requestAnimationFrame(()=>menu.classList.add('shown'));}
function place(){if(!open)return;const r=open.button.getBoundingClientRect(),m=open.menu,gap=6;m.style.minWidth=r.width+'px';const below=innerHeight-r.bottom-gap,above=r.top-gap,h=Math.min(m.scrollHeight,320);
 const up=below<Math.min(h,200)&&above>below;m.style.maxHeight=Math.max(120,Math.min(320,(up?above:below)-12))+'px';m.classList.toggle('up',up);
 const left=Math.min(Math.max(8,r.left),innerWidth-m.offsetWidth-8);m.style.left=left+'px';m.style.top=(up?r.top-gap-Math.min(m.scrollHeight,parseFloat(m.style.maxHeight)):r.bottom+gap)+'px';}
function focus(i){if(!open)return;const items=open.items;if(!items.length)return;i=(i+items.length)%items.length;let guard=items.length;while(items[i].getAttribute('aria-disabled')==='true'&&guard--)i=(i+1)%items.length;
 items.forEach((it,k)=>it.classList.toggle('active',k===i));open.active=i;items[i].scrollIntoView({block:'nearest'});}
function pick(index){const {select,button}=open;close();if(select.selectedIndex!==index){select.selectedIndex=index;select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));}button.focus();}
function close(){if(!open)return;const {menu,button}=open;button.setAttribute('aria-expanded','false');button.classList.remove('open');menu.classList.remove('shown');setTimeout(()=>menu.remove(),140);open=null;}
document.addEventListener('keydown',e=>{if(!open)return;const k=e.key;
 if(k==='Escape'||k==='Tab'){if(k==='Escape')e.preventDefault();const b=open.button;close();if(k==='Escape')b.focus();return;}
 if(k==='ArrowDown'||k==='ArrowUp'){e.preventDefault();focus(open.active+(k==='ArrowDown'?1:-1));return;}
 if(k==='Home'||k==='End'){e.preventDefault();focus(k==='Home'?0:open.items.length-1);return;}
 if(k==='Enter'||k===' '){e.preventDefault();const it=open.items[open.active];if(it&&it.getAttribute('aria-disabled')!=='true')pick(Number(it.dataset.index));return;}
 if(k.length===1){const now=Date.now();open.typed=(now-open.typedAt<700?open.typed:'')+k.toLowerCase();open.typedAt=now;const i=open.items.findIndex(it=>it.textContent.toLowerCase().startsWith(open.typed));if(i>=0)focus(i);}},true);
document.addEventListener('pointerdown',e=>{if(open&&!open.menu.contains(e.target)&&!open.button.contains(e.target))close();},true);
addEventListener('resize',()=>close());addEventListener('scroll',e=>{if(open&&!open.menu.contains(e.target))close();},true);
const scan=root=>{for(const s of root.querySelectorAll?.('select')||[])enhance(s);};
scan(document);new MutationObserver(list=>{for(const m of list)for(const n of m.addedNodes){if(n.nodeType!==1)continue;if(n.tagName==='SELECT')enhance(n);else scan(n);}}).observe(document.documentElement,{childList:true,subtree:true});
window.bubblecastSelect={enhance,close};
})();

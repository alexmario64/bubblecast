// Themed tooltips for Studio and the dock, replacing the browser's slow system ones. Any element with a title
// gets one on hover or keyboard focus. The title is lent to the tooltip while it shows, so the system tooltip
// stays away, and is put back afterwards so translations and screen readers keep working.
(()=>{
let tip=null,owner=null,timer=null;
function element(){if(!tip){tip=document.createElement('div');tip.className='bc-tooltip';tip.setAttribute('role','tooltip');tip.id='bc-tooltip';document.body.append(tip);}return tip;}
function place(target){const t=element(),r=target.getBoundingClientRect(),gap=8,w=t.offsetWidth,h=t.offsetHeight,vw=document.documentElement.clientWidth;
 let top=r.top-h-gap,below=false;if(top<4){top=r.bottom+gap;below=true;}
 const left=Math.min(Math.max(4,r.left+r.width/2-w/2),vw-w-4);t.style.top=Math.round(top)+'px';t.style.left=Math.round(left)+'px';t.dataset.side=below?'below':'above';}
function show(target){const text=target.getAttribute('title');if(!text)return;hide();owner=target;target.dataset.tip=text;target.removeAttribute('title');target.setAttribute('aria-describedby','bc-tooltip');
 const t=element();t.textContent=text;t.classList.remove('visible');place(target);requestAnimationFrame(()=>{if(owner===target)t.classList.add('visible');});}
function hide(){clearTimeout(timer);timer=null;if(owner){if(owner.dataset.tip&&!owner.hasAttribute('title'))owner.setAttribute('title',owner.dataset.tip);delete owner.dataset.tip;if(owner.getAttribute('aria-describedby')==='bc-tooltip')owner.removeAttribute('aria-describedby');owner=null;}tip?.classList.remove('visible');}
const target=node=>node?.closest?.('[title]:not(iframe):not(svg title)');
document.addEventListener('pointerover',e=>{if(e.pointerType==='touch')return;const t=target(e.target);if(!t){hide();return;}if(t===owner)return;clearTimeout(timer);timer=setTimeout(()=>show(t),owner?0:350);});
document.addEventListener('pointerout',e=>{const t=owner||target(e.target);if(t&&!t.contains(e.relatedTarget))hide();});
document.addEventListener('focusin',e=>{const t=target(e.target);if(t&&e.target.matches(':focus-visible'))show(t);});
document.addEventListener('focusout',hide);document.addEventListener('pointerdown',hide,true);document.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});
addEventListener('scroll',hide,true);addEventListener('blur',hide);
})();

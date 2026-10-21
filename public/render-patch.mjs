import {sameMediaSource} from '../core.mjs';
function compatible(a,b){if(!a||a.nodeType!==b.nodeType)return false;if(a.nodeType===3)return true;if(a.nodeType!==1||a.tagName!==b.tagName)return false;return !['IMG','VIDEO','SOURCE'].includes(a.tagName)||(a.tagName==='IMG'?sameMediaSource(a.getAttribute('src'),b.getAttribute('src')):a.getAttribute('src')===b.getAttribute('src'));}
// Keep incomplete GIF frames and video posters off screen until usable media
// is decoded. This state belongs to the mounted element, not a later update.
export function prepareMedia(el){
 el.setAttribute('data-media-loading','');
 let decoding=false;
 const ready=async()=>{if(decoding)return;decoding=true;try{if(el.tagName==='IMG'&&typeof el.decode==='function')await el.decode();}catch{}el.removeAttribute('data-media-loading');};
 el.addEventListener(el.tagName==='VIDEO'?'loadeddata':'load',ready,{once:true});
 return el;
}
export function revealMediaMessage(el,onReady){
 const body=el.querySelector('.body');
 const mediaOnly=body&&!body.textContent.trim()&&body.querySelector('img.emote,img.media,video.emote,video.media');
 if(!mediaOnly||!body.querySelector('[data-media-loading]')){onReady();return ()=>{};}
 el.hidden=true;
 const observer=new el.ownerDocument.defaultView.MutationObserver(()=>{
  if(body.querySelector('[data-media-loading]'))return;
  observer.disconnect();el.hidden=false;onReady();
 });
 observer.observe(body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-media-loading']});
 return ()=>observer.disconnect();
}
export function patchElement(target,desired){
 const ownMediaState=name=>name==='data-media-loading'&&['IMG','VIDEO'].includes(target.tagName)||name==='src'&&target.tagName==='IMG'&&sameMediaSource(target.getAttribute('src'),desired.getAttribute('src'));
 for(const attr of [...target.attributes])if(!ownMediaState(attr.name)&&!desired.hasAttribute(attr.name))target.removeAttribute(attr.name);
 for(const attr of [...desired.attributes])if(!ownMediaState(attr.name)&&target.getAttribute(attr.name)!==attr.value)target.setAttribute(attr.name,attr.value);
 const available=[...target.childNodes],used=new Set(),plan=[];
 for(const [index,next] of [...desired.childNodes].entries()){let node=available[index];if(used.has(node)||!compatible(node,next))node=available.find(old=>!used.has(old)&&compatible(old,next));if(node)used.add(node);plan.push({node:node||next,next});}
 // Remove obsolete siblings first so inserting a replacement never detaches an
 // unchanged neighboring GIF/video merely to move it past the obsolete node.
 for(const old of available)if(!used.has(old))old.remove();
 for(const [index,{node,next}] of plan.entries()){if(node!==target.childNodes[index])target.insertBefore(node,target.childNodes[index]||null);if(node!==next){if(node.nodeType===3){if(node.nodeValue!==next.nodeValue)node.nodeValue=next.nodeValue;}else patchElement(node,next);}}
 return target;
}

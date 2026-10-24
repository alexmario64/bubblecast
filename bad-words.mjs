// Keeps swear words and slurs out of text to speech, in English and Spanish, including the usual tricks:
// symbols for letters (f*ck, sh#t), number swaps (sh1t, p3ndejo), stretched letters (fuuuck), letters split
// apart (f u c k, p.u.t.a), look-alike letters from other alphabets or fancy fonts, invisible characters, and
// missing accents. Stems match the start of a word (fuck → fucking); exact words match whole words only.
const stems=['fuck','motherfuck','shit','bitch','cunt','asshole','bastard','slut','whore','faggot','fag','nigg','retard','twat','wank','dickhead','cocksuck','pussy','porn','rapist',
 'puta','puto','mierda','pendej','cabron','verga','chinga','maricon','marica','culero','gilipolla','zorra','malparid','mamon','mamada','pinche','carajo','cojon','panocha','sudaca','coño','follar','putamadre'];
const exact=['cock','dick','cum','rape','kys','hdp','ptm','culo','joto','polla','matate','nazi','tits','puñeta'];
const phrases=['kill yourself','kill urself','hijo de puta','vete a la mierda','chinga tu madre'];
const swaps={'0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','@':'a','$':'s','!':'i','|':'l','€':'e'};
// Letters from other alphabets that look Latin.
const lookalikes={'а':'a','е':'e','о':'o','р':'p','с':'c','у':'y','х':'x','і':'i','ї':'i','ѕ':'s','ԁ':'d','ӏ':'l','ј':'j','к':'k','м':'m','т':'t','в':'b','н':'h','ο':'o','α':'a','ε':'e','ι':'i','ν':'v','κ':'k','τ':'t','ρ':'p','υ':'u','μ':'m','ս':'u','ո':'n','ƒ':'f','ɑ':'a','ɡ':'g'};
const MASK='?',masks=/[*#%?_.\-~^+]/g;
// Fancy fonts and full-width letters become plain; invisible characters go; letters spelled out one by
// one with spaces, dots or dashes are joined.
function prepare(text){return String(text).normalize('NFKC').replace(/[​-‏⁠﻿­͏]/g,'').replace(/./gu,c=>lookalikes[c.toLowerCase()]??c)
 .replace(/(?<![\p{L}\d])(?:[\p{L}\d@$*][\s.\-_·•]+){2,}[\p{L}\d@$*](?![\p{L}\d])/gu,m=>m.replace(/[\s.\-_·•]+/g,''));}
// One word as plain letters: lowercase, accents gone except ñ, swaps undone, stretched letters squashed;
// symbols standing in for letters become "?".
export function letters(word){return String(word).toLowerCase().replace(/ñ/g,'\u0001').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\u0001/g,'ñ')
 .replace(/[013457@$!|€]/g,c=>swaps[c]).replace(masks,MASK).replace(/[^a-zñ?]/g,'').replace(/([a-zñ])\1+/g,'$1');}
const plainStems=stems.map(letters),plainExact=exact.map(letters),plainPhrases=phrases.map(p=>p.split(' ').map(letters).join(' '));
// Words the streamer adds in Studio (one per line or separated by commas).
export function customWords(list){return String(list||'').split(/[\n,]+/).map(w=>letters(w.trim()).replace(/\?/g,'')).filter(w=>w.length>=2).slice(0,200);}
// "?" in a masked word stands for any one letter; a word needs at least two real letters to be judged.
const fits=(word,target,whole)=>(!whole||word.length===target.length)&&word.length>=target.length&&[...target].every((c,i)=>word[i]===c||word[i]===MASK);
function bad(token,custom){const w=letters(token);if(w.replace(/\?/g,'').length<2&&!plainExact.includes(w))return false;
 return plainExact.some(e=>fits(w,e,true))||custom.some(e=>fits(w,e,true))||plainStems.some(s=>fits(w,s,false));}
const words=text=>prepare(text).split(/\s+/).filter(Boolean);
// True when a blocked phrase is said; those always skip the whole message.
export function hasBadPhrase(text){const flat=' '+words(text).map(letters).join(' ')+' ';return plainPhrases.some(p=>flat.includes(' '+p+' '));}
export function hasBadWords(text,list=''){const custom=customWords(list);return hasBadPhrase(text)||words(text).some(t=>bad(t,custom));}
// The text without its blocked words, or '' when nothing is left.
export function removeBadWords(text,list=''){const custom=customWords(list);return words(text).filter(t=>!bad(t,custom)).join(' ');}

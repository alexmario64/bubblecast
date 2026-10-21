import {groupPollResults} from './poll-board.mjs';
const labels={twitch:'Twitch',kick:'Kick',youtube:'YouTube Live',youtubeShorts:'YouTube Shorts'};
export function pollOverlayCard(document,group){
 const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const card=el('article','message poll-overlay-card'),floating=el('div','bubble-group'),pill=el('div','pill'),body=el('div','body');
 for(const platform of [...new Set(group.polls.map(p=>p.platform))]){const logo=el('span','poll-platform '+platform);logo.setAttribute('role','img');logo.setAttribute('aria-label',platform);pill.append(logo);}
 const live=group.polls.some(p=>p.status==='active');pill.append(el('span','poll-overlay-label',live?'Live poll':'Final results'));body.append(el('h2','poll-overlay-question',group.question));
 const choices=(list,cls)=>{const wrap=el('div',cls);for(const choice of list){const row=el('div','poll-overlay-choice'),line=el('div','poll-overlay-line');line.append(el('span','',choice.text),el('span','poll-overlay-value',(choice.percent==null?'—':Math.round(choice.percent)+'%')+(choice.votes!=null?' · '+choice.votes:'')));const meter=el('div','poll-overlay-meter'),fill=el('span','');fill.style.width=Math.max(0,Math.min(100,choice.percent||0))+'%';meter.append(fill);row.append(line,meter);wrap.append(row);}return wrap;};
 if(group.counted)body.append(choices(group.choices,'poll-overlay-choices'));
 for(const poll of group.missing){const section=el('section','poll-overlay-source');section.append(el('h3','',labels[poll.sourceKey]+' · Percentages'),choices(poll.choices,'poll-overlay-choices'));body.append(section);}
 const note=group.counted?(group.totalVotes+' counted votes'+(group.missing.length?' · '+group.counted+'/'+group.polls.length+' chats supply counts':'')):'Platform percentages';body.append(el('p','poll-overlay-note',note));floating.append(pill,body);card.append(floating);return card;
}
export {groupPollResults};

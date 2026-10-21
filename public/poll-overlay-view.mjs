import {groupPollResults} from './poll-board.mjs';
const labels={twitch:'Twitch',kick:'Kick',youtube:'YouTube Live',youtubeShorts:'YouTube Shorts'};
export const cardDefaults={showVotes:true,showPercent:true,showPlatforms:true,showFooter:true,highlightLeader:true,liveLabel:'Live poll',finalLabel:'Final results'};
export function pollOverlayCard(document,group,options={}){
 const o={...cardDefaults,...options};
 const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const live=group.polls.some(p=>p.status==='active');
 const card=el('article','message poll-overlay-card'+(live?'':' final')),floating=el('div','bubble-group'),pill=el('div','pill'),body=el('div','body');
 if(o.showPlatforms)for(const platform of [...new Set(group.polls.map(p=>p.platform))]){const logo=el('span','poll-platform '+platform);logo.setAttribute('role','img');logo.setAttribute('aria-label',platform);pill.append(logo);}
 pill.append(el('span','poll-overlay-label',live?o.liveLabel:o.finalLabel));body.append(el('h2','poll-overlay-question',group.question));
 const value=choice=>[o.showPercent?(choice.percent==null?'—':Math.round(choice.percent)+'%'):'',o.showVotes&&choice.votes!=null?String(choice.votes):''].filter(Boolean).join(' · ');
 const choices=(list,cls)=>{const wrap=el('div',cls),top=Math.max(...list.map(c=>c.percent||0));for(const choice of list){const row=el('div','poll-overlay-choice');if(o.highlightLeader&&top>0&&(choice.percent||0)===top)row.classList.add('leading');const line=el('div','poll-overlay-line'),shown=value(choice);line.append(el('span','',choice.text));if(shown)line.append(el('span','poll-overlay-value',shown));const meter=el('div','poll-overlay-meter'),fill=el('span','');fill.style.width=Math.max(0,Math.min(100,choice.percent||0))+'%';meter.append(fill);row.append(line,meter);wrap.append(row);}return wrap;};
 if(group.counted)body.append(choices(group.choices,'poll-overlay-choices'));
 for(const poll of group.missing){const section=el('section','poll-overlay-source');section.append(el('h3','',labels[poll.sourceKey]+' · Percentages'),choices(poll.choices,'poll-overlay-choices'));body.append(section);}
 if(o.showFooter){const note=group.counted?(group.totalVotes+' counted votes'+(group.missing.length?' · '+group.counted+'/'+group.polls.length+' chats supply counts':'')):'Platform percentages';body.append(el('p','poll-overlay-note',note));}
 floating.append(pill,body);card.append(floating);return card;
}
export {groupPollResults};

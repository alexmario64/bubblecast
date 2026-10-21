// Structural checks against this installation, not an OBS render test.
import {readFile,readdir,access} from 'node:fs/promises';
import {join} from 'node:path';
const installed=process.argv[2]||'C:/Program Files/obs-studio/data/obs-studio/themes';
const builtins=await Promise.all((await readdir(installed)).filter(f=>/\.(obt|ovt)$/.test(f)).map(f=>readFile(join(installed,f),'utf8')));
const parse=text=>{
 const meta=text.match(/@OBSThemeMeta\s*\{([^}]+)\}/)?.[1];
 if(!meta)throw Error('Missing metadata');
 const props=Object.fromEntries([...meta.matchAll(/(\w+):\s*'([^']*)';/g)].map(m=>[m[1],m[2]]));
 const block=text.match(/@OBSThemeVars\s*\{([^}]+)\}/)?.[1]||'';
 const vars=Object.fromEntries([...block.matchAll(/--(\w+)\s*:\s*([^;]+);/g)].map(m=>[m[1],m[2].trim()]));
 return {props,vars,text};
};
const catalog=new Map(builtins.map(text=>{const theme=parse(text);return [theme.props.id,theme];}));
for(const file of ['Bubblecast_Rose_Peach.ovt','Bubblecast_Red_White.ovt','Bubblecast_Console_Glass.ovt']){
 const theme=parse(await readFile(new URL(file,import.meta.url),'utf8'));
 if(catalog.has(theme.props.id))throw Error('Theme id collision');
 const chain=[theme],seen=new Set([theme.props.id]);
 while(chain[0].props.extends){const parent=catalog.get(chain[0].props.extends);if(!parent||seen.has(parent.props.id))throw Error('Broken inheritance');seen.add(parent.props.id);chain.unshift(parent);}
 const vars=Object.assign({obsFontScale:'10',obsPadding:'4'},...chain.map(t=>t.vars));
 for(const match of chain.map(t=>t.text).join('\n').matchAll(/var\(--(\w+)\)/g))if(!(match[1] in vars))throw Error('Undefined variable '+match[1]);
 for(const name of Object.keys(vars)){const walk=(key,path=[])=>{if(path.includes(key))throw Error('Variable cycle '+key);for(const dep of vars[key].matchAll(/var\(--(\w+)\)/g))walk(dep[1],[...path,key]);};walk(name);}
 const qss=theme.text.replace(/\/\*[\s\S]*?\*\//g,'').replace(/@OBSTheme(?:Meta|Vars)\s*\{[^}]*\}/g,'');
 if((qss.match(/\{/g)||[]).length!==(qss.match(/\}/g)||[]).length)throw Error('Unbalanced rules');
 if(/backdrop-filter|box-shadow|animation\s*:|!important|:root/.test(qss))throw Error('Browser-only CSS in Qt theme');
 // Validate assets introduced here and representative Light icons. Some unused
 // upstream Yami URLs do not exist even in the stock OBS installation.
 for(const match of theme.text.matchAll(/url\(theme:([^\)]+)\)/g)){
  const relative=match[1];if(relative.includes('..')||relative.startsWith('/'))throw Error('Unsafe asset path');
  try{await access(new URL(relative,import.meta.url));}catch{await access(join(installed,relative));}
 }
 const icons=theme.props.dark==='true'?'Dark':'Light';
 for(const icon of ['close.svg','plus.svg','popout.svg','settings/general.svg'])await access(join(installed,icons,icon));
 console.log(file+': inheritance, variable references/cycles, rule braces, and '+icons+' icon availability verified.');
}

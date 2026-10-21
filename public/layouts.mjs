export function overlayLayout(settings,layout,width,height,preview=false){
 const s={...settings};let scale=preview?1:Number(s.resolution)/1080,edge=28,gap=18,maxHeight=height/scale-72;
 if(layout==='vertical'){
  scale=Math.max(.1,width/540);edge=26;gap=16;
  s.width=480;s.maxMessages=Math.min(s.maxMessages,4);
  maxHeight=Math.min(390,height/scale-edge*2);
 }else if(layout==='webcam'){
  scale=Math.max(.1,Math.min(width/600,height/260));edge=22;gap=12;
  s.width=556;s.fontSize=Math.round(s.fontSize*5/6);s.badgeSize=Math.round(s.badgeSize*5/6);
  s.maxMessages=Math.min(s.maxMessages,3);maxHeight=height/scale-edge*2;
 }
 return {settings:s,scale,edge,gap,maxHeight:Math.max(80,maxHeight)};
}

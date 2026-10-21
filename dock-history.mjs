export class DockHistory {
 constructor(limit=300){this.limit=limit;this.rows=new Map();}
 accept(type,data){
  if(type==='clear'){this.rows.clear();return;}
  if(type==='delete'){for(const [key,m] of this.rows)if(m.platform===data.platform&&(!data.sourceKey||m.sourceKey===data.sourceKey)&&(m.id===data.id||data.userId&&m.userId===data.userId))this.rows.delete(key);return;}
  if(type!=='message'&&type!=='update')return;
  const key=(data.sourceKey||data.platform)+':'+data.id;
  if(type==='update'&&!this.rows.has(key))return;
  this.rows.set(key,data);while(this.rows.size>this.limit)this.rows.delete(this.rows.keys().next().value);
 }
 snapshot(){return [...this.rows.values()];}
}

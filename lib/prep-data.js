const XLSX=require('xlsx');
const clean=value=>String(value??'').normalize('NFKC').trim().replace(/\s+/g,' ');
const key=value=>clean(value).replace(/\s+/g,'').toLowerCase();
function source(value){const s=clean(value);if(!s)return '';let u;try{u=new URL(s);}catch{throw Error('来源必须是完整的 http(s) 网址');}if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error('来源网址格式不正确');return s;}
function validate(rows,type){
 if(['plans','scores'].includes(type))return require('./prep-admissions').validate(rows,type);
 if(!['mapping','subjects'].includes(type))throw Error('请选择导入类型');
 if(!Array.isArray(rows)||!rows.length||rows.length>20000)throw Error('文件必须包含1至20000行数据');
 const output=[],seen=new Set(),majors=new Map();
 for(let i=0;i<rows.length;i++){
  const r=rows[i],code=clean(r['本科专业代码']),name=clean(r['本科专业名称']||r['可报考本科专业']),kind=clean(r['科类']);
  const junior=clean(r['专科专业']);
  if(!/^[A-Za-z0-9-]{1,20}$/.test(code)||!name||name.length>100||!kind||kind.length>20)throw Error(`第${i+2}行：本科代码、名称或科类不完整`);
  const identity=JSON.stringify([name,kind]);if(majors.has(code)&&majors.get(code)!==identity)throw Error(`第${i+2}行：同一本科代码对应不同名称或科类`);majors.set(code,identity);
  const common=clean(r['公共课考试科目']),professional=clean(r['专业课考试科目']),note=clean(r['备注']);
  if(type==='mapping'&&(!junior||junior.length>150))throw Error(`第${i+2}行：专科专业不能为空或超长`);
  if(type==='subjects'&&!common&&!professional&&!note)throw Error(`第${i+2}行：请填写科目或说明，不能用空值覆盖已有科目`);
  if([common,professional,note].some(v=>v.length>1500))throw Error(`第${i+2}行：科目或备注过长`);
  const unique=type==='mapping'?key(junior)+'\0'+code:code;
  if(seen.has(unique))throw Error(`第${i+2}行：重复的专业对应记录`);seen.add(unique);
  output.push({code,name,kind,junior,juniorKey:key(junior),common,professional,note});
 }
 return output;
}
function parse(buffer,type){
 if(!buffer||buffer.length>6*1024*1024)throw Error('Excel文件不能超过6MB');
 let book;try{book=XLSX.read(buffer,{type:'buffer',cellFormula:false,sheetRows:20010});}catch{throw Error('无法读取Excel，请使用有效的.xlsx文件');}
 if(!book.SheetNames.length)throw Error('Excel没有工作表');
 const wanted=({mapping:'专业对应关系',subjects:'考试科目',plans:'招生计划',scores:'录取线'})[type],sheet=book.Sheets[book.SheetNames.includes(wanted)?wanted:book.SheetNames[0]];
 if(sheet['!fullref'])throw Error('工作表行数过多，请将单次导入控制在20000条以内');
 const grid=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false});
 const header=grid.findIndex(row=>row.some(v=>clean(v)==='本科专业代码'||(['plans','scores'].includes(type)&&clean(v)==='专业代码')));
 if(header<0)throw Error('没有找到“本科专业代码”表头，请下载模板填写');
 const aliases=['plans','scores'].includes(type)?{'专业代码':'本科专业代码','院校名称':'招生院校','计划合计':'招生人数合计','普通本科及职教本科计划':'普通计划人数','退役士兵计划':'退役士兵计划人数','专项计划':'专项计划人数'}:{};
 const headerCells=grid[header],gap=headerCells.findIndex((v,i)=>i>0&&!clean(v));
 const names=headerCells.slice(0,gap<0?headerCells.length:gap).map(v=>aliases[clean(v)]||clean(v));if(new Set(names.filter(Boolean)).size!==names.filter(Boolean).length)throw Error('存在重复表头');
 const rows=grid.slice(header+1).filter(row=>row.some(v=>clean(v))).map(row=>Object.fromEntries(names.map((n,i)=>[n,row[i]??''])));
 return validate(rows,type);
}
function apply(db,{provinceId,year,type,rows,url,actor}){
 if(['plans','scores'].includes(type))return require('./prep-admissions').apply(db,{provinceId,year,type,rows,url,actor});
 if(!Number.isInteger(+year)||+year<2020||+year>2100)throw Error('年份须在2020至2100之间');
 if(!db.get('SELECT id FROM provinces WHERE id=?',[provinceId]))throw Error('省份不存在');
 url=source(url);if(!url)throw Error('请填写数据来源网址');
 // Revalidate server-side even when rows came from a preview.
 rows=validate(rows.map(r=>({'本科专业代码':r.code,'本科专业名称':r.name,'科类':r.kind,'专科专业':r.junior,'公共课考试科目':r.common,'专业课考试科目':r.professional,'备注':r.note})),type);
 const scope=[provinceId,+year];
 for(const r of rows){const old=db.get('SELECT name,kind FROM prep_majors WHERE province_id=? AND year=? AND code=?',[...scope,r.code]);if(old&&(old.name!==r.name||old.kind!==r.kind))throw Error(`本科代码${r.code}与已有名称或科类冲突，请核实后重传`);}
 return db.atomic(()=>{
  if(type==='mapping')db.run('DELETE FROM prep_mappings WHERE province_id=? AND year=?',scope);
  for(const r of rows){
   db.run('INSERT OR IGNORE INTO prep_majors(province_id,year,code,name,kind) VALUES(?,?,?,?,?)',[...scope,r.code,r.name,r.kind]);
   if(type==='mapping')db.run('INSERT INTO prep_mappings(province_id,year,junior_name,junior_key,major_code,source_url) VALUES(?,?,?,?,?,?)',[...scope,r.junior,r.juniorKey,r.code,url]);
   else db.run('UPDATE prep_majors SET common_subjects=?,professional_subjects=?,subject_note=?,subject_source=?,common_source=? WHERE province_id=? AND year=? AND code=?',[r.common,r.professional,r.note,url,url,...scope,r.code]);
  }
  db.run('INSERT INTO prep_imports(province_id,year,type,row_count,source_url,actor) VALUES(?,?,?,?,?,?)',[...scope,type,rows.length,url,actor||'']);
  return rows.length;
 });
}
function lookup(db,province,year,q){
 const p=db.get('SELECT id,name FROM provinces WHERE code=? OR name=?',[province,province]);if(!p)return {years:[],suggestions:[],rows:[],available:false};
 const years=db.query('SELECT DISTINCT year FROM prep_mappings WHERE province_id=? ORDER BY year DESC',[p.id]).map(x=>x.year);
 const term=key(q);if(!/^\d{4}$/.test(String(year)))return {years,suggestions:[],rows:[],available:false};
 const requestedYear=+year,dataYear=years.find(y=>y<=requestedYear),available=dataYear!==undefined;
 const meta={years,available,requestedYear,year:dataYear??null,isFallback:available&&dataYear!==requestedYear,province:p.name};
 if(!term||!available)return {...meta,suggestions:[],rows:[]};
 const scope=[p.id,dataYear];
 const names=db.query('SELECT DISTINCT junior_name,junior_key FROM prep_mappings WHERE province_id=? AND year=? ORDER BY junior_name',scope);
 const exact=names.find(n=>n.junior_key===term),suggestions=names.filter(n=>n.junior_key.includes(term)).slice(0,30).map(n=>n.junior_name);
 if(!exact)return {...meta,suggestions,rows:[],exact:false};
 const rows=db.query(`SELECT m.code,m.name,m.kind,m.common_subjects,m.professional_subjects,m.subject_note,m.subject_source,m.common_source,r.source_url FROM prep_mappings r JOIN prep_majors m ON m.province_id=r.province_id AND m.year=r.year AND m.code=r.major_code WHERE r.province_id=? AND r.year=? AND r.junior_key=? ORDER BY m.code`,[...scope,term]);
 require('./prep-admissions').attach(db,p.id,dataYear,rows);
 return {...meta,suggestions:[],rows,exact:true,junior:exact.junior_name};
}
module.exports={key,source,validate,parse,apply,lookup};

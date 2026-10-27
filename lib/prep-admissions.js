const schoolOwnership=require('./school-ownership.json');
const shandongSchoolCodes=require('./shandong-school-codes-2026.json');
const categoryNames={ordinary:'普通本科及职教本科',special:'专项计划',veteran:'退役士兵免试生'};
const categories=Object.fromEntries(Object.entries(categoryNames).flatMap(([k,v])=>[[k,k],[v,k]]));
const text=v=>String(v??'').normalize('NFKC').trim();
const stages=['第一阶段','征集志愿','第一次征集','第二次征集'];
function validate(rows,type){
 if(!['plans','scores'].includes(type)||!rows.length||rows.length>20000)throw Error('请选择招生计划或录取线，单次1至20000条');
 const out=[],seen=new Set();
 rows.forEach((r,i)=>{
  const code=text(r['本科专业代码']),schoolCode=text(r['院校代码']),schoolName=text(r['招生院校']||r['院校名称']);
  if(!/^[A-Za-z0-9-]{1,20}$/.test(code)||!/^[A-Za-z0-9-]{1,20}$/.test(schoolCode)||!schoolName||schoolName.length>150)throw Error(`第${i+2}行：请填写有效的本科专业代码、院校代码和名称`);
  const record={code,schoolCode,schoolName};
  if(type==='plans'){
   for(const [field,label] of [['total','招生人数合计'],['ordinary','普通计划人数'],['special','专项计划人数'],['veteran','退役士兵计划人数']]){const v=text(r[label]);if(!/^\d+$/.test(v)||+v>1000000)throw Error(`第${i+2}行：${label}须为非负整数，不能留空`);record[field]=+v;}
   if(record.total!==record.ordinary+record.special+record.veteran)throw Error(`第${i+2}行：各类人数之和与合计不一致`);
  }else{
   record.category=categories[text(r['招生类别'])];record.stage=text(r['录取阶段']);record.score=text(r['录取最低分']);
   if(!record.category||!stages.includes(record.stage)||!/^\d{1,3}(?:\.\d{1,12})?$/.test(record.score))throw Error(`第${i+2}行：招生类别、阶段或录取最低分无效`);
  }
  const identity=[code,schoolCode,record.category||'',record.stage||''].join('\0');if(seen.has(identity))throw Error(`第${i+2}行：重复的院校专业记录`);seen.add(identity);out.push(record);
 });return out;
}
function apply(db,{provinceId,year,type,rows,url,actor}){
 const prep=require('./prep-data');url=prep.source(url);
 if(!url||!Number.isInteger(+year)||+year<2020||+year>2100||!db.get('SELECT id FROM provinces WHERE id=?',[provinceId]))throw Error('省份、年份或来源无效');
 rows=validate(rows.map(r=>({'本科专业代码':r.code,'院校代码':r.schoolCode,'招生院校':r.schoolName,'招生人数合计':r.total,'普通计划人数':r.ordinary,'专项计划人数':r.special,'退役士兵计划人数':r.veteran,'招生类别':r.category,'录取阶段':r.stage,'录取最低分':r.score})),type);
 for(const r of rows)if(!db.get('SELECT code FROM prep_majors WHERE province_id=? AND year=? AND code=?',[provinceId,+year,r.code]))throw Error(`本科专业${r.code}尚未录入，请先导入专业对应关系或科目表`);
 return db.atomic(()=>{for(const r of rows){
  if(type==='plans')db.run(`INSERT INTO prep_admission_plans VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(province_id,year,major_code,school_code) DO UPDATE SET school_name=excluded.school_name,total=excluded.total,ordinary=excluded.ordinary,veteran=excluded.veteran,special=excluded.special,source_url=excluded.source_url`,[provinceId,+year,r.code,r.schoolCode,r.schoolName,r.total,r.ordinary,r.veteran,r.special,url]);
  else db.run(`INSERT INTO prep_admission_scores VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(province_id,year,major_code,school_code,category,stage) DO UPDATE SET school_name=excluded.school_name,score=excluded.score,source_url=excluded.source_url`,[provinceId,+year,r.code,r.schoolCode,r.schoolName,r.category,r.stage,r.score,url]);
 }db.run('INSERT INTO prep_imports(province_id,year,type,row_count,source_url,actor) VALUES(?,?,?,?,?,?)',[provinceId,+year,type,rows.length,url,actor||'']);return rows.length;});
}
function tableExists(db,name){return !!db.get("SELECT name FROM sqlite_master WHERE type='table' AND name=?",[name]);}
function config(db,provinceId,year){
 if(!tableExists(db,'prep_dataset_config'))return {};
 const row=db.get('SELECT config FROM prep_dataset_config WHERE province_id=? AND year=?',[provinceId,year]);
 if(!row)return {};
 try{return JSON.parse(row.config);}catch{return {};}
}
function attach(db,provinceId,year,majors,options={}){
 const settings=options.config||config(db,provinceId,year);
 const scoped=tableExists(db,'prep_scoped_admission_plans')?db.query('SELECT * FROM prep_scoped_admission_plans WHERE province_id=? AND year=? ORDER BY school_name',[provinceId,year]):[];
 const plans=scoped.concat(db.query('SELECT * FROM prep_admission_plans WHERE province_id=? AND year=? ORDER BY school_code',[provinceId,year]));
 const allowed=settings.scopeSchools&&options.juniorKey?db.query('SELECT major_code,school_code FROM prep_school_eligibility WHERE province_id=? AND year=? AND junior_key=?',[provinceId,year,options.juniorKey]):null;
 const scores=db.query('SELECT * FROM prep_admission_scores WHERE province_id=? AND year=? ORDER BY school_code,category,stage',[provinceId,year]);
 for(const major of majors){const schools=new Map();for(const r of plans.filter(r=>r.major_code===major.code))schools.set(r.school_code,{code:r.school_code,name:r.school_name,total:r.total,ordinary:r.ordinary,special:r.special,veteran:r.veteran,plan_source:r.source_url,scores:[]});
  for(const r of scores.filter(r=>r.major_code===major.code)){if(!schools.has(r.school_code))schools.set(r.school_code,{code:r.school_code,name:r.school_name,total:null,ordinary:null,special:null,veteran:null,plan_source:'',scores:[]});schools.get(r.school_code).scores.push({category:r.category,stage:r.stage,score:r.score,source_url:r.source_url});}
  major.schools=[...schools.values()].filter(s=>!allowed||allowed.some(a=>a.major_code===major.code&&a.school_code===s.code)).map(s=>{const own=settings.schools?.[s.name]||schoolOwnership.schools[s.name],schoolCode=settings.scopeSchools&&Number(year)===shandongSchoolCodes.year?shandongSchoolCodes.schools[s.name]:null;return {...s,display_code:schoolCode?.code||(settings.hideSchoolCodes?'':s.code),code_label:schoolCode?shandongSchoolCodes.label:'院校代码',code_source:schoolCode?.source||null,ownership:own?.ownership||null,ownership_source:own?(settings.ownershipSource||schoolOwnership.source):null};});if(settings.scopeSchools)major.official_code=major.code.split('-')[0];major.plan_year=year;major.score_year=year;
 }
 return majors;
}
module.exports={validate,apply,attach,categoryNames,config};

// Additive seed only. Never overwrite a province/year that has already been imported.
module.exports=function(db){
 db.run('BEGIN IMMEDIATE');try{
  db.run(`CREATE TABLE IF NOT EXISTS prep_scoped_admission_plans(province_id INTEGER NOT NULL,year INTEGER NOT NULL,major_code TEXT NOT NULL,school_code TEXT NOT NULL,school_name TEXT NOT NULL,ordinary INTEGER,special INTEGER,veteran INTEGER,total INTEGER,source_url TEXT NOT NULL,PRIMARY KEY(province_id,year,major_code,school_code))`);
  db.run(`CREATE TABLE IF NOT EXISTS prep_school_eligibility(province_id INTEGER NOT NULL,year INTEGER NOT NULL,junior_key TEXT NOT NULL,major_code TEXT NOT NULL,school_code TEXT NOT NULL,PRIMARY KEY(province_id,year,junior_key,major_code,school_code))`);
  db.run(`CREATE TABLE IF NOT EXISTS prep_dataset_config(province_id INTEGER NOT NULL,year INTEGER NOT NULL,config TEXT NOT NULL,PRIMARY KEY(province_id,year))`);
  const seed=require('../../data/prep-shandong-2026.json'),key=require('../../lib/prep-data').key;
  const p=db.exec("SELECT id FROM provinces WHERE name IN ('山东','山东省') OR code='37' ORDER BY id LIMIT 1");
  if(p.length){const id=Number(p[0].values[0][0]),scope=[id,seed.year];
   if(!db.exec(`SELECT 1 FROM prep_imports WHERE province_id=${id} AND year=2026 LIMIT 1`).length){
    for(const r of seed.majors)db.run('INSERT INTO prep_majors(province_id,year,code,name,kind,common_subjects,professional_subjects,subject_note,subject_source,common_source) VALUES(?,?,?,?,?,?,?,?,?,?)',[...scope,r.code,r.name,r.kind,r.common,r.professional,r.note,seed.subject_source,seed.subject_source]);
    for(const r of seed.mappings)db.run('INSERT INTO prep_mappings VALUES(?,?,?,?,?,?)',[...scope,r.junior,key(r.junior),r.code,seed.plan_source]);
    for(const r of seed.plans)db.run('INSERT INTO prep_scoped_admission_plans VALUES(?,?,?,?,?,?,?,?,?,?)',[...scope,r.major_code,r.school_code,r.school_name,r.ordinary,null,null,null,seed.plan_source]);
    for(const r of seed.school_mappings)db.run('INSERT INTO prep_school_eligibility VALUES(?,?,?,?,?)',[...scope,key(r.junior),r.major_code,r.school_code]);
    for(const r of seed.scores)db.run('INSERT INTO prep_admission_scores VALUES(?,?,?,?,?,?,?,?,?)',[...scope,r.major_code,r.school_code,r.school_name,r.category,r.stage,r.score,r.source_url]);
    const config={categories:[['ordinary','校荐生 / 自荐生'],['special','建档立卡家庭考生']],planLabel:'校荐计划',scoreLabel:'最低投档线',initialScoreLabel:'最低投档线',laterScoreLabel:'其他批次投档线',scopeSchools:true,hideSchoolCodes:true,
     note:'计划人数为2026年校荐生计划，建档立卡等未收录的计划人数显示“未收录”，不代表0人。自荐生最低投档线与同院校同专业校荐生相同，但须先通过该校专业综合能力测试。此处为最低投档线，不等同于最终录取结果。小数点后1–3位为大学语文与高等数学总成绩，4–6位为两科单科最高成绩，7–9位为英语（政治）成绩，10–12位为计算机成绩，按官方原值展示。',
     professionalSourceLabel:'考试科目与政策',mappingSource:seed.mapping_source,schools:seed.schools,ownershipSource:seed.ownership_source};
    db.run('INSERT INTO prep_dataset_config VALUES(?,?,?)',[...scope,JSON.stringify(config)]);
    for(const [type,count,url] of [['mapping',seed.mappings.length,seed.plan_source],['subjects',seed.majors.length,seed.subject_source],['plans',seed.plans.length,seed.plan_source],['scores',seed.scores.length,'https://www.sdzk.cn/NewsInfo.aspx?NewsID=7193']])db.run('INSERT INTO prep_imports(province_id,year,type,row_count,source_url,actor) VALUES(?,?,?,?,?,?)',[...scope,type,count,url,'山东2026官方数据首批接入']);
   }
  }
  db.run('COMMIT');
 }catch(e){db.run('ROLLBACK');throw e;}
};

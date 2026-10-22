const collator=new Intl.Collator('zh-CN',{numeric:true,sensitivity:'base'});
function courses(a,b){return collator.compare(a.title||'',b.title||'') || Number(a.id)-Number(b.id);}
function lessons(a,b){
  return String(a.schedule_time||'').localeCompare(String(b.schedule_time||'')) ||
    courses({title:a.course_title,id:a.course_id},{title:b.course_title,id:b.course_id}) ||
    Number(a.id)-Number(b.id);
}
module.exports={courses,lessons};

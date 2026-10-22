function today(now=Date.now()){return new Date(now+8*3600000).toISOString().slice(0,10);}
function state(lesson,now=Date.now()){
 const date=String(lesson.schedule_time||'').slice(0,10),valid=/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date));
 const future=valid&&date>today(now),live=!!(lesson.is_live||lesson.has_live_session);
 return {live_allowed:valid&&!future,future,completed:!live&&!!(lesson.has_taught_session||lesson.is_taught),has_replay_video:!!lesson.has_replay_video};
}
function select(db,courseId,lessonId){
 let lesson;
 if(lessonId!==undefined&&lessonId!==null&&lessonId!==''){
  if(!/^[1-9]\d*$/.test(String(lessonId)))throw Error('请选择有效课次');
  lesson=db.get('SELECT id,course_id,schedule_time FROM lessons WHERE id=? AND course_id=?',[Number(lessonId),Number(courseId)]);
 }else{
  const lessons=db.query('SELECT id,course_id,schedule_time FROM lessons WHERE course_id=? ORDER BY schedule_time,id',[Number(courseId)]);
  lesson=lessons.find(l=>String(l.schedule_time||'').slice(0,10)===today())||lessons.filter(l=>state(l).live_allowed).at(-1);
 }
 if(!lesson||!state(lesson).live_allowed)throw Error('未来课程的直播间将在上课当天开放，请选择已开放课次');
 return lesson;
}
module.exports={today,state,select};

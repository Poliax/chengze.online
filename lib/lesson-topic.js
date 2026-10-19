module.exports=function lessonTopic(db){return function(req,res){
 res.set('Cache-Control','private, no-store');
 const teacherId=req.session?.teacherPortalId;
 if(!teacherId)return res.status(401).json({error:'请重新登录'});
 const origin=req.get('origin');if(origin){try{if(new URL(origin).host!==req.get('host'))return res.status(403).json({error:'请求来源无效'});}catch(error){return res.status(403).json({error:'请求来源无效'});}}
 const lessonId=Number(req.params.lessonId),content=req.body?.content;
 if(!Number.isSafeInteger(lessonId)||lessonId<=0||typeof content!=='string'||content.length>2000)return res.status(400).json({error:'授课内容须为2000字以内的文字'});
 const lesson=db.get('SELECT l.id,l.course_id FROM lessons l JOIN courses c ON c.id=l.course_id WHERE l.id=? AND c.teacher_id=?',[lessonId,teacherId]);
 if(!lesson)return res.status(404).json({error:'课次不存在或没有编辑权限'});
 db.run('UPDATE lessons SET description=? WHERE id=? AND course_id=?',[content.trim(),lesson.id,lesson.course_id]);
 res.json({ok:true,content:content.trim()});
};};

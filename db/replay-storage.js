const db = require('./index');
module.exports = async function createReplay(input) {
 const courseId=Number(input.courseId);
 if(!Number.isSafeInteger(courseId)||courseId<1)throw Error('课程编号无效');
 const course=db.get('SELECT id, teacher_id FROM courses WHERE id=?',[courseId]);
 if(!course)throw Error('课程不存在');
 const raw=await db.getDb();
 raw.run('PRAGMA foreign_keys=ON');
 let createdSession=null,replayId=null,committed=false;
 raw.run('BEGIN');
 try {
  let session=db.get("SELECT id FROM live_sessions WHERE course_id=? AND status='ended' ORDER BY id DESC LIMIT 1",[courseId]);
  if(!session){raw.run("INSERT INTO live_sessions(course_id,teacher_id,status,ended_at) VALUES(?,?,'ended',CURRENT_TIMESTAMP)",[courseId,course.teacher_id]);session=db.get('SELECT last_insert_rowid() AS id');createdSession=session.id;}
  raw.run('INSERT INTO live_replays(session_id,course_id,title,duration,video_url,recorded_file,slide_timeline) VALUES(?,?,?,?,?,?,?)',[session.id,courseId,input.title||'直播回放',input.duration||0,input.videoUrl||'',input.filename||'','[]']);
  const id=db.get('SELECT last_insert_rowid() AS id').id;
  replayId=id;raw.run('COMMIT');committed=true;db.saveDb();return id;
 }catch(error){if(committed){raw.run('DELETE FROM live_replays WHERE id=?',[replayId]);if(createdSession)raw.run('DELETE FROM live_sessions WHERE id=?',[createdSession]);}else{try{raw.run('ROLLBACK')}catch{}}throw error;}
};

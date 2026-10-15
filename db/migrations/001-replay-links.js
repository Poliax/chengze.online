// Explicit deployment migration. Never reseed or replace student/order/enrollment rows.
module.exports = function migrate(db) {
 const rows=sql=>{const s=db.prepare(sql);const out=[];try{while(s.step())out.push(s.getAsObject());return out}finally{s.free()}};
 const cols=rows('PRAGMA table_info(live_replays)').map(r=>r.name);
 db.run('PRAGMA foreign_keys=ON');db.run('BEGIN');
 try{
  for(const [name,type] of [['recorded_file',"TEXT DEFAULT ''"],['video_url',"TEXT DEFAULT ''"],['lesson_id','INTEGER'],['file_id',"TEXT DEFAULT ''"]])if(!cols.includes(name))db.run('ALTER TABLE live_replays ADD COLUMN '+name+' '+type);
  const broken=rows('SELECT r.id,r.course_id,r.created_at,c.teacher_id FROM live_replays r LEFT JOIN live_sessions s ON s.id=r.session_id LEFT JOIN courses c ON c.id=r.course_id WHERE s.id IS NULL OR s.course_id<>r.course_id');
  for(const row of broken){
   if(!row.teacher_id)throw Error('Replay references missing course or teacher');
   db.run("INSERT INTO live_sessions(course_id,teacher_id,status,started_at,ended_at) VALUES(?,?,'ended',?,?)",[row.course_id,row.teacher_id,row.created_at,row.created_at]);
   const sessionId=rows('SELECT last_insert_rowid() AS id')[0].id;
   db.run('UPDATE live_replays SET session_id=? WHERE id=?',[sessionId,row.id]);
  }
  db.run('COMMIT');return {repairedLinks:broken.length,addedRecordedFile:!cols.includes('recorded_file')};
 }catch(e){db.run('ROLLBACK');throw e;}
};

const db = require('../db');
function id(v) { const n=Number(v); return /^[1-9]\d*$/.test(String(v)) && Number.isSafeInteger(n) ? n : null; }
function allowed(session, courseId) {
 const course=db.get('SELECT * FROM courses WHERE id=?',[id(courseId)]);
 if(!course) return false;
 const teacherId=id(session && (session.teacherId || session.teacherPortalId));
 if(teacherId){const t=db.get('SELECT id, username, status FROM teachers WHERE id=?',[teacherId]);if(t && t.status!=='disabled' && ((session.teacherId && t.username==='admin') || Number(course.teacher_id)===teacherId))return true;}
 const studentId=id(session && session.studentId);
 if(!studentId || course.status!=='published')return false;
 const student=db.get('SELECT id, status FROM students WHERE id=?',[studentId]);
 if(!student || student.status==='disabled')return false;
 if(db.get('SELECT id FROM enrollments WHERE student_id=? AND course_id=?',[studentId,course.id]))return true;
 return Boolean(db.get(`WITH RECURSIVE owned_packages(id) AS (
 SELECT package_id FROM package_enrollments WHERE student_id=? UNION
 SELECT p.id FROM course_packages p JOIN owned_packages parent ON p.parent_id=parent.id)
 SELECT id FROM owned_packages WHERE id=? OR id IN (SELECT package_id FROM course_package_courses WHERE course_id=?) LIMIT 1`,[studentId,course.package_id||0,course.id]));
}
function privateResponse(res) {
 res.set('Cache-Control', 'private, no-store, max-age=0');
 res.vary('Cookie');
}
function guard(resolve){return (req,res,next)=>{
 privateResponse(res);
 const courseId=resolve(req);
 if(!courseId)return res.status(404).json({error:'课程内容不存在'});
 if(allowed(req.session,courseId))return next();
 return res.status(req.session && (req.session.studentId||req.session.teacherId||req.session.teacherPortalId)?403:401).json({error:'请登录已报名账号观看该课程'});
};}
const course=key=>guard(req=>id(req.params[key]));
const row=(table,key)=>guard(req=>{const r=db.get('SELECT course_id FROM '+table+' WHERE id=?',[id(req.params[key])]);return r&&r.course_id;});
module.exports={allowed,guard,course,lesson:row('lessons','id'),replay:key=>row('live_replays',key)};
// Run before every static mount, including the legacy project-root mount.
module.exports.media = (req,res,next) => {
 let pathname;try{pathname=decodeURIComponent(req.path)}catch{return res.status(400).end()}
 let match=pathname.match(/^\/(?:public\/)?(?:courseware|materials\/courses)\/([^/]+)(?:\/|$)/);
 if(match)return guard(()=>id(match[1]))(req,res,next);
 match=pathname.match(/^\/(?:public\/)?recordings\/([^/]+)$/);
 if(match){privateResponse(res);const rows=db.query('SELECT course_id FROM live_replays WHERE recorded_file=?',[match[1]]);if(rows.some(r=>allowed(req.session,r.course_id)))return next();return res.status(403).json({error:'无权访问录播文件'})}
 if(/^\/(?:public\/)?recordings(?:\/|$)/.test(pathname)){privateResponse(res);return res.status(403).end();}
 // Shared upload directory also contains lesson slides. Match structured references,
 // not substring filenames, while preserving unrelated public learning materials.
 const shared=pathname.match(/^\/(?:public\/)?materials\/(?!courses(?:\/|$))(.+)$/);
 if(shared && !/^(?:upload(?:\/slide)?|delete\/[^/]+)$/.test(shared[1])) {
   const target='/materials/'+shared[1];
   const references=value=>{
     if(typeof value==='string') {
       try {const url=new URL(value,'https://chengze.online');if(!['chengze.online','www.chengze.online'].includes(url.hostname))return false;return decodeURIComponent(url.pathname).replace(/^\/public\//,'/')===target;}catch{return false;}
     }
     if(Array.isArray(value))return value.some(references);
     return value && typeof value==='object' && Object.values(value).some(references);
   };
   const linked=db.query("SELECT course_id, slides_data FROM lessons WHERE slides_data IS NOT NULL AND slides_data!=''")
     .filter(row=>{try{return references(JSON.parse(row.slides_data))}catch{return false}});
   if(linked.length) {
     privateResponse(res);
     if(linked.some(row=>allowed(req.session,row.course_id)))return next();
     return res.status(req.session && (req.session.studentId||req.session.teacherId||req.session.teacherPortalId)?403:401).json({error:'请登录已报名账号查看课时资料'});
   }
 }
 next();
};

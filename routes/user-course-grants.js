const crypto = require('node:crypto');
module.exports = function(db) {
 const router = require('express').Router();
 const validId = v => /^[1-9]\d*$/.test(String(v)) && Number.isSafeInteger(Number(v));
 function render(req,res,message='',status=200) {
  const student=db.get('SELECT id,name,real_name,phone,status FROM students WHERE id=?',[Number(req.params.id)]);
  if(!student)return res.status(404).send('用户不存在');
  if(!req.session.courseGrantToken)req.session.courseGrantToken=crypto.randomBytes(32).toString('hex');
  res.set('Cache-Control','private, no-store');
  return res.status(status).render('teacher/user-course-grants',{title:'开通课程 · 用户管理',teacherName:req.session.teacherName,student,token:req.session.courseGrantToken,message,
   packages:db.query("SELECT id,title FROM course_packages WHERE status='published' ORDER BY title,id"),
   courses:db.query("SELECT id,title FROM courses WHERE status='published' ORDER BY title,id"),
   ownedPackages:db.query('SELECT p.title FROM package_enrollments e JOIN course_packages p ON p.id=e.package_id WHERE e.student_id=? ORDER BY e.id DESC',[student.id]),
   ownedCourses:db.query('SELECT c.title FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.student_id=? ORDER BY e.id DESC',[student.id])});
 }
 router.get('/:id/course-grants',(req,res)=>render(req,res,req.query.saved==='1'?'已开通，学员可在学习总览查看。':''));
 router.post('/:id/course-grants',(req,res)=>{
  if(!req.session.courseGrantToken || typeof req.body.token!=='string' || req.body.token!==req.session.courseGrantToken)return res.status(403).send('页面已失效，请刷新后重试');
  const student=validId(req.params.id)&&db.get('SELECT id,status FROM students WHERE id=?',[Number(req.params.id)]);
  if(!student)return res.status(404).send('用户不存在');
  if(student.status==='disabled' || student.status==='cancelled')return render(req,res,'该账号当前不可开通课程。',400);
  const kind=req.body.kind, id=req.body.item_id;
  if(!['package','course'].includes(kind)||!validId(id))return render(req,res,'请选择要开通的班课或课程。',400);
  const table=kind==='package'?'course_packages':'courses';
  const item=db.get('SELECT id,status FROM '+table+' WHERE id=?',[Number(id)]);
  if(!item||item.status!=='published')return render(req,res,'课程不存在或尚未上架，请重新选择。',400);
  const target=kind==='package'?'package_enrollments':'enrollments', column=kind==='package'?'package_id':'course_id';
  db.run('INSERT OR IGNORE INTO '+target+' (student_id,'+column+') VALUES (?,?)',[student.id,Number(id)]);
  return res.redirect('/admin/users-manage/'+student.id+'/course-grants?saved=1');
 });
 return router;
};

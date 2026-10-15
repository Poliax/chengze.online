const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const db = require('../db');
const { requireTeacher } = require('../middleware/auth');

const BASE = path.join(__dirname, '..', 'public', 'materials', 'courses');

router.get('/', requireTeacher, (req, res) => {
  const courses = db.query('SELECT c.id, c.title, c.year, c.province, (SELECT COUNT(*) FROM course_materials cm WHERE cm.course_id=c.id) as file_count FROM courses c ORDER BY c.id DESC');
  res.render('teacher/course-materials', {
    title: '讲义管理',
    teacherName: req.session.teacherName,
    courses,
    msg: null
  });
});

router.get('/:courseId', requireTeacher, (req, res) => {
  const course = db.get('SELECT * FROM courses WHERE id=?', [req.params.courseId]);
  if (!course) return res.redirect('/admin/course-materials');
  const files = db.query('SELECT cm.*, l.title as lesson_title FROM course_materials cm LEFT JOIN lessons l ON l.id=cm.lesson_id WHERE cm.course_id=? ORDER BY cm.id DESC', [course.id]);
  const lessons = db.query('SELECT id, title FROM lessons WHERE course_id=? ORDER BY order_index, id', [course.id]);
  res.render('teacher/course-materials-detail', {
    title: '讲义管理 · ' + course.title,
    teacherName: req.session.teacherName,
    course,
    files,
    lessons,
    msg: null
  });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(BASE, String(req.params.courseId));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, Date.now() + '_' + file.originalname)
});
const upload = multer({ storage });

router.post('/:courseId/upload', requireTeacher, upload.single('file'), (req, res) => {
  if (!req.file) return res.redirect('/admin/course-materials/' + req.params.courseId);
  const lessonId = parseInt((req.body || {}).lesson_id, 10) || 0;
  db.run('INSERT INTO course_materials (course_id, lesson_id, filename, original_name, size, uploaded_by) VALUES (?,?,?,?,?,?)',
    [req.params.courseId, lessonId, req.file.filename, req.file.originalname, req.file.size, req.session.teacherId || 0]);
  try { db.saveDb(); } catch(e) {}
  res.redirect('/admin/course-materials/' + req.params.courseId);
});

router.post('/:id/delete', requireTeacher, (req, res) => {
  const row = db.get('SELECT * FROM course_materials WHERE id=?', [req.params.id]);
  if (row) {
    const file = path.join(BASE, String(row.course_id), row.filename);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    db.run('DELETE FROM course_materials WHERE id=?', [row.id]);
    try { db.saveDb(); } catch(e) {}
  }
  res.redirect('/admin/course-materials/' + (row ? row.course_id : ''));
});

module.exports = router;

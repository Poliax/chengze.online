const express = require('express');
const router = express.Router();
const db = require('../db');

// ── Student: View package → second-level package or courses ──
router.get('/:id', (req, res) => {
  const pkg = db.get('SELECT * FROM course_packages WHERE id = ? AND status = ?', [req.params.id, 'published']);
  if (!pkg) return res.redirect('/');

  const children = db.query(`SELECT p.*,
    (SELECT COUNT(*) FROM course_package_courses pc WHERE pc.package_id = p.id) as course_count
    FROM course_packages p WHERE p.parent_id = ? AND p.status = ? ORDER BY p.sort_order ASC, p.created_at DESC`, [pkg.id, 'published']);
  children.forEach(function(c){
    var actual = 0;
    try { actual = db.get('SELECT COUNT(*) as c FROM package_enrollments WHERE package_id=?', [c.id]).c || 0; } catch(e) {}
    c.actual_student_count = actual;
    c.display_student_count = (c.student_count && String(c.student_count).trim() !== '' && Number(c.student_count) !== 0) ? Number(c.student_count) : actual;
    var tRows = db.query(`SELECT DISTINCT t.display_name, t.avatar FROM teachers t JOIN courses c2 ON c2.teacher_id=t.id JOIN course_package_courses pc ON pc.course_id=c2.id WHERE pc.package_id=? AND c2.status='published' ORDER BY t.display_name`, [c.id]);
    c.teachers = tRows.map(function(t){ return t.display_name; });
    c.teacher_avatars = tRows.map(function(t){ return t.avatar || ''; });
    c.teacher_name = c.teachers.join('、');
  });

  const courses = db.query(`SELECT c.*, t.display_name as teacher_name,
    (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) as lesson_count
    FROM courses c JOIN course_package_courses pc ON pc.course_id = c.id
    LEFT JOIN teachers t ON c.teacher_id = t.id
    WHERE pc.package_id = ? AND c.status = ? ORDER BY pc.id`, [pkg.id, 'published']);

  let scheduleRows = [];
  if (courses.length > 0) {
    const ids = courses.map(function(c) { return parseInt(c.id, 10); }).join(',');
    scheduleRows = db.query(`SELECT l.*, c.title as course_title
      FROM lessons l JOIN courses c ON c.id = l.course_id
      WHERE l.course_id IN (${ids})
      ORDER BY l.schedule_time IS NULL, l.schedule_time, c.title, l.order_index`);
  }

  res.render('student/package', {
    title: `${pkg.title} · 承泽教育`,
    pkg,
    children,
    courses,
    scheduleRows,
    studentId: req.session.studentId || null,
    enrolled: req.session.studentId ? true : false,
    trialUrl: courses.length ? '/live/student/courses/' + courses[0].id : ''
  });
});

module.exports = router;

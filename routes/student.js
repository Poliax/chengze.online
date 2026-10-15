const access = require('../middleware/course-access');
const express = require('express');
const router = express.Router();
const db = require('../db');
const fs = require('fs');
const path = require('path');

// ── Student Portal — Course Listing ──
router.get('/', (req, res) => {
  const courses = db.query(`SELECT c.*, t.display_name as teacher_name,
    (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) as lesson_count
    FROM courses c JOIN teachers t ON c.teacher_id = t.id
    WHERE c.status = 'published' ORDER BY c.student_count DESC`);

  let packages = db.query("SELECT p.*, (SELECT COUNT(*) FROM course_package_courses pc WHERE pc.package_id=p.id) as course_count, (SELECT COUNT(*) FROM course_packages cp WHERE cp.parent_id=p.id) as child_count FROM course_packages p WHERE p.status='published' AND (p.parent_id IS NULL OR p.parent_id=0) ORDER BY p.sort_order ASC, p.created_at DESC");
  packages = packages.map(function(p){
    var actual = 0;
    try { actual = db.get('SELECT COUNT(*) as c FROM package_enrollments WHERE package_id=?', [p.id]).c || 0; } catch(e) {}
    p.actual_student_count = actual;
    p.display_student_count = (p.student_count && String(p.student_count).trim() !== '' && Number(p.student_count) !== 0) ? Number(p.student_count) : actual;
    var childHours = [];
    try {
      db.query('SELECT id FROM course_packages WHERE parent_id=?', [p.id]).forEach(function(k){
        var mins = (db.get(`SELECT COALESCE(SUM(l.duration),0) as s FROM lessons l JOIN course_package_courses pc ON pc.course_id=l.course_id WHERE pc.package_id=${k.id}`).s || 0) / 60;
        if (mins) childHours.push(Math.max(1, Math.ceil(mins / 45)));
      });
    } catch(e) {}
    if (childHours.length) {
      p.total_hours = Math.min.apply(null, childHours);
      p.total_hours_plus = true;
    } else {
      var mins = 0;
      try { mins = (db.get(`SELECT COALESCE(SUM(l.duration),0) as s FROM lessons l JOIN course_package_courses pc ON pc.course_id=l.course_id WHERE pc.package_id=${p.id}`).s || 0) / 60; } catch(e) {}
      p.total_hours = mins ? Math.max(1, Math.ceil(mins / 45)) : 0;
      p.total_hours_plus = false;
    }
    return p;
  });
  const independentCourses = db.query("SELECT c.*, t.display_name as teacher_name, (SELECT COUNT(*) FROM lessons WHERE course_id=c.id) as lesson_count FROM courses c JOIN teachers t ON c.teacher_id=t.id WHERE c.status='published' ORDER BY c.student_count DESC");
  const provinces = db.query('SELECT * FROM provinces ORDER BY id');
  const student = req.session.studentId ? db.get('SELECT id, name, username, phone, uid FROM students WHERE id=?', [req.session.studentId]) : null;
  const overview = { enrolled: 0, completed: 0, total: 0, upcoming: 0, minutes: 0 };
  const myCourses = [];
  const upcomingLessons = [];
  if (student) {
    try {
      const sid = student.id;
      overview.enrolled = (db.get('SELECT COUNT(*) as c FROM package_enrollments WHERE student_id=?', [sid]).c || 0) + (db.get('SELECT COUNT(*) as c FROM enrollments WHERE student_id=?', [sid]).c || 0);
      overview.completed = db.get('SELECT COUNT(*) as c FROM course_progress WHERE student_id=? AND completed=1', [sid]).c || 0;
      overview.minutes = Math.round((db.get('SELECT COALESCE(SUM(watch_duration),0) as s FROM course_progress WHERE student_id=?', [sid]).s || 0) / 60);
      const ids = db.query('SELECT course_id FROM enrollments WHERE student_id=? UNION SELECT pc.course_id FROM course_package_courses pc JOIN package_enrollments pe ON pe.package_id=pc.package_id WHERE pe.student_id=?', [sid, sid]).map(function(r){ return parseInt(r.course_id, 10); });
      if (ids.length) {
        const inClause = ids.join(',');
        overview.total = db.get(`SELECT COUNT(*) as c FROM lessons WHERE course_id IN (${inClause})`).c || 0;
        overview.upcoming = db.get(`SELECT COUNT(*) as c FROM lessons WHERE course_id IN (${inClause}) AND schedule_time >= datetime('now','localtime')`).c || 0;
        overview.percent = overview.total ? Math.round(overview.completed / overview.total * 100) : 0;
        db.query(`SELECT DISTINCT c.id, c.title, c.year, c.province, t.display_name as teacher_name, (SELECT COUNT(*) FROM lessons WHERE course_id=c.id) as lesson_count FROM courses c LEFT JOIN teachers t ON c.teacher_id=t.id WHERE c.id IN (${inClause}) ORDER BY c.created_at DESC`).forEach(function(c){
          const done = db.get(`SELECT COUNT(*) as c FROM course_progress p JOIN lessons l ON l.id=p.lesson_id WHERE p.student_id=? AND l.course_id=? AND p.completed=1`, [sid, c.id]).c || 0;
          myCourses.push({ id: c.id, title: c.title || '', year: c.year || '', province: c.province || '', teacher_name: c.teacher_name || '', lesson_count: c.lesson_count || 0, completed: done, percent: (c.lesson_count ? Math.round(done / c.lesson_count * 100) : 0) });
        });
        db.query(`SELECT l.id, l.title, l.schedule_time, c.title as course_title FROM lessons l JOIN courses c ON c.id=l.course_id WHERE l.course_id IN (${inClause}) AND l.schedule_time >= datetime('now','localtime') ORDER BY l.schedule_time ASC LIMIT 6`).forEach(function(l){
          upcomingLessons.push({ id: l.id, title: l.title || '', schedule_time: l.schedule_time || '', course_title: l.course_title || '' });
        });
      }
    } catch(e) {}
  }
  const childrenByParent = {};
  const allChildren = db.query("SELECT p.*, (SELECT COUNT(*) FROM course_package_courses pc WHERE pc.package_id=p.id) as course_count FROM course_packages p WHERE p.parent_id IS NOT NULL AND p.parent_id != 0 AND p.status='published' ORDER BY p.sort_order ASC, p.id");
  allChildren.forEach(function(c) {
    var actual = 0;
    try { actual = db.get('SELECT COUNT(*) as c FROM package_enrollments WHERE package_id=?', [c.id]).c || 0; } catch(e) {}
    c.actual_student_count = actual;
    c.display_student_count = (c.student_count && String(c.student_count).trim() !== '' && Number(c.student_count) !== 0) ? Number(c.student_count) : actual;
    var tRows = db.query(`SELECT DISTINCT t.display_name, t.avatar FROM teachers t JOIN courses c2 ON c2.teacher_id=t.id JOIN course_package_courses pc ON pc.course_id=c2.id WHERE pc.package_id=? AND c2.status='published' ORDER BY t.display_name`, [c.id]);
    c.teachers = tRows.map(function(t){ return t.display_name; });
    c.teacher_avatars = tRows.map(function(t){ return t.avatar || ''; });
    c.teacher_name = c.teachers.join('、');
    (childrenByParent[c.parent_id] = childrenByParent[c.parent_id] || []).push(c);
  });
  const coursesByParent = {};
  const coursesByPackage = {};
  allChildren.forEach(function(c){
    const rows = db.query(`SELECT c.*, t.display_name as teacher_name,
      (SELECT COUNT(*) FROM lessons WHERE course_id=c.id) as lesson_count
      FROM courses c JOIN course_package_courses pc ON pc.course_id=c.id
      LEFT JOIN teachers t ON c.teacher_id=t.id
      WHERE pc.package_id=? AND c.status='published' ORDER BY pc.id`, [c.id]);
    rows.forEach(function(r){
      r.display_student_count = r.student_count || 0;
      var arr = coursesByParent[c.parent_id] = coursesByParent[c.parent_id] || [];
      var dup = arr.some(function(x){ return Number(x.id) === Number(r.id); });
      if (!dup) arr.push(r);
      var arr2 = coursesByPackage[c.id] = coursesByPackage[c.id] || [];
      var dup2 = arr2.some(function(x){ return Number(x.id) === Number(r.id); });
      if (!dup2) arr2.push(r);
    });
  });
  Object.keys(coursesByParent).forEach(function(k){
    coursesByParent[k] = coursesByParent[k].map(function(r){ return r; });
  });
  const packageDetails = {};
  const allPackages = db.query("SELECT * FROM course_packages WHERE status='published'");
  allPackages.forEach(function(p){
    var actual = 0;
    try { actual = db.get('SELECT COUNT(*) as c FROM package_enrollments WHERE package_id=?', [p.id]).c || 0; } catch(e) {}
    p.display_student_count = (p.student_count && String(p.student_count).trim() !== '' && Number(p.student_count) !== 0) ? Number(p.student_count) : actual;
    var children = (childrenByParent[p.id] || []).slice();
    var courses = (coursesByPackage[p.id] || []).slice();
    var scheduleRows = [];
    if (courses.length > 0) {
      const ids = courses.map(function(c){ return parseInt(c.id, 10); }).join(',');
      try {
        scheduleRows = db.query(`SELECT l.*, c.title as course_title FROM lessons l JOIN courses c ON c.id = l.course_id WHERE l.course_id IN (${ids}) ORDER BY l.schedule_time IS NULL, l.schedule_time, c.title, l.order_index`);
      } catch(e) {}
    }
    var teachers = [];
    var avatars = [];
    var bios = [];
    if (p.parent_id) {
      const tRows = db.query(`SELECT DISTINCT t.display_name, t.avatar, t.bio FROM teachers t JOIN courses c2 ON c2.teacher_id=t.id JOIN course_package_courses pc ON pc.course_id=c2.id WHERE pc.package_id=? AND c2.status='published' ORDER BY t.display_name`, [p.id]);
      teachers = tRows.map(function(t){ return t.display_name; });
      avatars = tRows.map(function(t){ return t.avatar || ''; });
      bios = tRows.map(function(t){ return t.bio || ''; });
    }
    var parent_title = '';
    if (p.parent_id) {
      const pp = db.get('SELECT title FROM course_packages WHERE id=?', [p.parent_id]);
      if (pp) parent_title = pp.title || '';
    }
    packageDetails[p.id] = {
      id: p.id,
      title: p.title || '',
      description: p.description || '',
      year: p.year || '',
      province: p.province || '',
      class_type: p.class_type || '',
      price: p.price || '',
      sale_price: p.sale_price || '',
      start_date: p.start_date || '',
      end_date: p.end_date || '',
      display_student_count: p.display_student_count || 0,
      teachers: teachers,
      teacher_avatars: avatars,
      teacher_bios: bios,
      parent_title: parent_title,
      children: children,
      courses: courses,
      scheduleRows: scheduleRows,
      trialUrl: courses.length ? '/live/student/courses/' + courses[0].id : ''
    };
  });
  const courseDetails = {};
  const allCourses = db.query(`SELECT c.*, t.display_name as teacher_name, t.avatar as teacher_avatar, t.bio as teacher_bio FROM courses c LEFT JOIN teachers t ON c.teacher_id=t.id WHERE c.status='published'`);
  allCourses.forEach(function(c){
    const lessons = db.query('SELECT * FROM lessons WHERE course_id=? ORDER BY order_index ASC, id ASC', [c.id]);
    const actualDurations = {};
    const replayIds = {};
    if (lessons.length) {
      try {
        const sessionRows = db.query(`SELECT lesson_id, MAX(duration) as d FROM live_sessions WHERE lesson_id IN (${lessons.map(function(l){ return parseInt(l.id, 10); }).join(',')}) AND duration IS NOT NULL GROUP BY lesson_id`);
        sessionRows.forEach(function(s){ actualDurations[s.lesson_id] = s.d; });
      } catch(e) {}
      try {
        const streamRows = db.query(`SELECT lesson_id, MAX((julianday(ended_at) - julianday(started_at)) * 86400) as d FROM live_streams WHERE lesson_id IN (${lessons.map(function(l){ return parseInt(l.id, 10); }).join(',')}) AND ended_at IS NOT NULL GROUP BY lesson_id`);
        streamRows.forEach(function(s){ actualDurations[s.lesson_id] = Math.max(actualDurations[s.lesson_id] || 0, Number(s.d) || 0); });
      } catch(e) {}
      try {
        const replayRows = db.query(`SELECT DISTINCT lesson_id FROM live_replays WHERE lesson_id IN (${lessons.map(function(l){ return parseInt(l.id, 10); }).join(',')})`);
        replayRows.forEach(function(r){ replayIds[r.lesson_id] = true; });
      } catch(e) {}
    }
    let liveStream = null;
    try { liveStream = db.get("SELECT * FROM live_streams WHERE course_id=? AND status='live' ORDER BY COALESCE(started_at, created_at) DESC LIMIT 1", [c.id]); } catch(e) {}
    courseDetails[c.id] = {
      id: c.id,
      title: c.title || '',
      description: c.description || '',
      province: c.province || '',
      year: c.year || '',
      class_type: c.class_type || '',
      category: c.category || '',
      price: c.price || '',
      sale_price: c.sale_price || '',
      teacher_name: c.teacher_name || '',
      teacher_avatar: c.teacher_avatar || '',
      teacher_bio: c.teacher_bio || '',
      materials: [],
      isLive: !!liveStream,
      liveLessonId: liveStream ? (liveStream.lesson_id || null) : null,
      liveWatchUrl: liveStream ? '/live/student/live-watch/' + c.id : '',
      lessons: lessons.map(function(l){
        const hasVideo = !!replayIds[l.id];
        const isLiveLesson = !!(liveStream && liveStream.lesson_id && Number(liveStream.lesson_id) === Number(l.id));
        return {
          id: l.id,
          title: l.title || '',
          schedule_time: l.schedule_time || '',
          duration: l.duration || 0,
          actual_duration: actualDurations[l.id] || null,
          has_replay: !!replayIds[l.id],
          hasVideo: hasVideo,
          is_live: isLiveLesson,
          watchUrl: liveStream ? '/live/student/live-watch/' + c.id : (hasVideo ? '/live/student/replay-duo/' + c.id + '?lesson=' + l.id + '&v=2' : '/live/student/watch/' + l.id)
        };
      })
    };
    courseDetails[c.id].materials = db.query('SELECT * FROM course_materials WHERE course_id=? ORDER BY id DESC', [c.id]).map(function(m){ return { id: m.id, lesson_id: m.lesson_id || 0, original_name: m.original_name || m.filename, url: '/materials/courses/' + c.id + '/' + m.filename }; });
  });
  let homeProvinceData = {};
  try {
    const p = db.get("SELECT * FROM provinces WHERE code='37'");
    if (p) {
      let schedule = [];
      try { schedule = JSON.parse(p.schedule || '[]'); } catch(e) {}
      if (!Array.isArray(schedule)) schedule = [];
      homeProvinceData = { name: p.name, outline_file: p.outline_file || '', papers_file: p.papers_file || '', schedule };
    }
  } catch(e) {}
  let adConfig = {};
  try { adConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'ad-config.json'), 'utf8')); } catch(e) {}
  res.render('student/home', {
    title: '课程中心 · 承泽教育',
    courses,
    packages,
    independentCourses,
    provinces,
    student,
    guest: req.session.guest || false,
    overview,
    myCourses,
    upcomingLessons,
    initialView: 'courses',
    homeProvinceData,
    childrenByParent,
    coursesByParent,
    coursesByPackage,
    packageDetails,
    courseDetails,
    adConfig
  });
});

// ── Course Detail Page ──
router.get('/courses/:id', (req, res) => {
  res.redirect('/learning');
});

// ── Watch Lesson ──
router.get('/watch/:id', access.lesson, (req, res) => {
  const lesson = db.get('SELECT l.*, c.title as course_title, c.id as course_id FROM lessons l JOIN courses c ON l.course_id = c.id WHERE l.id = ?', [req.params.id]);
  
  if (!lesson) return res.redirect('/live/student');

  const course = db.get('SELECT * FROM courses WHERE id = ?', [lesson.course_id]);
  const lessons = db.query('SELECT * FROM lessons WHERE course_id = ? ORDER BY order_index ASC', [lesson.course_id]);

  res.render('student/watch', {
    title: `${lesson.title} · ${course.title}`,
    lesson,
    course,
    lessons,
    lessonSlides: JSON.parse(lesson.slides_data || '[]')
  });
});

// ── API: Course List ──
router.get('/api/courses', (req, res) => {
  const courses = db.query(`SELECT c.*, t.display_name as teacher_name,
    (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) as lesson_count
    FROM courses c JOIN teachers t ON c.teacher_id = t.id
    WHERE c.status = 'published' ORDER BY c.student_count DESC`);
  res.json(courses);
});

// ── API: Course Detail ──
router.get('/api/courses/:id', access.course('id'), (req, res) => {
  const course = db.get(`SELECT c.*, t.display_name as teacher_name FROM courses c 
    JOIN teachers t ON c.teacher_id = t.id WHERE c.id = ?`, [req.params.id]);
  if (!course) return res.status(404).json({ error: 'not found' });
  const lessons = db.query('SELECT * FROM lessons WHERE course_id = ? ORDER BY order_index ASC', [course.id]);
  res.json({ ...course, lessons });
});

// ── API: Lesson Detail ──
router.get('/api/lessons/:id', access.lesson, (req, res) => {
  const lesson = db.get('SELECT * FROM lessons WHERE id = ?', [req.params.id]);
  if (!lesson) return res.status(404).json({ error: 'not found' });
  lesson.slides_data = JSON.parse(lesson.slides_data || '[]');
  res.json(lesson);
});

// ── API: Update Progress ──
router.post('/api/progress', require('./progress'));

// ── 我的订单 ──
router.get('/orders', (req, res) => {
  if (!req.session.studentId) return res.redirect('/live/student');
  const student = db.get('SELECT * FROM students WHERE id=?', [req.session.studentId]);
  if (!student) return res.redirect('/live/student');
  const orders = db.query(`SELECT o.*, c.title as course_title, p.title as package_title
    FROM orders o
    LEFT JOIN courses c ON c.id=o.course_id
    LEFT JOIN course_packages p ON p.id=o.package_id
    WHERE o.student_id=? ORDER BY o.created_at DESC`, [req.session.studentId]);
  res.render('student/orders', { title: '我的订单 · 承泽教育', student, orders });
});

// ── 服务协议 / 隐私政策 / 退款说明 ──
router.get('/policy', (req, res) => {
  res.render('student/policy', { title: '服务协议 · 承泽教育' });
});

module.exports = router;

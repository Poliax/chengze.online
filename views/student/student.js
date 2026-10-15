const express = require('express');
const router = express.Router();
const db = require('../db');

// ── Student Portal — Course Listing ──
router.get('/', (req, res) => {
  const courses = db.query(`SELECT c.*, t.display_name as teacher_name,
    (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) as lesson_count
    FROM courses c JOIN teachers t ON c.teacher_id = t.id
    WHERE c.status = 'published' ORDER BY c.student_count DESC`);

  const packages = db.query("SELECT p.*, (SELECT COUNT(*) FROM courses c WHERE c.package_id=p.id) as course_count FROM course_packages p WHERE p.status='published' ORDER BY p.created_at DESC");
  const independentCourses = db.query("SELECT c.*, t.display_name as teacher_name, (SELECT COUNT(*) FROM lessons WHERE course_id=c.id) as lesson_count FROM courses c JOIN teachers t ON c.teacher_id=t.id WHERE (c.package_id IS NULL OR c.package_id=0) AND c.status='published' ORDER BY c.student_count DESC");
  res.render('student/index', {
    title: '在线看课 · 承泽教育',
    courses,
    packages,
    independentCourses
  });
});

// ── Course Detail Page ──
router.get('/courses/:id', (req, res) => {
  const course = db.get(`SELECT c.*, t.display_name as teacher_name, t.bio as teacher_bio
    FROM courses c JOIN teachers t ON c.teacher_id = t.id WHERE c.id = ? AND c.status = 'published'`, [req.params.id]);

  if (!course) return res.redirect('/live/student');

  const lessons = db.query('SELECT * FROM lessons WHERE course_id = ? ORDER BY order_index ASC', [course.id]);

  // Get student progress (using session student or first enrolled student as demo)
  let studentProgress = {};
  if (req.session.studentId) {
    const progress = db.query('SELECT * FROM course_progress WHERE student_id = ?', [req.session.studentId]);
    progress.forEach(p => { studentProgress[p.lesson_id] = p; });
  }

  // Check live status
  let liveSession = db.get("SELECT * FROM live_sessions WHERE course_id = ? AND status = 'live' ORDER BY started_at DESC LIMIT 1", [course.id]);
  const isLive = !!liveSession;
  const liveSessionId = isLive ? `session_${course.id}_${Date.parse(liveSession.started_at)}` : null;
  
  // Get replays
  const replays = db.query('SELECT * FROM live_replays WHERE course_id = ? ORDER BY created_at DESC', [course.id]);

  res.render('student/course', {
    title: `${course.title} · 承泽教育`,
    course,
    lessons,
    studentProgress,
    enrolled: req.session.studentId ? true : false,
    isLive,
    liveSessionId,
    replays
  });
});

// ── Watch Lesson ──
router.get('/watch/:id', (req, res) => {
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
router.get('/api/courses/:id', (req, res) => {
  const course = db.get(`SELECT c.*, t.display_name as teacher_name FROM courses c 
    JOIN teachers t ON c.teacher_id = t.id WHERE c.id = ?`, [req.params.id]);
  if (!course) return res.status(404).json({ error: 'not found' });
  const lessons = db.query('SELECT * FROM lessons WHERE course_id = ? ORDER BY order_index ASC', [course.id]);
  res.json({ ...course, lessons });
});

// ── API: Lesson Detail ──
router.get('/api/lessons/:id', (req, res) => {
  const lesson = db.get('SELECT * FROM lessons WHERE id = ?', [req.params.id]);
  if (!lesson) return res.status(404).json({ error: 'not found' });
  lesson.slides_data = JSON.parse(lesson.slides_data || '[]');
  res.json(lesson);
});

// ── API: Update Progress ──
router.post('/api/progress', (req, res) => {
  const { studentId, lessonId, completed, watchDuration, lastPosition } = req.body;
  
  if (!studentId || !lessonId) return res.status(400).json({ error: 'missing params' });

  const existing = db.get('SELECT * FROM course_progress WHERE student_id = ? AND lesson_id = ?', [studentId, lessonId]);

  if (existing) {
    db.run(`UPDATE course_progress SET completed=?, watch_duration=?, last_position=?, updated_at=CURRENT_TIMESTAMP 
      WHERE student_id=? AND lesson_id=?`,
      [completed ? 1 : 0, watchDuration || 0, lastPosition || 0, studentId, lessonId]);
  } else {
    db.run(`INSERT INTO course_progress (student_id, lesson_id, completed, watch_duration, last_position) VALUES (?, ?, ?, ?, ?)`,
      [studentId, lessonId, completed ? 1 : 0, watchDuration || 0, lastPosition || 0]);
  }

  res.json({ ok: true });
});

module.exports = router;

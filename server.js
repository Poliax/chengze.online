const express = require('express');
const path = require('path');
const session = require('express-session');
const db = require('./db');
const http = require('http');
const { Server } = require('socket.io');
const FileStore = require('./session-store');
const compression = require('compression');

const app = express();
const CSS_VERSION = Math.floor(Date.now() / 1000);
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
const io = new Server(server);
app.set('io', io);

// ── Init DB ──
(async () => {
  await db.getDb();
  console.log('Database initialized');
})();

// ── View engine ──
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── Middleware ──
app.use(compression());
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '50mb' }));

// ── Session ──
const sessionSecret = JSON.parse(require('fs').readFileSync(path.join(__dirname, 'live-config.json'), 'utf8')).sessionSecret;
if (typeof sessionSecret !== 'string' || sessionSecret.length < 32) throw new Error('Session signing secret is not configured');
const sessionMiddleware = session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: new FileStore(),
  cookie: { maxAge: 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax' }
});
app.use(sessionMiddleware);
app.use(require('./middleware/admin-domain'));
app.use(require('./middleware/media-signing'));

// ── Make session user available in templates ──
app.use((req, res, next) => {
  res.locals.teacherName = req.session.teacherName || null;
  res.locals.teacherId = req.session.teacherId || null;
  res.locals.path = req.path;
  res.locals.cssVer = CSS_VERSION;
  next();
});

// ── 承泽在线（原官网，左侧菜单布局）──
function renderLearningCenter(req, res) {
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
  const totalLessons = courses.reduce(function(s, c) { return s + (c.lesson_count || 0); }, 0);
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
  try { adConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'ad-config.json'), 'utf8')); } catch(e) {}
  res.render('student/home', { title: '承泽在线', courses, packages, independentCourses, student, guest: req.session.guest || false, overview, myCourses, upcomingLessons, totalLessons, initialView: 'home', homeProvinceData, childrenByParent, coursesByParent, coursesByPackage, packageDetails, courseDetails, adConfig, provinces });
}
app.get('/learning', renderLearningCenter);

// ── 官网首页 ──
// Public resource mounts are installed below after access checks.
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'site', 'index.html'));
});
app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'site', 'about.html'));
});
app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'site', 'contact.html'));
});
app.get('/feedback', (req, res) => res.sendFile(path.join(__dirname, 'public', 'site', 'feedback.html')));
app.get('/learning-center', (req, res) => res.sendFile(path.join(__dirname, 'public', 'site', 'learning.html')));
app.get('/courses', (req, res) => res.sendFile(path.join(__dirname, 'public', 'site', 'courses.html')));
app.get('/teachers', (req, res) => res.sendFile(path.join(__dirname, 'public', 'site', 'teachers.html')));
app.use((req, res, next) => {
  const p = req.path;
  if (p.startsWith('/css/') || p.startsWith('/js/') || p.startsWith('/public/') || p.startsWith('/data/')) {
    res.set('Cache-Control', 'public, max-age=86400');
  }
  next();
});
app.use(require('./middleware/course-access').media);
app.use(require('./middleware/static-files')(__dirname));

// ── 页面不缓存：防止 Cloudflare/浏览器返回旧 HTML ──
app.use((req, res, next) => {
  const p = req.path;
  if (!p.startsWith('/css/') && !p.startsWith('/js/') && !p.startsWith('/public/') &&
      !p.startsWith('/player/') && !p.startsWith('/data/') && !p.startsWith('/provinces/')) {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  next();
});

// ── Routes ──
const authRoutes = require('./routes/auth');
const teacherRoutes = require('./routes/teacher');
const liveAdminRoutes = require('./routes/live-admin');
const teacherPortalRoutes = require('./routes/teacher-portal');
const studentRoutes = require('./routes/student');
const liveRoutes = require('./routes/live');
const materialsRoutes = require('./routes/materials');
const studentAuthRoutes = require('./routes/student-auth');
const orderRoutes = require('./routes/orders');
const packagesRoutes = require('./routes/packages');
const packageViewRoutes = require('./routes/package-view');
const provincesRoutes = require('./routes/provinces');
const adsRoutes = require('./routes/ads');
const questionsRoutes = require('./routes/questions');
const courseMaterialsRoutes = require('./routes/course-materials');

app.use('/admin', require('./middleware/admin-access'));
app.use('/admin/technical-center', require('./routes/technical-center'));
app.use('/admin/accounts-manage', require('./routes/admin-accounts'));

// ── 旧地址兼容跳转 ──
app.get('/admin/staff', (req, res) => res.redirect('/admin/teachers-manage'));
app.get('/admin/staff/new', (req, res) => res.redirect('/admin/teachers-manage/new'));
app.get('/admin/staff/edit/:id', (req, res) => res.redirect('/admin/teachers-manage/edit/' + req.params.id));
app.get('/admin/teacher-manage', (req, res) => res.redirect('/admin/teachers-manage'));
app.get('/admin/provinces/admin', (req, res) => res.redirect('/admin/provinces-manage'));
app.get('/admin/courses', (req, res) => res.redirect('/admin/courses-manage'));
app.get('/admin/students', (req, res) => res.redirect('/admin/students-manage'));
app.get('/admin/orders', (req, res) => res.redirect('/admin/orders-manage'));
app.get('/admin/logistics', (req, res) => res.redirect('/admin/logistics-manage'));
app.get('/admin/live-manage/replay', (req, res) => res.redirect('/admin/replays-manage'));

app.use('/admin', authRoutes);
app.use('/admin', liveAdminRoutes);
app.use('/admin', teacherRoutes);
app.use('/admin/ads-manage', adsRoutes);
app.use('/admin/questions-manage', questionsRoutes);
app.use('/admin/course-materials', courseMaterialsRoutes);
app.use('/teach', require('./middleware/admin-domain').portal);
app.use('/teach', teacherPortalRoutes);
app.get('/admin', (req, res) => res.redirect('/admin/login'));

app.get('/live/student', (req, res) => res.redirect('/learning'));
app.use('/live/student', studentRoutes);
app.use('/live', liveRoutes);

// ── Materials (PDF, 真题, 考纲) ──


app.use('/api', studentAuthRoutes);
app.post('/api/progress', require('./routes/progress'));
app.use('/api', orderRoutes);
app.use('/materials', materialsRoutes);
app.use('/admin/packages-manage', packagesRoutes);
app.use('/packages', packageViewRoutes);
app.use('/packages', packagesRoutes);
app.use('/admin', provincesRoutes);
app.use('/provinces', provincesRoutes);

// ── Schedule API ──
const fs = require('fs');
const PROV_CODE_MAP = {
  '33':'zhejiang','37':'shandong','41':'henan','44':'guangdong','32':'jiangsu',
  '51':'sichuan','35':'fujian','43':'hunan','34':'anhui','61':'shaanxi','42':'hubei','36':'jiangxi'
};
function legacyProvinceKey(code) {
  return PROV_CODE_MAP[String(code)] || String(code);
}
app.get('/api/practice/questions', (req, res) => {
  try {
    const lessonFilter = parseInt(req.query.lesson_id, 10) || 0;
    let rows = db.query('SELECT * FROM questions ORDER BY id');
    if (lessonFilter) rows = rows.filter(function(r){ return Number(r.lesson_id) === lessonFilter; });
    if (!rows.length) {
      if (lessonFilter) return res.json({ ok: true, questions: [] });
      const qs = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'questions.json'), 'utf8'));
      return res.json({ ok: true, questions: qs });
    }
    res.json({
      ok: true,
      questions: rows.map(function(r){
        var opts = [];
        try { opts = JSON.parse(r.options || '[]'); } catch(e) {}
        return { id: r.id, subject: r.subject || '', content: r.content || '', options: opts, answer: r.answer || 0, explanation: r.explanation || '' };
      })
    });
  } catch (e) { res.json({ ok: false, questions: [] }); }
});
app.get('/api/schedule/:province', (req, res) => {
  try {
    const prov = db.get('SELECT schedule FROM provinces WHERE code = ?', [req.params.province]);
    if (prov && prov.schedule) {
      const arr = JSON.parse(prov.schedule || '[]');
      if (Array.isArray(arr) && arr.length > 0) return res.json(arr);
    }
  } catch(e) {}
  const file = path.join(__dirname, 'data', 'schedule.json');
  try {
    const all = JSON.parse(fs.readFileSync(file, 'utf8'));
    res.json(all[legacyProvinceKey(req.params.province)] || []);
  } catch {
    res.json([]);
  }
});

// ── Courses API ──
app.get('/api/live/courses', (req, res) => {
  try {
    const rows = db.query("SELECT ls.course_id, c.title FROM live_streams ls LEFT JOIN courses c ON ls.course_id=c.id WHERE ls.status='live' ORDER BY COALESCE(ls.started_at, ls.created_at) DESC");
    res.json({ live: rows });
  } catch (e) {
    res.json({ live: [] });
  }
});

app.get('/api/courses/:province', (req, res) => {
  const file = path.join(__dirname, 'data', 'courses.json');
  try {
    const all = JSON.parse(fs.readFileSync(file, 'utf8'));
    const prov = all[legacyProvinceKey(req.params.province)] || all.default || {};
    res.json({ public: prov.public || [], formal: prov.formal || [] });
  } catch {
    res.json({ public: [], formal: [] });
  }
});

app.get('/api/packages', (req, res) => {
  const packages = db.query(`SELECT p.*,
    pp.year as parent_year, pp.province as parent_province, pp.title as parent_title,
    (SELECT COUNT(*) FROM course_packages cp WHERE cp.parent_id = p.id) as child_count,
    (SELECT COUNT(*) FROM course_package_courses pc WHERE pc.package_id = p.id) as course_count
    FROM course_packages p LEFT JOIN course_packages pp ON pp.id = p.parent_id
    WHERE p.status = 'published' ORDER BY p.sort_order DESC, p.id DESC`);
  res.json({ packages });
});

app.post('/admin/api/courses/save', (req, res) => {
  if (!req.session.adminLoggedIn) return res.status(401).json({ error: '未登录' });
  try {
    const { province, courses } = req.body;
    const file = path.join(__dirname, 'data', 'courses.json');
    const all = JSON.parse(fs.readFileSync(file, 'utf8'));
    all[province] = courses;
    fs.writeFileSync(file, JSON.stringify(all, null, 2), 'utf8');
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── Admission Data API ──
app.get('/api/syllabus/:province', (req, res) => {
  const file = path.join(__dirname, 'data', 'syllabus.json');
  try {
    const all = JSON.parse(fs.readFileSync(file, 'utf8'));
    res.json(all[legacyProvinceKey(req.params.province)] || { year: '2026', subjects: [] });
  } catch {
    res.json({ year: '2026', subjects: [] });
  }
});

app.get('/api/admission/:province', (req, res) => {
  const file = path.join(__dirname, 'data', 'admission.json');
  try {
    const all = JSON.parse(fs.readFileSync(file, 'utf8'));
    res.json(all[legacyProvinceKey(req.params.province)] || all.default || { year: '2026', plan: [] });
  } catch {
    res.json({ year: '2026', plan: [] });
  }
});

// ── Error handler ──
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Server Error: ' + err.message);
});


// ── 新版直播协议：按课程房间管理（live-studio / live-watch） ──
const liveRooms = {}; // courseId -> { teacherSocketId, students: Map<socketId, {name, uid}> }

function emitLiveOnline(room) {
  if (!room || !room.teacherSocketId) return;
  const list = Array.from(room.students.values()).map(st => ({ name: st.name || '学生', uid: st.uid || '' }));
  io.to(room.teacherSocketId).emit('live:online', { count: list.length });
  io.to(room.teacherSocketId).emit('live:onlineList', { list });
}

// ═══════════════════════════════════════════
// Socket.IO — 互动课堂实时通信
// ═══════════════════════════════════════════

const liveSessions = {}; // sessionId -> { teacherSocketId, courseId, lessonId, currentSlide, currentTime, isPlaying, students: Set }

require('./middleware/live-security').installSocketGuard(io, db, sessionMiddleware, () => liveSessions);

io.on('connection', (socket) => {
  // ── 新版直播：老师/学生加入课程房间 ──
  socket.on('live:join', ({ courseId, role, name, uid }) => {
    const key = String(courseId);
    socket.join(`course:${key}`);
    if (!liveRooms[key]) liveRooms[key] = { teacherSocketId: null, students: new Map(), chats: [] };
    const room = liveRooms[key];
    room.chats.forEach(function(m) { socket.emit('live:chat', m); });
    if (role === 'teacher') {
      room.teacherSocketId = socket.id;
      emitLiveOnline(room);
    } else {
      const stuName = (name || '学生').toString().trim() || '学生';
      const stuUid = (uid || '').toString().trim();
      if (!room.students.has(socket.id)) {
        room.students.set(socket.id, { name: stuName, uid: stuUid });
        const sysMsg2 = { type: 'system', sender: '系统', content: `${stuName} 进入了课堂`, time: new Date().toISOString() };
        room.chats.push(sysMsg2); if (room.chats.length > 200) room.chats.splice(0, room.chats.length - 200);
        try { db.run('INSERT INTO live_chats (course_id, sender, content, type) VALUES (?,?,?,?)', [parseInt(key) || 0, sysMsg2.sender, sysMsg2.content, 'system']); } catch(e) {}
        io.to(`course:${key}`).emit('live:chat', sysMsg2);
      }
      emitLiveOnline(room);
    }
    console.log(`[Live2] ${role === 'teacher' ? '老师' : '学生'}进入课程 ${key}`);
  });

  // ── 新版直播：聊天消息 ──
  socket.on('live:start', ({ courseId }) => {
    const key = String(courseId);
    if (liveRooms[key]) liveRooms[key].chats = [];
  });

  socket.on('live:ended', ({ courseId }) => {
    const key = String(courseId);
    if (liveRooms[key]) liveRooms[key].chats = [];
    const endMsg = { type: 'system', sender: '系统', content: '老师已结束直播', time: new Date().toISOString() };
    try { db.run('INSERT INTO live_chats (course_id, sender, content, type) VALUES (?,?,?,?)', [parseInt(key) || 0, endMsg.sender, endMsg.content, 'system']); } catch(e) {}
    io.to(`course:${key}`).emit('live:chat', endMsg);
    io.to(`course:${key}`).emit('live:ended', { courseId: key, ts: Date.now() });
  });

  socket.on('live:chat', ({ courseId, sender, content }) => {
    const text = (content || '').toString().trim();
    if (!text) return;
    const key = String(courseId);
    const msg = {
      type: 'user', sender: (sender || '学生').toString().trim() || '学生', content: text,
      time: new Date().toISOString()
    };
    if (liveRooms[key]) {
      liveRooms[key].chats.push(msg);
      if (liveRooms[key].chats.length > 200) liveRooms[key].chats.splice(0, liveRooms[key].chats.length - 200);
    }
    try { db.run('INSERT INTO live_chats (course_id, sender, content, type) VALUES (?,?,?,?)', [parseInt(key) || 0, msg.sender, msg.content, msg.type || 'user']); } catch(e) {}
    io.to(`course:${key}`).emit('live:chat', msg);
  });

  // ── 老师加入课堂 ──
  socket.on('teacher:join', ({ sessionId, courseId, lessonId }) => {
    socket.join(`session:${sessionId}`);
    if (!liveSessions[sessionId]) {
      liveSessions[sessionId] = {
        teacherSocketId: socket.id, courseId, lessonId,
        currentSlide: 0, currentTime: 0, isPlaying: false,
        students: new Set()
      };
    } else {
      Object.assign(liveSessions[sessionId], { teacherSocketId: socket.id, courseId, lessonId });
    }
    socket.emit('teacher:ready', { sessionId });
    console.log(`[Live] 老师进入课堂 ${sessionId}`);
  });

  // ── 学生加入课堂 ──
  socket.on('student:join', ({ sessionId, studentName }) => {
    socket.join(`session:${sessionId}`);
    const s = liveSessions[sessionId];
    if (s) {
      s.students.add(socket.id);
      // 同步当前状态给新加入的学生
      socket.emit('sync:state', {
        lessonId: s.lessonId,
        currentSlide: s.currentSlide,
        currentTime: s.currentTime,
        isPlaying: s.isPlaying
      });
      // 通知老师
      io.to(s.teacherSocketId).emit('student:joined', { count: s.students.size, socketId: socket.id, studentName });
      // 课堂消息
      io.to(`session:${sessionId}`).emit('chat:message', {
        type: 'system', content: `${studentName} 进入了课堂`,
        time: new Date().toISOString()
      });
    }
    console.log(`[Live] 学生进入课堂 ${sessionId}`);
  });

  // ── 老师同步课件状态 ──
  socket.on('teacher:sync', ({ sessionId, currentSlide, currentTime, isPlaying }) => {
    const s = liveSessions[sessionId];
    if (s) {
      Object.assign(s, { currentSlide, currentTime, isPlaying });
      socket.to(`session:${sessionId}`).emit('sync:state', { currentSlide, currentTime, isPlaying });
    }
  });

  // ── 聊天消息 ──
  socket.on('chat:send', ({ sessionId, content, sender }) => {
    io.to(`session:${sessionId}`).emit('chat:message', {
      type: 'user', sender, content,
      time: new Date().toISOString()
    });
  });

  // ── 老师切换课时 ──
  socket.on('teacher:changeLesson', ({ sessionId, lessonId }) => {
    const s = liveSessions[sessionId];
    if (s) {
      Object.assign(s, { lessonId, currentSlide: 0, currentTime: 0, isPlaying: false });
      io.to(`session:${sessionId}`).emit('sync:lessonChange', { lessonId });
    }
  });

  // ── 学生举手 ──
  socket.on('student:handraise', ({ sessionId, studentName }) => {
    const s = liveSessions[sessionId];
    if (s) {
      io.to(s.teacherSocketId).emit('student:handraise', { studentName });
    }
  });

  // ── 结束直播 ──
  socket.on('teacher:endSession', ({ sessionId, courseId, lessonId, duration, slideTimeline, title }) => {
    // Update live session in database
    const db = require('./db');
    const live = db.get("SELECT id FROM live_sessions WHERE course_id = ? AND status = 'live' ORDER BY started_at DESC LIMIT 1", [courseId]);
    if (live) {
      db.run('UPDATE live_sessions SET status=?, ended_at=CURRENT_TIMESTAMP, slide_timeline=?, duration=? WHERE id=?',
        ['ended', slideTimeline || '[]', duration || 0, live.id]);
      // Create replay record
      db.run('INSERT INTO live_replays (session_id, course_id, title, duration, slide_timeline) VALUES (?, ?, ?, ?, ?)',
        [live.id, courseId, title || '直播回放', duration || 0, slideTimeline || '[]']);
      console.log('[Live] Session ended:', sessionId, '-> replay created');
    }
    // Notify students
    io.to('session:' + sessionId).emit('teacher:disconnected');
  });

  // ── WebRTC 信令 ──
  socket.on('webrtc:offer', ({ sessionId, socketId, offer }) => {
    io.to(socketId).emit('webrtc:offer', { offer });
  });
  socket.on('webrtc:answer', ({ sessionId, answer }) => {
    const s = liveSessions[sessionId];
    if (s) io.to(s.teacherSocketId).emit('webrtc:answer', { socketId: socket.id, answer });
  });
  socket.on('webrtc:student-ice', ({ sessionId, candidate }) => {
    const s = liveSessions[sessionId];
    if (s) io.to(s.teacherSocketId).emit('webrtc:student-ice', { socketId: socket.id, candidate });
  });
  socket.on('webrtc:teacher-ice', ({ sessionId, socketId, candidate }) => {
    io.to(socketId).emit('webrtc:teacher-ice', { candidate });
  });
  // Add student socketId to joined event
  const origStudentJoin = io.on.emit; // no-op
  // Already handled above by sending socketId in student:joined

  // ── 断开连接 ──
  socket.on('disconnect', () => {
    for (const room of Object.values(liveRooms)) {
      if (room.teacherSocketId === socket.id) room.teacherSocketId = null;
      if (room.students.delete(socket.id)) emitLiveOnline(room);
    }
    for (const [sessionId, s] of Object.entries(liveSessions)) {
      if (s.teacherSocketId === socket.id) {
        io.to(`session:${sessionId}`).emit('teacher:disconnected');
        console.log(`[Live] 老师离开课堂 ${sessionId}`);
        return;
      }
      if (s.students.has(socket.id)) {
        s.students.delete(socket.id);
        io.to(s.teacherSocketId).emit('student:left', { count: s.students.size });
      }
    }
  });
});

// ── Start ──
server.listen(PORT, "0.0.0.0", "0.0.0.0", () => {
  console.log(`承泽教育 server running at http://localhost:${PORT}`);
  console.log(`  → Student:    http://localhost:${PORT}/live/student`);
  console.log(`  → Admin:      http://localhost:${PORT}/admin`);
  console.log(`  → Login:      http://localhost:${PORT}/admin/login`);
});

module.exports = { app, server, io };

const express = require('express');
const router = express.Router();
const { requireTeacher } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db');

const avatarStorage = multer.diskStorage({
  destination: function(req, file, cb) {
    const dir = path.join(__dirname, '..', 'public', 'images', 'teachers');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function(req, file, cb) {
    cb(null, 't' + Date.now() + path.extname(file.originalname));
  }
});
const uploadAvatar = multer({ storage: avatarStorage, limits: { fileSize: 5 * 1024 * 1024 } }).single('avatar');

const TEACHER_SUBJECTS = ['英语','数学','语文','计算机','政治','管理学','教育学','医学','会计','经济学','法学','艺术','体育'];

function genStudentCode(prefix, digits, col) {
  let v = '';
  do {
    let n = '';
    for (let i = 0; i < digits; i++) n += Math.floor(Math.random() * 10);
    v = prefix + n;
  } while (db.get('SELECT id FROM students WHERE ' + col + '=?', [v]));
  return v;
}

function formatCnDate(v) {
  if (!v) return '';
  var p = String(v).split('-');
  if (p.length < 3) return '';
  return p[0] + '年' + parseInt(p[1]) + '月' + parseInt(p[2]) + '日';
}

function renderUserForm(res, req, mode, formData, error) {
  const courses = db.query('SELECT id, title FROM courses ORDER BY created_at DESC');
  res.render('teacher/user-form', {
    title: mode === 'student' ? '添加学员 · 管理后台' : '添加用户 · 管理后台',
    teacherName: req.session.teacherName,
    mode,
    courses,
    formData,
    error
  });
}

function getProvinceOptions() {
  const provs = db.query('SELECT * FROM provinces ORDER BY id');
  return provs.map(function(p) {
    const rows = db.query('SELECT standard, name FROM province_subjects WHERE province_id=? ORDER BY order_index, id', [p.id]);
    let examSchedule = [];
    try { examSchedule = JSON.parse(p.exam_schedule || '[]'); } catch(e) {}
    if (!Array.isArray(examSchedule)) examSchedule = [];
    const years = examSchedule.map(function(x) { return String(x.year || ''); }).filter(Boolean);
    const examTime = (examSchedule[0] && examSchedule[0].exam_time) ? examSchedule[0].exam_time : (p.exam_time || '');
    return {
      id: p.id,
      name: p.name,
      code: p.code,
      exam_time: examTime,
      years: years,
      examSchedule: examSchedule,
      subjects: rows.map(function(r) {
        return { standard: r.standard || '', name: r.name || r.standard || '', type: r.type || '' };
      })
    };
  });
}

function nextTeacherNo() {
  const rows = db.query("SELECT teacher_no FROM teachers WHERE teacher_no LIKE 'T%'");
  let max = 0;
  rows.forEach(function(r) {
    const m = /^T(\d+)$/.exec(String(r.teacher_no || '').trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return 'T' + String(max + 1).padStart(3, '0');
}

router.use(requireTeacher);
router.use('/users-manage', require('./user-course-grants')(db));

// ── Dashboard ──
router.get('/dashboard', (req, res) => {
  if (!req.adminAccount || req.adminAccount.role !== 'ceo') return res.status(403).send('控制台仅限超级账号访问');
  res.set('Cache-Control','private, no-store');
  res.render('teacher/dashboard', { title:'管理后台', teacherName:req.session.teacherName, dashboard:require('../lib/business-dashboard')(db,req.query.days) });
});

// Same server-side role check applies to every partial refresh request.
router.get('/dashboard/data', (req, res) => {
  if (!req.adminAccount || req.adminAccount.role !== 'ceo') return res.status(403).send('控制台仅限超级账号访问');
  res.set('Cache-Control','private, no-store');
  res.render('teacher/partials/business-overview', { dashboard:require('../lib/business-dashboard')(db,req.query.days) });
});

// ── 排课总览 ──
router.get('/schedule', requireTeacher, (req, res) => {
  const courses = db.query(`SELECT c.*, t.real_name as teacher_name,
    (SELECT COUNT(*) FROM lessons WHERE course_id=c.id) as lesson_count,
    (SELECT COUNT(*) FROM lessons WHERE course_id=c.id AND schedule_time IS NOT NULL AND schedule_time != '') as scheduled_count,
    (SELECT package_id FROM course_package_courses WHERE course_id=c.id ORDER BY id LIMIT 1) as first_package_id,
    (SELECT GROUP_CONCAT(p.title, '；') FROM course_package_courses pc JOIN course_packages p ON p.id=pc.package_id WHERE pc.course_id=c.id) as package_titles
    FROM courses c LEFT JOIN teachers t ON c.teacher_id=t.id ORDER BY c.created_at DESC`);
  const total = courses.length;
  const scheduled = courses.filter(function(c){ return (parseInt(c.scheduled_count)||0)>0; }).length;
  const pending = total - scheduled;
  res.render('teacher/schedule-overview', {
    title: '排课总览',
    teacherName: req.session.teacherName,
    courses,
    total,
    scheduled,
    pending
  });
});

// ── API: 排课课程包树 ──
router.get('/api/schedule-packages', requireTeacher, (req, res) => {
  const level1 = db.query('SELECT id, title, year, province, status FROM course_packages WHERE (parent_id IS NULL OR parent_id=0) ORDER BY sort_order ASC, id');
  const packages = level1.map(function(p) {
    const children = db.query('SELECT id, title, year, province, status FROM course_packages WHERE parent_id=? ORDER BY sort_order ASC, id', [p.id]);
    return {
      id: p.id,
      title: p.title,
      year: p.year,
      province: p.province,
      status: p.status,
      children: children.map(function(c) {
        const courses = db.query(`SELECT c.id, c.title, c.category, c.status,
          (SELECT COUNT(*) FROM lessons l WHERE l.course_id=c.id) as lesson_count,
          (SELECT COUNT(*) FROM lessons l WHERE l.course_id=c.id AND l.schedule_time IS NOT NULL AND l.schedule_time != '') as scheduled_count
          FROM courses c JOIN course_package_courses pc ON pc.course_id=c.id
          WHERE pc.package_id=? ORDER BY c.title`, [c.id]);
        return {
          id: c.id,
          title: c.title,
          year: c.year,
          province: c.province,
          status: c.status,
          courses: courses.map(function(x) {
            return {
              id: x.id,
              title: x.title,
              category: x.category || x.title,
              status: x.status,
              lessonCount: parseInt(x.lesson_count) || 0,
              scheduledCount: parseInt(x.scheduled_count) || 0
            };
          })
        };
      })
    };
  });
  res.json({ ok: true, packages });
});

// ── 师资管理 (Staff Management) ──
router.get('/teachers-manage', (req, res) => {
  const q = (req.query.q || '').trim();
  let sql = `SELECT t.*, (SELECT COUNT(*) FROM courses WHERE teacher_id=t.id) as course_count 
    FROM teachers t`;
  let params = [];
  if (q) {
    sql += ` WHERE (t.display_name LIKE ? OR t.username LIKE ? OR t.real_name LIKE ? OR t.phone LIKE ? OR t.subject LIKE ? OR t.province LIKE ?)`;
    params = Array(6).fill('%'+q+'%');
  }
  sql += ` ORDER BY t.created_at`;
  const staff = db.query(sql, params);
  const totalCourses = db.get('SELECT COUNT(*) as c FROM courses').c;
  const totalHours = staff.reduce((sum, s) => sum + (s.total_hours || 0), 0);

  res.render('teacher/staff', {
    title: '师资管理 · 管理后台',
    teacherName: req.session.teacherName,
    staff,
    q,
    totalTeachers: staff.length,
    totalCourses: totalCourses,
    totalHours: totalHours
  });
});

router.get('/api/teachers-manage', requireTeacher, (req, res) => {
  const q = (req.query.q || '').trim();
  let sql = `SELECT t.*, (SELECT COUNT(*) FROM courses WHERE teacher_id=t.id) as course_count 
    FROM teachers t`;
  let params = [];
  if (q) {
    sql += ` WHERE (t.display_name LIKE ? OR t.username LIKE ? OR t.real_name LIKE ? OR t.phone LIKE ? OR t.subject LIKE ? OR t.province LIKE ?)`;
    params = Array(6).fill('%'+q+'%');
  }
  sql += ` ORDER BY t.created_at`;
  const staff = db.query(sql, params);
  res.json({ rows: staff, total: staff.length });
});

// ── 师资新增/编辑 ──
router.get('/teachers-manage/new', requireTeacher, (req, res) => {
  res.locals.nextTeacherNo = nextTeacherNo();
  res.render('teacher/staff-form', { title: '添加教师 · 管理后台', teacherName: req.session.teacherName, staff: null, formData: null, subjects: TEACHER_SUBJECTS, error: null });
});

router.post('/teachers-manage/new', requireTeacher, uploadAvatar, (req, res) => {
  res.locals.nextTeacherNo = nextTeacherNo();
  let hireDate = (req.body.hire_date || '').trim();
  if (!hireDate) {
    const nd = new Date();
    hireDate = nd.getFullYear() + '-' + String(nd.getMonth() + 1).padStart(2, '0') + '-' + String(nd.getDate()).padStart(2, '0');
  }
  let username = (req.body.username || '').trim();
  if (!username) {
    do {
      username = 't' + Math.floor(100000 + Math.random() * 900000);
    } while (db.get('SELECT id FROM teachers WHERE username=?', [username]));
  }
  const formData = {
    username: username,
    teacher_no: (req.body.teacher_no || '').trim() || nextTeacherNo(),
    display_name: (req.body.display_name || '').trim() || (req.body.real_name || '').trim() || username,
    real_name: (req.body.real_name || '').trim(),
    phone: (req.body.phone || '').trim(),
    subject: req.body.subject || '',
    province: req.body.province || '',
    office_location: (req.body.office_location || '').trim(),
    hire_date: hireDate,
    total_hours: req.body.total_hours || '',
    bio: req.body.bio || '',
    avatar: req.file ? '/public/images/teachers/' + req.file.filename : '',
    status: req.body.status || 'active'
  };
  const { password } = req.body;
  if (!password) {
    return res.render('teacher/staff-form', { title: '添加教师 · 管理后台', teacherName: req.session.teacherName, staff: null, formData, subjects: TEACHER_SUBJECTS, error: '密码不能为空' });
  }
  if (!/^T\d{3}$/.test(formData.teacher_no)) {
    return res.render('teacher/staff-form', { title: '添加教师 · 管理后台', teacherName: req.session.teacherName, staff: null, formData, subjects: TEACHER_SUBJECTS, error: '教师编号格式如 T001' });
  }
  if (String(password).length < 6) {
    return res.render('teacher/staff-form', { title: '添加教师 · 管理后台', teacherName: req.session.teacherName, staff: null, formData, subjects: TEACHER_SUBJECTS, error: '密码至少 6 位' });
  }
  if (formData.phone && !/^1[3-9]\d{9}$/.test(formData.phone)) {
    return res.render('teacher/staff-form', { title: '添加教师 · 管理后台', teacherName: req.session.teacherName, staff: null, formData, subjects: TEACHER_SUBJECTS, error: '手机号格式不正确' });
  }
  if (req.body.hire_date && !formData.hire_date) {
    return res.render('teacher/staff-form', { title: '添加教师 · 管理后台', teacherName: req.session.teacherName, staff: null, formData, subjects: TEACHER_SUBJECTS, error: '请完整选择入职日期' });
  }
  const exist = db.get('SELECT id FROM teachers WHERE username=?', [formData.username]);
  if (exist) {
    return res.render('teacher/staff-form', { title: '添加教师 · 管理后台', teacherName: req.session.teacherName, staff: null, formData, subjects: TEACHER_SUBJECTS, error: '用户名已存在' });
  }
  const noExist = db.get('SELECT id FROM teachers WHERE teacher_no=?', [formData.teacher_no]);
  if (noExist) {
    return res.render('teacher/staff-form', { title: '添加教师 · 管理后台', teacherName: req.session.teacherName, staff: null, formData, subjects: TEACHER_SUBJECTS, error: '教师编号已存在' });
  }
  const hash = bcrypt.hashSync(password, 10);
  db.run('INSERT INTO teachers (username, teacher_no, password_hash, display_name, real_name, phone, subject, province, office_location, hire_date, total_hours, bio, avatar, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [formData.username, formData.teacher_no, hash, formData.display_name, formData.real_name, formData.phone, formData.subject, formData.province, formData.office_location, formData.hire_date, parseFloat(formData.total_hours)||0, formData.bio, formData.avatar, formData.status]);
  res.redirect('/admin/teachers-manage');
});

router.get('/teachers-manage/:id', requireTeacher, (req, res) => {
  const staff = db.get(`SELECT t.*, (SELECT COUNT(*) FROM courses WHERE teacher_id=t.id) as course_count FROM teachers t WHERE t.id=?`, [req.params.id]);
  if (!staff) return res.redirect('/admin/teachers-manage');
  res.render('teacher/staff-detail', {
    title: '教师详情 · 管理后台',
    teacherName: req.session.teacherName,
    staff
  });
});

router.post('/teachers-manage/:id/delete', requireTeacher, (req, res) => {
  const staff = db.get('SELECT id FROM teachers WHERE id=?', [req.params.id]);
  if (!staff) return res.redirect('/admin/teachers-manage');
  db.run('UPDATE courses SET teacher_id=0 WHERE teacher_id=?', [req.params.id]);
  db.run('DELETE FROM teachers WHERE id=?', [req.params.id]);
  res.redirect('/admin/teachers-manage');
});

router.get('/teachers-manage/edit/:id', requireTeacher, (req, res) => {
  const staff = db.get('SELECT * FROM teachers WHERE id=?', [req.params.id]);
  if (!staff) return res.redirect('/admin/teachers-manage');
  res.render('teacher/staff-form', { title: '编辑教师 · 管理后台', teacherName: req.session.teacherName, staff, formData: null, subjects: TEACHER_SUBJECTS, error: null });
});

router.post('/teachers-manage/:id', requireTeacher, uploadAvatar, (req, res) => {
  const staff = db.get('SELECT * FROM teachers WHERE id=?', [req.params.id]);
  if (!staff) return res.redirect('/admin/teachers-manage');
  const formData = {
    username: (req.body.username || '').trim() || staff.username,
    teacher_no: (req.body.teacher_no || '').trim() || staff.teacher_no,
    display_name: (req.body.display_name || '').trim() || staff.display_name,
    real_name: (req.body.real_name || '').trim(),
    phone: (req.body.phone || '').trim(),
    subject: req.body.subject || '',
    province: req.body.province || '',
    office_location: (req.body.office_location || '').trim(),
    hire_date: (req.body.hire_date || '').trim(),
    total_hours: req.body.total_hours || '',
    bio: req.body.bio || '',
    avatar: req.file ? '/public/images/teachers/' + req.file.filename : (staff.avatar || ''),
    status: req.body.status || 'active'
  };
  const { password } = req.body;
  const unameExist = db.get('SELECT id FROM teachers WHERE username=? AND id<>?', [formData.username, req.params.id]);
  if (!formData.username || unameExist) {
    return res.render('teacher/staff-form', { title: '编辑教师 · 管理后台', teacherName: req.session.teacherName, staff, formData, subjects: TEACHER_SUBJECTS, error: unameExist ? '登录账号已存在' : '登录账号不能为空' });
  }
  if (password) {
    if (String(password).length < 6) {
      return res.render('teacher/staff-form', { title: '编辑教师 · 管理后台', teacherName: req.session.teacherName, staff, formData, subjects: TEACHER_SUBJECTS, error: '新密码至少 6 位' });
    }
  }
  if (formData.phone && !/^1[3-9]\d{9}$/.test(formData.phone)) {
    return res.render('teacher/staff-form', { title: '编辑教师 · 管理后台', teacherName: req.session.teacherName, staff, formData, subjects: TEACHER_SUBJECTS, error: '手机号格式不正确' });
  }
  if (!/^T\d{3}$/.test(formData.teacher_no)) {
    return res.render('teacher/staff-form', { title: '编辑教师 · 管理后台', teacherName: req.session.teacherName, staff, formData, subjects: TEACHER_SUBJECTS, error: '教师编号格式如 T001' });
  }
  const noExist = db.get('SELECT id FROM teachers WHERE teacher_no=? AND id<>?', [formData.teacher_no, req.params.id]);
  if (noExist) {
    return res.render('teacher/staff-form', { title: '编辑教师 · 管理后台', teacherName: req.session.teacherName, staff, formData, subjects: TEACHER_SUBJECTS, error: '教师编号已存在' });
  }
  if (req.body.hire_date && !formData.hire_date) {
    return res.render('teacher/staff-form', { title: '编辑教师 · 管理后台', teacherName: req.session.teacherName, staff, formData, subjects: TEACHER_SUBJECTS, error: '请完整选择入职日期' });
  }
  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    db.run('UPDATE teachers SET password_hash=?, username=?, teacher_no=?, display_name=?, real_name=?, phone=?, subject=?, province=?, office_location=?, hire_date=?, total_hours=?, bio=?, avatar=?, status=? WHERE id=?',
      [hash, formData.username, formData.teacher_no, formData.display_name, formData.real_name, formData.phone, formData.subject, formData.province, formData.office_location, formData.hire_date, parseFloat(formData.total_hours)||0, formData.bio, formData.avatar, formData.status, req.params.id]);
  } else {
    db.run('UPDATE teachers SET username=?, teacher_no=?, display_name=?, real_name=?, phone=?, subject=?, province=?, office_location=?, hire_date=?, total_hours=?, bio=?, avatar=?, status=? WHERE id=?',
      [formData.username, formData.teacher_no, formData.display_name, formData.real_name, formData.phone, formData.subject, formData.province, formData.office_location, formData.hire_date, parseFloat(formData.total_hours)||0, formData.bio, formData.avatar, formData.status, req.params.id]);
  }
  res.redirect('/admin/teachers-manage');
});

// ── 教师启用/停用 ──
router.post('/teachers-manage/:id/toggle', requireTeacher, (req, res) => {
  const staff = db.get('SELECT * FROM teachers WHERE id=?', [req.params.id]);
  if (!staff || staff.username === 'admin') return res.redirect('/admin/teachers-manage');
  const next = staff.status === 'disabled' ? 'active' : 'disabled';
  db.run('UPDATE teachers SET status=? WHERE id=?', [next, staff.id]);
  res.redirect('/admin/teachers-manage');
});
// ── Course Management ──
router.get('/courses-manage', requireTeacher, (req, res) => {
  const q = (req.query.q || '').trim();
  const statusFilter = req.query.status || '';
  let sql, params;
  if (q && statusFilter) {
    sql = `SELECT c.*, t.real_name as teacher_name,
      (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) as lesson_count 
      FROM courses c LEFT JOIN teachers t ON c.teacher_id = t.id
      WHERE (c.title LIKE ? OR c.description LIKE ? OR t.real_name LIKE ? OR c.year LIKE ? OR c.province LIKE ? OR c.class_type LIKE ?) AND c.status = ?
      ORDER BY c.created_at DESC`;
    params = [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, statusFilter];
  } else if (q) {
    sql = `SELECT c.*, t.real_name as teacher_name,
      (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) as lesson_count 
      FROM courses c LEFT JOIN teachers t ON c.teacher_id = t.id
      WHERE c.title LIKE ? OR c.description LIKE ? OR t.real_name LIKE ? OR c.year LIKE ? OR c.province LIKE ? OR c.class_type LIKE ?
      ORDER BY c.created_at DESC`;
    params = [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`];
  } else if (statusFilter) {
    sql = `SELECT c.*, t.real_name as teacher_name,
      (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) as lesson_count 
      FROM courses c LEFT JOIN teachers t ON c.teacher_id = t.id
      WHERE c.status = ? ORDER BY c.created_at DESC`;
    params = [statusFilter];
  } else {
    sql = `SELECT c.*, t.real_name as teacher_name,
      (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) as lesson_count 
      FROM courses c LEFT JOIN teachers t ON c.teacher_id = t.id
      ORDER BY c.created_at DESC`;
    params = [];
  }
  const courses = db.query(sql, params);
  let packages = db.query("SELECT p.*, (SELECT COUNT(*) FROM course_packages cp WHERE cp.parent_id=p.id) as child_count, (SELECT COUNT(*) FROM course_package_courses pc WHERE pc.package_id=p.id) as course_count, (SELECT title FROM course_packages pp WHERE pp.id=p.parent_id) as parent_title FROM course_packages p ORDER BY p.parent_id, p.title ASC");
  packages = packages.map(function(p){ var actual=0; try { actual = db.get('SELECT COUNT(*) as c FROM package_enrollments WHERE package_id=?', [p.id]).c || 0; } catch(e) {} p.actual_student_count = actual; return p; });
  const provinceOptions = getProvinceOptions();
  const teachers = db.query('SELECT id, real_name, subject FROM teachers ORDER BY real_name');
  const pendingCourses = db.query("SELECT c.*, (SELECT COUNT(*) FROM lessons l WHERE l.course_id=c.id) as lesson_count FROM courses c WHERE (SELECT COUNT(*) FROM lessons l WHERE l.course_id=c.id)=0 ORDER BY c.created_at DESC");
  const totalCourses = db.get('SELECT COUNT(*) as c FROM courses').c;
  const publishedCourses = db.get("SELECT COUNT(*) as c FROM courses WHERE status='published'").c;
  const draftCourses = db.get("SELECT COUNT(*) as c FROM courses WHERE status='draft'").c;
  
  res.render('teacher/courses', {
    title: '课程管理 · 管理后台',
    teacherName: req.session.teacherName,
    q,
    statusFilter,
    courses,
    packages,
    provinceOptions,
    teachers,
    pendingCourses,
    totalCourses,
    publishedCourses,
    draftCourses
  });
});

router.get('/courses-manage/new-package', requireTeacher, (req, res) => {
  let packages = db.query(`SELECT p.*,
    (SELECT COUNT(*) FROM course_packages cp WHERE cp.parent_id = p.id) as child_count,
    (SELECT COUNT(*) FROM course_package_courses pc WHERE pc.package_id = p.id) as course_count,
    (SELECT title FROM course_packages pp WHERE pp.id = p.parent_id) as parent_title
    FROM course_packages p ORDER BY p.parent_id, p.created_at DESC`);
  packages = packages.map(function(p){ var actual=0; try { actual = db.get('SELECT COUNT(*) as c FROM package_enrollments WHERE package_id=?', [p.id]).c || 0; } catch(e) {} p.actual_student_count = actual; return p; });
  const provinceOptions = getProvinceOptions();
  const teachers = db.query('SELECT id, real_name, subject FROM teachers ORDER BY real_name');
  res.render('teacher/course-package-step', {
    title: '新建课程 · 选择课程包',
    teacherName: req.session.teacherName,
    packages,
    provinceOptions,
    teachers
  });
});

router.get('/courses-manage/new', (req, res) => {
  if (!req.query.package_id || String(req.query.package_id)==='0') return res.redirect('/admin/courses-manage/new-package');
  const teachers = db.query('SELECT id, real_name, subject FROM teachers ORDER BY real_name');
  const packages = db.query('SELECT id, title, parent_id, year, province, class_type, exam_type FROM course_packages ORDER BY parent_id, created_at DESC');
  const preselectedPackage = req.query.package_id || null;
  const coursePackageIds = [];
  const provinceOptions = getProvinceOptions();
  res.render('teacher/course-series', {
    title: '新建课程 · 管理后台',
    teacherName: req.session.teacherName,
    course: { package_id: preselectedPackage },
    teachers, packages, provinceOptions,
    coursePackageIds,
    modal: String(req.query.modal || '') === '1',
    stageData: [],
    error: null
  });
});

router.post('/courses-manage', (req, res) => {
  const { title, description, category, exam_type, status, teacher_id, year, province, class_type, course_type, package_id, teaching_mode, price, sale_price } = req.body;

  if (!title) {
    return res.redirect('/admin/courses-manage/new');
  }
  if (!package_id || parseInt(package_id)===0) {
    return res.redirect('/admin/courses-manage/new-package');
  }

    const fallbackTeacher = db.get('SELECT id FROM teachers ORDER BY id LIMIT 1');
    const assignTeacherId = teacher_id || req.session.teacherId || (fallbackTeacher && fallbackTeacher.id) || 1;
  const courseId = db.run('INSERT INTO courses (teacher_id, title, description, category, exam_type, status, year, province, class_type, course_type, package_id, start_date, valid_until, teaching_mode, price, sale_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [assignTeacherId, title, description || '', category || '', exam_type || '专升本', status || 'archived', year || '', province || '', class_type || '', course_type || 'class', package_id || 0, formatCnDate(req.body.start_date), formatCnDate(req.body.end_date), req.body.teaching_mode || '', req.body.price || '', req.body.sale_price || '']);
  if (courseId) {
    const pkgIdList = [];
    if (req.body.package_ids) {
      String(req.body.package_ids).split(',').forEach(function(pid) {
        const n = parseInt(pid) || 0;
        if (n > 0 && pkgIdList.indexOf(n) < 0) pkgIdList.push(n);
      });
    }
    const primaryPkgId = parseInt(package_id) || 0;
    if (primaryPkgId > 0 && pkgIdList.indexOf(primaryPkgId) < 0) pkgIdList.push(primaryPkgId);
    pkgIdList.forEach(function(pid) {
      db.run('INSERT OR IGNORE INTO course_package_courses (package_id, course_id) VALUES (?,?)', [pid, courseId]);
    });
    if (pkgIdList.length > 0) {
      db.run('UPDATE courses SET package_id=? WHERE id=?', [pkgIdList[0], courseId]);
    }
  }

  // Save multiple subjects
  // Save subjects from JSON
  let subjectsData = [];
  try { subjectsData = JSON.parse(req.body.subjects_json || '[]'); } catch {}
  if (subjectsData.length > 0 && courseId) {
    subjectsData.forEach(function(s, idx) {
      if (s.subject) {
        var tid = s.teacher ? parseInt(s.teacher) : null;
        db.run('INSERT INTO course_subjects (course_id, subject, teacher_id, order_index) VALUES (?,?,?,?)',
          [courseId, s.subject, tid, idx]);
      }
    });
  }
  if (courseId && !req.body.teacher_id) {
    const firstTeacher = db.get('SELECT teacher_id FROM course_subjects WHERE course_id=? AND teacher_id IS NOT NULL ORDER BY order_index LIMIT 1', [courseId]);
    if (firstTeacher && firstTeacher.teacher_id) {
      db.run('UPDATE courses SET teacher_id=? WHERE id=?', [firstTeacher.teacher_id, courseId]);
    }
  }

  // Generate lessons from stage data
  var stages = [];
  var idx = 0;
  while (req.body['sn_' + idx] !== undefined) {
    stages.push({
      name: req.body['sn_' + idx],
      count: parseInt(req.body['sc_' + idx]) || 0,
      duration: (parseInt(req.body['sd_' + idx]) || 120) * 60,
      start: req.body['sd_start_' + idx] || '',
      end: req.body['sd_end_' + idx] || '',
      rule: req.body['rule_' + idx] || '',
      time: req.body['time_' + idx] || ''
    });
    idx++;
  }
  if (stages.length > 0 && courseId) {
    const existingLessons = db.query('SELECT * FROM lessons WHERE course_id = ? ORDER BY order_index ASC', [courseId]);
    var order = 1;
    for (var s = 0; s < stages.length; s++) {
      var stage = stages[s];
      for (var l = 1; l <= stage.count; l++) {
        var lessonName = (stage.name || '') + '-第' + l + '讲';
        var oldLesson = existingLessons[order - 1] || null;
        if (oldLesson) {
          db.run('UPDATE lessons SET title=?, duration=?, order_index=?, stage=?, stage_start_date=?, stage_end_date=?, stage_rule=?, stage_time=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
            [lessonName.trim(), stage.duration, order, stage.name, stage.start, stage.end, stage.rule, stage.time, oldLesson.id]);
        } else {
          db.run('INSERT INTO lessons (course_id, title, duration, order_index, stage, stage_start_date, stage_end_date, stage_rule, stage_time) VALUES (?,?,?,?,?,?,?,?,?)',
            [courseId, lessonName.trim(), stage.duration, order, stage.name, stage.start, stage.end, stage.rule, stage.time]);
        }
        order++;
      }
    }
    if (existingLessons.length > order - 1) {
      for (var e = order - 1; e < existingLessons.length; e++) {
        const refs = db.get('SELECT COUNT(*) as c FROM live_replays WHERE lesson_id=?', [existingLessons[e].id]).c +
                     db.get('SELECT COUNT(*) as c FROM course_progress WHERE lesson_id=?', [existingLessons[e].id]).c;
        if (!refs) db.run('DELETE FROM lessons WHERE id=?', [existingLessons[e].id]);
      }
    }
  }

  // If first lesson provided, create it
  const lessonTitle = req.body.lesson_title;
  if (lessonTitle && courseId) {
    const minutes = parseInt(req.body.lesson_duration) || 0;
    const dur = minutes * 60;
    db.run('INSERT INTO lessons (course_id, title, duration, order_index) VALUES (?, ?, ?, ?)',
      [courseId, lessonTitle, dur, 1]);
  }

  res.redirect('/admin/courses-manage');
});

router.get('/courses-manage/:id', (req, res) => {
  const course = db.get('SELECT c.*, t.real_name as teacher_name FROM courses c LEFT JOIN teachers t ON c.teacher_id = t.id WHERE c.id = ?', [req.params.id]);
  if (!course) return res.redirect('/admin/courses-manage');
  const lessons = db.query('SELECT * FROM lessons WHERE course_id = ? ORDER BY order_index ASC', [course.id]);
  const teachers = db.query('SELECT id, real_name, subject FROM teachers ORDER BY real_name');
  const packages = db.query('SELECT id, title, parent_id, year, province, class_type, exam_type FROM course_packages ORDER BY parent_id, created_at DESC');
  const subjectRows = db.query('SELECT cs.*, t.real_name as teacher_name FROM course_subjects cs LEFT JOIN teachers t ON t.id=cs.teacher_id WHERE cs.course_id=? ORDER BY cs.order_index, cs.id', [course.id]);
  const pkg = course.package_id ? db.get('SELECT title FROM course_packages WHERE id=?', [course.package_id]) : null;
  const provinceOptions = getProvinceOptions();
  res.render('teacher/course-detail', {
    title: `${course.title} · 管理后台`,
    teacherName: req.session.teacherName,
    course,
    lessons,
    packages,
    subjectRows,
    packageTitle: pkg ? pkg.title : '',
    provinceOptions,
    error: null
  });
});

router.post('/courses-manage/:id/toggle-status', requireTeacher, (req, res) => {
  const course = db.get('SELECT * FROM courses WHERE id = ?', [req.params.id]);
  if (!course) return res.redirect('/admin/courses-manage');
  const next = course.status === 'published' ? 'archived' : 'published';
  db.run('UPDATE courses SET status=? WHERE id=?', [next, course.id]);
  res.redirect(req.get('Referer') || '/admin/courses-manage');
});

router.post('/courses-manage/:id', (req, res) => {
  const course = db.get('SELECT * FROM courses WHERE id = ?', [req.params.id]);
  if (!course) return res.redirect('/admin/courses-manage');
  const packages = db.query('SELECT id, title, parent_id, year, province, class_type, exam_type FROM course_packages ORDER BY parent_id, created_at DESC');

  const { title, description, category, exam_type, status, teacher_id, year, province, class_type, course_type, package_id } = req.body;
  
  if (!title) {
    const lessons = db.query('SELECT * FROM lessons WHERE course_id = ? ORDER BY order_index ASC', [course.id]);
    const teachers = db.query('SELECT id, real_name, subject FROM teachers ORDER BY real_name');
    return res.render('teacher/course-detail', {
      title: `${course.title} · 管理后台`,
      teacherName: req.session.teacherName,
      course, lessons, teachers,
      error: '课程标题不能为空'
    });
  }

  db.run('UPDATE courses SET title=?, description=?, category=?, exam_type=?, status=?, teacher_id=?, year=?, province=?, class_type=?, course_type=?, package_id=?, teaching_mode=?, price=?, sale_price=?, start_date=?, valid_until=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [title, description || '', category || '', exam_type || course.exam_type || '专升本', status || course.status, teacher_id || course.teacher_id, year || '', province || '', class_type || '', course_type || 'class', package_id || 0, teaching_mode || '', price || '', sale_price || '', formatCnDate(req.body.start_date), formatCnDate(req.body.end_date), course.id]);

  res.redirect('/admin/courses-manage/' + course.id);
});

router.post('/courses-manage/:id/delete', (req, res) => {
  db.run('DELETE FROM lessons WHERE course_id = ?', [req.params.id]);
  db.run('DELETE FROM courses WHERE id = ?', [req.params.id]);
  res.redirect('/admin/courses-manage');
});

// ── Lesson Management ──
router.post('/courses-manage/:id/lessons', (req, res) => {
  const teacherId = req.session.teacherId;
  const course = db.get('SELECT * FROM courses WHERE id = ?', [req.params.id]);
  if (!course) return res.redirect('/admin/courses-manage');
  const packages = db.query('SELECT id, title, parent_id FROM course_packages ORDER BY parent_id, created_at DESC');

  const { title, description, duration, slides_data } = req.body;
  
  if (!title) {
    const lessons = db.query('SELECT * FROM lessons WHERE course_id = ? ORDER BY order_index ASC', [course.id]);
    return res.render('teacher/course-detail', {
      title: `${course.title} · 管理后台`,
      teacherName: req.session.teacherName,
      course, lessons,
      error: '课时标题不能为空'
    });
  }

  const maxOrder = db.get('SELECT COALESCE(MAX(order_index), 0) as mx FROM lessons WHERE course_id = ?', [course.id]);
  const nextOrder = maxOrder.mx + 1;
  const slides = slides_data || '[]';

  db.run('INSERT INTO lessons (course_id, title, description, duration, order_index, slides_data) VALUES (?, ?, ?, ?, ?, ?)',
    [course.id, title, description || '', parseInt(duration) || 0, nextOrder, slides]);

  res.redirect('/admin/courses-manage/' + course.id);
});

router.post('/lessons/:id/delete', (req, res) => {
  const lesson = db.get('SELECT l.* FROM lessons l JOIN courses c ON l.course_id = c.id WHERE l.id = ?',
    [req.params.id]);
  if (!lesson) return res.redirect('/admin/courses-manage');

  db.run('DELETE FROM lessons WHERE id = ?', [lesson.id]);
  res.redirect('/admin/courses-manage/' + lesson.course_id);
});

// ── Teaching Room ──
router.get('/teaching/:courseId', (req, res) => {
  const teacherId = req.session.teacherId;
  const course = db.get('SELECT * FROM courses WHERE id = ?', [req.params.courseId]);
  if (!course) return res.redirect('/admin/courses-manage');

  const lessons = db.query('SELECT * FROM lessons WHERE course_id = ? ORDER BY order_index ASC', [course.id]);

  res.render('teacher/teaching-room', {
    title: `${course.title} · 授课中`,
    teacherName: req.session.teacherName,
    course,
    lessons
  });
});

// ── 学员管理 (Students) ──
router.get('/students-manage', (req, res) => {
  const q = (req.query.q || '').trim();
  const sdate = req.query.sdate || '';
  const edate = req.query.edate || '';
  const page = parseInt(req.query.page) || 1;
  const perPage = 10;
  const offset = (page - 1) * perPage;

  let conds = [];
  let params = [];
  let countParams = [];
  if (q) {
    conds.push('(s.name LIKE ? OR s.phone LIKE ? OR s.email LIKE ?)');
    params.push('%'+q+'%', '%'+q+'%', '%'+q+'%');
    countParams.push('%'+q+'%', '%'+q+'%', '%'+q+'%');
  }
  if (sdate) {
    conds.push('date(s.created_at) >= ?');
    params.push(sdate);
    countParams.push(sdate);
  }
  if (edate) {
    conds.push('date(s.created_at) <= ?');
    params.push(edate);
    countParams.push(edate);
  }
  const where = conds.length ? ` WHERE ${conds.join(' AND ')}` : '';
  let sql = `
    SELECT DISTINCT s.id, s.uid, s.name, s.phone, s.email, s.created_at, s.exam_year,
      (SELECT c2.province FROM enrollments e2 JOIN courses c2 ON e2.course_id=c2.id WHERE e2.student_id=s.id ORDER BY e2.id DESC LIMIT 1) as exam_province,
      (SELECT GROUP_CONCAT(c3.title, '；') FROM enrollments e3 JOIN courses c3 ON e3.course_id=c3.id WHERE e3.student_id=s.id) as ordered_courses,
      (SELECT MAX(o.created_at) FROM orders o WHERE o.student_id=s.id) as order_time,
      (SELECT COUNT(*) FROM enrollments e4 WHERE e4.student_id=s.id) as course_count,
      (SELECT COUNT(*) FROM course_progress cp JOIN lessons l ON cp.lesson_id=l.id WHERE cp.student_id=s.id AND cp.completed=1) as completed_lessons
    FROM students s
    LEFT JOIN enrollments e ON s.id = e.student_id
    LEFT JOIN courses c ON e.course_id = c.id
    ${where}`;
  let countSql = `SELECT COUNT(DISTINCT s.id) as c FROM students s LEFT JOIN enrollments e ON s.id=e.student_id LEFT JOIN courses c ON e.course_id=c.id${where}`;
  sql += ` ORDER BY s.created_at DESC LIMIT ? OFFSET ?`;
  params.push(perPage, offset);
  const students = db.query(sql, params);
  const studentTotal = db.get(countSql, countParams).c;
  const totalEnrollments = db.get('SELECT COUNT(*) as c FROM enrollments').c;
  const totalCompleted = db.get("SELECT COUNT(*) as c FROM course_progress WHERE completed=1").c;

  res.render('teacher/students', {
    title: '学员列表 · 管理后台',
    teacherName: req.session.teacherName,
    students,
    q,
    sdate,
    edate,
    page,
    perPage,
    studentTotal,
    totalEnrollments,
    totalCompleted,
    studentPages: Math.ceil(studentTotal / perPage)
  });
});

// ── 注册管理 (Registrations) ──
router.get('/users-manage', (req, res) => {
  const rq = (req.query.rq || '').trim();
  const rsdate = req.query.rsdate || '';
  const redate = req.query.redate || '';
  const page = parseInt(req.query.page) || 1;
  const perPage = 10;
  const offset = (page - 1) * perPage;

  let regConds = [];
  let regParams = [];
  if (rq) {
    regConds.push(`(s.name LIKE ? OR s.phone LIKE ? OR s.email LIKE ?)`);
    regParams.push('%'+rq+'%', '%'+rq+'%', '%'+rq+'%');
  }
  if (rsdate) {
    regConds.push(`date(s.created_at) >= ?`);
    regParams.push(rsdate);
  }
  if (redate) {
    regConds.push(`date(s.created_at) <= ?`);
    regParams.push(redate);
  }
  const regWhere = regConds.length ? ` WHERE ${regConds.join(' AND ')}` : '';
  let regSql = `SELECT s.id, s.uid, s.username, s.name, s.real_name, s.phone, s.email, s.status, s.exam_year, s.created_at,
    (SELECT c2.province FROM enrollments e2 JOIN courses c2 ON e2.course_id=c2.id WHERE e2.student_id=s.id ORDER BY e2.id DESC LIMIT 1) as exam_province
    FROM students s${regWhere}`;
  let regCountSql = `SELECT COUNT(*) as c FROM students s${regWhere}`;
  const regListParams = regParams.slice();
  regSql += ` ORDER BY s.created_at DESC LIMIT ? OFFSET ?`;
  regListParams.push(perPage, offset);
  const registered = db.query(regSql, regListParams);
  const regTotal = db.get(regCountSql, regParams).c;
  const activeRegs = db.get("SELECT COUNT(*) as c FROM students WHERE status='active'").c;
  const disabledRegs = db.get("SELECT COUNT(*) as c FROM students WHERE status='disabled'").c;

  res.render('teacher/registrations', {
    title: '用户列表 · 管理后台',
    teacherName: req.session.teacherName,
    registered,
    rq,
    rsdate,
    redate,
    page,
    perPage,
    regTotal,
    activeRegs,
    disabledRegs,
    regPages: Math.ceil(regTotal / perPage)
  });
});

// ── 新建用户 / 新建学员 ──
router.get('/users-manage/new', (req, res) => {
  renderUserForm(res, req, 'user', null, null);
});

router.post('/users-manage/new', (req, res) => {
  const name = (req.body.name || '').trim();
  const phone = (req.body.phone || '').trim();
  const password = req.body.password || '';
  const exam_year = (req.body.exam_year || '').trim();
  if (!name || !phone || password.length < 6) {
    return renderUserForm(res, req, 'user', req.body, '请完整填写姓名、手机号，登录密码至少 6 位');
  }
  if (db.get('SELECT id FROM students WHERE phone=?', [phone])) {
    return renderUserForm(res, req, 'user', req.body, '该手机号已注册');
  }
  const username = genStudentCode('cz', 8, 'username');
  const uid = genStudentCode('UID', 6, 'uid');
  const hash = bcrypt.hashSync(password, 10);
  db.run(
    'INSERT INTO students (name, real_name, username, phone, password_hash, uid, exam_year, status) VALUES (?,?,?,?,?,?,?,?)',
    [name, name, username, phone, hash, uid, exam_year, 'active']
  );
  res.redirect('/admin/users-manage');
});

router.get('/students-manage/new', (req, res) => {
  renderUserForm(res, req, 'student', null, null);
});

router.post('/students-manage/new', (req, res) => {
  const name = (req.body.name || '').trim();
  const phone = (req.body.phone || '').trim();
  const password = req.body.password || '';
  const exam_year = (req.body.exam_year || '').trim();
  const course_id = parseInt(req.body.course_id) || 0;
  if (!name || !phone || password.length < 6 || !course_id) {
    return renderUserForm(res, req, 'student', req.body, '请完整填写姓名、手机号、登录密码和课程');
  }
  if (db.get('SELECT id FROM students WHERE phone=?', [phone])) {
    return renderUserForm(res, req, 'student', req.body, '该手机号已注册');
  }
  const username = genStudentCode('cz', 8, 'username');
  const uid = genStudentCode('UID', 6, 'uid');
  const hash = bcrypt.hashSync(password, 10);
  db.run(
    'INSERT INTO students (name, real_name, username, phone, password_hash, uid, exam_year, status) VALUES (?,?,?,?,?,?,?,?)',
    [name, name, username, phone, hash, uid, exam_year, 'active']
  );
  const student = db.get('SELECT id FROM students WHERE username=?', [username]);
  if (student) {
    db.run('INSERT OR IGNORE INTO enrollments (student_id, course_id) VALUES (?,?)', [student.id, course_id]);
  }
  res.redirect('/admin/students-manage');
});

// ── 订单管理 (Orders) ──
router.get('/orders-manage', (req, res) => {
  const q = (req.query.q || '').trim();
  const status = req.query.status || '';
  const page = parseInt(req.query.page) || 1;
  const perPage = 10;
  const offset = (page - 1) * perPage;

  let conds = [];
  let params = [];
  let countParams = [];
  if (q) {
    conds.push('(o.order_no LIKE ? OR s.name LIKE ? OR s.phone LIKE ? OR s.uid LIKE ?)');
    params.push('%'+q+'%', '%'+q+'%', '%'+q+'%', '%'+q+'%');
    countParams.push('%'+q+'%', '%'+q+'%', '%'+q+'%', '%'+q+'%');
  }
  if (status) {
    conds.push('o.status = ?');
    params.push(status);
    countParams.push(status);
  }
  const where = conds.length ? ` WHERE ${conds.join(' AND ')}` : '';
  let sql = `SELECT o.*, s.name as student_name, s.uid, s.phone as student_phone, c.title as course_title
    FROM orders o LEFT JOIN students s ON o.student_id=s.id LEFT JOIN courses c ON o.course_id=c.id${where}
    ORDER BY o.created_at DESC, o.id DESC LIMIT ? OFFSET ?`;
  const listParams = params.slice();
  listParams.push(perPage, offset);
  const orders = db.query(sql, listParams);
  const total = db.get(`SELECT COUNT(*) as c FROM orders o LEFT JOIN students s ON o.student_id=s.id${where}`, countParams).c;
  const paidOrders = db.get("SELECT COUNT(*) as c FROM orders WHERE status='paid'").c;
  const pendingOrders = db.get("SELECT COUNT(*) as c FROM orders WHERE status='pending'").c;

  res.render('teacher/orders', {
    title: '订单列表 · 管理后台',
    teacherName: req.session.teacherName,
    orders, q, status, page,
    total,
    paidOrders,
    pendingOrders,
    pages: Math.ceil(total / perPage)
  });
});

// ── 添加订单 ──
router.get('/orders-manage/new', (req, res) => {
  const students = db.query('SELECT id, name, phone FROM students ORDER BY created_at DESC');
  const courses = db.query('SELECT id, title FROM courses ORDER BY created_at DESC');
  res.render('teacher/orders-form', {
    title: '新建订单 · 管理后台',
    teacherName: req.session.teacherName,
    students,
    courses,
    formData: null,
    error: null
  });
});

router.post('/orders-manage/new', (req, res) => {
  const students = db.query('SELECT id, name, phone FROM students ORDER BY created_at DESC');
  const courses = db.query('SELECT id, title FROM courses ORDER BY created_at DESC');
  const student_id = req.body.student_id ? parseInt(req.body.student_id) : 0;
  const course_id = req.body.course_id ? parseInt(req.body.course_id) : 0;
  const amount = parseFloat(req.body.amount);
  const payment_method = req.body.payment_method || 'wechat';
  const status = req.body.status || 'pending';

  if (!student_id || !course_id || isNaN(amount) || amount < 0) {
    return res.render('teacher/orders-form', {
      title: '新建订单 · 管理后台',
      teacherName: req.session.teacherName,
      students,
      courses,
      formData: req.body,
      error: '请完整填写学员、课程和金额'
    });
  }

  const orderNo = 'OD' + Date.now() + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  db.run(
    'INSERT INTO orders (order_no, student_id, course_id, amount, status, payment_method) VALUES (?,?,?,?,?,?)',
    [orderNo, student_id, course_id, amount, status, payment_method]
  );
  res.redirect('/admin/orders-manage');
});

router.get('/api/orders', requireTeacher, (req, res) => {
  const q = (req.query.q || '').trim();
  const status = req.query.status || '';
  const page = parseInt(req.query.page) || 1;
  const perPage = 10;
  const offset = (page - 1) * perPage;

  let conds = [];
  let params = [];
  let countParams = [];
  if (q) {
    conds.push('(o.order_no LIKE ? OR s.name LIKE ? OR s.phone LIKE ? OR s.uid LIKE ?)');
    params.push('%'+q+'%', '%'+q+'%', '%'+q+'%', '%'+q+'%');
    countParams.push('%'+q+'%', '%'+q+'%', '%'+q+'%', '%'+q+'%');
  }
  if (status) {
    conds.push('o.status = ?');
    params.push(status);
    countParams.push(status);
  }
  const where = conds.length ? ` WHERE ${conds.join(' AND ')}` : '';
  let sql = `SELECT o.*, s.name as student_name, s.uid, s.phone as student_phone, c.title as course_title
    FROM orders o LEFT JOIN students s ON o.student_id=s.id LEFT JOIN courses c ON o.course_id=c.id${where}
    ORDER BY o.created_at DESC, o.id DESC LIMIT ? OFFSET ?`;
  const listParams = params.slice();
  listParams.push(perPage, offset);
  const orders = db.query(sql, listParams);
  const total = db.get(`SELECT COUNT(*) as c FROM orders o LEFT JOIN students s ON o.student_id=s.id${where}`, countParams).c;

  res.json({ rows: orders, total, pages: Math.ceil(total / perPage), page });
});

// Student detail
router.get('/students-manage/:id', (req, res) => {
  const student = db.get('SELECT * FROM students WHERE id=?', [req.params.id]);
  if (!student) return res.redirect('/admin/students-manage');

  const enrolledCourses = db.query(`
    SELECT c.id as course_id, c.title as course_title, e.enrolled_at,
      (SELECT COUNT(*) FROM lessons WHERE course_id=c.id) as total_lessons,
      (SELECT COUNT(*) FROM course_progress cp JOIN lessons l ON cp.lesson_id=l.id WHERE l.course_id=c.id AND cp.student_id=? AND cp.completed=1) as completed_lessons
    FROM enrollments e JOIN courses c ON e.course_id=c.id
    WHERE e.student_id=?
    ORDER BY e.enrolled_at DESC`, [req.params.id]);

  const qaRecords = db.query(`
    SELECT q.*, c.title as course_title FROM qa_questions q
    LEFT JOIN courses c ON q.course_id=c.id
    WHERE q.student_id=? ORDER BY q.created_at DESC LIMIT 10`, [req.params.id]);

  const logistics = db.query('SELECT * FROM logistics WHERE student_id=? ORDER BY created_at DESC', [req.params.id]);

  const completedLessons = enrolledCourses.reduce((sum, ec) => sum + (ec.completed_lessons || 0), 0);
  const qaCount = qaRecords.length;

  res.render('teacher/student-detail', {
    title: `${student.name} · 学员详情`,
    teacherName: req.session.teacherName,
    student, enrolledCourses, qaRecords, logistics,
    completedLessons, qaCount
  });
});

// ── 教研管理 (Research Management) ──
router.get('/research-manage', (req, res) => {
  const plans = db.query(`
    SELECT p.*, c.title as course_title FROM teaching_plans p 
    LEFT JOIN courses c ON p.course_id=c.id ORDER BY p.created_at DESC`);
  const activities = db.query('SELECT * FROM research_activities ORDER BY activity_date DESC');
  const materials = db.query(`
    SELECT m.*, c.title as course_title FROM research_materials m 
    LEFT JOIN courses c ON m.course_id=c.id ORDER BY m.created_at DESC`);

  res.render('teacher/research', {
    title: '教研管理 · 管理后台', teacherName: req.session.teacherName,
    plans, activities, materials
  });
});

// Research form
router.get('/research-manage/:type/new', (req, res) => {
  const courses = db.query('SELECT id, title FROM courses ORDER BY title');
  res.render('teacher/research-form', {
    title: '新建教研内容 · 管理后台', teacherName: req.session.teacherName,
    type: req.params.type, item: null, courses, error: null
  });
});

router.get('/research-manage/:type/:id', (req, res) => {
  let item = null;
  if (req.params.type === 'plan') item = db.get('SELECT * FROM teaching_plans WHERE id=?', [req.params.id]);
  else if (req.params.type === 'activity') item = db.get('SELECT * FROM research_activities WHERE id=?', [req.params.id]);
  else if (req.params.type === 'material') item = db.get('SELECT * FROM research_materials WHERE id=?', [req.params.id]);
  if (!item) return res.redirect('/admin/research-manage');
  const courses = db.query('SELECT id, title FROM courses ORDER BY title');
  res.render('teacher/research-form', {
    title: '编辑教研内容 · 管理后台', teacherName: req.session.teacherName,
    type: req.params.type, item, courses, error: null
  });
});

// Research create
router.post('/research-manage/:type/create', (req, res) => {
  const teacherId = req.session.teacherId;
  const { title, content, objectives, plan_date, course_id, status,
          activity_type, activity_date, duration, description, notes,
          material_type, file_url } = req.body;

  if (!title) return res.redirect('/admin/research-manage/'+req.params.type+'/new');

  if (req.params.type === 'plan') {
    db.run('INSERT INTO teaching_plans (teacher_id, course_id, title, content, objectives, status, plan_date) VALUES (?,?,?,?,?,?,?)',
      [teacherId, course_id||null, title, content||'', objectives||'', status||'draft', plan_date||'']);
  } else if (req.params.type === 'activity') {
    db.run('INSERT INTO research_activities (teacher_id, title, description, activity_type, activity_date, duration, notes, status) VALUES (?,?,?,?,?,?,?,?)',
      [teacherId, title, description||'', activity_type||'meeting', activity_date||'', parseInt(duration)||0, notes||'', status||'scheduled']);
  } else if (req.params.type === 'material') {
    db.run('INSERT INTO research_materials (teacher_id, title, description, material_type, file_url, course_id) VALUES (?,?,?,?,?,?)',
      [teacherId, title, description||'', material_type||'document', file_url||'', course_id||null]);
  }
  res.redirect('/admin/research-manage');
});

// Research update
router.post('/research-manage/:type/:id', (req, res) => {
  const { title, content, objectives, plan_date, course_id, status,
          activity_type, activity_date, duration, description, notes,
          material_type, file_url } = req.body;

  if (req.params.type === 'plan') {
    db.run('UPDATE teaching_plans SET title=?, content=?, objectives=?, status=?, plan_date=?, course_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
      [title, content||'', objectives||'', status||'draft', plan_date||'', course_id||null, req.params.id]);
  } else if (req.params.type === 'activity') {
    db.run('UPDATE research_activities SET title=?, description=?, activity_type=?, activity_date=?, duration=?, notes=?, status=? WHERE id=?',
      [title, description||'', activity_type||'meeting', activity_date||'', parseInt(duration)||0, notes||'', status||'scheduled', req.params.id]);
  } else if (req.params.type === 'material') {
    db.run('UPDATE research_materials SET title=?, description=?, material_type=?, file_url=?, course_id=? WHERE id=?',
      [title, description||'', material_type||'document', file_url||'', course_id||null, req.params.id]);
  }
  res.redirect('/admin/research-manage');
});

router.post('/research-manage/:type/:id/delete', (req, res) => {
  const table = req.params.type === 'plan' ? 'teaching_plans' : req.params.type === 'activity' ? 'research_activities' : 'research_materials';
  db.run(`DELETE FROM ${table} WHERE id=?`, [req.params.id]);
  res.redirect('/admin/research-manage');
});

// ── 助教管理 (Assistant Management) ──
router.get('/assistants-manage', (req, res) => {
  const assistants = db.query('SELECT * FROM assistants ORDER BY created_at DESC');
  const assignments = db.query(`
    SELECT aa.*, c.title as course_title FROM assistant_assignments aa
    JOIN courses c ON aa.course_id=c.id`);
  const totalAssistants = assistants.length;
  const assignedCount = db.get('SELECT COUNT(DISTINCT assistant_id) as c FROM assistant_assignments').c;

  res.render('teacher/assistants', {
    title: '助教管理 · 管理后台', teacherName: req.session.teacherName,
    assistants, assignments, totalAssistants, assignedCount
  });
});

router.get('/assistants-manage/edit/:id', (req, res) => {
  let assistant = null;
  if (req.params.id !== '0') {
    assistant = db.get('SELECT * FROM assistants WHERE id=?', [req.params.id]);
    if (!assistant) return res.redirect('/admin/assistants-manage');
  }
  const courses = db.query('SELECT id, title FROM courses ORDER BY title');
  const assignedCourseIds = assistant ? db.query('SELECT course_id FROM assistant_assignments WHERE assistant_id=?', [assistant.id]).map(a => a.course_id) : [];

  res.render('teacher/assistant-form', {
    title: assistant ? '编辑助教 · 管理后台' : '添加助教 · 管理后台',
    teacherName: req.session.teacherName,
    assistant, courses, assignedCourseIds, error: null
  });
});

router.post('/assistants-manage/create', (req, res) => {
  const teacherId = req.session.teacherId;
  const { name, phone, email, hourly_rate, bio, course_ids } = req.body;
  if (!name) return res.redirect('/admin/assistants-manage/edit/0');

  db.run('INSERT INTO assistants (teacher_id, name, phone, email, hourly_rate, bio) VALUES (?,?,?,?,?,?)',
    [teacherId, name, phone||'', email||'', parseFloat(hourly_rate)||0, bio||'']);

  const newAssistant = db.get('SELECT id FROM assistants WHERE teacher_id=? ORDER BY id DESC', [teacherId]);
  if (newAssistant && course_ids) {
    const courseIdArr = Array.isArray(course_ids) ? course_ids : [course_ids];
    courseIdArr.forEach(cid => {
      db.run('INSERT INTO assistant_assignments (assistant_id, course_id) VALUES (?,?)', [newAssistant.id, parseInt(cid)]);
    });
  }
  res.redirect('/admin/assistants-manage');
});

router.post('/assistants-manage/:id', (req, res) => {
  const { name, phone, email, hourly_rate, bio, course_ids } = req.body;
  if (!name) return res.redirect('/admin/assistants-manage/edit/'+req.params.id);

  db.run('UPDATE assistants SET name=?, phone=?, email=?, hourly_rate=?, bio=? WHERE id=?',
    [name, phone||'', email||'', parseFloat(hourly_rate)||0, bio||'', req.params.id]);

  // Update assignments
  db.run('DELETE FROM assistant_assignments WHERE assistant_id=?', [req.params.id]);
  if (course_ids) {
    const courseIdArr = Array.isArray(course_ids) ? course_ids : [course_ids];
    courseIdArr.forEach(cid => {
      db.run('INSERT INTO assistant_assignments (assistant_id, course_id) VALUES (?,?)', [parseInt(req.params.id), parseInt(cid)]);
    });
  }
  res.redirect('/admin/assistants-manage');
});

router.post('/assistants-manage/:id/toggle', (req, res) => {
  const a = db.get('SELECT status FROM assistants WHERE id=?', [req.params.id]);
  if (a) db.run('UPDATE assistants SET status=? WHERE id=?', [a.status==='active'?'inactive':'active', req.params.id]);
  res.redirect('/admin/assistants-manage');
});

// ── 答疑管理 (Q&A Management) ──
router.get('/qa-manage', (req, res) => {
  const filter = req.query.filter || 'all';
  let questions;
  if (filter === 'open') {
    questions = db.query(`
      SELECT q.*, s.name as student_name, c.title as course_title 
      FROM qa_questions q LEFT JOIN students s ON q.student_id=s.id 
      LEFT JOIN courses c ON q.course_id=c.id WHERE q.status='open' 
      ORDER BY q.priority='high' DESC, q.created_at DESC`);
  } else {
    questions = db.query(`
      SELECT q.*, s.name as student_name, c.title as course_title 
      FROM qa_questions q LEFT JOIN students s ON q.student_id=s.id 
      LEFT JOIN courses c ON q.course_id=c.id 
      ORDER BY q.status='open' DESC, q.priority='high' DESC, q.created_at DESC`);
  }
  const openCount = db.get('SELECT COUNT(*) as c FROM qa_questions WHERE status=\'open\'').c;
  const answeredCount = db.get('SELECT COUNT(*) as c FROM qa_questions WHERE status=\'answered\'').c;
  const totalQuestions = db.get('SELECT COUNT(*) as c FROM qa_questions').c;

  res.render('teacher/qa', {
    title: '答疑管理 · 管理后台', teacherName: req.session.teacherName,
    questions, openCount, answeredCount, totalQuestions, filter
  });
});

router.get('/qa-manage/:id', (req, res) => {
  const question = db.get(`
    SELECT q.*, s.name as student_name, c.title as course_title 
    FROM qa_questions q LEFT JOIN students s ON q.student_id=s.id 
    LEFT JOIN courses c ON q.course_id=c.id WHERE q.id=?`, [req.params.id]);
  if (!question) return res.redirect('/admin/qa-manage');

  const answers = db.query(`
    SELECT a.*, COALESCE(t.real_name, ast.name, '') as answerer_name 
    FROM qa_answers a
    LEFT JOIN teachers t ON a.answerer_type='teacher' AND a.answerer_id=t.id
    LEFT JOIN assistants ast ON a.answerer_type='assistant' AND a.answerer_id=ast.id
    WHERE a.question_id=? ORDER BY a.created_at ASC`, [req.params.id]);

  res.render('teacher/qa-detail', {
    title: `${question.title} · 答疑详情`, teacherName: req.session.teacherName,
    question, answers
  });
});

router.post('/qa-manage/:id/answer', (req, res) => {
  const teacherId = req.session.teacherId;
  const { content } = req.body;
  if (!content) return res.redirect('/admin/qa-manage/'+req.params.id);

  const q = db.get('SELECT * FROM qa_questions WHERE id=?', [req.params.id]);
  if (!q) return res.redirect('/admin/qa-manage');

  db.run('INSERT INTO qa_answers (question_id, answerer_type, answerer_id, content) VALUES (?,?,?,?)',
    [req.params.id, 'teacher', teacherId, content]);
  db.run('UPDATE qa_questions SET status=\'answered\', answered_at=CURRENT_TIMESTAMP WHERE id=?', [req.params.id]);

  res.redirect('/admin/qa-manage/'+req.params.id);
});

// ── 物流管理 (Logistics Management) ──
router.get('/logistics-manage', (req, res) => {
  const q = (req.query.q || '').trim();
  const status = req.query.status || '';
  let conds = [];
  let params = [];
  if (q) {
    conds.push('(l.order_no LIKE ? OR s.name LIKE ? OR l.recipient_name LIKE ? OR l.recipient_phone LIKE ? OR l.carrier LIKE ? OR l.tracking_no LIKE ?)');
    params.push('%'+q+'%', '%'+q+'%', '%'+q+'%', '%'+q+'%', '%'+q+'%', '%'+q+'%');
  }
  if (status) {
    conds.push('l.status = ?');
    params.push(status);
  }
  const where = conds.length ? ` WHERE ${conds.join(' AND ')}` : '';
  const list = db.query(`
    SELECT l.*, s.name as student_name,
      (SELECT GROUP_CONCAT(name||'×'||quantity||unit, ', ') FROM logistics_items WHERE logistics_id=l.id) as items_summary
    FROM logistics l LEFT JOIN students s ON l.student_id=s.id${where}
    ORDER BY l.created_at DESC`, params);
  const pending = db.get('SELECT COUNT(*) as c FROM logistics WHERE status=\'pending\'').c;
  const shipped = db.get('SELECT COUNT(*) as c FROM logistics WHERE status=\'shipped\'').c;
  const delivered = db.get('SELECT COUNT(*) as c FROM logistics WHERE status=\'delivered\'').c;

  res.render('teacher/logistics', {
    title: '物流管理 · 管理后台', teacherName: req.session.teacherName,
    list, q, status, stats: { pending, shipped, delivered }
  });
});

router.get('/logistics-manage/new', (req, res) => {
  const students = db.query('SELECT id, name FROM students ORDER BY name');
  const courses = db.query('SELECT id, title FROM courses ORDER BY title');
  res.render('teacher/logistics-form', {
    title: '新建发货单 · 管理后台', teacherName: req.session.teacherName,
    lg: null, items: null, students, courses, error: null
  });
});

router.get('/logistics-manage/:id/edit', (req, res) => {
  const lg = db.get('SELECT * FROM logistics WHERE id=?', [req.params.id]);
  if (!lg) return res.redirect('/admin/logistics-manage');
  const items = db.query('SELECT * FROM logistics_items WHERE logistics_id=?', [lg.id]);
  const students = db.query('SELECT id, name FROM students ORDER BY name');
  const courses = db.query('SELECT id, title FROM courses ORDER BY title');
  res.render('teacher/logistics-form', {
    title: '编辑发货单 · 管理后台', teacherName: req.session.teacherName,
    lg, items, students, courses, error: null
  });
});

router.post('/logistics-manage/create', (req, res) => {
  const teacherId = req.session.teacherId;
  const { student_id, course_id, type, recipient_name, recipient_phone, recipient_address, carrier, tracking_no, remark,
          item_name, item_qty, item_unit } = req.body;
  if (!recipient_name || !recipient_phone || !recipient_address) return res.redirect('/admin/logistics-manage/new');

  const orderNo = 'LG' + new Date().toISOString().replace(/[-:]/g,'').substring(0,14) + Math.floor(Math.random()*100);

  db.run('INSERT INTO logistics (teacher_id, student_id, course_id, order_no, type, status, recipient_name, recipient_phone, recipient_address, carrier, tracking_no, remark) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    [teacherId, student_id||null, course_id||null, orderNo, type||'material', 'pending',
     recipient_name, recipient_phone, recipient_address, carrier||'', tracking_no||'', remark||'']);

  const newLg = db.get('SELECT id FROM logistics WHERE teacher_id=? ORDER BY id DESC', [teacherId]);
  if (newLg && item_name) {
    const names = Array.isArray(item_name) ? item_name : [item_name];
    const qtys = Array.isArray(item_qty) ? item_qty : [item_qty];
    const units = Array.isArray(item_unit) ? item_unit : [item_unit];
    names.forEach((nm, i) => {
      if (nm) db.run('INSERT INTO logistics_items (logistics_id, name, quantity, unit) VALUES (?,?,?,?)',
        [newLg.id, nm, parseInt(qtys[i])||1, units[i]||'份']);
    });
  }
  res.redirect('/admin/logistics-manage');
});

router.post('/logistics-manage/:id', (req, res) => {
  const { student_id, course_id, type, recipient_name, recipient_phone, recipient_address, carrier, tracking_no, remark,
          item_name, item_qty, item_unit } = req.body;
  if (!recipient_name || !recipient_phone || !recipient_address) return res.redirect('/admin/logistics-manage/'+req.params.id+'/edit');

  db.run('UPDATE logistics SET student_id=?, course_id=?, type=?, recipient_name=?, recipient_phone=?, recipient_address=?, carrier=?, tracking_no=?, remark=? WHERE id=?',
    [student_id||null, course_id||null, type||'material', recipient_name, recipient_phone, recipient_address, carrier||'', tracking_no||'', remark||'', req.params.id]);

  // Update items
  db.run('DELETE FROM logistics_items WHERE logistics_id=?', [req.params.id]);
  if (item_name) {
    const names = Array.isArray(item_name) ? item_name : [item_name];
    const qtys = Array.isArray(item_qty) ? item_qty : [item_qty];
    const units = Array.isArray(item_unit) ? item_unit : [item_unit];
    names.forEach((nm, i) => {
      if (nm) db.run('INSERT INTO logistics_items (logistics_id, name, quantity, unit) VALUES (?,?,?,?)',
        [req.params.id, nm, parseInt(qtys[i])||1, units[i]||'份']);
    });
  }
  res.redirect('/admin/logistics-manage');
});

router.get('/logistics-manage/:id/ship', (req, res) => {
  const lg = db.get('SELECT * FROM logistics WHERE id=?', [req.params.id]);
  if (lg && lg.status === 'pending') {
    db.run('UPDATE logistics SET status=\'shipped\', shipped_at=CURRENT_TIMESTAMP WHERE id=?', [req.params.id]);
  }
  res.redirect('/admin/logistics-manage');
});

router.post('/logistics-manage/:id/deliver', (req, res) => {
  const lg = db.get('SELECT * FROM logistics WHERE id=?', [req.params.id]);
  if (lg && lg.status === 'shipped') {
    db.run('UPDATE logistics SET status=\'delivered\', delivered_at=CURRENT_TIMESTAMP WHERE id=?', [req.params.id]);
  }
  res.redirect('/admin/logistics-manage');
});

// ── Lesson creation page ──
router.get('/lessons/new', requireTeacher, (req, res) => {
  const courses = db.query("SELECT id, title FROM courses WHERE status='published' OR status='archived' ORDER BY title");
  res.render('teacher/lesson-form', {
    title: '新建课时 · 管理后台',
    teacherName: req.session.teacherName,
    courses,
    error: null
  });
});

// ── Create lesson ──
router.post('/lessons/create', requireTeacher, (req, res) => {
  const { course_id, title, duration, video_url } = req.body;
  if (!course_id || !title) {
    const courses = db.query("SELECT id, title FROM courses ORDER BY title");
    return res.render('teacher/lesson-form', {
      title: '新建课时 · 管理后台',
      teacherName: req.session.teacherName,
      courses,
      error: '请选择系列课并填写课时名称'
    });
  }
  const maxOrder = db.get('SELECT COALESCE(MAX(order_index),0) as mx FROM lessons WHERE course_id=?', [course_id]);
  db.run('INSERT INTO lessons (course_id, title, duration, order_index, video_url) VALUES (?,?,?,?,?)',
    [course_id, title, (parseInt(duration)||45)*60, maxOrder.mx+1, video_url || '']);
  res.redirect('/admin/courses-manage/' + course_id);
});

// ── 编辑系列课 ──
router.get('/courses-manage/:id/edit-series', requireTeacher, (req, res) => {
  const course = db.get('SELECT * FROM courses WHERE id = ?', [req.params.id]);
  if (!course) return res.redirect('/admin/courses-manage');
  const teachers = db.query('SELECT id, real_name, subject FROM teachers ORDER BY real_name');
  const packages = db.query('SELECT id, title, parent_id, year, province, class_type, exam_type FROM course_packages ORDER BY parent_id, created_at DESC');
  const coursePackageRows = db.query('SELECT package_id FROM course_package_courses WHERE course_id = ? ORDER BY id', [course.id]);
  const coursePackageIds = coursePackageRows.map(function(r) { return parseInt(r.package_id) || 0; }).filter(Boolean);
  // Load subjects from course_subjects
  const subjects = db.query('SELECT * FROM course_subjects WHERE course_id = ?', [course.id]);
  const lessons = db.query('SELECT * FROM lessons WHERE course_id=? ORDER BY order_index ASC', [course.id]);
  const stageData = [];
  lessons.forEach(function(l) {
    var name = l.stage || '';
    var last = stageData[stageData.length - 1];
    if (!last || last.name !== name) {
      stageData.push({
        name: name,
        count: 0,
        duration: Math.round((l.duration || 0) / 60) || 120,
        start: l.stage_start_date || '',
        end: l.stage_end_date || '',
        rule: l.stage_rule || '',
        time: l.stage_time || ''
      });
    }
    stageData[stageData.length - 1].count++;
  });
  const provinceOptions = getProvinceOptions();
  res.render('teacher/course-series', {
    title: '编辑系列课 · 管理后台',
    teacherName: req.session.teacherName,
    course,
    teachers,
    packages,
    coursePackageIds,
    provinceOptions,
    stageData,
    editMode: true,
    savedSubjects: subjects
  });
});

// ── 更新系列课 ──
router.post('/courses-manage/:id/edit-series', requireTeacher, (req, res) => {
  const { title, description, category, exam_type, status, year, province, class_type, course_type, teaching_mode, price, teacher_id } = req.body;
  const pkgIdList = [];
  if (req.body.package_ids) {
    String(req.body.package_ids).split(',').forEach(function(pid) {
      const n = parseInt(pid) || 0;
      if (n > 0 && pkgIdList.indexOf(n) < 0) pkgIdList.push(n);
    });
  }
  const primaryPkgId = pkgIdList.length > 0 ? pkgIdList[0] : (parseInt(req.body.package_id) || 0);
  const startDate = formatCnDate(req.body.start_date);
  const endDate = formatCnDate(req.body.end_date);
  db.run('UPDATE courses SET title=?, description=?, category=?, exam_type=?, year=?, province=?, class_type=?, course_type=?, package_id=?, teaching_mode=?, price=?, sale_price=?, start_date=?, valid_until=?, teacher_id=? WHERE id=?',
    [title, description||'', category||'', exam_type || '专升本', year||'', province||'', class_type||'', course_type||'class', primaryPkgId, teaching_mode||'', price||'', req.body.sale_price || '', startDate, endDate, teacher_id || 0, req.params.id]);
  db.run('DELETE FROM course_package_courses WHERE course_id=?', [req.params.id]);
  if (primaryPkgId > 0 && pkgIdList.indexOf(primaryPkgId) < 0) pkgIdList.unshift(primaryPkgId);
  pkgIdList.forEach(function(pid) {
    db.run('INSERT OR IGNORE INTO course_package_courses (package_id, course_id) VALUES (?,?)', [pid, req.params.id]);
  });
  // Update subjects from JSON
  db.run('DELETE FROM course_subjects WHERE course_id=?', [req.params.id]);
  let subjectsData = [];
  try { subjectsData = JSON.parse(req.body.subjects_json || '[]'); } catch {}
  subjectsData.forEach((s, idx) => {
    if (s.subject) {
      const tid = s.teacher ? parseInt(s.teacher) : null;
      db.run('INSERT INTO course_subjects (course_id, subject, teacher_id, order_index) VALUES (?,?,?,?)',
        [req.params.id, s.subject, tid, idx]);
    }
  });
  if (!req.body.teacher_id) {
    const firstTeacher = db.get('SELECT teacher_id FROM course_subjects WHERE course_id=? AND teacher_id IS NOT NULL ORDER BY order_index LIMIT 1', [req.params.id]);
    if (firstTeacher && firstTeacher.teacher_id) {
      db.run('UPDATE courses SET teacher_id=? WHERE id=?', [firstTeacher.teacher_id, req.params.id]);
    }
  }
  const existing = db.query('SELECT * FROM lessons WHERE course_id = ? ORDER BY order_index ASC', [req.params.id]);
  var order = 1;
  var idx = 0;
  while (req.body['sn_' + idx] !== undefined) {
    var stageName = req.body['sn_' + idx] || '';
    var count = parseInt(req.body['sc_' + idx]) || 0;
    var duration = (parseInt(req.body['sd_' + idx]) || 120) * 60;
    var start = req.body['sd_start_' + idx] || '';
    var end = req.body['sd_end_' + idx] || '';
    var rule = req.body['rule_' + idx] || '';
    var time = req.body['time_' + idx] || '';
    for (var l = 1; l <= count; l++) {
      var lessonName = (stageName || '') + '-第' + l + '讲';
      const oldLesson = existing[order - 1] || null;
      if (oldLesson) {
        db.run('UPDATE lessons SET title=?, duration=?, stage=?, stage_start_date=?, stage_end_date=?, stage_rule=?, stage_time=? WHERE id=?',
          [lessonName.trim(), duration, stageName, start, end, rule, time, oldLesson.id]);
      } else {
        db.run('INSERT INTO lessons (course_id, title, duration, order_index, stage, stage_start_date, stage_end_date, stage_rule, stage_time) VALUES (?,?,?,?,?,?,?,?,?)',
          [req.params.id, lessonName.trim(), duration, order, stageName, start, end, rule, time]);
      }
      order++;
    }
    idx++;
  }
  if (existing.length > order - 1) {
    for (var e = order - 1; e < existing.length; e++) {
      const refs = db.get('SELECT COUNT(*) as c FROM live_replays WHERE lesson_id=?', [existing[e].id]).c +
                   db.get('SELECT COUNT(*) as c FROM course_progress WHERE lesson_id=?', [existing[e].id]).c;
      if (!refs) db.run('DELETE FROM lessons WHERE id=?', [existing[e].id]);
    }
  }
  res.redirect('/admin/courses-manage');
});

// ── 编辑系列课基本信息（弹窗，不重建课次）──
router.post('/courses-manage/:id/update-basic', requireTeacher, (req, res) => {
  const course = db.get('SELECT * FROM courses WHERE id = ?', [req.params.id]);
  if (!course) return res.status(404).json({ ok: false, error: '课程不存在' });
  const pkgIdList = [];
  if (req.body.package_ids) {
    String(req.body.package_ids).split(',').forEach(function(pid) {
      const n = parseInt(pid) || 0;
      if (n > 0 && pkgIdList.indexOf(n) < 0) pkgIdList.push(n);
    });
  }
  const primaryPkgId = pkgIdList.length > 0 ? pkgIdList[0] : (parseInt(req.body.package_id) || course.package_id || 0);
  db.run('UPDATE courses SET title=?, category=?, exam_type=?, year=?, province=?, class_type=?, course_type=?, package_id=?, teacher_id=?, teaching_mode=? WHERE id=?',
    [req.body.title || course.title, req.body.category || '', req.body.exam_type || '专升本', req.body.year || '', req.body.province || '', req.body.class_type || '', req.body.course_type || 'class', primaryPkgId, parseInt(req.body.teacher_id) || course.teacher_id, req.body.teaching_mode || '', course.id]);
  db.run('DELETE FROM course_package_courses WHERE course_id=?', [course.id]);
  if (primaryPkgId > 0 && pkgIdList.indexOf(primaryPkgId) < 0) pkgIdList.unshift(primaryPkgId);
  pkgIdList.forEach(function(pid) {
    db.run('INSERT OR IGNORE INTO course_package_courses (package_id, course_id) VALUES (?,?)', [pid, course.id]);
  });
  res.json({ ok: true });
});

// ── 课程排课页面 ──
router.get('/courses-manage/:id/plan', requireTeacher, (req, res) => {
  const course = db.get('SELECT * FROM courses WHERE id = ?', [req.params.id]);
  if (!course) return res.redirect('/admin/courses-manage');
  const lessons = db.query('SELECT * FROM lessons WHERE course_id = ? ORDER BY order_index ASC', [course.id]);
  res.render('teacher/course-plan', {
    title: course.title + ' · 课程排课',
    teacherName: req.session.teacherName,
    course,
    lessons
  });
});

router.get('/courses-manage/:id/scheduler', requireTeacher, (req, res) => {
  const course = db.get('SELECT * FROM courses WHERE id = ?', [req.params.id]);
  if (!course) return res.redirect('/admin/courses-manage');
  const scopePackageId = parseInt(req.query.package_id) || course.package_id || 0;
  const scopePkg = scopePackageId ? db.get('SELECT title FROM course_packages WHERE id=?', [scopePackageId]) : null;
  const scopePackageTitle = scopePkg ? scopePkg.title : '';
  const lessons = db.query('SELECT * FROM lessons WHERE course_id = ? ORDER BY order_index ASC', [course.id]);
  let packageCourses = [];
  if (scopePackageId) {
    packageCourses = db.query('SELECT c.id, c.title, c.category FROM courses c JOIN course_package_courses pc ON pc.course_id=c.id WHERE pc.package_id=? ORDER BY c.title', [scopePackageId]);
  }
  let conflictLessons = [];
  if (scopePackageId) {
    const siblings = db.query('SELECT c.id, c.title FROM courses c JOIN course_package_courses pc ON pc.course_id=c.id WHERE pc.package_id=? AND c.id<>?',
      [scopePackageId, course.id]);
    if (siblings.length > 0) {
      const ids = siblings.map(function(s) { return parseInt(s.id); }).join(',');
      const rows = db.query(`SELECT l.id, l.course_id, l.title, l.schedule_time, l.stage, l.stage_start_date, l.stage_rule, l.stage_time, l.stage_count, l.stage_duration FROM lessons l WHERE l.course_id IN (${ids}) ORDER BY l.schedule_time`);
      const byCourse = {};
      siblings.forEach(function(s) { byCourse[s.id] = s.title; });
      conflictLessons = rows.map(function(r) {
        return { id: r.id, course_id: r.course_id, course_title: byCourse[r.course_id] || '', lesson_title: r.title || '', schedule_time: r.schedule_time || '', stage: r.stage || '', start_date: r.stage_start_date || '', rule: r.stage_rule || '', times: r.stage_time || '', count: r.stage_count || 0, duration: r.stage_duration || 0 };
      });
    }
  }
  res.render('teacher/course-scheduler', {
    title: course.title + ' · 新版排课',
    teacherName: req.session.teacherName,
    course,
    lessons,
    conflictLessons,
    packageCourses,
    scopePackageId,
    scopePackageTitle
  });
});

router.get('/courses-manage/:id/scheduler-data', requireTeacher, (req, res) => {
  const course = db.get('SELECT * FROM courses WHERE id = ?', [req.params.id]);
  if (!course) return res.status(404).json({ ok: false, error: '课程不存在' });
  const scopePackageId = parseInt(req.query.package_id) || course.package_id || 0;
  const scopePkg = scopePackageId ? db.get('SELECT title FROM course_packages WHERE id=?', [scopePackageId]) : null;
  const scopePackageTitle = scopePkg ? scopePkg.title : '';
  const lessons = db.query('SELECT * FROM lessons WHERE course_id = ? ORDER BY order_index ASC', [course.id]);
  let packageCourses = [];
  if (scopePackageId) {
    packageCourses = db.query('SELECT c.id, c.title, c.category FROM courses c JOIN course_package_courses pc ON pc.course_id=c.id WHERE pc.package_id=? ORDER BY c.title', [scopePackageId]);
  }
  let conflictLessons = [];
  if (scopePackageId) {
    const siblings = db.query('SELECT c.id, c.title FROM courses c JOIN course_package_courses pc ON pc.course_id=c.id WHERE pc.package_id=? AND c.id<>?',
      [scopePackageId, course.id]);
    if (siblings.length > 0) {
      const ids = siblings.map(function(s) { return parseInt(s.id); }).join(',');
      const rows = db.query(`SELECT l.id, l.course_id, l.title, l.schedule_time, l.stage, l.stage_start_date, l.stage_rule, l.stage_time, l.stage_count, l.stage_duration FROM lessons l WHERE l.course_id IN (${ids}) ORDER BY l.schedule_time`);
      const byCourse = {};
      siblings.forEach(function(s) { byCourse[s.id] = s.title; });
      conflictLessons = rows.map(function(r) {
        return { id: r.id, course_id: r.course_id, course_title: byCourse[r.course_id] || '', lesson_title: r.title || '', schedule_time: r.schedule_time || '', stage: r.stage || '', start_date: r.stage_start_date || '', rule: r.stage_rule || '', times: r.stage_time || '', count: r.stage_count || 0, duration: r.stage_duration || 0 };
      });
    }
  }
  res.json({ ok: true, course: { id: course.id, title: course.title }, lessons, conflictLessons, packageCourses, scopePackageId, scopePackageTitle });
});

// ── 保存排课 ──
router.post('/courses-manage/:id/plan', requireTeacher, (req, res) => {
  const courseId = req.params.id;
  // Parse stage data from JSON
  var stages = [];
  try { stages = JSON.parse(req.body.stage_data || '[]'); } catch {}
  if (stages.length > 0) {
    const existing = db.query('SELECT * FROM lessons WHERE course_id = ? ORDER BY order_index ASC', [courseId]);
    var order = 1;
    for (var s = 0; s < stages.length; s++) {
      var stage = stages[s];
      var lessonList = stage.lessons || [];
      var ruleStr = (stage.entries || []).map(function(e){ return e.wd; }).join(',');
      var timeStr = (stage.entries || []).map(function(e){ return e.time; }).join(',');
      var startDate = stage.start_date || '';
      for (var l = 1; l <= stage.count; l++) {
        var lessonName = (stage.name || '') + '-' + '第' + l + '讲';
        var scheduleTime = '';
        var videoUrl = '';
        var topic = '';
        if (lessonList[l-1] && lessonList[l-1].name) {
          lessonName = lessonList[l-1].name;
          scheduleTime = lessonList[l-1].time || '';
          videoUrl = lessonList[l-1].video || '';
          topic = lessonList[l-1].topic || '';
        }
        const stageName = stage.name || '';
        const oldLesson = existing[order - 1] || null;
        if (oldLesson) {
          db.run('UPDATE lessons SET title=?, duration=?, description=?, schedule_time=?, video_url=?, stage=?, stage_start_date=?, stage_rule=?, stage_time=?, stage_count=?, stage_duration=? WHERE id=?',
            [lessonName, stage.duration, topic, scheduleTime, videoUrl, stageName, startDate, ruleStr, timeStr, stage.count || 0, stage.duration || 0, oldLesson.id]);
        } else {
          db.run('INSERT INTO lessons (course_id, title, duration, description, order_index, schedule_time, video_url, stage, stage_start_date, stage_rule, stage_time, stage_count, stage_duration) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [courseId, lessonName, stage.duration, topic, order, scheduleTime, videoUrl, stageName, startDate, ruleStr, timeStr, stage.count || 0, stage.duration || 0]);
        }
        order++;
      }
    }
    // 删除排课缩减后多余的课次，保留已有课时 ID 以维持回放/进度关联
    if (existing.length > order - 1) {
      for (var e = order - 1; e < existing.length; e++) {
        const refs = db.get('SELECT COUNT(*) as c FROM live_replays WHERE lesson_id=?', [existing[e].id]).c +
                     db.get('SELECT COUNT(*) as c FROM course_progress WHERE lesson_id=?', [existing[e].id]).c;
        if (!refs) db.run('DELETE FROM lessons WHERE id=?', [existing[e].id]);
      }
    }
  }
  res.redirect('/admin/courses-manage/' + req.params.id + '/scheduler');
});

// ── API: 用户数据（AJAX分页） ──
router.get('/api/users', requireTeacher, (req, res) => {
  const scope = (req.query.scope || '').trim();
  const q = (req.query.q || '').trim();
  const rq = (req.query.rq || '').trim();
  const sdate = req.query.sdate || '';
  const edate = req.query.edate || '';
  const rsdate = req.query.rsdate || '';
  const redate = req.query.redate || '';
  const page = parseInt(req.query.page) || 1;
  const perPage = 10;
  const offset = (page - 1) * perPage;

  let students = [];
  let studentTotal = 0;
  let studentPages = 0;
  if (!scope || scope === 'students') {
    let conds = [];
    let params = [];
    let countParams = [];
    if (q) { conds.push('(s.name LIKE ? OR s.phone LIKE ? OR s.email LIKE ?)'); params.push('%'+q+'%','%'+q+'%','%'+q+'%'); countParams.push('%'+q+'%','%'+q+'%','%'+q+'%'); }
    if (sdate) { conds.push('date(s.created_at)>=?'); params.push(sdate); countParams.push(sdate); }
    if (edate) { conds.push('date(s.created_at)<=?'); params.push(edate); countParams.push(edate); }
    const where = conds.length ? ` WHERE ${conds.join(' AND ')}` : '';
    let sql = `SELECT DISTINCT s.id, s.uid, s.name, s.phone, s.email, s.created_at, s.exam_year,
      (SELECT c2.province FROM enrollments e2 JOIN courses c2 ON e2.course_id=c2.id WHERE e2.student_id=s.id ORDER BY e2.id DESC LIMIT 1) as exam_province,
      (SELECT GROUP_CONCAT(c3.title, '；') FROM enrollments e3 JOIN courses c3 ON e3.course_id=c3.id WHERE e3.student_id=s.id) as ordered_courses,
      (SELECT MAX(o.created_at) FROM orders o WHERE o.student_id=s.id) as order_time,
      (SELECT COUNT(*) FROM enrollments e4 WHERE e4.student_id=s.id) as course_count,
      (SELECT COUNT(*) FROM course_progress cp JOIN lessons l ON cp.lesson_id=l.id WHERE cp.student_id=s.id AND cp.completed=1) as completed_lessons
      FROM students s LEFT JOIN enrollments e ON s.id=e.student_id LEFT JOIN courses c ON e.course_id=c.id${where}`;
    let countSql = `SELECT COUNT(DISTINCT s.id) as c FROM students s LEFT JOIN enrollments e ON s.id=e.student_id LEFT JOIN courses c ON e.course_id=c.id${where}`;
    sql += ` ORDER BY s.created_at DESC LIMIT ? OFFSET ?`; params.push(perPage, offset);
    students = db.query(sql, params);
    studentTotal = db.get(countSql, countParams).c;
    studentPages = Math.ceil(studentTotal/perPage);
  }

  let registered = [];
  let regTotal = 0;
  let regPages = 0;
  if (!scope || scope === 'registered') {
    let regConds = [];
    let regParams = [];
    if (rq) { regConds.push(`(s.name LIKE ? OR s.phone LIKE ? OR s.email LIKE ?)`); regParams.push('%'+rq+'%','%'+rq+'%','%'+rq+'%'); }
    if (rsdate) { regConds.push(`date(s.created_at)>=?`); regParams.push(rsdate); }
    if (redate) { regConds.push(`date(s.created_at)<=?`); regParams.push(redate); }
    const regWhere = regConds.length ? ` WHERE ${regConds.join(' AND ')}` : '';
    let regSql = `SELECT s.id, s.uid, s.username, s.name, s.real_name, s.phone, s.email, s.status, s.exam_year, s.created_at,
      (SELECT c2.province FROM enrollments e2 JOIN courses c2 ON e2.course_id=c2.id WHERE e2.student_id=s.id ORDER BY e2.id DESC LIMIT 1) as exam_province
      FROM students s${regWhere}`;
    let regCountSql = `SELECT COUNT(*) as c FROM students s${regWhere}`;
    const regListParams = regParams.slice();
    regSql += ` ORDER BY s.created_at DESC LIMIT ? OFFSET ?`;
    regListParams.push(perPage, offset);
    registered = db.query(regSql, regListParams);
    regTotal = db.get(regCountSql, regParams).c;
    regPages = Math.ceil(regTotal/perPage);
  }

  if (scope === 'students') {
    return res.json({ scope, rows: students, total: studentTotal, pages: studentPages, page });
  }
  if (scope === 'registered') {
    return res.json({ scope, rows: registered, total: regTotal, pages: regPages, page });
  }
  res.json({
    students,
    registered,
    studentTotal,
    regTotal,
    studentPages,
    regPages,
    page
  });
});

module.exports = router;


// ── 官网课程管理 ──
router.get('/course-catalog', (req, res) => {
  const provinces = [
    { id: '32', name: '江苏' }, { id: '33', name: '浙江' }, { id: '34', name: '安徽' },
    { id: '35', name: '福建' }, { id: '36', name: '江西' }, { id: '37', name: '山东' },
    { id: '41', name: '河南' }, { id: '42', name: '湖北' }, { id: '43', name: '湖南' },
    { id: '44', name: '广东' }, { id: '51', name: '四川' }, { id: '61', name: '陕西' }
  ];
  res.render('teacher/course-catalog', {
    title: '官网课程管理',
    teacherName: req.session.teacherName,
    path: '/admin/course-catalog',
    provinces
  });
});

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireTeacher } = require('../middleware/auth');

function getParentOptions(excludeId) {
  let rows = db.query("SELECT id, title, year, province, class_type FROM course_packages WHERE (parent_id IS NULL OR parent_id = 0) ORDER BY title");
  if (excludeId) rows = rows.filter(function(p) { return Number(p.id) !== Number(excludeId); });
  return rows;
}

// ── Teacher: List all packages ──
router.get('/', requireTeacher, (req, res) => {
  const packages = db.query(`SELECT p.*,
    (SELECT COUNT(*) FROM course_package_courses pc WHERE pc.package_id = p.id) as course_count,
    (SELECT COUNT(*) FROM course_packages cp WHERE cp.parent_id = p.id) as child_count,
    (SELECT title FROM course_packages pp WHERE pp.id = p.parent_id) as parent_title
    FROM course_packages p ORDER BY p.parent_id, p.title ASC`);
  res.render('teacher/packages', { title: '课程包管理', teacherName: req.session.teacherName, packages });
});

// ── Teacher: New package form ──
router.get('/new', requireTeacher, (req, res) => {
  const parentId = parseInt(req.query.parent_id) || 0;
  res.render('teacher/package-form', {
    title: '新建课程包',
    teacherName: req.session.teacherName,
    pkg: null,
    parents: getParentOptions(0),
    parentId,
    error: null
  });
});

// ── Teacher: Create package ──
router.post('/', requireTeacher, (req, res) => {
  const { title, description, year, province, class_type, price, status } = req.body;
  const parentId = parseInt(req.body.parent_id) || 0;
  if (!title) {
    return res.render('teacher/package-form', {
      title: '新建课程包',
      teacherName: req.session.teacherName,
      pkg: req.body,
      parents: getParentOptions(0),
      parentId,
      error: '名称不能为空'
    });
  }
  db.run('INSERT INTO course_packages (teacher_id, title, description, year, province, class_type, price, status, parent_id) VALUES (?,?,?,?,?,?,?,?,?)',
    [req.session.teacherId, title, description || '', year || '', province || '', class_type || '', price || '0', status || 'archived', parentId || 0]);
  res.redirect(parentId ? '/admin/packages-manage/' + parentId : '/admin/packages-manage');
});

// ── Teacher: AJAX create package from course form ──
router.post('/api/create', requireTeacher, (req, res) => {
  const { title, description, year, province, class_type, exam_type, price, sale_price, status, parent_id, level, start_date, end_date } = req.body;
  if (!title) return res.status(400).json({ ok: false, error: '名称不能为空' });
  const parentId = parseInt(parent_id) || 0;
  const pkgLevel = parseInt(level) || (parentId ? 2 : 1);
  if (pkgLevel === 2) {
    if (!parentId) return res.status(400).json({ ok: false, error: '请先选择一级课程包' });
    const parent = db.get('SELECT id, parent_id FROM course_packages WHERE id = ?', [parentId]);
    if (!parent || (parseInt(parent.parent_id) || 0) !== 0) {
      return res.status(400).json({ ok: false, error: '上级必须是有效的一级课程包' });
    }
  }
  const sortOrder = req.body.sort_order !== undefined && req.body.sort_order !== null && req.body.sort_order !== ''
    ? (parseInt(req.body.sort_order) || 0)
    : db.get('SELECT COALESCE(MAX(sort_order),0)+1 as n FROM course_packages WHERE parent_id=?', [parentId]).n;
  const id = db.run('INSERT INTO course_packages (teacher_id, title, description, year, province, class_type, exam_type, price, sale_price, student_count, status, parent_id, sort_order, start_date, end_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [req.session.teacherId, title, description || '', year || '', province || '', class_type || '', exam_type || '专升本', price || '', sale_price || '', parseInt(req.body.student_count) || 0, status || 'archived', parentId, sortOrder, start_date || '', end_date || '']);
  res.json({ ok: true, id, title, parent_id: parentId, year: year || '', province: province || '', class_type: class_type || '', exam_type: exam_type || '专升本', price: price || '', sale_price: sale_price || '', student_count: parseInt(req.body.student_count) || 0, status: status || 'archived', sort_order: sortOrder, start_date: start_date || '', end_date: end_date || '' });
});

// ── Teacher: AJAX update package from course package form ──
router.post('/api/update', requireTeacher, (req, res) => {
  const id = parseInt(req.body.id) || 0;
  const pkg = db.get('SELECT * FROM course_packages WHERE id = ?', [id]);
  if (!pkg) return res.status(404).json({ ok: false, error: '课程包不存在' });
  const { title, description, year, province, class_type, exam_type, price, sale_price, status, parent_id, sort_order, start_date, end_date } = req.body;
  if (!title) return res.status(400).json({ ok: false, error: '名称不能为空' });
  const isLevel1 = !(parseInt(pkg.parent_id) || 0);
  const parentId = isLevel1 ? 0 : (parseInt(parent_id) || 0);
  if (!isLevel1 && parentId) {
    const parent = db.get('SELECT id, parent_id FROM course_packages WHERE id = ?', [parentId]);
    if (!parent || (parseInt(parent.parent_id) || 0) !== 0) {
      return res.status(400).json({ ok: false, error: '上级必须是有效的一级课程包' });
    }
  }
  const nextSort = sort_order !== undefined && sort_order !== null && sort_order !== '' ? parseInt(sort_order) || 0 : (parseInt(pkg.sort_order) || 0);
  db.run('UPDATE course_packages SET title=?, description=?, year=?, province=?, class_type=?, exam_type=?, price=?, sale_price=?, student_count=?, status=?, parent_id=?, sort_order=?, start_date=?, end_date=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [title, description || '', year || '', province || '', class_type || '', exam_type || pkg.exam_type || '专升本', price || '', sale_price !== undefined && sale_price !== null ? sale_price : (pkg.sale_price || ''), parseInt(req.body.student_count) || 0, status || 'archived', parentId, nextSort, start_date !== undefined ? start_date : (pkg.start_date || ''), end_date !== undefined ? end_date : (pkg.end_date || ''), id]);
  if ((parseInt(pkg.parent_id) || 0) !== 0 && status === 'published') {
    db.run(`UPDATE courses SET status='published', updated_at=CURRENT_TIMESTAMP WHERE id IN (SELECT course_id FROM course_package_courses WHERE package_id=?)`, [id]);
  }
  res.json({ ok: true, id, title, parent_id: parentId, year, province, class_type, exam_type: exam_type || pkg.exam_type || '专升本', price, sale_price: sale_price !== undefined && sale_price !== null ? sale_price : (pkg.sale_price || ''), student_count: parseInt(req.body.student_count) || 0, status, sort_order: nextSort, start_date: start_date !== undefined ? start_date : (pkg.start_date || ''), end_date: end_date !== undefined ? end_date : (pkg.end_date || '') });
});

// ── Teacher: AJAX reorder package among siblings ──
router.post('/api/reorder', requireTeacher, (req, res) => {
  const id = parseInt(req.body.id) || 0;
  const direction = parseInt(req.body.direction) || 0;
  const pkg = db.get('SELECT * FROM course_packages WHERE id = ?', [id]);
  if (!pkg) return res.status(404).json({ ok: false, error: '课程包不存在' });
  const parentId = parseInt(pkg.parent_id) || 0;
  let siblings;
  if (parentId === 0) {
    siblings = db.query('SELECT id, sort_order FROM course_packages WHERE parent_id IS NULL OR parent_id=0 ORDER BY sort_order ASC, id ASC');
  } else {
    siblings = db.query('SELECT id, sort_order FROM course_packages WHERE parent_id=? ORDER BY sort_order ASC, id ASC', [parentId]);
  }
  let idx = -1;
  for (let i = 0; i < siblings.length; i++) { if (parseInt(siblings[i].id) === id) { idx = i; break; } }
  if (idx < 0) return res.status(400).json({ ok: false, error: '排序失败' });
  const target = idx + direction;
  if (target < 0 || target >= siblings.length) return res.json({ ok: true, id });
  const a = siblings[idx], b = siblings[target];
  db.run('UPDATE course_packages SET sort_order=? WHERE id=?', [b.sort_order, a.id]);
  db.run('UPDATE course_packages SET sort_order=? WHERE id=?', [a.sort_order, b.id]);
  res.json({ ok: true, id, direction });
});

// ── Teacher: AJAX update package display order ──
router.post('/api/sort', requireTeacher, (req, res) => {
  const id = parseInt(req.body.id) || 0;
  const sortOrder = parseInt(req.body.sort_order) || 0;
  const pkg = db.get('SELECT id FROM course_packages WHERE id = ?', [id]);
  if (!pkg) return res.status(404).json({ ok: false, error: '课程包不存在' });
  db.run('UPDATE course_packages SET sort_order=? WHERE id=?', [sortOrder, id]);
  res.json({ ok: true, id, sort_order: sortOrder });
});

// ── Teacher: AJAX list courses under a second-level package ──
router.get('/api/courses/:id', requireTeacher, (req, res) => {
  const id = parseInt(req.params.id) || 0;
  const courses = db.query(`SELECT c.*, t.display_name as teacher_name,
    (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) as lesson_count,
    (SELECT GROUP_CONCAT(pp.title, '；') FROM course_package_courses pc2 JOIN course_packages pp ON pp.id = pc2.package_id WHERE pc2.course_id = c.id) as package_titles,
    (SELECT GROUP_CONCAT(pc2.package_id, ',') FROM course_package_courses pc2 WHERE pc2.course_id = c.id) as package_ids
    FROM courses c JOIN course_package_courses pc ON pc.course_id = c.id
    LEFT JOIN teachers t ON c.teacher_id = t.id
    WHERE pc.package_id = ? ORDER BY c.title`, [id]);
  res.json({ ok: true, courses });
});

// ── Teacher: AJAX delete package ──
router.post('/api/delete', requireTeacher, (req, res) => {
  const id = parseInt(req.body.id) || 0;
  const pkg = db.get('SELECT * FROM course_packages WHERE id = ?', [id]);
  if (!pkg) return res.status(404).json({ ok: false, error: '课程包不存在' });
  const children = db.get('SELECT COUNT(*) as c FROM course_packages WHERE parent_id = ?', [id]).c;
  if (children > 0) return res.status(400).json({ ok: false, error: '请先删除下级课程包' });
  db.run('DELETE FROM course_package_courses WHERE package_id = ?', [id]);
  db.run('DELETE FROM course_packages WHERE id = ?', [id]);
  res.json({ ok: true, id });
});

// ── Teacher: Delete package ──
router.post('/:id/delete', requireTeacher, (req, res) => {
  const pkg = db.get('SELECT * FROM course_packages WHERE id = ?', [req.params.id]);
  if (!pkg) return res.redirect('/admin/packages-manage');
  const children = db.get('SELECT COUNT(*) as c FROM course_packages WHERE parent_id = ?', [pkg.id]).c;
  if (children > 0) return res.redirect('/admin/packages-manage/' + pkg.id);
  db.run('DELETE FROM course_package_courses WHERE package_id = ?', [pkg.id]);
  db.run('DELETE FROM course_packages WHERE id = ?', [pkg.id]);
  res.redirect('/admin/packages-manage');
});

// ── Teacher: Package detail (first-level shows child packages, second-level shows courses) ──
router.get('/:id', requireTeacher, (req, res) => {
  const pkg = db.get('SELECT * FROM course_packages WHERE id = ?', [req.params.id]);
  if (!pkg) return res.redirect('/admin/packages-manage');

  const children = db.query(`SELECT p.*,
    (SELECT COUNT(*) FROM course_package_courses pc WHERE pc.package_id = p.id) as course_count
    FROM course_packages p WHERE p.parent_id = ? ORDER BY p.title ASC, p.created_at DESC`, [pkg.id]);

  const courses = db.query(`SELECT c.*, t.display_name as teacher_name
    FROM courses c JOIN course_package_courses pc ON pc.course_id = c.id
    LEFT JOIN teachers t ON c.teacher_id = t.id
    WHERE pc.package_id = ? ORDER BY c.created_at`, [pkg.id]);

  let scheduleRows = [];
  if (courses.length > 0) {
    const ids = courses.map(function(c) { return parseInt(c.id, 10); }).join(',');
    scheduleRows = db.query(`SELECT l.*, c.title as course_title
      FROM lessons l JOIN courses c ON c.id = l.course_id
      WHERE l.course_id IN (${ids})
      ORDER BY l.schedule_time IS NULL, l.schedule_time, c.title, l.order_index`);
  }

  const availableCourses = db.query("SELECT c.id, c.title, c.category FROM courses c WHERE c.status = 'published' AND c.id NOT IN (SELECT course_id FROM course_package_courses WHERE package_id = ?) ORDER BY c.title", [pkg.id]);
  const parentTitle = pkg.parent_id ? (db.get('SELECT title FROM course_packages WHERE id = ?', [pkg.parent_id]) || {}).title || '' : '';

  res.render('teacher/package-detail', {
    title: `${pkg.title} · 课程包`,
    teacherName: req.session.teacherName,
    pkg,
    children,
    courses,
    scheduleRows,
    availableCourses,
    parentTitle
  });
});

// ── Teacher: Edit package form ──
router.get('/:id/edit', requireTeacher, (req, res) => {
  const pkg = db.get('SELECT * FROM course_packages WHERE id = ?', [req.params.id]);
  if (!pkg) return res.redirect('/admin/packages-manage');
  res.render('teacher/package-form', {
    title: '编辑课程包',
    teacherName: req.session.teacherName,
    pkg,
    parents: getParentOptions(pkg.id),
    parentId: pkg.parent_id || 0,
    error: null
  });
});

// ── Teacher: Update package ──
router.post('/:id', requireTeacher, (req, res) => {
  const { title, description, year, province, class_type, price, status } = req.body;
  if (!title) return res.redirect('/admin/packages-manage/' + req.params.id + '/edit');
  const parentId = parseInt(req.body.parent_id) || 0;
  db.run('UPDATE course_packages SET title=?, description=?, year=?, province=?, class_type=?, price=?, status=?, parent_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [title, description || '', year || '', province || '', class_type || '', price || '0', status || 'archived', parentId, req.params.id]);
  if ((parseInt(pkg.parent_id) || 0) !== 0 && status === 'published') {
    db.run(`UPDATE courses SET status='published', updated_at=CURRENT_TIMESTAMP WHERE id IN (SELECT course_id FROM course_package_courses WHERE package_id=?)`, [req.params.id]);
  }
  res.redirect('/admin/packages-manage/' + req.params.id);
});

// ── Teacher: Add existing course to package ──
router.post('/:id/courses', requireTeacher, (req, res) => {
  const courseId = parseInt(req.body.course_id) || 0;
  if (courseId) {
    db.run('INSERT OR IGNORE INTO course_package_courses (package_id, course_id) VALUES (?,?)', [req.params.id, courseId]);
  }
  res.redirect('/admin/packages-manage/' + req.params.id);
});

// ── Teacher: Remove course from package ──
router.post('/:id/courses/:courseId/remove', requireTeacher, (req, res) => {
  db.run('DELETE FROM course_package_courses WHERE package_id=? AND course_id=?', [req.params.id, req.params.courseId]);
  res.redirect('/admin/packages-manage/' + req.params.id);
});

// ── Student: View package → second-level package or courses ──
router.get('/s/:id', (req, res) => {
  res.redirect('/packages/' + req.params.id);
});

module.exports = router;

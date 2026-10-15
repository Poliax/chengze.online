const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db');
const { requireTeacher } = require('../middleware/auth');

const PROV_DIR = path.join(__dirname, '..', 'public', 'provinces');
if (!fs.existsSync(PROV_DIR)) fs.mkdirSync(PROV_DIR, { recursive: true });

const STANDARD_SUBJECTS = ['英语','数学','语文','计算机','政治','管理学','教育学','医学','会计','经济学','法学','艺术','体育'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PROV_DIR),
  filename: (req, file, cb) => {
    const p = req.body.code || req.body.provCode || 'prov';
    const type = req.body.fileType || 'outline';
    const sid = req.params.sid ? '_s' + req.params.sid : '';
    cb(null, p + sid + '_' + type + '_' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

function parseSubjects(v) {
  let arr = [];
  try { arr = JSON.parse(v || '[]'); } catch(e) {}
  if (!Array.isArray(arr)) return [];
  return arr.map(function(s) {
    if (typeof s === 'string') return { standard: s, name: s, outline_file: '', papers_file: '', type: '' };
    return {
      standard: s.standard || s.name || '',
      name: s.name || s.standard || '',
      outline_file: s.outline_file || '',
      papers_file: s.papers_file || '',
      type: s.type || ''
    };
  }).filter(function(s) { return s.name; });
}

function parseSchedule(v) {
  let arr = [];
  try { arr = JSON.parse(v || '[]'); } catch(e) {}
  return Array.isArray(arr) ? arr.filter(function(s) { return s && (s.month || s.event); }) : [];
}

function parseJsonArray(v) {
  let arr = [];
  try { arr = JSON.parse(v || '[]'); } catch(e) {}
  return Array.isArray(arr) ? arr : [];
}

function parseDocs(v) {
  return parseJsonArray(v).map(function(d) {
    return { title: (d.title || '').toString().trim(), url: (d.url || '').toString().trim() };
  }).filter(function(d) { return d.title; });
}

function parseColleges(v) {
  return parseJsonArray(v).map(function(s) {
    return typeof s === 'string' ? s.trim() : ((s.name || '').toString().trim());
  }).filter(Boolean);
}

function parseYears(v) {
  if (Array.isArray(v)) return v.map(String).map(function(s){ return s.trim(); }).filter(Boolean);
  if (typeof v === 'string' && v.indexOf('[') === -1) {
    return v.split(/[,，、\s]+/).map(function(s){ return s.trim(); }).filter(Boolean);
  }
  let arr = [];
  try { arr = JSON.parse(v || '[]'); } catch(e) {}
  return Array.isArray(arr) ? arr.map(String).map(function(s){ return s.trim(); }).filter(Boolean) : [];
}

function parseExamSchedule(v) {
  let arr = [];
  try { arr = JSON.parse(v || '[]'); } catch(e) {}
  return Array.isArray(arr) ? arr.map(function(x) {
    return { year: (x.year || '').toString().trim(), exam_time: (x.exam_time || '').toString().trim() };
  }).filter(function(x) { return x.year || x.exam_time; }) : [];
}

function parseCategories(v) {
  let arr = [];
  try { arr = JSON.parse(v || '[]'); } catch(e) {}
  return Array.isArray(arr) ? arr.map(function(c) {
    return {
      name: (c.name || '').toString().trim(),
      kind: c.kind === 'undergrad' ? 'undergrad' : 'junior',
      link_category_name: (c.link_category_name || '').toString().trim(),
      majors: Array.isArray(c.majors) ? c.majors.map(function(m) {
        return typeof m === 'string' ? m.trim() : ((m.name || '').toString().trim());
      }).filter(Boolean) : [],
      subject_ids: Array.isArray(c.subject_ids) ? c.subject_ids.map(Number) : []
    };
  }).filter(function(c) { return c.name; }) : [];
}

function loadCategories(p) {
  const cats = db.query('SELECT * FROM province_categories WHERE province_id=? ORDER BY kind, order_index, id', [p.id]);
  const undergradMap = {};
  cats.filter(function(c) { return c.kind === 'undergrad'; }).forEach(function(c) {
    undergradMap[c.id] = c.name || '';
  });
  return cats.map(function(c) {
    const rows = db.query('SELECT subject_id FROM province_category_subjects WHERE category_id=?', [c.id]);
    const majors = db.query('SELECT name FROM province_majors WHERE category_id=? ORDER BY order_index, id', [c.id]);
    return {
      id: c.id,
      name: c.name || '',
      kind: c.kind || 'junior',
      link_category_name: undergradMap[c.link_category_id] || '',
      majors: majors.map(function(r) { return r.name; }),
      subject_ids: rows.map(function(r) { return r.subject_id; })
    };
  });
}

function saveProvinceCategories(provinceId, cats) {
  const old = db.query('SELECT id FROM province_categories WHERE province_id=?', [provinceId]);
  old.forEach(function(c) {
    db.run('DELETE FROM province_category_subjects WHERE category_id=?', [c.id]);
    db.run('DELETE FROM province_majors WHERE category_id=?', [c.id]);
  });
  db.run('DELETE FROM province_categories WHERE province_id=?', [provinceId]);
  const idMap = {};
  (cats || []).forEach(function(c, idx) {
    db.run('INSERT INTO province_categories (province_id, name, kind, link_category_id, order_index) VALUES (?,?,?,?,?)',
      [provinceId, c.name, c.kind || 'junior', 0, idx]);
    const cat = db.get('SELECT id FROM province_categories WHERE province_id=? AND name=? AND kind=? AND order_index=?',
      [provinceId, c.name, c.kind || 'junior', idx]);
    if (cat) {
      idMap[(c.kind || 'junior') + ':' + c.name] = cat.id;
      (c.majors || []).forEach(function(m, mi) {
        db.run('INSERT INTO province_majors (category_id, name, order_index) VALUES (?,?,?)', [cat.id, m, mi]);
      });
      (c.subject_ids || []).forEach(function(sid) {
        db.run('INSERT INTO province_category_subjects (category_id, subject_id) VALUES (?,?)', [cat.id, sid]);
      });
    }
  });
  (cats || []).forEach(function(c) {
    if (c.kind !== 'junior' || !c.link_category_name) return;
    const srcId = idMap['junior:' + c.name];
    const dstId = idMap['undergrad:' + c.link_category_name];
    if (srcId && dstId) {
      db.run('UPDATE province_categories SET link_category_id=? WHERE id=?', [dstId, srcId]);
    }
  });
}

function parseAdmissions(v) {
  return parseJsonArray(v).map(function(a) {
    return {
      year: (a.year || '').toString().trim(),
      university: (a.university || '').toString().trim(),
      major: (a.major || '').toString().trim(),
      plan: (a.plan != null ? a.plan : ''),
      score: (a.score != null ? a.score : '')
    };
  }).filter(function(a) { return a.university || a.major; });
}

function loadProvinceRows(p) {
  const rows = db.query('SELECT * FROM province_subjects WHERE province_id=? ORDER BY order_index, id', [p.id]);
  return rows.map(function(r) {
    return {
      id: r.id,
      standard: r.standard || '',
      name: r.name || r.standard || '',
      outline_file: r.outline_file || '',
      papers_file: r.papers_file || '',
      type: r.type || ''
    };
  });
}

function subjectNames(rows) {
  return rows.map(function(r) { return r.name || r.standard || ''; }).filter(Boolean);
}

function saveProvinceSubjects(provinceId, rows) {
  const existing = db.query('SELECT * FROM province_subjects WHERE province_id=? ORDER BY order_index, id', [provinceId]);
  const newIds = [];
  (rows || []).forEach(function(s, idx) {
    if (!s.name) return;
    const old = existing[idx] || null;
    if (old) {
      db.run('UPDATE province_subjects SET standard=?, name=?, type=? WHERE id=?',
        [s.standard || s.name || '', s.name, s.type || '', old.id]);
      newIds.push(old.id);
    } else {
      db.run('INSERT INTO province_subjects (province_id, standard, name, type, order_index) VALUES (?,?,?,?,?)',
        [provinceId, s.standard || s.name || '', s.name, s.type || '', idx]);
      const r = db.get('SELECT id FROM province_subjects WHERE province_id=? AND order_index=?', [provinceId, idx]);
      if (r) newIds.push(r.id);
    }
  });
  if (existing.length > (rows || []).length) {
    for (var e = (rows || []).length; e < existing.length; e++) {
      db.run('DELETE FROM province_subjects WHERE id=?', [existing[e].id]);
    }
  }
  // 清理指向已删除科目的分类关联
  const catRows = db.query('SELECT id FROM province_categories WHERE province_id=?', [provinceId]);
  catRows.forEach(function(cat) {
    const maps = db.query('SELECT id, subject_id FROM province_category_subjects WHERE category_id=?', [cat.id]);
    maps.forEach(function(m) {
      if (newIds.indexOf(m.subject_id) === -1) db.run('DELETE FROM province_category_subjects WHERE id=?', [m.id]);
    });
  });
  db.run('UPDATE provinces SET subjects=? WHERE id=?', [JSON.stringify(subjectNames(rows)), provinceId]);
}

// Admin: List provinces
router.get('/provinces-manage', requireTeacher, (req, res) => {
  const q = (req.query.q || '').trim();
  const allProvinces = db.query('SELECT * FROM provinces ORDER BY id').map(function(p) {
    p.subjectRows = loadProvinceRows(p);
    p.scheduleRows = parseSchedule(p.schedule);
    p.yearsList = parseYears(p.years);
    p.examSchedule = parseExamSchedule(p.exam_schedule);
    p.categories = loadCategories(p);
    p.docs = parseDocs(p.official_docs);
    p.juniorList = parseColleges(p.junior_colleges);
    p.undergradList = parseColleges(p.undergrad_colleges);
    p.admissionRows = parseAdmissions(p.admissions);
    p.courseList = db.query(`
      SELECT c.id, c.title, c.status, GROUP_CONCAT(cs.subject, ', ') as subjects
      FROM courses c LEFT JOIN course_subjects cs ON cs.course_id=c.id
      WHERE c.province=? OR c.province=?
      GROUP BY c.id ORDER BY c.id DESC`, [p.name, p.name + '省']);
    const offeredSet = [];
    (p.courseList || []).forEach(function(c) {
      String(c.subjects || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean).forEach(function(s) {
        if (offeredSet.indexOf(s) === -1) offeredSet.push(s);
      });
    });
    p.offeredSubjects = offeredSet;
    return p;
  });
  const provinces = q
    ? allProvinces.filter(function(p) {
        const kw = q.toLowerCase();
        const subjectHit = (p.subjectRows || []).some(function(s) {
          return String(s.name || '').toLowerCase().indexOf(kw) > -1 || String(s.standard || '').toLowerCase().indexOf(kw) > -1;
        });
        return String(p.name || '').toLowerCase().indexOf(kw) > -1 || String(p.code || '').toLowerCase().indexOf(kw) > -1 || subjectHit;
      })
    : allProvinces;
  res.render('teacher/provinces', {
    title: '省份管理 · 管理后台',
    teacherName: req.session.teacherName,
    provinces,
    q
  });
});

// Admin: Create province form
router.get('/provinces-manage/new', requireTeacher, (req, res) => {
  res.render('teacher/province-form', {
    title: '创建省份 · 管理后台',
    teacherName: req.session.teacherName,
    prov: null,
    subjectRows: [],
    scheduleRows: [],
    docs: [],
    juniorList: [],
    undergradList: [],
    admissionRows: [],
    yearsList: [],
    examSchedule: [],
    categories: [],
    subjects: STANDARD_SUBJECTS,
    error: null
  });
});

// Admin: Create province
router.post('/provinces-manage', requireTeacher, (req, res) => {
  const name = (req.body.name || '').trim();
  const code = (req.body.code || '').trim();
  if (!name || !code) {
    return res.render('teacher/province-form', {
      title: '创建省份 · 管理后台',
      teacherName: req.session.teacherName,
      prov: { name, code, exam_time: req.body.exam_time || '', years: req.body.years || '' },
      examSchedule: parseExamSchedule(req.body.exam_schedule_json),
      categories: parseCategories(req.body.categories_json),
      subjectRows: parseSubjects(req.body.subjects_json),
      scheduleRows: parseSchedule(req.body.schedule_json),
      yearsList: parseYears(req.body.years),
      docs: parseDocs(req.body.official_docs_json),
      juniorList: parseColleges(req.body.junior_colleges_json),
      undergradList: parseColleges(req.body.undergrad_colleges_json),
      admissionRows: parseAdmissions(req.body.admissions_json),
      subjects: STANDARD_SUBJECTS,
      error: '名称和简称不能为空'
    });
  }
  const subjectRows = parseSubjects(req.body.subjects_json);
  const scheduleRows = parseSchedule(req.body.schedule_json);
  const docs = parseDocs(req.body.official_docs_json);
  const juniorList = parseColleges(req.body.junior_colleges_json);
  const undergradList = parseColleges(req.body.undergrad_colleges_json);
  const admissionRows = parseAdmissions(req.body.admissions_json);
  const examTime = (req.body.exam_time || '').trim();
  const years = parseYears(req.body.years);
  const examSchedule = parseExamSchedule(req.body.exam_schedule_json);
  const categories = parseCategories(req.body.categories_json);
  const derivedYears = examSchedule.map(function(x) { return x.year; }).filter(Boolean);
  const derivedExamTime = examSchedule.length > 0 ? examSchedule[0].exam_time : examTime;
  db.run('INSERT INTO provinces (name, code, subjects, schedule, official_docs, junior_colleges, undergrad_colleges, admissions, exam_time, years, exam_schedule) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [name, code, '[]', JSON.stringify(scheduleRows), JSON.stringify(docs), JSON.stringify(juniorList), JSON.stringify(undergradList), JSON.stringify(admissionRows), derivedExamTime, JSON.stringify(derivedYears), JSON.stringify(examSchedule)]);
  const prov = db.get('SELECT * FROM provinces WHERE code=?', [code]);
  if (prov) {
    saveProvinceSubjects(prov.id, subjectRows);
    saveProvinceCategories(prov.id, categories);
    db.run('UPDATE provinces SET schedule=? WHERE id=?', [JSON.stringify(scheduleRows), prov.id]);
  }
  res.redirect('/admin/provinces-manage');
});

// Admin: Province detail
router.get('/provinces-manage/:id', requireTeacher, (req, res) => {
  const prov = db.get('SELECT * FROM provinces WHERE id=?', [req.params.id]);
  if (!prov) return res.redirect('/admin/provinces-manage');
  const subjectRows = loadProvinceRows(prov);
  const scheduleRows = parseSchedule(prov.schedule);
  const examSchedule = parseExamSchedule(prov.exam_schedule);
  const categories = loadCategories(prov);
  const docs = parseDocs(prov.official_docs);
  const juniorList = parseColleges(prov.junior_colleges);
  const undergradList = parseColleges(prov.undergrad_colleges);
  const admissionRows = parseAdmissions(prov.admissions);
  const courseList = db.query(`
    SELECT c.id, c.title, c.status, GROUP_CONCAT(cs.subject, ', ') as subjects
    FROM courses c LEFT JOIN course_subjects cs ON cs.course_id=c.id
    WHERE c.province=? OR c.province=?
    GROUP BY c.id ORDER BY c.id DESC`, [prov.name, prov.name + '省']);
  const offeredSet = [];
  (courseList || []).forEach(function(c) {
    String(c.subjects || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean).forEach(function(s) {
      if (offeredSet.indexOf(s) === -1) offeredSet.push(s);
    });
  });
  res.render('teacher/province-detail', {
    title: '省份详情 · 管理后台',
    teacherName: req.session.teacherName,
    prov,
    subjectRows,
    scheduleRows,
    examSchedule,
    categories,
    docs,
    juniorList,
    undergradList,
    admissionRows,
    courseList,
    offeredSubjects: offeredSet
  });
});

// Admin: Edit province
router.get('/provinces-manage/:id/edit', requireTeacher, (req, res) => {
  const prov = db.get('SELECT * FROM provinces WHERE id = ?', [req.params.id]);
  if (!prov) return res.redirect('/admin/provinces-manage');
  res.render('teacher/province-form', {
    title: '编辑省份 · 管理后台',
    teacherName: req.session.teacherName,
    prov,
    subjectRows: loadProvinceRows(prov),
    scheduleRows: parseSchedule(prov.schedule),
    yearsList: parseYears(prov.years),
    examSchedule: parseExamSchedule(prov.exam_schedule),
    categories: loadCategories(prov),
    docs: parseDocs(prov.official_docs),
    juniorList: parseColleges(prov.junior_colleges),
    undergradList: parseColleges(prov.undergrad_colleges),
    admissionRows: parseAdmissions(prov.admissions),
    subjects: STANDARD_SUBJECTS,
    error: null
  });
});

// Admin: Update province
router.post('/provinces-manage/:id', requireTeacher, (req, res) => {
  const name = (req.body.name || '').trim();
  const code = (req.body.code || '').trim();
  if (!name || !code) return res.redirect('/admin/provinces-manage/' + req.params.id + '/edit');
  const subjectRows = parseSubjects(req.body.subjects_json);
  const scheduleRows = parseSchedule(req.body.schedule_json);
  const docs = parseDocs(req.body.official_docs_json);
  const juniorList = parseColleges(req.body.junior_colleges_json);
  const undergradList = parseColleges(req.body.undergrad_colleges_json);
  const admissionRows = parseAdmissions(req.body.admissions_json);
  const examTime = (req.body.exam_time || '').trim();
  const years = parseYears(req.body.years);
  const examSchedule = parseExamSchedule(req.body.exam_schedule_json);
  const categories = parseCategories(req.body.categories_json);
  const derivedYears = examSchedule.map(function(x) { return x.year; }).filter(Boolean);
  const derivedExamTime = examSchedule.length > 0 ? examSchedule[0].exam_time : examTime;
  db.run('UPDATE provinces SET name=?, code=?, schedule=?, official_docs=?, junior_colleges=?, undergrad_colleges=?, admissions=?, exam_time=?, years=?, exam_schedule=? WHERE id=?',
    [name, code, JSON.stringify(scheduleRows), JSON.stringify(docs), JSON.stringify(juniorList), JSON.stringify(undergradList), JSON.stringify(admissionRows), derivedExamTime, JSON.stringify(derivedYears), JSON.stringify(examSchedule), req.params.id]);
  saveProvinceSubjects(parseInt(req.params.id), subjectRows);
  saveProvinceCategories(parseInt(req.params.id), categories);
  res.redirect('/admin/provinces-manage');
});

// Admin: Update province secondary details only
router.post('/provinces-manage/:id/details', requireTeacher, (req, res) => {
  const docs = parseDocs(req.body.official_docs_json);
  const juniorList = parseColleges(req.body.junior_colleges_json);
  const undergradList = parseColleges(req.body.undergrad_colleges_json);
  const admissionRows = parseAdmissions(req.body.admissions_json);
  db.run('UPDATE provinces SET official_docs=?, junior_colleges=?, undergrad_colleges=?, admissions=? WHERE id=?',
    [JSON.stringify(docs), JSON.stringify(juniorList), JSON.stringify(undergradList), JSON.stringify(admissionRows), req.params.id]);
  res.redirect('/admin/provinces-manage/' + req.params.id + '/edit');
});

// Admin: Upload province-level outline/papers
router.post('/provinces-manage/:id/upload', requireTeacher, upload.single('file'), (req, res) => {
  if (!req.file) return res.redirect('/admin/provinces-manage/' + req.params.id + '/edit');
  const field = req.body.fileType === 'papers' ? 'papers_file' : 'outline_file';
  db.run('UPDATE provinces SET ' + field + '=? WHERE id=?', ['/provinces/' + req.file.filename, req.params.id]);
  res.redirect('/admin/provinces-manage/' + req.params.id + '/edit');
});

// Admin: Upload per-subject outline/papers
router.post('/provinces-manage/:id/subjects/:sid/upload', requireTeacher, upload.single('file'), (req, res) => {
  if (!req.file) return res.redirect('/admin/provinces-manage/' + req.params.id + '/edit');
  const field = req.body.fileType === 'papers' ? 'papers_file' : 'outline_file';
  db.run('UPDATE province_subjects SET ' + field + '=? WHERE id=?', ['/provinces/' + req.file.filename, req.params.sid]);
  res.redirect('/admin/provinces-manage/' + req.params.id + '/edit');
});

// Admin: Delete province
router.post('/provinces-manage/:id/delete', requireTeacher, (req, res) => {
  const cats = db.query('SELECT id FROM province_categories WHERE province_id=?', [req.params.id]);
  cats.forEach(function(c) { db.run('DELETE FROM province_category_subjects WHERE category_id=?', [c.id]); });
  db.run('DELETE FROM province_categories WHERE province_id=?', [req.params.id]);
  db.run('DELETE FROM province_subjects WHERE province_id=?', [req.params.id]);
  db.run('DELETE FROM provinces WHERE id=?', [req.params.id]);
  res.redirect('/admin/provinces-manage');
});

// Student: View province
router.get('/p/:code', (req, res) => {
  const prov = db.get('SELECT * FROM provinces WHERE code = ?', [req.params.code]);
  if (!prov) return res.redirect('/live/student');
  const subjectRows = loadProvinceRows(prov);
  const subjects = subjectNames(subjectRows);
  const scheduleRows = parseSchedule(prov.schedule);
  res.render('student/province', {
    title: prov.name + '专升本 · 承泽教育',
    prov,
    subjects,
    subjectRows,
    scheduleRows,
    years: parseYears(prov.years),
    examSchedule: parseExamSchedule(prov.exam_schedule),
    categories: loadCategories(prov),
    docs: parseDocs(prov.official_docs),
    juniorList: parseColleges(prov.junior_colleges),
    undergradList: parseColleges(prov.undergrad_colleges),
    admissionRows: parseAdmissions(prov.admissions)
  });
});

function provinceJson(prov) {
  const subjectRows = loadProvinceRows(prov);
  return {
    ...prov,
    subjects: subjectNames(subjectRows),
    subjectRows: subjectRows,
    schedule: parseSchedule(prov.schedule),
    years: parseYears(prov.years),
    examSchedule: parseExamSchedule(prov.exam_schedule),
    categories: loadCategories(prov),
    officialDocs: parseDocs(prov.official_docs),
    juniorColleges: parseColleges(prov.junior_colleges),
    undergradColleges: parseColleges(prov.undergrad_colleges),
    admissions: parseAdmissions(prov.admissions)
  };
}

// API: 官网省份列表（只返回后台创建的省份）
router.get('/api', (req, res) => {
  const rows = db.query('SELECT * FROM provinces ORDER BY CAST(code AS INTEGER)');
  res.json({ provinces: rows.map(provinceJson) });
});

// API: Province data for homepage
router.get('/api/:code', (req, res) => {
  const prov = db.get('SELECT * FROM provinces WHERE code = ?', [req.params.code]);
  if (!prov) return res.json(null);
  res.json(provinceJson(prov));
});

module.exports = router;

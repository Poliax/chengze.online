const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const XLSX = require('xlsx');
const db = require('../db');
const { requireTeacher } = require('../middleware/auth');

function seedIfEmpty() {
  try {
    const n = db.get('SELECT COUNT(*) as c FROM questions').c || 0;
    if (n === 0) {
      const qs = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'questions.json'), 'utf8'));
      qs.forEach(function(q) {
        db.run('INSERT INTO questions (subject, lesson_id, content, options, answer, explanation, source) VALUES (?,?,?,?,?,?,?)',
          [q.subject || '', q.lesson_id || 0, q.content || '', JSON.stringify(q.options || []), q.answer || 0, q.explanation || '', '题库导入']);
      });
      try { db.saveDb(); } catch(e) {}
    }
  } catch(e) {}
}

function listQuestions() {
  const rows = db.query('SELECT q.*, l.title as lesson_title FROM questions q LEFT JOIN lessons l ON l.id=q.lesson_id ORDER BY q.id DESC');
  rows.forEach(function(r) { try { r.options = JSON.parse(r.options || '[]'); } catch(e) { r.options = []; } });
  return rows;
}

router.get('/', requireTeacher, (req, res) => {
  seedIfEmpty();
  res.render('teacher/questions', {
    title: '题库管理',
    teacherName: req.session.teacherName,
    questions: listQuestions(),
    msg: null
  });
});

router.post('/', requireTeacher, (req, res) => {
  const b = req.body || {};
  const subject = String(b.subject || '').trim();
  const content = String(b.content || '').trim();
  if (!subject || !content) {
    return res.render('teacher/questions', {
      title: '题库管理',
      teacherName: req.session.teacherName,
      questions: listQuestions(),
      msg: '请填写科目和题目'
    });
  }
  const options = [String(b.option1 || '').trim(), String(b.option2 || '').trim(), String(b.option3 || '').trim(), String(b.option4 || '').trim()];
  const answer = Math.max(0, Math.min(3, parseInt(b.answer, 10) || 0));
  const lessonId = parseInt(b.lesson_id, 10) || 0;
  db.run('INSERT INTO questions (subject, lesson_id, content, options, answer, explanation, source) VALUES (?,?,?,?,?,?,?)',
    [subject, lessonId, content, JSON.stringify(options), answer, String(b.explanation || '').trim(), '教师上传']);
  try { db.saveDb(); } catch(e) {}
  res.redirect('/admin/questions-manage');
});

const importStorage = multer.memoryStorage();
const importUpload = multer({ storage: importStorage });

router.post('/import', requireTeacher, importUpload.single('file'), (req, res) => {
  if (!req.file) return res.redirect('/admin/questions-manage');
  try {
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    let count = 0;
    rows.forEach(function(r) {
      const subject = String(r['科目'] || r.subject || '').trim();
      const content = String(r['题目'] || r.content || '').trim();
      if (!subject || !content) return;
      const options = [
        String(r['选项1'] || r.option1 || '').trim(),
        String(r['选项2'] || r.option2 || '').trim(),
        String(r['选项3'] || r.option3 || '').trim(),
        String(r['选项4'] || r.option4 || '').trim()
      ];
      const ansText = String(r['答案'] || r.answer || '1').trim();
      let answer = 0;
      if (/^[A-Da-d]$/.test(ansText)) answer = 'ABCD'.indexOf(ansText.toUpperCase());
      else answer = Math.max(0, Math.min(3, parseInt(ansText, 10) - 1 || 0));
      const lessonId = parseInt(r['课时ID'] || r.lesson_id || 0, 10) || 0;
      db.run('INSERT INTO questions (subject, lesson_id, content, options, answer, explanation, source) VALUES (?,?,?,?,?,?,?)',
        [subject, lessonId, content, JSON.stringify(options), answer, String(r['解析'] || r.explanation || '').trim(), 'Excel导入']);
      count++;
    });
    try { db.saveDb(); } catch(e) {}
    return res.render('teacher/questions', {
      title: '题库管理',
      teacherName: req.session.teacherName,
      questions: listQuestions(),
      msg: 'Excel 导入成功：' + count + ' 题'
    });
  } catch (e) {
    return res.render('teacher/questions', {
      title: '题库管理',
      teacherName: req.session.teacherName,
      questions: listQuestions(),
      msg: '导入失败：' + (e.message || '文件格式错误')
    });
  }
});

router.post('/:id/delete', requireTeacher, (req, res) => {
  db.run('DELETE FROM questions WHERE id=?', [req.params.id]);
  try { db.saveDb(); } catch(e) {}
  res.redirect('/admin/questions-manage');
});

module.exports = router;

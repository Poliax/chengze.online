const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');

// Teacher login page
router.get('/login', (req, res) => {
  if (req.session.teacherId) {
    const account=require('../lib/admin-access').sessionAccount(db,req.session);
    return res.redirect(account && account.role==='ceo'?'/admin/dashboard':'/admin/workspace');
  }
  res.render('teacher/login', { title: '承泽在线 - 管理后台', error: null });
});

// Teacher login handler
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.render('teacher/login', { title: '承泽在线 - 管理后台', error: '请输入用户名和密码' });
  }

  const teacher = db.get('SELECT * FROM teachers WHERE username = ?', [username]);
  
  if (!teacher) {
    return res.render('teacher/login', { title: '承泽在线 - 管理后台', error: '用户名或密码错误' });
  }

  const account = require('../lib/admin-access').load(db, teacher.id);
  if (!account || account.status !== 'active') {
    return res.render('teacher/login', { title: '承泽在线 - 管理后台', error: '该账号未开通后台权限或已停用' });
  }

  const valid = bcrypt.compareSync(password, teacher.password_hash);
  if (!valid) {
    return res.render('teacher/login', { title: '承泽在线 - 管理后台', error: '用户名或密码错误' });
  }

  return req.session.regenerate(err => {
  if (err) return res.status(500).send('登录失败，请重试');
  req.session.adminVersion = account.session_version;
  req.session.teacherId = teacher.id;
  req.session.teacherName = teacher.display_name;
  req.session.teacherAvatar = teacher.avatar;
  
  req.session.save(err => {
    if (err) return res.status(500).send('登录失败，请重试');
    res.redirect(account.role==='ceo'?'/admin/dashboard':'/admin/workspace');
  });
  });
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

module.exports = router;

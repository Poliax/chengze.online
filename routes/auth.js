const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');

// Teacher login page
router.get('/login', (req, res) => {
  if (req.session.teacherId) {
    return res.redirect('/admin/dashboard');
  }
  res.render('teacher/login', { title: '承泽教育 - 管理后台', error: null });
});

// Teacher login handler
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.render('teacher/login', { title: '承泽教育 - 管理后台', error: '请输入用户名和密码' });
  }

  const teacher = db.get('SELECT * FROM teachers WHERE username = ?', [username]);
  
  if (!teacher) {
    return res.render('teacher/login', { title: '承泽教育 - 管理后台', error: '用户名或密码错误' });
  }

  if (teacher.username !== 'admin') {
    return res.render('teacher/login', { title: '承泽教育 - 管理后台', error: '该账号已停用，仅管理员可登录' });
  }

  const valid = bcrypt.compareSync(password, teacher.password_hash);
  if (!valid) {
    return res.render('teacher/login', { title: '承泽教育 - 管理后台', error: '用户名或密码错误' });
  }

  req.session.teacherId = teacher.id;
  req.session.teacherName = teacher.display_name;
  req.session.teacherAvatar = teacher.avatar;
  
  res.redirect('/admin/dashboard');
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

module.exports = router;

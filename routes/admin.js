const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'schedule.json');
const ADMIN_PASSWORD = '1';

// Ensure data dir
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

// Load schedule data (merged with province-data defaults on first run)
function loadSchedule() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveSchedule(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// GET /admin - admin login page
router.get('/', (req, res) => {
  // Check if already logged in
  if (req.session.adminLoggedIn) {
    const schedule = loadSchedule();
    return res.render('admin', { 
      schedule: JSON.stringify(schedule, null, 2),
      provinces: ['zhejiang','shandong','henan','guangdong','jiangsu','sichuan','fujian','hunan','anhui','shaanxi','hubei','jiangxi'],
      provinceNames: { zhejiang:'浙江', shandong:'山东', henan:'河南', guangdong:'广东', jiangsu:'江苏', sichuan:'四川', fujian:'福建', hunan:'湖南', anhui:'安徽', shaanxi:'陕西', hubei:'湖北', jiangxi:'江西' },
      message: ''
    });
  }
  res.render('admin-login', { error: '' });
});

// POST /admin/login
router.post('/login', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    req.session.adminLoggedIn = true;
    return res.redirect('/admin');
  }
  res.render('admin-login', { error: '密码错误' });
});

// POST /admin/logout
router.post('/logout', (req, res) => {
  req.session.adminLoggedIn = false;
  res.redirect('/admin');
});

// POST /admin/save
router.post('/save', (req, res) => {
  if (!req.session.adminLoggedIn) {
    return res.status(401).json({ error: '未登录' });
  }
  try {
    const data = JSON.parse(req.body.data);
    saveSchedule(data);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: 'JSON 格式错误: ' + e.message });
  }
});

// API: GET /api/schedule/:province — for frontend
// This is handled by a separate route below
module.exports = router;

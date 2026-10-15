const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { requireTeacher } = require('../middleware/auth');

const AD_FILE = path.join(__dirname, '..', 'data', 'ad-config.json');

function loadAd() {
  try { return JSON.parse(fs.readFileSync(AD_FILE, 'utf8')); } catch (e) { return {}; }
}

router.get('/', requireTeacher, (req, res) => {
  res.render('teacher/ads', {
    title: '广告管理',
    teacherName: req.session.teacherName,
    ad: loadAd(),
    msg: null
  });
});

router.post('/', requireTeacher, (req, res) => {
  const body = req.body || {};
  const ad = {
    enabled: body.enabled === 'on' || body.enabled === '1' || body.enabled === true,
    title: String(body.title || '').trim(),
    subtitle: String(body.subtitle || '').trim(),
    image: String(body.image || '').trim(),
    link: String(body.link || '').trim()
  };
  try {
    fs.mkdirSync(path.dirname(AD_FILE), { recursive: true });
    fs.writeFileSync(AD_FILE, JSON.stringify(ad, null, 2));
  } catch (e) {
    return res.render('teacher/ads', {
      title: '广告管理',
      teacherName: req.session.teacherName,
      ad,
      msg: '保存失败：' + (e.message || '文件写入错误')
    });
  }
  res.render('teacher/ads', {
    title: '广告管理',
    teacherName: req.session.teacherName,
    ad,
    msg: '已保存'
  });
});

module.exports = router;

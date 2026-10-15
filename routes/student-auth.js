const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const router = express.Router();

// ── 限流状态（内存版，生产可换 Redis）──
const loginAttempts = {};   // phone -> { count, lockedUntil }
const smsCodes = {};        // phone -> { code, expiresAt }
const smsRate = {};         // phone -> { lastSentAt, count }

function cleanRate() {
  const now = Date.now();
  for (const k in loginAttempts) {
    if (loginAttempts[k].lockedUntil && loginAttempts[k].lockedUntil < now) delete loginAttempts[k];
  }
}

function generateUsername() {
  let uname = '';
  do {
    uname = 'cz' + Math.floor(10000000 + Math.random() * 90000000);
  } while (db.get('SELECT id FROM students WHERE username=?', [uname]));
  return uname;
}

function loadLiveConfig() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'live-config.json'), 'utf8')); } catch (e) { return {}; }
}

function sendTencentSms(phone, code) {
  return new Promise(function(resolve, reject) {
    const cfg = loadLiveConfig();
    const sms = cfg.sms || {};
    if (sms.devMode || !sms.sdkAppId || !sms.signName || !sms.templateId || !cfg.tencentSecretId || !cfg.tencentSecretKey) {
      console.log(`[SMS][DEV] ${phone} 验证码: ${code}`);
      return resolve({ success: true, devCode: code });
    }
    const secretId = cfg.tencentSecretId;
    const secretKey = cfg.tencentSecretKey;
    const host = 'sms.tencentcloudapi.com';
    const service = 'sms';
    const region = sms.region || 'ap-guangzhou';
    const version = '2019-07-11';
    const payload = JSON.stringify({
      PhoneNumberSet: ['+86' + phone],
      SmsSdkAppId: sms.sdkAppId,
      SignName: sms.signName,
      TemplateId: sms.templateId,
      TemplateParamSet: [String(code)]
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
    const hashedRequest = crypto.createHash('sha256').update(payload).digest('hex');
    const canonicalRequest = [
      'POST', '/', '',
      'content-type:application/json; charset=utf-8\nhost:' + host + '\n',
      'content-type;host', hashedRequest
    ].join('\n');
    const credentialScope = date + '/' + service + '/tc3_request';
    const stringToSign = 'TC3-HMAC-SHA256\n' + timestamp + '\n' + credentialScope + '\n' +
      crypto.createHash('sha256').update(canonicalRequest).digest('hex');
    const secretDate = crypto.createHmac('sha256', 'TC3' + secretKey).update(date).digest();
    const secretService = crypto.createHmac('sha256', secretDate).update(service).digest();
    const secretSigning = crypto.createHmac('sha256', secretService).update('tc3_request').digest();
    const signature = crypto.createHmac('sha256', secretSigning).update(stringToSign).digest('hex');
    const authorization = 'TC3-HMAC-SHA256 Credential=' + secretId + '/' + credentialScope +
      ', SignedHeaders=content-type;host, Signature=' + signature;
    const body = Buffer.from(payload);
    const req = https.request({
      host,
      method: 'POST',
      path: '/',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Host: host,
        'X-TC-Action': 'SendSms',
        'X-TC-Version': version,
        'X-TC-Timestamp': String(timestamp),
        'X-TC-Region': region,
        Authorization: authorization,
        'Content-Length': body.length
      }
    }, function(res) {
      let data = '';
      res.on('data', function(d) { data += d; });
      res.on('end', function() {
        try {
          const j = JSON.parse(data);
          if (j.Response && j.Response.Error) return reject(new Error(j.Response.Error.Message || '短信发送失败'));
          return resolve({ success: true });
        } catch (e) {
          return reject(new Error('短信发送失败'));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── 发送短信验证码（腾讯云短信，未配置时走开发模式）──
router.post('/auth/send-code', (req, res) => {
  const { phone } = req.body || {};
  if (!phone || !/^1\d{10}$/.test(phone)) return res.json({ success: false, error: '请输入正确的手机号' });

  const now = Date.now();
  const rate = smsRate[phone];
  if (rate && now - rate.lastSentAt < 60 * 1000) {
    return res.json({ success: false, error: '发送过于频繁，请1分钟后再试' });
  }
  if (rate && rate.count >= 5) {
    return res.json({ success: false, error: '今日验证码次数已达上限' });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  smsCodes[phone] = { code, expiresAt: now + 5 * 60 * 1000 };
  smsRate[phone] = { lastSentAt: now, count: (rate ? rate.count : 0) + 1 };

  sendTencentSms(phone, code).then(function(result) {
    return res.json({ success: true, devCode: result.devCode || undefined, message: '验证码已发送' });
  }).catch(function(err) {
    delete smsCodes[phone];
    return res.json({ success: false, error: err.message || '验证码发送失败' });
  });
});

// ── 注册：手机号 + 短信验证码（其他资料注册后自行填写）──
router.post('/auth/register', (req, res) => {
  const { phone, code } = req.body || {};
  if (!phone || !/^1\d{10}$/.test(phone)) return res.json({ success: false, error: '请输入正确的手机号' });
  if (!code) return res.json({ success: false, error: '请输入短信验证码' });
  const password = String((req.body || {}).password || '').trim();
  if (!password) return res.json({ success: false, error: '请设置登录密码' });

  const sms = smsCodes[phone];
  if (!sms || sms.code !== code || Date.now() > sms.expiresAt) {
    return res.json({ success: false, error: '验证码错误或已过期' });
  }

  const existing = db.get('SELECT id FROM students WHERE phone = ?', [phone]);
  if (existing) return res.json({ success: false, error: '该手机号已注册，请直接登录' });

  const uid = 'CZ' + Date.now().toString().slice(-8);
  const autoName = '学员' + phone.slice(-4);
  const uname = generateUsername();
  const passwordHash = bcrypt.hashSync(password, 10);
  db.run(
    'INSERT INTO students (name, username, phone, email, password_hash, uid, wechat_nickname) VALUES (?,?,?,?,?,?,?)',
    [autoName, uname, phone, '', passwordHash, uid, '']
  );
  db.saveDb();
  delete smsCodes[phone];

  const row = db.get('SELECT id, name, username, phone, uid, wechat_nickname FROM students WHERE phone = ?', [phone]);
  req.session.studentId = row.id;
  return res.json({ success: true, user: row });
});

// ── 登录：手机号 + 密码 ──
router.post('/auth/login', (req, res) => {
  cleanRate();
  const { phone, password } = req.body || {};
  if (!phone) return res.json({ success: false, error: '请输入手机号' });
  if (!password) return res.json({ success: false, error: '请输入密码' });

  const attempts = loginAttempts[phone];
  if (attempts && attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
    return res.json({ success: false, error: '尝试次数过多，请5分钟后再试' });
  }

  const row = db.get('SELECT * FROM students WHERE phone = ?', [phone]);
  if (!row) {
    loginAttempts[phone] = { count: (attempts ? attempts.count : 0) + 1, lockedUntil: null };
    return res.json({ success: false, error: '手机号未注册' });
  }
  if (!row.password_hash) return res.json({ success: false, error: '该账号未设置密码' });
  if (!bcrypt.compareSync(password, row.password_hash)) {
    const count = (attempts ? attempts.count : 0) + 1;
    if (count >= 5) loginAttempts[phone] = { count, lockedUntil: Date.now() + 5 * 60 * 1000 };
    else loginAttempts[phone] = { count, lockedUntil: null };
    return res.json({ success: false, error: count >= 5 ? '尝试次数过多，请5分钟后再试' : '密码错误' });
  }

  delete loginAttempts[phone];
  req.session.studentId = row.id;
  return res.json({
    success: true,
    user: { id: row.id, name: row.name, username: row.username, phone: row.phone, uid: row.uid, wechat_nickname: row.wechat_nickname || '' }
  });
});

// ── 验证码登录（未注册则自动注册）──
router.post('/auth/login-code', (req, res) => {
  const { phone, code } = req.body || {};
  if (!phone || !/^1\d{10}$/.test(phone)) return res.json({ success: false, error: '请输入正确的手机号' });
  if (!code) return res.json({ success: false, error: '请输入短信验证码' });
  const sms = smsCodes[phone];
  if (!sms || sms.code !== code || Date.now() > sms.expiresAt) {
    return res.json({ success: false, error: '验证码错误或已过期' });
  }
  delete smsCodes[phone];
  let row = db.get('SELECT * FROM students WHERE phone = ?', [phone]);
  if (!row) {
    const uid = 'CZ' + Date.now().toString().slice(-8);
    const autoName = '学员' + phone.slice(-4);
    const uname = generateUsername();
    db.run('INSERT INTO students (name, username, phone, email, password_hash, uid, wechat_nickname) VALUES (?,?,?,?,?,?,?)',
      [autoName, uname, phone, '', '', uid, '']);
    db.saveDb();
    row = db.get('SELECT * FROM students WHERE phone = ?', [phone]);
  }
  req.session.studentId = row.id;
  return res.json({ success: true, user: { id: row.id, name: row.name, username: row.username, phone: row.phone, uid: row.uid, wechat_nickname: row.wechat_nickname || '' } });
});

// ── 微信注册（输入微信昵称/账号，自动创建并绑定）──
router.post('/auth/register-wechat', (req, res) => {
  const { wechat } = req.body || {};
  if (!wechat || !wechat.trim()) return res.json({ success: false, error: '请输入微信昵称/微信号' });
  const wx = wechat.trim();
  const existing = db.get('SELECT id FROM students WHERE wechat_nickname = ?', [wx]);
  if (existing) return res.json({ success: false, error: '该微信已注册，请直接登录' });
  const uid = 'CZ' + Date.now().toString().slice(-8);
  const uname = generateUsername();
  db.run('INSERT INTO students (name, username, phone, email, password_hash, uid, wechat_nickname) VALUES (?,?,?,?,?,?,?)',
    [wx, uname, '', '', '', uid, wx]);
  db.saveDb();
  const row = db.get('SELECT id, name, username, phone, uid, wechat_nickname FROM students WHERE wechat_nickname = ?', [wx]);
  req.session.studentId = row.id;
  return res.json({ success: true, user: row });
});

// ── 微信登录 ──
router.post('/auth/login-wechat', (req, res) => {
  const { wechat } = req.body || {};
  if (!wechat || !wechat.trim()) return res.json({ success: false, error: '请输入微信昵称/微信号' });
  const row = db.get('SELECT * FROM students WHERE wechat_nickname = ?', [wechat.trim()]);
  if (!row) return res.json({ success: false, error: '该微信未注册，请先注册' });
  req.session.studentId = row.id;
  return res.json({ success: true, user: { id: row.id, name: row.name, phone: row.phone, uid: row.uid, wechat_nickname: row.wechat_nickname || '' } });
});

// ── 退出登录 ──
router.post('/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// ── 游客身份 ──
router.post('/auth/guest', (req, res) => {
  req.session.studentId = null;
  req.session.guest = true;
  res.json({ success: true });
});

// ── 购课后开发票：填写真实姓名 ──
router.post('/invoice', (req, res) => {
  if (!req.session.studentId) return res.json({ success: false, error: '请先登录' });
  const row = db.get('SELECT * FROM students WHERE id = ?', [req.session.studentId]);
  if (!row) return res.json({ success: false, error: '用户不存在' });
  const enroll = db.get('SELECT id FROM enrollments WHERE student_id=? LIMIT 1', [row.id]);
  if (!enroll) return res.json({ success: false, error: '请先购买课程后申请开发票' });
  const name = (req.body.name || '').trim();
  if (!name) return res.json({ success: false, error: '请填写真实姓名' });
  db.run('UPDATE students SET real_name=? WHERE id=?', [name, row.id]);
  db.saveDb();
  return res.json({ success: true, message: '真实姓名已保存' });
});

// ── 当前用户（Session）──
router.get('/auth/me', (req, res) => {
  if (!req.session.studentId) return res.json({ success: false });
  const row = db.get('SELECT id, name, username, phone, uid, wechat_nickname FROM students WHERE id = ?', [req.session.studentId]);
  if (!row) return res.json({ success: false });
  return res.json({ success: true, user: row });
});

// ── 更新个人资料（姓名/微信）──
router.post('/auth/profile', (req, res) => {
  if (!req.session.studentId) return res.json({ success: false, error: '请先登录' });
  const { name, wechat, exam_year, username } = req.body || {};
  const row = db.get('SELECT * FROM students WHERE id = ?', [req.session.studentId]);
  if (!row) return res.json({ success: false, error: '用户不存在' });
  const uname = (username || '').trim();
  if (uname && uname !== row.username) {
    const dup = db.get('SELECT id FROM students WHERE username=? AND id<>?', [uname, row.id]);
    if (dup) return res.json({ success: false, error: '用户名已存在' });
    db.run('UPDATE students SET username=? WHERE id=?', [uname, row.id]);
  }
  db.run('UPDATE students SET name=?, wechat_nickname=?, exam_year=? WHERE id=?',
    [(name || row.name).trim(), (wechat || '').trim(), (exam_year || row.exam_year || '').trim(), req.session.studentId]);
  db.saveDb();
  const updated = db.get('SELECT id, name, username, phone, uid, wechat_nickname, exam_year FROM students WHERE id = ?', [req.session.studentId]);
  return res.json({ success: true, user: updated });
});

// ── 设置/修改密码 ──
router.post('/auth/password', (req, res) => {
  if (!req.session.studentId) return res.json({ success: false, error: '请先登录' });
  const { password } = req.body || {};
  if (!password || password.length < 6) return res.json({ success: false, error: '密码至少6位' });
  const hash = bcrypt.hashSync(password, 10);
  db.run('UPDATE students SET password_hash=? WHERE id=?', [hash, req.session.studentId]);
  db.saveDb();
  return res.json({ success: true, message: '密码已设置' });
});

module.exports = router;

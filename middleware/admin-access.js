const crypto = require('crypto');
const db = require('../db');
const access = require('../lib/admin-access');
module.exports = function(req, res, next) {
  if (/^\/(login|logout)\/?$/.test(req.path)) return next();
  if (!req.session.teacherId) {
    if (req.session.teacherPortalId && (/^\/live\/studio\//.test(req.path) || /^\/live-manage\/\d+\/status\/?$/.test(req.path))) return next();
    return res.redirect('/admin/login');
  }
  const account = access.load(db, req.session.teacherId);
  // Only the original admin's pre-migration session may be upgraded in place.
  if (account && account.username === 'admin' && req.session.adminVersion == null && account.session_version === 1) req.session.adminVersion = 1;
  if (!account || account.status !== 'active' || account.session_version !== req.session.adminVersion) {
    delete req.session.teacherId; delete req.session.adminVersion;
    return res.status(401).send('账号已停用或权限已变更，请重新登录。<a href="/login">重新登录</a>');
  }
  // Legacy staff forms must not bypass account session revocation or super-account protection.
  const staffWrite=req.method==='POST' && req.path.match(/^\/teachers-manage\/([1-9]\d*)(?:\/(delete|toggle))?\/?$/);
  if (staffWrite && access.load(db,Number(staffWrite[1]))) {
    const staff=db.get('SELECT username,status FROM teachers WHERE id=?',[Number(staffWrite[1])]);
    if (staffWrite[2] || req.body.password || (req.body.username && req.body.username!==staff.username) || (req.body.status && req.body.status!==(staff.status||'active'))) return res.status(403).send('该人员已关联后台账号。登录账号、密码和启停状态请在账号管理中调整；已关联账号不能删除。<a href="/accounts">账号管理</a>');
  }
  req.adminAccount = account;
  req.session.teacherName = account.display_name;
  res.locals.teacherName = account.display_name;
  res.locals.adminAccount = account;
  res.locals.canAdmin = (key, write) => access.can(account, key, write);
  res.locals.canAdminPath = url => url === '/admin/dashboard' || access.can(account, access.routeModule(url));
  if (!req.session.accountCsrf) req.session.accountCsrf = crypto.randomBytes(32).toString('hex');
  res.locals.accountCsrf = req.session.accountCsrf;
  if (req.path === '/' || req.path === '/dashboard') {
    if (account.role !== 'ceo') return res.render('teacher/account-dashboard', { title:'控制台 · 承泽在线', access });
    return next();
  }
  const key = access.routeModule('/admin' + req.path);
  // Unknown legacy endpoints stay ceo-only, never implicitly grant access.
  if ((!key && account.role !== 'ceo') || (key && !access.can(account, key, access.isWrite(req)))) return res.status(403).send('无权访问此功能。<a href="/dashboard">返回控制台</a>');
  next();
};

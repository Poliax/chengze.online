function requireTeacher(req, res, next) {
  if (req.session && req.session.teacherId) {
    if (req.adminAccount) return next();
    const db=require('../db'), access=require('../lib/admin-access');
    const account=access.sessionAccount(db,req.session);
    if (!account) return res.status(401).send('后台登录已失效，请重新登录');
    // These legacy routers are also mounted outside /admin; protect both aliases.
    const key=req.baseUrl==='/packages' ? 'packages' : req.baseUrl==='/provinces' ? 'provinces' : access.routeModule(req.originalUrl);
    if ((!key && account.role!=='ceo') || (key && !access.can(account,key,access.isWrite(req)))) return res.status(403).send('没有此功能权限');
    next();
  } else {
    res.redirect('/admin/login');
  }
}

function requirePortal(req, res, next) {
  if (req.session && req.session.teacherPortalId) {
    const db=require('../db'), access=require('../lib/admin-access');
    const configured=access.load(db, req.session.teacherPortalId);
    if (configured && (!access.sessionAccount(db,req.session,true) || !access.canTeach(configured))) return res.status(403).send('授课权限已失效，请重新登录');
    next();
  } else {
    res.redirect('/teach/login');
  }
}

module.exports = { requireTeacher, requirePortal };

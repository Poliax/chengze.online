function requireTeacher(req, res, next) {
  if (req.session && req.session.teacherId) {
    next();
  } else {
    res.redirect('/admin/login');
  }
}

function requirePortal(req, res, next) {
  if (req.session && req.session.teacherPortalId) {
    next();
  } else {
    res.redirect('/teach/login');
  }
}

module.exports = { requireTeacher, requirePortal };

module.exports = {
  requireTeacher(req, res, next) {
    if (req.session && req.session.teacherId) return next();
    res.redirect('/login');
  }
};

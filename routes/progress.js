const db = require('../db');

function id(value) {
  if (!/^[1-9]\d*$/.test(String(value))) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : null;
}

module.exports = function saveProgress(req, res) {
  const studentId = id(req.session && req.session.studentId);
  if (!studentId) return res.status(401).json({ error: '请先登录' });
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ error: '请求参数无效' });
  if (body.studentId !== undefined && id(body.studentId) !== studentId) return res.status(403).json({ error: '不能修改其他学员的学习记录' });
  const lessonId = id(body.lessonId);
  if (!lessonId) return res.status(400).json({ error: '课时编号无效' });
  if (body.completed !== undefined && typeof body.completed !== 'boolean') return res.status(400).json({ error: '完成状态必须为布尔值' });
  for (const field of ['watchDuration', 'lastPosition']) {
    if (body[field] !== undefined && (typeof body[field] !== 'number' || !Number.isFinite(body[field]) || body[field] < 0 || body[field] > 86400)) {
      return res.status(400).json({ error: '学习时间必须为0至86400秒之间的数字' });
    }
  }
  const student = db.get('SELECT id, status FROM students WHERE id=?', [studentId]);
  if (!student || student.status === 'disabled') return res.status(401).json({ error: '登录已失效，请重新登录' });
  const lesson = db.get('SELECT l.id, l.course_id, l.is_free, c.package_id, c.status FROM lessons l JOIN courses c ON c.id=l.course_id WHERE l.id=?', [lessonId]);
  if (!lesson || lesson.status !== 'published') return res.status(404).json({ error: '课时不存在或未发布' });
  const direct = db.get('SELECT id FROM enrollments WHERE student_id=? AND course_id=?', [studentId, lesson.course_id]);
  const packageAccess = !direct && Number(lesson.is_free) !== 1 && db.get(`
    WITH RECURSIVE owned_packages(id) AS (
      SELECT package_id FROM package_enrollments WHERE student_id=?
      UNION
      SELECT p.id FROM course_packages p JOIN owned_packages parent ON p.parent_id=parent.id
    )
    SELECT id FROM owned_packages WHERE id=? OR id IN (
      SELECT package_id FROM course_package_courses WHERE course_id=?
    ) LIMIT 1`, [studentId, lesson.package_id || 0, lesson.course_id]);
  if (!direct && !packageAccess && Number(lesson.is_free) !== 1) return res.status(403).json({ error: '尚未获得该课程的学习权限' });
  const existing = db.get('SELECT * FROM course_progress WHERE student_id=? AND lesson_id=?', [studentId, lessonId]);
  const completed = (existing && existing.completed) || body.completed ? 1 : 0;
  const duration = Math.max(existing ? Number(existing.watch_duration) || 0 : 0, body.watchDuration === undefined ? 0 : body.watchDuration);
  const position = body.lastPosition === undefined ? (existing ? Number(existing.last_position) || 0 : 0) : body.lastPosition;
  if (existing) {
    db.run('UPDATE course_progress SET completed=?, watch_duration=?, last_position=?, updated_at=CURRENT_TIMESTAMP WHERE student_id=? AND lesson_id=?', [completed, duration, position, studentId, lessonId]);
  } else {
    db.run('INSERT INTO course_progress (student_id, lesson_id, completed, watch_duration, last_position) VALUES (?,?,?,?,?)', [studentId, lessonId, completed, duration, position]);
  }
  res.json({ ok: true });
};

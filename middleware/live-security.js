const courseAccess = require('./course-access');
function positiveId(value) {
  if (!/^[1-9]\d*$/.test(String(value))) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

function teacher(db, session) {
  if (!session) return null;
  const id = positiveId(session.teacherId || session.teacherPortalId);
  if (!id) return null;
  const row = db.get('SELECT * FROM teachers WHERE id=?', [id]);
  if (!row || row.status === 'disabled') return null;
  return { ...row, admin: Boolean(session.teacherId && row.username === 'admin') };
}

function controls(db, session, courseId) {
  const id = positiveId(courseId);
  if (!id) return false;
  const course = db.get('SELECT * FROM courses WHERE id=?', [id]);
  const person = teacher(db, session);
  return Boolean(course && person && (person.admin || Number(course.teacher_id) === Number(person.id)));
}

function liveHttpGuard(db) {
  return (req, res, next) => {
    const person = teacher(db, req.session);
    if (!person) return res.status(401).json({ error: '请先登录授课或管理后台' });
    if (person.admin) return next();
    let id = null;
    const studio = req.path.match(/^\/live\/studio\/([1-9]\d*)(?:\/(?:upload|state|upload-status\/[^/]+))?\/?$/);
    if (studio && ['GET', 'POST'].includes(req.method)) id = studio[1];
    const stream = req.path.match(/^\/live-manage\/([1-9]\d*)\/status\/?$/);
    if (stream && req.method === 'POST') {
      const row = db.get('SELECT course_id FROM live_streams WHERE id=?', [positiveId(stream[1])]);
      id = row && row.course_id;
    }
    if (!id || !controls(db, req.session, id)) return res.status(403).json({ error: '无权操作该课程或管理功能' });
    if (stream && req.body && req.body.lesson_id) {
      const lesson = db.get('SELECT course_id FROM lessons WHERE id=?', [positiveId(req.body.lesson_id)]);
      if (!lesson || Number(lesson.course_id) !== Number(id)) return res.status(400).json({ error: '课时不属于该课程' });
    }
    next();
  };
}

function installSocketGuard(io, db, sessionMiddleware, legacySessions) {
  io.engine.use(sessionMiddleware);
  io.use((socket, next) => {
    const origin = socket.request.headers.origin;
    if (origin) {
      try {
        if (new URL(origin).host !== socket.request.headers.host) return next(new Error('Invalid origin'));
      } catch { return next(new Error('Invalid origin')); }
    }
    next();
  });
  const events = new Set(['live:join', 'live:start', 'live:ended', 'live:chat', 'teacher:join', 'student:join', 'teacher:sync', 'chat:send', 'teacher:changeLesson', 'student:handraise', 'teacher:endSession', 'webrtc:offer', 'webrtc:answer', 'webrtc:student-ice', 'webrtc:teacher-ice']);
  io.on('connection', socket => {
    socket.data.liveJoined = new Set();
    socket.on('error', () => {});
    socket.use((packet, next) => {
      const event = packet[0];
      if (!events.has(event)) return next();
      const data = packet[1];
      const reject = () => { socket.emit('live:error', { error: '无权操作该课堂，或请求参数无效' }); next(new Error('Live authorization rejected')); };
      if (!data || typeof data !== 'object' || Array.isArray(data)) return reject();
      const authorize = () => {
        try {
          const session = socket.request.session || {};
          let courseId;
          let legacy;
          if (event.startsWith('live:')) courseId = positiveId(data.courseId);
          else if (event === 'teacher:join') courseId = positiveId(data.courseId);
          else {
            legacy = legacySessions()[data.sessionId];
            courseId = legacy && positiveId(legacy.courseId);
          }
          if (!courseId) return reject();
          const course = db.get('SELECT * FROM courses WHERE id=?', [courseId]);
          const canControl = controls(db, session, courseId);
          if (!course || (!canControl && !courseAccess.allowed(session, courseId))) return reject();
          const person = teacher(db, session);
          const student = session.studentId && db.get('SELECT id, name, uid FROM students WHERE id=?', [session.studentId]);
          const displayName = person ? (person.real_name || person.display_name || '老师') : student ? student.name : '访客' + socket.id.slice(-6);
          if (event === 'live:join') {
            if (!['teacher', 'student'].includes(data.role)) return reject();
            if (data.role === 'teacher' && !canControl) return reject();
            data.courseId = courseId;
            data.name = displayName;
            data.uid = student ? student.uid : '';
            socket.data.liveJoined.add(String(courseId));
          } else if (event.startsWith('live:')) {
            if (!socket.data.liveJoined.has(String(courseId))) return reject();
            if (event !== 'live:chat' && !canControl) return reject();
            data.courseId = courseId;
            if (event === 'live:chat') {
              if (typeof data.content !== 'string' || data.content.length > 2000) return reject();
              data.sender = displayName;
            }
          } else {
            if (typeof data.sessionId !== 'string' || !new RegExp('^session_' + courseId + '_[0-9]+$').test(data.sessionId)) return reject();
            const teacherEvent = event.startsWith('teacher:') || event === 'webrtc:offer' || event === 'webrtc:teacher-ice';
            if (teacherEvent && !canControl) return reject();
            if (event !== 'teacher:join' && event !== 'student:join') {
              if (!legacy || !socket.rooms.has('session:' + data.sessionId)) return reject();
              if (teacherEvent && legacy.teacherSocketId !== socket.id) return reject();
            }
            if (data.lessonId) {
              const lesson = db.get('SELECT course_id FROM lessons WHERE id=?', [positiveId(data.lessonId)]);
              if (!lesson || Number(lesson.course_id) !== courseId) return reject();
            }
            if (event === 'teacher:endSession' && positiveId(data.courseId) !== courseId) return reject();
            if ((event === 'webrtc:offer' || event === 'webrtc:teacher-ice') && !legacy.students.has(data.socketId)) return reject();
            if ((event === 'webrtc:answer' || event === 'webrtc:student-ice') && !legacy.students.has(socket.id)) return reject();
            data.studentName = displayName;
            if (event === 'chat:send') {
              if (typeof data.content !== 'string' || data.content.length > 2000) return reject();
              data.sender = displayName;
            }
          }
          next();
        } catch { reject(); }
      };
      const session = socket.request.session;
      if (session && typeof session.reload === 'function') {
        session.reload(err => {
          if (err) socket.request.session = null;
          authorize();
        });
      } else authorize();
    });
  });
}

module.exports = { controls, liveHttpGuard, installSocketGuard };

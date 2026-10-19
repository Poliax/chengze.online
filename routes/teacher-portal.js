const express = require('express');
const crypto = require('crypto');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requirePortal } = require('../middleware/auth');

const LIVE_CONFIG = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'live-config.json'), 'utf8')); } catch (e) { return {}; }
})();

function genUserSig(appId, secretKey, userId, expire) {
  const curTime = Math.floor(Date.now() / 1000);
  const input = 'TLS.identifier:' + userId + '\nTLS.sdkappid:' + appId + '\nTLS.time:' + curTime + '\nTLS.expire:' + expire + '\n';
  const sig = crypto.createHmac('sha256', secretKey).update(input).digest('base64');
  const obj = { 'TLS.ver': '2.0', 'TLS.identifier': userId, 'TLS.sdkappid': appId, 'TLS.time': curTime, 'TLS.expire': expire, 'TLS.sig': sig };
  const deflated = zlib.deflateSync(Buffer.from(JSON.stringify(obj))).toString('base64');
  return deflated.replace(/\+/g, '*').replace(/\//g, '-').replace(/=/g, '_');
}

// ── 教师端登录 ──
router.get('/login', (req, res) => {
  if (req.session && req.session.teacherPortalId) return res.redirect('/teach');
  res.render('teacher-portal/login', { title: '教师端 · 承泽在线', error: null });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.render('teacher-portal/login', { title: '教师端 · 承泽在线', error: '请输入用户名和密码' });
  }
  const teacher = db.get('SELECT * FROM teachers WHERE username = ? OR phone = ?', [username, username]);
  if (!teacher) {
    return res.render('teacher-portal/login', { title: '教师端 · 承泽在线', error: '用户名或密码错误' });
  }
  if (teacher.status === 'disabled') {
    return res.render('teacher-portal/login', { title: '教师端 · 承泽在线', error: '该教师账号已停用，请联系管理员' });
  }
  const valid = bcrypt.compareSync(password, teacher.password_hash || '');
  if (!valid) {
    return res.render('teacher-portal/login', { title: '教师端 · 承泽在线', error: '用户名或密码错误' });
  }
  const access=require('../lib/admin-access'), configured=access.load(db,teacher.id);
  if (configured && (configured.status!=='active' || !access.canTeach(configured))) return res.status(403).send('该账号没有授课权限');
  req.session.portalAdminVersion = configured ? configured.session_version : null;
  delete req.session.teacherPortalView;
  req.session.teacherPortalId = teacher.id;
  req.session.portalTeacherName = teacher.real_name || teacher.display_name;
  res.redirect('/teach');
});

router.get('/logout', (req, res) => {
  delete req.session.teacherPortalView;
  delete req.session.teacherPortalId;
  delete req.session.portalTeacherName;
  res.redirect('/teach/login');
});

// Restore the last teacher view directly on a full refresh of the unified URL.
router.use((req,res,next)=>{
 res.locals.cache=true;
 if(req.method!=='GET'||!req.session?.teacherPortalId)return next();
 const allowed=value=>typeof value==='string'&&/^\/(?:courses|calendar|profile)?(?:\?[^#\r\n]*)?$/.test(value);
 if(req.path==='/'&&req.get('X-Teacher-Navigation')!=='1'&&allowed(req.session.teacherPortalView))req.url=req.session.teacherPortalView;
 if(allowed(req.url)){req.session.teacherPortalView=req.url;res.locals.path='/teach'+(req.path==='/'?'':req.path);res.locals.teacherRenderedView='/teach'+(req.url==='/'?'':req.url);}
 next();
});

function lessonActivity(teacherId){
 const rows=db.query(`SELECT s.course_id,s.lesson_id,
 MAX(CASE WHEN s.status='live' THEN 1 ELSE 0 END) AS is_live,
 MAX(CASE WHEN s.status='ended' AND s.ended_at IS NOT NULL THEN 1 ELSE 0 END) AS is_taught,
 MAX(CASE WHEN s.status='ended' AND s.started_at IS NOT NULL AND s.ended_at IS NOT NULL THEN 1 ELSE 0 END) AS has_taught_session
 FROM live_sessions s JOIN courses c ON c.id=s.course_id WHERE c.teacher_id=? AND s.lesson_id IS NOT NULL GROUP BY s.course_id,s.lesson_id`,[teacherId]);
 return new Map(rows.map(row=>[row.course_id+':'+row.lesson_id,row]));
}
// Teacher home: Beijing calendar days, only this teacher's assigned lessons.
router.get('/', requirePortal, (req,res)=>{
 const teacher=db.get('SELECT * FROM teachers WHERE id=?',[req.session.teacherPortalId]);
 if(!teacher)return res.redirect('/teach/login');
 const start=new Date(Date.now()+8*3600000);start.setUTCHours(0,0,0,0);
 const todayDate=start.toISOString().slice(0,10);
 const weekOffset=(start.getUTCDay()+6)%7;start.setUTCDate(start.getUTCDate()-weekOffset-14);
 const bounds=db.get(`SELECT MIN(substr(l.schedule_time,1,10)) AS first_day,MAX(substr(l.schedule_time,1,10)) AS last_day FROM lessons l JOIN courses c ON c.id=l.course_id WHERE c.teacher_id=? AND l.schedule_time IS NOT NULL AND l.schedule_time<>'' AND date(substr(l.schedule_time,1,10)) IS NOT NULL`,[teacher.id]);
 const defaultEnd=start.getTime()+42*86400000;
 const first=bounds?.first_day?Date.parse(bounds.first_day+'T00:00:00Z'):NaN;
 const last=bounds?.last_day?Date.parse(bounds.last_day+'T00:00:00Z')+86400000:NaN;
 if(Number.isFinite(first)&&first<start.getTime())start.setTime(first);
 const rangeEnd=Number.isFinite(last)?Math.max(defaultEnd,last):defaultEnd;
 const days=Array.from({length:Math.ceil((rangeEnd-start.getTime())/86400000)},(_,i)=>{const d=new Date(start.getTime()+i*86400000);return {date:d.toISOString().slice(0,10),weekday:['星期日','星期一','星期二','星期三','星期四','星期五','星期六'][d.getUTCDay()],lessons:[]};});
 const end=new Date(rangeEnd).toISOString().slice(0,10);
 const lessons=db.query(`SELECT l.id,l.title,l.course_id,l.schedule_time,c.title AS course_title
 FROM lessons l JOIN courses c ON c.id=l.course_id WHERE c.teacher_id=? AND substr(l.schedule_time,1,10)>=? AND substr(l.schedule_time,1,10)<? ORDER BY l.schedule_time,l.id`,[teacher.id,days[0].date,end]);
 const activity=lessonActivity(teacher.id),byDate=new Map(days.map(d=>[d.date,d]));
 for(const lesson of lessons){Object.assign(lesson,activity.get(lesson.course_id+':'+lesson.id)||{});const day=byDate.get(lesson.schedule_time.slice(0,10));if(day)day.lessons.push(lesson);}
 res.render('teacher-portal/home',{teacherName:teacher.real_name||teacher.display_name,days,today:days.find(d=>d.date===todayDate),weekCount:lessons.length});
});

// ── 教师课表 ──
router.get('/courses', requirePortal, (req, res) => {
  const teacher = db.get('SELECT * FROM teachers WHERE id=?', [req.session.teacherPortalId]);
  if (!teacher) return res.redirect('/teach/login');
  const courses = db.query('SELECT c.*, (SELECT COUNT(*) FROM lessons WHERE course_id=c.id) as lesson_count FROM courses c WHERE c.teacher_id=? ORDER BY c.created_at DESC', [teacher.id]);
  const activity=lessonActivity(teacher.id);
  const allLessons=db.query('SELECT l.* FROM lessons l JOIN courses c ON c.id=l.course_id WHERE c.teacher_id=? ORDER BY l.order_index ASC',[teacher.id]);
  const lessonsByCourse=new Map();
  for(const lesson of allLessons){const status=activity.get(lesson.course_id+':'+lesson.id)||{};Object.assign(lesson,{has_live_session:status.is_live||0,has_taught_session:status.has_taught_session||0});if(!lessonsByCourse.has(lesson.course_id))lessonsByCourse.set(lesson.course_id,[]);lessonsByCourse.get(lesson.course_id).push(lesson);}
  const rows=courses.map(course=>({course,lessons:lessonsByCourse.get(course.id)||[]}));
  const groupMap = {};
  rows.forEach(function(r) {
    var prov = r.course.province || '未分组';
    if (!groupMap[prov]) groupMap[prov] = { province: prov, courses: [] };
    groupMap[prov].courses.push(r);
  });
  const groups = Object.values(groupMap);
  const courseSections=[{title:'本学期课程',groups:[]},{title:'往期课程',groups:[]}];
  for(const group of groups){for(let i=0;i<2;i++){const subset=group.courses.filter(row=>{const archived=['archived','disabled'].includes(row.course.status);return i===0?!archived:archived;});if(subset.length)courseSections[i].groups.push({...group,courses:subset});}}
  const courseCount = courses.length;
  const lessonCount = rows.reduce((sum, r) => sum + r.lessons.length, 0);
  let studentCount = 0;
  try { studentCount = db.get('SELECT COUNT(DISTINCT e.student_id) as c FROM enrollments e JOIN courses c2 ON e.course_id=c2.id WHERE c2.teacher_id=?', [teacher.id]).c || 0; } catch(e) {}
  res.render('teacher-portal/dashboard', {
    title: '教师端 · 承泽在线',
    teacherName: teacher.real_name || teacher.display_name,
    teacher: teacher,
    rows,
    groups,
    courseSections,
    courseCount,
    lessonCount,
    studentCount
  });
});

router.post('/lessons/:lessonId/content',requirePortal,require('../lib/lesson-topic')(db));

// ── 课程日历 ──
router.get('/calendar', requirePortal, (req, res) => {
  const teacherId = req.session.teacherPortalId;
  const view = req.query.view || 'month';
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
  const monthStr = String(month).padStart(2, '0');
  const monthNames = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
  const typeLabels = { lesson: '授课', review: '答疑', exam: '考试', other: '其他' };

  const lessons = db.query("SELECT l.*, c.title as course_title FROM lessons l JOIN courses c ON l.course_id=c.id WHERE c.teacher_id=? AND l.schedule_time IS NOT NULL AND l.schedule_time != '' ORDER BY l.schedule_time", [teacherId]);
  const calSchedules = lessons.map(function(l) {
    var st = l.schedule_time || '';
    return {
      date: st.slice(0, 10),
      start_time: st.length > 11 ? st.slice(11, 16) : '09:00',
      title: l.title,
      color: '#2563eb',
      course_title: l.course_title,
      course_id: l.course_id,
      lesson_id: l.id
    };
  });

  function buildMonthGrid(y, m) {
    var ms = String(m).padStart(2, '0');
    var first = new Date(y, m-1, 1);
    var last = new Date(y, m, 0);
    var startDow = first.getDay();
    var daysIn = last.getDate();
    var scheds = calSchedules.filter(function(s) { return s.date && s.date.indexOf(y + '-' + ms) === 0; });
    var weeks = [];
    var day = 1;
    for (var w = 0; w < 6; w++) {
      var week = [];
      for (var d = 0; d < 7; d++) {
        if ((w === 0 && d < startDow) || day > daysIn) { week.push(null); }
        else {
          var ds = y + '-' + ms + '-' + String(day).padStart(2, '0');
          var dscheds = scheds.filter(function(s) { return s.date === ds; });
          week.push({ day: day, date: ds, schedules: dscheds });
          day++;
        }
      }
      weeks.push(week);
      if (day > daysIn) break;
    }
    return weeks;
  }

  if (view === 'year') {
    var yearMonths = [];
    for (var mi = 1; mi <= 12; mi++) {
      yearMonths.push({ index: mi, name: monthNames[mi-1], weeks: buildMonthGrid(year, mi) });
    }
    var years = [];
    for (var yi = year - 3; yi <= year + 3; yi++) years.push(yi);
    res.render('teacher-portal/calendar', {
      view: 'year', year: year, yearMonths: yearMonths, years: years,
      monthNames: monthNames, typeLabels: typeLabels
    });
  } else {
    var weeks = buildMonthGrid(year, month);
    var prevMonth = month === 1 ? 12 : month - 1;
    var prevYear = month === 1 ? year - 1 : year;
    var nextMonth = month === 12 ? 1 : month + 1;
    var nextYear = month === 12 ? year + 1 : year;
    var years = [];
    for (var yi = year - 3; yi <= year + 3; yi++) years.push(yi);
    res.render('teacher-portal/calendar', {
      view: 'month', year: year, month: month, weeks: weeks,
      prevMonth: prevMonth, prevYear: prevYear, nextMonth: nextMonth, nextYear: nextYear,
      years: years, monthNames: monthNames, typeLabels: typeLabels
    });
  }
});

// ── 个人信息 ──
router.get('/profile', requirePortal, (req, res) => {
  const teacherId = req.session.teacherPortalId;
  const teacher = db.get('SELECT * FROM teachers WHERE id=?', [teacherId]);
  if (!teacher) return res.redirect('/teach/login');
  const courseCount = db.get('SELECT COUNT(*) as c FROM courses WHERE teacher_id=?', [teacherId]).c;
  const lessonCount = db.get('SELECT COUNT(*) as c FROM lessons l JOIN courses c2 ON l.course_id=c2.id WHERE c2.teacher_id=?', [teacherId]).c;
  let studentCount = 0;
  try { studentCount = db.get('SELECT COUNT(DISTINCT e.student_id) as c FROM enrollments e JOIN courses c2 ON e.course_id=c2.id WHERE c2.teacher_id=?', [teacherId]).c || 0; } catch(e) {}
  const historyCourses = db.query('SELECT id, title, category FROM courses WHERE teacher_id=? ORDER BY created_at DESC', [teacherId]);
  res.render('teacher-portal/profile', {
    title: '个人信息 · 教师端',
    teacherName: teacher.real_name || teacher.display_name,
    teacher: teacher,
    courseCount: courseCount,
    lessonCount: lessonCount,
    studentCount: studentCount,
    historyCourses: historyCourses
  });
});

// ── 授课直播间 ──
router.get('/live/:courseId', requirePortal, (req, res) => {
  const teacherId = req.session.teacherPortalId;
  const course = db.get('SELECT * FROM courses WHERE id=?', [req.params.courseId]);
  if (!course) return res.redirect('/teach');
  if (course.teacher_id !== teacherId) return res.redirect('/teach');
  const teacher = db.get('SELECT * FROM teachers WHERE id=?', [teacherId]);
  let stream = db.get('SELECT * FROM live_streams WHERE course_id=? ORDER BY id DESC LIMIT 1', [course.id]);
  if (!stream) {
    const streamName = 'cz' + course.id + '_' + Math.floor(1000 + Math.random() * 9000);
    db.run('INSERT INTO live_streams (course_id, stream_name, push_server, stream_key, play_url) VALUES (?,?,?,?,?)', [course.id, streamName, '', '', 'https://' + (LIVE_CONFIG.playDomain || 'play.chengze.online') + '/live/' + streamName + '.flv']);
    stream = db.get('SELECT * FROM live_streams WHERE course_id=? ORDER BY id DESC LIMIT 1', [course.id]);
  }
  const lessons = db.query('SELECT id, title FROM lessons WHERE course_id = ? ORDER BY order_index ASC', [course.id]);
  const roomId = course.id;
  const userId = 'teacher_' + teacherId;
  const relayStream = (LIVE_CONFIG.trtcAppId || '') + '_' + roomId + '_' + userId + '_main';
  db.run('UPDATE live_streams SET play_url=? WHERE id=?', ['https://' + (LIVE_CONFIG.playDomain || 'play.chengze.online') + '/live/' + relayStream + '.flv', stream.id]);
  stream.play_url = 'https://' + (LIVE_CONFIG.playDomain || 'play.chengze.online') + '/live/' + relayStream + '.flv';
  const appId = parseInt(LIVE_CONFIG.trtcAppId) || 0;
  const secretKey = LIVE_CONFIG.trtcSecretKey || '';
  const credentials = require('../middleware/trtc-tickets')(appId, secretKey, userId, roomId, 'teacher');
  const { userSig, privateMapKey, expire } = credentials;
  const camUserId = userId + '_cam';
  const cameraCredentials = require('../middleware/trtc-tickets')(appId, secretKey, camUserId, roomId, 'teacher');
  const camUserSig = cameraCredentials.userSig;
  const camPrivateMapKey = cameraCredentials.privateMapKey;
  res.render('teacher/live-studio', {
    title: course.title + ' · 授课直播间',
    teacherName: teacher ? (teacher.real_name || teacher.display_name) : '老师',
    course, stream, lessons,
    backUrl: '/teach',
    sdkAppId: appId, userId, userSig, privateMapKey, camUserId, camUserSig, camPrivateMapKey, roomId, expire
  });
});

module.exports = router;

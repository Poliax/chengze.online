const express = require('express');
const crypto = require('crypto');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { execFile } = require('child_process');
const router = express.Router();
const db = require('../db');
const { requireTeacher } = require('../middleware/auth');

function portalOrAdmin(req, res, next) {
  if (req.session && (req.session.teacherId || req.session.teacherPortalId)) return next();
  return res.redirect('/admin/login');
}

router.use(portalOrAdmin);
router.use(require('../middleware/live-security').liveHttpGuard(db));
function genUserSig(appId, secretKey, userId, expire) {
  const curTime = Math.floor(Date.now() / 1000);
  const input = 'TLS.identifier:' + userId + '\nTLS.sdkappid:' + appId + '\nTLS.time:' + curTime + '\nTLS.expire:' + expire + '\n';
  const sig = crypto.createHmac('sha256', secretKey).update(input).digest('base64');
  const obj = { 'TLS.ver': '2.0', 'TLS.identifier': userId, 'TLS.sdkappid': appId, 'TLS.time': curTime, 'TLS.expire': expire, 'TLS.sig': sig };
  const deflated = zlib.deflateSync(Buffer.from(JSON.stringify(obj))).toString('base64');
  return deflated.replace(/\+/g, '*').replace(/\//g, '-').replace(/=/g, '_');
}

const LIVE_CONFIG = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'live-config.json'), 'utf8')); } catch (e) { return {}; }
})();
const conversionJobs = {};


router.get('/live-manage', (req, res) => {
  const q = (req.query.q || '').trim();
  const courses = db.query('SELECT id, title, status FROM courses ORDER BY created_at DESC');
  let streams = db.query('SELECT ls.*, c.title as course_title FROM live_streams ls LEFT JOIN courses c ON ls.course_id=c.id ORDER BY ls.created_at DESC');
  const pushDomain = LIVE_CONFIG.pushDomain || 'push.chengze.online';
  const appName = LIVE_CONFIG.appName || 'live';
  const pushKey = LIVE_CONFIG.pushKey || '';
  const expire = parseInt(LIVE_CONFIG.streamExpireSeconds) || 86400;
  streams = streams.map(function(s) {
    if (!s.push_server || !s.stream_key) {
      const txTime = ((Math.floor(Date.now() / 1000)) + expire).toString(16).toUpperCase();
      const txSecret = pushKey ? crypto.createHash('md5').update(pushKey + s.stream_name + txTime).digest('hex') : '';
      s.push_server = 'rtmp://' + pushDomain + '/' + appName + '/';
      s.stream_key = s.stream_name + (pushKey ? '?txSecret=' + txSecret + '&txTime=' + txTime : '');
    }
    return s;
  });
  if (q) {
    streams = streams.filter(function(s) {
      return String(s.course_title || '').indexOf(q) > -1 ||
             String(s.stream_name || '').indexOf(q) > -1 ||
             String(s.play_url || '').indexOf(q) > -1;
    });
  }
  const replays = db.query('SELECT r.*, c.title as course_title FROM live_replays r LEFT JOIN courses c ON r.course_id=c.id ORDER BY r.created_at DESC');
  res.render('teacher/live-manage', {
    title: '直播管理 · 管理后台',
    teacherName: req.session.teacherName,
    courses, streams, replays, q
  });
});

router.get('/live-manage/new', (req, res) => {
  const courses = db.query('SELECT id, title, status FROM courses ORDER BY created_at DESC');
  res.render('teacher/live-manage-form', {
    title: '添加直播配置 · 管理后台',
    teacherName: req.session.teacherName,
    courses
  });
});

router.get('/live-manage/:id/edit', (req, res) => {
  const stream = db.get('SELECT * FROM live_streams WHERE id=?', [req.params.id]);
  if (!stream) return res.redirect('/admin/live-manage');
  const courses = db.query('SELECT id, title, status FROM courses ORDER BY created_at DESC');
  res.render('teacher/live-manage-form', {
    title: '编辑直播配置 · 管理后台',
    teacherName: req.session.teacherName,
    courses,
    stream
  });
});

router.get('/replays-manage', (req, res) => {
  const q = (req.query.q || '').trim();
  const courses = db.query('SELECT id, title, status FROM courses ORDER BY created_at DESC');
  let replays = db.query('SELECT r.*, c.title as course_title FROM live_replays r LEFT JOIN courses c ON r.course_id=c.id ORDER BY r.created_at DESC');
  if (q) {
    replays = replays.filter(function(r) {
      return String(r.course_title || '').indexOf(q) > -1 || String(r.title || '').indexOf(q) > -1;
    });
  }
  res.render('teacher/live-replay', {
    title: '回放管理 · 管理后台',
    teacherName: req.session.teacherName,
    courses,
    replays,
    q
  });
});

router.get('/replays-manage/new', (req, res) => {
  const courses = db.query('SELECT id, title, status FROM courses ORDER BY created_at DESC');
  res.render('teacher/live-replay-form', {
    title: '添加回放 · 管理后台',
    teacherName: req.session.teacherName,
    courses
  });
});

router.post('/live-manage/save', (req, res) => {
  const { course_id, stream_name, push_server, stream_key, play_url } = req.body;
  if (!course_id) return res.redirect('/admin/live-manage');
  const exist = db.get('SELECT id FROM live_streams WHERE course_id=?', [course_id]);
  if (exist) {
    db.run('UPDATE live_streams SET stream_name=?, push_server=?, stream_key=?, play_url=? WHERE id=?',
      [stream_name || '', push_server || '', stream_key || '', play_url || '', exist.id]);
  } else {
    db.run('INSERT INTO live_streams (course_id, stream_name, push_server, stream_key, play_url) VALUES (?,?,?,?,?)',
      [course_id, stream_name || '', push_server || '', stream_key || '', play_url || '']);
  }
  res.redirect('/admin/live-manage');
});

router.post('/live-manage/:id/status', (req, res) => {
  const s = db.get('SELECT * FROM live_streams WHERE id=?', [req.params.id]);
  const lessonId = req.body.lesson_id || req.query.lesson_id || '';
  const action = req.body.action || req.query.action || '';
  if (s) {
    if (action === 'start') {
      db.run("UPDATE live_streams SET status='live', started_at=CURRENT_TIMESTAMP, lesson_id=? WHERE id=?", [lessonId || null, s.id]);
    } else if (action === 'stop') {
      db.run("UPDATE live_streams SET status='off', ended_at=CURRENT_TIMESTAMP WHERE id=?", [s.id]);
    } else if (s.status === 'live') {
      db.run("UPDATE live_streams SET status='off', ended_at=CURRENT_TIMESTAMP WHERE id=?", [s.id]);
    } else {
      db.run("UPDATE live_streams SET status='live', started_at=CURRENT_TIMESTAMP, lesson_id=? WHERE id=?", [lessonId || null, s.id]);
    }
  }
  const io = req.app.get('io');
  if (io) io.emit('live:status', { ts: Date.now() });
  res.redirect('/admin/live-manage');
});

router.post('/live-manage/:id/delete', (req, res) => {
  db.run('DELETE FROM live_streams WHERE id=?', [req.params.id]);
  res.redirect('/admin/live-manage');
});


router.post('/replays-manage/save', async (req, res, next) => {
  const { course_id, title, video_url, duration } = req.body || {};
  let url;try{url=new URL(video_url);}catch{return res.status(400).send('视频地址无效');}
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return res.status(400).send('视频地址无效');
  const seconds=duration===undefined||duration===''?0:Number(duration);
  if(!Number.isFinite(seconds)||seconds<0||seconds>86400)return res.status(400).send('时长无效');
  if(!Number.isSafeInteger(Number(course_id))||Number(course_id)<1)return res.status(400).send('课程编号无效');
  if(!db.get('SELECT id FROM courses WHERE id=?',[Number(course_id)]))return res.status(400).send('课程不存在');
  try{await require('../db/replay-storage')({courseId:Number(course_id),title:String(title||'直播回放').slice(0,200),duration:Math.floor(seconds),videoUrl:url.toString()});res.redirect('/admin/replays-manage');}catch(e){next(e)}
});

router.post('/replays-manage/delete/:id', (req, res) => {
  db.run('DELETE FROM live_replays WHERE id=?', [req.params.id]);
  res.redirect('/admin/replays-manage');
});


router.post('/live-manage/autogen', (req, res) => {
  const course_id = parseInt(req.body.course_id) || 0;
  if (!course_id) return res.redirect('/admin/live-manage');
  const pushDomain = LIVE_CONFIG.pushDomain || 'push.chengze.online';
  const playDomain = LIVE_CONFIG.playDomain || 'play.chengze.online';
  const appName = LIVE_CONFIG.appName || 'live';
  const pushKey = LIVE_CONFIG.pushKey || '';
  const expire = parseInt(LIVE_CONFIG.streamExpireSeconds) || 86400;
  const streamName = 'cz' + course_id + '_' + Math.floor(1000 + Math.random() * 9000);
  const txTime = ((Math.floor(Date.now() / 1000)) + expire).toString(16).toUpperCase();
  const txSecret = pushKey ? crypto.createHash('md5').update(pushKey + streamName + txTime).digest('hex') : '';
  const pushServer = 'rtmp://' + pushDomain + '/' + appName + '/';
  const streamKey = streamName + (pushKey ? '?txSecret=' + txSecret + '&txTime=' + txTime : '');
  const playUrl = 'https://' + playDomain + '/' + appName + '/' + streamName + '.flv';
  const exist = db.get('SELECT id FROM live_streams WHERE course_id=?', [course_id]);
  if (exist) {
    db.run('UPDATE live_streams SET stream_name=?, push_server=?, stream_key=?, play_url=? WHERE id=?', [streamName, pushServer, streamKey, playUrl, exist.id]);
  } else {
    db.run('INSERT INTO live_streams (course_id, stream_name, push_server, stream_key, play_url) VALUES (?,?,?,?,?)', [course_id, streamName, pushServer, streamKey, playUrl]);
  }
  res.redirect('/admin/live-manage');
});


router.get('/live/studio/:courseId', (req, res) => {
  const course = db.get('SELECT * FROM courses WHERE id=?', [req.params.courseId]);
  if (!course) return res.redirect('/admin/live-manage');
  let stream = db.get('SELECT * FROM live_streams WHERE course_id=? ORDER BY id DESC LIMIT 1', [course.id]);
  if (!stream) {
    const streamName = 'cz' + course.id + '_' + Math.floor(1000 + Math.random() * 9000);
    db.run('INSERT INTO live_streams (course_id, stream_name, push_server, stream_key, play_url) VALUES (?,?,?,?,?)', [course.id, streamName, '', '', 'https://' + (LIVE_CONFIG.playDomain || 'play.chengze.online') + '/live/' + streamName + '.flv']);
    stream = db.get('SELECT * FROM live_streams WHERE course_id=? ORDER BY id DESC LIMIT 1', [course.id]);
  }
  const lessons = db.query('SELECT id, title FROM lessons WHERE course_id = ? ORDER BY order_index ASC', [course.id]);
  const backUrl = req.query.from === 'teacher' ? '/teacher' : '/admin/live-manage';
  const roomId = course.id;
  const userId = 'teacher_' + (req.session.teacherId || req.session.teacherPortalId || 3);
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
    title: course.title + ' · 直播台',
    teacherName: req.session.teacherName,
    course, stream, lessons, backUrl,
    sdkAppId: appId, userId, userSig, privateMapKey, camUserId, camUserSig, camPrivateMapKey, roomId: course.id, expire
  });
});


const coursewareStorage = multer.diskStorage({
  destination: function(req, file, cb) {
    const dir = path.join(__dirname, '..', 'public', 'courseware', String(req.params.courseId));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function(req, file, cb) {
    const safe = String(file.originalname || 'file').replace(/[^\w.\-\u4e00-\u9fa5]/g, '_');
    cb(null, Date.now() + '_' + safe);
  }
});
const coursewareUpload = multer({ storage: coursewareStorage, limits: { fileSize: 80 * 1024 * 1024 } });

router.post('/live/studio/:courseId/upload', coursewareUpload.single('file'), (req, res) => {
  const courseId = String(req.params.courseId);
  if (!req.file) return res.status(400).json({ error: 'no file' });
  const dir = path.join(__dirname, '..', 'public', 'courseware', courseId);
  const ext = path.extname(req.file.filename).toLowerCase();
  const imgExts = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];
  if (imgExts.includes(ext)) {
    return res.json({ pages: ['/courseware/' + courseId + '/' + encodeURIComponent(req.file.filename)] });
  }
  const jobId = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  conversionJobs[jobId] = { courseId: courseId, status: 'converting', pages: [], error: null, createdAt: Date.now() };
  const pagePrefix = 'page_' + jobId;
  const outPdf = path.join(dir, path.basename(req.file.filename, ext) + '.pdf');
  execFile('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', dir, req.file.path], { timeout: 300000 }, function(err) {
    if (err) {
      conversionJobs[jobId].status = 'error';
      conversionJobs[jobId].error = 'conversion failed: ' + err.message;
      return;
    }
    execFile('pdftoppm', ['-png', '-r', '200', outPdf, path.join(dir, pagePrefix)], { timeout: 300000 }, function(err2) {
      if (err2) {
        conversionJobs[jobId].status = 'error';
        conversionJobs[jobId].error = 'render failed: ' + err2.message;
        return;
      }
      const re = new RegExp('^' + pagePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '-\\d+\\.png$');
      const files = fs.readdirSync(dir).filter(function(f) { return re.test(f); }).sort(function(a, b) { return parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]); });
      const pages = files.map(function(f) { return '/courseware/' + courseId + '/' + f; });
      if (pages.length === 0) {
        conversionJobs[jobId].status = 'error';
        conversionJobs[jobId].error = 'no pages rendered';
        return;
      }
      try { fs.unlinkSync(req.file.path); } catch(e) {}
      try { fs.unlinkSync(outPdf); } catch(e) {}
      conversionJobs[jobId].status = 'done';
      conversionJobs[jobId].pages = pages;
    });
  });
  const keys = Object.keys(conversionJobs);
  if (keys.length > 50) delete conversionJobs[keys[0]];
  return res.json({ jobId: jobId });
});

router.get('/live/studio/:courseId/upload-status/:jobId', (req, res) => {
  const job = conversionJobs[req.params.jobId];
  if (!job || String(job.courseId) !== String(req.params.courseId)) return res.status(404).json({ status: 'error', error: 'job not found' });
  return res.json({ status: job.status, pages: job.pages, error: job.error });
});

const stateDir = path.join(__dirname, '..', 'data');
function stateFile(courseId,lessonId) {
  return path.join(stateDir,'studio-state-'+courseId+'-lesson-'+lessonId+'.json');
}
function stateLesson(req,res) {
  const courseId=Number(req.params.courseId),lessonId=Number(req.query.lesson);
  if(!Number.isSafeInteger(courseId)||courseId<=0||!Number.isSafeInteger(lessonId)||lessonId<=0){res.status(400).json({error:'请选择有效课次'});return null;}
  if(!db.get('SELECT id FROM lessons WHERE id=? AND course_id=?',[lessonId,courseId])){res.status(404).json({error:'课次不属于当前课程'});return null;}
  return {courseId,lessonId};
}
router.post('/live/studio/:courseId/state', (req,res)=>{
 const scope=stateLesson(req,res);if(!scope)return;
 if(req.body?.lessonId!=null&&Number(req.body.lessonId)!==scope.lessonId)return res.status(400).json({error:'课次不匹配'});
 try{
  fs.mkdirSync(stateDir,{recursive:true});
  const file=stateFile(scope.courseId,scope.lessonId),temp=file+'.'+crypto.randomBytes(8).toString('hex')+'.tmp';
  try{fs.writeFileSync(temp,JSON.stringify({...req.body,courseId:scope.courseId,lessonId:scope.lessonId,savedAt:new Date().toISOString()}),'utf8');fs.renameSync(temp,file);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
  res.set('Cache-Control','private, no-store').json({ok:true});
 }catch(error){res.status(500).json({error:'课次存档保存失败'});}
});
router.get('/live/studio/:courseId/state',(req,res)=>{
 const scope=stateLesson(req,res);if(!scope)return;
 res.set('Cache-Control','private, no-store');
 try{res.json(JSON.parse(fs.readFileSync(stateFile(scope.courseId,scope.lessonId),'utf8')));}
 catch(error){if(error.code==='ENOENT')res.json({empty:true,lessonId:scope.lessonId});else res.status(500).json({error:'课次存档读取失败'});}
});

module.exports = router;

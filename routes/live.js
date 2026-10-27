const access = require('../middleware/course-access');
const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireTeacher } = require('../middleware/auth');
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const crypto = require('crypto');
const zlib = require('zlib');
const replayPlayback = require('../lib/replay-playback');

// ── 老师进入直播 ──
// ── 学生看直播 ──
router.get('/student/live/:sessionId', access.guard(req => req.params.sessionId.match(/^session_([1-9]\d*)_\d+$/)?.[1]), (req, res) => {
  const parts = req.params.sessionId.split('_');
  const courseId = parts[1];
  const course = db.get('SELECT * FROM courses WHERE id = ?', [courseId]);
  if (!course) return res.redirect('/live/student');
  const liveStream = db.get("SELECT * FROM live_streams WHERE course_id = ? AND status = 'live' ORDER BY COALESCE(started_at, created_at) DESC LIMIT 1", [courseId]);
  if (liveStream) return res.redirect('/live/student/live-watch/' + course.id);
  return res.redirect('/live/student');
});

// ── API: 获取课时 ──
router.get('/student/api/lesson/:id', access.lesson, (req, res) => {
  const lesson = db.get('SELECT * FROM lessons WHERE id = ?', [req.params.id]);
  if (!lesson) return res.status(404).json({ error: 'not found' });
  try { lesson.slides_data = JSON.parse(lesson.slides_data || '[]'); } catch { lesson.slides_data = []; }
  res.json(lesson);
});

// ── API: 检查课程是否有直播在进行 ──
router.get('/api/live-status/:courseId', access.course('courseId'), (req, res) => {
  const stream = db.get("SELECT * FROM live_streams WHERE course_id = ? AND status = 'live' ORDER BY COALESCE(started_at, created_at) DESC LIMIT 1", [req.params.courseId]);
  if (stream) {
    let startedAt = '';
    if (stream.started_at) {
      try {
        const d = new Date(String(stream.started_at).replace(' ', 'T') + 'Z');
        if (!isNaN(d.getTime())) startedAt = d.toISOString();
      } catch(e) {}
    }
    return res.json({ isLive: true, streamId: stream.id, playUrl: stream.play_url, streamName: stream.stream_name, startedAt, serverNow: Date.now() });
  }
  const live = db.get("SELECT id, started_at FROM live_sessions WHERE course_id = ? AND status = 'live' ORDER BY started_at DESC LIMIT 1", [req.params.courseId]);
  res.json({ isLive: !!live, sessionId: live ? 'session_' + req.params.courseId + '_' + Date.parse(live.started_at) : null, startedAt: live ? live.started_at : null });
});

// ── API: 获取课程回放列表 ──
router.get('/api/replays/:courseId', access.course('courseId'), (req, res) => {
  const replays = db.query('SELECT id, title, duration, created_at FROM live_replays WHERE course_id = ? ORDER BY created_at DESC', [req.params.courseId]);
  res.json(replays);
});

// ── 学生看回放 ──
router.get('/student/replay/:replayId', access.replay('replayId'), (req, res) => {
  // Keep shared/bookmarked URLs, but retire the separate timeline player.
  return res.redirect('/live/student/vod-replay/' + encodeURIComponent(req.params.replayId));
});


// Legacy local recording upload: authenticate before accepting bytes, stage privately,
// then validate course ownership before publishing the file or changing database rows.
const os = require('os');
const { controls } = require('../middleware/live-security');
const recordingUpload = multer({ dest: os.tmpdir(), limits: { fileSize: 100 * 1024 * 1024, files: 1 }, fileFilter(req,file,cb){cb(null,['.webm','.mp4'].includes(path.extname(file.originalname).toLowerCase()));} });
router.post('/teacher/save-recording', (req,res,next)=>{
  const person=req.session && req.session.teacherId && db.get('SELECT id,status FROM teachers WHERE id=?',[req.session.teacherId]);
  const access=require('../lib/admin-access'), account=access.sessionAccount(db,req.session);
  if(!person||person.status==='disabled'||!account||!access.can(account,'live',true))return res.status(401).json({ok:false,error:'请先登录教师端'});
  next();
}, recordingUpload.single('recording'), async (req,res,next)=>{
  if(!req.file)return res.status(400).json({ok:false,error:'请选择 MP4 或 WebM 视频'});
  let target;
  try {
    const courseId=Number((req.body||{}).courseId);
    if(!controls(db,req.session,courseId)){fs.unlinkSync(req.file.path);return res.status(403).json({ok:false,error:'无权保存该课程录播'});}
    const header=Buffer.alloc(12),fd=fs.openSync(req.file.path,'r');try{fs.readSync(fd,header,0,12,0);}finally{fs.closeSync(fd);}
    const ext=path.extname(req.file.originalname).toLowerCase();
    if((ext==='.webm'&&header.readUInt32BE(0)!==0x1a45dfa3)||(ext==='.mp4'&&header.toString('ascii',4,8)!=='ftyp')){fs.unlinkSync(req.file.path);return res.status(400).json({ok:false,error:'视频文件格式不匹配'});}
    const name=crypto.randomUUID()+path.extname(req.file.originalname).toLowerCase();
    const folder=path.join(__dirname,'..','public','recordings');fs.mkdirSync(folder,{recursive:true});
    target=path.join(folder,name);fs.copyFileSync(req.file.path,target,fs.constants.COPYFILE_EXCL);fs.unlinkSync(req.file.path);
    await require('../db/replay-storage')({courseId,filename:name,title:new Date().toLocaleDateString('zh-CN')+' 录播'});
    res.json({ok:true,filename:name});
  }catch(e){if(target){try{fs.unlinkSync(target)}catch{}}if(req.file){try{fs.unlinkSync(req.file.path)}catch{}}next(e);}
});
router.use((error,req,res,next)=>{if(error instanceof multer.MulterError)return res.status(400).json({ok:false,error:'视频大小或数量超限'});next(error);});

// --- Get recordings for a course ---
router.get('/api/recordings/:courseId', access.course('courseId'), (req, res) => {
  const recordings = db.query("SELECT id, title, duration, created_at, recorded_file FROM live_replays WHERE course_id=? AND recorded_file IS NOT NULL AND recorded_file != '' ORDER BY created_at DESC", [req.params.courseId]);
  res.json(recordings);
});


// ── 学生观看直播 ──
router.get('/student/live-watch/:courseId', access.course('courseId'), (req, res) => {
  const course = db.get('SELECT * FROM courses WHERE id=?', [req.params.courseId]);
  if (!course) return res.redirect('/live/student');
  const stream = db.get("SELECT * FROM live_streams WHERE course_id=? AND status='live' ORDER BY COALESCE(started_at, created_at) DESC LIMIT 1", [req.params.courseId]);
  let lessonTitle = '';
  if (stream && stream.lesson_id) {
    const lesson = db.get('SELECT title FROM lessons WHERE id=?', [stream.lesson_id]);
    lessonTitle = lesson ? lesson.title : '';
  }
  let streamStartedAt = '';
  if (stream && stream.started_at) {
    try {
      const d = new Date(String(stream.started_at).replace(' ', 'T') + 'Z');
      if (!isNaN(d.getTime())) streamStartedAt = d.toISOString();
    } catch(e) {}
  }
  res.render('student/live-watch', { viewerStudent: req.session.studentId ? db.get('SELECT nickname, name, avatar FROM students WHERE id=?', [req.session.studentId]) : null, title: course.title + ' · 直播间', course, stream: stream || null, lessonTitle, streamStartedAt, serverNow: Date.now() });
});


// ── 学生观看点播回放 ──
router.get('/student/vod-replay/:id', access.replay('id'), (req, res) => {
  const replay = db.get('SELECT * FROM live_replays WHERE id=?', [req.params.id]);
  if (!replay) return res.redirect('/live/student');
  res.render('student/vod-replay', { viewerStudent: req.session.studentId ? db.get('SELECT nickname, name, avatar FROM students WHERE id=?', [req.session.studentId]) : null, title: '回放: ' + replay.title, ...replayPlayback(replay) });
});


router.get('/student/replay-duo/:courseId', access.course('courseId'), (req, res) => {
  const course = db.get('SELECT * FROM courses WHERE id=?', [req.params.courseId]);
  const lessonId = parseInt(req.query.lesson) || 0;
  let replays = db.query("SELECT * FROM live_replays WHERE course_id=? ORDER BY id DESC", [req.params.courseId]);
  if (lessonId) {
    replays = replays.filter(function(r) { return Number(r.lesson_id) === lessonId; });
  }
  replays = replays.map(r=>replayPlayback(r).replay).filter(r=>r.video_url);
  const main = replays.find(r=>String(r.title||'').includes('授课')) || replays.find(r=>!String(r.title||'').includes('老师')) || replays[0] || null;
  const cam = require('../lib/replay-camera-pair')(main, replays, id => db.get('SELECT course_id, lesson_id, started_at, ended_at FROM live_sessions WHERE id=?', [id]));
  if (!course || !main || !main.video_url) return res.redirect(lessonId ? '/live/student/courses/' + req.params.courseId : '/live/student');
  let lessonTitle = '';
  if (main.lesson_id) {
    const lesson = db.get('SELECT title FROM lessons WHERE id=?', [main.lesson_id]);
    lessonTitle = lesson ? lesson.title : '';
  }
  res.render('student/replay-duo', {
    viewerStudent: req.session.studentId ? db.get('SELECT nickname, name, avatar FROM students WHERE id=?', [req.session.studentId]) : null,
    title: '直播回放 · ' + course.title,
    course: course,
    main: main,
    cam: cam,
    chatLog: main.chat_log || '[]',
    rerecordUrl: Number(req.session.teacherPortalId)===Number(course.teacher_id) && Number(main.lesson_id)>0 ? '/teaching/live/'+course.id+'?lesson='+main.lesson_id : '',
    lessonTitle: lessonTitle
  });
});

// ── 腾讯云录制回调：自动生成回放 ──
const verifyRecording = require('../middleware/recording-auth')(() => {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'live-config.json'), 'utf8')).recordingCallbackKey || ''; } catch { return ''; }
});
router.post('/api/recording-callback', verifyRecording, (req, res) => {
  let failed = false;
  let events = Array.isArray(req.body) ? req.body : [req.body];
  (events || []).forEach(function(ev) {
    try {
      if (!ev) return;
      if (ev.event_type !== 'recording_new_file' && ev.event_type !== 100) return;
      const p = ev.payload || ev;
      const channelId = String(p.channel_id || ev.channel_id || p.stream_id || ev.stream_id || '');
      const fileFormat = String(p.file_format || ev.file_format || '');
      const isHls = fileFormat === 'hls' || fileFormat === 'm3u8';
      const isMp4 = fileFormat === 'mp4';
      if (!channelId || (!isHls && !isMp4)) return;
      if (isHls && !(p.last_file || ev.last_file)) return;
      const mainChannel = channelId.indexOf('_cam_main') > -1 ? channelId.replace('_cam_main', '_main') : channelId;
      let stream = null;
      const rows = db.query('SELECT * FROM live_streams');
      stream = rows.find(function(r) {
        let playbackStream = '';
        try { playbackStream = path.basename(new URL(r.play_url).pathname).replace(/\.(?:flv|m3u8)$/i, ''); } catch {}
        return [r.stream_name, playbackStream].some(name => name === channelId || name === mainChannel);
      }) || null;
      if (!stream) return;
      const courseId = stream.course_id;
      const course = db.get('SELECT id, teacher_id FROM courses WHERE id=?', [courseId]);
      if (!course) return;
      const lessonId = stream.lesson_id || null;
      if (lessonId) {
        const owner = db.get('SELECT course_id FROM lessons WHERE id=?', [lessonId]);
        if (!owner || Number(owner.course_id) !== Number(courseId)) return;
      }
      const isCam = channelId.indexOf('_cam_') > -1;
      const lessonType = isCam ? '老师画面' : '授课画面';
      let title = isCam ? '直播回放 · 老师画面' : '直播回放 · 授课画面';
      if (lessonId) {
        const lesson = db.get('SELECT title FROM lessons WHERE id=?', [lessonId]);
        if (lesson && lesson.title) title = lesson.title + (isCam ? ' · 老师画面' : ' · 授课画面');
      }
      const video = String(p.video_url || ev.video_url || '');
      if (video) {
        try { const url = new URL(video); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return; } catch { return; }
      }
      const fileId = String(p.file_id || ev.file_id || '');
      const duration = parseInt(p.duration || ev.duration) || 0;
      let chatLog = '[]';
      try {
        const startAt = stream ? (stream.started_at || '') : '';
        if (startAt) {
          const endAt = stream ? (stream.ended_at || '') : '';
          let sql = 'SELECT sender, content, type, created_at FROM live_chats WHERE course_id=? AND created_at >= ?';
          const params = [courseId, startAt];
          if (endAt) {
            sql += ' AND created_at <= ?';
            params.push(endAt);
          }
          sql += ' ORDER BY created_at';
          const chats = db.query(sql, params).filter(function(m) {
            const c = String(m.content || '');
            return !(String(m.sender || '') === '系统' && (c.indexOf('老师已开始直播') > -1 || c.indexOf('老师已结束直播') > -1));
          });
          chatLog = JSON.stringify(chats);
        }
      } catch(e) {}
      const existing = lessonId
        ? db.get("SELECT * FROM live_replays WHERE course_id=? AND lesson_id=? AND title LIKE ? ORDER BY id LIMIT 1", [courseId, lessonId, '%' + lessonType + '%'])
        : db.get("SELECT * FROM live_replays WHERE course_id=? AND title LIKE ? ORDER BY id LIMIT 1", [courseId, '%' + lessonType + '%']);
      const existingIsHls = existing && String(existing.video_url || '').indexOf('.m3u8') > -1;
      if (existing) {
        if (isHls) {
          db.run('UPDATE live_replays SET title=?, duration=?, video_url=?, lesson_id=?, chat_log=?, file_id=? WHERE id=?',
            [title, duration, video, lessonId, chatLog, fileId, existing.id]);
          console.log('[Replay] auto updated with hls', courseId, channelId, title);
        } else if (existingIsHls) {
          console.log('[Replay] skip partial mp4, hls exists', courseId, channelId);
          return;
        } else if (Number(existing.duration) >= duration) {
          console.log('[Replay] skip shorter mp4', courseId, channelId);
          return;
        } else {
          db.run('UPDATE live_replays SET title=?, duration=?, video_url=?, lesson_id=?, chat_log=?, file_id=? WHERE id=?',
            [title, duration, video, lessonId, chatLog, fileId, existing.id]);
          console.log('[Replay] auto updated', courseId, channelId, title);
        }
      } else {
        const startedAt = stream.started_at || stream.created_at || new Date().toISOString().replace('T', ' ').slice(0, 19);
        let linkedSession = db.get('SELECT id FROM live_sessions WHERE course_id=? AND started_at=? AND status=? ORDER BY id DESC LIMIT 1', [courseId, startedAt, 'ended']);
        if (!linkedSession) {
          const id = db.run('INSERT INTO live_sessions (course_id, teacher_id, lesson_id, status, started_at, ended_at) VALUES (?,?,?,?,?,?)', [courseId, course.teacher_id, lessonId, 'ended', startedAt, stream.ended_at || startedAt]);
          linkedSession = { id };
        }
        db.run('INSERT INTO live_replays (session_id, course_id, title, duration, video_url, lesson_id, chat_log, file_id) VALUES (?,?,?,?,?,?,?,?)',
          [linkedSession.id, courseId, title, duration, video, lessonId, chatLog, fileId]);
        console.log('[Replay] auto created', courseId, channelId, title);
      }
      if (!isCam && lessonId && video) {
        try {
          const lesson = db.get('SELECT video_url FROM lessons WHERE id=?', [lessonId]);
          const current = lesson ? String(lesson.video_url || '') : '';
          if (!current || isHls || (isMp4 && (!existing || Number(duration) > Number(existing.duration)))) {
            db.run('UPDATE lessons SET video_url=? WHERE id=?', [video, lessonId]);
          }
        } catch(e) {}
      }
      if (fileId && !video) {
        const { getVodUrl } = require('../vod');
        getVodUrl(fileId).then(function(r) {
          if (r && r.url) {
            db.run('UPDATE live_replays SET video_url=? WHERE course_id=? AND file_id=?', [r.url, courseId, fileId]);
            console.log('[Replay] url filled', courseId, fileId);
          }
        }).catch(function(e) { console.error('[Replay] url err', e.message); });
      }
    } catch(e) { failed = true; console.error('[Replay] callback processing failed'); }
  });
  if (failed) return res.status(500).json({ code: 1, error: '回调处理失败，请重试' });
  res.json({ code: 0, ok: true });
});

// ── 服务器计时接口 ──
router.get('/api/clock/:courseId', (req, res) => {
  const stream = db.get("SELECT started_at FROM live_streams WHERE course_id=? AND status='live' ORDER BY COALESCE(started_at, created_at) DESC LIMIT 1", [req.params.courseId]);
  let elapsed = 0;
  if (stream && stream.started_at) {
    try {
      const d = new Date(String(stream.started_at).replace(' ', 'T') + 'Z');
      if (!isNaN(d.getTime())) elapsed = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
    } catch(e) {}
  }
  res.json({ elapsed });
});

// ── 学生端 TRTC 进房配置 ──
router.get('/api/trtc-config', access.guard(req => req.query.roomId), (req, res) => {
  const roomId = parseInt(req.query.roomId) || 0;
  if (!roomId) return res.status(400).json({ error: 'roomId required' });
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'live-config.json'), 'utf8')); } catch (e) {}
  const appId = parseInt(cfg.trtcAppId) || 0;
  const secretKey = cfg.trtcSecretKey || '';
  if (!appId || !secretKey) return res.status(500).json({ error: 'trtc not configured' });
  const userId = 'stu_' + (req.session.studentId || 'preview') + '_' + crypto.randomBytes(4).toString('hex');
  const credentials = require('../middleware/trtc-tickets')(appId, secretKey, userId, roomId, 'audience');
  res.set('Cache-Control', 'private, no-store, max-age=0');
  res.json({ sdkAppId: appId, roomId, userId, ...credentials });
});

module.exports = router;

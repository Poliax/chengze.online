const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');

function requireAdmin(req, res, next) {
  const access=require('../lib/admin-access');
  const account=access.sessionAccount(require('../db'),req.session);
  if (account && access.can(account,'materials',true)) return next();
  return res.status(401).json({ ok: false, error: '请先登录管理后台' });
}
function safeUpload(extensions) {
  return {
    limits: { fileSize: 20 * 1024 * 1024, files: 1 },
    fileFilter(req, file, cb) {
      if (!extensions.includes(path.extname(file.originalname).toLowerCase())) return cb(new Error('不支持此文件类型'));
      cb(null, true);
    }
  };
}
function uniqueFilename(req, file, cb) {
  const extension = path.extname(file.originalname).toLowerCase();
  const name = path.basename(file.originalname, path.extname(file.originalname)).replace(/[^\p{L}\p{N}_-]/gu, '_').slice(0, 60) || 'material';
  cb(null, name + '_' + crypto.randomUUID() + extension);
}
function allowedFile(name) {
  if (typeof name !== 'string' || !name || name.includes('\\') || name.includes('/') || name.includes('\0') || name.startsWith('.')) return null;
  const file = path.resolve(MATERIALS_DIR, name);
  if (path.dirname(file) !== path.resolve(MATERIALS_DIR)) return null;
  try { if (!fs.lstatSync(file).isFile()) return null; } catch { return null; }
  return file;
}

const MATERIALS_DIR = path.join(__dirname, '..', 'public', 'materials');
if (!fs.existsSync(MATERIALS_DIR)) fs.mkdirSync(MATERIALS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, MATERIALS_DIR),
  filename: uniqueFilename
});
const upload = multer({ storage, ...safeUpload(['.pdf', '.doc', '.docx']) });

// Student materials page
router.get('/', (req, res) => {
  let files = [];
  try {
    files = fs.readdirSync(MATERIALS_DIR)
      .filter(f => f.endsWith('.pdf') || f.endsWith('.docx') || f.endsWith('.doc'))
      .map(f => {
        const stat = fs.statSync(path.join(MATERIALS_DIR, f));
        const ext = path.extname(f);
        return {
          name: f.replace(ext, ''),
          filename: f,
          size: (stat.size / 1024 / 1024).toFixed(1) + ' MB',
          date: stat.mtime.toLocaleDateString('zh-CN'),
          type: ext === '.pdf' ? 'pdf' : 'doc'
        };
      });
  } catch(e) {}
  res.render('student/materials', { title: '学习资料 · 承泽教育', files });
});

// Teacher upload page
router.get('/upload', requireAdmin, (req, res) => {
  let files = [];
  try {
    files = fs.readdirSync(MATERIALS_DIR).map(f => {
      const stat = fs.statSync(path.join(MATERIALS_DIR, f));
      return { filename: f, size: (stat.size / 1024).toFixed(0) + ' KB' };
    });
  } catch(e) {}
  res.render('teacher/upload-materials', { title: '上传资料 · 管理后台', files, teacherName: req.session.teacherName });
});

// Handle upload
router.post('/upload', requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.redirect('/materials/upload');
  res.redirect('/materials/upload');
});

// Delete file
router.post('/delete/:filename', requireAdmin, (req, res) => {
  const filepath = allowedFile(req.params.filename);
  if (!filepath) return res.status(400).json({ ok: false, error: '文件不存在或路径无效' });
  fs.unlinkSync(filepath);
  res.redirect('/materials/upload');
});


// --- Slide upload for live classroom ---
const slideStorage = multer.diskStorage({
  destination: (req,file,cb) => {
    const dir=require('path').join(__dirname,'..','public','materials');
    cb(null,dir);
  },
  filename: uniqueFilename
});
const slideUpload = multer({ storage: slideStorage, ...safeUpload(['.pdf', '.png', '.jpg', '.jpeg', '.webp']) });

router.post('/upload/slide', requireAdmin, slideUpload.single('file'), (req,res) => {
  if(!req.file) return res.json({ok:false});
  res.json({ok:true, filename:req.file.filename});
});

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message === '不支持此文件类型') {
    return res.status(400).json({ ok: false, error: err.code === 'LIMIT_FILE_SIZE' ? '文件不能超过20MB' : '文件类型或上传数量不符合要求' });
  }
  next(err);
});

module.exports = router;

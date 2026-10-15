const express = require('express');
const db = require('../db');
const router = express.Router();

function requireStudent(req, res, next) {
  const id = Number(req.session && req.session.studentId);
  const student = Number.isSafeInteger(id) && id > 0 && db.get('SELECT id, status FROM students WHERE id=?', [id]);
  if (student && student.status !== 'disabled') return next();
  return res.status(401).json({ ok: false, error: '请先登录' });
}

function genOrderNo() {
  return 'CZ' + Date.now().toString().slice(-10) + Math.floor(1000 + Math.random() * 9000);
}

function getOrderItem(body) {
  const packageId = parseInt(body.package_id) || 0;
  const courseId = parseInt(body.course_id) || 0;
  if (packageId) {
    const pkg = db.get("SELECT * FROM course_packages WHERE id=? AND status='published'", [packageId]);
    if (!pkg) return { error: '课程包不存在或未上架' };
    const amount = parseFloat(pkg.sale_price || pkg.price || 0);
    return { kind: 'package', package_id: packageId, title: pkg.title, amount: isNaN(amount) ? 0 : amount };
  }
  if (courseId) {
    const course = db.get("SELECT * FROM courses WHERE id=? AND status='published'", [courseId]);
    if (!course) return { error: '课程不存在或未上架' };
    const amount = parseFloat(course.sale_price || course.price || 0);
    return { kind: 'course', course_id: courseId, title: course.title, amount: isNaN(amount) ? 0 : amount };
  }
  return { error: '请选择要购买的商品' };
}

// ── 创建订单 ──
router.post('/orders', requireStudent, (req, res) => {
  const item = getOrderItem(req.body || {});
  if (item.error) return res.json({ ok: false, error: item.error });
  const id = db.run('INSERT INTO orders (order_no, student_id, course_id, package_id, amount, status, payment_method) VALUES (?,?,?,?,?,?,?)',
    [genOrderNo(), req.session.studentId, item.course_id || null, item.package_id || 0, item.amount, 'pending', '']);
  const order = db.get('SELECT * FROM orders WHERE id=?', [id]);
  return res.json({ ok: true, order });
});

// ── 我的订单 ──
router.get('/orders', requireStudent, (req, res) => {
  const orders = db.query(`SELECT o.*, c.title as course_title, p.title as package_title
    FROM orders o
    LEFT JOIN courses c ON c.id=o.course_id
    LEFT JOIN course_packages p ON p.id=o.package_id
    WHERE o.student_id=? ORDER BY o.created_at DESC`, [req.session.studentId]);
  return res.json({ ok: true, orders });
});

// ── 发起支付 ──
router.post('/orders/:id/pay', requireStudent, (req, res) => {
  const id = parseInt(req.params.id) || 0;
  const order = db.get('SELECT * FROM orders WHERE id=? AND student_id=?', [id, req.session.studentId]);
  if (!order) return res.status(404).json({ ok: false, error: '订单不存在' });
  if (order.status === 'paid') return res.json({ ok: true, order, alreadyPaid: true });
  const channel = (req.body.channel || '').toLowerCase();
  if (channel !== 'wechat' && channel !== 'alipay') return res.json({ ok: false, error: '请选择支付方式' });

  // No verified provider integration exists yet. Never grant enrollment from a browser request.
  return res.status(503).json({ ok: false, error: '在线支付尚未开通，请联系管理员办理报名' });
});

// Provider callbacks must remain closed until signature and payment reconciliation are implemented.
function notifyPaid(req, res) {
  return res.status(403).json({ ok: false, error: '支付回调验签未配置' });
}

router.post('/pay/notify/wechat', notifyPaid);
router.post('/pay/notify/alipay', notifyPaid);

module.exports = router;

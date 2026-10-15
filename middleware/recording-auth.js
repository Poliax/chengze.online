const crypto = require('crypto');

module.exports = function recordingAuth(loadKey) {
  const processed = new Map();
  return (req, res, next) => {
    const key = loadKey();
    if (typeof key !== 'string' || key.length < 16) return res.status(503).json({ code: 1, error: '录制回调认证未配置' });
    const events = Array.isArray(req.body) ? req.body : [req.body];
    const now = Math.floor(Date.now() / 1000);
    if (!events.length || events.length > 16) return res.status(400).json({ code: 1, error: '回调格式无效' });
    for (const event of events) {
      if (!event || typeof event !== 'object' || Array.isArray(event) || !/^[1-9]\d*$/.test(String(event.t)) || !/^[a-f0-9]{32}$/i.test(event.sign || '')) {
        return res.status(403).json({ code: 1, error: '回调签名无效' });
      }
      const expiry = Number(event.t);
      if (!Number.isSafeInteger(expiry) || expiry < now || expiry > now + 900) return res.status(403).json({ code: 1, error: '回调签名已过期或时间无效' });
      const expected = crypto.createHash('md5').update(key + String(event.t)).digest();
      if (!crypto.timingSafeEqual(expected, Buffer.from(event.sign, 'hex'))) return res.status(403).json({ code: 1, error: '回调签名无效' });
    }
    const serialized = JSON.stringify(events);
    if (Buffer.byteLength(serialized) > 128 * 1024) return res.status(413).json({ code: 1, error: '回调内容过大' });
    for (const [id, expiry] of processed) if (expiry < now) processed.delete(id);
    const fingerprint = crypto.createHash('sha256').update(serialized).digest('hex');
    if (processed.has(fingerprint)) return res.json({ code: 0, ok: true, duplicate: true });
    res.once('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        if (processed.size >= 5000) processed.delete(processed.keys().next().value);
        processed.set(fingerprint, Math.min(...events.map(e => Number(e.t))));
      }
    });
    next();
  };
};

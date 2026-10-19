// Retired marketing pages are unavailable; the only student homepage is /.
const legacyPages = new Set(['/learning', '/learning-center', '/index.html', '/about', '/contact', '/feedback', '/courses', '/teachers']);
module.exports = function primarySite(req, res, next) {
  const pathname = req.path.replace(/\/$/, '') || '/';
  if (legacyPages.has(pathname) || /^\/(?:public\/)?site(?:\/|$)/.test(pathname)) {
    return res.status(404).type('text/plain').send('页面不存在');
  }
  // Canonicalize student pages; keep callbacks, APIs and assets on their existing hosts.
  if (req.hostname === 'chengze.online' && ['GET','HEAD'].includes(req.method) &&
      (pathname === '/' || (req.headers && (req.headers.accept || '').includes('text/html') &&
      !/^\/(?:api|live|socket\.io|materials|courseware|recordings|player|public|css|js|assets|data)(?:\/|$)/.test(pathname)))) {
    return res.redirect(308, 'https://www.chengze.online' + req.originalUrl);
  }
  next();
};

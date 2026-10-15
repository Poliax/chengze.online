const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const staticFiles = require('../middleware/static-files');

test('serves browser assets without exposing server files or datasets', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chengze-static-'));
  const publicFiles = ['index.html', 'css/style.css', 'js/main.js', 'public/images/logo.svg',
    'favicon-16-v18.png', 'data/exam.pdf'];
  const privateFiles = ['server.js', 'package.json', 'db/chengze.db', 'backups/export.zip',
    'routes/auth.js', 'views/student/index.ejs', 'data/questions.json', '.env'];
  for (const file of [...publicFiles, ...privateFiles]) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), 'fixture');
  }
  const app = express();
  app.use(staticFiles(root));
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const file of publicFiles) {
      assert.equal((await fetch(`${base}/${file}`)).status, 200, file);
    }
    for (const file of [...privateFiles, 'css/%2e%2e/server.js', 'data/%2e%2e/db/chengze.db']) {
      assert.equal((await fetch(`${base}/${file}`)).status, 404, file);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

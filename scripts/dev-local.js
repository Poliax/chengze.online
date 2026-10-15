// Run production code with isolated local data and no production credentials.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
(async () => {
const root = path.resolve(__dirname, '..');
const runtime = path.join(root, '.local-runtime-v2');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'scripts/online-source-manifest.json'), 'utf8'));
fs.mkdirSync(runtime, { recursive: true, mode: 0o700 });
for (const relative of Object.keys(manifest.files)) {
  const source = path.join(root, relative);
  const target = path.join(runtime, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}
// The production server binds to all interfaces; local development stays loopback only.
const entry = path.join(runtime, 'server.js');
fs.writeFileSync(entry, fs.readFileSync(entry, 'utf8').replace('server.listen(PORT, "0.0.0.0", "0.0.0.0",', 'server.listen(PORT, "127.0.0.1",'));
fs.mkdirSync(path.join(runtime, 'data'), { recursive: true });
const modules = path.join(runtime, 'node_modules');
if (!fs.existsSync(modules)) fs.symlinkSync(path.join(root, 'node_modules'), modules, 'dir');
const configFile = path.join(runtime, 'live-config.json');
if (!fs.existsSync(configFile)) {
  fs.writeFileSync(configFile, JSON.stringify({
    sessionSecret: crypto.randomBytes(32).toString('hex'),
    sms: { devMode: false }, pay: { devMode: false },
    mediaSigning: { domains: {} }
  }, null, 2), { mode: 0o600 });
}
const dbFile = path.join(runtime, 'db', 'chengze.db');
if (!fs.existsSync(dbFile)) {
  const SQL = await require('sql.js')();
  const db = new SQL.Database();
  db.run(fs.readFileSync(path.join(root, 'db', 'development-schema.sql'), 'utf8'));
  fs.writeFileSync(dbFile, Buffer.from(db.export()), { mode: 0o600 });
  db.close();
}
console.log('Local development: http://127.0.0.1:' + (process.env.PORT || 3001));
console.log('Isolated empty database/configuration: .local-runtime (not production data).');
const child = spawn(process.execPath, [entry], {
  cwd: runtime, env: { ...process.env, PORT: process.env.PORT || '3001', NODE_ENV: 'development' }, stdio: 'inherit'
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => process.exit(code || 0));

})().catch(error => { console.error(error.message); process.exitCode = 1; });

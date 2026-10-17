// Idempotent migration: preserve account IDs, passwords and business relationships.
module.exports = function migrate(db) {
  const create = name => `CREATE TABLE ${name} (
    teacher_id INTEGER PRIMARY KEY REFERENCES teachers(id),
    role TEXT NOT NULL CHECK(role IN ('ceo','enrollment_supervisor','teaching_supervisor','operations_supervisor','service_supervisor','technical_lead','developer','operations','teacher','assistant','sales')),
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
    permissions TEXT NOT NULL DEFAULT '{}',
    permission_expires_at TEXT NOT NULL DEFAULT '',
    session_version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`;
  const stmt=db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='admin_accounts'");
  const existing=stmt.step() ? stmt.getAsObject().sql : null; stmt.free();
  if (!existing) db.run(create('admin_accounts'));
  else if (!existing.includes("'developer'")) {
    db.run('BEGIN IMMEDIATE');
    try {
      db.run(create('admin_accounts_upgrade'));
      // Old supervisors already had full access; retain that access as CEO, revoke old sessions.
      db.run(`INSERT INTO admin_accounts_upgrade(teacher_id,role,status,permissions,session_version,created_at,updated_at) SELECT teacher_id,CASE WHEN role='supervisor' THEN 'ceo' ELSE role END,status,permissions,session_version+1,created_at,updated_at FROM admin_accounts`);
      db.run('DROP TABLE admin_accounts');
      db.run('ALTER TABLE admin_accounts_upgrade RENAME TO admin_accounts');
      db.run('COMMIT');
    } catch(error) { db.run('ROLLBACK'); throw error; }
  }
  // Add separate organization and permission dimensions without replacing business data.
  const columns=db.exec('PRAGMA table_info(admin_accounts)')[0].values.map(row=>row[1]);
  let upgraded=false;
  for(const [name,type] of [['department',"TEXT NOT NULL DEFAULT ''"],['permission_level',"TEXT NOT NULL DEFAULT ''"],['secondary_roles',"TEXT NOT NULL DEFAULT '[]'"],['permission_mode',"TEXT NOT NULL DEFAULT 'custom'"]]) {
    if(!columns.includes(name)){db.run('ALTER TABLE admin_accounts ADD COLUMN '+name+' '+type);upgraded=true;}
  }
  const access=require('../../lib/admin-access');
  for(const role of Object.keys(access.roles)) db.run('UPDATE admin_accounts SET department=?,permission_level=? WHERE role=? AND (department=\'\' OR permission_level=\'\')',[access.roleDepartments[role],access.levelCode(role),role]);
  if(upgraded) db.run('UPDATE admin_accounts SET session_version=session_version+1');
  db.run(`CREATE TABLE IF NOT EXISTS admin_account_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,actor_id INTEGER NOT NULL,target_id INTEGER NOT NULL,
    action TEXT NOT NULL,details TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  // Fail closed if an older installation already has multiple super accounts; do not silently demote anyone.
  db.run("CREATE UNIQUE INDEX IF NOT EXISTS one_super_account ON admin_accounts(role) WHERE role='ceo'");
  db.run(`INSERT OR IGNORE INTO admin_accounts(teacher_id,role) SELECT id,'ceo' FROM teachers WHERE username='admin' AND NOT EXISTS(SELECT 1 FROM admin_accounts WHERE role='ceo')`);
  db.run("UPDATE admin_accounts SET department='platform',permission_level='L0' WHERE role='ceo'");
};

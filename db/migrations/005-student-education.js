module.exports = function migrateStudentEducation(db) {
  const info = db.exec('PRAGMA table_info(students)');
  if (!info.length) throw Error('Education migration requires students table');
  const names = new Set(info[0].values.map(row => row[1]));
  const missing = ['junior_college','junior_major'].filter(name=>!names.has(name));
  if (!missing.length) return;
  db.run('BEGIN IMMEDIATE');
  try {
    for (const name of missing) db.run(`ALTER TABLE students ADD COLUMN ${name} TEXT DEFAULT ''`);
    db.run('COMMIT');
  } catch (error) { db.run('ROLLBACK'); throw error; }
};

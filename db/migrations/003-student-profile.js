// Add profile fields to existing databases without reseeding or updating rows.
module.exports = function migrateStudentProfile(db) {
  const result = db.exec('PRAGMA table_info(students)');
  if (!result.length) throw Error('Student profile migration requires students table');
  const names = new Set(result[0].values.map(row => row[1]));
  const fields = ['province_code','exam_year','nickname','avatar','recipient_name','recipient_phone','recipient_address'];
  const missing = fields.filter(name => !names.has(name));
  if (!missing.length) return;
  db.run('BEGIN IMMEDIATE');
  try {
    for (const name of missing) db.run(`ALTER TABLE students ADD COLUMN ${name} TEXT DEFAULT ''`);
    db.run('COMMIT');
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }
};

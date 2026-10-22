const test=require('node:test'),assert=require('node:assert/strict'),initSqlJs=require('sql.js');
const migrate=require('../db/migrations/003-student-profile');
test('existing student database gains profile fields, preserves records, and supports repeated startup',async()=>{
 const SQL=await initSqlJs(),db=new SQL.Database();
 db.run("CREATE TABLE students(id INTEGER PRIMARY KEY,name TEXT,exam_year TEXT);INSERT INTO students VALUES(7,'原姓名','2027');CREATE TABLE enrollments(student_id INTEGER,course_id INTEGER);INSERT INTO enrollments VALUES(7,99)");
 migrate(db);migrate(db);
 assert.deepEqual(db.exec('SELECT id,name,exam_year,province_code,nickname,avatar,recipient_name,recipient_phone,recipient_address FROM students')[0].values,[[7,'原姓名','2027','','','','','','']]);
 assert.deepEqual(db.exec('SELECT * FROM enrollments')[0].values,[[7,99]]);
 db.run("UPDATE students SET nickname='新昵称',province_code='sd',recipient_name='收货人' WHERE id=7");
 const saved=new SQL.Database(db.export());migrate(saved);
 assert.deepEqual(saved.exec('SELECT nickname,province_code,recipient_name FROM students')[0].values,[['新昵称','sd','收货人']]);
 db.close();saved.close();
});

test('shipping migration preserves legacy address and is repeatable',async()=>{const SQL=await initSqlJs(),db=new SQL.Database();db.run("CREATE TABLE students(id INTEGER PRIMARY KEY,recipient_address TEXT);INSERT INTO students VALUES(7,'原地址')");const shipping=require('../db/migrations/004-student-shipping');shipping(db);shipping(db);assert.deepEqual(db.exec('SELECT id,recipient_address,recipient_province,recipient_city,recipient_district,recipient_address_detail FROM students')[0].values,[[7,'原地址','','','','']]);db.close();});

test('education fields are added to existing records without rewriting profile data',async()=>{const SQL=await initSqlJs(),db=new SQL.Database();db.run("CREATE TABLE students(id INTEGER PRIMARY KEY,name TEXT);INSERT INTO students VALUES(7,'原姓名')");const migrate=require('../db/migrations/005-student-education');migrate(db);migrate(db);assert.deepEqual(db.exec('SELECT id,name,junior_college,junior_major FROM students')[0].values,[[7,'原姓名','','']]);db.close();});

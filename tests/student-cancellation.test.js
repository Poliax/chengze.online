const test=require('node:test'),assert=require('node:assert/strict'),initSqlJs=require('sql.js'),bcrypt=require('bcryptjs');
const cancel=require('../lib/student-account-cancellation'),profile=require('../lib/student-account-profile');
test('cancellation verifies ownership, preserves immutable UID and other accounts, and clears profile fields',async()=>{
 const SQL=await initSqlJs(),sql=new SQL.Database();
 sql.run("CREATE TABLE students(id INTEGER PRIMARY KEY,uid TEXT,name TEXT,real_name TEXT,status TEXT,phone TEXT,email TEXT,password_hash TEXT,wechat_nickname TEXT);CREATE TABLE enrollments(student_id INTEGER,course_id INTEGER);INSERT INTO enrollments VALUES(7,99)");
 require('../db/migrations/003-student-profile')(sql);require('../db/migrations/004-student-shipping')(sql);require('../db/migrations/005-student-education')(sql);
 sql.run('INSERT INTO students(id,uid,name,status,phone,password_hash) VALUES(?,?,?,?,?,?)',[7,'IMMUTABLE-7','测试','active','13800000000',bcrypt.hashSync('test-password',4)]);
 sql.run("INSERT INTO students(id,uid,name,status,phone) VALUES(8,'IMMUTABLE-8','其他学员','active','13900000000')");
 const db={get(query,params){const s=sql.prepare(query);s.bind(params);const row=s.step()?s.getAsObject():null;s.free();return row;},run:(query,params)=>sql.run(query,params),atomic(fn){sql.run('BEGIN');try{fn();sql.run('COMMIT');}catch(e){sql.run('ROLLBACK');throw e;}}};
 const request={phone:'13800000000',password:'test-password',confirmation:'注销账号',studentId:8};
 assert.throws(()=>cancel(db,bcrypt,7,{...request,confirmation:''}));assert.throws(()=>cancel(db,bcrypt,7,{...request,password:'wrong'}));assert.throws(()=>cancel(db,bcrypt,7,{...request,phone:'13900000000'}));
 assert.equal(db.get('SELECT status FROM students WHERE id=?',[7]).status,'active');
 cancel(db,bcrypt,7,request);
 const row=db.get('SELECT * FROM students WHERE id=?',[7]);assert.equal(row.uid,'IMMUTABLE-7');assert.equal(row.status,'disabled');assert.equal(row.phone,'');assert.equal(row.password_hash,'');assert.equal(row.recipient_address,'');
 assert.equal(db.get('SELECT name FROM students WHERE id=?',[8]).name,'其他学员');assert.equal(db.get('SELECT course_id FROM enrollments WHERE student_id=?',[7]).course_id,99);assert.throws(()=>cancel(db,bcrypt,7,request));
 assert.throws(()=>profile.accountDetails({uid:'changed'}),/UID/);sql.close();
});

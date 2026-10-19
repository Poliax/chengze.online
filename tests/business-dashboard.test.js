const test=require('node:test'),assert=require('node:assert/strict');
const build=require('../lib/business-dashboard');
test('经营数据按北京时间统计、去重开课并排除未付款及无付款时间订单',async()=>{
 const SQL=await require('sql.js')(),sql=new SQL.Database();
 sql.run(`CREATE TABLE students(id INTEGER,created_at TEXT);CREATE TABLE enrollments(student_id INTEGER,course_id INTEGER,enrolled_at TEXT);CREATE TABLE package_enrollments(student_id INTEGER,package_id INTEGER,enrolled_at TEXT);CREATE TABLE orders(status TEXT,created_at TEXT,paid_at TEXT,amount REAL);CREATE TABLE courses(id INTEGER,title TEXT);CREATE TABLE course_package_courses(package_id INTEGER,course_id INTEGER);CREATE TABLE lessons(id INTEGER);CREATE TABLE qa_questions(status TEXT);CREATE TABLE logistics(status TEXT);`);
 sql.run(`INSERT INTO students VALUES(1,'2026-10-18 16:30:00'),(2,'2026-10-19 16:30:00');INSERT INTO enrollments VALUES(1,1,'2026-10-18 16:30:00'),(1,2,'2026-10-19 01:00:00'),(3,1,'2026-09-01 00:00:00');INSERT INTO package_enrollments VALUES(1,1,'2026-10-18 17:00:00');INSERT INTO courses VALUES(1,'数学'),(2,'英语');INSERT INTO course_package_courses VALUES(1,1);INSERT INTO orders VALUES('paid','2026-10-18 16:30:00','2026-10-18 16:30:00',1280),('pending','2026-10-19 00:00:00',NULL,500),('paid','2026-10-19 00:00:00',NULL,100),('refunded','2026-10-19 00:00:00','2026-10-19 00:00:00',200),('paid','2026-10-19 16:01:00','2026-10-19 16:01:00',900);INSERT INTO qa_questions VALUES('open');INSERT INTO logistics VALUES('pending');`);
 const db={query(q,p=[]){const st=sql.prepare(q);st.bind(p);const rows=[];while(st.step())rows.push(st.getAsObject());st.free();return rows},get(q,p){return this.query(q,p)[0]}};
 const d=build(db,7,new Date('2026-10-19T01:00:00Z'));
 assert.equal(d.today,'2026-10-19');assert.equal(d.series.length,7);assert.equal(d.registered,1);assert.equal(d.enrolled,1);assert.equal(d.totalEnrolled,2);assert.equal(d.amount,1280);assert.equal(d.paidOrders,1);assert.equal(d.paidWithoutDate,1);assert.equal(d.courses[0].n,2);assert.equal(d.orderStatus.reduce((s,r)=>s+r.value,0),4);assert.equal(d.pendingQa,1);assert.equal(d.pendingShipping,1);
 assert.equal(build(db,'1;DROP TABLE orders',new Date('2026-10-19T01:00:00Z')).days,30);
 const ejs=require('ejs'),path=require('path');
 const html=await ejs.renderFile(path.join(__dirname,'../views/teacher/dashboard.ejs'),{dashboard:d,title:'管理后台',cssVer:1,path:'/admin/dashboard',teacherName:'超级账号',adminAccount:{role:'ceo'},canAdmin:()=>true,canAdminPath:()=>true});
 assert.ok(html.includes('经营概览'));assert.ok(html.includes('aria-label="每日已付款订单登记金额折线图"'));assert.ok(html.includes('按首次课程开通去重'));
 const empty=build({...db,query:()=>[],get:()=>({n:0})},30,new Date('2026-10-19T01:00:00Z'));
 const emptyHTML=await ejs.renderFile(path.join(__dirname,'../views/teacher/dashboard.ejs'),{dashboard:empty,title:'管理后台',cssVer:1,path:'/admin/dashboard',teacherName:'超级账号',adminAccount:{role:'ceo'},canAdmin:()=>true,canAdminPath:()=>true});
 assert.ok(emptyHTML.includes('暂无有效付款时间记录'));assert.ok(!emptyHTML.includes('stroke-dasharray="NaN'));
 sql.close();
});

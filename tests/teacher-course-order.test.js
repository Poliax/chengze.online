const test=require('node:test'),assert=require('node:assert/strict'),order=require('../lib/teacher-course-order');
test('course list and simultaneous lessons use the same natural course order',()=>{
 const courses=[{id:3,title:'高等数学10'},{id:2,title:'高等数学2'},{id:1,title:'高等数学1'}];
 const expected=[1,2,3];assert.deepEqual(courses.slice().sort(order.courses).map(c=>c.id),expected);
 const lessons=courses.map(c=>({id:100-c.id,course_id:c.id,course_title:c.title,schedule_time:'2026-10-22 19:00'}));
 assert.deepEqual(lessons.sort(order.lessons).map(l=>l.course_id),expected);
 lessons.push({id:200,course_id:3,course_title:'高等数学10',schedule_time:'2026-10-22 18:00'});assert.equal(lessons.sort(order.lessons)[0].id,200);
});

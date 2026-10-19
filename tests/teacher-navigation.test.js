const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ejs=require('ejs');
const {portalPath}=require('../js/teacher-navigation');
test('局部导航只接管教师端三个页面，登录退出授课和其他域名入口不接管',()=>{
 for(const p of ['/teaching','/teaching/','/teaching/calendar','/teaching/profile','/teach/calendar'])assert.equal(portalPath(p),true,p);
 for(const p of ['/teaching/login','/teaching/logout','/teaching/studio/1','/teaching/live/1','/dashboard','/teaching/calendar/data','//evil.test/teaching'])assert.equal(portalPath(p),false,p);
});
test('教师端模板使用共享导航且无整页跳转脚本，年视图可以安全渲染',async()=>{
 const months=['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
 const base={path:'/teach/calendar',teacherName:'示例',view:'year',year:2026,years:[2026],monthNames:months,yearMonths:months.map((name,i)=>({name,index:i+1,weeks:[[null,null,null,null,null,null,null]]})),typeLabels:{}};
 const html=await ejs.renderFile(path.join(__dirname,'../views/teacher-portal/calendar.ejs'),base);
 assert.ok(html.includes('id="teacherViewStyles"'));assert.ok(html.includes('/js/teacher-navigation.js'));assert.ok(!html.includes('window.location.href'));assert.ok(!html.includes('onchange="goCalendar()"'));assert.ok(html.includes('data-calendar-view="year"'));
 for(const p of ['dashboard','calendar','profile']){const src=fs.readFileSync(path.join(__dirname,'../views/teacher-portal',p+'.ejs'),'utf8');assert.ok(src.includes('/js/teacher-navigation.js'));assert.ok(src.includes('id="teacherViewStyles"'));}
});
test('月历日期左上对齐、课程最多显示三条且完整记录仍可查看',async()=>{
 const schedules=Array.from({length:5},(_,i)=>({title:'课程'+i,course_title:'数学',start_time:'19:00',course_id:1,lesson_id:i+1}));
 const html=await ejs.renderFile(path.join(__dirname,'../views/teacher-portal/calendar.ejs'),{path:'/teach/calendar',teacherName:'示例',view:'month',year:2026,month:10,years:[2026],monthNames:['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'],weeks:[[{date:'2026-10-19',day:19,schedules},null,null,null,null,null,null]],prevMonth:9,prevYear:2026,nextMonth:11,nextYear:2026,typeLabels:{}});
 assert.equal((html.match(/class="cal-ev"/g)||[]).length,3);assert.ok(html.includes('另有 2 节课程'));assert.ok(html.includes('aria-label="2026-10-19，5 节课程"'));assert.ok(html.includes('aria-label="回到本月"'));assert.ok(html.includes('justify-content:flex-start'));assert.ok(html.includes('课程4'));
});

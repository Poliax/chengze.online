const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),ejs=require('ejs');
const entry=require('../lib/teacher-lesson-entry');
test('future lesson opens at Beijing midnight, while history remains available for makeup or restart',()=>{
 const lesson={schedule_time:'2026-10-23 19:00'};
 assert.equal(entry.state(lesson,Date.parse('2026-10-22T15:59:59Z')).live_allowed,false);
 assert.equal(entry.state(lesson,Date.parse('2026-10-22T16:00:00Z')).live_allowed,true);
 assert.equal(entry.state({...lesson,has_taught_session:1},Date.parse('2026-10-24T00:00:00Z')).completed,true);
 assert.equal(entry.state({...lesson,has_taught_session:1,is_live:1},Date.parse('2026-10-24T00:00:00Z')).completed,false);
 assert.equal(entry.state({schedule_time:''}).live_allowed,false);
});
test('server selector rejects future, cross-course and malformed lesson references',()=>{
 const current=entry.today(),rows=[{id:1,course_id:7,schedule_time:current+' 19:00'},{id:2,course_id:7,schedule_time:'2099-12-31 19:00'}];
 const db={get:(sql,args)=>rows.find(l=>l.id===args[0]&&l.course_id===args[1]),query:()=>rows};
 assert.equal(entry.select(db,7,1).id,1);assert.equal(entry.select(db,7).id,1);
 assert.throws(()=>entry.select(db,7,2));assert.throws(()=>entry.select(db,8,1));assert.throws(()=>entry.select(db,7,'../1'));
});
test('future actions are disabled and completed lessons expose real replay and restart entries',async()=>{
 const template=path.resolve('views/teacher-portal/partials/lesson-actions.ejs');
 const future=await ejs.renderFile(template,{courseId:7,lesson:{id:2,schedule_time:'2099-12-31 19:00'}});assert(future.includes('当日开放'));assert(!future.includes('href='));
 const completed=await ejs.renderFile(template,{courseId:7,lesson:{id:1,schedule_time:entry.today()+' 19:00',has_taught_session:1,has_replay_video:true}});
 assert(completed.includes('回放'));assert(completed.includes('重录'));assert(completed.includes('/teach/replay/7?lesson=1'));
 const pending=await ejs.renderFile(template,{courseId:7,lesson:{id:1,schedule_time:entry.today()+' 19:00',has_taught_session:1}});assert(pending.includes('暂无回放'));assert(!pending.includes('/teach/replay/'));
});

test('future start requests are rejected by the actual status handler before database writes',()=>{
 const fs=require('node:fs'),source=fs.readFileSync(require.resolve('../routes/live-admin'),'utf8');const start=source.indexOf("router.post('/live-manage/:id/status'"),end=source.indexOf('\n});',start)+5;let handler,writes=0;
 const db={get(sql,args){if(sql.includes('live_streams'))return {id:1,course_id:7,status:'off'};if(sql.includes('lessons'))return {id:2,course_id:7,schedule_time:'2099-12-31 19:00'};},run(){writes++;}};
 new Function('router','db','lessonEntry',source.slice(start,end))({post:(url,fn)=>handler=fn},db,entry);
 const res={status(n){this.code=n;return this},json(value){this.body=value;return this},redirect(){throw Error('must not start');}};
 handler({params:{id:1},body:{action:'start',lesson_id:2},query:{}},res);assert.equal(res.code,403);assert.equal(writes,0);
});

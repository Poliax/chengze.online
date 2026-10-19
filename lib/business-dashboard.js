// Business metrics are queried only after the super-account guard has succeeded.
module.exports=function businessDashboard(db,requestedDays,now=new Date()){
 const days=[7,30,90].includes(Number(requestedDays))?Number(requestedDays):30;
 const today=new Date(now.getTime()+8*3600000).toISOString().slice(0,10);
 const dates=Array.from({length:days},(_,i)=>new Date(Date.parse(today+'T00:00:00Z')-(days-1-i)*86400000).toISOString().slice(0,10));
 const start=dates[0],end=new Date(Date.parse(today+'T00:00:00Z')+86400000).toISOString().slice(0,10);
 const n=(sql,args=[])=>Number((db.get(sql,args)||{}).n)||0;
 const day=col=>`date(${col},'+8 hours')`;
 const registrations=db.query(`SELECT ${day('created_at')} day,COUNT(*) n FROM students WHERE ${day('created_at')}>=? AND ${day('created_at')}<? GROUP BY day`,[start,end]);
 const enrollSQL='SELECT student_id,enrolled_at FROM enrollments UNION ALL SELECT student_id,enrolled_at FROM package_enrollments';
 const enrollment=db.query(`SELECT ${day('first_at')} day,COUNT(*) n FROM (SELECT student_id,MIN(enrolled_at) first_at FROM (${enrollSQL}) GROUP BY student_id) WHERE ${day('first_at')}>=? AND ${day('first_at')}<? GROUP BY day`,[start,end]);
 const paid=db.query(`SELECT ${day('paid_at')} day,COUNT(*) orders,ROUND(SUM(amount),2) amount FROM orders WHERE status='paid' AND ${day('paid_at')}>=? AND ${day('paid_at')}<? GROUP BY day`,[start,end]);
 const map=rows=>Object.fromEntries(rows.map(r=>[r.day,r]));const regMap=map(registrations),enMap=map(enrollment),paidMap=map(paid);
 const series=dates.map(date=>({date,registrations:Number(regMap[date]?.n)||0,enrollments:Number(enMap[date]?.n)||0,amount:Number(paidMap[date]?.amount)||0,orders:Number(paidMap[date]?.orders)||0}));
 const orderGroups=db.query(`SELECT status,COUNT(*) n FROM orders WHERE ${day('created_at')}>=? AND ${day('created_at')}<? GROUP BY status`,[start,end]);
 const orderStatus=[{label:'已付款',value:0,color:'#4F72CF'},{label:'待付款',value:0,color:'#68B7A5'},{label:'其他状态',value:0,color:'#D6AD69'}];
 for(const r of orderGroups)orderStatus[r.status==='paid'?0:r.status==='pending'?1:2].value+=Number(r.n)||0;
 const courses=db.query(`SELECT c.title,COUNT(DISTINCT x.student_id) n FROM courses c LEFT JOIN (SELECT course_id,student_id FROM enrollments UNION SELECT pc.course_id,pe.student_id FROM package_enrollments pe JOIN course_package_courses pc ON pc.package_id=pe.package_id) x ON x.course_id=c.id GROUP BY c.id ORDER BY n DESC,c.id LIMIT 5`);
 return {days,start,today,series,orderStatus,courses,
  registered:series.reduce((s,r)=>s+r.registrations,0),enrolled:series.reduce((s,r)=>s+r.enrollments,0),
  amount:Math.round(series.reduce((s,r)=>s+r.amount,0)*100)/100,paidOrders:series.reduce((s,r)=>s+r.orders,0),
  totalEnrolled:n(`SELECT COUNT(DISTINCT student_id) n FROM (${enrollSQL})`),
  paidWithoutDate:n("SELECT COUNT(*) n FROM orders WHERE status='paid' AND (paid_at IS NULL OR trim(paid_at)='' OR date(paid_at) IS NULL)"),
  courseCount:n('SELECT COUNT(*) n FROM courses'),lessonCount:n('SELECT COUNT(*) n FROM lessons'),
  pendingQa:n("SELECT COUNT(*) n FROM qa_questions WHERE status='open'"),pendingShipping:n("SELECT COUNT(*) n FROM logistics WHERE status='pending'"),
  updated:new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'short',timeStyle:'short'}).format(now)};
};

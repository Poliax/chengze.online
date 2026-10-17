const {test}=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const domain=require('../middleware/admin-domain');
test('新后台 URL 转换及兼容路径',()=>{
 for(const [before,after] of [['/admin/login','/login'],['/admin/dashboard','/dashboard'],['/admin/courses-manage/3/edit?q=a','/courses/3/edit?q=a'],['/admin/live/studio/3','/studio/3'],['/admin/api/orders','/api/orders'],['https://example.com/admin/login','https://example.com/admin/login']])assert.equal(domain.external(before),after);
 assert.equal(domain.htmlURLs('<form action="/admin/login"><a href="/admin/orders-manage">订单</a><script>fetch(\'/admin/api/orders?x=1\')</script>'),'<form action="/login"><a href="/orders">订单</a><script>fetch(\'/api/orders?x=1\')</script>');
});
test('新域名路由、表单提交及重定向保持可用',async t=>{
 const app=express();app.use(express.urlencoded({extended:false}));app.engine('js',(file,options,done)=>done(null,'<form action="/admin/login"></form><a href="/admin/courses-manage">课程</a>'));app.set('views',__dirname);app.set('view engine','js');
 app.use((req,res,next)=>{res.set('X-Test-Host',req.hostname);next();});app.use(domain);app.get('/admin/login',(req,res)=>res.render('admin-domain.test.js'));app.post('/admin/login',(req,res)=>{assert.equal(req.body.username,'test');res.redirect('/admin/dashboard');});app.get('/admin/dashboard',(req,res)=>res.redirect('/admin/login'));app.get('/admin/courses-manage/:id',(req,res)=>res.json({id:req.params.id,q:req.query.q}));app.post('/materials/upload',(req,res)=>res.send('upload'));app.get('/css/test.css',(req,res)=>res.send('css'));app.get('/live/api/clock/1',(req,res)=>res.send('clock'));

 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const base='http://127.0.0.1:'+server.address().port;
 const request=(path,options={})=>new Promise((resolve,reject)=>{
  const headers={host:'admin.chengze.online',...options.headers};
  if(options.body)headers['content-type']='application/x-www-form-urlencoded';
  const req=require('http').request(base+path,{method:options.method||'GET',headers},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:res.headers})));});req.on('error',reject);req.end(options.body?String(options.body):undefined);
 });
 let login=await request('/login');assert.equal(login.status,200,login.headers.get('x-test-host'));assert.ok((await login.text()).includes('action="/login"'));
 let r=await request('/admin/orders-manage?x=1');assert.equal(r.status,308);assert.equal(r.headers.get('location'),'/orders?x=1');
 r=await request('/');assert.equal(r.headers.get('location'),'/login');
 r=await request('/login',{method:'POST',body:new URLSearchParams({username:'test'})});assert.equal(r.status,302);assert.equal(r.headers.get('location'),'/dashboard');
 r=await request('/materials/upload',{method:'POST',body:new URLSearchParams({file:'test'})});assert.equal(r.status,200);
 r=await request('/teach/live/1');assert.equal(r.status,308);assert.equal(r.headers.get('location'),'/teaching/live/1');
 r=await request('/courses/3?q=ok');assert.deepEqual(await r.json(),{id:'3',q:'ok'});
 for(const path of ['/css/test.css','/live/api/clock/1'])assert.equal((await request(path)).status,200);
 r=await request('/admin/dashboard',{headers:{host:'chengze.online'}});assert.equal(r.headers.get('location'),'/admin/login');
});
test('授课入口保持会话路径，未登录回到授课登录页',async t=>{
 const modulePath=require.resolve('../routes/live-admin'),previous=require.cache[modulePath];
 const fakeRouter=(req,res,next)=>{
  if(!req.session.teacherPortalId)return res.redirect('/admin/login');
  if(req.path==='/live/studio/3')return res.render('admin-domain.test.js',{backUrl:'/admin/live-manage'});
  if(req.path==='/live-manage/3/status')return res.json({path:req.path,body:req.body});
  next();
 };
 require.cache[modulePath]={id:modulePath,filename:modulePath,loaded:true,exports:fakeRouter};
 t.after(()=>{if(previous)require.cache[modulePath]=previous;else delete require.cache[modulePath];});
 const app=express();app.use(express.urlencoded({extended:false}));app.engine('js',(file,options,done)=>done(null,'<a href="'+options.backUrl+'">返回</a><script>fetch(\'/admin/live-manage/3/status\')</script>'));app.set('views',__dirname);app.set('view engine','js');app.use((req,res,next)=>{req.session={teacherPortalId:req.headers['x-test-portal']?7:null};next();});app.use('/teach',domain.portal);app.get('/teach/login',(req,res)=>res.send('portal login'));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());const base='http://127.0.0.1:'+server.address().port;
 let r=await fetch(base+'/teach/live/studio/3',{redirect:'manual'});assert.equal(r.status,302);assert.equal(r.headers.get('location'),'/teach/login');
 r=await fetch(base+'/teach/live/studio/3',{headers:{'x-test-portal':'yes'}});const html=await r.text();assert.ok(html.includes('href="/teach"'));assert.ok(html.includes('/teach/live-manage/3/status'));assert.ok(!html.includes('/admin/'));
 r=await fetch(base+'/teach/live-manage/3/status',{method:'POST',headers:{'x-test-portal':'yes'},body:new URLSearchParams({action:'stop'})});assert.deepEqual(await r.json(),{path:'/live-manage/3/status',body:{action:'stop'}});
 assert.equal((await fetch(base+'/teach/login')).status,200);
});
test('授课工作台位于管理域名下，独立登录和课堂接口保持可用',async t=>{
 const app=express();app.use(express.urlencoded({extended:false}));app.engine('js',(file,options,done)=>done(null,'<form action="/teach/login"></form><a href="/teach/calendar">课表</a><a href="'+(options.backUrl||'/teach')+'">返回</a><script>fetch(\'/admin/live/studio/1/state\')</script>'));app.set('view engine','js');app.set('views',__dirname);app.use(domain);
 app.get('/teach/login',(req,res)=>res.render('admin-domain.test.js'));app.post('/teach/login',(req,res)=>{assert.equal(req.body.username,'teacher');res.redirect('/teach');});app.get('/teach',(req,res)=>res.redirect('/teach/login'));app.get('/admin/live/studio/1',(req,res)=>{if(!req.headers['x-test-portal'])return res.redirect('/admin/login');res.render('admin-domain.test.js',{backUrl:'/admin/live-manage'});});app.post('/admin/live-manage/1/status',(req,res)=>res.json({action:req.body.action}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());const base='http://127.0.0.1:'+server.address().port;
 const request=(path,options={})=>new Promise((resolve,reject)=>{const req=require('http').request(base+path,{method:options.method||'GET',headers:{host:options.host||'admin.chengze.online',...(options.body?{'content-type':'application/x-www-form-urlencoded'}:{}),...options.headers}},res=>{let body='';res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode,location:res.headers.location,body}));});req.on('error',reject);req.end(options.body?String(new URLSearchParams(options.body)):undefined);});
 let r=await request('/teaching/login');assert.equal(r.status,200);assert.ok(r.body.includes('action="/teaching/login"'));assert.ok(r.body.includes('href="/teaching/calendar"'));
 r=await request('/teaching/login',{method:'POST',body:{username:'teacher'}});assert.equal(r.location,'/teaching');
 r=await request('/teaching');assert.equal(r.location,'/teaching/login');
 r=await request('/teaching/studio/1');assert.equal(r.location,'/teaching/login');
 r=await request('/teaching/studio/1',{headers:{'x-test-portal':'yes'}});assert.ok(r.body.includes('href="/teaching"'));assert.ok(r.body.includes('/teaching/studio/1/state'));
 r=await request('/teaching/live-manage/1/status',{method:'POST',body:{action:'stop'}});assert.equal(r.body,'{"action":"stop"}');
 r=await request('/teach/login',{host:'chengze.online'});assert.equal(r.status,308);assert.equal(r.location,'https://admin.chengze.online/teaching/login');
 r=await request('/teach/live/studio/1',{host:'chengze.online'});assert.equal(r.location,'https://admin.chengze.online/teaching/studio/1');
});

 test('授课地址替换不破坏样式文件名、教师图片和相似目录',()=>{
 const domain=require('../middleware/admin-domain');
 const assets='<link href="/css/teacher-backend.css?v=20260812"><img src="/public/images/teachers/avatar.png"><a href="/teaching">已有入口</a>';
 assert.equal(domain.teachingURLs(assets),assets);
 assert.equal(domain.teachingURLs('<a href="/teach">目录</a><a href="/teach/calendar">日历</a>'),'<a href="/teaching">目录</a><a href="/teaching/calendar">日历</a>');
 for(const page of ['dashboard','calendar','profile']){const fs=require('fs');const html=domain.teachingURLs(fs.readFileSync(require('path').join(__dirname,'../views/teacher-portal',page+'.ejs'),'utf8'));assert.ok(html.includes('/css/teacher-backend.css?v=20260812'));assert.ok(!html.includes('teachinger-backend'));}
 });

const {test}=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const session=require('express-session');
const bcrypt=require('bcryptjs');
const access=require('../lib/admin-access');
const migrate=require('../db/migrations/002-admin-accounts');

test('后台账号生命周期与服务器权限隔离',async t=>{
 const SQL=await require('sql.js')(),sql=new SQL.Database();
 sql.run('CREATE TABLE teachers(id INTEGER PRIMARY KEY,username TEXT UNIQUE,password_hash TEXT,display_name TEXT,avatar TEXT,status TEXT DEFAULT "active")');
 const password='TestAccount2026!';
 sql.run('INSERT INTO teachers(id,username,password_hash,display_name) VALUES(1,?,?,?)',['admin',bcrypt.hashSync(password,4),'主管']);
 sql.run('INSERT INTO teachers(id,username,password_hash,display_name) VALUES(2,?,?,?)',['legacy',bcrypt.hashSync(password,4),'原教师']);
 migrate(sql);migrate(sql);
 const adapter={
 query(query,params=[]){const stmt=sql.prepare(query);stmt.bind(params);const rows=[];while(stmt.step())rows.push(stmt.getAsObject());stmt.free();return rows;},
 get(query,params=[]){return this.query(query,params)[0]||null;},
 run(query,params=[]){sql.run(query,params);return this.get('SELECT last_insert_rowid() AS id').id;},
 atomic(fn){sql.run('BEGIN');try{fn();sql.run('COMMIT');}catch(e){sql.run('ROLLBACK');throw e;}}
 };
 const dbPath=require.resolve('../db');require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:adapter};
 const app=express();app.use(express.urlencoded({extended:true}));app.use(session({secret:'test-only-secret-for-account-tests-2026',resave:false,saveUninitialized:false}));
 app.use((req,res,next)=>{res.locals.path=req.path;res.locals.cssVer=1;res.locals.teacherId=req.session.teacherId;res.locals.teacherName=req.session.teacherName;const render=res.render.bind(res);res.render=(view,locals)=>res.json({view,...locals,csrf:req.session.accountCsrf});next();});
 app.use('/admin',require('../middleware/admin-access'));
 app.use('/admin',require('../routes/auth'));
 app.use('/admin/accounts-manage',require('../routes/admin-accounts'));
 const aliases=express.Router();aliases.use(require('../middleware/auth').requireTeacher);aliases.all('/',(req,res)=>res.send('allowed'));
 app.use('/packages',aliases);app.use('/provinces',aliases);
 app.get('/admin/logistics-manage/:id/ship',(req,res)=>res.send('shipped'));
 app.get('/admin/live/studio/:id',(req,res)=>res.send('studio'));
 app.use('/admin',require('../middleware/live-security').liveHttpGuard(adapter));
 app.all('/admin/:module', (req,res)=>res.send('allowed'));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.close();sql.close();});
 const base='http://127.0.0.1:'+server.address().port;
 function client(){let cookie='';return async(path,body)=>{const response=await fetch(base+path,{method:body?'POST':'GET',body:body?new URLSearchParams(body):undefined,headers:cookie?{cookie}:{},redirect:'manual'});if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];return response;};}
 const supervisor=client();
 const login=(client,username)=>client('/admin/login',{username,password});
 await t.test('迁移仅开通原管理员，重复执行安全',()=>{assert.equal(adapter.get('SELECT COUNT(*) n FROM admin_accounts').n,1);assert.equal(access.load(adapter,2),null);});
 await t.test('旧主管升级为 超级账号 并撤销旧会话，重复迁移不变更版本',()=>{
  const old=new SQL.Database();old.run('CREATE TABLE teachers(id INTEGER PRIMARY KEY,username TEXT)');old.run("INSERT INTO teachers VALUES(1,'admin')");
  old.run("CREATE TABLE admin_accounts(teacher_id INTEGER PRIMARY KEY,role TEXT CHECK(role IN ('supervisor','sales')),status TEXT,permissions TEXT,session_version INTEGER,created_at TEXT,updated_at TEXT)");
  old.run("INSERT INTO admin_accounts VALUES(1,'supervisor','active','{}',1,'created','updated')");migrate(old);
  assert.deepEqual(old.exec('SELECT role,session_version FROM admin_accounts')[0].values,[['ceo',3]]);migrate(old);assert.equal(old.exec('SELECT session_version FROM admin_accounts')[0].values[0][0],3);old.close();
 });
 await t.test('三类主管默认权限互相隔离且不能管理账号',()=>{
  const make=role=>({role,status:'active',permissions:JSON.stringify(access.defaults[role])});
  const enroll=make('enrollment_supervisor'),teach=make('teaching_supervisor'),ops=make('operations_supervisor');
  assert.equal(access.can(enroll,'orders',true),true);assert.equal(access.can(enroll,'research'),false);
  assert.equal(access.can(teach,'research',true),true);assert.equal(access.can(teach,'orders'),false);
  assert.equal(access.can(ops,'ads',true),true);assert.equal(access.can(ops,'orders',true),false);
  for(const a of [enroll,teach,ops]) assert.equal(access.can(a,'accounts',true),false);
 });
 await t.test('四部门归属及技术账号默认隔离',()=>{
  assert.equal(access.department('assistant'),'服务部门');assert.equal(access.department('service_supervisor'),'服务部门');assert.equal(access.department('developer'),'超级账号直属 · 技术支持');
  for(const role of ['developer','technical_lead']) {
   const a={role,status:'active',permissions:JSON.stringify(access.defaults[role])};
   assert.equal(access.can(a,'technical'),true);assert.equal(access.can(a,'orders'),false);assert.equal(access.can(a,'accounts'),false);
   a.permissions=JSON.stringify({technical:'read',orders:'read'});
   assert.equal(access.can(a,'orders'),false);
   a.permission_expires_at=new Date(Date.now()+60000).toISOString();assert.equal(access.can(a,'orders'),true);
   a.permission_expires_at=new Date(Date.now()-1000).toISOString();assert.equal(access.can(a,'orders'),false);assert.equal(access.can(a,'technical'),true);
  }
 });
 await t.test('原管理员可登录，未开通人员不可登录',async()=>{assert.equal((await login(supervisor,'admin')).status,302);assert.match(await (await login(client(),'legacy')).text(),/未开通/);});
 let csrf=(await (await supervisor('/admin/accounts-manage')).json()).csrf;
 await t.test('新增账号必须带有效表单令牌',async()=>assert.equal((await supervisor('/admin/accounts-manage/save',{role:'sales'})).status,403));
 const create={_csrf:csrf,username:'sales01',display_name:'销售一',password,role:'sales',status:'active',permission_mode:'default'};
 await t.test('主管创建销售账号并应用默认权限',async()=>{assert.equal((await supervisor('/admin/accounts-manage/save',create)).status,302);assert.equal(access.load(adapter,3).role,'sales');assert.equal(access.can(access.load(adapter,3),'orders',true),true);});
 const sales=client();await login(sales,'sales01');
 await t.test('销售不能访问账号、题库或未知后台接口',async()=>{for(const p of ['/admin/accounts-manage','/admin/questions-manage','/admin/unknown'])assert.equal((await sales(p)).status,403);assert.equal((await sales('/admin/orders-manage')).status,200);});
 await t.test('仅查看权限阻止写入，不只隐藏菜单',async()=>{assert.equal((await sales('/admin/courses-manage')).status,200);assert.equal((await sales('/admin/courses-manage',{title:'改名'})).status,403);});
 await t.test('旧套餐、省份地址不能绕过权限',async()=>{assert.equal((await sales('/packages')).status,200);assert.equal((await sales('/packages',{x:'1'})).status,403);assert.equal((await sales('/provinces',{x:'1'})).status,403);});
 await t.test('只读账号不能通过 GET 发货或进入直播控制台',async()=>{assert.equal((await sales('/admin/logistics-manage/1/ship')).status,403);assert.equal((await sales('/admin/live/studio/1')).status,403);});
 await t.test('非主管不能提升自身权限',async()=>assert.equal((await sales('/admin/accounts-manage/save',{...create,id:'3',role:'ceo'})).status,403));
 await t.test('保留最后一名主管且不能停用自己',async()=>assert.equal((await supervisor('/admin/accounts-manage/save',{...create,id:'1',status:'disabled',role:'ceo'})).status,400));
 await t.test('无效角色及弱密码不会写入',async()=>{assert.equal((await supervisor('/admin/accounts-manage/save',{...create,username:'badrole',role:'unknown_role'})).status,400);assert.equal((await supervisor('/admin/accounts-manage/save',{...create,username:'weakpass',password:'123'})).status,400);assert.equal(adapter.get('SELECT COUNT(*) n FROM admin_accounts').n,2);});
 await t.test('自定义只读订单权限，旧会话即时失效',async()=>{assert.equal((await supervisor('/admin/accounts-manage/save',{...create,id:'3',password:'',permission_mode:'custom',perm_orders:'read'})).status,302);assert.equal((await sales('/admin/orders-manage')).status,401);await login(sales,'sales01');assert.equal((await sales('/admin/orders-manage')).status,200);assert.equal((await sales('/admin/orders-manage',{x:'1'})).status,403);});
 await t.test('停用使旧会话和重新登录均失效',async()=>{assert.equal((await supervisor('/admin/accounts-manage/save',{...create,id:'3',password:'',status:'disabled'})).status,302);assert.equal((await sales('/admin/orders-manage')).status,401);assert.match(await (await login(client(),'sales01')).text(),/已停用/);});
 await t.test('密码重置撤销会话，旧密码无法再次登录',async()=>{await supervisor('/admin/accounts-manage/save',{...create,id:'3',password:'',status:'active'});await login(sales,'sales01');await supervisor('/admin/accounts-manage/save',{...create,id:'3',password:'ChangedAccount2026!'});assert.equal((await sales('/admin/orders-manage')).status,401);assert.match(await (await login(client(),'sales01')).text(),/用户名或密码错误/);});
 await t.test('可关联已有教师，无需重复创建人员',async()=>{assert.equal((await supervisor('/admin/accounts-manage/save',{...create,username:'',password:'',staff_id:'2',role:'teacher'})).status,302);assert.equal(adapter.get('SELECT COUNT(*) n FROM teachers').n,3);});
 await t.test('教师授课权限保留课程归属，停用即失效',()=>{
  sql.run('CREATE TABLE courses(id INTEGER PRIMARY KEY,teacher_id INTEGER)');sql.run('INSERT INTO courses VALUES(1,2),(2,1)');
  const controls=require('../middleware/live-security').controls;
  const a=access.load(adapter,2),s={teacherId:2,adminVersion:a.session_version};
  assert.equal(controls(adapter,s,1),true);assert.equal(controls(adapter,s,2),false);
  adapter.run("UPDATE admin_accounts SET status='disabled' WHERE teacher_id=2");assert.equal(controls(adapter,s,1),false);
 });
 await t.test('超级账号 创建技术账号时必须为业务权限设定有限有效期',async()=>{
  const tech={...create,username:'developer01',role:'developer',permission_mode:'custom',perm_technical:'read',perm_orders:'read'};
  assert.equal((await supervisor('/admin/accounts-manage/save',tech)).status,400);
  const expiry=new Date(Date.now()+8*3600000+3600000).toISOString().slice(0,16);
  assert.equal((await supervisor('/admin/accounts-manage/save',{...tech,permission_expires_at:expiry})).status,302);
  const a=adapter.get("SELECT a.* FROM admin_accounts a JOIN teachers t ON a.teacher_id=t.id WHERE t.username='developer01'");
  assert.equal(access.can(a,'orders'),true);
  const dev=client();await login(dev,'developer01');assert.equal((await dev('/admin/accounts-manage')).status,403);
 });
 await t.test('部门、权限等级及兼任岗位不能伪造提权',async()=>{
  for(const extra of [{department:'teaching'},{permission_level:'L0'},{secondary_roles:'ceo'},{secondary_roles:'teaching_supervisor'}]) assert.equal((await supervisor('/admin/accounts-manage/save',{...create,username:'invalidassignment',...extra})).status,400);
  assert.equal((await supervisor('/admin/accounts-manage/save',{...create,username:'secondroot',role:'ceo'})).status,400);
  assert.equal(adapter.get("SELECT COUNT(*) n FROM admin_accounts WHERE role='ceo'").n,1);
  assert.throws(()=>adapter.run("INSERT INTO admin_accounts(teacher_id,role) VALUES(999,'ceo')"));
 });
 await t.test('兼任教师合并功能权限但只能控制本人课程',async()=>{
  assert.equal((await supervisor('/admin/accounts-manage/save',{...create,id:'3',password:'',secondary_roles:'teacher'})).status,302);
  const a=access.load(adapter,3);
  assert.equal(a.department,'enrollment');assert.equal(a.permission_level,'L2');
  assert.equal(access.canTeach(a),true);assert.equal(access.can(a,'orders',true),true);
  sql.run('INSERT INTO courses VALUES(3,3)');
  const controls=require('../middleware/live-security').controls,s={teacherId:3,adminVersion:a.session_version};
  assert.equal(controls(adapter,s,3),true);assert.equal(controls(adapter,s,2),false);
  assert.equal(controls(adapter,{teacherPortalId:3,portalAdminVersion:a.session_version},3),true);
  assert.equal(controls(adapter,{teacherPortalId:3,portalAdminVersion:a.session_version-1},3),false);
 });
 await t.test('旧师资入口不能删除超级账号或绕过账号密码和启停管理',async()=>{
  for(const [url,body] of [['/admin/teachers-manage/1/delete',{}],['/admin/teachers-manage/1/toggle',{}],['/admin/teachers-manage/1',{username:'renamedroot'}],['/admin/teachers-manage/1',{password:'WeakReset1'}],['/admin/teachers-manage/1',{status:'disabled'}]]) assert.equal((await supervisor(url,body)).status,403);
 });
 await t.test('操作审计与失败事务不泄露密码且不会残留半条账号',()=>{
  const logs=adapter.query('SELECT * FROM admin_account_audit');assert.ok(logs.length>0);
  assert.ok(!JSON.stringify(logs).includes(password));assert.ok(!JSON.stringify(logs).includes('$2'));
  const count=adapter.get('SELECT COUNT(*) n FROM teachers').n;
  assert.throws(()=>adapter.atomic(()=>{adapter.run("INSERT INTO teachers(username,display_name) VALUES('rollbacktest','回滚')");throw Error('fail');}));
  assert.equal(adapter.get('SELECT COUNT(*) n FROM teachers').n,count);
 });
 await t.test('账号页面模板可渲染且不输出密码哈希',async()=>{const html=await require('ejs').renderFile(require('path').join(__dirname,'../views/teacher/accounts.ejs'),{title:'账号管理',cssVer:1,path:'/admin/accounts-manage',teacherName:'主管',teacherId:1,accountCsrf:csrf,canAdminPath:()=>true,canAdmin:()=>true,accounts:adapter.query('SELECT a.*,t.username,t.display_name FROM admin_accounts a JOIN teachers t ON t.id=a.teacher_id'),staff:[],access,error:'',message:''});assert.match(html,/新建账号/);assert.ok(!html.includes('$2a$'));});
 await t.test('十一种身份权限与特殊路由映射',()=>{for(const role of Object.keys(access.roles)){const a={role,status:'active',permissions:JSON.stringify(access.defaults[role])};assert.equal(access.can(a,'accounts'),role==='ceo');}assert.equal(access.routeModule('/admin/api/orders'),'orders');assert.equal(access.routeModule('/admin/api/teachers-manage'),'teachers');});
 await t.test('经营控制台仅超级账号可访问，其他岗位只能进入普通工作台',async()=>{
  assert.equal((await supervisor('/admin/dashboard')).status,200);
  let id=100;
  for(const role of Object.keys(access.roles).filter(r=>r!=='ceo')){
   const uid=id++;adapter.run('INSERT INTO teachers(id,username,password_hash,display_name) VALUES(?,?,?,?)',[uid,'guard'+uid,bcrypt.hashSync(password,4),'权限测试']);
   adapter.run("INSERT INTO admin_accounts(teacher_id,role,status,permissions,session_version) VALUES(?,?,'active','{}',1)",[uid,role]);
   const c=client(),r=await login(c,'guard'+uid);assert.equal(r.headers.get('location'),'/admin/workspace');
   assert.equal((await c('/admin/dashboard')).status,403,role);
   assert.equal((await c('/admin/dashboard?days=90')).status,403,role);
   assert.equal((await c('/admin/dashboard/data?days=90')).status,403,role);
   const workspace=await c('/admin/workspace');assert.equal(workspace.status,200);assert.equal((await workspace.json()).view,'teacher/account-dashboard');
  }
 });

});

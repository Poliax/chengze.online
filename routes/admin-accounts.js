const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const access = require('../lib/admin-access');
router.use((req, res, next) => {
  if (req.adminAccount.role !== 'ceo') return res.status(403).send('仅 超级账号可以管理后台账号');
  if (req.method !== 'GET' && (typeof req.body._csrf !== 'string' || req.body._csrf !== req.session.accountCsrf)) return res.status(403).send('表单已失效，请刷新页面后重试');
  next();
});
function render(req, res, error = '', status = 200) {
  const accounts = db.query('SELECT a.*,t.username,t.display_name FROM admin_accounts a JOIN teachers t ON t.id=a.teacher_id ORDER BY a.created_at DESC,a.teacher_id');
  const auditLogs=db.query('SELECT l.*,t.display_name AS actor_name,u.display_name AS target_name FROM admin_account_audit l LEFT JOIN teachers t ON t.id=l.actor_id LEFT JOIN teachers u ON u.id=l.target_id ORDER BY l.id DESC LIMIT 20');
  const staff = db.query('SELECT id,username,display_name FROM teachers WHERE id NOT IN (SELECT teacher_id FROM admin_accounts) ORDER BY id');
  res.status(status).render('teacher/accounts', { title:'账号管理 · 承泽在线', accounts, staff, auditLogs, access, error, message:req.query.saved === '1' ? '账号已保存，受影响账号需重新登录。' : '' });
}
router.get('/', (req,res) => render(req,res));
router.post('/save', (req,res) => {
  try {
    const b=req.body, id=String(b.id || '');
    if (id && !/^[1-9]\d*$/.test(id)) throw Error('账号编号无效');
    const existing=id ? db.get('SELECT * FROM admin_accounts WHERE teacher_id=?',[Number(id)]) : null;
    if (id && !existing) throw Error('账号不存在');
    if (!Object.hasOwn(access.roles,b.role) || !['active','disabled'].includes(b.status)) throw Error('请选择有效的账号类型和状态');
    const department=access.roleDepartments[b.role], permissionLevel=access.levelCode(b.role);
    if (b.department && b.department!==department) throw Error('部门与岗位不匹配');
    if (b.permission_level && b.permission_level!==permissionLevel) throw Error('权限等级由岗位自动匹配，不能自行提升');
    let secondary=b.secondary_roles || [];
    if (!Array.isArray(secondary)) secondary=[secondary];
    if (secondary.some(role=>!Object.hasOwn(access.roles,role) || access.levelCode(role)!=='L2')) throw Error('兼任岗位仅支持普通执行岗位');
    secondary=[...new Set(secondary)].filter(role=>role!==b.role);
    if (b.role==='ceo' && secondary.length) throw Error('超级账号无需配置兼任岗位');
    if (b.role==='ceo' && db.get("SELECT teacher_id FROM admin_accounts WHERE role='ceo' AND teacher_id<>?",[Number(id)||0])) throw Error('系统只允许一个超级账号');
    const name=typeof b.display_name==='string' ? b.display_name.trim() : '';
    if (!name || name.length>40) throw Error('姓名须为 1–40 个字符');
    let perms={};
    if (b.permission_mode==='custom') {
      for (const key of Object.keys(access.modules)) {
        const value=b['perm_'+key] || 'none';
        if (!['none','read','manage'].includes(value)) throw Error('权限值无效');
        if (['accounts','teachers','assistants'].includes(key) && value!=='none' && b.role!=='ceo') throw Error('账号及人员管理仅限 超级账号');
        if (value!=='none') perms[key]=value;
      }
    } else if (b.permission_mode==='default') perms=access.roleDefaults({role:b.role,secondary_roles:JSON.stringify(secondary)});
    else throw Error('请选择权限配置方式');
    let expires='';
    if (access.isTechnical(b.role) && Object.keys(perms).some(key=>key!=='technical')) {
      if (typeof b.permission_expires_at!=='string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(b.permission_expires_at)) throw Error('技术账号临时业务权限必须设置到期时间（北京时间）');
      const time=Date.parse(b.permission_expires_at+':00+08:00');
      if (!Number.isFinite(time) || time<=Date.now() || time>Date.now()+7*86400000) throw Error('技术账号业务授权须在未来 7 天内到期');
      expires=new Date(time).toISOString();
    }
    if (b.role==='ceo') perms={...access.defaults.ceo};
    const password=typeof b.password==='string' ? b.password : '';
    if (password && (password.length<12 || Buffer.byteLength(password,'utf8')>72 || !/[A-Za-z]/.test(password) || !/\d/.test(password))) throw Error('密码须至少 12 位，包含字母和数字，且不超过 72 字节');
    if (existing && existing.role==='ceo' && existing.status==='active' && (b.role!=='ceo' || b.status!=='active')) {
      if (db.get("SELECT COUNT(*) AS n FROM admin_accounts WHERE role='ceo' AND status='active'").n<=1) throw Error('至少保留一个启用的 超级账号');
    }
    if (existing && Number(id)===Number(req.session.teacherId) && (b.status!=='active' || b.role!=='ceo')) throw Error('不能停用自己或降低自己的超级账号权限');
    function audit(target,action) {
      const before=existing ? {role:existing.role,department:existing.department,level:existing.permission_level,status:existing.status,secondary_roles:existing.secondary_roles,permissions:existing.permissions,permission_expires_at:existing.permission_expires_at} : null;
      const after={role:b.role,department,level:permissionLevel,status:b.status,secondary_roles:secondary,permissions:perms,permission_expires_at:expires,password_changed:!!password};
      db.run('INSERT INTO admin_account_audit(actor_id,target_id,action,details) VALUES(?,?,?,?)',[req.session.teacherId,target,action,JSON.stringify({before,after})]);
    }
    if (existing) {
      // Account writes are atomic, including name/password and session revocation.
      db.atomic(() => {
        db.run('UPDATE teachers SET display_name=? WHERE id=?',[name,Number(id)]);
        if (password) db.run('UPDATE teachers SET password_hash=? WHERE id=?',[bcrypt.hashSync(password,12),Number(id)]);
        db.run("UPDATE admin_accounts SET role=?,department=?,permission_level=?,secondary_roles=?,permission_mode=?,status=?,permissions=?,permission_expires_at=?,session_version=session_version+1,updated_at=CURRENT_TIMESTAMP WHERE teacher_id=?",[b.role,department,permissionLevel,JSON.stringify(secondary),b.permission_mode,b.status,JSON.stringify(perms),expires,Number(id)]);
        audit(Number(id),'update');
      });
    } else {
      const link=String(b.staff_id || '');
      if (link && !/^[1-9]\d*$/.test(link)) throw Error('关联人员无效');
      const username=typeof b.username==='string' ? b.username.trim() : '';
      if (!link && !/^[a-zA-Z][a-zA-Z0-9_.-]{2,39}$/.test(username)) throw Error('用户名须为 3–40 位字母、数字、下划线、点或连字符，且以字母开头');
      if (!link && !password) throw Error('新账号必须设置密码');
      if (link && (!db.get('SELECT id FROM teachers WHERE id=?',[Number(link)]) || db.get('SELECT teacher_id FROM admin_accounts WHERE teacher_id=?',[Number(link)]))) throw Error('该人员不存在或已开通后台账号');
      if (!link && db.get('SELECT id FROM teachers WHERE username=?',[username])) throw Error('用户名已存在，可选择关联已有人员');
      db.atomic(() => {
        let teacherId=Number(link);
        if (!link) teacherId=db.run('INSERT INTO teachers(username,password_hash,display_name) VALUES(?,?,?)',[username,bcrypt.hashSync(password,12),name]);
        else {
          db.run('UPDATE teachers SET display_name=? WHERE id=?',[name,teacherId]);
          if (password) db.run('UPDATE teachers SET password_hash=? WHERE id=?',[bcrypt.hashSync(password,12),teacherId]);
        }
        db.run('INSERT INTO admin_accounts(teacher_id,role,department,permission_level,secondary_roles,permission_mode,status,permissions,permission_expires_at) VALUES(?,?,?,?,?,?,?,?,?)',[teacherId,b.role,department,permissionLevel,JSON.stringify(secondary),b.permission_mode,b.status,JSON.stringify(perms),expires]);
        audit(teacherId,'create');
      });
    }
    res.redirect('/admin/accounts-manage?saved=1');
  } catch(e) {
    render(req,res, e.message.startsWith('UNIQUE') ? '用户名已存在' : e.message,400);
  }
});
module.exports=router;

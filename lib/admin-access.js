const modules = {
  technical: '技术工作台',
  accounts: '账号管理', teachers: '师资管理', assistants: '助教管理', provinces: '省份管理',
  courses: '课程管理', packages: '课程套餐', live: '直播管理', replays: '回放管理',
  research: '教研管理', questions: '题库管理', materials: '讲义管理', qa: '答疑管理',
  users: '用户管理', students: '学员管理', orders: '订单管理', logistics: '物流管理', ads: '广告管理'
};
const roles = { ceo: '超级账号', enrollment_supervisor: '招生主管', teaching_supervisor: '教学主管', service_supervisor: '服务主管', operations_supervisor: '运营主管', operations: '运营人员', technical_lead: '技术负责人', developer: '开发人员', teacher: '教师', assistant: '助教', sales: '销售' };
const defaults = {
  ceo: Object.fromEntries(Object.keys(modules).map(k => [k, 'manage'])),
  enrollment_supervisor: { courses:'read', packages:'read', users:'manage', students:'manage', orders:'manage', logistics:'manage', ads:'read' },
  teaching_supervisor: { courses:'manage', packages:'read', live:'manage', replays:'manage', research:'manage', questions:'manage', materials:'manage', qa:'manage', students:'read' },
  service_supervisor: { courses:'read', live:'read', replays:'read', materials:'read', qa:'manage', students:'manage', logistics:'read' },
  technical_lead: { technical:'read' },
  developer: { technical:'read' },
  operations_supervisor: { provinces:'manage', courses:'manage', packages:'manage', live:'read', replays:'manage', materials:'manage', users:'manage', students:'read', orders:'read', logistics:'manage', ads:'manage' },
  operations: { provinces:'manage', courses:'manage', packages:'manage', live:'manage', replays:'manage', materials:'manage', questions:'read', users:'manage', students:'manage', orders:'read', logistics:'manage', ads:'manage' },
  teacher: { courses:'read', live:'manage', replays:'read', research:'manage', questions:'manage', materials:'manage', qa:'manage' },
  assistant: { courses:'read', live:'read', replays:'read', materials:'read', qa:'manage', students:'read', logistics:'read' },
  sales: { courses:'read', packages:'read', users:'manage', students:'manage', orders:'manage', logistics:'read' }
};
const departments = { platform:'全平台', enrollment:'招生部门', teaching:'教学部门', service:'服务部门', operations:'运营部门', technical:'超级账号直属 · 技术支持' };
const roleDepartments = { ceo:'platform', enrollment_supervisor:'enrollment', sales:'enrollment', teaching_supervisor:'teaching', teacher:'teaching', service_supervisor:'service', assistant:'service', operations_supervisor:'operations', operations:'operations', technical_lead:'technical', developer:'technical' };
const levels = { L0:'超级管理级', L1:'部门管理级', L2:'业务执行级' };
function levelCode(role) { return role==='ceo' ? 'L0' : role.endsWith('_supervisor') || role==='technical_lead' ? 'L1' : 'L2'; }
function department(role) { return departments[roleDepartments[role]] || '未分配'; }
function level(role) { return levelCode(role)+' · '+levels[levelCode(role)]; }
function isTechnical(role) { return ['technical_lead','developer'].includes(role); }
function assignedRoles(account) {
  let extra=[];try { extra=JSON.parse(account.secondary_roles||'[]'); } catch {}
  return [...new Set([account.role,...(Array.isArray(extra)?extra:[])])].filter(r=>Object.hasOwn(roles,r) && (r!=='ceo'||account.role==='ceo'));
}
function canTeach(account) { return assignedRoles(account).some(role => ['teacher','ceo'].includes(role)) && can(account,'live',true); }
function roleDefaults(account) {
 const result={};
 for(const role of assignedRoles(account)) for(const [key,value] of Object.entries(defaults[role])) if(result[key]!=='manage')result[key]=value;
 return result;
}
function permissions(account) {
  if (!account || account.status !== 'active' || !roles[account.role]) return {};
  if (account.role === 'ceo') return {...defaults.ceo};
  let custom = {}; try { custom = account.permission_mode==='default' ? roleDefaults(account) : JSON.parse(account.permissions || '{}'); } catch {}
  return Object.fromEntries(Object.entries(custom).filter(([key, value]) => Object.hasOwn(modules,key) && (!isTechnical(account.role) || key==='technical' || (Number.isFinite(Date.parse(account.permission_expires_at)) && Date.parse(account.permission_expires_at)>Date.now())) && !['accounts','teachers','assistants'].includes(key) && ['read','manage'].includes(value)));
}
function can(account, key, write = false) { const value = permissions(account)[key]; return value === 'manage' || (!write && value === 'read'); }
function load(db, id) { return id ? db.get('SELECT a.*, t.display_name, t.username FROM admin_accounts a JOIN teachers t ON t.id=a.teacher_id WHERE a.teacher_id=?', [id]) : null; }
function routeModule(url) {
  const p = url.split('?')[0].replace(/\/+$/, '');
  const first = p.replace(/^\/admin\/?/, '').split('/')[0];
  const mapping = { 'technical-center':'technical', 'accounts-manage':'accounts', 'teachers-manage':'teachers', staff:'teachers', 'teacher-manage':'teachers', 'assistants-manage':'assistants', 'provinces-manage':'provinces', provinces:'provinces', 'courses-manage':'courses', courses:'courses', lessons:'courses', teaching:'live', 'course-catalog':'courses', 'packages-manage':'packages', schedule:'courses', 'live-manage':'live', live:'live', 'replays-manage':'replays', 'research-manage':'research', 'questions-manage':'questions', 'course-materials':'materials', 'qa-manage':'qa', 'users-manage':'users', 'students-manage':'students', students:'students', 'orders-manage':'orders', orders:'orders', 'logistics-manage':'logistics', logistics:'logistics', 'ads-manage':'ads' };
  if (first === 'api') {
    const api = p.split('/')[3];
    return ({ 'teachers-manage':'teachers', 'schedule-packages':'courses', users:'users', orders:'orders', courses:'courses' })[api] || null;
  }
  return mapping[first] || null;
}
function isWrite(req) {
  return !['GET','HEAD'].includes(req.method) || /\/(?:live\/studio|teaching)\//.test(req.path) || /\/logistics-manage\/\d+\/ship\/?$/.test(req.path);
}
function sessionAccount(db, session, portal=false) {
  if (!session) return null;
  const account=load(db, portal ? session.teacherPortalId : session.teacherId);
  if (!account || account.status!=='active' || account.session_version !== (portal ? session.portalAdminVersion : session.adminVersion)) return null;
  return account;
}
module.exports = { modules, roles, defaults, permissions, can, load, routeModule, sessionAccount, isWrite, departments, department, level, isTechnical, levels, levelCode, roleDepartments, assignedRoles, roleDefaults, canTeach };

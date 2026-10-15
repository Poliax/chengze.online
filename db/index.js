const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'chengze.db');

let db = null;

async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();
  
  const existingDatabase = fs.existsSync(DB_PATH);
  if (existingDatabase) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA journal_mode=WAL');
  db.run('PRAGMA foreign_keys=ON');
  // Existing production databases must not be reseeded during a code restart.
  // Schema migrations for an existing database are an explicit deployment step.
  if (!existingDatabase) {
    initSchema();
    seedData();
    ensureStudentUids();
    saveDb();
  }
  return db;
}

function initSchema() {
  db.run(`CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    avatar TEXT DEFAULT '',
    bio TEXT DEFAULT '',
    real_name TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    hire_date TEXT DEFAULT '',
    subject TEXT DEFAULT '',
    province TEXT DEFAULT '',
    total_hours REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    category TEXT DEFAULT '',
    exam_type TEXT DEFAULT '专升本',
    cover TEXT DEFAULT '',
    status TEXT DEFAULT 'draft',
    year TEXT DEFAULT '',
    province TEXT DEFAULT '',
    class_type TEXT DEFAULT '',
    package_id INTEGER,
    student_count INTEGER DEFAULT 0,
    sale_price TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS course_packages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    year TEXT DEFAULT '',
    province TEXT DEFAULT '',
    class_type TEXT DEFAULT '',
    exam_type TEXT DEFAULT '专升本',
    start_date TEXT DEFAULT '',
    end_date TEXT DEFAULT '',
    parent_id INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    price REAL DEFAULT 0,
    sale_price TEXT DEFAULT '',
    status TEXT DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    duration INTEGER DEFAULT 0,
    order_index INTEGER DEFAULT 0,
    video_url TEXT DEFAULT '',
    schedule_time TEXT DEFAULT '',
    stage TEXT DEFAULT '',
    stage_start_date TEXT DEFAULT '',
    stage_end_date TEXT DEFAULT '',
    stage_rule TEXT DEFAULT '',
    stage_time TEXT DEFAULT '',
    slides_data TEXT DEFAULT '[]',
    is_free BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS province_subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    province_id INTEGER NOT NULL,
    standard TEXT DEFAULT '',
    name TEXT DEFAULT '',
    outline_file TEXT DEFAULT '',
    papers_file TEXT DEFAULT '',
    order_index INTEGER DEFAULT 0
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS province_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    province_id INTEGER NOT NULL,
    name TEXT DEFAULT '',
    order_index INTEGER DEFAULT 0
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS province_category_subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS province_majors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    name TEXT DEFAULT '',
    order_index INTEGER DEFAULT 0
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT DEFAULT '',
    name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    password_hash TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (course_id) REFERENCES courses(id),
    UNIQUE(student_id, course_id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT UNIQUE NOT NULL,
    student_id INTEGER NOT NULL,
    course_id INTEGER,
    amount REAL DEFAULT 0,
    status TEXT DEFAULT 'pending',
    payment_method TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (course_id) REFERENCES courses(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS package_enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    package_id INTEGER NOT NULL,
    order_id INTEGER,
    enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (package_id) REFERENCES course_packages(id),
    UNIQUE(student_id, package_id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS live_chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER DEFAULT 0,
    lesson_id INTEGER,
    sender TEXT DEFAULT '',
    content TEXT DEFAULT '',
    type TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS course_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    lesson_id INTEGER NOT NULL,
    completed BOOLEAN DEFAULT 0,
    watch_duration REAL DEFAULT 0,
    last_position REAL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (lesson_id) REFERENCES lessons(id),
    UNIQUE(student_id, lesson_id)
  )`);
  // ── 教研管理 ──
  db.run(`CREATE TABLE IF NOT EXISTS teaching_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    course_id INTEGER,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    objectives TEXT DEFAULT '',
    status TEXT DEFAULT 'draft',
    plan_date TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id),
    FOREIGN KEY (course_id) REFERENCES courses(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS course_package_courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    package_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(package_id, course_id),
    FOREIGN KEY (package_id) REFERENCES course_packages(id),
    FOREIGN KEY (course_id) REFERENCES courses(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS research_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    activity_type TEXT DEFAULT 'meeting',
    activity_date TEXT DEFAULT '',
    duration INTEGER DEFAULT 0,
    notes TEXT DEFAULT '',
    status TEXT DEFAULT 'scheduled',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS research_materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    material_type TEXT DEFAULT 'document',
    file_url TEXT DEFAULT '',
    course_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id),
    FOREIGN KEY (course_id) REFERENCES courses(id)
  )`);
  // ── 助教管理 ──
  db.run(`CREATE TABLE IF NOT EXISTS assistants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    avatar TEXT DEFAULT '',
    bio TEXT DEFAULT '',
    status TEXT DEFAULT 'active',
    hourly_rate REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS assistant_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assistant_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    role TEXT DEFAULT 'ta',
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assistant_id) REFERENCES assistants(id),
    FOREIGN KEY (course_id) REFERENCES courses(id)
  )`);
  // ── 答疑管理 ──
  db.run(`CREATE TABLE IF NOT EXISTS qa_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER,
    lesson_id INTEGER,
    student_id INTEGER,
    teacher_id INTEGER,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    status TEXT DEFAULT 'open',
    priority TEXT DEFAULT 'normal',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    answered_at DATETIME,
    FOREIGN KEY (course_id) REFERENCES courses(id),
    FOREIGN KEY (lesson_id) REFERENCES lessons(id),
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS qa_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL,
    answerer_type TEXT DEFAULT 'teacher',
    answerer_id INTEGER,
    content TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES qa_questions(id)
  )`);
  // ── 物流管理 ──
  db.run(`CREATE TABLE IF NOT EXISTS logistics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    student_id INTEGER,
    course_id INTEGER,
    order_no TEXT UNIQUE,
    type TEXT DEFAULT 'material',
    status TEXT DEFAULT 'pending',
    recipient_name TEXT DEFAULT '',
    recipient_phone TEXT DEFAULT '',
    recipient_address TEXT DEFAULT '',
    carrier TEXT DEFAULT '',
    tracking_no TEXT DEFAULT '',
    shipped_at DATETIME,
    delivered_at DATETIME,
    remark TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id),
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (course_id) REFERENCES courses(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS logistics_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    logistics_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit TEXT DEFAULT '份',
    FOREIGN KEY (logistics_id) REFERENCES logistics(id)
  )`);
  // ── 直播系统 ──
  db.run(`CREATE TABLE IF NOT EXISTS live_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    teacher_id INTEGER NOT NULL,
    lesson_id INTEGER,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    status TEXT DEFAULT 'live',
    duration REAL DEFAULT 0,
    slide_timeline TEXT DEFAULT '[]',
    chat_log TEXT DEFAULT '[]',
    max_students INTEGER DEFAULT 0,
    FOREIGN KEY (course_id) REFERENCES courses(id),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS live_replays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    title TEXT DEFAULT '',
    duration INTEGER DEFAULT 0,
    slide_timeline TEXT DEFAULT '[]',
    chat_log TEXT DEFAULT '[]',
    recorded_file TEXT DEFAULT '',
    video_url TEXT DEFAULT '',
    lesson_id INTEGER,
    file_id TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES live_sessions(id),
    FOREIGN KEY (course_id) REFERENCES courses(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT DEFAULT '',
    lesson_id INTEGER DEFAULT 0,
    content TEXT DEFAULT '',
    options TEXT DEFAULT '[]',
    answer INTEGER DEFAULT 0,
    explanation TEXT DEFAULT '',
    source TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS course_materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER DEFAULT 0,
    lesson_id INTEGER DEFAULT 0,
    filename TEXT DEFAULT '',
    original_name TEXT DEFAULT '',
    size INTEGER DEFAULT 0,
    uploaded_by INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
}

function seedData() {
  // ── Migrate schema for existing databases ──
  const migs = [
    ['students', 'uid', 'TEXT DEFAULT \'\''],
    ['students', 'wechat_nickname', 'TEXT DEFAULT \'\''],
    ['students', 'wechat_openid', 'TEXT DEFAULT \'\''],
    ['teachers', 'real_name', 'TEXT DEFAULT \'\''],
    ['teachers', 'phone', 'TEXT DEFAULT \'\''],
    ['teachers', 'hire_date', 'TEXT DEFAULT \'\''],
    ['teachers', 'subject', 'TEXT DEFAULT \'\''],
    ['teachers', 'province', 'TEXT DEFAULT \'\''],
    ['teachers', 'total_hours', 'REAL DEFAULT 0'],
    ['teachers', 'status', "TEXT DEFAULT 'active'"],
    ['lessons', 'schedule_time', "TEXT DEFAULT ''"],
    ['lessons', 'stage', "TEXT DEFAULT ''"],
    ['lessons', 'stage_start_date', "TEXT DEFAULT ''"],
    ['lessons', 'stage_end_date', "TEXT DEFAULT ''"],
    ['lessons', 'stage_rule', "TEXT DEFAULT ''"],
    ['lessons', 'stage_time', "TEXT DEFAULT ''"],
    ['lessons', 'stage_count', "INTEGER DEFAULT 0"],
    ['lessons', 'stage_duration', "INTEGER DEFAULT 0"],
    ['courses', 'sale_price', "TEXT DEFAULT ''"],
    ['courses', 'exam_type', "TEXT DEFAULT '专升本'"],
    ['course_packages', 'parent_id', 'INTEGER DEFAULT 0'],
    ['course_packages', 'sort_order', 'INTEGER DEFAULT 0'],
    ['course_packages', 'exam_type', "TEXT DEFAULT '专升本'"],
    ['course_packages', 'sale_price', "TEXT DEFAULT ''"],
    ['course_packages', 'start_date', "TEXT DEFAULT ''"],
    ['course_packages', 'end_date', "TEXT DEFAULT ''"],
    ['provinces', 'schedule', "TEXT DEFAULT '[]'"],
    ['provinces', 'official_docs', "TEXT DEFAULT '[]'"],
    ['provinces', 'junior_colleges', "TEXT DEFAULT '[]'"],
    ['provinces', 'undergrad_colleges', "TEXT DEFAULT '[]'"],
    ['provinces', 'admissions', "TEXT DEFAULT '[]'"],
    ['provinces', 'exam_time', "TEXT DEFAULT ''"],
    ['provinces', 'years', "TEXT DEFAULT '[]'"],
    ['provinces', 'exam_schedule', "TEXT DEFAULT '[]'"],
    ['province_subjects', 'type', "TEXT DEFAULT ''"],
    ['province_categories', 'kind', "TEXT DEFAULT 'junior'"],
    ['province_categories', 'link_category_id', "INTEGER DEFAULT 0"],
    ['teachers', 'teacher_no', "TEXT DEFAULT ''"],
    ['students', 'username', "TEXT DEFAULT ''"],
    ['students', 'status', "TEXT DEFAULT 'active'"],
    ['students', 'real_name', "TEXT DEFAULT ''"],
    ['students', 'exam_year', "TEXT DEFAULT ''"],
    ['questions', 'lesson_id', 'INTEGER DEFAULT 0'],
  ];
  for (const [tbl, col, def] of migs) {
    try { db.run(`ALTER TABLE ${tbl} ADD COLUMN ${col} ${def}`); } catch(e) {}
  }

  // ── 省份科目迁移：将旧的逗号科目列表导入独立科目表 ──
  try {
    const provs = db.exec('SELECT id, subjects FROM provinces');
    if (provs[0]) {
      provs[0].values.forEach(function(row) {
        const pid = row[0];
        const cnt = db.exec('SELECT COUNT(*) FROM province_subjects WHERE province_id=' + pid)[0].values[0][0];
        if (cnt > 0) return;
        let subs = [];
        try { subs = JSON.parse(row[1] || '[]'); } catch(e) {}
        if (subs.length === 1 && String(subs[0]).indexOf('、') >= 0) {
          subs = String(subs[0]).split('、').map(function(s){ return s.trim(); }).filter(Boolean);
        }
        subs.forEach(function(s, idx) {
          db.run('INSERT INTO province_subjects (province_id, standard, name, order_index) VALUES (?,?,?,?)', [pid, s, s, idx]);
        });
      });
    }
  } catch(e) {}

  // ── 省份考试日程迁移：把旧的年份/考试时间合并为成对数据 ──
  try {
    const provs = db.exec('SELECT id, exam_time, years FROM provinces');
    if (provs[0]) {
      provs[0].values.forEach(function(row) {
        const pid = row[0];
        const examTime = row[1] || '';
        let years = [];
        try { years = JSON.parse(row[2] || '[]'); } catch(e) {}
        if (!Array.isArray(years)) years = [];
        const cnt = db.exec('SELECT COUNT(*) FROM provinces WHERE id=' + pid)[0].values[0][0];
        let sched = [];
        try { sched = JSON.parse(db.exec('SELECT exam_schedule FROM provinces WHERE id=' + pid)[0].values[0][0] || '[]'); } catch(e) {}
        if (Array.isArray(sched) && sched.length > 0) return;
        const rows = years.map(function(y) { return { year: String(y), exam_time: examTime || '' }; });
        if (rows.length === 0 && examTime) rows.push({ year: '', exam_time: examTime });
        db.run('UPDATE provinces SET exam_schedule=? WHERE id=?', [JSON.stringify(rows), pid]);
      });
    }
  } catch(e) {}

  // ── 省份基础数据兜底：省份表为空时自动重建默认省份 ──
  try {
    const cnt = db.exec('SELECT COUNT(*) FROM provinces')[0].values[0][0];
    if (cnt === 0) {
      [['山东','37'],['陕西','61'],['浙江','33']].forEach(function(p) {
        db.run("INSERT INTO provinces (name, code, subjects, schedule, official_docs, junior_colleges, undergrad_colleges, admissions, exam_time, years, exam_schedule) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
          [p[0], p[1], '[]', '[]', '[]', '[]', '[]', '[]', '', '["2027"]', '[{"year":"2027","exam_time":""}]']);
      });
    }
  } catch(e) {}

  // ── Live sessions migration ──
  try { db.run('ALTER TABLE live_sessions ADD COLUMN duration REAL DEFAULT 0'); } catch(e) {}
  try { db.run('ALTER TABLE live_streams ADD COLUMN lesson_id INTEGER'); } catch(e) {}
  try { db.run('ALTER TABLE live_replays ADD COLUMN file_id TEXT DEFAULT \'\''); } catch(e) {}
  try { db.run('ALTER TABLE teachers ADD COLUMN office_location TEXT DEFAULT \'\''); } catch(e) {}
  try { db.run('ALTER TABLE orders ADD COLUMN package_id INTEGER DEFAULT 0'); } catch(e) {}
  try { db.run('ALTER TABLE orders ADD COLUMN pay_channel TEXT DEFAULT \'\''); } catch(e) {}
  try { db.run('ALTER TABLE orders ADD COLUMN trade_no TEXT DEFAULT \'\''); } catch(e) {}
  try { db.run('ALTER TABLE orders ADD COLUMN paid_at DATETIME'); } catch(e) {}

  // ── Always-run updates (profile fields, new module seed) ──
  db.run(`UPDATE teachers SET real_name='刘明', phone='13800001001', hire_date='2020-03-01', subject='数学', province='山东省', total_hours=360 WHERE id=1`);
  db.run(`UPDATE teachers SET real_name='王刚', phone='13800001002', hire_date='2021-06-01', subject='数学', province='北京市', total_hours=280 WHERE id=2`);
  db.run(`UPDATE teachers SET real_name='系统管理', phone='13800001000', hire_date='2019-01-01', subject='管理', province='上海市' WHERE id=3`);

  // ── 教研管理种子数据 (INSERT OR IGNORE = safe to run every time) ──
  db.run(`INSERT OR IGNORE INTO teaching_plans (id, teacher_id, course_id, title, content, objectives, status, plan_date) VALUES (?,?,?,?,?,?,?,?)`,
    [1, 1, 1, '虚拟语气单元教案', '第一至第五课时虚拟语气系统教学方案', '掌握虚拟语气的四种基本用法，能做对80%以上的真题', 'published', '2026-07-28']);
  db.run(`INSERT OR IGNORE INTO teaching_plans (id, teacher_id, course_id, title, content, objectives, status, plan_date) VALUES (?,?,?,?,?,?,?,?)`,
    [2, 1, 2, '函数极限单元教案', '函数极限的定义、性质和计算方法', '理解极限的ε-δ定义，掌握极限运算法则', 'published', '2026-07-30']);
  db.run(`INSERT OR IGNORE INTO teaching_plans (id, teacher_id, course_id, title, content, objectives, status, plan_date) VALUES (?,?,?,?,?,?,?,?)`,
    [3, 2, 4, '计算机基础第一单元教案', '计算机发展史与基本组成', '了解计算机的发展历程，掌握计算机五大组成部分', 'published', '2026-08-01']);
  db.run(`INSERT OR IGNORE INTO research_activities (id, teacher_id, title, description, activity_type, activity_date, duration, notes, status) VALUES (?,?,?,?,?,?,?,?,?)`,
    [1, 1, '专升本英语教学研讨会', '讨论2026年专升本英语考试大纲变化', 'meeting', '2026-08-01', 120, '参会教师8人，达成教学调整方案', 'completed']);
  db.run(`INSERT OR IGNORE INTO research_activities (id, teacher_id, title, description, activity_type, activity_date, duration, notes, status) VALUES (?,?,?,?,?,?,?,?,?)`,
    [2, 1, 'AI辅助教学培训', '学习使用AI工具辅助备课和答疑', 'training', '2026-08-10', 90, '掌握ChatGPT、文心一言在教学中的应用', 'scheduled']);
  db.run(`INSERT OR IGNORE INTO research_activities (id, teacher_id, title, description, activity_type, activity_date, duration, notes, status) VALUES (?,?,?,?,?,?,?,?,?)`,
    [3, 2, '计算机教学组研讨会', '讨论计算机基础课程大纲优化', 'meeting', '2026-07-25', 60, '参会教师5人', 'completed']);
  db.run(`INSERT OR IGNORE INTO research_materials (id, teacher_id, title, description, material_type, course_id) VALUES (?,?,?,?,?,?)`,
    [1, 1, '虚拟语气教学PPT', '含详细注解的虚拟语气课件', 'document', 1]);
  db.run(`INSERT OR IGNORE INTO research_materials (id, teacher_id, title, description, material_type, course_id) VALUES (?,?,?,?,?,?)`,
    [2, 1, '英语阅读真题汇编', '近5年专升本英语阅读真题', 'document', 1]);
  db.run(`INSERT OR IGNORE INTO research_materials (id, teacher_id, title, description, material_type, course_id) VALUES (?,?,?,?,?,?)`,
    [3, 1, '极限计算练习题库', '含答案和解析的练习题', 'document', 2]);

  // ── 助教管理种子数据 ──
  db.run(`INSERT OR IGNORE INTO assistants (id, teacher_id, name, phone, email, bio, status) VALUES (?,?,?,?,?,?,?)`,
    [1, 1, '小王助教', '13900001001', 'wang@chengze.com', '英语专业研究生在读，两年助教经验', 'active']);
  db.run(`INSERT OR IGNORE INTO assistants (id, teacher_id, name, phone, email, bio, status) VALUES (?,?,?,?,?,?,?)`,
    [2, 1, '小李助教', '13900001002', 'li@chengze.com', '数学专业本科生，擅长高数辅导', 'active']);
  db.run(`INSERT OR IGNORE INTO assistants (id, teacher_id, name, phone, email, bio, status) VALUES (?,?,?,?,?,?,?)`,
    [3, 2, '小赵助教', '13900001003', 'zhao@chengze.com', '计算机专业研究生', 'active']);
  db.run(`INSERT OR IGNORE INTO assistant_assignments (id, assistant_id, course_id, role) VALUES (?,?,?,?)`,
    [1, 1, 1, 'ta']);
  db.run(`INSERT OR IGNORE INTO assistant_assignments (id, assistant_id, course_id, role) VALUES (?,?,?,?)`,
    [2, 2, 2, 'ta']);
  db.run(`INSERT OR IGNORE INTO assistant_assignments (id, assistant_id, course_id, role) VALUES (?,?,?,?)`,
    [3, 3, 4, 'ta']);

  // ── 答疑管理种子数据 ──
  db.run(`INSERT OR IGNORE INTO qa_questions (id, course_id, lesson_id, student_id, teacher_id, title, content, status, priority) VALUES (?,?,?,?,?,?,?,?,?)`,
    [1, 1, 1, 1, 1, '虚拟语气中were的用法', '老师，在虚拟语气中什么时候用were而不是was？是不是所有情况都用were？', 'answered', 'high']);
  db.run(`INSERT OR IGNORE INTO qa_questions (id, course_id, lesson_id, student_id, teacher_id, title, content, status, priority) VALUES (?,?,?,?,?,?,?,?,?)`,
    [2, 1, 2, 2, 1, '混合虚拟语气的判断', '怎么判断一个句子是混合虚拟语气？有什么技巧吗？', 'answered', 'normal']);
  db.run(`INSERT OR IGNORE INTO qa_questions (id, course_id, lesson_id, student_id, teacher_id, title, content, status, priority) VALUES (?,?,?,?,?,?,?,?,?)`,
    [3, 2, null, 3, 1, '极限定义中的ε-δ不太理解', '能不能用更通俗的方式解释一下ε-δ定义？', 'open', 'high']);
  db.run(`INSERT OR IGNORE INTO qa_questions (id, course_id, lesson_id, student_id, teacher_id, title, content, status, priority) VALUES (?,?,?,?,?,?,?,?,?)`,
    [4, 1, null, 4, 1, '课后作业第三题', '第三题不太明白，能讲解一下吗？', 'open', 'normal']);
  db.run(`INSERT OR IGNORE INTO qa_questions (id, course_id, lesson_id, student_id, teacher_id, title, content, status, priority) VALUES (?,?,?,?,?,?,?,?,?)`,
    [5, 4, null, 5, 2, '计算机主机怎么组装', '想了解计算机主机的组装流程和注意事项', 'open', 'normal']);
  db.run(`INSERT OR IGNORE INTO qa_answers (id, question_id, answerer_type, answerer_id, content) VALUES (?,?,?,?,?)`,
    [1, 1, 'teacher', 1, '在虚拟语气中，无论主语是什么人称，be动词统一用were。这是虚拟语气的特殊规则，记住"If I were"这个固定搭配就好。']);
  db.run(`INSERT OR IGNORE INTO qa_answers (id, question_id, answerer_type, answerer_id, content) VALUES (?,?,?,?,?)`,
    [2, 2, 'teacher', 1, '判断混合虚拟语气主要看时间状语：从句和主句的时间不一致时就可能是混合虚拟。例如从句描述过去（had studied），主句描述现在（would be）。']);
  db.run(`INSERT OR IGNORE INTO qa_answers (id, question_id, answerer_type, answerer_id, content) VALUES (?,?,?,?,?)`,
    [3, 5, 'assistant', 3, '主机组装步骤：1.安装CPU和散热器 2.安装内存条 3.固定主板到机箱 4.安装电源 5.安装显卡等扩展卡 6.连接数据线和电源线。建议观看我们的组装教程视频。']);
  db.run('UPDATE qa_questions SET status=\'answered\', answered_at=CURRENT_TIMESTAMP WHERE id=1 AND status=\'open\'');
  db.run('UPDATE qa_questions SET status=\'answered\', answered_at=CURRENT_TIMESTAMP WHERE id=2 AND status=\'open\'');

  // ── 补充学员与进度 ──
  db.run('INSERT OR IGNORE INTO students (id, name, phone, email, password_hash) VALUES (?,?,?,?,?)',
    [6, '孙伟', '13900001006', 'sunwei@example.com', '']);
  db.run('INSERT OR IGNORE INTO students (id, name, phone, email, password_hash) VALUES (?,?,?,?,?)',
    [7, '周婷', '13900001007', 'zhouting@example.com', '']);
  db.run('INSERT OR IGNORE INTO enrollments (student_id, course_id) VALUES (?,?)', [6, 1]);
  db.run('INSERT OR IGNORE INTO enrollments (student_id, course_id) VALUES (?,?)', [6, 3]);
  db.run('INSERT OR IGNORE INTO enrollments (student_id, course_id) VALUES (?,?)', [7, 2]);
  db.run('INSERT OR IGNORE INTO enrollments (student_id, course_id) VALUES (?,?)', [7, 4]);
  db.run('INSERT OR IGNORE INTO course_progress (student_id, lesson_id, completed, watch_duration, last_position) VALUES (?,?,?,?,?)', [3, 1, 1, 2550, 2550]);
  db.run('INSERT OR IGNORE INTO course_progress (student_id, lesson_id, completed, watch_duration, last_position) VALUES (?,?,?,?,?)', [3, 2, 1, 2295, 2295]);
  db.run('INSERT OR IGNORE INTO course_progress (student_id, lesson_id, completed, watch_duration, last_position) VALUES (?,?,?,?,?)', [4, 1, 0, 1200, 1200]);
  db.run('INSERT OR IGNORE INTO course_progress (student_id, lesson_id, completed, watch_duration, last_position) VALUES (?,?,?,?,?)', [5, 1, 1, 2550, 2550]);
  db.run('INSERT OR IGNORE INTO course_progress (student_id, lesson_id, completed, watch_duration, last_position) VALUES (?,?,?,?,?)', [6, 1, 0, 800, 800]);
  db.run('INSERT OR IGNORE INTO course_progress (student_id, lesson_id, completed, watch_duration, last_position) VALUES (?,?,?,?,?)', [7, 1, 1, 2550, 2550]);
  db.run('INSERT OR IGNORE INTO course_progress (student_id, lesson_id, completed, watch_duration, last_position) VALUES (?,?,?,?,?)', [7, 2, 0, 1500, 1500]);

  // ── 订单管理种子数据 ──
  const orderCourseIds = query('SELECT id FROM courses ORDER BY id LIMIT 4').map(r => r.id);
  while (orderCourseIds.length < 4) orderCourseIds.push(null);
  const orders = [
    ['DD202607260001', 1, orderCourseIds[0], 3280, 'paid', '微信支付', '2026-07-26 10:12:00'],
    ['DD202607260002', 2, orderCourseIds[1], 2680, 'paid', '支付宝', '2026-07-26 11:03:00'],
    ['DD202607270001', 3, orderCourseIds[0], 3280, 'pending', '微信支付', '2026-07-27 09:30:00'],
    ['DD202607270002', 4, orderCourseIds[2], 1980, 'paid', '支付宝', '2026-07-27 14:22:00'],
    ['DD202607280001', 5, orderCourseIds[3], 2280, 'paid', '微信支付', '2026-07-28 16:45:00'],
    ['DD202607280002', 6, orderCourseIds[0], 3280, 'paid', '支付宝', '2026-07-28 20:08:00'],
    ['DD202607290001', 7, orderCourseIds[1], 2680, 'pending', '微信支付', '2026-07-29 08:55:00'],
    ['DD202607290002', 1, orderCourseIds[2], 1980, 'refunded', '支付宝', '2026-07-29 15:40:00'],
    ['DD202607300001', 2, orderCourseIds[3], 2280, 'cancelled', '微信支付', '2026-07-30 10:18:00'],
    ['DD202607300002', 3, orderCourseIds[1], 2680, 'paid', '线下转账', '2026-07-30 19:26:00'],
    ['DD202607310001', 4, orderCourseIds[0], 3280, 'paid', '微信支付', '2026-07-31 09:02:00'],
    ['DD202607310002', 5, orderCourseIds[2], 1980, 'paid', '支付宝', '2026-07-31 13:37:00'],
    ['DD202608010001', 6, orderCourseIds[3], 2280, 'pending', '微信支付', '2026-08-01 10:20:00'],
    ['DD202608010002', 7, orderCourseIds[0], 3280, 'paid', '支付宝', '2026-08-01 11:45:00'],
    ['DD202608010003', 2, orderCourseIds[0], 3280, 'pending', '微信支付', '2026-08-01 14:16:00']
  ];
  for (const o of orders) {
    db.run('INSERT OR IGNORE INTO orders (order_no, student_id, course_id, amount, status, payment_method, created_at) VALUES (?,?,?,?,?,?,?)', o);
  }

  // ── Old seed data: skip if teachers already exist ──
  // ── 物流管理种子数据 ──
  db.run(`INSERT OR IGNORE INTO logistics (id, teacher_id, student_id, course_id, order_no, type, status, recipient_name, recipient_phone, recipient_address, carrier, tracking_no, shipped_at, remark) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [1, 1, 1, 1, 'LG20260701001', 'material', 'delivered', '李明', '13800138001', '北京市海淀区中关村大街1号', '顺丰速运', 'SF1234567890', '2026-07-02 14:30:00', '大学英语讲义及真题集']);
  db.run(`INSERT OR IGNORE INTO logistics (id, teacher_id, student_id, course_id, order_no, type, status, recipient_name, recipient_phone, recipient_address, carrier, tracking_no, shipped_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [2, 1, 2, 1, 'LG20260702002', 'book', 'shipped', '王芳', '13800138002', '上海市浦东新区张江路200号', '中通快递', 'ZT9876543210', '2026-07-25 10:00:00']);
  db.run(`INSERT OR IGNORE INTO logistics (id, teacher_id, student_id, course_id, order_no, type, status, recipient_name, recipient_phone, recipient_address, remark) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [3, 1, 3, 1, 'LG20260725003', 'certificate', 'pending', '赵强', '13800138003', '广州市天河区体育西路100号', '结业证书待寄出']);
  db.run(`INSERT OR IGNORE INTO logistics (id, teacher_id, student_id, course_id, order_no, type, status, recipient_name, recipient_phone, recipient_address, carrier, tracking_no, shipped_at, remark) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [4, 2, 6, 4, 'LG20260725004', 'material', 'shipped', '孙伟', '13900001006', '深圳市南山区科技园南路88号', '圆通速递', 'YT12345678', '2026-07-26 09:00:00', '计算机基础讲义']);
  db.run(`INSERT OR IGNORE INTO logistics_items (id, logistics_id, name, quantity, unit) VALUES (?,?,?,?,?)`,
    [1, 1, '大学英语精讲讲义', 1, '册']);
  db.run(`INSERT OR IGNORE INTO logistics_items (id, logistics_id, name, quantity, unit) VALUES (?,?,?,?,?)`,
    [2, 1, '专升本英语真题集', 1, '本']);
  db.run(`INSERT OR IGNORE INTO logistics_items (id, logistics_id, name, quantity, unit) VALUES (?,?,?,?,?)`,
    [3, 2, '大学英语教材', 1, '本']);
  db.run(`INSERT OR IGNORE INTO logistics_items (id, logistics_id, name, quantity, unit) VALUES (?,?,?,?,?)`,
    [4, 3, '结业证书', 1, '份']);
  db.run(`INSERT OR IGNORE INTO logistics_items (id, logistics_id, name, quantity, unit) VALUES (?,?,?,?,?)`,
    [5, 4, '计算机基础讲义', 1, '册']);

  // ── 补充学员与进度 ──
  db.run('INSERT OR IGNORE INTO students (id, name, phone, email, password_hash) VALUES (?,?,?,?,?)',
    [6, '孙伟', '13900001006', 'sunwei@example.com', '']);
  db.run('INSERT OR IGNORE INTO students (id, name, phone, email, password_hash) VALUES (?,?,?,?,?)',
    [7, '周婷', '13900001007', 'zhouting@example.com', '']);
  db.run('INSERT OR IGNORE INTO enrollments (student_id, course_id) VALUES (?,?)', [6, 1]);
  db.run('INSERT OR IGNORE INTO enrollments (student_id, course_id) VALUES (?,?)', [6, 3]);
  db.run('INSERT OR IGNORE INTO enrollments (student_id, course_id) VALUES (?,?)', [7, 2]);
  db.run('INSERT OR IGNORE INTO enrollments (student_id, course_id) VALUES (?,?)', [7, 4]);
  db.run('INSERT OR IGNORE INTO course_progress (student_id, lesson_id, completed, watch_duration, last_position) VALUES (?,?,?,?,?)', [3, 1, 1, 2550, 2550]);
  db.run('INSERT OR IGNORE INTO course_progress (student_id, lesson_id, completed, watch_duration, last_position) VALUES (?,?,?,?,?)', [3, 2, 1, 2295, 2295]);
  db.run('INSERT OR IGNORE INTO course_progress (student_id, lesson_id, completed, watch_duration, last_position) VALUES (?,?,?,?,?)', [4, 1, 0, 1200, 1200]);
  db.run('INSERT OR IGNORE INTO course_progress (student_id, lesson_id, completed, watch_duration, last_position) VALUES (?,?,?,?,?)', [5, 1, 1, 2550, 2550]);
  db.run('INSERT OR IGNORE INTO course_progress (student_id, lesson_id, completed, watch_duration, last_position) VALUES (?,?,?,?,?)', [6, 1, 0, 800, 800]);
  db.run('INSERT OR IGNORE INTO course_progress (student_id, lesson_id, completed, watch_duration, last_position) VALUES (?,?,?,?,?)', [7, 1, 1, 2550, 2550]);
  db.run('INSERT OR IGNORE INTO course_progress (student_id, lesson_id, completed, watch_duration, last_position) VALUES (?,?,?,?,?)', [7, 2, 0, 1500, 1500]);

  // ── Old seed data: skip if teachers already exist ──
  const teacherCount = db.exec('SELECT COUNT(*) as c FROM teachers');
  if (teacherCount.length > 0 && teacherCount[0].values[0][0] > 1) return;
  if (teacherCount.length > 0 && teacherCount[0].values[0][0] > 0) return;

  const hash = bcrypt.hashSync('admin123', 10);

  db.run('INSERT OR IGNORE INTO teachers (id, username, password_hash, display_name, real_name, phone, hire_date, subject, province, bio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [1, 'teacher', hash, '刘老师', '刘明', '13800001001', '2020-03-01', '英语', '北京市', '资深专升本英语讲师，10年教学经验']);
  db.run('INSERT OR IGNORE INTO teachers (id, username, password_hash, display_name, real_name, phone, hire_date, subject, province, bio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [2, 'laowang', bcrypt.hashSync('123456', 10), '王老师', '王刚', '13800001002', '2021-06-01', '数学', '北京市', '高等数学金牌讲师']);
  db.run('INSERT OR IGNORE INTO teachers (id, username, password_hash, display_name, real_name, phone, hire_date, subject, province, bio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [3, 'admin', bcrypt.hashSync('1', 10), '管理员', '系统管理', '13800001000', '2019-01-01', '管理', '上海市', '系统管理员']);
  const courses = [
    [1, 1, '大学英语精讲班', '系统讲解专升本英语考试核心知识点，涵盖语法、阅读、写作、翻译四大模块。', '英语', 'published', 2876, '2026', '浙江省', '全程班'],
    [2, 1, '高等数学基础班', '从零基础到专升本高数通关，函数、极限、导数、积分全覆盖。', '数学', 'published', 2154, '2026', '浙江省', '基础班'],
    [3, 1, '大学语文考前冲刺', '文学常识、文言文阅读、现代文阅读、作文写作四大专项突破。', '语文', 'published', 1832, '2026', '山东省', '冲刺班'],
    [4, 2, '计算机基础精讲', '专升本计算机基础科目考点精讲，含Office操作和计算机网络。', '计算机', 'published', 1598, '2026', '广东省', '精讲班'],
  ];
  
  for (const c of courses) {
    db.run('INSERT OR IGNORE INTO courses (id, teacher_id, title, description, category, status, student_count, year, province, class_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', c);
  }

  const slides1 = JSON.stringify([
    { time: 0, title: '虚拟语气基础概念', lines: ['什么是虚拟语气？', '', '虚拟语气 (Subjunctive Mood) 是一种动词形式，', '用来表达：', '• 与事实相反的假设', '• 愿望、建议、要求', '• 不可能实现的想象'] },
    { time: 15, title: '与现在事实相反', lines: ['If + 主语 + 动词过去式...', '主语 + would/could + 动词原形', '', 'Example:', 'If I were you, I would study harder.', '（如果我是你，我会更努力学习。）'] },
    { time: 30, title: '与过去事实相反', lines: ['If + 主语 + had + 过去分词...', '主语 + would/could + have + 过去分词', '', 'Example:', 'If I had studied yesterday, I would have passed.'] },
    { time: 45, title: '与将来事实相反', lines: ['If + 主语 + should/were to + 动词原形...', '主语 + would/could + 动词原形', '', 'Example:', 'If it should rain tomorrow, class would be canceled.'] },
    { time: 60, title: '名词性从句中的虚拟语气', lines: ['在 suggest, demand, order 等动词后的', 'that 从句中，使用 should + 动词原形', '（should 可省略）', '', 'Example:', 'I suggest that he (should) study more.'] },
    { time: 75, title: 'wish 的用法', lines: ['wish + 过去式 → 与现在相反', 'wish + 过去完成式 → 与过去相反', 'wish + would/could → 与将来相反', '', 'Example:', 'I wish I were a college student.'] },
    { time: 90, title: 'as if / as though', lines: ['as if / as though + 虚拟语气', '', '与现在相反 → 过去式', '与过去相反 → 过去完成式', '', 'Example:', 'He talks as if he knew everything.'] },
    { time: 105, title: 'It is time that...', lines: ['It is (high) time that 主语 + 过去式', '', '表示"是时候做某事了"', '带有建议意味', '', 'Example:', 'It is time that we started reviewing.'] },
    { time: 120, title: '虚拟语气小结', lines: ['虚拟语气核心要点：', '', '1. 区分与现在/过去/将来相反', '2. 掌握 suggest 类动词的用法', '3. wish / as if / it is time 特殊句型', '4. 真题中注意时间状语提示'] },
    { time: 135, title: '真题实战', lines: ['选择正确的虚拟语气形式：', '', 'If I ___ (be) you, I would apply.', 'A. am    B. was    C. were    D. be', '', '答案：C', '', '解析：与现在事实相反，be 动词用 were'] },
    { time: 150, title: '真题实战（二）', lines: ['I wish I ___ (study) harder yesterday.', 'A. studied    B. had studied', 'C. study    D. would study', '', '答案：B', '', '解析：与过去事实相反，用 had + 过去分词'] },
  ]);

  const slides2 = JSON.stringify([
    { time: 0, title: '条件句入门', lines: ['什么是条件句？', '', '真实条件句 (Real Conditional)', 'If it rains, I will stay home.', '', '虚拟条件句 (Unreal Conditional)', 'If it rained, I would stay home.'] },
    { time: 20, title: '混合虚拟语气', lines: ['主从句时间不一致时的混合虚拟', '', 'If I had studied yesterday,', 'I would be in college now.'] },
  ]);

  db.run(`INSERT OR IGNORE INTO lessons (id, course_id, title, description, duration, order_index, slides_data) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [1, 1, '虚拟语气基础概念', '了解虚拟语气的定义和基本用法', 2550, 1, slides1]);
  db.run(`INSERT OR IGNORE INTO lessons (id, course_id, title, description, duration, order_index, slides_data) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [2, 1, '条件句中的虚拟语气', '学习条件状语从句中的虚拟语气用法', 2295, 2, slides2]);
  db.run(`INSERT OR IGNORE INTO lessons (id, course_id, title, description, duration, order_index, slides_data) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [3, 1, '名词性从句中的虚拟语气', '掌握suggest等动词后的虚拟语气用法', 2700, 3, slides1]);
  db.run(`INSERT OR IGNORE INTO lessons (id, course_id, title, description, duration, order_index, slides_data) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [4, 1, '虚拟语气的特殊用法', 'wish, as if, it is time 等特殊句型', 2140, 4, slides2]);
  db.run(`INSERT OR IGNORE INTO lessons (id, course_id, title, description, duration, order_index, slides_data) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [5, 1, '真题演练与解析（一）', '专升本考试真题实战', 3020, 5, slides1]);

  const students = [
    [1, '李明', '13800138001', 'liming@example.com'],
    [2, '王芳', '13800138002', 'wangfang@example.com'],
    [3, '赵强', '13800138003', 'zhaoqiang@example.com'],
    [4, '陈静', '13800138004', 'chenjing@example.com'],
    [5, '刘洋', '13800138005', 'liuyang@example.com'],
  ];
  for (const s of students) {
    db.run('INSERT OR IGNORE INTO students (id, name, phone, email) VALUES (?, ?, ?, ?)', s);
  }

  db.run('INSERT OR IGNORE INTO enrollments (student_id, course_id) VALUES (?, ?)', [1, 1]);
  db.run('INSERT OR IGNORE INTO enrollments (student_id, course_id) VALUES (?, ?)', [1, 2]);
  db.run('INSERT OR IGNORE INTO enrollments (student_id, course_id) VALUES (?, ?)', [2, 1]);
  db.run('INSERT OR IGNORE INTO enrollments (student_id, course_id) VALUES (?, ?)', [3, 1]);
  db.run('INSERT OR IGNORE INTO enrollments (student_id, course_id) VALUES (?, ?)', [3, 3]);
  db.run('INSERT OR IGNORE INTO enrollments (student_id, course_id) VALUES (?, ?)', [4, 2]);
}

function ensureStudentUids() {
  const rows = query('SELECT id FROM students WHERE uid IS NULL OR uid = \'\'');
  for (const r of rows) {
    let uid = '';
    do {
      uid = 'UID' + String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
    } while (get('SELECT id FROM students WHERE uid = ?', [uid]));
    db.run('UPDATE students SET uid = ? WHERE id = ?', [uid, r.id]);
  }
}

function saveDb() {
  // SQL.js export reopens its connection; restore foreign-key enforcement afterwards.
  try {
    const buffer = Buffer.from(db.export());
    const temporary = DB_PATH + '.saving-' + process.pid + '-' + Date.now();
    const mode = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).mode & 0o777 : 0o600;
    const fd = fs.openSync(temporary, 'wx', mode);
    try { fs.writeFileSync(fd, buffer); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(temporary, DB_PATH);
  } finally { db.run('PRAGMA foreign_keys=ON'); }
}

function query(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function run(sql, params = []) {
  db.run(sql, params);
  let lastId = null;
  try {
    const rows = query('SELECT last_insert_rowid() as id');
    if (rows.length > 0) lastId = rows[0].id;
  } catch(e) {}
  saveDb();
  return lastId;
}

function get(sql, params = []) {
  const rows = query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

module.exports = { getDb, query, run, get, saveDb };

-- Empty local development schema derived from source; not a production DB export.
CREATE TABLE IF NOT EXISTS provinces (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,code TEXT UNIQUE,subjects TEXT DEFAULT '[]',schedule TEXT DEFAULT '[]',official_docs TEXT DEFAULT '[]',junior_colleges TEXT DEFAULT '[]',undergrad_colleges TEXT DEFAULT '[]',admissions TEXT DEFAULT '[]',exam_time TEXT DEFAULT '',years TEXT DEFAULT '[]',exam_schedule TEXT DEFAULT '[]',outline_file TEXT DEFAULT '',papers_file TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS teachers (
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
  );
CREATE TABLE IF NOT EXISTS courses (
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
  );
CREATE TABLE IF NOT EXISTS course_packages (
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
  );
CREATE TABLE IF NOT EXISTS lessons (
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
  );
CREATE TABLE IF NOT EXISTS province_subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    province_id INTEGER NOT NULL,
    standard TEXT DEFAULT '',
    name TEXT DEFAULT '',
    outline_file TEXT DEFAULT '',
    papers_file TEXT DEFAULT '',
    order_index INTEGER DEFAULT 0
  );
CREATE TABLE IF NOT EXISTS province_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    province_id INTEGER NOT NULL,
    name TEXT DEFAULT '',
    order_index INTEGER DEFAULT 0
  );
CREATE TABLE IF NOT EXISTS province_category_subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL
  );
CREATE TABLE IF NOT EXISTS province_majors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    name TEXT DEFAULT '',
    order_index INTEGER DEFAULT 0
  );
CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT DEFAULT '',
    name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    password_hash TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (course_id) REFERENCES courses(id),
    UNIQUE(student_id, course_id)
  );
CREATE TABLE IF NOT EXISTS orders (
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
  );
CREATE TABLE IF NOT EXISTS package_enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    package_id INTEGER NOT NULL,
    order_id INTEGER,
    enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (package_id) REFERENCES course_packages(id),
    UNIQUE(student_id, package_id)
  );
CREATE TABLE IF NOT EXISTS live_chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER DEFAULT 0,
    lesson_id INTEGER,
    sender TEXT DEFAULT '',
    content TEXT DEFAULT '',
    type TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
CREATE TABLE IF NOT EXISTS course_progress (
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
  );
CREATE TABLE IF NOT EXISTS teaching_plans (
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
  );
CREATE TABLE IF NOT EXISTS course_package_courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    package_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(package_id, course_id),
    FOREIGN KEY (package_id) REFERENCES course_packages(id),
    FOREIGN KEY (course_id) REFERENCES courses(id)
  );
CREATE TABLE IF NOT EXISTS research_activities (
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
  );
CREATE TABLE IF NOT EXISTS research_materials (
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
  );
CREATE TABLE IF NOT EXISTS assistants (
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
  );
CREATE TABLE IF NOT EXISTS assistant_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assistant_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    role TEXT DEFAULT 'ta',
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assistant_id) REFERENCES assistants(id),
    FOREIGN KEY (course_id) REFERENCES courses(id)
  );
CREATE TABLE IF NOT EXISTS qa_questions (
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
  );
CREATE TABLE IF NOT EXISTS qa_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL,
    answerer_type TEXT DEFAULT 'teacher',
    answerer_id INTEGER,
    content TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES qa_questions(id)
  );
CREATE TABLE IF NOT EXISTS logistics (
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
  );
CREATE TABLE IF NOT EXISTS logistics_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    logistics_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit TEXT DEFAULT '份',
    FOREIGN KEY (logistics_id) REFERENCES logistics(id)
  );
CREATE TABLE IF NOT EXISTS live_sessions (
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
  );
CREATE TABLE IF NOT EXISTS live_replays (
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
  );
CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT DEFAULT '',
    lesson_id INTEGER DEFAULT 0,
    content TEXT DEFAULT '',
    options TEXT DEFAULT '[]',
    answer INTEGER DEFAULT 0,
    explanation TEXT DEFAULT '',
    source TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
CREATE TABLE IF NOT EXISTS course_materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER DEFAULT 0,
    lesson_id INTEGER DEFAULT 0,
    filename TEXT DEFAULT '',
    original_name TEXT DEFAULT '',
    size INTEGER DEFAULT 0,
    uploaded_by INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
ALTER TABLE students ADD COLUMN wechat_nickname TEXT DEFAULT '';
ALTER TABLE students ADD COLUMN wechat_openid TEXT DEFAULT '';
ALTER TABLE teachers ADD COLUMN status TEXT DEFAULT 'active';
ALTER TABLE lessons ADD COLUMN stage_count INTEGER DEFAULT 0;
ALTER TABLE lessons ADD COLUMN stage_duration INTEGER DEFAULT 0;
ALTER TABLE province_subjects ADD COLUMN type TEXT DEFAULT '';
ALTER TABLE province_categories ADD COLUMN kind TEXT DEFAULT 'junior';
ALTER TABLE province_categories ADD COLUMN link_category_id INTEGER DEFAULT 0;
ALTER TABLE teachers ADD COLUMN teacher_no TEXT DEFAULT '';
ALTER TABLE students ADD COLUMN username TEXT DEFAULT '';
ALTER TABLE students ADD COLUMN status TEXT DEFAULT 'active';
ALTER TABLE students ADD COLUMN real_name TEXT DEFAULT '';
ALTER TABLE students ADD COLUMN exam_year TEXT DEFAULT '';

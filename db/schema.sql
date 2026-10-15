-- 成泽教育 — Database Schema

CREATE TABLE IF NOT EXISTS teachers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT DEFAULT '',
  cover TEXT DEFAULT '',
  status TEXT DEFAULT 'draft',  -- draft | published | archived
  student_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id)
);

CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  duration INTEGER DEFAULT 0,      -- seconds
  order_index INTEGER DEFAULT 0,
  video_url TEXT DEFAULT '',
  slides_data TEXT DEFAULT '[]',    -- JSON array of slide objects
  is_free BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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

CREATE TABLE IF NOT EXISTS course_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  lesson_id INTEGER NOT NULL,
  completed BOOLEAN DEFAULT 0,
  watch_duration REAL DEFAULT 0,
  last_position REAL DEFAULT 0,     -- seconds
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (lesson_id) REFERENCES lessons(id),
  UNIQUE(student_id, lesson_id)
);

-- Seed teacher account (password: admin123)
INSERT OR IGNORE INTO teachers (id, username, password_hash, display_name, bio)
VALUES (1, 'teacher', '$2a$10$8KzQm6q5q5q5q5q5q5q5qO5q5q5q5q5q5q5q5q5q5q5q5q5q5q', '刘老师', '资深专升本英语讲师，10年教学经验');

-- Seed demo courses
INSERT OR IGNORE INTO courses (id, teacher_id, title, description, category, status, student_count)
VALUES
(1, 1, '大学英语精讲班', '系统讲解专升本英语考试核心知识点，涵盖语法、阅读、写作、翻译四大模块。', '英语', 'published', 2876),
(2, 1, '高等数学基础班', '从零基础到专升本高数通关，函数、极限、导数、积分全覆盖。', '数学', 'published', 2154),
(3, 1, '大学语文考前冲刺', '文学常识、文言文阅读、现代文阅读、作文写作四大专项突破。', '语文', 'published', 1832),
(4, 1, '计算机基础精讲', '专升本计算机基础科目考点精讲，含Office操作和计算机网络。', '计算机', 'published', 1598);

-- Seed demo lessons for course 1
INSERT OR IGNORE INTO lessons (id, course_id, title, description, duration, order_index, slides_data) VALUES
(1, 1, '虚拟语气基础概念', '了解虚拟语气的定义和基本用法', 2550, 1, '[{"time":0,"title":"虚拟语气基础概念","lines":["什么是虚拟语气？","","虚拟语气 (Subjunctive Mood) 是一种动词形式，","用来表达：","• 与事实相反的假设","• 愿望、建议、要求","• 不可能实现的想象"]},{"time":15,"title":"与现在事实相反","lines":["If + 主语 + 动词过去式...","主语 + would/could + 动词原形","","Example:","If I were you, I would study harder."]},{"time":30,"title":"与过去事实相反","lines":["If + 主语 + had + 过去分词...","主语 + would/could + have + 过去分词","","Example:","If I had studied yesterday, I would have passed."]}]'),
(2, 1, '条件句中的虚拟语气', '学习条件状语从句中的虚拟语气用法', 2295, 2, '[{"time":0,"title":"条件状语从句","lines":["真实条件句 vs 虚拟条件句","","真实：If it rains, I will stay home.","虚拟：If it rained, I would stay home."]},{"time":20,"title":"混合虚拟","lines":["主句和从句时间不一致时的处理","","If I had studied, I would be in college now."]}]'),
(3, 1, '名词性从句中的虚拟语气', '掌握suggest等动词后的虚拟语气用法', 2700, 3, '[{"time":0,"title":"名词性从句虚拟","lines":["suggest, demand, order 等动词后","使用 should + 动词原形 (should 可省略)","","I suggest that he study more."]}]'),
(4, 1, '虚拟语气的特殊用法', 'wish, as if, it is time 等特殊句型', 2140, 4, '[{"time":0,"title":"特殊句型","lines":["wish + 过去式 → 与现在相反","wish + 过去完成式 → 与过去相反","as if + 虚拟语气","It is time that + 过去式"]}]'),
(5, 1, '真题演练与解析（一）', '专升本考试真题实战', 3020, 5, '[{"time":0,"title":"真题实战","lines":["选择正确的虚拟语气形式：","","If I ___ (be) you, I would apply.","A. am    B. was    C. were    D. be"]}]');

-- Seed demo students
INSERT OR IGNORE INTO students (id, name, phone, email) VALUES
(1, '李明', '13800138001', 'liming@example.com'),
(2, '王芳', '13800138002', 'wangfang@example.com'),
(3, '赵强', '13800138003', 'zhaoqiang@example.com'),
(4, '陈静', '13800138004', 'chenjing@example.com'),
(5, '刘洋', '13800138005', 'liuyang@example.com');

-- Seed enrollments
INSERT OR IGNORE INTO enrollments (student_id, course_id) VALUES
(1, 1), (1, 2), (2, 1), (3, 1), (3, 3), (4, 2), (5, 1), (5, 4);

-- Seed progress
INSERT OR IGNORE INTO course_progress (student_id, lesson_id, completed, watch_duration, last_position) VALUES
(1, 1, 1, 2550, 2550),
(1, 2, 0, 1800, 1800),
(2, 1, 1, 2550, 2550);

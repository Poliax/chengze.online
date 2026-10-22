module.exports=teacher=>teacher && (teacher.display_name || teacher.real_name || teacher.username) || '教师';

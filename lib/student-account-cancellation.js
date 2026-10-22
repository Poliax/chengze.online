module.exports = function cancelStudentAccount(db,bcrypt,studentId,body) {
  if (body.confirmation !== '注销账号') throw Error('请输入“注销账号”确认');
  const student=db.get('SELECT * FROM students WHERE id=?',[studentId]);
  if (!student || student.status === 'disabled') throw Error('账号不存在或已停用');
  if (typeof body.phone !== 'string' || body.phone.trim() !== student.phone) throw Error('注册手机号不正确');
  if (!student.password_hash) throw Error('本账号未设置登录密码，请先联系平台核验后处理注销');
  if (typeof body.password !== 'string' || !bcrypt.compareSync(body.password,student.password_hash)) throw Error('登录密码不正确');
  db.atomic(()=>db.run(`UPDATE students SET status='disabled',name='',real_name='',nickname='已注销学员',
    phone='',email='',password_hash='',wechat_nickname='',avatar='',
    recipient_name='',recipient_phone='',recipient_address='',recipient_province='',recipient_city='',recipient_district='',recipient_address_detail='',
    province_code='',exam_year='',junior_college='',junior_major='' WHERE id=?`,[studentId]));
};

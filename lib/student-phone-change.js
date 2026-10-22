const crypto=require('node:crypto');
module.exports=function createPhoneChange({db,sendSms,isReady,now=Date.now}){
  const codes=new Map(),rates=new Map();
  function fail(message,status=400){const error=Error(message);error.status=status;throw error;}
  function account(id,newPhone){
    if(typeof newPhone!=='string'||!/^1\d{10}$/.test(newPhone))fail('请输入正确的新手机号');
    const row=db.get('SELECT id,phone,status FROM students WHERE id=?',[id]);
    if(!row||row.status==='disabled')fail('请重新登录',401);
    if(!/^1\d{10}$/.test(row.phone))fail('原手机号无效，请联系平台核验');
    if(row.phone===newPhone)fail('新手机号不能与原手机号相同');
    if(db.get('SELECT id FROM students WHERE phone=? AND id<>?',[newPhone,id]))fail('新手机号已被其他账号注册');
    return row;
  }
  function limit(key){
    const time=now();let rate=rates.get(key);
    if(!rate||time-rate.start>=86400000)rate={start:time,last:-Infinity,count:0};
    if(time-rate.last<60000)fail('请在60秒后重新获取验证码',429);
    if(rate.count>=5)fail('今日验证码次数已达上限',429);
    rate.count++;rate.last=time;rates.set(key,rate);
  }
  function digest(code){return crypto.createHash('sha256').update(code).digest();}
  return {
    async send(id,purpose,newPhone){
      if(!['old','new'].includes(purpose))fail('验证类型无效');
      const row=account(id,newPhone);
      if(!isReady())fail('正式短信服务尚未启用，暂不能修改登录手机号',503);
      for(const [key,value]of codes)if(value.expires<=now())codes.delete(key);
      for(const [key,value]of rates)if(now()-value.start>=86400000)rates.delete(key);
      const target=purpose==='old'?row.phone:newPhone;
      limit('account:'+id+':'+purpose);limit('phone:'+target);
      const key=id+':'+purpose;codes.delete(key);
      const code=String(crypto.randomInt(100000,1000000));
      const result=await sendSms(target,code);
      if(!result||!result.success||result.devCode)fail('真实短信发送失败，请稍后重试',503);
      codes.set(key,{hash:digest(code),phone:target,oldPhone:row.phone,newPhone,expires:now()+300000,attempts:0});
    },
    change(id,body){
      const row=account(id,body.new_phone);
      if(!isReady())fail('正式短信服务尚未启用，暂不能修改登录手机号',503);
      for(const purpose of ['old','new']){
        const key=id+':'+purpose,stored=codes.get(key),code=body[purpose+'_code'];
        if(!stored||stored.expires<=now()||stored.oldPhone!==row.phone||stored.newPhone!==body.new_phone)fail('验证码错误或已过期，请重新获取');
        stored.attempts++;
        const valid=typeof code==='string'&&/^\d{6}$/.test(code)&&crypto.timingSafeEqual(digest(code),stored.hash);
        if(!valid){if(stored.attempts>=5){codes.delete(id+':old');codes.delete(id+':new');}fail('验证码错误或已过期');}
      }
      db.run('UPDATE students SET phone=? WHERE id=?',[body.new_phone,id]);
      codes.delete(id+':old');codes.delete(id+':new');
      return body.new_phone;
    }
  };
};

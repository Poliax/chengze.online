const db=require('../db');
module.exports=function studentStatus(req,res,next){
  if(req.session && req.session.studentId){
    const student=db.get('SELECT status FROM students WHERE id=?',[req.session.studentId]);
    if(!student || student.status==='disabled'){
      delete req.session.studentId;
      delete req.session.guest;
    }
  }
  next();
};

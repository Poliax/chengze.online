const router=require('express').Router();
router.get('/',(req,res)=>res.render('teacher/technical-center',{title:'技术工作台 · 承泽在线'}));
module.exports=router;

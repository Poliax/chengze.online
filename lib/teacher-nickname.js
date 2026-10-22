module.exports=db=>(req,res)=>res.status(403).json({error:'昵称由创建账号的管理员设置，请联系管理员修改'});

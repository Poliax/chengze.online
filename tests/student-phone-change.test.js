const test=require('node:test'),assert=require('node:assert/strict');
const create=require('../lib/student-phone-change');
function fixture(ready=true){let time=1000000,phone='13800000000';const sent={},writes=[];const db={get(sql,args){if(sql.includes('AND id<>'))return args[0]==='13900000000'?{id:99}:null;return {id:7,phone,status:'active'};},run(sql,args){writes.push({sql,args});phone=args[0];}};const service=create({db,isReady:()=>ready,now:()=>time,sendSms:async(target,code)=>{sent[target]=code;return {success:true};}});return {service,sent,writes,advance(ms){time+=ms;}};}
test('requires both verified phones, updates only current phone, and consumes codes',async()=>{
 const f=fixture(),phone='13700000000';await f.service.send(7,'old',phone);await f.service.send(7,'new',phone);
 assert.throws(()=>f.service.change(7,{new_phone:phone,old_code:'000000',new_code:f.sent[phone]}));assert.equal(f.writes.length,0);
 assert.equal(f.service.change(7,{new_phone:phone,old_code:f.sent['13800000000'],new_code:f.sent[phone],studentId:99,uid:'changed'}),phone);
 assert.deepEqual(f.writes,[{sql:'UPDATE students SET phone=? WHERE id=?',args:[phone,7]}]);assert.throws(()=>f.service.change(7,{new_phone:'13600000000',old_code:f.sent['13800000000'],new_code:f.sent[phone]}));
});
test('rejects reused phones, excessive requests, expired codes and unconfigured formal SMS',async()=>{
 const f=fixture(),phone='13700000000';await assert.rejects(f.service.send(7,'new','13900000000'));
 await f.service.send(7,'old',phone);await assert.rejects(f.service.send(7,'old',phone),/60秒/);await f.service.send(7,'new',phone);f.advance(300001);
 assert.throws(()=>f.service.change(7,{new_phone:phone,old_code:f.sent['13800000000'],new_code:f.sent[phone]}));assert.equal(f.writes.length,0);
 const unavailable=fixture(false);await assert.rejects(unavailable.service.send(7,'old',phone),/正式短信/);assert.equal(unavailable.writes.length,0);
});

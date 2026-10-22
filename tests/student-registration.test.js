const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const identity=require('../lib/student-registration-identity');
test('phone registration and first code login create nickname/UID/phone and leave other details empty',()=>{
 const source=fs.readFileSync(require.resolve('../routes/student-auth'),'utf8');
 for(const url of ['/auth/register','/auth/login-code']){
  let handler,row=null,inserts=0;
  const phone='13800000000',smsCodes={[phone]:{code:'123456',expiresAt:Date.now()+60000}};
  const db={get(sql){return sql.includes('WHERE uid=')?null:row;},saveDb(){},run(sql,args){inserts++;const cols=sql.match(/students \(([^)]+)\)/)[1].split(',').map(x=>x.trim());row=Object.fromEntries(cols.map((c,i)=>[c,args[i]]));row.id=7;}};
  const start=source.indexOf("router.post('"+url+"'"),end=source.indexOf('\n});',start)+5;
  new Function('router','db','smsCodes','bcrypt','generateUsername','registrationIdentity',source.slice(start,end))({post:(url,fn)=>handler=fn},db,smsCodes,{hashSync:()=> 'hash'},()=> 'generated-user',identity);
  const session={};let response;
  handler({session,body:{phone,code:'123456',password:'password',name:'Injected name',uid:'Injected UID',nickname:'Injected nickname'}},{json:value=>response=value});
  assert(response.success);assert.equal(inserts,1);assert.equal(row.name,'');assert.equal(row.nickname,'学员0000');assert.equal(row.phone,phone);assert(/^CZ[0-9A-F]{16}$/.test(row.uid));assert.equal(session.studentId,7);
  for(const key of ['recipient_name','recipient_phone','recipient_address','province_code','exam_year'])assert.equal(row[key],undefined);
  assert.equal(smsCodes[phone],undefined);
  if(url.endsWith('login-code')){smsCodes[phone]={code:'123456',expiresAt:Date.now()+60000};const uid=row.uid;row.name='已填姓名';handler({session:{},body:{phone,code:'123456'}},{json:value=>response=value});assert.equal(inserts,1);assert.equal(row.uid,uid);assert.equal(row.name,'已填姓名');}
 }
});

const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ejs=require('ejs');
const tools=require('../lib/student-account-profile');
test('profile validates nickname, optional complete shipping address and raster avatar',()=>{
 const base={nickname:'学员',recipient_name:'',recipient_phone:'',recipient_address:''};
 assert.equal(tools.accountDetails(base).nickname,'学员');
 assert.throws(()=>tools.accountDetails({...base,nickname:''}));
 assert.throws(()=>tools.accountDetails({...base,recipient_name:'收件人'}));
 assert.throws(()=>tools.accountDetails({...base,nickname:'a'.repeat(31)}));
 assert.equal(tools.accountDetails({...base,recipient_name:'收件人',recipient_phone:'13800000000',recipient_province:'37',recipient_city:'3701',recipient_district:'370102',recipient_address_detail:'测试街道1号'}).recipient_phone,'13800000000');
 assert.throws(()=>tools.accountDetails({...base,recipient_name:'收件人',recipient_phone:'13800000000',recipient_province:'37',recipient_city:'1101',recipient_district:'110101',recipient_address_detail:'测试街道'}));
 assert.equal(tools.avatarExtension(Buffer.from('<svg onload="alert(1)"></svg>')),null);
 assert.equal(tools.avatarExtension(Buffer.alloc(2*1024*1024+1)),null);
 assert.equal(tools.avatarExtension(Buffer.from([255,216,255,224,0,0,0,0,0,0,255,217])),'.jpg');
});
test('account and avatar writes use only the authenticated student ID',()=>{
 const source=fs.readFileSync(require.resolve('../routes/student-auth'),'utf8');
 const code=source.slice(source.indexOf('function requireStudentProfile'),source.indexOf('// Bind study preferences'));
 const routes={},writes=[],files=[];
 vm.runInNewContext(code,{router:{post:(url,...handlers)=>routes[url]=handlers},db:{get:()=>({id:7}),run:(sql,args)=>writes.push({sql,args})},profileTools:tools,path,__dirname:path.resolve('routes'),crypto:{randomUUID:()=> 'test-avatar'},fs:{mkdirSync(){},writeFileSync:(file)=>files.push(file),unlinkSync(){}},avatarUpload:(req,res,next)=>next()});
 function request(url,session,body,file){const req={session,body,file};let status=200,result;const res={status(n){status=n;return this;},json(value){result=value;return this;}};const [gate,handler]=routes[url];gate(req,res,()=>handler(req,res));return {status,result};}
 assert.equal(request('/auth/account-details',{},{}).status,401);assert.equal(writes.length,0);
 assert.equal(request('/auth/account-details',{studentId:7},{nickname:'昵称',recipient_name:'',recipient_phone:'',recipient_address:'',studentId:999}).status,200);
 assert.equal(writes[0].args.at(-1),7);
 assert.equal(request('/auth/avatar',{studentId:7},{},{buffer:Buffer.from('<svg></svg>')}).status,400);assert.equal(files.length,0);
 assert.equal(request('/auth/avatar',{studentId:7},{studentId:999},{buffer:Buffer.from([255,216,255,224,0,0,0,0,0,0,255,217])}).status,200);
 assert.equal(writes[1].args[1],7);assert(files[0].endsWith('test-avatar.jpg'));
});
test('profile renders escaped editable details, shipping fields and saved avatar',async()=>{
 const html=await ejs.renderFile(path.resolve('views/student/account-views.ejs'),{student:{name:'姓名',nickname:'<昵称>',avatar:'/public/images/student-avatars/test.jpg',recipient_name:'收件人',recipient_address:'<地址>',exam_year:'2027'},provinces:[],myList:[],courseDetails:{}});
 assert(html.includes('value="&lt;昵称&gt;"'));assert(html.includes('&lt;地址&gt;</textarea>'));assert(html.includes('id="studentAvatarFile"'));assert(html.includes('/public/images/student-avatars/test.jpg'));
 const home=fs.readFileSync(path.resolve('views/student/home.ejs'),'utf8');const trigger=home.match(/<button[^>]*id="studentAccountTrigger"[\s\S]*?<\/button>/)[0];assert(!trigger.includes('u-name'));
});

test('combined save validates study preferences before any profile write',()=>{const db={get:(sql,args)=>args[0]==='sd'?{code:'sd'}:null};assert.deepEqual(tools.studyDetails(db,{province_code:'sd',exam_year:'2027'}),{province_code:'sd',exam_year:'2027'});assert.throws(()=>tools.studyDetails(db,{province_code:'sd',exam_year:'bad'}));assert.throws(()=>tools.studyDetails(db,{province_code:'bad',exam_year:'2027'}));assert.deepEqual(tools.studyDetails(db,{province_code:'',exam_year:''}),{province_code:'',exam_year:''});});

test('education details accept optional text and reject oversized or non-text values',()=>{const base={nickname:'学员',recipient_name:'',recipient_phone:''};const saved=tools.accountDetails({...base,junior_college:'专科院校',junior_major:'计算机专业'});assert.equal(saved.junior_college,'专科院校');assert.equal(saved.junior_major,'计算机专业');assert.throws(()=>tools.accountDetails({...base,junior_college:[]}));assert.throws(()=>tools.accountDetails({...base,junior_major:'a'.repeat(101)}));});

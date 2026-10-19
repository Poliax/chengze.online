const test = require('node:test');
const assert = require('node:assert/strict');
const primarySite = require('../middleware/primary-site');
test('旧官网和学习中心地址直接停用且不再重定向', () => {
  for (const path of ['/learning', '/learning/', '/learning-center', '/index.html', '/about', '/contact', '/feedback', '/courses', '/teachers', '/site/index.html', '/public/site/learning.html', '/site/', '/public/site/about.html']) {
    for (const method of ['GET', 'HEAD']) {
      let result;
      primarySite({method, path, originalUrl:path+'?province=37'}, {status:(status)=>({type:()=>({send:()=>{result={status};}})})}, ()=>assert.fail(path));
      assert.deepEqual(result, {status:404});
    }
  }
});
test('主站、课堂、登录、后台及资源路径不受旧官网跳转影响', () => {
  for (const path of ['/', '/student/login', '/student/course/44', '/live/api/clock/44', '/admin/courses-manage', '/teaching/login', '/public/images/brand-green/app-rounded.png']) {
    let passed=false;
    primarySite({method:'GET', path, originalUrl:path}, {redirect:()=>assert.fail(path)}, ()=>{passed=true;});
    assert.ok(passed, path);
  }
});

test('学员页面以www为标准地址，后台、API和回调保持原入口',()=>{
 for(const [hostname,method,path,accept,expected] of [
  ['chengze.online','GET','/','',true],
  ['chengze.online','HEAD','/?from=bookmark','',true],
  ['chengze.online','GET','/student/orders','text/html',true],
  ['www.chengze.online','GET','/','text/html',false],
  ['admin.chengze.online','GET','/login','text/html',false],
  ['chengze.online','POST','/student/login','text/html',false],
  ['chengze.online','GET','/live/api/clock/1','text/html',false],
  ['chengze.online','GET','/api/schedule/37','application/json',false]
 ]){
  let redirected=false,passed=false;
  primarySite({hostname,method,path:path.split('?')[0],originalUrl:path,headers:{accept}},
   {redirect:(status,url)=>{redirected=true;assert.equal(status,308);assert.equal(url,'https://www.chengze.online'+path)}},()=>{passed=true});
  assert.equal(redirected,expected);assert.equal(passed,!expected);
 }
});

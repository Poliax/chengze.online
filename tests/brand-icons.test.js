const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const express=require('express'),ejs=require('ejs');
const icons=require('../lib/brand-icons');
const project=path.join(__dirname,'..');

test('all page templates use the one original icon declaration',async()=>{
 const partial=path.join(project,'views/partials/brand-icons.ejs');
 assert.equal((await ejs.renderFile(partial,{})).trim(),icons.markup);
 assert.equal(require('../middleware/admin-domain').backendTypography('<head></head>').match(/rel="icon"/g).length,2);
 function visit(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){
  const file=path.join(folder,entry.name);
  if(entry.isDirectory())visit(file);
  else if(entry.name.endsWith('.ejs')){
   const source=fs.readFileSync(file,'utf8');
   if(file!==partial)assert(!/<link\b[^>]*\brel=["'](?:icon|shortcut icon|apple-touch-icon|mask-icon)/i.test(source),file);
   ejs.compile(source,{filename:file});
   if(source.includes("partials/brand-icons'")){
    const target=source.match(/include\('([^']*partials\/brand-icons)'/)[1];
    assert.equal(path.resolve(path.dirname(file),target+'.ejs'),partial,file);
   }
  }
 }}
 visit(path.join(project,'views'));
 for(const file of icons.canonical)assert(fs.existsSync(path.join(project,file.slice(1))));
});

test('legacy and trial icon URLs return original bytes on every site; test page is retired',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'chengze-brand-icons-'));
 const fixture=new Map([[icons.ico,'original ico'],[icons.png,'original png'],[icons.touch,'original touch'],['/public/images/brand-green/app-rounded.svg','<svg>original</svg>']]);
 for(const [file,body] of fixture){const p=path.join(root,file.slice(1));fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,body);}
 const app=express();app.use(require('../middleware/static-files')(root));
 const server=app.listen(0,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
 t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});});
 const request=(url,host)=>new Promise((resolve,reject)=>{
  http.get({hostname:'127.0.0.1',port:server.address().port,path:url,headers:{host}},res=>{
   const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString()}));
  }).on('error',reject);
 });
 const legacy=fs.readdirSync(project).filter(n=>/^favicon.*\.(?:png|ico|svg)$/.test(n)).map(n=>'/'+n);
 legacy.push('/apple-touch-icon.png','/apple-touch-icon-precomposed.png',
  '/public/images/brand-green/backend-contrast-20261020.ico',
  '/public/images/brand-green/backend-contrast-20261020-32.png',
  '/public/images/brand-green/backend-contrast-20261020-180.png',
  '/public/images/brand-green/backend-solid-20261019.ico',
  '/public/images/brand-green/backend-icon-20261019-32.png',
  '/public/images/brand-green/favicon-compact-test-20261020-32.png');
 for(const host of ['chengze.online','www.chengze.online','admin.chengze.online']){
  for(const url of legacy){const target=icons.legacyTarget(url);assert(target,url);const r=await request(url,host);assert.equal(r.status,200,url);assert.equal(r.body,fixture.get(target),url);assert.equal(r.headers['cache-control'],'no-store');assert.equal(r.headers['x-content-type-options'],'nosniff');}
  for(const url of icons.canonical){const r=await request(url,host);assert.equal(r.body,fixture.get(url));assert.equal(r.headers['cache-control'],'public, max-age=31536000, immutable');}
  assert.equal((await request('/public/provinces/favicon-check-20261020.html',host)).status,410);
 }
 assert.equal(icons.legacyTarget('/public/images/brand-green/app-rounded.png'),null,'in-page logo unchanged');
 assert.equal(icons.legacyTarget('/public/images/teachers/avatar.png'),null,'unrelated images unchanged');
 assert.equal((await request('/favicon/../../server.js','admin.chengze.online')).status,404);
});

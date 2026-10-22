const express=require('express'),path=require('path'),fs=require('fs');
const brandIcons=require('../lib/brand-icons');
const extensions=new Set(['.css','.js','.png','.jpg','.jpeg','.gif','.webp','.svg','.ico','.woff','.woff2','.ttf','.eot','.mp4','.webm','.mp3','.wav','.pdf','.doc','.docx']);
module.exports=function publicAssets(root){
 const router=express.Router();
 router.use((req,res,next)=>{
  if(req.path==='/public/provinces/favicon-check-20261020.html')return res.status(410).set('Cache-Control','no-store').type('text/plain').send('图标测试页已停用');
  const legacy=brandIcons.legacyTarget(req.path);
  if(legacy || brandIcons.canonical.has(req.path)){
   res.set('X-Content-Type-Options','nosniff');
   res.set('Cache-Control',legacy?'no-store':'public, max-age=31536000, immutable');
   return res.sendFile(path.join(root,(legacy||req.path).slice(1)),{cacheControl:false});
  }
  next();
 });
 function mount(prefix,folder,html=false,pdfOnly=false){
  const base=path.join(root,folder),serve=express.static(base,{dotfiles:'deny',index:false,setHeaders(res){res.setHeader('X-Content-Type-Options','nosniff');}});
  router.use(prefix,(req,res,next)=>{
   let name;try{name=decodeURIComponent(req.path)}catch{return res.sendStatus(400)}
   if(name.split(/[\\/]/).some(p=>p.startsWith('.')||p==='..'))return res.sendStatus(404);
   const ext=path.extname(name).toLowerCase();
   if(pdfOnly?ext!=='.pdf':!extensions.has(ext)&&!(html&&ext==='.html'))return next();
   const file=path.resolve(base,'.'+name);
   try{const real=fs.realpathSync(file),canonical=fs.realpathSync(base);if(!real.startsWith(canonical+path.sep))return res.sendStatus(404);}catch{return next()}
   serve(req,res,next);
  });
 }
 for(const directory of ['css','js','assets','player'])mount('/'+directory,directory);
 for(const directory of ['css','images','materials','courseware','recordings','live','provinces'])mount('/public/'+directory,'public/'+directory,['site','provinces'].includes(directory));
 mount('/materials','public/materials');mount('/courseware','public/courseware');mount('/recordings','public/recordings');mount('/data','data',false,true);
 return router;
};

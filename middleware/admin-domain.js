// Public URL layout only. Existing authentication and permissions remain in charge.
const HOST='admin.chengze.online';
const routes=[
 ['/admin/live/studio','/studio'],['/admin/course-materials','/course-materials'],
 ['/admin/accounts-manage','/accounts'],['/admin/technical-center','/technical-center'],
 ['/admin/packages-manage','/packages'],['/admin/courses-manage','/courses'],
 ['/admin/teachers-manage','/teachers'],['/admin/assistants-manage','/assistants'],
 ['/admin/provinces-manage','/provinces'],['/admin/students-manage','/students'],
 ['/admin/users-manage','/users'],['/admin/orders-manage','/orders'],
 ['/admin/logistics-manage','/logistics'],['/admin/live-manage','/live'],
 ['/admin/replays-manage','/replays'],['/admin/research-manage','/research'],
 ['/admin/questions-manage','/questions'],['/admin/ads-manage','/ads']
];
function external(url) {
 if(typeof url!=='string')return url;
 const prefix='https://'+HOST;
 const absolute=url.startsWith(prefix+'/');
 let value=absolute?url.slice(prefix.length):url;
 if(!/^\/admin(?:[/?#]|$)/.test(value))return url;
 for(const [internal,publicPath] of routes)if(value===internal || value.startsWith(internal+'/') || value.startsWith(internal+'?') || value.startsWith(internal+'#'))return (absolute?prefix:'')+publicPath+value.slice(internal.length);
 value=value.replace(/^\/admin(?=[/?#]|$)/,'');
 return (absolute?prefix:'')+(value||'/');
}
function htmlURLs(html) {
 // Match URL tokens in HTML attributes and inline scripts, preserving unrelated prose.
 return html.replace(/\/admin(?:\/[A-Za-z0-9_./%:-]*)?(?:\?[^\s"'<>`]*)?/g,url=>external(url));
}
function wrapRender(req,res,transform,next) {
 const render=res.render.bind(res);
 res.render=function(view,options,callback){
  if(typeof options==='function'){callback=options;options={};}
  return render(view,options||{},(error,html)=>{
   if(error){if(callback)return callback(error);return next(error);}
   const result=transform(html);
   if(callback)return callback(null,result);
   res.send(result);
  });
 };
}
function teachingExternal(url) {
 if(typeof url!=='string')return url;
 if(url==='/admin/login')return '/teaching/login';
 if(url==='/admin/live-manage')return '/teaching';
 return url.replace(/^\/teach\/live\/studio(?=[/?#]|$)/,'/teaching/studio').replace(/^\/admin\/live\/studio(?=[/?#]|$)/,'/teaching/studio').replace(/^\/admin\/live-manage(?=[/?#]|$)/,'/teaching/live-manage').replace(/^\/teach(?=[/?#]|$)/,'/teaching');
}
function teachingURLs(html) {
 return html.replace(/\/(?:admin\/live\/studio|admin\/live-manage|teach)(?=[/?#\s"'<>`]|$)(?:\/[A-Za-z0-9_./%:-]*)?(?:\?[^\s"'<>`]*)?/g,url=>teachingExternal(url));
}
function teaching(req,res,next) {
 if(/^\/teaching\/live\/studio(?:\/|$)/.test(req.path))return res.redirect(308,req.url.replace('/teaching/live/studio','/teaching/studio'));
 const redirect=res.redirect.bind(res);
 res.redirect=(status,url)=>typeof status==='string'?redirect(teachingExternal(status)):redirect(status,teachingExternal(url));
 const render=res.render.bind(res);
 res.render=(view,options,callback)=>render(view,view==='teacher/live-studio'?{...options,backUrl:'/teaching'}:options,callback);
 wrapRender(req,res,teachingURLs,next);
 if(/^\/teaching\/studio(?:\/|$)/.test(req.path))req.url=req.url.replace(/^\/teaching\/studio/,'/admin/live/studio');
 else if(/^\/teaching\/live-manage\/[1-9]\d*\/status\/?$/.test(req.path))req.url=req.url.replace(/^\/teaching/,'/admin');
 else req.url=req.url.replace(/^\/teaching/,'/teach');
 next();
}
function middleware(req,res,next) {
 if(req.hostname!==HOST) {
  // Redirect old teaching pages, while preserving authenticated classroom API compatibility.
  if(['chengze.online','www.chengze.online'].includes(req.hostname) && /^\/teach(?:\/?|\/login\/?|\/logout\/?|\/calendar\/?|\/profile\/?|\/live\/[1-9]\d*\/?|\/live\/studio\/[1-9]\d*\/?)$/.test(req.path))return res.redirect(308,'https://'+HOST+teachingExternal(req.url));
  return next();
 }
 if(/^\/teaching(?:\/|$)/.test(req.path))return teaching(req,res,next);
 if(/^\/teach(?:\/|$)/.test(req.path))return res.redirect(308,teachingExternal(req.url));
 if(/^\/admin(?:\/|$)/.test(req.path))return res.redirect(308,external(req.url));
 // Assets and shared classroom APIs keep their existing application URLs.
 if(/^\/(?:css|js|assets|player|public|socket\.io|recordings|courseware|data|materials)(?:\/|$)/.test(req.path) || /^\/(?:favicon[^/]*|apple-touch-icon[^/]*)\.(?:png|ico|svg)$/.test(req.path) || /^\/live\/(?:api|student)\//.test(req.path))return next();
 const redirect=res.redirect.bind(res);
 res.redirect=function(status,url){if(typeof status==='string')return redirect(external(status));return redirect(status,external(url));};
 wrapRender(req,res,htmlURLs,next);
 for(const [internal,publicPath] of routes)if(req.path===publicPath || req.path.startsWith(publicPath+'/')){req.url=internal+req.url.slice(publicPath.length);return next();}
 if(req.path==='/')req.url='/admin/dashboard'+(req.url.includes('?')?req.url.slice(req.url.indexOf('?')):'');
 else req.url='/admin'+req.url;
 next();
}
function portal(req,res,next) {
 if(!/^\/(?:live\/studio\/[1-9]\d*(?:\/(?:upload|state|upload-status\/[^/]+))?|live-manage\/[1-9]\d*\/status)\/?$/.test(req.path))return next();
 const redirect=res.redirect.bind(res);
 res.redirect=(status,url)=>{if(typeof status==='string')return redirect(status==='/admin/login'?'/teach/login':status);return redirect(status,url==='/admin/login'?'/teach/login':url);};
 const render=res.render.bind(res);
 res.render=(view,options,callback)=>render(view,{...options,backUrl:'/teach'},callback);
 wrapRender(req,res,html=>html.replaceAll('/admin/','/teach/'),next);
 return require('../routes/live-admin')(req,res,next);
}
module.exports=middleware;
module.exports.external=external;
module.exports.teachingExternal=teachingExternal;
module.exports.teachingURLs=teachingURLs;
module.exports.htmlURLs=htmlURLs;
module.exports.portal=portal;

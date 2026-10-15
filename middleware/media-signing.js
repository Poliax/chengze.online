const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const TTL = 6 * 60 * 60;
function signUrl(value, config, now = Math.floor(Date.now()/1000), nonce = crypto.randomBytes(8).toString('hex'), rlimit = '2') {
 if(typeof value!=='string')return value;
 let url;try{url=new URL(value)}catch{return value}
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return value;
 const item=(config.mediaSigning && config.mediaSigning.domains || {})[url.hostname];
 if(!item)return value;
 if(typeof item.key!=='string'||item.key.length<16)throw new Error('Media signing key unavailable');
 if(item.type==='live') {
   const stream=url.pathname.split('/').pop().replace(/\.(?:flv|m3u8)$/i,'');
   if(!stream)throw new Error('Live stream name unavailable');
   const txTime=(now+TTL).toString(16);
   url.searchParams.set('txTime',txTime);
   url.searchParams.set('txSecret',crypto.createHash('md5').update(item.key+stream+txTime).digest('hex'));
   return url.toString();
 }
 if(item.type!=='vod')throw new Error('Unsupported media signing provider');
 // Tencent VOD signs the directory, so HLS segment URLs can retain the same token.
 const dir=url.pathname.slice(0,url.pathname.lastIndexOf('/')+1);
 const t=(now+TTL).toString(16);
 for(const name of ['sign','t','exper','rlimit','us','whref','bkref','whreg','bkreg','uv','plive'])url.searchParams.delete(name);
 url.searchParams.set('t',t);url.searchParams.set('rlimit',rlimit);url.searchParams.set('us',nonce);
 url.searchParams.set('sign',crypto.createHash('md5').update(item.key+dir+t+rlimit+nonce).digest('hex'));
 return url.toString();
}
function map(value, config) {
 if(typeof value==='string')return signUrl(value,config);
 if(Array.isArray(value))return value.map(v=>map(v,config));
 if(value && typeof value==='object' && Object.getPrototypeOf(value)===Object.prototype)return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,map(v,config)]));
 return value;
}
function jsonForScript(value){return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));}
module.exports=function mediaSigning(req,res,next){
 const config=()=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','live-config.json'),'utf8'));
 res.locals.jsonForScript=jsonForScript;
 res.locals.signMediaUrl=value=>signUrl(value,config());
 const render=res.render.bind(res), json=res.json.bind(res);
 res.render=(view,data,...rest)=>{
  if(['student/live-watch','student/watch','student/vod-replay','student/replay-duo','teacher/replay-duo','teacher/live-replay'].includes(view)){
   res.set('Cache-Control','private, no-store, max-age=0');res.vary('Cookie');data=map(data,config());
  }
  return render(view,data,...rest);
 };
 res.json=(data)=>{
  if(/^\/live\/(?:student\/api\/(?:courses\/|lessons\/|lesson\/)|api\/(?:recordings\/|live-status\/))/.test((req.originalUrl || req.path).split('?')[0])){
   res.set('Cache-Control','private, no-store, max-age=0');res.vary('Cookie');data=map(data,config());
  }
  return json(data);
 };
 next();
};
module.exports.signUrl=signUrl;module.exports.map=map;module.exports.jsonForScript=jsonForScript;

const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const playback=require('../lib/replay-playback');

test('legacy local files use the current video player without rewriting records',()=>{
 for(const file of ['recording.mp4','recording.webm','录制 1.mp4']){
  const record={id:1,course_id:7,recorded_file:file,video_url:'',slide_timeline:'[]'};
  const before=JSON.stringify(record),result=playback(record);
  assert.equal(result.replay.video_url,'/recordings/'+encodeURIComponent(file));assert.equal(result.playbackUnavailable,'');assert.equal(JSON.stringify(record),before);
 }
 const modern={video_url:'https://media.example/video.mp4',recorded_file:'old.webm'};
 assert.equal(playback(modern).replay.video_url,modern.video_url);
 for(const file of ['../private.mp4','folder/video.mp4','folder\\video.mp4','file\u0000.mp4'])assert.equal(playback({recorded_file:file}).replay.video_url,'');
 assert(playback({slide_timeline:'[{"time":1}]'}).playbackUnavailable.includes('仅包含板书时间线'));
 assert(playback({slide_timeline:'broken'}).playbackUnavailable.includes('暂未生成'));
});

function fixture(){
 const records={1:{id:1,course_id:7,title:'视频',video_url:'https://media.example/video.mp4'},2:{id:2,course_id:7,title:'本地录制',recorded_file:'local.webm'},3:{id:3,course_id:7,title:'时间线',slide_timeline:'[{"time":1}]'},4:{id:4,course_id:8,title:'其他课程',video_url:'https://media.example/other.mp4'}};
 const db={get(sql,args){
  if(sql.includes('FROM live_replays'))return records[args[0]]||null;
  if(sql.startsWith('SELECT * FROM courses WHERE id'))return [7,8].includes(Number(args[0]))?{id:Number(args[0]),status:'published',teacher_id:2}:null;
  if(sql.includes('FROM students'))return {id:args[0],status:'active'};
  if(sql.includes('FROM enrollments'))return args[0]===9&&args[1]===7?{id:1}:null;
  return null;
 }};
 const accessModule={exports:{}};
 new Function('require','module',fs.readFileSync(path.join(__dirname,'../middleware/course-access.js'),'utf8'))(name=>{if(name==='../db')return db;throw Error('unexpected dependency '+name);},accessModule);
 const source=fs.readFileSync(path.join(__dirname,'../routes/live.js'),'utf8'),routes={};
 const router={get(url,...handlers){routes[url]=handlers;}};
 for(const url of ['/student/replay/:replayId','/student/vod-replay/:id','/student/live-watch/:courseId']){
  const start=source.indexOf("router.get('"+url+"'"),end=source.indexOf('\n});',start)+5;
  assert(start>=0&&end>start);new Function('router','access','db','replayPlayback',source.slice(start,end))(router,accessModule.exports,db,playback);
 }
 function call(url,id,studentId){
  const req={params:{replayId:String(id),id:String(id),courseId:String(id)},session:studentId?{studentId}:{},query:{}};
  const res={code:200,headers:{},status(n){this.code=n;return this;},json(body){this.body=body;return this;},set(k,v){this.headers[k]=v;return this;},vary(){},redirect(url){this.code=302;this.location=url;},render(view,data){this.view=view;this.data=data;}};
  let index=0;function next(){const handler=routes[url][index++];if(handler)handler(req,res,next);}next();return res;
 }
 return {call,source};
}

test('old replay links retain enrollment checks and redirect into current player',()=>{
 const f=fixture(),old='/student/replay/:replayId',current='/student/vod-replay/:id';
 assert.equal(f.call(old,1,9).location,'/live/student/vod-replay/1');
 for(const url of [old,current]){
  assert.equal(f.call(url,1,null).code,401);assert.equal(f.call(url,1,10).code,403);assert.equal(f.call(url,4,9).code,403);assert.equal(f.call(url,0,9).code,404);
 }
 assert.equal(f.call(current,2,9).data.replay.video_url,'/recordings/local.webm');
 assert.equal(f.call(current,3,9).view,'student/vod-replay');assert(f.call(current,3,9).data.playbackUnavailable.includes('暂无回放视频'));
 assert.equal(f.call('/student/live-watch/:courseId',7,9).view,'student/live-watch','student live viewer remains separate and accessible');
 assert(!f.source.includes("res.render('student/replay'"));
 assert(!fs.existsSync(path.join(__dirname,'../views/student/replay.ejs')));
});

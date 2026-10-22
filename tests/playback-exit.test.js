const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),ejs=require('ejs');
test('playback headers place the kind after the course title and render no exit control',async()=>{
 const base={title:'课程回放',course:{id:1,title:'2027山东专升本英语'},lessonTitle:'基础阶段-第1讲',courseTitle:'2027山东专升本英语',main:{video_url:''},cam:null,chatLog:'[]',timeline:[],jsonForScript:JSON.stringify};
 for(const [name,file] of [['replay-duo',''],['vod-replay','']]){
  const replay={id:1,course_id:1,title:'基础阶段-第1讲',recorded_file:file,video_url:'',vod_file_id:''};
  const html=await ejs.renderFile(path.join(__dirname,'../views/student/'+name+'.ejs'),{...base,replay});
  assert(/class="playback-course-title"[\s\S]*?class="playback-kind">课程回放<\/span>/.test(html),name);
  assert(!html.includes('课程回放端'));assert(!html.includes('data-playback-exit'));assert(!html.includes('/js/playback-exit.js'));assert(!html.includes('返回课程'));
  assert(html.includes('/public/images/brand-green/online-light.svg'));
 }
});

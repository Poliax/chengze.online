const path=require('node:path');

// Adapt legacy metadata at read time; never rewrite or delete stored recordings.
module.exports=function replayPlayback(record){
 let video=record.video_url||'';
 const file=record.recorded_file;
 if(!video&&typeof file==='string'&&file&&file===path.basename(file)&&!/[\\/\x00-\x1f]/.test(file)&&/\.(?:mp4|webm)$/i.test(file)){
  video='/recordings/'+encodeURIComponent(file);
 }
 let timeline=[];
 try{timeline=JSON.parse(record.slide_timeline||'[]');}catch{}
 return {
  replay:{...record,video_url:video},
  playbackUnavailable:video?'':Array.isArray(timeline)&&timeline.length
   ?'这条历史记录仅包含板书时间线，暂无回放视频。'
   :'回放视频暂未生成。'
 };
};

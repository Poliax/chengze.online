const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../views/teacher/live-studio.ejs'),'utf8');
const block=source.slice(source.indexOf('    var screenStream = null;'),source.indexOf('    var liveStartTs ='));
function fixture(capture){
 const messages=[],listeners={},buttons={};
 const makeButton=id=>({id,classList:{toggle(){},remove(){}},setAttribute(){},addEventListener:(name,fn)=>listeners[id+':'+name]=fn});
 ['modeWb','modeCw','modeShare','catPen'].forEach(id=>buttons[id]=makeButton(id));
 const track={readyState:'live',stop(){this.readyState='ended';this.stopped=true;}};
 const stream={getVideoTracks:()=>[track],getTracks:()=>[track]};
 const preview={firstChild:{},appendChild(v){v.parentNode=this;}};
 const video={readyState:2,videoWidth:1920,videoHeight:1200,style:{},setAttribute(){},play:async()=>{},pause(){},remove(){this.removed=true;}};
 const context={navigator:{mediaDevices:{getDisplayMedia:capture|| (async()=>stream)}},document:{getElementById:id=>id==='localPreview'?preview:buttons[id],querySelectorAll:()=>Object.values(buttons),createElement:()=>video,body:{appendChild(){}}},window:{addEventListener(){}},wbBtn:buttons.modeWb,cwBtn:buttons.modeCw,mode:'whiteboard',publishing:true,localStream:{replaceTrack(){throw Error('Must not replace the ongoing canvas stream');}},setMsg:(m)=>messages.push(m),drawFrame(){context.frames=(context.frames||0)+1;},initCanvasPreview(){},publishCanvas:{captureStream:()=>({getVideoTracks:()=>[{readyState:'live',clone:()=>({kind:'video',cloned:true})}],getTracks:()=>[]})},closePops(){}};
 vm.createContext(context);vm.runInContext(block,context);return {context,track,stream,video,messages,buttons};
}
test('正在上课时启用共享，保留同一路主流和麦克风',async()=>{
 const f=fixture(),main=f.context.localStream;await f.context.startScreenShare();assert.equal(f.context.sharing,true);assert.equal(f.context.localStream,main);assert.equal(f.track.stopped,undefined);assert.equal(f.buttons.catPen.disabled,true);assert(f.messages.some(m=>m.includes('学生端已同步')));
 f.context.stopScreenShare();assert.equal(f.context.sharing,false);assert.equal(f.track.stopped,true);assert.equal(f.video.removed,true);assert.equal(f.buttons.catPen.disabled,false);assert.equal(f.context.localStream,main);
});
test('开课前先选择屏幕，提示仍需开始上课',async()=>{const f=fixture();f.context.publishing=false;await f.context.startScreenShare();assert(f.messages.some(m=>m.includes('开始上课')));});
test('不支持的 iPad 浏览器明确说明限制而不抛异常',async()=>{const f=fixture();delete f.context.navigator.mediaDevices.getDisplayMedia;await f.context.startScreenShare();assert.equal(f.context.sharing,false);assert(f.messages.some(m=>m.includes('iPad')));});
test('用户取消选择不改变原授课模式',async()=>{const f=fixture(async()=>{throw Object.assign(Error('cancel'),{name:'NotAllowedError'});});await f.context.startScreenShare();assert.equal(f.context.sharing,false);assert.equal(f.context.screenShareBusy,false);assert(f.messages.some(m=>m.includes('未开始共享')));});
test('浏览器停止共享时释放屏幕并恢复授课画面',async()=>{const f=fixture();await f.context.startScreenShare();const ended=f.track.onended;f.track.readyState='ended';ended();assert.equal(f.context.sharing,false);assert.equal(f.context.screenStream,null);assert.equal(f.track.stopped,true);});
test('选择窗口期间重复点击仅请求一次授权',async()=>{let resolve,calls=0;const f=fixture(()=>{calls++;return new Promise(r=>resolve=r);});const first=f.context.startScreenShare();assert.equal(f.context.screenShareBusy,true);await f.context.startScreenShare();assert.equal(calls,1);resolve(f.stream);await first;assert.equal(f.context.sharing,true);assert.equal(f.buttons.modeShare.disabled,false);});
test('预览播放失败释放捕获，不误报共享成功',async()=>{const f=fixture();f.video.play=async()=>{throw Error('play failed');};await f.context.startScreenShare();assert.equal(f.context.sharing,false);assert.equal(f.track.stopped,true);assert.equal(f.video.removed,true);assert(f.messages.some(m=>m.includes('失败')));});
test('屏幕用等比留边绘制，不把宽屏或竖屏内容拉伸',async()=>{const f=fixture();await f.context.startScreenShare();let args;f.context.renderSharedScreen({fillRect(){},drawImage(...a){args=a;}},1920,1080);assert.equal(args[1],96);assert.equal(args[2],0);assert.equal(args[3],1728);assert.equal(args[4],1080);});
test('主画布仅捕获一次，SDK持有独立视频轨道',()=>{const f=fixture();let count=0;const old=f.context.publishCanvas.captureStream;f.context.publishCanvas.captureStream=()=>{count++;return old();};const a=f.context.getCanvasPublishTrack(),b=f.context.getCanvasPublishTrack();assert.equal(count,1);assert.notEqual(a,b);assert(a.cloned&&b.cloned);});
test('共享期间切回白板先停止捕获',async()=>{const f=fixture();await f.context.startScreenShare();Object.assign(f.context,{updatePageUI(){},updateToolCursor(){},saveStudioState(){}});const code=source.slice(source.indexOf('    function setMode('),source.indexOf('    var stageBadge'));vm.runInContext(code,f.context);f.context.setMode('whiteboard');assert.equal(f.context.sharing,false);assert.equal(f.context.mode,'whiteboard');assert.equal(f.track.stopped,true);});

test('授权等待期间取消共享，迟到的捕获结果会释放',async()=>{let resolve;const f=fixture(()=>new Promise(r=>resolve=r));const pending=f.context.startScreenShare();f.context.stopScreenShare({silent:true});resolve(f.stream);await pending;assert.equal(f.context.sharing,false);assert.equal(f.track.stopped,true);assert.equal(f.context.screenShareBusy,false);});

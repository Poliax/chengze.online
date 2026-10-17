const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../views/teacher/live-studio.ejs'),'utf8');
const functions=source.slice(source.indexOf('    function initCanvasPreview()'),source.indexOf('    var camOn ='));
function fixture(getUserMedia){
 const canvas={style:{}},children=[],messages=[];
 const preview={appendChild(c){children.push(c);},set innerHTML(v){children.length=0;}};
 const context={canvas,CW:1920,CH:1080,cameraStream:null,document:{getElementById:id=>id==='localPreview'?preview:null},navigator:{mediaDevices:{getUserMedia}},setMsg:(...args)=>messages.push(args),drawFrame(){context.draws++;},draws:0};
 vm.createContext(context);vm.runInContext(functions,context);return {context,canvas,children,messages};
}
test('等待设备授权时白板已挂载且已绘制',()=>{
 const f=fixture(()=>new Promise(()=>{}));
 const start=source.slice(source.indexOf('    // Display the board'),source.indexOf('    (function loadStudioState()'));
 f.context.setMode=mode=>{assert.equal(mode,'whiteboard');f.context.drawFrame();};
 vm.runInContext(start,f.context);f.context.initCamera();
 assert.equal(f.children[0],f.canvas);assert(f.context.draws>0);
});
test('拒绝设备授权不移除或重新创建现有白板',async()=>{
 const f=fixture(()=>Promise.reject(Error('permission denied')));f.context.initCanvasPreview();
 await f.context.initCamera();assert.equal(f.children.length,1);assert.equal(f.children[0],f.canvas);assert.equal(f.context.draws,1);assert(f.messages.some(m=>m[0].includes('白板仍可正常使用')));
});

test('各尺寸下整体等比缩放、摄像头不超过220px且完整留在视口内',()=>{
 const code=source.slice(source.indexOf('    function fitStudioStage()'),source.indexOf('    var studioResizeFrame'));
 for(const [w,h] of [[1440,900],[1024,768],[768,1024],[820,600],[390,844],[2560,1440]]){
  const wrap={style:{}},status={style:{}};
  const context={window:{innerWidth:w,innerHeight:h},document:{querySelector:s=>({'.wrap':wrap,'.msgbar':status,'.topbar':{getBoundingClientRect:()=>({bottom:64})}})[s]}};
  vm.createContext(context);vm.runInContext(code,context);context.fitStudioStage();
  const scale=Number(wrap.style.transform.match(/scale\(([^)]+)\)/)[1]),left=parseFloat(wrap.style.left),top=parseFloat(wrap.style.top);
  assert(scale>0&&scale<=1.1);assert(200*scale<=220.00001);assert(left>=11.99);assert(left+1172*scale<=w-11.99);assert(top>=76);assert(top+540*scale<=h-35.99);assert.equal(parseFloat(status.style.width),1172*scale);
 }
});
test('缩放后的指针与文本坐标转换保持准确',()=>{
 const code=source.slice(source.indexOf('    function localCssPoint('),source.indexOf('    function updateToolCursor('));const c={};vm.createContext(c);vm.runInContext(code,c);
 for(const scale of [.4,.85,1,1.1]){
  const box={clientWidth:960,clientHeight:540,getBoundingClientRect:()=>({left:20,top:80,width:960*scale,height:540*scale})};
  const point=c.localCssPoint(box,20+300*scale,80+200*scale);assert(Math.abs(point.x-300)<.00001);assert(Math.abs(point.y-200)<.00001);
 }
});

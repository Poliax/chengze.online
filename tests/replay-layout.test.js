const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('replay keeps all three panels and playback controls within the viewport',()=>{
 const source=fs.readFileSync(require.resolve('../js/replay-layout.js'),'utf8');
 for(const [width,height] of [[1440,900],[1280,720],[820,1180],[390,844],[844,390]]){
  let hidden=false;const events={},style={};
  const page={style,querySelector:()=>({classList:{contains:()=>hidden}})};
  const window={innerWidth:width,innerHeight:height,addEventListener:(n,f)=>events[n]=f};
  vm.runInNewContext(source,{window,document:{querySelector:s=>s.includes('.page')?page:{getBoundingClientRect:()=>({bottom:64})}},requestAnimationFrame:f=>{f();return 0;}});
  function check(base){
   const scale=Number(style.transform.match(/scale\((.*)\)/)[1]),left=parseFloat(style.left),top=parseFloat(style.top);
   assert(left>=11.9);assert(top>=76);assert(left+base*scale<=width-11.9);assert(top+540*scale<=height-11.9);assert(200*scale<=220.01);
   assert.equal(style.width,base+'px');
  }
  check(1172);hidden=true;events.resize();check(960);
 }
});

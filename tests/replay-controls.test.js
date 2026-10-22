const test=require('node:test'),assert=require('node:assert/strict');
test('controls hide during playback and remain available for touch, pause, menus and keyboard',()=>{
 function el(){const classes=new Set();return {events:{},addEventListener(n,f){this.events[n]=f;},classList:{add:n=>classes.add(n),remove:n=>classes.delete(n),contains:n=>classes.has(n)}};}
 const stage=el(),controls=el(),video=el(),menu=el(),doc=el();let tick;
 stage.querySelector=()=>controls;controls.contains=x=>x===doc.activeElement&&!!x;
 doc.getElementById=id=>({mainBox:stage,mainVideo:video,rateMenu:menu}[id]);
 video.paused=true;
 require('../js/replay-controls')(doc,{clearTimeout(){},setTimeout(f){tick=f;return 1;},addEventListener(){}});
 const hidden=()=>controls.classList.contains('controls-hidden');
 tick();assert(!hidden());video.paused=false;video.events.play();tick();assert(hidden());
 stage.events.pointerdown();assert(!hidden());tick();assert(hidden());
 menu.classList.add('open');stage.events.pointermove();tick();assert(!hidden());menu.classList.remove('open');tick();assert(hidden());
 controls.events.pointerenter({pointerType:'mouse'});tick();assert(!hidden());controls.events.pointerleave();tick();assert(hidden());
 doc.activeElement={matches:()=>true};controls.events.focusin();tick();assert(!hidden());doc.activeElement=null;tick();assert(hidden());
 controls.events.pointerdown();tick();assert(!hidden());doc.events.pointerup();tick();assert(hidden());
 for(const name of ['click','input','change']){controls.events[name]();assert(!hidden());tick();assert(hidden());}
 video.paused=true;video.events.pause();tick();assert(!hidden());
});

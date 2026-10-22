const test=require('node:test'),assert=require('node:assert/strict');
const init=require('../js/admin-shell');
function fixture(matches=true){
 function element(){const events={},classes=new Set();return {events,dataset:{},hidden:true,attrs:{},focusCount:0,
  classList:{contains:c=>classes.has(c),toggle(c,on){if(on)classes.add(c);else classes.delete(c);}},
  addEventListener(type,handler){(events[type]||=([])).push(handler);},
  fire(type,event={}){for(const handler of events[type]||[])handler(event);},
  setAttribute(key,value){this.attrs[key]=value;},focus(){this.focusCount++;}};}
 const sidebar=element(),toggle=element(),overlay=element(),document=element(),window=element(),media=element();
 media.matches=matches;document.body=element();document.documentElement=element();
 document.getElementById=id=>({sidebar,adminMobileMenu:toggle,adminNavOverlay:overlay})[id];
 window.matchMedia=()=>media;
 init(document,window);
 return {sidebar,toggle,overlay,document,window,media};
}
test('mobile menu opens once and overlay closes it without leaving scroll locked',()=>{
 const f=fixture();assert.equal(f.toggle.attrs['aria-expanded'],'false');
 f.toggle.fire('click');assert(f.sidebar.classList.contains('open'));assert.equal(f.overlay.hidden,false);
 assert(f.document.documentElement.classList.contains('admin-drawer-open'));assert.equal(f.toggle.attrs['aria-expanded'],'true');
 f.overlay.fire('click');assert(!f.sidebar.classList.contains('open'));assert(f.overlay.hidden);
 assert(!f.document.body.classList.contains('admin-drawer-open'));assert(!f.document.documentElement.classList.contains('admin-drawer-open'));assert.equal(f.toggle.focusCount,1);
});
test('sidebar interior stays open; navigation, Escape, history restoration and desktop resize close it',()=>{
 const f=fixture();const open=()=>f.toggle.fire('click');
 open();f.sidebar.fire('click',{target:{closest:()=>null}});assert(f.sidebar.classList.contains('open'));
 f.sidebar.fire('click',{target:{closest:()=>({href:'/provinces'})}});assert(!f.sidebar.classList.contains('open'));
 open();let prevented=false;f.document.fire('keydown',{key:'Escape',preventDefault(){prevented=true;}});assert(prevented);assert(!f.sidebar.classList.contains('open'));
 open();f.window.fire('pageshow');assert(!f.sidebar.classList.contains('open'));
 open();f.media.matches=false;f.media.fire('change');assert(!f.sidebar.classList.contains('open'));assert(f.overlay.hidden);
 f.toggle.fire('click');assert(!f.sidebar.classList.contains('open'));assert(!f.document.documentElement.classList.contains('admin-drawer-open'));
});
test('shared initialization does not duplicate click handlers',()=>{
 const f=fixture();init(f.document,f.window);assert.equal(f.toggle.events.click.length,1);f.toggle.fire('click');assert(f.sidebar.classList.contains('open'));
});
test('shared header provides accessible mobile trigger and overlay outside sticky header',()=>{
 const fs=require('fs'),path=require('path');
 const header=fs.readFileSync(path.join(__dirname,'../views/teacher/partials/header.ejs'),'utf8');
 assert(header.includes('id="adminMobileMenu"'));assert(header.includes('aria-controls="sidebar"'));assert(header.includes('aria-expanded="false"'));
 assert(header.indexOf('id="adminNavOverlay"')>header.indexOf('</header>'));assert(header.includes('/js/admin-shell.js?v=20261021-drawer1'));
 assert(!header.includes('id="sidebarToggle"'),'old per-page handlers must not double-toggle the new trigger');
});

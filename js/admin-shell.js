(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory;
 else factory(root.document,root);
})(typeof window!=='undefined'?window:null,function initAdminDrawer(document,window){
 'use strict';
 var sidebar=document.getElementById('sidebar');
 var toggle=document.getElementById('adminMobileMenu');
 var overlay=document.getElementById('adminNavOverlay');
 if(!sidebar||!toggle||!overlay||toggle.dataset.drawerReady)return;
 toggle.dataset.drawerReady='true';
 var mobile=window.matchMedia('(max-width:768px)');
 function setOpen(value,restoreFocus){
  var open=Boolean(value&&mobile.matches);
  sidebar.classList.toggle('open',open);
  overlay.hidden=!open;
  toggle.setAttribute('aria-expanded',String(open));
  toggle.setAttribute('aria-label',open?'收起管理后台菜单':'展开管理后台菜单');
  document.body.classList.toggle('admin-drawer-open',open);
  document.documentElement.classList.toggle('admin-drawer-open',open);
  if(restoreFocus)toggle.focus({preventScroll:true});
 }
 toggle.addEventListener('click',function(){setOpen(!sidebar.classList.contains('open'));});
 overlay.addEventListener('click',function(){setOpen(false,true);});
 sidebar.addEventListener('click',function(event){
  if(event.target.closest('a[href]'))setOpen(false);
 });
 document.addEventListener('keydown',function(event){
  if(event.key==='Escape'&&sidebar.classList.contains('open')){
   event.preventDefault();setOpen(false,true);
  }
 });
 function reset(){setOpen(false);}
 if(mobile.addEventListener)mobile.addEventListener('change',reset);
 else mobile.addListener(reset);
 window.addEventListener('pageshow',reset);
 reset();
 return {setOpen:setOpen};
});

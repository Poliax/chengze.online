(function(){
 var root=document.documentElement,key='cz-player-theme',theme='night';
 try{var saved=localStorage.getItem(key);if(saved==='day'||saved==='night')theme=saved;}catch(e){}
 root.dataset.playerTheme=theme;
 function apply(value){
  root.dataset.playerTheme=value;
  document.querySelectorAll('[data-player-theme-toggle]').forEach(function(button){button.setAttribute('aria-pressed',String(value==='day'));button.setAttribute('aria-label',value==='day'?'切换为夜间模式':'切换为日间模式');button.title=value==='day'?'切换为夜间模式':'切换为日间模式';button.querySelector('span').textContent='';button.querySelector('svg').innerHTML=value==='night'?'<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>':'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>';});
  document.querySelectorAll('.chengze-playback-logo').forEach(function(img){img.src='/public/images/brand-green/online-'+(value==='day'?'dark':'light')+'.svg?v=20261027-theme1';});
 }
 document.addEventListener('DOMContentLoaded',function(){apply(root.dataset.playerTheme);document.querySelectorAll('[data-player-theme-toggle]').forEach(function(button){button.addEventListener('click',function(){var next=root.dataset.playerTheme==='day'?'night':'day';apply(next);try{localStorage.setItem(key,next);}catch(e){}});});});
 window.addEventListener('storage',function(event){if(event.key===key&&(event.newValue==='day'||event.newValue==='night'))apply(event.newValue);});
})();

// Align the header to the rendered workspace, including scaled replay layouts.
(function(){document.addEventListener('DOMContentLoaded',function(){
 var header=document.querySelector('.watch-header,.topbar'),workspace=document.querySelector('.page,.wrap');
 if(!header||!workspace)return;
 var frame=0;
 function align(){frame=0;var r=workspace.getBoundingClientRect(),width=document.documentElement.clientWidth;
  if(r.width<=0)return;
  header.style.paddingLeft=Math.max(12,r.left)+'px';
  header.style.paddingRight=Math.max(12,width-r.right)+'px';
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(align);}
 window.addEventListener('resize',schedule);window.addEventListener('load',schedule);
 if(window.visualViewport)window.visualViewport.addEventListener('resize',schedule);
 if(window.ResizeObserver)new ResizeObserver(schedule).observe(workspace);
 if(window.MutationObserver)new MutationObserver(schedule).observe(workspace,{attributes:true,attributeFilter:['style','class']});
 schedule();
});})();

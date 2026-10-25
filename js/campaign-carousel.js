(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.document.querySelectorAll('[data-campaign-carousel]').forEach(function(el){factory(el,root,root.document);});})(typeof window==='undefined'?null:window,function(el,win,doc){
 'use strict';
 var slides=Array.from(el.querySelectorAll('[data-campaign-slide]')),dots=Array.from(el.querySelectorAll('[data-campaign-index]')),pause=el.querySelector('[data-campaign-pause]');
 if(slides.length<2){el.querySelectorAll('.campaign-arrow,.campaign-dots,.campaign-pause').forEach(function(node){node.hidden=true;});return;}
 var index=0,timer=null,hover=false,focused=false,paused=win.matchMedia('(prefers-reduced-motion: reduce)').matches;
 function schedule(){win.clearTimeout(timer);if(!paused&&!hover&&!focused&&!doc.hidden)timer=win.setTimeout(function(){if(el.getClientRects().length)go(index+1);else schedule();},Math.max(3000,Math.min(30000,Number(el.dataset.interval)||5500)));}
 function go(next){index=(next+slides.length)%slides.length;slides.forEach(function(slide,i){slide.classList.toggle('is-active',i===index);slide.setAttribute('aria-hidden',String(i!==index));});dots.forEach(function(dot,i){dot.setAttribute('aria-current',String(i===index));});schedule();}
 function updatePause(){pause.setAttribute('aria-pressed',String(paused));pause.setAttribute('aria-label',paused?'开启自动轮播':'暂停自动轮播');pause.textContent=paused?'▶':'Ⅱ';schedule();}
 el.addEventListener('click',function(e){var dot=e.target.closest('[data-campaign-index]'),step=e.target.closest('[data-campaign-step]');if(dot)go(Number(dot.dataset.campaignIndex));else if(step)go(index+Number(step.dataset.campaignStep));else if(e.target.closest('[data-campaign-pause]')){paused=!paused;updatePause();}});
 el.addEventListener('pointerenter',function(e){if(e.pointerType==='mouse'){hover=true;schedule();}});
 el.addEventListener('pointerleave',function(){hover=false;schedule();});
 el.addEventListener('focusin',function(){focused=true;schedule();});
 el.addEventListener('focusout',function(e){focused=el.contains(e.relatedTarget);schedule();});
 el.addEventListener('keydown',function(e){if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();go(index+(e.key==='ArrowLeft'?-1:1));}});
 var touch=null;
 el.addEventListener('pointerdown',function(e){if(e.pointerType==='touch')touch={x:e.clientX,y:e.clientY};});
 el.addEventListener('pointerup',function(e){if(!touch)return;var dx=e.clientX-touch.x,dy=e.clientY-touch.y;touch=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy))go(index+(dx<0?1:-1));});
 el.addEventListener('pointercancel',function(){touch=null;});
 doc.addEventListener('visibilitychange',schedule);updatePause();
 return {go:go,current:function(){return index;}};
});

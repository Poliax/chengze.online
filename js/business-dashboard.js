(function(){
 const main=document.getElementById('businessContent');
 if(!main)return;
 const nav=main.querySelector('nav[aria-label="统计时间范围"]');
 if(!nav)return;
 const status=main.querySelector('.business-refresh-status');
 const selectors=['.business-kpis','.business-chart-grid','.business-definitions','.business-updated'];
 const snapshots=new Map();
 let pending=null,sequence=0;
 const selected=nav.querySelector('[aria-current="page"]');
 const initialDays=selected?new URL(selected.href,location.href).searchParams.get('days'):null;
 if(initialDays)snapshots.set(initialDays,{html:main.innerHTML,at:Date.now()});
 function show(html,days,url){
  const template=document.createElement('template');template.innerHTML=html;
  const fragment=template.content;
  if(!fragment.querySelector('.business-kpis')||!fragment.querySelector('nav[aria-label="统计时间范围"]'))throw Error('invalid');
  const detailsOpen=main.querySelector('details')?.open;
  for(const selector of selectors){const old=main.querySelector(selector),next=fragment.querySelector(selector);if(old&&next)old.replaceWith(next);}
  if(detailsOpen&&main.querySelector('details'))main.querySelector('details').open=true;
  const period=main.querySelector('.business-controls > span:not(.business-refresh-status)'),newPeriod=fragment.querySelector('.business-controls > span:not(.business-refresh-status)');
  if(period&&newPeriod)period.textContent=newPeriod.textContent;
  nav.querySelectorAll('a').forEach(a=>{const active=new URL(a.href,location.href).searchParams.get('days')===days;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  history.replaceState(null,'',url.pathname+url.search);
 }
 main.addEventListener('click',async function(event){
  const link=event.target.closest('nav[aria-label="统计时间范围"] a');
  if(!link||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();
  if(link.getAttribute('aria-current')==='page'&&!pending)return;
  if(pending)pending.abort();
  const controller=new AbortController(),requestId=++sequence;pending=controller;
  const url=new URL(link.href,location.href),days=url.searchParams.get('days');
  const cached=snapshots.get(days);
  if(cached&&Date.now()-cached.at<30000)show(cached.html,days,url);
  main.setAttribute('aria-busy','true');if(status)status.textContent='更新中…';
  const timer=setTimeout(()=>controller.abort(),10000);
  try{
   const response=await fetch('/dashboard/data?days='+encodeURIComponent(days),{signal:controller.signal,credentials:'same-origin',cache:'no-store',headers:{Accept:'text/html'}});
   if(response.redirected||!response.ok){snapshots.clear();throw Error('unavailable');}
   const html=await response.text();if(requestId!==sequence)return;
   show(html,days,url);snapshots.set(days,{html,at:Date.now()});
   if(status)status.textContent='';
  }catch(error){
   if(requestId===sequence&&status)status.textContent='更新失败，请重试；登录过期时请重新登录。';
  }finally{
   clearTimeout(timer);
   if(requestId===sequence){pending=null;main.removeAttribute('aria-busy');}
  }
 });
})();

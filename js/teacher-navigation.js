(function(){
 function portalPath(path){return /^\/(?:teaching|teach)(?:\/(?:courses|calendar|profile))?\/?$/.test(path);}
 function calendarURL(base,year,month,view){const url=new URL(base+'/calendar',location.origin);url.searchParams.set('year',year);if(month)url.searchParams.set('month',month);url.searchParams.set('view',view==='year'?'year':'month');return url;}
 if(typeof module!=='undefined'&&module.exports)module.exports={portalPath};
 if(typeof document==='undefined')return;
 const content=document.querySelector('.main > .content');
 if(!content||!portalPath(location.pathname))return;
 const base=/^\/teaching(?:\/|$)/.test(location.pathname)?'/teaching':'/teach';
 let request=null,version=0,renderedURL=location.href,pendingURL='';
 const scrollPositions=new Map();
 const indicator=document.createElement('div');indicator.className='teacher-nav-status';indicator.setAttribute('role','status');indicator.setAttribute('aria-live','polite');document.body.append(indicator);
 const statusStyles=document.createElement('style');statusStyles.textContent='.teacher-nav-status{position:fixed;right:22px;top:72px;z-index:100;background:#fff;color:#68778A;border:1px solid #E0E6ED;border-radius:6px;padding:7px 11px;font-size:12px;box-shadow:0 2px 8px #172d4710;display:none}.teacher-nav-status:not(:empty){display:block}';document.head.append(statusStyles);
 // Mouse/pen drag supplements native touch and trackpad scrolling.
 let weekDrag=null,suppressWeekClick=false;
 document.addEventListener('pointerdown',event=>{const strip=event.target.closest('.week-scroll');if(!strip||event.pointerType==='touch'||event.button!==0)return;expandWeek();weekDrag={strip,id:event.pointerId,x:event.clientX,y:event.clientY,left:strip.scrollLeft,active:false};suppressWeekClick=false;});
 document.addEventListener('pointermove',event=>{const drag=weekDrag;if(!drag||event.pointerId!==drag.id)return;const dx=event.clientX-drag.x;if(!drag.active){if(Math.abs(dx)<6||Math.abs(dx)<Math.abs(event.clientY-drag.y))return;drag.active=true;drag.strip.classList.add('is-dragging');drag.strip.setPointerCapture(event.pointerId);}event.preventDefault();drag.strip.scrollLeft=drag.left-dx;},{passive:false});
 function finishWeekDrag(event){if(!weekDrag||event.pointerId!==weekDrag.id)return;const drag=weekDrag;weekDrag=null;drag.strip.classList.remove('is-dragging');if(drag.strip.hasPointerCapture(event.pointerId))drag.strip.releasePointerCapture(event.pointerId);if(drag.active){suppressWeekClick=true;setTimeout(()=>{suppressWeekClick=false;},0);}}
 document.addEventListener('pointerup',finishWeekDrag);document.addEventListener('pointercancel',finishWeekDrag);
 document.addEventListener('click',event=>{if(suppressWeekClick&&event.target.closest('.week-scroll')){event.preventDefault();event.stopImmediatePropagation();suppressWeekClick=false;}},true);
 document.addEventListener('dragstart',event=>{if(event.target.closest('.week-scroll'))event.preventDefault();});
 function expandWeek(){
  const strip=content.querySelector('.week-scroll');if(!strip||strip.dataset.expanded)return;
  const before=content.querySelector('#weekBefore'),after=content.querySelector('#weekAfter');
  const oldLeft=strip.scrollLeft,first=strip.firstElementChild;
  const column=first?.getBoundingClientRect().width||0;
  const count=before?.content.childElementCount||0;
  if(before)strip.prepend(before.content.cloneNode(true));
  if(after)strip.append(after.content.cloneNode(true));
  strip.dataset.expanded='true';strip.scrollLeft=oldLeft+count*column;
 }
 function initWeek(){
  const strip=content.querySelector('.week-scroll'),today=strip?.querySelector('[data-week-start="true"]');if(!strip||!today)return;
  const column=strip.firstElementChild.getBoundingClientRect().width;
  strip.scrollLeft=Math.max(0,Array.from(strip.children).indexOf(today)*column-(strip.clientWidth-column)/2);
 }
 document.addEventListener('wheel',event=>{if(event.target.closest('.week-scroll')&&(Math.abs(event.deltaX)>0||event.shiftKey))expandWeek();},{passive:true});
 document.addEventListener('touchstart',event=>{if(event.target.closest('.week-scroll'))expandWeek();},{passive:true});
 document.addEventListener('keydown',event=>{if(event.target.closest('.week-scroll')&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key))expandWeek();});

 function syncHeader(){const slot=document.getElementById('teacherHeaderContent');if(!slot)return;const label=document.createElement('span');label.className='teacher-header-label';label.textContent=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(new Date());slot.replaceChildren(label);}
 setInterval(syncHeader,60000);

 function watermark(){const wm=content.querySelector('#watermark');if(!wm)return;wm.replaceChildren();const name=wm.dataset.name||'';if(!name)return;const fragment=document.createDocumentFragment();const cols=Math.ceil(innerWidth/260)+1,rows=Math.ceil(innerHeight/260)+1;for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const el=document.createElement('div');el.textContent=name;el.style.cssText='position:absolute;left:'+(c*260)+'px;top:'+(r*260)+'px;font-size:15px;font-weight:400;color:rgba(45,55,65,.025);transform:rotate(-25deg);white-space:nowrap;pointer-events:none';fragment.append(el);}wm.append(fragment);}
 function initCalendar(){const day=content.querySelector('.cal-day.today')||Array.from(content.querySelectorAll('.cal-day:not(.other)')).find(el=>{try{return JSON.parse(el.dataset.ev||'[]').length>0}catch{return false}});if(day)showDay(day);}
 function resetCalendarControls(){const toolbar=document.querySelector('[data-calendar-view]');if(!toolbar)return;const year=document.querySelector('#yearSelect'),month=document.querySelector('#monthSelect');if(year)year.value=toolbar.dataset.calendarYear;if(month)month.value=toolbar.dataset.calendarMonth;}
 function highlight(path){document.querySelectorAll('#sidebar .sidebar-nav a, #sidebar .teacher-sidebar-account').forEach(a=>{const target=new URL(a.href,location.href);a.classList.toggle('active',target.pathname.replace(/\/$/,'')===path.replace(/\/$/,''));});}
 async function navigate(url,{pop=false,calendar=false}={}){
  if(!portalPath(url.pathname)||url.origin!==location.origin)return;
  if((url.href===renderedURL&&!pop)||url.href===pendingURL)return;
  const topicForms=Array.from(content.querySelectorAll('form[data-lesson-topic]'));
  if(topicForms.length){const saved=await Promise.all(topicForms.map(form=>saveTopic(form)));if(saved.some(ok=>!ok))return;}
  if(request)request.abort();const controller=new AbortController(),id=++version;request=controller;pendingURL=url.href;
  scrollPositions.set(renderedURL,{x:scrollX,y:scrollY});
  const oldFocus=document.activeElement?.id;indicator.textContent='';content.setAttribute('aria-busy','true');const timer=setTimeout(()=>controller.abort(),12000);
  try{
   const response=await fetch(url.href,{signal:controller.signal,credentials:'same-origin',cache:'no-store',headers:{Accept:'text/html','X-Teacher-Navigation':'1'}});
   if(!response.ok)throw Error('request');
   if(!portalPath(new URL(response.url||url.href).pathname))throw Error('session');
   const html=await response.text();if(id!==version)return;
   const doc=new DOMParser().parseFromString(html,'text/html');const next=doc.querySelector('.main > .content'),styles=doc.getElementById('teacherViewStyles');
   if(!next||!styles||!doc.getElementById('sidebar'))throw Error('session');
   next.querySelectorAll('script').forEach(script=>script.remove());
   const currentStyles=document.getElementById('teacherViewStyles');if(currentStyles&&currentStyles.textContent!==styles.textContent)currentStyles.textContent=styles.textContent;
   content.replaceChildren(...Array.from(next.childNodes));
   document.title=doc.title;
   if(!pop)history.pushState({teacherView:url.pathname+url.search},'',base);
   renderedURL=url.href;highlight(url.pathname);syncHeader();watermark();initCalendar();initWeek();
   document.getElementById('sidebar')?.classList.remove('open');
   if(pop){const pos=scrollPositions.get(url.href)||{x:0,y:0};scrollTo(pos.x,pos.y);}else if(!calendar)scrollTo(0,0);
   // Preserve keyboard interaction for dropdowns without moving mouse focus.
   if(calendar&&['yearSelect','monthSelect'].includes(oldFocus))document.getElementById(oldFocus)?.focus({preventScroll:true});
   indicator.textContent='';
  }catch(error){if(id===version){indicator.replaceChildren(document.createTextNode('加载失败，请重试。'),Object.assign(document.createElement('a'),{href:base+'/login',textContent:'重新登录'}));resetCalendarControls();}}
  finally{clearTimeout(timer);if(id===version){request=null;pendingURL='';content.removeAttribute('aria-busy');}}
 }
 function closeAccountMenu(){const menu=document.getElementById('teacherAccountMenu');if(menu)menu.hidden=true;document.querySelector('.teacher-account-trigger')?.setAttribute('aria-expanded','false');}
 document.addEventListener('keydown',event=>{if(event.key==='Escape'){const open=document.querySelector('.teacher-account-trigger[aria-expanded="true"]');closeAccountMenu();open?.focus();}});
 document.addEventListener('click',function(event){
  const step=event.target.closest('[data-week-step]'),today=event.target.closest('[data-week-today]');if(step||today){const strip=content.querySelector('.week-scroll');if(strip){expandWeek();if(today)initWeek();else strip.scrollBy({left:strip.clientWidth*Number(step.dataset.weekStep),behavior:'smooth'});}return;}

  const accountTrigger=event.target.closest('.teacher-account-trigger');if(accountTrigger){const menu=document.getElementById('teacherAccountMenu');if(menu){menu.hidden=!menu.hidden;accountTrigger.setAttribute('aria-expanded',String(!menu.hidden));}return;}
  if(!event.target.closest('.teacher-account-menu')||event.target.closest('.teacher-account-popover a'))closeAccountMenu();
  if(event.target.closest('[data-confirm-logout]')){if(!window.confirm('确定退出登录吗？'))event.preventDefault();return;}
  if(event.target.closest('[data-close-sidebar]')){document.getElementById('sidebar')?.classList.remove('open');return;}
  const menu=event.target.closest('#menuToggle');if(menu){document.getElementById('sidebar')?.classList.toggle('open');return;}
  const toggle=event.target.closest('[data-course-toggle]');if(toggle){document.getElementById('card-'+toggle.dataset.courseToggle)?.classList.toggle('open');return;}
  const day=event.target.closest('.cal-day:not(.other)');if(day){showDay(day);return;}
  const link=event.target.closest('a[href]');if(!link||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.target||link.hasAttribute('download'))return;
  const url=new URL(link.href,location.href);if(url.origin!==location.origin||!portalPath(url.pathname))return;
  event.preventDefault();navigate(url,{calendar:url.pathname.replace(/\/$/,'')===base+'/calendar'&&new URL(renderedURL).pathname.replace(/\/$/,'')===base+'/calendar'});
 });
 const topicSaves=new WeakMap();
 function topicState(form){let state=topicSaves.get(form);if(!state){const field=form.querySelector('[name="content"]');state={saved:field.defaultValue,timer:null,running:null};topicSaves.set(form,state);}return state;}
 function topicNotice(form,text,retry){const status=form.querySelector('.topic-status');status.replaceChildren(document.createTextNode(text));if(retry){const button=document.createElement('button');button.type='button';button.className='topic-retry';button.dataset.topicRetry='true';button.textContent='重试';status.append(button);}}
 async function saveTopic(form){
  const state=topicState(form),field=form.querySelector('[name="content"]');clearTimeout(state.timer);
  if(state.running){const ok=await state.running;if(!ok)return false;if(field.value.trim()!==state.saved)return saveTopic(form);return true;}
  const value=field.value.trim();if(value===state.saved)return true;
  const id=form.dataset.lessonTopic;
  state.running=(async()=>{try{
   const response=await fetch(base+'/lessons/'+id+'/content',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:value})});if(!response.ok)throw Error('save');const result=await response.json();if(!result.ok)throw Error('save');state.saved=result.content;field.defaultValue=result.content;
   if(field.value.trim()===result.content){topicNotice(form,'已保存');setTimeout(()=>{if(field.value.trim()===state.saved)topicNotice(form,'');},1800);}return true;
  }catch(error){topicNotice(form,'保存失败，内容已保留',true);return false;}})();
  const ok=await state.running;state.running=null;
  if(ok&&field.value.trim()!==state.saved)return saveTopic(form);return ok;
 }
 window.addEventListener('pagehide',()=>{content.querySelectorAll('form[data-lesson-topic]').forEach(form=>{const state=topicState(form),value=form.querySelector('[name="content"]').value.trim();if(value!==state.saved)fetch(base+'/lessons/'+form.dataset.lessonTopic+'/content',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({content:value})}).catch(()=>{});});});
 document.addEventListener('input',event=>{const form=event.target.closest('form[data-lesson-topic]');if(!form)return;const state=topicState(form);clearTimeout(state.timer);topicNotice(form,'');state.timer=setTimeout(()=>saveTopic(form),1000);});
 document.addEventListener('focusout',event=>{const form=event.target.closest('form[data-lesson-topic]');if(form)saveTopic(form);});
 document.addEventListener('submit',event=>{const form=event.target.closest('form[data-lesson-topic]');if(!form)return;event.preventDefault();saveTopic(form);});
 document.addEventListener('click',event=>{const retry=event.target.closest('[data-topic-retry]');if(retry)saveTopic(retry.closest('form[data-lesson-topic]'));});
 document.addEventListener('change',function(event){if(!['yearSelect','monthSelect'].includes(event.target.id))return;const toolbar=document.querySelector('[data-calendar-view]');if(!toolbar)return;const year=document.querySelector('#yearSelect').value,month=document.querySelector('#monthSelect')?.value;const url=calendarURL(base,year,month,toolbar.dataset.calendarView);navigate(url,{calendar:true});});
 document.addEventListener('keydown',event=>{if(!['Enter',' '].includes(event.key))return;const day=event.target.closest('.cal-day:not(.other)');if(day){event.preventDefault();showDay(day);}});
 window.addEventListener('popstate',event=>{const target=new URL(event.state?.teacherView||base,location.origin);navigate(target,{pop:true});});
 function showDay(day){const side=content.querySelector('#calSide');if(!side)return;content.querySelectorAll('.cal-day.selected').forEach(el=>el.classList.remove('selected'));day.classList.add('selected');let events=[];try{events=JSON.parse(day.dataset.ev||'[]')}catch{}if(!Array.isArray(events))events=[];const fragment=document.createDocumentFragment();const el=(tag,cls,text)=>{const node=document.createElement(tag);node.className=cls;node.textContent=text||'';return node};fragment.append(el('div','cal-side-hd',(day.dataset.date||'')+' 的课程'));if(!events.length)fragment.append(el('div','cal-side-empty','当天暂无课程'));for(const ev of events){const item=el('div','cal-side-item','');item.style.setProperty('--course-hue',String((Math.round(Number(ev.course_id)*137.508)||0)%360));item.append(el('span','cal-side-time',ev.start_time));const info=el('div','','');info.append(el('div','cal-side-title',ev.title),el('div','cal-side-course',ev.course_title));info.style.color='hsl(var(--course-hue) 38% 35%)';info.querySelectorAll('.cal-side-title,.cal-side-course').forEach(node=>node.style.color='inherit');item.append(info);if(/^[1-9]\d*$/.test(String(ev.course_id))){const a=el('a','cal-side-link','进入课程');a.href=base+'/live/'+ev.course_id+'?lesson='+(/^\d+$/.test(String(ev.lesson_id))?ev.lesson_id:'');a.target='_blank';a.rel='noopener';item.append(a);}fragment.append(item);}side.replaceChildren(fragment);}
 // Store only the view location in browser history; all visible addresses use /teaching.
 const saved=history.state?.teacherView;
 const initialURL=new URL(location.href);
 const serverView=document.querySelector('[data-rendered-view]')?.dataset.renderedView;
 const serverURL=serverView?new URL(serverView.replace(/^\/teach(?=\/|$|\?)/,base),location.origin):initialURL;
 const savedURL=saved?new URL(saved,location.origin):null;
 renderedURL=serverURL.href;
 if(initialURL.pathname.replace(/\/$/,'')===base&&savedURL&&savedURL.origin===location.origin&&portalPath(savedURL.pathname)&&savedURL.href!==serverURL.href){
  history.replaceState({teacherView:savedURL.pathname+savedURL.search},'',base);
  navigate(savedURL,{pop:true});
 }else{
  history.replaceState({teacherView:serverURL.pathname+serverURL.search},'',base);
  highlight(serverURL.pathname);
 }
 syncHeader();watermark();initCalendar();initWeek();
})();

(function(){
 'use strict';
 var workspace=document.querySelector('#viewOverview .learning-workspace');if(!workspace)return;
 workspace.addEventListener('click',function(event){var button=event.target.closest('[data-workbench-course]');if(!button)return;var id=button.getAttribute('data-workbench-course');if(!/^\d+$/.test(id))return;var course=document.getElementById('learningCourse'+id);if(!course)return;course.open=true;var summary=course.querySelector('summary');if(summary)summary.focus({preventScroll:true});course.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});});
 // Old purchased-course links now land in the unified learning workspace.
 var requested=new URLSearchParams(location.search).get('view');
 if((requested==='purchased'||requested==='overview')&&document.body.dataset.viewerSignedIn==='1'&&typeof switchView==='function')switchView('overview');
}());

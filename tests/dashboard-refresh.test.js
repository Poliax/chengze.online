const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=label=>`<nav aria-label="统计时间范围"></nav><div class="business-kpis">${label}</div>`;
function setup(fetch){
 const status={textContent:''},links=[7,30,90].map(day=>({href:'https://admin.chengze.online/dashboard?days='+day,active:day===30,classList:{toggle(){}},getAttribute(name){return name==='aria-current'&&this.active?'page':null},setAttribute(){this.active=true},removeAttribute(){this.active=false}}));
 const nav={querySelector:()=>links.find(l=>l.active),querySelectorAll:()=>links};
 const replacements=[];let click;const nodes={};
 for(const selector of ['.business-kpis','.business-chart-grid','.business-definitions','.business-updated'])nodes[selector]={replaceWith(next){replacements.push(next.label)}};
 const main={innerHTML:html('initial'),setAttribute(){},removeAttribute(){},querySelector(q){if(q==='nav[aria-label="统计时间范围"]')return nav;if(q==='.business-refresh-status')return status;return nodes[q]||null},addEventListener:(name,cb)=>{click=cb}};
 const document={getElementById:()=>main,createElement:()=>{const t={innerHTML:''};t.content={querySelector:q=>t.innerHTML.includes('business-kpis')?{label:t.innerHTML}:null};return t}};
 const history={value:'',replaceState(a,b,value){this.value=value}};
 vm.runInNewContext(fs.readFileSync('js/business-dashboard.js','utf8'),{document,location:{href:'https://admin.chengze.online/dashboard?days=30'},history,URL,AbortController,setTimeout,clearTimeout,fetch});
 const event={target:{closest:()=>links[0]},button:0,preventDefault(){this.prevented=true}};
 return {main,status,history,event,replacements,nav,click(day=7){event.target.closest=()=>links.find(l=>l.href.endsWith('='+day));return click(event)}};
}
test('切换只更新数据区域，导航节点保持不动且不强制聚焦',async()=>{
 let requested;const s=setup(async(url,options)=>{requested={url,options};return {ok:true,redirected:false,text:async()=>html('new chart')}});
 await s.click();assert.equal(s.event.prevented,true);assert.equal(requested.url,'/dashboard/data?days=7');assert.equal(requested.options.credentials,'same-origin');assert.equal(s.main.innerHTML,html('initial'));assert.equal(s.replacements.length,4);assert.equal(s.history.value,'/dashboard?days=7');assert.equal(s.status.textContent,'');
});
test('权限或会话失效时保留旧图表，不把登录页替换进来',async()=>{
 const s=setup(async()=>({ok:true,redirected:true,text:async()=>'<form>login</form>'}));await s.click();assert.equal(s.replacements.length,0);assert.ok(s.status.textContent.includes('更新失败'));assert.equal(s.history.value,'');
});
test('回到已浏览范围立即显示内存快照，同时仍请求服务端校验权限',async()=>{
 let count=0,resolve;const s=setup(async()=>{count++;if(count===1)return {ok:true,redirected:false,text:async()=>html('seven')};return new Promise(r=>{resolve=r})});await s.click(7);const result=s.click(30);assert.equal(s.history.value,'/dashboard?days=30');assert.equal(count,2);resolve({ok:true,redirected:false,text:async()=>html('thirty')});await result;
});
test('快速连续切换只接收最后一次结果',async()=>{
 const pending=[];const s=setup(()=>new Promise(r=>pending.push(r)));const first=s.click(7),last=s.click(90);pending[1]({ok:true,redirected:false,text:async()=>html('ninety')});await last;pending[0]({ok:true,redirected:false,text:async()=>html('seven')});await first;assert.equal(s.history.value,'/dashboard?days=90');assert.equal(s.replacements.length,4);assert.ok(s.replacements.every(v=>v.includes('ninety')));
});

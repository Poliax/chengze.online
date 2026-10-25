(function(){
  'use strict';
  var trigger=document.getElementById('studentAccountTrigger');
  var menu=document.getElementById('studentAccountMenu');
  if(!trigger||!menu)return;
  var region=document.getElementById('studentShippingRegion');
  if(region){
    var provinces=window.CZ_SHIPPING_REGIONS||[],provinceSelect=document.getElementById('recipientProvince'),citySelect=document.getElementById('recipientCity'),districtSelect=document.getElementById('recipientDistrict');
    function options(select,rows,label,value){select.replaceChildren(new Option(label,''));rows.forEach(function(row){select.add(new Option(row.name,row.code));});select.value=value||'';select.disabled=!rows.length;}
    function cities(cityValue,districtValue){var p=provinces.find(function(row){return row.code===provinceSelect.value;});options(citySelect,p?p.children:[],'请选择城市',cityValue);districts(districtValue);}
    function districts(value){var p=provinces.find(function(row){return row.code===provinceSelect.value;}),c=p&&p.children.find(function(row){return row.code===citySelect.value;});options(districtSelect,c?c.children:[],'请选择区县',value);}
    options(provinceSelect,provinces,'请选择省份',region.dataset.province);cities(region.dataset.city,region.dataset.district);
    provinceSelect.addEventListener('change',function(){cities();});citySelect.addEventListener('change',function(){districts();});
  }
  var accountForm=document.getElementById('studentAccountProfile');
  if(accountForm)accountForm.addEventListener('submit',async function(event){
    event.preventDefault();var button=accountForm.querySelector('button[type="submit"]'),status=document.getElementById('studentAccountStatus');button.disabled=true;status.textContent='正在保存…';
    try{
      var data={};['name','nickname','recipient_name','recipient_phone','recipient_province','recipient_city','recipient_district','recipient_address_detail','province_code','exam_year','junior_college','junior_major'].forEach(function(key){data[key]=accountForm.elements[key].value;});
      var response=await fetch('/api/auth/account-details',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}),result=await response.json();
      if(!response.ok||!result.success)throw Error(result.error||'保存失败');
      document.querySelectorAll('[data-student-avatar]').forEach(function(el){if(!el.querySelector('img'))el.textContent=result.nickname.charAt(0);});
      var gp=document.getElementById('globalProvince'),gy=document.getElementById('globalYear');
      if(gp&&result.province_code){gp.value=result.province_code;gp.dispatchEvent(new Event('change'));}
      if(gy&&result.exam_year){if(!Array.from(gy.options).some(function(o){return o.value===result.exam_year;}))gy.add(new Option(result.exam_year,result.exam_year));gy.value=result.exam_year;gy.dispatchEvent(new Event('change'));}
      status.textContent='已保存';
    }catch(error){status.textContent=error.message||'保存失败，请重试';}finally{button.disabled=false;}
  });
  var phoneDialog=document.getElementById('studentPhoneChangeDialog'),phoneForm=document.getElementById('studentPhoneChangeForm');
  if(phoneDialog&&phoneForm){
    var phoneStatus=document.getElementById('studentPhoneChangeStatus');
    document.getElementById('studentPhoneChangeOpen').addEventListener('click',function(){phoneForm.reset();phoneStatus.textContent='';phoneDialog.showModal();});
    document.getElementById('studentPhoneChangeClose').addEventListener('click',function(){phoneDialog.close();});
    phoneForm.elements.new_phone.addEventListener('input',function(){phoneForm.elements.old_code.value='';phoneForm.elements.new_code.value='';});
    phoneForm.querySelectorAll('[data-phone-code]').forEach(function(button){button.addEventListener('click',async function(){
      var phone=phoneForm.elements.new_phone.value.trim();if(!/^1\d{10}$/.test(phone)){phoneStatus.textContent='请输入正确的新手机号';return;}
      button.disabled=true;phoneStatus.textContent='正在发送验证码…';
      try{var response=await fetch('/api/auth/phone-change/code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({purpose:button.dataset.phoneCode,new_phone:phone})}),result=await response.json();if(!response.ok||!result.success)throw Error(result.error||'发送失败');phoneStatus.textContent=button.dataset.phoneCode==='old'?'验证码已发送至原手机号':'验证码已发送至新手机号';var seconds=60;button.textContent=seconds+'秒后重试';var timer=setInterval(function(){seconds--;button.textContent=seconds+'秒后重试';if(seconds<=0){clearInterval(timer);button.disabled=false;button.textContent='获取验证码';}},1000);}
      catch(error){phoneStatus.textContent=error.message||'发送失败';button.disabled=false;}
    });});
    phoneForm.addEventListener('submit',async function(event){event.preventDefault();var button=phoneForm.querySelector('button[type="submit"]');button.disabled=true;phoneStatus.textContent='正在修改…';
      try{var response=await fetch('/api/auth/phone-change',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({new_phone:phoneForm.elements.new_phone.value.trim(),old_code:phoneForm.elements.old_code.value.trim(),new_code:phoneForm.elements.new_code.value.trim()})}),result=await response.json();if(!response.ok||!result.success)throw Error(result.error||'修改失败');document.getElementById('studentPhone').value=result.phone;phoneDialog.close();document.getElementById('studentAccountStatus').textContent='登录手机号已更新，下次请使用新手机号登录';}
      catch(error){phoneStatus.textContent=error.message||'修改失败';}finally{button.disabled=false;}
    });
  }
  var cancelDialog=document.getElementById('studentCancelDialog'),cancelForm=document.getElementById('studentCancelForm');
  if(cancelDialog&&cancelForm){
    document.getElementById('studentCancelOpen').addEventListener('click',function(){cancelForm.reset();document.getElementById('studentCancelStatus').textContent='';cancelDialog.showModal();});
    document.getElementById('studentCancelClose').addEventListener('click',function(){cancelDialog.close();});
    cancelForm.addEventListener('submit',async function(event){
      event.preventDefault();var status=document.getElementById('studentCancelStatus'),button=cancelForm.querySelector('button[type="submit"]');
      if(cancelForm.elements.confirmation.value!=='注销账号'){status.textContent='请输入“注销账号”确认';return;}
      button.disabled=true;status.textContent='正在处理…';
      try{var response=await fetch('/api/auth/cancel-account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:cancelForm.elements.phone.value.trim(),password:cancelForm.elements.password.value,confirmation:cancelForm.elements.confirmation.value})}),result=await response.json();if(!response.ok||!result.success)throw Error(result.error||'注销失败');location.assign('/');}
      catch(error){status.textContent=error.message||'注销失败，请重试';button.disabled=false;}
    });
  }
  var avatarInput=document.getElementById('studentAvatarFile');
  var avatarPicker=document.getElementById('studentAvatarPicker');
  if(avatarPicker&&avatarInput)avatarPicker.addEventListener('click',function(){if(!avatarInput.disabled)avatarInput.click();});
  if(avatarInput)avatarInput.addEventListener('change',async function(){
    var file=avatarInput.files[0],status=document.getElementById('studentAvatarStatus');if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024){status.textContent='请选择不超过 10MB 的 JPG、PNG 或 WebP 图片';avatarInput.value='';return;}
    avatarInput.disabled=true;status.textContent='正在保存头像…';var objectUrl=URL.createObjectURL(file);
    try{
      var image=new Image();await new Promise(function(resolve,reject){image.onload=resolve;image.onerror=function(){reject(Error('无法读取图片'));};image.src=objectUrl;});
      var canvas=document.createElement('canvas'),size=Math.min(image.naturalWidth,image.naturalHeight);if(!size)throw Error('图片无效');canvas.width=512;canvas.height=512;
      var context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,512,512);context.drawImage(image,(image.naturalWidth-size)/2,(image.naturalHeight-size)/2,size,size,0,0,512,512);
      var blob=await new Promise(function(resolve){canvas.toBlob(resolve,'image/jpeg',.88);});if(!blob)throw Error('图片处理失败');
      var data=new FormData();data.append('avatar',blob,'avatar.jpg');
      var response=await fetch('/api/auth/avatar',{method:'POST',body:data}),result=await response.json();if(!response.ok||!result.success)throw Error(result.error||'头像保存失败');
      document.querySelectorAll('[data-student-avatar]').forEach(function(el){var img=document.createElement('img');img.src=result.avatar;img.alt='学员头像';el.replaceChildren(img);});status.textContent='头像已更新';
    }catch(error){status.textContent=error.message||'头像保存失败';}finally{URL.revokeObjectURL(objectUrl);avatarInput.disabled=false;avatarInput.value='';}
  });
  function close(){menu.hidden=true;trigger.setAttribute('aria-expanded','false');}
  trigger.addEventListener('click',function(){menu.hidden=!menu.hidden;trigger.setAttribute('aria-expanded',String(!menu.hidden));});
  trigger.addEventListener('keydown',function(e){if(e.key==='ArrowDown'){e.preventDefault();menu.hidden=false;trigger.setAttribute('aria-expanded','true');menu.querySelector('button').focus();}});
  menu.addEventListener('click',function(e){var button=e.target.closest('[data-account-view]');if(!button)return;close();switchView(button.getAttribute('data-account-view'));});
  document.addEventListener('click',function(e){if(!menu.contains(e.target)&&!trigger.contains(e.target))close();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!menu.hidden){close();trigger.focus();}});
  document.addEventListener('focusin',function(e){if(!menu.contains(e.target)&&!trigger.contains(e.target))close();});
}());

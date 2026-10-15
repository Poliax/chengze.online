document.addEventListener('DOMContentLoaded', function() {
  let courseData = {};
  const provinces = [
    { id: '32', name: '江苏' }, { id: '33', name: '浙江' }, { id: '34', name: '安徽' },
    { id: '35', name: '福建' }, { id: '36', name: '江西' }, { id: '37', name: '山东' },
    { id: '41', name: '河南' }, { id: '42', name: '湖北' }, { id: '43', name: '湖南' },
    { id: '44', name: '广东' }, { id: '51', name: '四川' }, { id: '61', name: '陕西' }
  ];
  let currentProvince = '33';

  // Init province buttons
  document.querySelectorAll('.cc-province-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.cc-province-btn').forEach(function(b) {
        b.style.borderColor = '#e0d8d0'; b.style.background = '#fff';
      });
      btn.style.borderColor = '#2d5f6e'; btn.style.background = 'rgba(45,95,110,0.06)';
      currentProvince = btn.dataset.province;
      loadProvince(currentProvince);
    });
  });

  // Load first province
  var firstBtn = document.querySelector('.cc-province-btn');
  if (firstBtn) {
    firstBtn.style.borderColor = '#2d5f6e';
    firstBtn.style.background = 'rgba(45,95,110,0.06)';
    loadProvince('33');
  }

  function loadProvince(provinceId) {
    fetch('/api/courses/' + provinceId)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        courseData[provinceId] = data;
        renderEditor(provinceId, data);
      });
  }

  function renderEditor(provinceId, data) {
    var editor = document.getElementById('ccEditor');
    if (!data || data.length === 0) {
      editor.innerHTML = '<p style="font-size:13px;color:#6b6763;">暂无课程数据</p>';
      return;
    }
    var html = '<table class="cc-table">';
    html += '<tr><th>班型</th><th>标签</th><th>价格</th><th>时长</th><th>课时</th><th>显示</th></tr>';
    data.forEach(function(c, i) {
      html += '<tr>';
      html += '<td><input type="text" value="' + esc(c.name) + '" class="cf-' + i + '-name"></td>';
      html += '<td><input type="text" value="' + esc(c.tag) + '" class="cf-' + i + '-tag"></td>';
      html += '<td><input type="text" value="' + esc(c.price) + '" class="cf-' + i + '-price"></td>';
      html += '<td><input type="text" value="' + esc(c.duration) + '" class="cf-' + i + '-duration"></td>';
      html += '<td><input type="text" value="' + c.sessions + '" class="cf-' + i + '-sessions"></td>';
      html += '<td style="text-align:center;"><input type="checkbox" ' + (c.visible !== false ? 'checked' : '') + ' class="cf-' + i + '-visible"></td>';
      html += '</tr>';
    });
    html += '</table>';
    html += '<div class="cc-actions"><button class="btn-primary--sm" onclick="saveCourses()">保存编辑</button><span class="msg" id="ccMsg"></span></div>';
    editor.innerHTML = html;
  }

  window.saveCourses = function() {
    var data = courseData[currentProvince];
    if (!data) return;
    data.forEach(function(c, i) {
      c.name = document.querySelector('.cf-' + i + '-name').value;
      c.tag = document.querySelector('.cf-' + i + '-tag').value;
      c.price = document.querySelector('.cf-' + i + '-price').value;
      c.duration = document.querySelector('.cf-' + i + '-duration').value;
      c.sessions = parseInt(document.querySelector('.cf-' + i + '-sessions').value) || 0;
      c.visible = document.querySelector('.cf-' + i + '-visible').checked;
    });
    fetch('/admin/api/courses/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ province: currentProvince, courses: data })
    })
    .then(function(r) { return r.json(); })
    .then(function(result) {
      var msg = document.getElementById('ccMsg');
      msg.textContent = result.success ? '✅ 保存成功，官网已同步更新' : '❌ 保存失败';
      setTimeout(function() { msg.textContent = ''; }, 3000);
    });
  };

  function esc(s) { return String(s).replace(/\"/g, '&quot;').replace(/\'/g, '&#39;'); }
});

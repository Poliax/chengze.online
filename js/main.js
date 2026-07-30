document.addEventListener('DOMContentLoaded', function() {
  var menuToggle = document.getElementById('menuToggle');
  var nav = document.getElementById('nav');
  if (menuToggle && nav) {
    menuToggle.addEventListener('click', function() { menuToggle.classList.toggle('active'); nav.classList.toggle('open'); });
    nav.querySelectorAll('.nav__link').forEach(function(l) { l.addEventListener('click', function() { menuToggle.classList.remove('active'); nav.classList.remove('open'); }); });
  }
  var header = document.getElementById('header');
  window.addEventListener('scroll', function() { header.classList.toggle('scrolled', window.scrollY > 10); }, { passive: true });

  // ── View Switching ──
  var navLinks = document.querySelectorAll('.nav__link[data-view]');
  var views = { home: document.getElementById('viewHome'), courses: document.getElementById('viewCourses'), practice: document.getElementById('viewPractice'), qa: document.getElementById('viewQa'), community: document.getElementById('viewCommunity') };
  function switchView(id) {
    navLinks.forEach(function(l) { l.classList.toggle('active', l.dataset.view === id); });
    Object.keys(views).forEach(function(k) { views[k].classList.toggle('active', k === id); });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  navLinks.forEach(function(l) { l.addEventListener('click', function(e) { e.preventDefault(); switchView(l.dataset.view); }); });

  // ── Profile Panel ──
  var avatarBtn = document.getElementById('avatarBtn');
  var profilePanel = document.getElementById('profilePanel');
  var profileOverlay = document.getElementById('profileOverlay');
  var profileClose = document.getElementById('profileClose');
  function openProfile() { profilePanel.classList.add('open'); profileOverlay.classList.add('open'); document.body.style.overflow = 'hidden'; }
  function closeProfile() { profilePanel.classList.remove('open'); profileOverlay.classList.remove('open'); document.body.style.overflow = ''; }
  if (avatarBtn) avatarBtn.addEventListener('click', openProfile);
  if (profileClose) profileClose.addEventListener('click', closeProfile);
  if (profileOverlay) profileOverlay.addEventListener('click', closeProfile);
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeProfile(); });

  // ── Province Selector ──
  var selProvince = document.getElementById('selProvince');
  var selYear = document.getElementById('selYear');
  var LS_KEY = 'cz_province_pref';
  function loadSaved() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch(e) { return {}; } }
  function savePref() { localStorage.setItem(LS_KEY, JSON.stringify({ province: selProvince.value, year: selYear.value })); }
  selProvince.addEventListener('change', function() { savePref(); loadScheduleBar(); updateAdmissionSummary(); buildCourseCards(); buildAssistants(); buildAITutors(); });
  selYear.addEventListener('change', function() { savePref(); loadScheduleBar(); buildCourseCards(); });

  // Init year
  var now = new Date();
  var startYear = now.getMonth() >= 5 ? now.getFullYear() + 1 : now.getFullYear();
  selYear.innerHTML = '';
  for (var i = 0; i < 3; i++) { var y = startYear + i; var opt = document.createElement('option'); opt.value = String(y); opt.textContent = y + '\u5E74'; selYear.appendChild(opt); }
  var saved = loadSaved();
  if (saved.year && [...selYear.options].some(function(o) { return o.value === saved.year; })) selYear.value = saved.year;
  if (saved.province && typeof PROVINCE_DATA !== 'undefined' && PROVINCE_DATA[saved.province]) selProvince.value = saved.province;

  // ── Build Course Cards ──
  function buildCourseCards() {
    var provinceId = selProvince.value;
    var provinceName = (typeof PROVINCE_DATA !== 'undefined' && PROVINCE_DATA[provinceId]?.name) || '\u6D59\u6C5F';
    var year = selYear.value || '2027';
    fetch('/api/courses/' + provinceId).then(function(r) { return r.json(); }).then(function(data) {
      var pubGrid = document.getElementById('publicGrid');
      if (pubGrid) {
        pubGrid.innerHTML = '';
        (data.public || []).forEach(function(c) {
          var card = document.createElement('a');
          card.href = 'https://chengze.online/live/student'; card.target = '_blank'; card.rel = 'noopener';
          card.className = 'public-card';
          card.style.setProperty('--card-color', c.tagColor || '#4a7c6f');
          card.innerHTML = '<div class="public-card__head" style="background:' + (c.tagColor || '#4a7c6f') + ';"><h3 class="public-card__head-title">' + c.name + '</h3></div><div class="public-card__body"><div class="public-card__desc">' + c.desc + '</div><div class="public-card__meta"><span>' + c.teacher + '</span><span>' + c.lessons + '\u8BFE \u00B7 ' + c.duration + '</span></div><span class="public-card__btn">\u67E5\u770B\u8BE6\u60C5</span></div>';
          pubGrid.appendChild(card);
        });
      }
      var grid = document.getElementById('coursesGrid');
      if (grid) {
        grid.innerHTML = '';
        (data.formal || []).forEach(function(cls) {
          if (cls.visible === false) return;
          var card = document.createElement('a');
          card.href = '#'; card.className = 'course-card';
          var badgeText = cls.mode === 'offline' ? '\u7EBF\u4E0B' : '\u7EBF\u4E0A';
var badgeBg = cls.mode === 'offline' ? '#6d28d9' : '#2563eb';
var cardColor = cls.tagColor || 'var(--color-primary)';
          card.style.setProperty('--card-color', cardColor);
          card.innerHTML = '<div class="course-card__head" style="background:' + cardColor + ';"><span class="course-card__head-badge" style="background:' + badgeBg + ';">' + badgeText + '</span><span class="course-card__head-tag">' + cls.tag + '</span></div><div class="course-card__body"><h3>' + year + '\u5E74 ' + provinceName + '\u4E13\u5347\u672C</h3><div class="course-card__meta">' + (cls.teacher || '\u540D\u5E08\u56E2\u961F') + ' \u00B7 ' + (cls.startDate || '\u5F00\u5B66') + '</div><div class="course-card__info"><span>' + cls.duration + ' \u00B7 ' + cls.sessions + '\u8BFE\u65F6</span><span>' + cls.price + '</span></div><span class="course-card__btn">\u67E5\u770B\u8BE6\u60C5</span></div>';
          card.addEventListener('click', function(e) { e.preventDefault(); openCourseDetail(cls, year, provinceName); });
          grid.appendChild(card);
        });
      }
    }).catch(function() {});
  }

  // ── Schedule Bar ──
  var scheduleBar = document.getElementById('scheduleBar');
  window.loadScheduleBar = function() {
    if (!scheduleBar) return;
    fetch('/api/schedule/' + selProvince.value).then(function(r) { return r.json(); }).then(function(data) {
      if (data && data.length > 0) {
        var groups = {};
        data.forEach(function(item) {
          if (!groups[item.month]) groups[item.month] = [];
          groups[item.month].push(item);
        });
        var monthKeys = Object.keys(groups);
        
        // Exam dates by province (month/day)
        var examDates = {
          zhejiang: { m: 3, d: 20 }, shandong: { m: 3, d: 30 },
          henan: { m: 3, d: 20 }, guangdong: { m: 3, d: 25 },
          jiangsu: { m: 3, d: 22 }, sichuan: { m: 3, d: 18 },
          fujian: { m: 3, d: 20 }, hunan: { m: 4, d: 10 },
          anhui: { m: 3, d: 20 }, shaanxi: { m: 3, d: 15 },
          hubei: { m: 4, d: 20 }, jiangxi: { m: 3, d: 20 },
        };
        var pid = document.getElementById('selProvince').value;
        var ed = examDates[pid] || { m: 3, d: 20 };
        var year = parseInt(document.getElementById('selYear').value) || 2027;
        var examDate = new Date(year, ed.m, ed.d);
        var today = new Date();
        var diffTime = examDate.getTime() - today.getTime();
        var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        var daysText = diffDays > 0 ? diffDays + '天' : (diffDays === 0 ? '今天考试' : '已过期');

        scheduleBar.innerHTML = '<div class="schedule-header"><div class="countdown-card"><div class="countdown-card__num">' + daysText + '</div><div class="countdown-card__label">距离考试</div></div></div>';
        monthKeys.forEach(function(month) {
          var div = document.createElement('div'); div.className = 'tl-month-group';
          var html = '<div class="tl-month__label">' + month + '</div><div class="tl-month__events">';
          groups[month].forEach(function(item) {
            html += '<div class="tl-month__event" title="' + (item.desc || '') + '">' + item.event + '</div>';
          });
          html += '</div>';
          div.innerHTML = html;
          scheduleBar.appendChild(div);
        });
      }
    }).catch(function() {});
  };

  // ── Admission Summary ──
  window.updateAdmissionSummary = function() {
    var s = document.getElementById('admissionSummary');
    if (!s) return;
    var pid = selProvince.value; var pn = (typeof PROVINCE_DATA !== 'undefined' && PROVINCE_DATA[pid]?.name) || '\u5C71\u4E1C';
    fetch('/api/admission/' + pid).then(function(r) { return r.json(); }).then(function(d) { s.textContent = pn + ' ' + (d.year || '2026') + ' \u5E74 \u6700\u65B0\u62DB\u5F55\u6570\u636E'; }).catch(function() {});
  };

  // ── Schedule Trigger ──
  var scheduleTrigger = document.getElementById('scheduleTrigger');
  if (scheduleTrigger) {
    scheduleTrigger.addEventListener('click', function() { window.loadScheduleBar(); /* already called on province change */ });
  }

  setTimeout(function() { loadScheduleBar(); }, 100);
  buildCourseCards();

  // ── Theme Switch ──
  (function() {
    var btn = document.getElementById('themeBtn');
    var html = document.documentElement;
        function apply(t) { html.setAttribute('data-theme', t); }
    var saved = localStorage.getItem('cz_theme');
    apply(saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) { if (!localStorage.getItem('cz_theme')) apply(e.matches ? 'dark' : 'light'); });
    if (btn) btn.addEventListener('click', function() { var cur = html.getAttribute('data-theme') || 'light'; var next = cur === 'dark' ? 'light' : 'dark'; apply(next); localStorage.setItem('cz_theme', next); fixAdmissionTheme(next); });
    function fixAdmissionTheme(t) {
      var wrap = document.getElementById('admissionTableWrap');
      if (wrap) wrap.style.background = t === 'dark' ? '#2a2a2e' : '';
    }
    setTimeout(function() { fixAdmissionTheme(html.getAttribute('data-theme') || 'light'); }, 300);
  })();

  // ── QA: Assistants ──
  // ── QA: Province-aware Assistants ──
  function buildAssistants() {
    var astGrid = document.getElementById('assistantGrid');
    if (!astGrid) return;
    var pid = document.getElementById('selProvince').value;
    var provData = typeof PROVINCE_DATA !== 'undefined' && PROVINCE_DATA[pid];
    var subjects = provData && provData.subjects ? provData.subjects : ['\u5927\u5B66\u82F1\u8BED', '\u9AD8\u7B49\u6570\u5B66', '\u5927\u5B66\u8BED\u6587', '\u8BA1\u7B97\u673A\u57FA\u7840'];
    var allAsts = {
      '\u5927\u5B66\u82F1\u8BED': { n: '\u5468\u8001\u5E08', img: '/public/images/teachers/teacher-zhou.svg', c: '#4F6EF7' },
      '\u9AD8\u7B49\u6570\u5B66': { n: '\u5218\u8001\u5E08', img: '/public/images/teachers/teacher-liu.svg', c: '#E0607A' },
      '\u5927\u5B66\u8BED\u6587': { n: '\u9648\u8001\u5E08', img: '/public/images/teachers/teacher-chen-female.svg', c: '#20B2AA' },
      '\u8BA1\u7B97\u673A\u57FA\u7840': { n: '\u674E\u8001\u5E08', img: '/public/images/teachers/teacher-chen.svg', c: '#E8A040' },
    };
    astGrid.innerHTML = '';
    subjects.forEach(function(sub) {
      var a = allAsts[sub];
      if (!a) return;
      var card = document.createElement('a');
      card.href = 'https://chengze.online/live/teacher'; card.target = '_blank'; card.rel = 'noopener';
      card.className = 'assistant-card';
      card.innerHTML = '<div class="assistant-card__avatar" style="background:' + a.c + ';"><img src="' + a.img + '" alt="' + a.n + '" style="width:100%;height:100%;border-radius:12px;object-fit:cover;"></div><div class="assistant-card__body"><div class="assistant-card__top"><h3>' + a.n + '</h3><span class="assistant-card__label">' + sub + '</span></div><span class="assistant-card__action">\u54A8\u8BE2</span></div>';
      astGrid.appendChild(card);
    });
  }
  buildAssistants();

  // ── QA: Province-aware AI Tutors ──
  function buildAITutors() {
    var aiGrid = document.getElementById('aiTutorGrid');
    if (!aiGrid) return;
    var pid = document.getElementById('selProvince').value;
    var provData = typeof PROVINCE_DATA !== 'undefined' && PROVINCE_DATA[pid];
    var subjects = provData && provData.subjects ? provData.subjects : ['\u5927\u5B66\u82F1\u8BED', '\u9AD8\u7B49\u6570\u5B66', '\u5927\u5B66\u8BED\u6587', '\u8BA1\u7B97\u673A\u57FA\u7840'];
    var allAI = {
      '\u5927\u5B66\u82F1\u8BED': { n: '\u82F1\u8BED AI', c: '#2563eb', d: '\u8BCD\u6C47\u3001\u8BED\u6CD5\u3001\u9605\u8BFB\u3001\u5199\u4F5C\u5168\u65B9\u4F4D\u8F85\u5BFC' },
      '\u9AD8\u7B49\u6570\u5B66': { n: '\u6570\u5B66 AI', c: '#7c3aed', d: '\u9AD8\u7B49\u6570\u5B66\u3001\u7EDF\u8BA1\u95EE\u9898\u5373\u65F6\u89E3\u7B54' },
      '\u5927\u5B66\u8BED\u6587': { n: '\u8BED\u6587 AI', c: '#059669', d: '\u6587\u5B66\u5E38\u8BC6\u3001\u53E4\u6587\u7FFB\u8BD1\u3001\u4F5C\u6587\u6307\u5BFC' },
      '\u8BA1\u7B97\u673A\u57FA\u7840': { n: '\u8BA1\u7B97\u673A AI', c: '#f59e0b', d: 'Office\u3001\u7F51\u7EDC\u3001\u6570\u636E\u7ED3\u6784\u7B49\u8BFE\u7A0B\u95EE\u9898' },
    };
    aiGrid.innerHTML = '';
    subjects.forEach(function(sub) {
      var s = allAI[sub];
      if (!s) return;
      var card = document.createElement('a');
      card.href = 'https://chengze.online/AI-tutor/'; card.target = '_blank'; card.rel = 'noopener';
      card.className = 'ai-card';
      card.innerHTML = '<div class="ai-card__icon" style="background:' + s.c + '11;color:' + s.c + ';"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></div><h3>' + s.n + '</h3><p>' + s.d + '</p><span class="ai-card__action">\u5F00\u59CB\u63D0\u95EE \u2192</span>';
      aiGrid.appendChild(card);
    });
  }
  buildAITutors();

  // ── Soul Feed ──
  var feed = document.getElementById('soulFeed');
  if (feed) {
    var posts = [
      { a:'\u5C0F', c:'#2d5f6e', n:'\u5C0F\u9648\u540C\u5B66', b:'\u5DF2\u4E0A\u5CB8', m:'\u6D59\u6C5F\u7406\u5DE5\u5927\u5B66', t:'\u7EC8\u4E8E\u4E0A\u5CB8\u4E86\uff01\u611F\u8C22\u5404\u4F4D\u8001\u5E08\u548CAI\u52A9\u6559\uff01', tg:['\u4E0A\u5CB8\u559C\u62A5'], lk:128, cm:34 },
      { a:'\u674E', c:'#7c3aed', n:'\u5C0F\u674E\u540C\u5B66', b:'\u5907\u8003\u4E2D', m:'\u76EE\u6807: \u676D\u5DDE\u7535\u5B50\u79D1\u6280', t:'\u4ECA\u65E5\u5B66\u4E60\u6253\u5361\u2705 \u82F1\u8BED\u9605\u8BFB+\u9AD8\u6570\u590D\u4E60', tg:['\u5B66\u4E60\u6253\u5361'], lk:45, cm:12 },
      { a:'\u738B', c:'#059669', n:'\u5C0F\u738B\u540C\u5B66', b:'\u5907\u8003\u4E2D', m:'\u6D59\u6C5F\u8D22\u7ECF\u5927\u5B66', t:'\u5206\u4EAB\u82F1\u8BED\u4F5C\u6587\u6A21\u677F\uff0c\u8003\u573A\u76F4\u63A5\u5957\u7528\uff01', tg:['\u8D44\u6599\u5206\u4EAB'], lk:89, cm:23 },
      { a:'\u5F20', c:'#f59e0b', n:'\u5F20\u5B66\u957F', b:'\u5DF2\u4E0A\u5CB8', m:'\u6D59\u6C5F\u5546\u5DE5\u5927\u5B66', t:'\u9AD8\u6570\u57FA\u7840\u4E00\u5B9A\u8981\u7262\uff01', tg:['\u9AD8\u6570','\u5907\u8003\u5EFA\u8BAE'], lk:203, cm:56 },
      { a:'\u5218', c:'#dc2626', n:'\u5218\u540C\u5B66', b:'\u5907\u8003\u4E2D', m:'\u5B81\u6CE2\u5927\u5B66', t:'\u6709\u4EBA\u4E00\u8D77\u7EC4\u961F\u5B66\u4E60\u5417\uff1f', tg:['\u627E\u5B66\u4E60\u642D\u5B50'], lk:34, cm:67 },
      { a:'\u8D75', c:'#0891b2', n:'\u8D75\u5B66\u59D0', b:'\u5DF2\u4E0A\u5CB8', m:'\u6D59\u6C5F\u79D1\u6280\u5927\u5B66', t:'\u8BED\u6587\u5FC5\u80CC\u7BC7\u76EE\u6E05\u5355\uff0c\u9700\u8981\u81EA\u53D6', tg:['\u8BED\u6587','\u8D44\u6599\u5206\u4EAB'], lk:167, cm:41 },
    ];
    feed.innerHTML = '';
    posts.forEach(function(p) {
      var el = document.createElement('div'); el.className = 'soul-post';
      el.innerHTML = '<div class="soul-post__header"><div class="soul-post__avatar" style="background:' + p.c + ';">' + p.a + '</div><div class="soul-post__info"><div class="soul-post__name">' + p.n + '<span class="soul-post__badge">' + p.b + '</span></div><div class="soul-post__meta">' + p.m + '</div></div></div><div class="soul-post__body">' + p.t + '</div><div class="soul-post__tags">' + p.tg.map(function(t){return '<span class="soul-post__tag">'+t+'</span>';}).join('') + '</div><div class="soul-post__actions"><button class="soul-post__action soul-like-btn" data-likes="' + p.lk + '"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg><span>' + p.lk + '</span></button><button class="soul-post__action"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span>' + p.cm + '</span></button><button class="soul-post__action"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg><span>\u5206\u4EAB</span></button></div>';
      feed.appendChild(el);
    });
    document.querySelectorAll('.soul-like-btn').forEach(function(btn) {
      btn.addEventListener('click', function() { var s = btn.querySelector('span'); var c = parseInt(btn.dataset.likes); if (btn.classList.contains('soul-post__action--liked')) { c--; btn.classList.remove('soul-post__action--liked'); } else { c++; btn.classList.add('soul-post__action--liked'); } btn.dataset.likes = c; s.textContent = c; });
    });
  }

  // ── Course Detail Modal ──
  window.openCourseDetail = function(cls, year, provinceName) {
    var modal = document.getElementById('courseDetailModal');
    var overlay = document.getElementById('courseDetailOverlay');
    if (!modal) { createCourseDetailModal(); modal = document.getElementById('courseDetailModal'); overlay = document.getElementById('courseDetailOverlay'); }
    if (!modal) return;
    var title = document.getElementById('cdTitle');
    var sub = document.getElementById('cdSub');
    var body = document.getElementById('cdBody');
    title.textContent = year + '\u5E74 ' + provinceName + '\u4E13\u5347\u672C ' + cls.name;
    sub.textContent = cls.tag + ' \u00B7 ' + cls.duration + ' \u00B7 ' + cls.sessions + '\u8BFE\u65F6';
    var catalog = cls.catalog || ['\u7B2C\u4E00\u8BB2 \u8BFE\u7A0B\u5BFC\u5B66','\u7B2C\u4E8C\u8BB2 \u57FA\u7840\u77E5\u8BC6','\u7B2C\u4E09\u8BB2 \u6838\u5FC3\u8003\u70B9','\u7B2C\u56DB\u8BB2 \u7EFC\u5408\u8BAD\u7EC3'];
    var calendar = cls.calendar || ['\u7B2C\u4E00\u5468 \u5F00\u8BFE','\u7B2C\u4E8C\u5468 \u8BFE\u7A0B','\u7B2C\u4E09\u5468 \u8BFE\u7A0B','\u7B2C\u56DB\u5468 \u6D4B\u9A8C'];
    var html = '<div class="cd-grid">';
    html += '<div class="cd-section"><h4>\u57FA\u672C\u4FE1\u606F</h4><div class="cd-info-grid">';
    html += '<div class="cd-info-item"><span class="cd-info-label">\u6559\u5E08</span><span class="cd-info-value">' + (cls.teacher || '\u540D\u5E08\u56E2\u961F') + '</span></div>';
    html += '<div class="cd-info-item"><span class="cd-info-label">\u5F00\u8BFE\u65F6\u95F4</span><span class="cd-info-value">' + (cls.startDate || '\u5F85\u5B9A') + '</span></div>';
    html += '<div class="cd-info-item"><span class="cd-info-label">\u8BFE\u65F6</span><span class="cd-info-value">' + cls.sessions + '\u8BFE\u65F6</span></div>';
    html += '<div class="cd-info-item"><span class="cd-info-label">\u4EF7\u683C</span><span class="cd-info-value cd-price">' + cls.price + '</span></div>';
    html += '</div></div><div class="cd-section"><h4>\u8BFE\u7A0B\u76EE\u5F55</h4><div class="cd-catalog">';
    catalog.forEach(function(item, i) { html += '<div class="cd-catalog-item"><span class="cd-catalog-num">' + (i+1) + '</span><span>' + item + '</span></div>'; });
    html += '</div></div><div class="cd-section"><h4>\u8BFE\u7A0B\u65E5\u5386</h4><div class="cd-calendar">';
    calendar.forEach(function(item) { html += '<div class="cd-cal-item"><div class="cd-cal-dot"></div><span>' + item + '</span></div>'; });
    html += '</div></div><a href="https://chengze.online/live/student" target="_blank" rel="noopener" class="cd-action-btn">\u53BB\u5B66\u4E60</a></div>';
    body.innerHTML = html;
    modal.classList.add('open'); overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  function createCourseDetailModal() {
    var html = '<div class="modal-overlay" id="courseDetailOverlay"></div><div class="course-detail-modal" id="courseDetailModal"><div class="course-detail-modal__header"><div><h3 class="course-detail-modal__title" id="cdTitle">\u8BFE\u7A0B\u8BE6\u60C5</h3><p class="course-detail-modal__sub" id="cdSub"></p></div><button class="course-detail-modal__close" id="cdClose"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div><div class="course-detail-modal__body" id="cdBody"></div></div>';
    var div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstElementChild);
    document.body.appendChild(div.lastElementChild);
    setTimeout(function() {
      document.getElementById('cdClose').addEventListener('click', function() {
        document.getElementById('courseDetailModal').classList.remove('open');
        document.getElementById('courseDetailOverlay').classList.remove('open');
        document.body.style.overflow = '';
      });
      document.getElementById('courseDetailOverlay').addEventListener('click', function() {
        document.getElementById('courseDetailModal').classList.remove('open');
        document.getElementById('courseDetailOverlay').classList.remove('open');
        document.body.style.overflow = '';
      });
    }, 0);
  }

  // ── Admission Modal ──
  window.openAdmissionModal = function() {
    var modal = document.getElementById('admissionModal');
    var overlay = document.getElementById('admissionOverlay');
    var tbody = document.getElementById('admissionBody');
    var search = document.getElementById('admissionSearch');
    var pLabel = document.getElementById('admissionProvince');
    var cLabel = document.getElementById('admissionCount');
    if (!modal || !overlay) return;
    var pid = selProvince.value;
    var pname = '山东';
    try { if (typeof PROVINCE_DATA !== 'undefined') pname = (PROVINCE_DATA[pid] || {}).name || '山东'; } catch(e) {}
    fetch('/api/admission/' + pid).then(function(r){return r.json();}).then(function(d){
      var list = d.plan || [];
      if (pLabel) pLabel.textContent = pname + ' \u00B7 ' + (d.year || '2026') + ' \u5E74';
      if (cLabel) cLabel.textContent = '\u5171 ' + list.length + ' \u6761\u8BB0\u5F55';
      tbody.innerHTML = '';
      for (var i = 0; i < list.length; i++) {
        var item = list[i];
        var cls = '';
        if (item.minScore) { if (item.minScore >= 300) cls = 'score-high'; else if (item.minScore >= 280) cls = 'score-mid'; else cls = 'score-low'; }
        var score = item.minScore ? '<span class="' + cls + '">' + item.minScore.toFixed(2) + '</span>' : '<span style="color:#94a3b8;">\u2014</span>';
        var plan = item.planCount ? item.planCount : '<span style="color:#94a3b8;">\u2014</span>';
        tbody.innerHTML += '<tr><td><strong>' + item.university + '</strong></td><td>' + item.major + '</td><td>' + plan + '</td><td>' + score + '</td></tr>';
      }
      modal.classList.add('open'); overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
      if (search) { search.value = ''; search.oninput = function(){ var q=this.value.toLowerCase(); var rows=tbody.querySelectorAll('tr'); for(var j=0;j<rows.length;j++){rows[j].style.display=rows[j].textContent.toLowerCase().indexOf(q)>=0?'':'none';}};}
    });
  };

  var admissionClose = document.getElementById('admissionClose');
  var admissionOverlay = document.getElementById('admissionOverlay');
  if (admissionClose) admissionClose.addEventListener('click', function() {
    document.getElementById('admissionModal').classList.remove('open');
    document.getElementById('admissionOverlay').classList.remove('open');
    document.body.style.overflow = '';
  });
  if (admissionOverlay) admissionOverlay.addEventListener('click', function() {
    document.getElementById('admissionModal').classList.remove('open');
    document.getElementById('admissionOverlay').classList.remove('open');
    document.body.style.overflow = '';
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var m1 = document.getElementById('admissionModal');
      var m2 = document.getElementById('courseDetailModal');
      if (m1 && m1.classList.contains('open')) { m1.classList.remove('open'); document.getElementById('admissionOverlay').classList.remove('open'); document.body.style.overflow = ''; }
      if (m2 && m2.classList.contains('open')) { m2.classList.remove('open'); document.getElementById('courseDetailOverlay').classList.remove('open'); document.body.style.overflow = ''; }
    }
  });



  // ── Resource Tabs ──
  (function() {
    var tabs = document.querySelectorAll('.res-tab');
    var panes = {
      syllabus: document.getElementById('resSyllabus'),
      papers: document.getElementById('resPapers'),
      major: document.getElementById('resMajor'),
      admission: document.getElementById('resAdmission')
    };

    function getProvinceId() {
      var sel = document.getElementById('selProvince');
      return sel ? sel.value : 'shandong';
    }
    function getProvinceName() {
      var pid = getProvinceId();
      return (typeof PROVINCE_DATA !== 'undefined' && PROVINCE_DATA[pid]?.name) || '山东';
    }

    function loadTabContent(tabId) {
      var pid = getProvinceId();
      var pname = getProvinceName();
      var syllabus = document.getElementById('resSyllabus');
      var papers = document.getElementById('resPapers');
      var major = document.getElementById('resMajor');
      var admission = document.getElementById('resAdmission');

      // Syllabus
      if (syllabus) {
        fetch('/api/syllabus/' + pid).then(function(r){return r.json();}).then(function(syl){
          var pdf = '/data/2026-' + pid + '-syllabus.pdf';
          var html = '<div class="res-list">';
          html += '<div class="res-file"><div class="res-file__icon">PDF</div><div class="res-file__info"><strong>' + pname + '省 2026 年专升本考试大纲</strong><span>' + (syl.authority || '官方文件') + ' ' + (syl.date || '') + '</span></div><div style="display:flex;gap:8px;flex-shrink:0;"><a href="' + pdf + '" target="_blank" class="res-action">查看</a><a href="' + pdf + '" download class="res-action res-action--dl">下载</a></div></div>';
          html += '</div>';
          syllabus.innerHTML = html;
        });
      }      // Papers
      if (papers) {
        var html = '<div class="res-list">';
        if (pid === 'shandong') {
          var items = [
            { file: '2024-shandong-english.pdf', name: '大学英语 真题', year: '2024' },
            { file: '2024-shandong-chinese.pdf', name: '大学语文 真题', year: '2024' },
            { file: '2024-shandong-computer.pdf', name: '计算机基础 真题', year: '2024' },
            { file: '2024-shandong-math1.pdf', name: '高等数学Ⅰ 真题', year: '2024' },
            { file: '2024-shandong-math2.pdf', name: '高等数学Ⅱ 真题', year: '2024' },
            { file: '2024-shandong-math3.pdf', name: '高等数学Ⅲ 真题', year: '2024' },
          ];
          items.forEach(function(item) {
            html += '<div class="res-file"><div class="res-file__icon">PDF</div><div class="res-file__info"><strong>' + pname + '省 ' + item.name + '</strong><span>' + item.year + ' 年 专升本考试</span></div><div style="display:flex;gap:8px;flex-shrink:0;"><a href="/data/' + item.file + '/" target="_blank" class="res-action">查看</a><a href="/data/' + item.file + '" download class="res-action res-action--dl">下载</a></div></div>';
          });
        } else {
          html += '<div class="res-empty">' + pname + '省 历年真题持续更新中</div>';
        }
        html += '</div>';
        papers.innerHTML = html;
      }
      // Major (placeholder)
      if (major) {
        major.innerHTML = '<div class="res-empty">' + pname + '省 官方公告持续更新中</div>';
      }
      // Admission - inline table
      if (admission) {
        var pid = document.getElementById('selProvince').value;
        fetch('/api/admission/' + pid).then(function(r){return r.json();}).then(function(d){
          var list = d.plan || [];
          if (list.length === 0) {
            admission.innerHTML = '<div class="res-empty">' + pname + '省 招录数据持续更新中</div>';
            return;
          }
          var html = '<div class="res-search"><input type="text" id="inlineAdmissionSearch" placeholder="搜索院校或专业..." class="admission-search__input"></div><div class="admission-table-wrap" id="admissionTableWrap" style="max-height:300px;overflow-y:auto;"><table class="admission-table"><thead><tr><th>院校</th><th>专业</th><th>计划数</th><th>录取线</th></tr></thead><tbody id="inlineAdmissionBody">';
          for (var i = 0; i < list.length; i++) {
            var item = list[i];
            var cls = '';
            if (item.minScore) { if (item.minScore >= 300) cls = 'score-high'; else if (item.minScore >= 280) cls = 'score-mid'; else cls = 'score-low'; }
            var score = item.minScore ? '<span class="' + cls + '">' + item.minScore.toFixed(2) + '</span>' : '<span style="color:#94a3b8;">—</span>';
            var plan = item.planCount ? item.planCount : '<span style="color:#94a3b8;">—</span>';
            html += '<tr><td><strong>' + item.university + '</strong></td><td>' + item.major + '</td><td>' + plan + '</td><td>' + score + '</td></tr>';
          }
          html += '</tbody></table></div>';
          admission.innerHTML = html;
          // Search
          setTimeout(function(){
            var inp = document.getElementById('inlineAdmissionSearch');
            if (inp) {
              inp.oninput = function(){
                var q = this.value.toLowerCase();
                var rows = document.querySelectorAll('#inlineAdmissionBody tr');
                for (var j = 0; j < rows.length; j++) {
                  rows[j].style.display = rows[j].textContent.toLowerCase().indexOf(q) >= 0 ? '' : 'none';
                }
              };
            }
          }, 50);
          // Fix dark mode background
          var wrap = document.getElementById('admissionTableWrap');
          if (wrap) {
            var theme = document.documentElement.getAttribute('data-theme');
            if (theme === 'dark') wrap.style.background = '#1e293b';
          }
        }).catch(function(){});
      }
    }

    tabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        tabs.forEach(function(t) { t.classList.remove('active'); });
        tab.classList.add('active');
        Object.keys(panes).forEach(function(k) {
          if (panes[k]) panes[k].classList.toggle('active', k === tab.dataset.tab);
        });
        loadTabContent(tab.dataset.tab);
      });
    });

    // Load initial content
    loadTabContent('syllabus');

    // Reload when province changes
    var sp = document.getElementById('selProvince');
    if (sp) {
      sp.addEventListener('change', function() {
        var active = document.querySelector('.res-tab.active');
        if (active) loadTabContent(active.dataset.tab);
      });
    }
  })();});

document.addEventListener('DOMContentLoaded', function () {
  var header = document.getElementById('siteHeader');
  var backTop = document.getElementById('backTop');

  function onScroll() {
    if (header) header.classList.toggle('scrolled', window.scrollY > 10);
    if (backTop) backTop.classList.toggle('show', window.scrollY > 480);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var navToggle = document.getElementById('navToggle');
  var mainNav = document.getElementById('mainNav');
  if (navToggle && mainNav) {
    function closeNav() {
      mainNav.classList.remove('nav-open');
      navToggle.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.setAttribute('aria-label', '打开菜单');
    }
    navToggle.addEventListener('click', function () {
      var open = mainNav.classList.toggle('nav-open');
      navToggle.classList.toggle('open', open);
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      navToggle.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单');
    });
    mainNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', closeNav);
    });
    document.addEventListener('click', function (e) {
      if (!mainNav.contains(e.target) && e.target !== navToggle && !navToggle.contains(e.target)) closeNav();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeNav();
    });
  }

  function revealVisible(el) {
    el.classList.add('visible');
  }
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          revealVisible(entry.target);
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function (el) { revealObserver.observe(el); });
  } else {
    reveals.forEach(revealVisible);
  }
  reveals.forEach(function (el) {
    var rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight) revealVisible(el);
  });
  setTimeout(function () {
    reveals.forEach(revealVisible);
  }, 200);

  var countdown = document.getElementById('countdown');
  if (countdown) {
    var targetTime = new Date(countdown.getAttribute('data-target')).getTime();
    function pad(n) { return String(n).padStart(2, '0'); }
    function tick() {
      var diff = Math.max(targetTime - Date.now(), 0);
      var d = Math.floor(diff / 86400000);
      var h = Math.floor((diff % 86400000) / 3600000);
      var m = Math.floor((diff % 3600000) / 60000);
      var s = Math.floor((diff % 60000) / 1000);
      countdown.querySelectorAll('[data-unit]').forEach(function (b) {
        var unit = b.getAttribute('data-unit');
        b.textContent = unit === 'd' ? pad(d) : unit === 'h' ? pad(h) : unit === 'm' ? pad(m) : pad(s);
      });
    }
    tick();
    setInterval(tick, 1000);
  }

  function animateCount(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var suffix = el.getAttribute('data-suffix') || '';
    var decimals = (el.getAttribute('data-count').indexOf('.') >= 0) ? 1 : 0;
    var duration = 1200;
    var start = null;
    function format(value) {
      return value.toFixed(decimals).replace(/\.0$/, '') + suffix;
    }
    function step(ts) {
      if (start === null) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = format(target * eased);
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = format(target);
    }
    requestAnimationFrame(step);
    setTimeout(function () { el.textContent = format(target); }, duration + 100);
  }

  var counters = document.querySelectorAll('[data-count]');
  function startCounter(el) {
    if (el.getAttribute('data-counted')) return;
    el.setAttribute('data-counted', '1');
    animateCount(el);
  }
  if ('IntersectionObserver' in window) {
    var counterObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          startCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    counters.forEach(function (el) { counterObserver.observe(el); });
  } else {
    counters.forEach(startCounter);
  }
  setTimeout(function () {
    counters.forEach(startCounter);
  }, 400);

  document.querySelectorAll('.faq-q').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.faq-item');
      var answer = item.querySelector('.faq-a');
      var willOpen = !item.classList.contains('open');
      item.closest('.faq-list').querySelectorAll('.faq-item.open').forEach(function (other) {
        if (other !== item) {
          other.classList.remove('open');
          other.querySelector('.faq-a').style.maxHeight = '0px';
        }
      });
      item.classList.toggle('open', willOpen);
      answer.style.maxHeight = willOpen ? answer.scrollHeight + 'px' : '0px';
    });
  });

  if (backTop) {
    backTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  var consultBtn = document.getElementById('consultBtn');
  if (consultBtn) {
    consultBtn.addEventListener('click', function () {
      var target = document.querySelector('.cta-banner') || document.querySelector('.form-card') || document.querySelector('footer');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function showToast(message) {
    var toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      toast.innerHTML = '<span class="t-ic">✓</span><span class="t-msg"></span>';
      document.body.appendChild(toast);
    }
    toast.querySelector('.t-msg').textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () { toast.classList.remove('show'); }, 2600);
  }

  var leadModal = null;

  function closeLeadModal() {
    if (!leadModal) return;
    leadModal.classList.remove('open');
    leadModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function ensureLeadModal() {
    if (leadModal) return leadModal;
    leadModal = document.createElement('div');
    leadModal.className = 'lead-modal';
    leadModal.setAttribute('aria-hidden', 'true');
    leadModal.innerHTML =
      '<div class="lead-backdrop" data-lead-close></div>' +
      '<div class="lead-dialog" role="dialog" aria-modal="true" aria-labelledby="leadModalTitle">' +
        '<button class="lead-close" type="button" data-lead-close aria-label="关闭">✕</button>' +
        '<span class="kicker" id="leadModalKicker">预约报名</span>' +
        '<h2 class="lead-title" id="leadModalTitle">领取备考资料</h2>' +
        '<p class="lead-sub" id="leadModalSub"></p>' +
        '<form id="leadForm" novalidate>' +
          '<div class="form-grid">' +
            '<div class="field">' +
              '<label for="leadName">姓名<em>*</em></label>' +
              '<input type="text" id="leadName" name="name" placeholder="请输入您的姓名" required>' +
              '<span class="err">请填写姓名</span>' +
            '</div>' +
            '<div class="field">' +
              '<label for="leadPhone">手机号<em>*</em></label>' +
              '<input type="tel" id="leadPhone" name="phone" placeholder="请输入 11 位手机号" maxlength="11" required>' +
              '<span class="err">请填写正确的手机号</span>' +
            '</div>' +
            '<div class="field">' +
              '<label for="leadGrade">当前阶段<em>*</em></label>' +
              '<select id="leadGrade" name="grade" required>' +
                '<option value="">请选择</option>' +
                '<option>大一</option>' +
                '<option>大二</option>' +
                '<option>大三（应届备考）</option>' +
                '<option>已毕业 / 在职备考</option>' +
              '</select>' +
              '<span class="err">请选择当前阶段</span>' +
            '</div>' +
            '<div class="field">' +
              '<label for="leadType">报考类型<em>*</em></label>' +
              '<select id="leadType" name="type" required>' +
                '<option value="">请选择</option>' +
                '<option>统招专升本（全日制）</option>' +
                '<option>自考专升本</option>' +
                '<option>成人高考专升本</option>' +
                '<option>还不确定，需要咨询</option>' +
              '</select>' +
              '<span class="err">请选择报考类型</span>' +
            '</div>' +
            '<div class="field full">' +
              '<label for="leadMessage">想了解的内容（可选）</label>' +
              '<textarea id="leadMessage" name="message" rows="3" placeholder="目标院校、当前基础、想咨询的问题等"></textarea>' +
            '</div>' +
          '</div>' +
          '<button class="btn btn-primary btn-lg btn-block" type="submit" style="margin-top:22px;">提交</button>' +
          '<p class="form-tip">🔒 您的信息仅用于课程咨询，严格保密，绝不外泄</p>' +
        '</form>' +
      '</div>';
    document.body.appendChild(leadModal);

    leadModal.querySelectorAll('[data-lead-close]').forEach(function (el) {
      el.addEventListener('click', closeLeadModal);
    });
    leadModal.addEventListener('click', function (e) {
      if (e.target === leadModal) closeLeadModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeLeadModal();
    });

    var leadForm = document.getElementById('leadForm');
    leadForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var valid = true;
      leadForm.querySelectorAll('.field').forEach(function (field) {
        var input = field.querySelector('input, select, textarea');
        if (!input || !input.required) return;
        var ok = input.value.trim() !== '';
        if (input.type === 'tel') ok = /^1\d{10}$/.test(input.value.trim());
        field.classList.toggle('invalid', !ok);
        if (!ok) valid = false;
      });
      if (!valid) return;
      showToast('提交成功，课程顾问将在 1 个工作日内联系您');
      leadForm.reset();
      closeLeadModal();
    });

    return leadModal;
  }

  function openLeadModal(type) {
    var modal = ensureLeadModal();
    var title = modal.querySelector('#leadModalTitle');
    var sub = modal.querySelector('#leadModalSub');
    var submit = modal.querySelector('#leadForm button[type="submit"]');
    if (type === 'trial') {
      title.textContent = '预约免费试听';
      sub.textContent = '每人可免费试听 3 节课，满意再报名，0 风险体验';
      submit.textContent = '提交试听预约';
    } else {
      title.textContent = '领取备考资料';
      sub.textContent = '《2027 专升本报考指南》+ 近 3 年真题卷，电子版免费送';
      submit.textContent = '免费领取资料';
    }
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    var first = modal.querySelector('input');
    if (first) first.focus();
  }

  document.querySelectorAll('[data-lead-form]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      openLeadModal(btn.getAttribute('data-lead-form'));
    });
  });

  var enrollForm = document.getElementById('enrollForm');
  if (enrollForm) {
    enrollForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var valid = true;
      enrollForm.querySelectorAll('.field').forEach(function (field) {
        var input = field.querySelector('input, select, textarea');
        if (!input || !input.required) return;
        var ok = input.value.trim() !== '';
        if (input.type === 'tel') ok = /^1\d{10}$/.test(input.value.trim());
        field.classList.toggle('invalid', !ok);
        if (!ok) valid = false;
      });
      if (!valid) return;
      showToast('提交成功，课程顾问将在 1 个工作日内联系您');
      enrollForm.reset();
    });
  }

  var feedbackForm = document.getElementById('feedbackForm');
  if (feedbackForm) {
    feedbackForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var valid = true;
      feedbackForm.querySelectorAll('.field').forEach(function (field) {
        var input = field.querySelector('input, select, textarea');
        if (!input || !input.required) return;
        var ok = input.value.trim() !== '';
        if (input.type === 'tel') ok = /^1\d{10}$/.test(input.value.trim());
        field.classList.toggle('invalid', !ok);
        if (!ok) valid = false;
      });
      if (!valid) return;
      showToast('反馈已提交，感谢您的建议');
      feedbackForm.reset();
    });
  }
});

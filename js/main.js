/**
 * 承泽教育 — Main JavaScript
 */

document.addEventListener('DOMContentLoaded', () => {

  // ── Mobile menu toggle ──
  const menuToggle = document.getElementById('menuToggle');
  const nav = document.getElementById('nav');

  if (menuToggle && nav) {
    menuToggle.addEventListener('click', () => {
      menuToggle.classList.toggle('active');
      nav.classList.toggle('open');
    });

    nav.querySelectorAll('.nav__link').forEach(link => {
      link.addEventListener('click', () => {
        menuToggle.classList.remove('active');
        nav.classList.remove('open');
      });
    });
  }

  // ── Header scroll effect ──
  const header = document.getElementById('header');

  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });

  // ── Back to top ──
  const backToTop = document.getElementById('backToTop');

  if (backToTop) {
    window.addEventListener('scroll', () => {
      backToTop.classList.toggle('visible', window.scrollY > 400);
    }, { passive: true });

    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ── Subject Selection Modal ──
  const modal = document.getElementById('subjectModal');
  const overlay = document.getElementById('subjectModalOverlay');
  const closeBtn = document.getElementById('subjectModalClose');
  const triggers = document.querySelectorAll('.js-open-subjects');

  function openModal(e) {
    e.preventDefault();
    modal.classList.add('open');
    document.body.classList.add('modal-open');
  }

  function closeModal() {
    modal.classList.remove('open');
    document.body.classList.remove('modal-open');
  }

  if (modal && overlay && closeBtn) {
    triggers.forEach(el => el.addEventListener('click', openModal));
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  }

  // ── Count-up animation ──
  const countEls = document.querySelectorAll('.numbers__num, .hero__stat strong[data-count]');

  if (countEls.length && 'IntersectionObserver' in window) {
    let counted = new Set();

    const countObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting || counted.has(entry.target)) return;
        counted.add(entry.target);

        const target = parseInt(entry.target.dataset.target || entry.target.dataset.count || 0);
        const suffix = (entry.target.dataset.target ? '+' : (target > 100 ? '+'));
        const isRate = entry.target.dataset.target && entry.target.closest('.numbers__item');
        const displaySuffix = isRate ? (target === 96 ? '%' : '+') : (target > 100 ? '+' : '%');
        const duration = 1500;
        const start = performance.now();

        function update(now) {
          const elapsed = now - start;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          const current = Math.round(eased * target);
          const finalSuffix = progress >= 1 ?
            (target === 96 ? '%' : (target >= 50 && target < 100 ? '+' : '+')) : '';
          entry.target.textContent = current.toLocaleString() + (progress >= 1 ? finalSuffix : '');
          if (progress < 1) requestAnimationFrame(update);
        }

        requestAnimationFrame(update);
        countObserver.unobserve(entry.target);
      });
    }, { threshold: 0.5 });

    countEls.forEach(el => countObserver.observe(el));
  }

  // ── Scroll reveal ──
  const revealSections = [
    '.portals__grid', '.features__grid', '.numbers__grid',
    '.about__body', '.testimonials__grid', '.cta-box'
  ];

  const revealElements = document.querySelectorAll(revealSections.join(','));

  if (revealElements.length && 'IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('reveal-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    revealElements.forEach(el => revealObserver.observe(el));
  }

  // ── Smooth scroll for anchor links ──
  document.querySelectorAll('a[href^="#"]:not(.js-open-subjects)').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

});

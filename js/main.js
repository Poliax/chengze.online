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

  // ── Count-up animation ──
  const countEls = document.querySelectorAll('.numbers__num, .hero__stat strong[data-count]');

  if (countEls.length && 'IntersectionObserver' in window) {
    let counted = new Set();

    const countObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting || counted.has(entry.target)) return;
        counted.add(entry.target);

        const target = parseInt(entry.target.dataset.target || entry.target.dataset.count || 0);
        const suffix = entry.target.dataset.suffix || (target > 100 ? '+' : '%');
        const duration = 1500;
        const start = performance.now();

        function update(now) {
          const elapsed = now - start;
          const progress = Math.min(elapsed / duration, 1);
          // Ease out cubic
          const eased = 1 - Math.pow(1 - progress, 3);
          const current = Math.round(eased * target);
          entry.target.textContent = current.toLocaleString() + (progress >= 1 ? suffix : '');
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
    '.portals__grid',
    '.features__grid',
    '.numbers__grid',
    '.about__body',
    '.testimonials__grid',
    '.cta-box'
  ];

  const revealElements = document.querySelectorAll(revealSections.join(','));

  if (revealElements.length && 'IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    revealElements.forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(30px)';
      el.style.transition = 'opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1), transform 0.7s cubic-bezier(0.22, 1, 0.36, 1)';
      revealObserver.observe(el);
    });
  }

  // ── Smooth scroll for anchor links ──
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

});

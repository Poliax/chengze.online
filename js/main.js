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

    // Close menu on link click
    nav.querySelectorAll('.nav__link').forEach(link => {
      link.addEventListener('click', () => {
        menuToggle.classList.remove('active');
        nav.classList.remove('open');
      });
    });
  }

  // ── Header scroll effect ──
  const header = document.getElementById('header');
  let lastScroll = 0;

  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    if (scrollY > 20) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
    lastScroll = scrollY;
  }, { passive: true });

  // ── Course tab filtering ──
  const tabs = document.querySelectorAll('.courses__tab');
  const cards = document.querySelectorAll('.course__card');

  if (tabs.length && cards.length) {
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // Update active tab
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const category = tab.dataset.tab;

        cards.forEach(card => {
          if (category === 'all' || card.dataset.category === category) {
            card.style.display = '';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  }

  // ── Contact form (demo handler) ──
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const btn = contactForm.querySelector('.btn');
      const originalText = btn.textContent;
      btn.textContent = '提交成功 ✓';
      btn.style.pointerEvents = 'none';

      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.pointerEvents = '';
        contactForm.reset();
      }, 2500);
    });
  }

  // ── Scroll reveal animation ──
  const revealElements = document.querySelectorAll(
    '.course__card, .feature__card, .service__card, .testimonial__card, .about__stat-card, .ai-tutor__grid, .work__card'
  );

  if (revealElements.length && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    revealElements.forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(24px)';
      el.style.transition = 'opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1), transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
      observer.observe(el);
    });
  }

  // Add reveal-visible class styles
  const style = document.createElement('style');
  style.textContent = '.reveal-visible { opacity: 1 !important; transform: translateY(0) !important; }';
  document.head.appendChild(style);
});

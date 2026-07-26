/**
 * 承泽教育 — Student Terminal
 */

document.addEventListener('DOMContentLoaded', () => {

  // ── Mobile menu ──
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
    header.classList.toggle('scrolled', window.scrollY > 10);
  }, { passive: true });

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

  // ── QA card expand on click (mobile-friendly) ──
  const qaCard = document.getElementById('qaCard');
  if (qaCard) {
    qaCard.addEventListener('click', (e) => {
      // Don't toggle if clicking on a subcard (those have their own navigation)
      if (e.target.closest('.terminal__subcard')) return;
      qaCard.classList.toggle('expanded');
    });
  }

});

/**
 * 承泽教育 — 学生终端
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

  // ── Header scroll ──
  const header = document.getElementById('header');
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 10);
  }, { passive: true });

  // ── Smooth scroll ──
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  });

  // ════════════════════════════════════════
  //  Province / Category Selector
  // ════════════════════════════════════════

  const selProvince = document.getElementById('selProvince');
  const selCategory = document.getElementById('selCategory');
  const selYear = document.getElementById('selYear');
  const subjectsList = document.getElementById('subjectsList');
  const coursesMeta = document.getElementById('coursesMeta');

  const LS_KEY = 'cz_province_pref';

  // ── Load saved preference ──
  function loadSaved() {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY)) || {};
    } catch { return {}; }
  }

  function savePref() {
    localStorage.setItem(LS_KEY, JSON.stringify({
      province: selProvince.value,
      category: selCategory.value,
      year: selYear.value
    }));
  }

  // ── Update category options based on province ──
  function updateCategories(provinceId, selectedCat) {
    const province = PROVINCE_DATA[provinceId];
    selCategory.innerHTML = '';

    if (!province) return;

    province.categories.forEach((cat, i) => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = cat.name;
      selCategory.appendChild(opt);
    });

    // Restore or default to first
    const matchCat = selectedCat && province.categories.some(c => c.id === selectedCat);
    if (matchCat) {
      selCategory.value = selectedCat;
    }

    updateSubjects();
  }

  // ── Update subjects display & course meta ──
  function updateSubjects() {
    const province = PROVINCE_DATA[selProvince.value];
    if (!province) return;

    const catId = selCategory.value;
    const category = province.categories.find(c => c.id === catId) || province.categories[0];

    if (!category) return;

    // Subjects bar
    subjectsList.innerHTML = '';
    category.subjects.forEach(sub => {
      const chip = document.createElement('span');
      chip.className = 'subjects-bar__chip';
      chip.textContent = sub;
      subjectsList.appendChild(chip);
    });

    // Total score
    const total = document.createElement('span');
    total.className = 'subjects-bar__total';
    total.textContent = `总分 ${category.total}`;
    subjectsList.appendChild(total);

    // Course meta
    coursesMeta.textContent = category.subjects.join(' · ');
  }

  // ── Province changed → update categories ──
  selProvince.addEventListener('change', () => {
    const saved = loadSaved();
    updateCategories(selProvince.value, saved.category);
    savePref();
  });

  selCategory.addEventListener('change', savePref);
  selYear.addEventListener('change', savePref);

  // ── Init ──
  const saved = loadSaved();

  if (saved.year && [...selYear.options].some(o => o.value === saved.year)) {
    selYear.value = saved.year;
  }
  if (saved.province && PROVINCE_DATA[saved.province]) {
    selProvince.value = saved.province;
  }

  updateCategories(selProvince.value, saved.category);

});

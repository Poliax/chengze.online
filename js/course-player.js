/**
 * 辰泽教育 — Course Video Player (Canvas Simulation)
 * Simulates a course lecture video with interactive playback controls.
 */

(function() {
  'use strict';

  const canvas = document.getElementById('videoCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  // ── Lecture slides content ──
  const TOTAL_DURATION = 42 * 60 + 30; // 42:30

  const slides = [
    { time: 0, title: '虚拟语气基础概念', lines: ['什么是虚拟语气？', '', '虚拟语气 (Subjunctive Mood) 是一种动词形式，', '用来表达：', '• 与事实相反的假设', '• 愿望、建议、要求', '• 不可能实现的想象'] },
    { time: 15, title: '与现在事实相反', lines: ['If + 主语 + 动词过去式...', '主语 + would/could + 动词原形', '', 'Example:', 'If I were you, I would study harder.', '（如果我是你，我会更努力学习。）', '', '注意：be 动词统一用 were'] },
    { time: 30, title: '与过去事实相反', lines: ['If + 主语 + had + 过去分词...', '主语 + would/could + have + 过去分词', '', 'Example:', 'If I had studied yesterday, I would have passed.', '（如果我昨天学习了，我就考过了。）'] },
    { time: 45, title: '与将来事实相反', lines: ['If + 主语 + should/were to + 动词原形...', '主语 + would/could + 动词原形', '', 'Example:', 'If it should rain tomorrow, class would be canceled.', '（如果明天下雨，课就取消。）'] },
    { time: 60, title: '名词性从句中的虚拟语气', lines: ['在 suggest, demand, order 等动词后的', 'that 从句中，使用 should + 动词原形', '（should 可省略）', '', 'Example:', 'I suggest that he (should) study more.', '（我建议他多学习。）'] },
    { time: 75, title: 'wish 的用法', lines: ['wish + 过去式 → 与现在相反', 'wish + 过去完成式 → 与过去相反', 'wish + would/could → 与将来相反', '', 'Example:', 'I wish I were a college student.', '（我希望我是一名大学生。）'] },
    { time: 90, title: 'as if / as though', lines: ['as if / as though + 虚拟语气', '', '与现在相反 → 过去式', '与过去相反 → 过去完成式', '', 'Example:', 'He talks as if he knew everything.', '（他说得好像他什么都知道。）'] },
    { time: 105, title: 'It is time that...', lines: ['It is (high) time that 主语 + 过去式', '', '表示"是时候做某事了"', '带有建议意味', '', 'Example:', 'It is time that we started reviewing.', '（是我们开始复习的时候了。）'] },
    { time: 120, title: '虚拟语气小结', lines: ['虚拟语气核心要点：', '', '1. 区分与现在/过去/将来相反', '2. 掌握 suggest 类动词的用法', '3. wish / as if / it is time 特殊句型', '4. 真题中注意时间状语提示'] },
    { time: 135, title: '真题实战', lines: ['选择正确的虚拟语气形式：', '', 'If I ___ (be) you, I would apply.', 'A. am    B. was    C. were    D. be', '', '答案：C', '', '解析：与现在事实相反，be 动词用 were'] },
    { time: 150, title: '真题实战（二）', lines: ['I wish I ___ (study) harder yesterday.', 'A. studied    B. had studied', 'C. study    D. would study', '', '答案：B', '', '解析：与过去事实相反，用 had + 过去分词'] },
  ];

  // ── State ──
  let isPlaying = false;
  let currentTime = 0;
  let animationId = null;
  let lastTimestamp = null;

  // DOM refs
  const overlay = document.getElementById('videoOverlay');
  const playBtn = document.getElementById('videoPlayBtn');
  const statusText = document.querySelector('.video-status-text');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const playPauseIcon = document.getElementById('playPauseIcon');
  const timeDisplay = document.getElementById('timeDisplay');
  const progressFill = document.getElementById('progressFill');
  const progressThumb = document.getElementById('progressThumb');
  const progressTrack = document.getElementById('progressTrack');
  const progressBar = document.getElementById('progressBar');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const container = document.querySelector('.video-container');
  const controls = document.getElementById('videoControls');

  // ── Drawing ──
  function drawFrame(time) {
    const w = canvas.width;
    const h = canvas.height;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.6, '#1e293b');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Decorative grid dots
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (let x = 0; x < w; x += 40) {
      for (let y = 0; y < h; y += 40) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Current slide
    let currentSlide = slides[0];
    for (let i = slides.length - 1; i >= 0; i--) {
      if (time >= slides[i].time) {
        currentSlide = slides[i];
        break;
      }
    }

    // Slide indicator bar
    const barY = 60;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(80, barY, w - 160, 2);

    // Draw slide markers on the bar
    slides.forEach((slide, i) => {
      const x = 80 + (slide.time / (TOTAL_DURATION / 60)) * (w - 160) / (w);
      // More accurate: percentage of total time
      const pct = (slide.time * 60) / TOTAL_DURATION;
      const mx = 80 + pct * (w - 160);
      ctx.fillStyle = slide === currentSlide ? '#2563eb' : 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.arc(mx, barY, slide === currentSlide ? 5 : 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Current position indicator
    const progress = time / TOTAL_DURATION;
    const dotX = 80 + progress * (w - 160);
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.arc(dotX, barY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(37,99,235,0.3)';
    ctx.beginPath();
    ctx.arc(dotX, barY, 12, 0, Math.PI * 2);
    ctx.fill();

    // Time counter top-right
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '12px Inter, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(formatTime(time), w - 80, 52);

    // Chapter title
    ctx.fillStyle = '#2563eb';
    ctx.font = '600 13px "Noto Sans SC", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('第 1 章 · ' + currentSlide.title, 80, 110);

    // Content lines
    const startY = 160;
    const lineH = 44;

    currentSlide.lines.forEach((line, i) => {
      const y = startY + i * lineH;
      if (line === '') return;

      // Detect example lines
      const isExample = line.startsWith('Example:');
      const isAnswer = line.startsWith('答案');
      const isHighlight = line.startsWith('If ') || line.startsWith('I ') || line.startsWith('It ');

      if (isExample) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '400 14px "Noto Sans SC", sans-serif';
      } else if (isAnswer) {
        ctx.fillStyle = '#10b981';
        ctx.font = '600 16px "Noto Sans SC", sans-serif';
      } else if (isHighlight) {
        ctx.fillStyle = '#93c5fd';
        ctx.font = '500 17px "Noto Sans SC", sans-serif';
      } else if (line.startsWith('•') || line.match(/^\d+\./)) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = '400 16px "Noto Sans SC", sans-serif';
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '400 16px "Noto Sans SC", sans-serif';
      }

      ctx.textAlign = 'left';
      ctx.fillText(line, 80, y);
    });

    // Brand watermark
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.font = '600 14px "Noto Sans SC", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('辰泽教育', w - 80, h - 40);
  }

  // ── Update controls ──
  function updateControls() {
    const time = currentTime;
    const pct = (time / TOTAL_DURATION) * 100;

    progressFill.style.width = pct + '%';

    if (timeDisplay) {
      timeDisplay.textContent = formatTime(time) + ' / ' + formatTime(TOTAL_DURATION);
    }

    // Update overlay
    if (statusText) {
      const slide = getSlideAt(time);
      statusText.textContent = slide ? slide.title : '';
    }
  }

  function getSlideAt(time) {
    let s = slides[0];
    for (let i = slides.length - 1; i >= 0; i--) {
      if (time >= slides[i].time) {
        s = slides[i];
        break;
      }
    }
    return s;
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  // ── Play/Pause ──
  function togglePlay() {
    isPlaying = !isPlaying;

    if (isPlaying) {
      overlay.classList.add('hidden');
      playPauseIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
      controls.classList.add('visible');
      lastTimestamp = null;
      animationId = requestAnimationFrame(playLoop);
    } else {
      playPauseIcon.innerHTML = '<polygon points="5,3 19,12 5,21"/>';
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
    }
  }

  function playLoop(timestamp) {
    if (!isPlaying) return;

    if (lastTimestamp === null) {
      lastTimestamp = timestamp;
    }

    const delta = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;

    currentTime = Math.min(currentTime + delta, TOTAL_DURATION);
    drawFrame(currentTime);
    updateControls();

    if (currentTime >= TOTAL_DURATION) {
      isPlaying = false;
      playPauseIcon.innerHTML = '<polygon points="5,3 19,12 5,21"/>';
      overlay.classList.remove('hidden');
      statusText.textContent = '已播放完毕 · 重新观看';
      return;
    }

    animationId = requestAnimationFrame(playLoop);
  }

  // ── Seek ──
  function seekTo(percent) {
    currentTime = (percent / 100) * TOTAL_DURATION;
    drawFrame(currentTime);
    updateControls();
  }

  // ── Event listeners ──

  // Play button in overlay
  playBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentTime >= TOTAL_DURATION) {
      currentTime = 0;
    }
    togglePlay();
  });

  // Play/pause button in controls
  playPauseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentTime >= TOTAL_DURATION) {
      currentTime = 0;
    }
    togglePlay();
  });

  // Click on video to toggle play/pause
  container.addEventListener('click', (e) => {
    if (e.target === container || e.target === canvas || e.target.closest('.video-overlay')) {
      if (currentTime >= TOTAL_DURATION) {
        currentTime = 0;
      }
      togglePlay();
    }
  });

  // Progress bar seeking
  let isDragging = false;

  progressBar.addEventListener('mousedown', (e) => {
    isDragging = true;
    const rect = progressBar.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    seekTo(Math.max(0, Math.min(100, pct)));
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const rect = progressBar.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    seekTo(Math.max(0, Math.min(100, pct)));
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // Fullscreen
  fullscreenBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });

  // Chapter list click
  document.querySelectorAll('.chapter-item:not(.locked)').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.chapter-item').forEach(c => c.classList.remove('active'));
      item.classList.add('active');

      // Update status badges
      document.querySelectorAll('.chapter-item__status').forEach(s => {
        if (s.classList.contains('playing')) s.textContent = '未开始';
        s.classList.remove('playing');
      });
      const status = item.querySelector('.chapter-item__status');
      status.textContent = '播放中';
      status.classList.add('playing');

      // Seek to that chapter
      const idx = parseInt(item.dataset.index);
      if (slides[idx]) {
        if (currentTime >= TOTAL_DURATION) currentTime = 0;
        currentTime = slides[idx].time;
        drawFrame(currentTime);
        updateControls();
        if (!isPlaying) togglePlay();
      }
    });
  });

  // ── Initial draw ──
  drawFrame(0);
  updateControls();

  // Auto-hide overlay after first play starts
  // ── Resize handler ──
  function resizeCanvas() {
    const rect = container.getBoundingClientRect();
    // Canvas resolution stays fixed, CSS handles display size
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

})();

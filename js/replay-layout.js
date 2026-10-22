(function () {
  'use strict';
  var page = document.querySelector('.replay-studio .page');
  var header = document.querySelector('.watch-header');
  if (!page || !header) return;
  function fitReplay() {
    var width = window.innerWidth || document.documentElement.clientWidth;
    var height = window.innerHeight || document.documentElement.clientHeight;
    var headerBottom = header.getBoundingClientRect().bottom;
    var sidebar = page.querySelector('.right-col');
    var baseWidth = sidebar && sidebar.classList.contains('hidden') ? 960 : 1172;
    var availableHeight = Math.max(1, height - headerBottom - 24);
    var scale = Math.min(1.1, Math.max(1, width - 24) / baseWidth, availableHeight / 540);
    page.style.width = baseWidth + 'px';
    page.style.left = (width - baseWidth * scale) / 2 + 'px';
    page.style.top = headerBottom + 12 + Math.max(0, (availableHeight - 540 * scale) / 2) + 'px';
    page.style.transform = 'scale(' + scale + ')';
  }
  var frame = 0;
  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(function () { frame = 0; fitReplay(); });
  }
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', schedule);
  fitReplay();
}());

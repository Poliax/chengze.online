(function (root, init) {
  if (typeof module === 'object' && module.exports) module.exports = init;
  else init(root.document, root);
}(typeof window === 'undefined' ? null : window, function (doc, win) {
  'use strict';
  var stage = doc.getElementById('mainBox');
  var video = doc.getElementById('mainVideo');
  var controls = stage && stage.querySelector('.controls');
  var menu = doc.getElementById('rateMenu');
  if (!video || !controls) return;
  var timer, hovering = false, interacting = false;
  function keepVisible() {
    return video.paused || video.ended || hovering || interacting ||
      (menu && menu.classList.contains('open')) ||
      (controls.contains(doc.activeElement) && doc.activeElement.matches(':focus-visible'));
  }
  function schedule() {
    win.clearTimeout(timer);
    timer = win.setTimeout(function () {
      if (keepVisible()) schedule();
      else controls.classList.add('controls-hidden');
    }, 2500);
  }
  function show() {
    controls.classList.remove('controls-hidden');
    schedule();
  }
  stage.addEventListener('pointermove', show);
  stage.addEventListener('pointerdown', show);
  stage.addEventListener('mousemove', show);
  stage.addEventListener('touchstart', show, { passive: true });
  stage.addEventListener('keydown', show);
  // Every control renews visibility, including synthetic clicks and range input.
  ['click', 'input', 'change', 'keyup'].forEach(function (name) {
    controls.addEventListener(name, show);
  });
  controls.addEventListener('pointerdown', function () { interacting = true; show(); });
  controls.addEventListener('touchstart', function () { interacting = true; show(); }, { passive: true });
  function finishInteraction() { interacting = false; show(); }
  ['pointerup', 'pointercancel', 'touchend', 'touchcancel', 'mouseup'].forEach(function (name) {
    doc.addEventListener(name, finishInteraction);
  });
  controls.addEventListener('focusin', show);
  controls.addEventListener('focusout', schedule);
  controls.addEventListener('pointerenter', function (event) {
    if (event.pointerType === 'mouse') hovering = true;
    show();
  });
  controls.addEventListener('pointerleave', function () { hovering = false; schedule(); });
  video.addEventListener('play', show);
  video.addEventListener('pause', show);
  video.addEventListener('ended', show);
  doc.addEventListener('fullscreenchange', show);
  doc.addEventListener('webkitfullscreenchange', show);
  win.addEventListener('resize', show);
  show();
}));

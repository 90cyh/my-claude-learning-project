/* 简记 · 共享 Toast（依赖页面内 #toast-message 容器） */
window.showToast = function (message, icon) {
  'use strict';
  var toast = document.getElementById('toast-message');
  if (!toast) return;
  var text = document.getElementById('toast-text');
  var ico = document.getElementById('toast-icon');
  if (text) text.textContent = message;
  if (ico) ico.textContent = icon || 'check_circle';
  toast.classList.remove('translate-y-8', 'opacity-0', 'pointer-events-none');
  toast.classList.add('translate-y-0', 'opacity-100');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(function () {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-8', 'opacity-0', 'pointer-events-none');
  }, 2800);
};

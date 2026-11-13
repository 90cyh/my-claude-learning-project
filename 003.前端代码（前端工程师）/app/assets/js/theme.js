/* ============================================================
   简记 · 主题与偏好（须在 <head> 中、tailwind-config 之前加载）
   - 主题：light / dark / auto（跟随系统），持久化 localStorage +
     服务端 user_setting 表（设置页修改时同步）
   - 偏好：arith（算式求和）/ privacy_mask（金额打码）
   ============================================================ */
(function () {
  'use strict';
  var THEME_KEY = 'jianji.theme';

  var stored = null;
  try { stored = localStorage.getItem(THEME_KEY); } catch (e) { /* 隐私模式 */ }

  function applyTheme(t) {
    var dark = t === 'dark' ||
      (t !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }

  applyTheme(stored || 'auto');
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
    applyTheme(stored || 'auto');
  });

  /* 主题样式表（变量定义）同步注入，避免首帧闪烁 */
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'assets/css/theme.css';
  document.head.appendChild(link);

  window.JIANTHEME = {
    get: function () { return stored || 'auto'; },
    set: function (t) {
      stored = t;
      try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* 忽略 */ }
      applyTheme(t);
    },
    /* 偏好读取（同步，localStorage 即时值） */
    getPref: function (key) {
      try { return localStorage.getItem('jianji.pref.' + key); } catch (e) { return null; }
    },
    /* 偏好写入：localStorage 即时生效 + 服务端 user_setting 持久化 */
    setPref: function (key, value) {
      try { localStorage.setItem('jianji.pref.' + key, value); } catch (e) { /* 忽略 */ }
      return fetch('/api/user/setting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key, value: value })
      }).catch(function (e) { /* 离线时本地仍生效 */ });
    }
  };
})();

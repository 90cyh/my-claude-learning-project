/* ============================================================
   简记 · 本地会话（PRD 5.9 本地账户的原型级落地）
   说明：本工程为前端原型，不做真实凭证校验（密码哈希与锁定
   逻辑在 002.网站开发 实现版中落地）。此处仅实现 PRD 5.9 的
   路由规则与多账户隔离的演示：会话存于 localStorage。
   ============================================================ */
window.JIANJI = (function () {
  'use strict';
  var KEY = 'jianji.session';

  function getSession() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); }
    catch (e) { return null; }
  }
  function login(username) {
    localStorage.setItem(KEY, JSON.stringify({
      username: username,
      loginAt: new Date().toISOString()
    }));
  }
  function logout() { localStorage.removeItem(KEY); }

  /* PRD 5.9 登录规则 4：无会话 → 登录/注册页是唯一可见页面 */
  function requireSession() {
    if (!getSession()) { location.replace('login.html'); return false; }
    return true;
  }
  /* 已登录者访问登录/注册页时直接回首页 */
  function redirectIfAuthed() {
    if (getSession()) location.replace('index.html');
  }
  return {
    getSession: getSession,
    login: login,
    logout: logout,
    requireSession: requireSession,
    redirectIfAuthed: redirectIfAuthed
  };
})();

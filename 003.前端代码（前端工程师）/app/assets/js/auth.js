/* ============================================================
   简记 · 前端会话（PRD V1.0.2 云端账户）
   会话由服务端 HttpOnly Cookie 管理（jj_session），
   前端只向 /api/auth/* 询问状态，不再读写 localStorage 凭证
   ============================================================ */
window.JIANJI = {
  /* 会话状态：有效返回 {username}，无效返回 null */
  async me() {
    try {
      const r = await fetch('/api/auth/me');
      return r.ok ? await r.json() : null;
    } catch (e) {
      return null;
    }
  },

  /* 登录：失败抛 Error（message 为服务端统一文案） */
  async login(username, password) {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, password: password })
    });
    const data = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(data.message || '登录失败');
    return data;
  },

  /* 注册：失败抛 Error（409 用户名已存在 / 400 校验失败） */
  async register(username, password) {
    const r = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, password: password })
    });
    const data = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(data.message || '注册失败');
    return data;
  },

  /* 退出：服务端删除 session 表记录并清 Cookie */
  async logout() {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (e) { /* 忽略 */ }
  }
};

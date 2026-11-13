/* ============================================================
   简记 · 共享页面骨架（页头 / 底部导航）
   - 各主页面 <body data-page="...">，本脚本按其注入骨架并
     高亮当前导航（消除 4 份重复的页头/导航/页脚标记）。
   - 加载顺序：auth.js → 本文件（自带会话门禁）。
   ============================================================ */
(async function () {
  'use strict';

  /* PRD 5.9 规则4：无有效会话时主页面不可见（V1.0.2 云端账户：询问服务端） */
  var me = await window.JIANJI.me();
  if (!me || !me.username) { location.replace('login.html'); return; }

  var NAV_ITEMS = [
    { path: 'dashboard',            href: 'index.html',        label: '首页', icon: 'home' },
    { path: 'ledger-records',       href: 'transactions.html', label: '明细', icon: 'receipt_long' },
    { path: 'statistics-analytics', href: 'analytics.html',    label: '统计', icon: 'pie_chart' },
    { path: 'account-settings',     href: 'settings.html',     label: '我的', icon: 'account_balance_wallet' }
  ];
  var current = document.body.dataset.page || 'dashboard';

  /* 当前账户（头像菜单展示，PRD 6.1） */
  var session = me;
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  var userBadgeHTML = (session && session.username)
    ? '<div class="px-space-md pt-space-xs pb-space-xs border-b border-border-hairline mb-space-xs max-w-[160px]">' +
        '<span class="font-caption text-caption text-text-muted block">当前账户</span>' +
        '<span class="font-label-md text-label-md text-text-primary truncate block">' + esc(session.username) + '</span>' +
      '</div>'
    : '';

  /* ---------- 页头（导航已移至页面底部） ---------- */
  var headerHTML =
    '<header class="fixed top-0 left-0 right-0 z-50 bg-surface/85 backdrop-blur-md shadow-[0_4px_16px_-2px_rgba(61,34,48,0.04)]">' +
      '<div class="h-14 max-w-7xl mx-auto px-margin md:px-margin-desktop flex items-center justify-between">' +
        '<div class="flex items-center gap-space-lg">' +
          '<a class="flex items-center gap-space-xs group" data-path="dashboard" href="index.html">' +
            '<span class="w-8 h-8 rounded-full bg-surface-hero flex items-center justify-center text-primary font-headline-md text-headline-md">🌸</span>' +
            '<div class="flex flex-col">' +
              '<div class="flex items-center gap-space-xs">' +
                '<span class="font-headline-md text-headline-md text-text-primary tracking-tight">简记</span>' +
                '<span class="hidden sm:inline-block font-caption text-caption px-space-xs py-space-2xs rounded-full bg-surface-hero text-tertiary">PWA</span>' +
              '</div>' +
              '<span class="hidden lg:block font-caption text-caption text-text-muted">优雅纯粹的日常记账</span>' +
            '</div>' +
          '</a>' +
        '</div>' +
        '<div class="flex items-center gap-space-sm">' +
          '<a class="h-9 px-space-md rounded-full bg-surface-variant hover:bg-surface-hero text-cta-label font-label-md text-label-md flex items-center gap-space-xs shadow-[0_2px_8px_rgba(61,34,48,0.06)] active:scale-95 transition-all" href="transactions.html" title="去明细页记一笔">' +
            '<span class="text-[14px]">🌸</span><span>记一笔</span>' +
          '</a>' +
          '<div class="relative" id="site-user-menu">' +
            '<button class="w-8 h-8 rounded-full bg-primary flex items-center justify-center hover:scale-105 active:scale-95 transition-transform" id="site-user-btn" title="我的" aria-haspopup="true" aria-expanded="false">' +
              '<span class="material-symbols-outlined text-on-primary text-[18px]">person</span>' +
            '</button>' +
            '<div class="hidden absolute right-0 top-10 w-44 bg-surface border border-border-hairline rounded-[14px] shadow-[0_12px_32px_-4px_rgba(61,34,48,0.12)] py-space-xs z-50" id="site-user-panel" role="menu">' +
              userBadgeHTML +
              '<a class="flex items-center gap-space-xs px-space-md py-space-xs font-label-md text-label-md text-text-primary hover:bg-surface-hero transition-colors" role="menuitem" href="settings.html">' +
                '<span class="material-symbols-outlined text-[18px] text-primary">person</span><span>我的</span>' +
              '</a>' +
              '<button class="w-full flex items-center gap-space-xs px-space-md py-space-xs font-label-md text-label-md text-status-danger hover:bg-surface-container-low transition-colors text-left" role="menuitem" id="site-user-logout">' +
                '<span class="material-symbols-outlined text-[18px]">logout</span><span>退出登录</span>' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</header>';

  /* ---------- 底部导航（全端常驻，居中胶囊） ---------- */
  var bottomHTML = NAV_ITEMS.map(function (item) {
    var on = item.path === current;
    var cls = 'flex flex-col items-center justify-center gap-space-2xs ' +
      (on ? 'text-primary font-label-sm' : 'text-on-surface-variant hover:text-on-surface transition-colors');
    return '<a class="' + cls + '"' + (on ? ' aria-current="page"' : '') +
      ' data-path="' + item.path + '" href="' + item.href + '">' +
      '<span class="material-symbols-outlined text-[20px]">' + item.icon + '</span>' +
      '<span class="font-label-sm text-label-sm">' + item.label + '</span></a>';
  }).join('');

  var bottomNavHTML =
    '<nav class="fixed bottom-space-sm left-1/2 -translate-x-1/2 z-50 h-14 w-[420px] max-w-[92vw] bg-surface/90 backdrop-blur-xl rounded-full shadow-[0_12px_32px_-4px_rgba(61,34,48,0.12)] flex items-center justify-around px-space-md">' +
      bottomHTML +
    '</nav>';

  document.body.insertAdjacentHTML('afterbegin', headerHTML);
  document.body.insertAdjacentHTML('beforeend', bottomNavHTML);

  /* ---------- 头像菜单：我的 / 退出登录（PRD 5.9） ---------- */
  var userBtn = document.getElementById('site-user-btn');
  var userPanel = document.getElementById('site-user-panel');
  var userLogout = document.getElementById('site-user-logout');

  function closeUserPanel() {
    if (userPanel) userPanel.classList.add('hidden');
    if (userBtn) userBtn.setAttribute('aria-expanded', 'false');
  }
  if (userBtn && userPanel) {
    userBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var hidden = userPanel.classList.toggle('hidden');
      userBtn.setAttribute('aria-expanded', hidden ? 'false' : 'true');
    });
    document.addEventListener('click', function (e) {
      if (userPanel.classList.contains('hidden')) return;
      if (!userPanel.contains(e.target)) closeUserPanel();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeUserPanel();
    });
  }
  if (userLogout) {
    userLogout.addEventListener('click', function () {
      window.JIANJI.logout().then(function () { location.href = 'login.html'; });
    });
  }
})();

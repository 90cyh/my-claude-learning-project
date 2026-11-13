/* ============================================================
   简记 · 我的页交互（PRD V1.0.2，全部接数据库）
   数据来源：GET /api/user/settings-summary
   接口：头像 /api/user/avatar · 偏好 /api/user/setting
        资金账户 /api/account · 清空数据 /api/user/data-reset
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  function fmt(n) {
    return Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  /* ---------- ① 资料：用户名 + 头像（数据库） ---------- */
  function renderProfile(d) {
    setText('profile-username', d.username);
    if (d.avatar) {
      var img = document.getElementById('profile-avatar');
      var fb = document.getElementById('profile-avatar-fallback');
      if (img) { img.src = d.avatar; img.classList.remove('hidden'); }
      if (fb) fb.classList.add('hidden');
    }
  }

  /* 头像上传：选图 → 居中裁剪至 128×128 → base64 存入 user.avatar */
  var avatarInput = document.getElementById('avatar-input');
  var avatarBtn = document.getElementById('avatar-edit-btn');
  if (avatarBtn && avatarInput) {
    avatarBtn.addEventListener('click', function () { avatarInput.click(); });
    avatarInput.addEventListener('change', function () {
      var file = avatarInput.files && avatarInput.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { showToast('图片请小于 5MB', 'error'); return; }
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var size = 128;
          var canvas = document.createElement('canvas');
          canvas.width = size; canvas.height = size;
          var min = Math.min(img.width, img.height);
          canvas.getContext('2d').drawImage(
            img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size);
          var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          fetch('/api/user/avatar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataUrl: dataUrl })
          }).then(function (r) {
            if (!r.ok) throw new Error();
            return r.json();
          }).then(function () {
            var imgEl = document.getElementById('profile-avatar');
            if (imgEl) { imgEl.src = dataUrl; imgEl.classList.remove('hidden'); }
            var fb = document.getElementById('profile-avatar-fallback');
            if (fb) fb.classList.add('hidden');
            showToast('头像已更新 🌸', 'check_circle');
          }).catch(function () { showToast('上传失败，请稍后再试', 'error'); });
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------- ② 打卡天数 + 累计笔数（数据库） ---------- */
  function renderStats(d) {
    setText('stat-streak', d.streakDays);
    setText('stat-total', d.totalTxns);
    var dangerCount = document.getElementById('danger-txn-count');
    if (dangerCount) dangerCount.textContent = d.totalTxns;
  }

  /* ---------- ④ 资金账户：列表渲染 + 新增（数据库） ---------- */
  function renderAccounts(d) {
    setText('account-count', d.accounts.length + ' 个活跃账户');
    setText('total-balance', '¥ ' + fmt(d.totalBalance));
    var box = document.getElementById('account-list');
    if (box) {
      box.innerHTML = d.accounts.length ? d.accounts.map(function (a) {
        return '<div class="p-space-md rounded-[14px] bg-surface-container-low/80 hover:bg-surface-hero transition-colors flex flex-col justify-between gap-space-md group">' +
          '<div class="flex items-start justify-between">' +
            '<div class="flex items-center gap-space-sm">' +
              '<div class="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center text-[18px]">' + esc(a.icon) + '</div>' +
              '<div class="flex flex-col">' +
                '<span class="font-label-md text-label-md text-text-primary">' + esc(a.name) + '</span>' +
              '</div>' +
            '</div>' +
            '<span class="material-symbols-outlined text-[18px] text-text-muted">savings</span>' +
          '</div>' +
          '<div class="flex items-baseline justify-between pt-space-xs border-t border-border-hairline">' +
            '<span class="font-caption text-caption text-text-muted">可用余额</span>' +
            '<span class="font-headline-md text-headline-md text-text-primary font-semibold">¥ ' + fmt(a.balance) + '</span>' +
          '</div>' +
        '</div>';
      }).join('') : '<div class="py-space-md text-center font-caption text-caption text-text-muted">还没有资金账户，点击上方「新增资金账户」创建 🌸</div>';
    }
  }

  var addWalletBtn = document.getElementById('add-wallet-btn');
  if (addWalletBtn) {
    addWalletBtn.addEventListener('click', function () {
      var name = window.prompt('请输入资金账户名称（20 字内）', '');
      if (!name || !name.trim()) return;
      var bal = parseFloat(window.prompt('请输入初始余额（元，可为 0）', '0'));
      if (!(bal >= 0)) { window.alert('初始余额需 ≥ 0'); return; }
      fetch('/api/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), icon: '💳', initial_balance: bal })
      }).then(function (r) {
        if (!r.ok) return r.json().then(function (d) { throw new Error(d.message || '创建失败'); });
        showToast('资金账户已添加 🌸', 'account_balance_wallet');
        load();
      }).catch(function (err) {
        showToast(err.message || '创建失败，请稍后再试', 'error');
      });
    });
  }

  /* ---------- ⑤-1 主题（真实切换 + 持久化到 user_setting） ---------- */
  function markTheme(active) {
    document.querySelectorAll('.theme-btn').forEach(function (b) {
      var on = b.getAttribute('data-theme-choice') === active;
      b.classList.toggle('border-primary', on);
      b.classList.toggle('bg-surface-hero', on);
      b.classList.toggle('border-transparent', !on);
      var tail = b.lastElementChild;
      if (tail) {
        tail.className = on
          ? 'material-symbols-outlined text-primary text-[20px]'
          : 'w-4 h-4 rounded-full border border-outline-variant';
        tail.textContent = on ? 'check_circle' : '';
      }
    });
  }
  markTheme(window.JIANTHEME.get());

  document.querySelectorAll('.theme-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var choice = btn.getAttribute('data-theme-choice');
      window.JIANTHEME.set(choice);
      window.JIANTHEME.setPref('theme', choice);
      markTheme(choice);
      var tips = {
        light: '已应用浅色粉润主题',
        dark: '已应用深色梅紫主题 🌙',
        auto: '已设为跟随系统，自动切换明暗'
      };
      showToast(tips[choice] || '主题已更新', choice === 'dark' ? 'dark_mode' : choice === 'auto' ? 'brightness_auto' : 'light_mode');
    });
  });

  /* ---------- ⑤-2 偏好开关（算式求和 / 金额打码，持久化到 user_setting） ---------- */
  function applyPrefs(prefs) {
    var arith = document.getElementById('toggle-arith');
    var privacy = document.getElementById('toggle-privacy');
    if (arith) arith.checked = prefs.arith === '1';
    if (privacy) privacy.checked = prefs.privacy_mask === '1';
    try {
      localStorage.setItem('jianji.pref.arith', prefs.arith === '1' ? '1' : '0');
      localStorage.setItem('jianji.pref.privacy_mask', prefs.privacy_mask === '1' ? '1' : '0');
    } catch (e) { /* 忽略 */ }
  }
  var toggleArith = document.getElementById('toggle-arith');
  if (toggleArith) {
    toggleArith.addEventListener('change', function () {
      var on = toggleArith.checked;
      window.JIANTHEME.setPref('arith', on ? '1' : '0');
      showToast(on ? '已开启金额算式快速求和' : '已关闭算式求和', 'calculate');
    });
  }
  var togglePrivacy = document.getElementById('toggle-privacy');
  if (togglePrivacy) {
    togglePrivacy.addEventListener('change', function () {
      var on = togglePrivacy.checked;
      window.JIANTHEME.setPref('privacy_mask', on ? '1' : '0');
      showToast(on ? '已开启隐私打码模式' : '已恢复明文显示', on ? 'visibility_off' : 'visibility');
    });
  }

  /* ---------- ⑥ 危险操作：清空当前账本（交易+预算，数据库） ---------- */
  var dangerModal = document.getElementById('danger-modal');
  var confirmInput = document.getElementById('confirm-input');
  var confirmBtn = document.getElementById('btn-confirm-delete');
  var openDangerBtn = document.getElementById('open-danger-modal-btn');
  var closeDangerBtn = document.getElementById('close-danger-modal-btn');

  function openDangerModal() {
    if (!dangerModal) return;
    confirmInput.value = '';
    confirmBtn.disabled = true;
    confirmBtn.classList.add('opacity-50', 'cursor-not-allowed');
    dangerModal.classList.remove('hidden');
    dangerModal.classList.add('flex');
    confirmInput.focus();
  }
  function closeDangerModal() {
    if (!dangerModal) return;
    dangerModal.classList.add('hidden');
    dangerModal.classList.remove('flex');
  }
  if (openDangerBtn) openDangerBtn.addEventListener('click', openDangerModal);
  if (closeDangerBtn) closeDangerBtn.addEventListener('click', closeDangerModal);
  if (dangerModal) {
    dangerModal.addEventListener('click', function (e) {
      if (e.target === dangerModal) closeDangerModal();
    });
  }
  if (confirmInput) {
    confirmInput.addEventListener('input', function () {
      var ok = confirmInput.value.trim() === 'RESET';
      confirmBtn.disabled = !ok;
      confirmBtn.classList.toggle('opacity-50', !ok);
      confirmBtn.classList.toggle('cursor-not-allowed', !ok);
    });
  }
  if (confirmBtn) {
    confirmBtn.addEventListener('click', function () {
      closeDangerModal();
      fetch('/api/user/data-reset', { method: 'POST' })
        .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
        .then(function (d) {
          showToast('已清空 ' + d.txnsDeleted + ' 笔流水与预算，账本已重置', 'restart_alt');
          load();
        })
        .catch(function () { showToast('重置失败，请稍后再试', 'error'); });
    });
  }

  /* ---------- 退出登录 ---------- */
  var logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      window.JIANJI.logout().then(function () { location.href = 'login.html'; });
    });
  }

  /* ---------- 加载汇总 ---------- */
  function load() {
    fetch('/api/user/settings-summary')
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (d) {
        renderProfile(d);
        renderStats(d);
        renderAccounts(d);
        applyPrefs(d.prefs || {});
        if (d.prefs && d.prefs.theme) markTheme(d.prefs.theme);
      })
      .catch(function (err) { console.error('我的页汇总加载失败：', err); });
  }
  load();
})();

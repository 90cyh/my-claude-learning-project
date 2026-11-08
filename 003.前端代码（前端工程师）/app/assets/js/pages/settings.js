/* 简记 · 我的页交互（会话展示 / 退出登录 / 偏好开关 / 危险重置） */
(function () {
  'use strict';

  /* 当前本地账户展示（PRD 6.1：我的页展示当前用户名） */
  var session = window.JIANJI.getSession();
  var nameEl = document.getElementById('profile-username');
  if (session && session.username && nameEl) nameEl.textContent = session.username;
  var idEl = document.getElementById('profile-id');
  if (session && idEl) idEl.textContent = '#LOCAL-' + Math.abs(hash(session.username)).toString(16).toUpperCase().slice(0, 6);

  function hash(s) {
    var h = 0, i;
    for (i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
    return h;
  }

  /* 退出登录（PRD 5.9：清除会话回到登录/注册页，数据保留） */
  var logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      window.JIANJI.logout();
      location.href = 'login.html';
    });
  }

  /* CSV 导出（原型演示数据，含 UTF-8 BOM） */
  var exportBtn = document.getElementById('btn-export-csv');
  if (exportBtn) {
    exportBtn.addEventListener('click', function () {
      var bom = '﻿';
      var header = '交易ID,日期,收支类型,分类,金额(元),账户,备注,状态\n';
      var rows = [
        'TXN-2025050101,2025-05-01,支出,餐饮美食,-38.50,微信零钱,香草拿铁与可颂,已完成',
        'TXN-2025050102,2025-05-01,支出,公共交通,-6.00,交通卡,地铁7号线,已完成',
        'TXN-2025050201,2025-05-02,收入,职业薪资,+12500.00,招商银行,月度结薪,已完成',
        'TXN-2025050202,2025-05-02,支出,居家生活,-128.00,支付宝,樱花香氛加湿液,已完成'
      ].join('\n');
      var blob = new Blob([bom + header + rows], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = '简记_全量明细_' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('🌸 CSV 账本已生成（含 UTF-8 BOM 标头，Excel 直接打开不乱码）', 'download_done');
    });
  }

  /* 轻提示类操作 */
  var addAccountBtn = document.getElementById('add-account-btn');
  if (addAccountBtn) {
    addAccountBtn.addEventListener('click', function () {
      showToast('🌸 本机多账套沙箱隔离，新账本将生成独立空间（原型演示）', 'add_circle');
    });
  }
  var switchAccountBtn = document.getElementById('switch-account-btn');
  if (switchAccountBtn) {
    switchAccountBtn.addEventListener('click', function () {
      showToast('切换账本空间功能开发中（原型演示）', 'switch_account');
    });
  }
  var addWalletBtn = document.getElementById('add-wallet-btn');
  if (addWalletBtn) {
    addWalletBtn.addEventListener('click', function () {
      showToast('资金账户管理属 V1.1 范围（原型演示）', 'account_balance_wallet');
    });
  }

  /* 主题选择（深色为 V1.2 范围，原型仅提示） */
  document.querySelectorAll('.theme-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var choice = btn.getAttribute('data-theme-choice');
      if (choice === 'light') {
        showToast('已应用浅色粉润主题', 'light_mode');
      } else if (choice === 'dark') {
        showToast('深色梅紫主题属 V1.2 范围，即将就绪', 'dark_mode');
      } else {
        showToast('已设为自动跟随系统显示外观', 'brightness_auto');
      }
    });
  });

  /* 记账偏好开关 */
  var toggleArith = document.getElementById('toggle-arith');
  if (toggleArith) {
    toggleArith.addEventListener('change', function () {
      showToast(toggleArith.checked ? '已开启金额算式快速求和' : '已关闭算式求和', 'calculate');
    });
  }
  var togglePrivacy = document.getElementById('toggle-privacy');
  if (togglePrivacy) {
    togglePrivacy.addEventListener('change', function () {
      showToast(togglePrivacy.checked ? '已开启隐私打码模式' : '已恢复明文显示', 'visibility_off');
    });
  }

  /* 危险重置弹窗（PRD 5.9 重置账户路径） */
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
      window.JIANJI.logout();
      showToast('本机数据已重置，沙盒恢复初始状态', 'restart_alt');
      setTimeout(function () { location.href = 'register.html'; }, 1200);
    });
  }
})();

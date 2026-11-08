/* 简记 · 明细页交互（沿用 Stitch 原型逻辑，补齐「记一笔」入口） */
(function () {
  'use strict';
  var txRows = document.querySelectorAll('.tx-item');
  var editAmountInput = document.getElementById('editAmountInput');
  var editTitleInput = document.getElementById('editTitleInput');
  var editRemarkInput = document.getElementById('editRemarkInput');
  var editDateInput = document.getElementById('editDateInput');
  var editTimeInput = document.getElementById('editTimeInput');
  var editAccountSelect = document.getElementById('editAccountSelect');

  var mobileDrawerOverlay = document.getElementById('mobileDrawerOverlay');
  var mobileDrawerPanel = document.getElementById('mobileDrawerPanel');
  var closeDrawerBtn = document.getElementById('closeDrawerBtn');
  var drawerAmountInput = document.getElementById('drawerAmountInput');
  var drawerTitleInput = document.getElementById('drawerTitleInput');
  var drawerSaveBtn = document.getElementById('drawerSaveBtn');
  var mobileAddFab = document.getElementById('mobileAddFab');
  var quickAddBtn = document.getElementById('quickAddBtn');

  var currentSelectedRow = document.querySelector('.tx-item.active-row');

  function openMobileDrawer(title, amount) {
    if (!mobileDrawerOverlay || !mobileDrawerPanel) return;
    drawerTitleInput.value = title;
    drawerAmountInput.value = String(amount).replace(/[^0-9.]/g, '');
    mobileDrawerOverlay.classList.remove('hidden');
    requestAnimationFrame(function () {
      mobileDrawerPanel.classList.remove('translate-y-full');
    });
  }

  function closeMobileDrawer() {
    if (!mobileDrawerOverlay || !mobileDrawerPanel) return;
    mobileDrawerPanel.classList.add('translate-y-full');
    setTimeout(function () {
      mobileDrawerOverlay.classList.add('hidden');
    }, 280);
  }

  txRows.forEach(function (row) {
    row.addEventListener('click', function () {
      txRows.forEach(function (r) {
        r.classList.remove('bg-surface-hero', 'active-row');
        r.classList.add('hover:bg-surface-container-low');
      });
      row.classList.add('bg-surface-hero', 'active-row');
      row.classList.remove('hover:bg-surface-container-low');
      currentSelectedRow = row;

      var amountRaw = row.getAttribute('data-amount') || '-0.00';
      if (editAmountInput) editAmountInput.value = amountRaw.replace(/[^0-9.]/g, '');
      if (editTitleInput) editTitleInput.value = row.getAttribute('data-title') || '';
      if (editRemarkInput) editRemarkInput.value = row.getAttribute('data-remark') || '';
      if (editDateInput) editDateInput.value = row.getAttribute('data-date') || '';
      if (editTimeInput) editTimeInput.value = row.getAttribute('data-time') || '';
      if (editAccountSelect) editAccountSelect.value = row.getAttribute('data-account') || '';

      if (window.innerWidth < 1024) {
        openMobileDrawer(row.getAttribute('data-title') || '', amountRaw);
      }
    });
  });

  if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', closeMobileDrawer);
  if (mobileDrawerOverlay) {
    mobileDrawerOverlay.addEventListener('click', function (e) {
      if (e.target === mobileDrawerOverlay) closeMobileDrawer();
    });
  }
  if (drawerSaveBtn) {
    drawerSaveBtn.addEventListener('click', function () {
      if (currentSelectedRow) {
        var val = parseFloat(drawerAmountInput.value || 0).toFixed(2);
        currentSelectedRow.setAttribute('data-amount', '-' + val);
        var amountEl = currentSelectedRow.querySelector('.text-flow-expense');
        if (amountEl) amountEl.textContent = '-¥' + val;
      }
      closeMobileDrawer();
      if (window.showToast) showToast('本笔流水已更新（原型演示）');
    });
  }

  /* 新增记账入口（顶栏/工具条 + 移动端 FAB） */
  function openNewDrawer() { openMobileDrawer('新记账项', '0.00'); }
  if (mobileAddFab) mobileAddFab.addEventListener('click', openNewDrawer);
  if (quickAddBtn) quickAddBtn.addEventListener('click', openNewDrawer);

  /* 筛选胶囊激活态切换 */
  var chips = document.querySelectorAll('.filter-chip');
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      chips.forEach(function (c) {
        c.classList.remove('bg-primary', 'text-on-primary');
        c.classList.add('bg-surface-container-low', 'text-text-secondary');
      });
      chip.classList.add('bg-primary', 'text-on-primary');
      chip.classList.remove('bg-surface-container-low', 'text-text-secondary');
    });
  });

  /* 备注搜索过滤 */
  var searchInput = document.getElementById('transactionSearch');
  if (searchInput) {
    searchInput.addEventListener('input', function (e) {
      var query = e.target.value.toLowerCase().trim();
      txRows.forEach(function (row) {
        var text = (row.textContent || '').toLowerCase();
        row.style.display = text.includes(query) ? 'flex' : 'none';
      });
    });
  }

  /* 桌面端保存按钮反馈 */
  var saveTxBtn = document.getElementById('saveTxBtn');
  if (saveTxBtn) {
    saveTxBtn.addEventListener('click', function () {
      var originalHTML = saveTxBtn.innerHTML;
      saveTxBtn.innerHTML = '<span class="material-symbols-outlined text-[18px]">done_all</span><span>已更新</span>';
      saveTxBtn.classList.replace('bg-primary', 'bg-status-safe');
      setTimeout(function () {
        saveTxBtn.innerHTML = originalHTML;
        saveTxBtn.classList.replace('bg-status-safe', 'bg-primary');
      }, 1200);
    });
  }
})();

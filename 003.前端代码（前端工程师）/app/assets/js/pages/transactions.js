/* ============================================================
   简记 · 明细页（PRD 5.3 列表 / 5.1 记账 / 5.5 导出）
   全部数据来自后端：
     GET  /api/transaction/meta      表单元数据（分类、账户、后端生成的日期与时刻）
     GET  /api/transaction/list      明细列表（按月/类型/分类/关键词）
     POST /api/transaction           新增（日期与时刻由后端生成）
     PUT  /api/transaction/:id       修改
     DELETE /api/transaction/:id     删除
     GET  /api/transaction/export    导出所选月份 CSV
   样式类全部沿用原页面，未做改动。
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 状态 ---------- */
  var state = {
    month: '',            // 'YYYY-MM'
    type: 'all',          // all | expense | income
    categoryId: null,     // 一级分类 id
    keyword: '',
    meta: null,
    records: []
  };

  /* ---------- 工具 ---------- */
  function $(s) { return document.querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  function fmt(n) {
    return Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function curMonth() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1);
  }
  function addMonths(mk, n) {
    var p = mk.split('-').map(Number);
    var m = p[1] - 1 + n;
    var y = p[0] + Math.floor(m / 12);
    m = ((m % 12) + 12) % 12;
    return y + '-' + pad(m + 1);
  }
  function monthTitle(mk) {
    var p = mk.split('-');
    return p[0] + '年 ' + (+p[1]) + '月';
  }
  function dayLabel(ds) {
    var md = (+ds.slice(5, 7)) + '月' + (+ds.slice(8, 10)) + '日';
    var t = todayStr();
    if (ds === t) return { md: md, tag: '今天' };
    var y = new Date(); y.setDate(y.getDate() - 1);
    var ys = y.getFullYear() + '-' + pad(y.getMonth() + 1) + '-' + pad(y.getDate());
    if (ds === ys) return { md: md, tag: '昨天' };
    return { md: md, tag: '' };
  }
  function weekday(ds) {
    var d = new Date(ds.slice(0, 4), (+ds.slice(5, 7)) - 1, +ds.slice(8, 10));
    return '星期' + '日一二三四五六'[d.getDay()];
  }

  /* 分类图标与配色（沿用原静态页的 Material Symbols 图标 + 分类色） */
  var CAT_STYLE = {
    '餐饮': { sym: 'restaurant', cls: 'bg-cat-dining/15 text-cat-dining' },
    '交通': { sym: 'directions_bus', cls: 'bg-cat-transport/15 text-cat-transport' },
    '购物': { sym: 'shopping_bag', cls: 'bg-cat-shopping/15 text-cat-shopping' },
    '居住': { sym: 'home', cls: 'bg-cat-housing/15 text-cat-housing' },
    '娱乐': { sym: 'theater_comedy', cls: 'bg-cat-entertainment/15 text-cat-entertainment' },
    '医疗': { sym: 'medical_services', cls: 'bg-cat-medical/15 text-cat-medical' },
    '教育': { sym: 'menu_book', cls: 'bg-cat-edu/15 text-cat-edu' },
    '人情': { sym: 'card_giftcard', cls: 'bg-cat-social/15 text-cat-social' },
    '其他': { sym: 'category', cls: 'bg-cat-other/15 text-cat-other' },
    '工资': { sym: 'payments', cls: 'bg-cat-housing/15 text-cat-housing' },
    '奖金': { sym: 'emoji_events', cls: 'bg-cat-social/15 text-cat-social' },
    '理财收益': { sym: 'trending_up', cls: 'bg-cat-transport/15 text-cat-transport' },
    '退款': { sym: 'undo', cls: 'bg-cat-edu/15 text-cat-edu' }
  };
  function catStyle(name) {
    return CAT_STYLE[name] || { sym: 'category', cls: 'bg-cat-other/15 text-cat-other' };
  }

  /* ---------- 加载元数据（分类 / 账户 / 后端当前日期时刻） ---------- */
  function loadMeta() {
    return fetch('/api/transaction/meta').then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (meta) {
      state.meta = meta;
      var sel = $('#editCategorySelect');
      if (sel) {
        var html = '';
        ['expense', 'income'].forEach(function (type) {
          meta.categories.filter(function (c) { return c.type === type && !c.parent_id; })
            .forEach(function (c) {
              html += '<option value="' + c.id + '">' + esc(c.name) + '</option>';
            });
        });
        sel.innerHTML = html;
      }
      var accSel = $('#editAccountSelect');
      if (accSel) {
        accSel.innerHTML = '<option value="">未分配</option>' +
          meta.accounts.map(function (a) {
            return '<option value="' + a.id + '">' + esc(a.name) + '</option>';
          }).join('');
      }
      return meta;
    });
  }

  /* ---------- 拉取明细 ---------- */
  function loadList() {
    var url = '/api/transaction/list?month=' + encodeURIComponent(state.month) +
      '&type=' + encodeURIComponent(state.type) +
      '&category=' + (state.categoryId || 'all') +
      '&q=' + encodeURIComponent(state.keyword);
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (d) {
      state.records = [];
      d.groups.forEach(function (g) { state.records = state.records.concat(g.items); });
      renderStats(d);
      renderGroups(d.groups);
    }).catch(function (err) { console.error('明细加载失败：', err); });
  }

  function renderStats(d) {
    $('#stat-count').textContent = d.count;
    $('#stat-expense').textContent = fmt(d.totalExpense);
    $('#stat-income').textContent = fmt(d.totalIncome);
    $('#month-label').textContent = monthTitle(d.month);
  }

  /* ---------- 按天分组渲染（沿用原页面结构与样式类） ---------- */
  function renderGroups(groups) {
    var box = $('#txn-groups');
    if (!groups.length) {
      box.innerHTML = '<div class="bg-surface rounded-xl p-space-md shadow-sm flex flex-col gap-space-sm">' +
        '<div class="py-space-lg text-center font-caption text-caption text-text-muted">这个筛选下还没有记录 🌸</div></div>';
      return;
    }
    box.innerHTML = groups.map(function (g) {
      var label = dayLabel(g.date);
      var expense = 0, income = 0;
      g.items.forEach(function (it) {
        if (it.type === 'expense') expense += it.amount; else income += it.amount;
      });
      var sumHtml = '<div class="font-label-sm text-label-sm text-text-secondary">当日小计: ' +
        (expense > 0 ? '<span class="text-flow-expense font-label-md text-label-md ml-1">-¥' + fmt(expense) + '</span>' : '') +
        (income > 0 ? '<span class="text-flow-income font-label-md text-label-md ml-1">+¥' + fmt(income) + '</span>' : '') +
        '</div>';

      var itemsHtml = g.items.map(function (it) {
        var cs = catStyle(it.categoryName);
        var sign = it.type === 'expense' ? '-' : '+';
        var cls = it.type === 'expense' ? 'text-flow-expense' : 'text-flow-income';
        return '<div class="tx-item group flex items-center justify-between p-space-sm rounded-lg hover:bg-surface-container-low cursor-pointer transition-all" data-tx-id="' + it.id + '">' +
          '<div class="flex items-center gap-space-md min-w-0">' +
            '<div class="w-9 h-9 rounded-lg ' + cs.cls + ' flex items-center justify-center flex-shrink-0">' +
              '<span class="material-symbols-outlined text-[20px]">' + cs.sym + '</span>' +
            '</div>' +
            '<div class="flex flex-col min-w-0">' +
              '<div class="flex items-center gap-space-xs">' +
                '<span class="font-label-md text-label-md text-text-primary truncate">' + esc(it.note || it.categoryName) + '</span>' +
                (it.subCategoryName ? '<span class="font-caption text-caption px-space-xs py-space-2xs rounded bg-surface-container ' + cs.cls.split(' ')[1] + '">' + esc(it.subCategoryName) + '</span>' : '') +
              '</div>' +
              '<div class="flex items-center gap-space-xs font-caption text-caption text-text-muted mt-space-2xs">' +
                '<span>' + esc(it.time || '') + '</span><span>·</span>' +
                '<span>' + esc(it.accountName || '未分配') + '</span><span>·</span>' +
                '<span>' + esc(it.categoryName) + '</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="flex items-center gap-space-md flex-shrink-0 pl-space-sm">' +
            '<span class="font-headline-md text-headline-md ' + cls + ' tracking-tight">' + sign + '¥' + fmt(it.amount) + '</span>' +
            '<div class="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">' +
              '<button class="w-7 h-7 rounded-full flex items-center justify-center text-text-muted hover:text-primary hover:bg-surface transition-colors" title="快速修改" data-act="edit" type="button">' +
                '<span class="material-symbols-outlined text-[16px]">edit</span></button>' +
              '<button class="w-7 h-7 rounded-full flex items-center justify-center text-text-muted hover:text-status-danger hover:bg-surface transition-colors" title="删除" data-act="del" type="button">' +
                '<span class="material-symbols-outlined text-[16px]">delete</span></button>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');

      return '<div class="bg-surface rounded-xl p-space-md shadow-sm flex flex-col gap-space-sm">' +
        '<div class="flex items-center justify-between px-space-xs pb-space-xs">' +
          '<div class="flex items-center gap-space-sm">' +
            '<span class="w-2 h-2 rounded-full bg-primary"></span>' +
            '<span class="font-headline-md text-headline-md text-text-primary">' + label.md + '</span>' +
            (label.tag ? '<span class="font-label-sm text-label-sm px-space-xs py-space-2xs rounded bg-surface-hero text-primary">' + label.tag + '</span>' : '') +
            '<span class="font-caption text-caption text-text-muted">' + weekday(g.date) + '</span>' +
          '</div>' +
          sumHtml +
        '</div>' +
        '<div class="flex flex-col gap-space-2xs">' + itemsHtml + '</div>' +
      '</div>';
    }).join('');
  }

  /* ---------- 记录查找 ---------- */
  function findRecord(id) {
    for (var i = 0; i < state.records.length; i++) {
      if (String(state.records[i].id) === String(id)) return state.records[i];
    }
    return null;
  }

  /* ---------- 填表（桌面快编面板 + 移动端抽屉，同一份数据源） ---------- */
  var editingId = null;

  function fillForm(rec) {
    if (rec) {
      editingId = rec.id;
      $('#editAmountInput').value = Number(rec.amount).toFixed(2);
      $('#editTitleInput').value = rec.note || '';
      $('#editCategorySelect').value = rec.categoryId;
      $('#editAccountSelect').value = rec.accountId || '';
      $('#editDateInput').value = rec.date;
      $('#editTimeInput').value = rec.time || '';
      $('#editRemarkInput').value = rec.note || '';
      $('#drawerAmountInput').value = Number(rec.amount).toFixed(2);
      $('#drawerTitleInput').value = rec.note || '';
      $('#drawerCategoryInput').value = rec.categoryName + (rec.subCategoryName ? '·' + rec.subCategoryName : '');
    } else {
      editingId = null;
      var meta = state.meta || {};
      $('#editAmountInput').value = '';
      $('#editTitleInput').value = '';
      $('#editAccountSelect').value = meta.accounts && meta.accounts.length ? meta.accounts[0].id : '';
      /* 记账日期与发生时刻由后端生成 */
      $('#editDateInput').value = meta.today || todayStr();
      $('#editTimeInput').value = meta.now || '';
      $('#editRemarkInput').value = '';
      $('#drawerAmountInput').value = '';
      $('#drawerTitleInput').value = '';
      $('#drawerCategoryInput').value = '';
    }
  }

  /* 打开移动端抽屉（并同步桌面表单） */
  var drawerOverlay = $('#mobileDrawerOverlay');
  var drawerPanel = $('#mobileDrawerPanel');
  function openDrawer() {
    if (!drawerOverlay || !drawerPanel) return;
    drawerOverlay.classList.remove('hidden');
    requestAnimationFrame(function () { drawerPanel.classList.remove('translate-y-full'); });
  }
  function closeDrawer() {
    if (!drawerOverlay || !drawerPanel) return;
    drawerPanel.classList.add('translate-y-full');
    setTimeout(function () { drawerOverlay.classList.add('hidden'); }, 280);
  }

  /* ---------- 保存（新增 / 修改） ---------- */
  function collectPayload() {
    var title = $('#editTitleInput').value.trim();
    var remark = $('#editRemarkInput').value.trim();
    return {
      amount: Number($('#editAmountInput').value),
      categoryId: Number($('#editCategorySelect').value),
      accountId: $('#editAccountSelect').value ? Number($('#editAccountSelect').value) : null,
      note: remark || title,
      date: $('#editDateInput').value
    };
  }

  function saveRecord() {
    var payload = collectPayload();
    if (!(payload.amount > 0)) { toast('请输入金额', true); return; }
    if (!payload.categoryId) { toast('请选择分类', true); return; }
    var url = editingId ? '/api/transaction/' + editingId : '/api/transaction';
    var method = editingId ? 'PUT' : 'POST';
    fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (!r.ok) return r.json().then(function (d) { throw new Error(d.message || '保存失败'); });
      return r.json();
    }).then(function () {
      toast(editingId ? '已更新 ✓' : '已记一笔 ✓');
      closeDrawer();
      return Promise.all([loadMeta(), loadList()]);
    }).catch(function (err) { toast(err.message || '保存失败', true); });
  }

  /* ---------- 删除 ---------- */
  function deleteRecord(id) {
    if (!window.confirm('确定删除这笔记录吗？删除后不可恢复。')) return;
    fetch('/api/transaction/' + id, { method: 'DELETE' })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (d) { throw new Error(d.message || '删除失败'); });
        return r.json();
      })
      .then(function () {
        toast('已删除');
        if (String(editingId) === String(id)) fillForm(null);
        loadList();
      })
      .catch(function (err) { toast(err.message || '删除失败', true); });
  }

  /* ---------- 导出 CSV ---------- */
  function exportCSV() {
    var url = '/api/transaction/export?month=' + encodeURIComponent(state.month);
    fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var disp = r.headers.get('Content-Disposition') || '';
      var m = disp.match(/filename="?([^"]+)"?/);
      return r.blob().then(function (b) { return { blob: b, name: m ? m[1] : 'jianji.csv' }; });
    }).then(function (f) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(f.blob);
      a.download = f.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
      toast('已导出 ' + monthTitle(state.month) + ' 明细 ✓');
    }).catch(function () { toast('导出失败，请稍后再试', true); });
  }

  /* ---------- 月份下拉菜单 ---------- */
  function renderMonthMenu(months, current) {
    var menu = $('#month-menu');
    if (!menu) return;
    menu.innerHTML = months.map(function (mk) {
      var on = mk === current;
      return '<button class="w-full flex items-center justify-between px-space-md py-space-xs font-label-md text-label-md ' +
        (on ? 'bg-surface-hero text-primary' : 'text-text-primary hover:bg-surface-hero') +
        ' transition-colors text-left" data-month="' + mk + '">' +
        '<span>' + monthTitle(mk) + '</span>' +
        (on ? '<span class="material-symbols-outlined text-primary text-[16px]">check_circle</span>' : '') +
        '</button>';
    }).join('');
  }

  function loadMonths() {
    return fetch('/api/transaction/months').then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (d) {
      renderMonthMenu(d.months, state.month);
      return d;
    }).catch(function (err) { console.error('月份列表加载失败：', err); });
  }

  function bindMonthMenu() {
    var toggle = $('#month-toggle');
    var menu = $('#month-menu');
    if (!toggle || !menu) return;
    function close() { menu.classList.add('hidden'); }
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      loadMonths().then(function () {
        menu.classList.toggle('hidden');
      });
    });
    menu.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-month]');
      if (!btn) return;
      state.month = btn.getAttribute('data-month');
      close();
      loadList();
    });
    document.addEventListener('click', function (e) {
      if (menu.classList.contains('hidden')) return;
      if (!menu.contains(e.target) && e.target !== toggle) close();
    });
  }

  /* ---------- 事件绑定 ---------- */
  function bindEvents() {
    /* 月份下拉 */
    bindMonthMenu();

    /* 月份切换 */
    $('#month-prev').addEventListener('click', function () {
      state.month = addMonths(state.month, -1);
      loadList();
      loadMonths();
    });
    $('#month-next').addEventListener('click', function () {
      var next = addMonths(state.month, 1);
      if (next > curMonth()) { toast('已经是最新月份了'); return; }
      state.month = next;
      loadList();
      loadMonths();
    });

    /* 导出 / 记一笔 */
    $('#exportBtn').addEventListener('click', exportCSV);
    $('#quickAddBtn').addEventListener('click', function () {
      fillForm(null);
      if (window.innerWidth < 1024) openDrawer();
      else $('#editAmountInput').focus();
    });
    $('#mobileAddFab').addEventListener('click', function () {
      fillForm(null);
      openDrawer();
    });

    /* 筛选胶囊：全部类型 / 支出 / 收入 */
    document.querySelectorAll('.filter-chip[data-filter]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        document.querySelectorAll('.filter-chip[data-filter]').forEach(function (c) {
          c.classList.remove('bg-primary', 'text-on-primary');
          c.classList.add('bg-surface-container-low', 'text-text-secondary');
        });
        chip.classList.add('bg-primary', 'text-on-primary');
        chip.classList.remove('bg-surface-container-low', 'text-text-secondary');
        state.type = chip.getAttribute('data-filter');
        state.categoryId = null;
        loadList();
      });
    });
    /* 筛选胶囊：分类 */
    document.querySelectorAll('.filter-chip[data-cat]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        document.querySelectorAll('.filter-chip[data-cat]').forEach(function (c) {
          c.classList.remove('bg-primary', 'text-on-primary');
          c.classList.add('bg-surface-container-low', 'text-text-secondary');
        });
        chip.classList.add('bg-primary', 'text-on-primary');
        chip.classList.remove('bg-surface-container-low', 'text-text-secondary');
        var name = chip.getAttribute('data-cat');
        var cat = (state.meta ? state.meta.categories : []).filter(function (c) {
          return c.name === name && !c.parent_id;
        })[0];
        state.categoryId = cat ? cat.id : null;
        loadList();
      });
    });

    /* 搜索：备注 / 商家 / 标签 */
    var searchInput = $('#transactionSearch');
    var searchTimer = null;
    searchInput.addEventListener('input', function (e) {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        state.keyword = e.target.value.trim();
        loadList();
      }, 300);
    });

    /* 列表：点击行 → 载入快编面板 */
    $('#txn-groups').addEventListener('click', function (e) {
      var actBtn = e.target.closest('[data-act]');
      var row = e.target.closest('.tx-item');
      if (!row) return;
      var id = row.getAttribute('data-tx-id');
      if (actBtn) {
        e.stopPropagation();
        if (actBtn.getAttribute('data-act') === 'del') deleteRecord(id);
        else { fillForm(findRecord(id)); if (window.innerWidth < 1024) openDrawer(); }
        return;
      }
      fillForm(findRecord(id));
      if (window.innerWidth < 1024) openDrawer();
    });

    /* 快编面板：保存 / 删除 */
    $('#saveTxBtn').addEventListener('click', saveRecord);
    $('#deleteTxBtn').addEventListener('click', function () {
      if (editingId) deleteRecord(editingId);
      else toast('当前是新增记录，无需删除', true);
    });

    /* 移动端抽屉 */
    $('#closeDrawerBtn').addEventListener('click', closeDrawer);
    if (drawerOverlay) {
      drawerOverlay.addEventListener('click', function (e) {
        if (e.target === drawerOverlay) closeDrawer();
      });
    }
    $('#drawerSaveBtn').addEventListener('click', function () {
      /* 移动端输入同步到统一表单后保存（与快编面板同一套逻辑） */
      $('#editAmountInput').value = $('#drawerAmountInput').value;
      var t = $('#drawerTitleInput').value.trim();
      if (t) { $('#editTitleInput').value = t; $('#editRemarkInput').value = t; }
      var catName = $('#drawerCategoryInput').value.trim();
      if (catName) {
        var base = catName.split('·')[0];
        var cat = (state.meta ? state.meta.categories : []).filter(function (c) {
          return c.name === base && !c.parent_id;
        })[0];
        if (cat) $('#editCategorySelect').value = cat.id;
      }
      saveRecord();
    });

    /* 金额算式求和（PRD 偏好 arith） */
    ['drawerAmountInput', 'editAmountInput'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      function run() {
        try { if (localStorage.getItem('jianji.pref.arith') !== '1') return; } catch (e) { return; }
        var s = String(el.value || '').trim().replace(/[^0-9+\-*/().\s]/g, '');
        if (!/[+\-*/]/.test(s)) return;
        try {
          var v = Function('"use strict";return (' + s + ')')();
          if (typeof v === 'number' && isFinite(v) && v >= 0) el.value = (Math.round(v * 100) / 100).toFixed(2);
        } catch (e) { /* 算式无效则不处理 */ }
      }
      el.addEventListener('change', run);
      el.addEventListener('blur', run);
    });
  }

  /* ---------- 启动 ---------- */
  state.month = curMonth();
  loadMeta().then(function () {
    fillForm(null);
    return loadList();
  }).then(function () {
    bindEvents();
  });
})();

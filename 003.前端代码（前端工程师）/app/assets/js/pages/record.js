/* ============================================================
   简记 · 记一笔副页（PRD 5.1 快速记账）
   收支类型（支出 / 收入，默认支出）→ 分类宫格联动 → 保存入库
   记账日期与创建时刻由后端生成（/api/transaction/meta 提供默认值）
   ============================================================ */
(function () {
  'use strict';

  var state = { type: 'expense', categoryId: null, subId: '', meta: null };

  function $(s) { return document.querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  /* ---------- 加载分类与账户 ---------- */
  function loadMeta() {
    return fetch('/api/transaction/meta').then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (meta) {
      state.meta = meta;
      $('#dt').value = meta.today || '';
      var sel = $('#acct');
      sel.innerHTML = '<option value="">未分配</option>' +
        meta.accounts.map(function (a) {
          return '<option value="' + a.id + '">' + esc(a.name) + '</option>';
        }).join('');
      if (meta.accounts.length) sel.value = meta.accounts[0].id;
      renderCats();
    }).catch(function (err) { console.error('元数据加载失败：', err); });
  }

  /* ---------- 分类宫格（按收支类型联动，PRD 5.2） ---------- */
  function renderCats() {
    var meta = state.meta;
    if (!meta) return;
    var cats = meta.categories.filter(function (c) {
      return c.type === state.type && !c.parent_id && c.is_active !== 0;
    });
    if (!state.categoryId || !cats.some(function (c) { return c.id === state.categoryId; })) {
      state.categoryId = cats.length ? cats[0].id : null;
      state.subId = '';
    }
    $('#cat-grid').innerHTML = cats.map(function (c) {
      var on = c.id === state.categoryId;
      return '<button class="flex flex-col items-center gap-space-2xs p-space-sm rounded-[14px] border transition-colors ' +
        (on ? 'border-primary bg-surface-hero' : 'border-border-hairline bg-surface hover:bg-surface-hero') +
        '" data-cat="' + c.id + '" role="radio" aria-checked="' + on + '">' +
        '<span class="w-9 h-9 rounded-[10px] ' + window.JIANCAT.cls(c.name) + ' flex items-center justify-center">' +
          '<span class="material-symbols-outlined text-[18px]">' + window.JIANCAT.sym(c.name) + '</span>' +
        '</span>' +
        '<span class="font-label-sm text-label-sm ' + (on ? 'text-text-primary font-semibold' : 'text-text-secondary') + '">' + esc(c.name) + '</span>' +
      '</button>';
    }).join('');
    $('#cat-hint').textContent = state.type === 'expense' ? '支出分类' : '收入分类';
    renderSubs();
  }

  /* ---------- 二级分类 ---------- */
  function renderSubs() {
    var meta = state.meta;
    var row = $('#sub-row');
    if (!meta || !state.categoryId) { row.innerHTML = ''; return; }
    var parent = meta.categories.filter(function (c) { return c.id === state.categoryId; })[0];
    var subs = meta.categories.filter(function (c) { return c.parent_id === state.categoryId; });
    if (!subs.length) { row.innerHTML = ''; return; }
    row.innerHTML = '<button class="px-space-md py-space-xs rounded-full text-[12.5px] border transition-colors ' +
        (state.subId === '' ? 'border-primary bg-surface-hero text-brand-text font-semibold' : 'border-border-hairline bg-surface text-text-secondary') +
        '" data-sub="">不限</button>' +
      subs.map(function (s) {
        var on = s.id === state.subId;
        return '<button class="px-space-md py-space-xs rounded-full text-[12.5px] border transition-colors ' +
          (on ? 'border-primary bg-surface-hero text-brand-text font-semibold' : 'border-border-hairline bg-surface text-text-secondary') +
          '" data-sub="' + s.id + '">' + esc(s.name) + '</button>';
      }).join('');
  }

  /* ---------- 收支类型切换 ---------- */
  function setType(t) {
    state.type = t;
    state.categoryId = null;
    state.subId = '';
    $('#type-seg').querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-type') === t);
    });
    var sign = $('#amt-sign');
    sign.textContent = t === 'expense' ? '-¥' : '+¥';
    sign.className = 'font-headline-lg text-headline-lg ' + (t === 'expense' ? 'text-primary' : 'text-flow-income');
    renderCats();
  }

  /* ---------- 金额解析（支持四则运算，PRD 5.1 规则 5） ---------- */
  function evalAmount(raw) {
    var s = String(raw || '').trim().replace(/[０-９]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
    }).replace(/，/g, ',').replace(/,/g, '');
    if (!s) return null;
    if (/^[0-9]+(\.[0-9]{1,2})?$/.test(s)) return parseFloat(s);
    if (/^[0-9]+\.[0-9]{3,}$/.test(s)) return null;
    if (/^[0-9+\-*/().\s]+$/.test(s)) {
      try {
        var v = Function('"use strict";return (' + s + ')')();
        if (typeof v === 'number' && isFinite(v) && v >= 0) return Math.round(v * 100) / 100;
      } catch (e) { /* 算式无效 */ }
    }
    return null;
  }

  /* ---------- 保存 ---------- */
  function save() {
    var v = evalAmount($('#amt').value);
    if (v === null) { toast('请输入正确的金额', true); $('#amt').focus(); return; }
    if (!(v > 0)) { toast('金额需大于 0', true); $('#amt').focus(); return; }
    if (!state.categoryId) { toast('请选择分类', true); return; }
    var payload = {
      amount: v,
      categoryId: state.categoryId,
      subCategoryId: state.subId || null,
      accountId: $('#acct').value ? Number($('#acct').value) : null,
      note: $('#note').value.trim(),
      date: $('#dt').value
    };
    fetch('/api/transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (!r.ok) return r.json().then(function (d) { throw new Error(d.message || '保存失败'); });
      return r.json();
    }).then(function (d) {
      var rec = d.record;
      toast((rec.type === 'expense' ? '已记一笔支出 ' : '已记一笔收入 ') + '¥' + rec.amount + ' ✓');
      setTimeout(function () {
        location.href = location.search.indexOf('from=stats') > -1 ? 'analytics.html' : 'index.html';
      }, 700);
    }).catch(function (err) { toast(err.message || '保存失败', true); });
  }

  /* ---------- 事件 ---------- */
  function bindEvents() {
    $('#type-seg').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b) setType(b.getAttribute('data-type'));
    });
    $('#cat-grid').addEventListener('click', function (e) {
      var b = e.target.closest('[data-cat]');
      if (!b) return;
      state.categoryId = Number(b.getAttribute('data-cat'));
      state.subId = '';
      renderCats();
    });
    $('#sub-row').addEventListener('click', function (e) {
      var b = e.target.closest('[data-sub]');
      if (!b) return;
      var v = b.getAttribute('data-sub');
      state.subId = v === '' ? '' : Number(v);
      renderSubs();
    });
    $('#btn-save').addEventListener('click', save);
    $('#btn-back').addEventListener('click', function () {
      if (history.length > 1) history.back(); else location.href = 'index.html';
    });
    $('#amt').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); save(); }
    });
  }

  /* ---------- 启动 ---------- */
  window.JIANJI.me().then(function (me) {
    if (!me || !me.username) { location.replace('login.html'); return; }
    bindEvents();
    setType('expense');           // 默认支出
    loadMeta();
  });
})();

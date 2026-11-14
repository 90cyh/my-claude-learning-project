/* ============================================================
   简记 · 记一笔弹窗（全站共享组件）
   沿用 002 实现版的弹窗设计（移动端底部抽屉 / 桌面端居中对话框），
   新增收支类型切换（支出 / 收入，默认支出，PRD 5.1 / 5.9）。
   任意页面调用 window.JIANJIRECORD.open() 即可唤起；
   保存成功后弹窗自动收起，并广播 jianji:txn-changed 事件供各页刷新。
   ============================================================ */
window.JIANJIRECORD = (function () {
  'use strict';

  var state = { type: 'expense', categoryId: null, subId: null, meta: null, opened: false };

  function $(s) { return document.querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  /* ---------- 注入弹窗结构 ---------- */
  function inject() {
    if ($('#record-sheet')) return;
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="backdrop" id="record-backdrop"></div>' +
      '<div class="sheet" id="record-sheet" role="dialog" aria-modal="true" aria-labelledby="record-title">' +
        '<div class="sheet-head">' +
          '<h3 id="record-title">记一笔</h3>' +
          '<button class="icon-btn" id="record-close" aria-label="关闭" type="button">✕</button>' +
        '</div>' +
        '<div class="flex justify-center mt-3">' +
          '<div class="seg" id="record-type-seg">' +
            '<button class="on" data-type="expense">支出</button>' +
            '<button data-type="income">收入</button>' +
          '</div>' +
        '</div>' +
        '<div class="amt-row">' +
          '<span class="cny" id="record-sign">-¥</span>' +
          '<input id="amt" inputmode="decimal" placeholder="0.00" autocomplete="off" aria-label="金额">' +
        '</div>' +
        '<div class="hint-pad">支持算式，如 <code>12+16</code> · <code>58/2</code></div>' +
        '<div class="err" id="record-err" hidden></div>' +
        '<div class="cat-grid" id="record-cat-grid" role="radiogroup" aria-label="选择分类"></div>' +
        '<div class="sub-row" id="record-sub-row"></div>' +
        '<div class="field-row">' +
          '<label class="field">记账日期<input id="record-date" type="date"></label>' +
          '<label class="field">资金账户<select id="record-account"></select></label>' +
        '</div>' +
        '<div class="field-row">' +
          '<label class="field" style="flex:1">备注（选填，50 字内）<input id="record-note" maxlength="50" placeholder="例如：和府捞面园区店"></label>' +
        '</div>' +
        '<div class="sheet-actions">' +
          /* 与明细页「保存更新」按钮同款样式（bg-primary / hover:bg-secondary / text-on-primary） */
          '<button class="w-full h-11 rounded-full bg-primary hover:bg-secondary text-on-primary font-headline-md text-label-md flex items-center justify-center gap-space-xs transition-colors active:scale-[0.97] disabled:opacity-60 disabled:pointer-events-none" id="record-save" type="button">' +
            '<span class="material-symbols-outlined text-[18px]">check</span>' +
            '<span>保存</span>' +
          '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap);
    bind();
  }

  /* ---------- 元数据（分类 / 账户 / 后端生成的今天） ---------- */
  function loadMeta() {
    return fetch('/api/transaction/meta').then(function (r) { return r.json(); })
      .then(function (meta) {
        state.meta = meta;
        $('#record-date').value = meta.today || '';
        $('#record-account').innerHTML = '<option value="">未分配</option>' +
          meta.accounts.map(function (a) {
            return '<option value="' + a.id + '">' + esc(a.name) + '</option>';
          }).join('');
        if (meta.accounts.length) $('#record-account').value = meta.accounts[0].id;
        renderCats();
      }).catch(function (err) { console.error('记账弹窗元数据加载失败：', err); });
  }

  /* ---------- 分类宫格（按类型联动） ---------- */
  function renderCats() {
    if (!state.meta) return;
    var cats = state.meta.categories.filter(function (c) {
      return c.type === state.type && !c.parent_id;
    });
    if (!state.categoryId || !cats.some(function (c) { return c.id === state.categoryId; })) {
      state.categoryId = cats.length ? cats[0].id : null;
      state.subId = null;
    }
    $('#record-cat-grid').innerHTML = cats.map(function (c) {
      var on = c.id === state.categoryId;
      return '<button class="cat-tile ' + (on ? 'on' : '') + '" data-cat="' + c.id + '" role="radio" aria-checked="' + on + '">' +
        '<span class="cat-ico rounded-[10px] ' + window.JIANCAT.cls(c.name) + ' flex items-center justify-center">' +
          '<span class="material-symbols-outlined text-[17px]">' + window.JIANCAT.sym(c.name) + '</span>' +
        '</span>' + esc(c.name) +
      '</button>';
    }).join('');
    renderSubs();
  }

  function renderSubs() {
    if (!state.meta || !state.categoryId) { $('#record-sub-row').innerHTML = ''; return; }
    var subs = state.meta.categories.filter(function (c) { return c.parent_id === state.categoryId; });
    if (!subs.length) { $('#record-sub-row').innerHTML = ''; return; }
    $('#record-sub-row').innerHTML =
      '<button class="sub-chip ' + (state.subId === null ? 'on' : '') + '" data-sub="">不限</button>' +
      subs.map(function (s) {
        return '<button class="sub-chip ' + (state.subId === s.id ? 'on' : '') + '" data-sub="' + s.id + '">' + esc(s.name) + '</button>';
      }).join('');
  }

  /* ---------- 打开 / 关闭 ---------- */
  function open() {
    inject();
    state.opened = true;
    state.categoryId = null;
    state.subId = null;
    $('#amt').value = '';
    $('#record-note').value = '';
    $('#record-err').hidden = true;
    setType('expense');
    $('#record-backdrop').classList.add('open');
    $('#record-sheet').classList.add('open');
    document.body.style.overflow = 'hidden';
    loadMeta();
    if (matchMedia('(pointer: fine)').matches) setTimeout(function () { $('#amt').focus(); }, 220);
  }

  function close() {
    state.opened = false;
    $('#record-backdrop').classList.remove('open');
    $('#record-sheet').classList.remove('open');
    document.body.style.overflow = '';
  }

  function setType(t) {
    state.type = t;
    state.categoryId = null;
    state.subId = null;
    $('#record-type-seg').querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-type') === t);
    });
    var sign = $('#record-sign');
    sign.textContent = t === 'expense' ? '-¥' : '+¥';
    sign.className = 'cny' + (t === 'expense' ? '' : ' income');
    renderCats();
  }

  /* ---------- 金额解析（支持四则运算） ---------- */
  function evalAmount(raw) {
    var s = String(raw || '').trim()
      .replace(/[０-９]/g, function (ch) { return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0); })
      .replace(/，/g, ',').replace(/,/g, '');
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
    var err = $('#record-err');
    var v = evalAmount($('#amt').value);
    if (v === null) { err.textContent = '请输入正确的金额'; err.hidden = false; return; }
    if (!(v > 0)) { err.textContent = '金额需大于 0'; err.hidden = false; return; }
    if (!state.categoryId) { err.textContent = '请选择分类'; err.hidden = false; return; }
    var payload = {
      amount: v,
      categoryId: state.categoryId,
      subCategoryId: state.subId || null,
      accountId: $('#record-account').value ? Number($('#record-account').value) : null,
      note: $('#record-note').value.trim(),
      date: $('#record-date').value
    };
    $('#record-save').disabled = true;
    fetch('/api/transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (!r.ok) return r.json().then(function (d) { throw new Error(d.message || '保存失败'); });
      return r.json();
    }).then(function (d) {
      close();                                   /* 确认后弹窗收起 */
      if (window.showToast) {
        showToast((d.record.type === 'expense' ? '已记一笔支出 ' : '已记一笔收入 ') + '¥' + d.record.amount + ' ✓', 'check_circle');
      }
      window.dispatchEvent(new CustomEvent('jianji:txn-changed', { detail: d.record }));
    }).catch(function (e) {
      err.textContent = e.message || '保存失败';
      err.hidden = false;
    }).finally(function () {
      $('#record-save').disabled = false;
    });
  }

  /* ---------- 事件 ---------- */
  function bind() {
    $('#record-close').addEventListener('click', close);
    $('#record-backdrop').addEventListener('click', close);
    $('#record-type-seg').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b) setType(b.getAttribute('data-type'));
    });
    $('#record-cat-grid').addEventListener('click', function (e) {
      var b = e.target.closest('[data-cat]');
      if (!b) return;
      state.categoryId = Number(b.getAttribute('data-cat'));
      state.subId = null;
      renderCats();
    });
    $('#record-sub-row').addEventListener('click', function (e) {
      var b = e.target.closest('[data-sub]');
      if (!b) return;
      var v = b.getAttribute('data-sub');
      state.subId = v === '' ? null : Number(v);
      renderSubs();
    });
    $('#record-save').addEventListener('click', save);
    $('#amt').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); save(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && state.opened) close();
    });
  }

  return { open: open, close: close };
})();
